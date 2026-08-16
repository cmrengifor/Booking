import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { DateTime } from "luxon";
import { resolveSalonBySlug } from "@/lib/tenant/resolve-salon";
import { getSalonMembership } from "@/lib/auth/session";
import { loadAnalytics, parseFilter } from "../data";
import { RANGE_LABELS } from "../range";

export async function GET(request: Request, context: RouteContext<"/salon/[slug]/admin/analytics/export">) {
  const { slug } = await context.params;
  const salon = await resolveSalonBySlug(slug);
  if (!salon) return NextResponse.json({ error: "Salon not found" }, { status: 404 });

  const membership = await getSalonMembership(salon.id);
  if (!membership) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const filter = parseFilter({
    range: searchParams.get("range") ?? undefined,
    ref: searchParams.get("ref") ?? undefined,
    service: searchParams.get("service") ?? undefined,
  });
  const analytics = await loadAnalytics(salon.id, salon.timezone, filter);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = salon.name;

  const summarySheet = workbook.addWorksheet("Resumen");
  summarySheet.columns = [
    { header: "Métrica", key: "metric", width: 28 },
    { header: "Valor", key: "value", width: 20 },
  ];
  summarySheet.addRows([
    { metric: "Rango", value: RANGE_LABELS[filter.mode] },
    { metric: "Desde", value: analytics.start.setLocale("es").toFormat("d LLL yyyy") },
    { metric: "Hasta", value: analytics.end.setLocale("es").toFormat("d LLL yyyy") },
    { metric: "Ingresos", value: analytics.totalRevenue },
    { metric: "Citas completadas", value: analytics.completedCount },
    { metric: "Citas canceladas", value: analytics.cancelledCount },
    { metric: "No asistió", value: analytics.noShowCount },
    { metric: "Clientes distintos", value: analytics.distinctCustomers },
    { metric: "Ticket promedio", value: analytics.avgTicket },
    { metric: "Tasa de cancelación", value: `${analytics.cancellationRate}%` },
    { metric: "Tasa de no-show", value: `${analytics.noShowRate}%` },
    { metric: "Calificación promedio", value: analytics.avgRating ?? "—" },
  ]);
  summarySheet.getRow(1).font = { bold: true };

  const artistSheet = workbook.addWorksheet("Por artista");
  artistSheet.columns = [
    { header: "Artista", key: "name", width: 24 },
    { header: "Citas completadas", key: "count", width: 18 },
    { header: "Ingresos", key: "revenue", width: 14 },
    { header: "Calificación", key: "rating", width: 14 },
  ];
  artistSheet.addRows(
    analytics.artists.map((a) => ({
      name: a.name,
      count: a.count,
      revenue: a.revenue,
      rating: a.avgRating ?? "—",
    }))
  );
  artistSheet.getRow(1).font = { bold: true };

  const serviceSheet = workbook.addWorksheet("Por servicio");
  serviceSheet.columns = [
    { header: "Servicio", key: "name", width: 24 },
    { header: "Citas completadas", key: "count", width: 18 },
    { header: "Ingresos", key: "revenue", width: 14 },
    { header: "% Artista", key: "splitPercent", width: 12 },
    { header: "Gana artista", key: "artistEarned", width: 14 },
    { header: "Gana negocio", key: "businessEarned", width: 14 },
  ];
  serviceSheet.addRows(analytics.services);
  serviceSheet.getRow(1).font = { bold: true };

  const appointmentsSheet = workbook.addWorksheet("Citas");
  appointmentsSheet.columns = [
    { header: "Fecha", key: "date", width: 18 },
    { header: "Servicio", key: "service", width: 22 },
    { header: "Artista", key: "artist", width: 20 },
    { header: "Estado", key: "status", width: 14 },
    { header: "Precio", key: "price", width: 12 },
    { header: "Cobrado", key: "amountPaid", width: 12 },
  ];
  appointmentsSheet.addRows(
    analytics.appointments.map((a) => ({
      date: DateTime.fromISO(a.starts_at).setZone(salon.timezone).setLocale("es").toFormat("d LLL yyyy, HH:mm"),
      service: a.services?.name ?? "",
      artist: a.salon_memberships?.artist_profiles?.display_name ?? "—",
      status: a.status,
      price: a.price,
      amountPaid: a.amount_paid ?? "",
    }))
  );
  appointmentsSheet.getRow(1).font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `analisis-${salon.slug}-${filter.mode}-${analytics.start.toISODate()}.xlsx`;

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
