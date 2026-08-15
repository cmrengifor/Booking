"""Availability engine: turns (service, date, staff-or-any) into bookable slots.

Both the client booking widget and the staff admin screen call
`get_available_slots` so slot logic never diverges between the two surfaces.
"""
from datetime import date
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session

SLOT_GRANULARITY_MINUTES = 15  # confirm against how the pilot salon actually schedules

_AVAILABLE_SLOTS_SQL = text(
    """
    WITH candidate_staff AS (
        SELECT s.id AS staff_id
        FROM staff s
        JOIN staff_services ss ON ss.staff_id = s.id
        WHERE ss.service_id = :service_id
          AND s.tenant_id = :tenant_id
          AND s.active = true
          AND (:staff_id IS NULL OR s.id = :staff_id)
    ),
    service_info AS (
        SELECT duration_minutes, buffer_minutes
        FROM services
        WHERE id = :service_id
    ),
    working_window AS (
        SELECT cs.staff_id, wh.start_time, wh.end_time
        FROM candidate_staff cs
        JOIN staff_working_hours wh ON wh.staff_id = cs.staff_id
        WHERE wh.day_of_week = EXTRACT(DOW FROM :target_date::date)
    ),
    slot_candidates AS (
        SELECT
            ww.staff_id,
            gs AS start_time,
            gs + (si.duration_minutes + si.buffer_minutes) * INTERVAL '1 minute' AS end_time
        FROM working_window ww
        CROSS JOIN service_info si
        CROSS JOIN LATERAL generate_series(
            (:target_date::date + ww.start_time)::timestamptz,
            (:target_date::date + ww.end_time)::timestamptz
                - (si.duration_minutes + si.buffer_minutes) * INTERVAL '1 minute',
            (:slot_granularity_minutes::text || ' minutes')::interval
        ) AS gs
    )
    SELECT sc.staff_id, sc.start_time, sc.end_time
    FROM slot_candidates sc
    WHERE NOT EXISTS (
        SELECT 1 FROM appointments a
        WHERE a.staff_id = sc.staff_id AND a.status = 'confirmed'
          AND tstzrange(a.start_time, a.end_time) && tstzrange(sc.start_time, sc.end_time)
    )
    AND NOT EXISTS (
        SELECT 1 FROM booking_holds bh
        WHERE bh.staff_id = sc.staff_id AND bh.expires_at > now()
          AND tstzrange(bh.start_time, bh.end_time) && tstzrange(sc.start_time, sc.end_time)
    )
    AND NOT EXISTS (
        SELECT 1 FROM staff_time_off t
        WHERE t.staff_id = sc.staff_id
          AND tstzrange(t.start_at, t.end_at) && tstzrange(sc.start_time, sc.end_time)
    )
    ORDER BY sc.start_time, sc.staff_id
    """
)


def get_available_slots(
    db: Session,
    tenant_id: UUID,
    service_id: UUID,
    target_date: date,
    staff_id: UUID | None = None,
    slot_granularity_minutes: int = SLOT_GRANULARITY_MINUTES,
):
    """Return bookable (staff_id, start_time, end_time) rows for the given day.

    staff_id=None means "any available" — candidates are every active staff
    member qualified for the service.
    """
    return db.execute(
        _AVAILABLE_SLOTS_SQL,
        {
            "tenant_id": str(tenant_id),
            "service_id": str(service_id),
            "target_date": target_date.isoformat(),
            "staff_id": str(staff_id) if staff_id else None,
            "slot_granularity_minutes": slot_granularity_minutes,
        },
    ).fetchall()


_LEAST_BOOKED_STAFF_SQL = text(
    """
    SELECT cand.staff_id
    FROM unnest(:candidate_staff_ids::uuid[]) AS cand(staff_id)
    ORDER BY (
        SELECT count(*) FROM appointments a
        WHERE a.staff_id = cand.staff_id AND a.status = 'confirmed'
          AND a.start_time::date = :target_date::date
    ) ASC
    LIMIT 1
    """
)


def assign_least_booked_staff(
    db: Session, candidate_staff_ids: list[UUID], target_date: date
) -> UUID | None:
    """Pick the "any available" staff member with the fewest confirmed
    appointments today. Call inside the same transaction as the appointment
    insert, and retry (re-run availability + re-pick) if the insert is
    rejected by the no_overlapping_appointments EXCLUDE constraint.
    """
    row = db.execute(
        _LEAST_BOOKED_STAFF_SQL,
        {
            "candidate_staff_ids": [str(sid) for sid in candidate_staff_ids],
            "target_date": target_date.isoformat(),
        },
    ).first()
    return row.staff_id if row else None
