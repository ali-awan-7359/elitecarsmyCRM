import { NextRequest, NextResponse } from "next/server";
import { db, type LeadRow } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COLUMNS: Array<{ header: string; key: keyof LeadRow; width: number }> = [
  { header: "Company", key: "company_name", width: 38 },
  { header: "Niche", key: "niche", width: 30 },
  { header: "Industry", key: "industry", width: 28 },
  { header: "Area", key: "area", width: 14 },
  { header: "Postcode", key: "postcode", width: 11 },
  { header: "Address", key: "address", width: 40 },
  { header: "SIC Codes", key: "sic_codes", width: 18 },
  { header: "Company Number", key: "company_number", width: 15 },
  { header: "Company Type", key: "company_type", width: 16 },
  { header: "Status (CH)", key: "status", width: 12 },
  { header: "Incorporated", key: "incorporated", width: 13 },
  { header: "Email", key: "email", width: 34 },
  { header: "Email Source", key: "email_source", width: 12 },
  { header: "Email Confidence", key: "email_confidence", width: 16 },
  { header: "Phone", key: "phone", width: 20 },
  { header: "Contact", key: "contact", width: 26 },
  { header: "Website", key: "website", width: 32 },
  { header: "Angle", key: "angle", width: 52 },
  { header: "Priority", key: "priority", width: 11 },
  { header: "Score", key: "score", width: 8 },
  { header: "Lead Type", key: "lead_type", width: 14 },
  { header: "Last Contacted", key: "last_contacted", width: 17 },
  { header: "Enriched At", key: "enriched_at", width: 17 },
];

function valueOf(lead: LeadRow, key: keyof LeadRow) {
  const raw = lead[key];
  return raw === null || raw === undefined ? "" : raw;
}

export async function GET(request: NextRequest) {
  const XLSX = await import("xlsx");
  const search = (request.nextUrl.searchParams.get("q") ?? "").trim();
  const area = request.nextUrl.searchParams.get("area");
  const priority = request.nextUrl.searchParams.get("priority");
  const niche = request.nextUrl.searchParams.get("niche");
  const emailOnly = request.nextUrl.searchParams.get("emailOnly") === "true";
  const format = (request.nextUrl.searchParams.get("format") ?? "xlsx").toLowerCase();

  const where: string[] = [];
  const params: Array<string | number> = [];
  if (search) {
    where.push("(company_name LIKE ? OR area LIKE ? OR industry LIKE ? OR niche LIKE ? OR email LIKE ? OR phone LIKE ?)");
    const like = `%${search}%`;
    params.push(like, like, like, like, like, like);
  }
  if (area && area !== "All") {
    where.push("area = ?");
    params.push(area);
  }
  if (priority && priority !== "All") {
    where.push("priority = ?");
    params.push(priority);
  }
  if (niche && niche !== "All") {
    where.push("niche = ?");
    params.push(niche);
  }
  if (emailOnly) where.push("email IS NOT NULL AND email <> ''");
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const leads = db.prepare(`SELECT * FROM leads ${clause} ORDER BY score DESC, area, company_name`).all(...params) as unknown as LeadRow[];

  const rows = leads.map((lead) => Object.fromEntries(COLUMNS.map((col) => [col.header, valueOf(lead, col.key)])));

  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `elite-cars-prospects-${stamp}`;

  if (format === "csv") {
    const sheet = XLSX.utils.json_to_sheet(rows);
    const csv = XLSX.utils.sheet_to_csv(sheet);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}.csv"`,
      },
    });
  }

  const sheet = XLSX.utils.json_to_sheet(rows);
  sheet["!cols"] = COLUMNS.map((col) => ({ wch: col.width }));
  sheet["!autofilter"] = { ref: sheet["!ref"] ?? "A1" };
  sheet["!freeze"] = { xSplit: 0, ySplit: 1 };
  if (rows.length) {
    sheet["!rows"] = [{ hpt: 22 }, ...rows.map(() => ({ hpt: 15 }))];
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Prospects");

  const summary = [
    ["Elite Cars prospect export", stamp],
    [],
    ["Total companies", leads.length],
    ["With email", leads.filter((l) => l.email).length],
    ["With phone", leads.filter((l) => l.phone).length],
    ["High confidence email", leads.filter((l) => l.email_confidence === "high").length],
    ["Emailed", leads.filter((l) => l.status === "Emailed").length],
    [],
    ["Area", "Companies", "With email"],
    ...(Object.entries(
      leads.reduce<Record<string, { n: number; e: number }>>((acc, lead) => {
        const row = acc[lead.area] ?? { n: 0, e: 0 };
        row.n += 1;
        if (lead.email) row.e += 1;
        acc[lead.area] = row;
        return acc;
      }, {})
    )
      .sort((a, b) => b[1].n - a[1].n)
      .map(([name, row]) => [name, row.n, row.e])),
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summary as Array<Array<string | number>>);
  summarySheet["!cols"] = [{ wch: 26 }, { wch: 12 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
      "Content-Length": String(buffer.length),
    },
  });
}