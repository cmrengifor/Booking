import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { DateTime } from "luxon";
import { resolveSalonBySlug } from "@/lib/tenant/resolve-salon";
import { getSalonMembership } from "@/lib/auth/session";
import { loadAnalytics, parseFilter } from "../data";
import { RANGE_LABELS } from "../range";

const CURRENCY_FMT = "$#,##0.00";
const PERCENT_FMT = "0.0%";

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

  // === Citas — raw data with per-row split formulas, native autofilter ======
  const citasSheet = workbook.addWorksheet("Citas");
  citasSheet.columns = [
    { header: "Fecha", key: "date", width: 18 },
    { header: "Servicio", key: "service", width: 22 },
    { header: "Artista", key: "artist", width: 20 },
    { header: "Estado", key: "status", width: 14 },
    { header: "Precio", key: "price", width: 12 },
    { header: "Cobrado", key: "amountPaid", width: 12 },
    { header: "% Artista", key: "splitPercent", width: 10 },
    { header: "Margen Artista", key: "artistMargin", width: 16 },
    { header: "Margen Negocio", key: "businessMargin", width: 16 },
  ];
  citasSheet.getRow(1).font = { bold: true };

  analytics.appointments.forEach((a) => {
    const row = citasSheet.addRow({
      date: DateTime.fromISO(a.starts_at).setZone(salon.timezone).setLocale("es").toFormat("d LLL yyyy, HH:mm"),
      service: a.services?.name ?? "",
      artist: a.salon_memberships?.artist_profiles?.display_name ?? "—",
      status: a.status,
      price: a.price,
      amountPaid: a.amount_paid ?? undefined,
      splitPercent: a.services?.artist_split_percent ?? 50,
    });
    const r = row.number;
    row.getCell("artistMargin").value = { formula: `F${r}*G${r}/100` };
    row.getCell("businessMargin").value = { formula: `F${r}-H${r}` };
    row.getCell("price").numFmt = CURRENCY_FMT;
    row.getCell("amountPaid").numFmt = CURRENCY_FMT;
    row.getCell("artistMargin").numFmt = CURRENCY_FMT;
    row.getCell("businessMargin").numFmt = CURRENCY_FMT;
    row.getCell("splitPercent").numFmt = "0";
  });
  citasSheet.autoFilter = { from: "A1", to: `I${citasSheet.rowCount}` };

  // === Resumen — driven by formulas over the Citas sheet =====================
  const summarySheet = workbook.addWorksheet("Resumen");
  summarySheet.columns = [
    { header: "Métrica", key: "metric", width: 28 },
    { header: "Valor", key: "value", width: 20 },
  ];
  summarySheet.getRow(1).font = { bold: true };

  const completedCriteria = `Citas!$D:$D,"completed"`;
  const cancelledCriteria = `Citas!$D:$D,"cancelled"`;
  const noShowCriteria = `Citas!$D:$D,"no_show"`;

  const summaryRows: { metric: string; formula?: string; value?: string | number; numFmt?: string }[] = [
    { metric: "Rango", value: RANGE_LABELS[filter.mode] },
    { metric: "Desde", value: analytics.start.setLocale("es").toFormat("d LLL yyyy") },
    { metric: "Hasta", value: analytics.end.setLocale("es").toFormat("d LLL yyyy") },
    { metric: "Ingresos", formula: `SUM(Citas!$F:$F)`, numFmt: CURRENCY_FMT },
    { metric: "Citas completadas", formula: `COUNTIF(${completedCriteria})` },
    { metric: "Citas canceladas", formula: `COUNTIF(${cancelledCriteria})` },
    { metric: "No asistió", formula: `COUNTIF(${noShowCriteria})` },
    { metric: "Clientes distintos", value: analytics.distinctCustomers },
    {
      metric: "Ticket promedio",
      formula: `IFERROR(SUM(Citas!$F:$F)/COUNTIF(${completedCriteria}),0)`,
      numFmt: CURRENCY_FMT,
    },
    {
      metric: "Tasa de cancelación",
      formula: `IFERROR(COUNTIF(${cancelledCriteria})/(COUNTIF(${completedCriteria})+COUNTIF(${cancelledCriteria})+COUNTIF(${noShowCriteria})),0)`,
      numFmt: PERCENT_FMT,
    },
    {
      metric: "Tasa de no-show",
      formula: `IFERROR(COUNTIF(${noShowCriteria})/(COUNTIF(${completedCriteria})+COUNTIF(${cancelledCriteria})+COUNTIF(${noShowCriteria})),0)`,
      numFmt: PERCENT_FMT,
    },
    { metric: "Calificación promedio", value: analytics.avgRating ?? "—" },
  ];
  for (const r of summaryRows) {
    const row = summarySheet.addRow({ metric: r.metric, value: r.formula ? { formula: r.formula } : r.value });
    if (r.numFmt) row.getCell("value").numFmt = r.numFmt;
  }

  // === Por servicio — SUMIFS/COUNTIFS over the Citas sheet ====================
  const serviceSheet = workbook.addWorksheet("Por servicio");
  serviceSheet.columns = [
    { header: "Servicio", key: "name", width: 24 },
    { header: "Citas completadas", key: "count", width: 18 },
    { header: "Ingresos", key: "revenue", width: 14 },
    { header: "% Artista", key: "splitPercent", width: 12 },
    { header: "Gana artista", key: "artistEarned", width: 14 },
    { header: "Gana negocio", key: "businessEarned", width: 14 },
    { header: "Margen negocio %", key: "marginPercent", width: 16 },
  ];
  serviceSheet.getRow(1).font = { bold: true };

  for (const s of analytics.services) {
    const row = serviceSheet.addRow({
      name: s.name,
      count: { formula: `COUNTIFS(Citas!$B:$B,"${s.name}",Citas!$D:$D,"completed")` },
      revenue: { formula: `SUMIFS(Citas!$F:$F,Citas!$B:$B,"${s.name}",Citas!$D:$D,"completed")` },
      splitPercent: s.splitPercent,
      artistEarned: { formula: `SUMIFS(Citas!$H:$H,Citas!$B:$B,"${s.name}",Citas!$D:$D,"completed")` },
      businessEarned: { formula: `SUMIFS(Citas!$I:$I,Citas!$B:$B,"${s.name}",Citas!$D:$D,"completed")` },
    });
    const r = row.number;
    row.getCell("marginPercent").value = { formula: `IFERROR(F${r}/C${r},0)` };
    row.getCell("revenue").numFmt = CURRENCY_FMT;
    row.getCell("artistEarned").numFmt = CURRENCY_FMT;
    row.getCell("businessEarned").numFmt = CURRENCY_FMT;
    row.getCell("marginPercent").numFmt = PERCENT_FMT;
    row.getCell("splitPercent").numFmt = "0";
  }

  // === Por artista — same pattern, keyed on the Artista column ===============
  const artistSheet = workbook.addWorksheet("Por artista");
  artistSheet.columns = [
    { header: "Artista", key: "name", width: 24 },
    { header: "Citas completadas", key: "count", width: 18 },
    { header: "Ingresos", key: "revenue", width: 14 },
    { header: "Calificación", key: "rating", width: 14 },
  ];
  artistSheet.getRow(1).font = { bold: true };

  for (const a of analytics.artists) {
    const row = artistSheet.addRow({
      name: a.name,
      count: { formula: `COUNTIFS(Citas!$C:$C,"${a.name}",Citas!$D:$D,"completed")` },
      revenue: { formula: `SUMIFS(Citas!$F:$F,Citas!$C:$C,"${a.name}",Citas!$D:$D,"completed")` },
      rating: a.avgRating ?? "—",
    });
    row.getCell("revenue").numFmt = CURRENCY_FMT;
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `analisis-${salon.slug}-${filter.mode}-${analytics.start.toISODate()}.xlsx`;

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
