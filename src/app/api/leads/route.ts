import { NextRequest, NextResponse } from "next/server";
import { db, type LeadRow } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EDITABLE = ["niche", "phone", "contact", "email", "website", "industry", "angle", "priority", "status", "lead_type", "company_name"] as const;
type Editable = (typeof EDITABLE)[number];

const PRIORITIES = new Set(["Very High", "High", "Medium", "Low"]);

export async function PATCH(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const id = Number(body.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "A numeric id is required" }, { status: 400 });

  const lead = db.prepare("SELECT * FROM leads WHERE id = ?").get(id) as unknown as LeadRow | undefined;
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const updates: string[] = [];
  const values: Array<string | number | null> = [];

  for (const field of EDITABLE) {
    if (!(field in body)) continue;
    const raw = body[field];
    let value: string | null = raw === null ? null : String(raw).trim();
    if (value === "") value = null;

    if (field === "email" && value) {
      const normalized = value.toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
        return NextResponse.json({ error: `"${value}" is not a valid email address` }, { status: 400 });
      }
      value = normalized;
    }
    if (field === "priority" && value && !PRIORITIES.has(value)) {
      return NextResponse.json({ error: "Priority must be Very High, High, Medium or Low" }, { status: 400 });
    }
    if (field === "email" && value) {
      updates.push("email_confidence = 'manual'");
    }

    updates.push(`${field} = ?`);
    values.push(value);
  }

  if (!updates.length) return NextResponse.json({ error: "No editable fields supplied" }, { status: 400 });

  values.push(id);
  db.prepare(`UPDATE leads SET ${updates.join(", ")} WHERE id = ?`).run(...values);

  const updated = db.prepare("SELECT * FROM leads WHERE id = ?").get(id) as unknown as LeadRow;
  return NextResponse.json({ lead: updated });
}

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  const lead = db.prepare("SELECT * FROM leads WHERE id = ?").get(Number(id)) as unknown as LeadRow | undefined;
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  return NextResponse.json({ lead });
}