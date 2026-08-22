import type { Enums, Tables } from "@/types/database";

type MembershipRole = Pick<Tables<"salon_memberships">, "role"> | null | undefined;

function hasRole(membership: MembershipRole, ...roles: Enums<"salon_role">[]): boolean {
  return !!membership && (roles as string[]).includes(membership.role);
}

/**
 * Central home for "which role can do X" — every one of these currently
 * resolves to the same owner/manager check, but each names a distinct
 * business concern on purpose: catalog, staff, and review moderation are
 * unrelated capabilities that only happen to share a rule today. A future
 * change to one (e.g. letting managers moderate reviews but not touch
 * pricing) only needs to change here, not be re-discovered across pages.
 *
 * These mirror the RLS/RPC-level rules already enforced in Postgres — see
 * the `_write` policies on services/service_categories/service_variants/
 * service_promotions (catalog), salon_memberships (staff), and
 * moderate_review's own WHERE clause (reviews). This module exists purely
 * to keep the *UI-layer* show/hide checks in one place; RLS/RPCs remain
 * the actual authorization boundary regardless of what this returns.
 */

/** Create/edit/archive services, categories, variants, and promotions. */
export function canManageCatalog(membership: MembershipRole): boolean {
  return hasRole(membership, "owner", "manager");
}

/** Publish or reject a customer review. */
export function canModerateReviews(membership: MembershipRole): boolean {
  return hasRole(membership, "owner", "manager");
}

/** Edit a staff member's profile/schedule, deactivate/reactivate them,
 *  invite new non-owner staff, change a non-owner's role, reassign a
 *  non-owner's location. */
export function canManageStaff(membership: MembershipRole): boolean {
  return hasRole(membership, "owner", "manager");
}

/** Touch anything involving the 'owner' role itself — invite a co-owner,
 *  promote/demote to or from owner, or edit/remove an existing owner's
 *  membership. A manager can manage every other role but not this one. */
export function canManageOwnership(membership: MembershipRole): boolean {
  return hasRole(membership, "owner");
}

/**
 * See the salon's full customer roster. A stylist without this only sees
 * customers tied to their own appointments.
 */
export function canViewAllCustomers(membership: MembershipRole): boolean {
  return hasRole(membership, "owner", "manager", "receptionist");
}

/**
 * See a customer's phone/email. Receptionist and stylist both work through
 * the system's own reminder/notification actions instead of raw contact
 * details — only management sees the actual values.
 */
export function canViewCustomerContactInfo(membership: MembershipRole): boolean {
  return hasRole(membership, "owner", "manager");
}

/**
 * See every appointment at the salon (with customer identity). A stylist
 * without this only sees their own assigned appointments — plus the
 * unassigned "open" pool, so they can still self-claim — and never sees
 * the customer's name on any of them, only the booking itself.
 */
export function canViewAllAppointments(membership: MembershipRole): boolean {
  return hasRole(membership, "owner", "manager", "receptionist");
}

/**
 * See salon-wide financial totals and cross-artist rankings in Analytics.
 * A stylist without this only sees their own metrics (completed count,
 * their own revenue, their own rating/service breakdown).
 */
export function canViewSalonFinancials(membership: MembershipRole): boolean {
  return hasRole(membership, "owner", "manager", "receptionist");
}
