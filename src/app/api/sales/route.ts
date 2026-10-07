import { NextRequest, NextResponse } from "next/server";
import { db, type LeadRow } from "@/lib/db";
import { addExclusion, isExcluded, normalizeEmail, unsubscribe } from "@/lib/exclusions";
import { researchCompanies } from "@/lib/research";
import { TARGET_AREAS } from "@/lib/target-areas";
import { findEmail, harvestEmail, recordEnrichment } from "@/lib/email-discovery";
import { smtpConfigured, verifySmtp } from "@/lib/mailer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Job = { id: string; kind: string; status: string; progress: number; total: number; detail: string; error?: string; done: boolean };
const jobs = new Map<string, Job>();

function getJob(id: string) {
  let job = jobs.get(id);
  if (!job) {
    job = { id, kind: "", status: "queued", progress: 0, total: 0, detail: "", done: false };
    jobs.set(id, job);
  }
  return job;
}

async function parseExcel(file: File) {
  const XLSX = await import("xlsx");
  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const rows: Array<Record<string, unknown>> = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    rows.push(...XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" }));
  }
  return rows;
}

function pick(row: Record<string, unknown>, ...keys: string[]) {
  const normalized: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) normalized[k.toLowerCase().replace(/[^a-z0-9]/g, "")] = v;
  for (const key of keys) {
    const value = normalized[key.toLowerCase().replace(/[^a-z0-9]/g, "")];
    if (value !== undefined && String(value).trim() !== "") return String(value).trim();
  }
  return "";
}

export async function POST(request: NextRequest) {
  const action = request.nextUrl.searchParams.get("action");
  const url = new URL(request.url);

  try {
    if (action === "research") {
      const body = (await request.json()) as {
        jobId: string;
        areas?: string[];
        pagesPerArea?: number;
        pageSize?: number;
      };
      const areas = (body.areas?.length ? body.areas : TARGET_AREAS.map((a) => a.name)).filter((name) =>
        TARGET_AREAS.some((a) => a.name === name)
      );
      const job = getJob(body.jobId);
      Object.assign(job, { kind: "research", status: "running", detail: `Scanning ${areas.length} areas`, done: false, error: undefined });

      const result = await researchCompanies(
        { areas, pagesPerArea: body.pagesPerArea ?? 3, pageSize: body.pageSize ?? 100 },
        (progress) => {
          job.detail = `${progress.area}: ${progress.found} scanned, ${progress.added} new, ${progress.excluded} excluded`;
          job.progress = progress.found;
        }
      );

      job.total = result.total;
      job.progress = result.total;
      job.status = "complete";
      job.done = true;
      job.detail = `${result.added} new, ${result.updated} updated, ${result.excluded} blocked by your exclusion list`;
      return NextResponse.json({ jobId: body.jobId, ...result });
    }

    if (action === "enrich") {
      const body = (await request.json()) as { jobId: string; leadIds?: number[]; limit?: number };
      const job = getJob(body.jobId);
      Object.assign(job, { kind: "enrich", status: "running", detail: "Finding websites and emails", done: false, error: undefined });

      const limit = body.limit ?? 25;
      const leads = (
        body.leadIds?.length
          ? db.prepare(`SELECT * FROM leads WHERE id IN (${body.leadIds.map(() => "?").join(",")})`).all(...body.leadIds)
          : db.prepare(`SELECT * FROM leads WHERE email IS NULL ORDER BY score DESC, id DESC LIMIT ?`).all(limit)
      ) as unknown as LeadRow[];

      job.total = leads.length;
      let found = 0;
      const errors: string[] = [];
      const noWebsite: string[] = [];

      for (const lead of leads) {
        if (isExcluded({ companyNumber: lead.company_number, companyName: lead.company_name })) continue;
        let result: { email: string | null; source: string } = { email: null, source: "website" };
        try {
          const harvest = await harvestEmail(lead.company_name, lead.website);
          if (harvest.website && harvest.website !== lead.website) {
            db.prepare("UPDATE leads SET website = ? WHERE id = ?").run(harvest.website, lead.id);
            lead.website = harvest.website;
          }
          result = await findEmail({ id: lead.id, company_name: lead.company_name, website: lead.website });
          if (result.email) {
            recordEnrichment(lead.id, {
              website: harvest.website ?? lead.website,
              email: result.email,
              phone: harvest.phone,
              contact: null,
              source: result.source,
              companyName: lead.company_name,
              foundOnSite: harvest.emails.includes(result.email),
            });
            found += 1;
          } else {
            const why = harvest.rejected?.length ? harvest.rejected[harvest.rejected.length - 1] : "no email found on site";
            noWebsite.push(`${lead.company_name}: ${why}`);
          }
        } catch (error) {
          errors.push((error as Error).message);
          noWebsite.push(`${lead.company_name}: ${(error as Error).message}`);
        }
        job.progress += 1;
        job.detail = `${job.progress}/${job.total} checked, ${found} emails found`;
        await new Promise((resolve) => setTimeout(resolve, 400));
      }

      job.status = "complete";
      job.done = true;
      job.detail = `${found} of ${job.total} companies got an email address`;
      if (errors.length) job.error = errors[0];
      else if (noWebsite.length) job.error = `No usable site: ${noWebsite.slice(0, 4).join(" · ")}`;
      return NextResponse.json({ jobId: body.jobId, checked: leads.length, found, missed: noWebsite });
    }

    if (action === "exclude-upload") {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) return NextResponse.json({ error: "No file provided" }, { status: 400 });

      const name = file.name.toLowerCase();
      let rows: Array<Record<string, unknown>>;
      if (name.endsWith(".csv") || name.endsWith(".txt")) {
        const text = await file.text();
        const lines = text.split(/\r?\n/).filter(Boolean);
        const headers = lines[0].split(",").map((h) => h.replace(/^"|"$/g, "").trim());
        rows = lines.slice(1).map((line) => {
          const cells = line.match(/("[^"]*"|[^,]+)/g) ?? [];
          return Object.fromEntries(headers.map((h, i) => [h, (cells[i] ?? "").replace(/^"|"$/g, "").trim()]));
        });
      } else if (name.endsWith(".xls") || name.endsWith(".xlsx")) {
        rows = await parseExcel(file);
      } else {
        return NextResponse.json({ error: "Upload a CSV, XLS or XLSX file" }, { status: 400 });
      }

      const insert = db.prepare(
        `INSERT OR IGNORE INTO exclusions (company_number, company_name, domain, email, reason, source_file)
         VALUES (?, ?, ?, ?, ?, ?)`
      );
      let added = 0;
      for (const row of rows) {
        const companyName = pick(row, "companyname", "company", "business", "organisation", "organization", "name", "customer", "account");
        if (!companyName) continue;
        const companyNumber = pick(row, "companynumber", "companyno", "chnumber", "registrationnumber");
        const domain = pick(row, "website", "domain", "url", "web", "site");
        const email = normalizeEmail(pick(row, "email", "emailaddress", "contactemail"));
        const res = insert.run(companyNumber || null, companyName, domain || null, email || null, pick(row, "reason", "note", "status") || null, file.name);
        if (Number(res.changes) > 0) added += 1;
      }

      const purge = db.prepare(
        `DELETE FROM leads WHERE company_number IN (SELECT company_number FROM exclusions WHERE company_number IS NOT NULL)
          OR lower(company_name) IN (SELECT lower(company_name) FROM exclusions)`
      );
      const removed = Number(purge.run().changes);

      return NextResponse.json({ rows: rows.length, added, removedFromWorkspace: removed });
    }

    if (action === "lead-edit") {
      const body = (await request.json()) as Record<string, unknown>;
      const id = Number(body.id);
      if (!Number.isInteger(id)) return NextResponse.json({ error: "A numeric id is required" }, { status: 400 });

      const allowed = ["niche", "phone", "contact", "email", "website", "industry", "angle", "priority", "status"];
      const sets: string[] = [];
      const values: Array<string | number | null> = [];
      for (const field of allowed) {
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
          sets.push("email_confidence = 'manual'");
        }
        sets.push(`${field} = ?`);
        values.push(value);
      }
      if (!sets.length) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
      values.push(id);
      db.prepare(`UPDATE leads SET ${sets.join(", ")} WHERE id = ?`).run(...values);
      return NextResponse.json({ lead: db.prepare("SELECT * FROM leads WHERE id = ?").get(id) });
    }

    if (action === "exclude-single") {
      const body = (await request.json()) as { companyNumber?: string | null; companyName: string; domain?: string | null };
      const added = addExclusion({
        companyNumber: body.companyNumber ?? null,
        companyName: body.companyName,
        domain: body.domain ?? null,
        reason: "Excluded from workspace",
      });
      const removed = Number(
        db.prepare("DELETE FROM leads WHERE company_number = ? OR lower(company_name) = lower(?)").run(body.companyNumber ?? "", body.companyName).changes
      );
      return NextResponse.json({ added, removed });
    }

    if (action === "unsubscribe") {
      const body = (await request.json()) as { email: string; reason?: string };
      unsubscribe(body.email, body.reason ?? "manual");
      return NextResponse.json({ ok: true });
    }

    if (action === "campaign-create") {
      const body = (await request.json()) as {
        name: string;
        subject: string;
        body: string;
        leadIds: number[];
        batchSize?: number;
        delayMs?: number;
        minConfidence?: "high" | "medium" | "low";
      };
      const { queueCampaign } = await import("@/lib/mailer");
      const result = db
        .prepare(
          `INSERT INTO campaigns (name, subject, body, sender, batch_size, delay_ms, status)
           VALUES (?, ?, ?, ?, ?, ?, 'queued')`
        )
        .run(body.name, body.subject, body.body, "ali@elite-cars.co.uk", body.batchSize ?? 20, body.delayMs ?? 120_000);
      const campaignId = Number(result.lastInsertRowid);
      const queued = queueCampaign(campaignId, body.leadIds ?? [], { minConfidence: body.minConfidence });
      return NextResponse.json({ campaignId, ...queued });
    }

    if (action === "campaign-send") {
      const body = (await request.json()) as { campaignId: number; limit?: number };
      const { runCampaign } = await import("@/lib/mailer");
      if (!smtpConfigured()) return NextResponse.json({ error: "SMTP is not configured. Add SMTP_HOST, SMTP_USER, SMTP_PASS to .env.local" }, { status: 400 });
      const result = await runCampaign(body.campaignId, undefined, body.limit);
      return NextResponse.json(result);
    }

    if (action === "smtp-verify") {
      if (!smtpConfigured()) return NextResponse.json({ ok: false, error: "SMTP not configured" });
      try {
        await verifySmtp();
        return NextResponse.json({ ok: true });
      } catch (error) {
        return NextResponse.json({ ok: false, error: (error as Error).message });
      }
    }

    if (action === "campaign-create-and-send") {
      const body = (await request.json()) as { name: string; subject: string; body: string; leadIds: number[]; send?: boolean; minConfidence?: "high" | "medium" | "low" };
      const { queueCampaign, runCampaign } = await import("@/lib/mailer");
      const result = db
        .prepare(`INSERT INTO campaigns (name, subject, body, sender) VALUES (?, ?, ?, 'ali@elite-cars.co.uk')`)
        .run(body.name, body.subject, body.body);
      const campaignId = Number(result.lastInsertRowid);
      const queued = queueCampaign(campaignId, body.leadIds ?? [], { minConfidence: body.minConfidence });
      let sent = null;
      if (body.send) {
        if (!smtpConfigured()) return NextResponse.json({ campaignId, ...queued, error: "SMTP not configured, campaign queued but not sent" });
        sent = await runCampaign(campaignId, undefined, 5);
      }
      return NextResponse.json({ campaignId, ...queued, send: sent });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const jobId = url.searchParams.get("jobId");
    if (jobId && jobs.has(jobId)) {
      const job = jobs.get(jobId)!;
      job.status = "failed";
      job.done = true;
      job.error = message;
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const action = request.nextUrl.searchParams.get("action");

  if (action === "job") {
    const jobId = request.nextUrl.searchParams.get("jobId") ?? "";
    return NextResponse.json(getJob(jobId));
  }

  if (action === "leads") {
    const query = request.nextUrl.searchParams;
    const search = (query.get("q") ?? "").trim();
    const area = query.get("area");
    const priority = query.get("priority");
    const emailOnly = query.get("emailOnly") === "true";
    const sort = query.get("sort") ?? "score";
    const dir = query.get("dir") === "asc" ? "ASC" : "DESC";
    const limit = Math.min(Number(query.get("limit") ?? 500), 5000);
    const offset = Number(query.get("offset") ?? 0);

    const niche = query.get("niche");
    const sortColumn = ({ score: "score", company: "company_name", area: "area", priority: "priority", niche: "niche" } as Record<string, string>)[sort] ?? "score";
    const where: string[] = [];
    const params: Array<string | number> = [];
    if (search) {
      where.push("(company_name LIKE ? OR area LIKE ? OR industry LIKE ? OR email LIKE ? OR angle LIKE ?)");
      const like = `%${search}%`;
      params.push(like, like, like, like, like);
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

    const total = (db.prepare(`SELECT COUNT(*) AS n FROM leads ${clause}`).get(...params) as { n: number }).n;
    const leads = db.prepare(`SELECT * FROM leads ${clause} ORDER BY ${sortColumn} ${dir}, id DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);
    return NextResponse.json({ leads, total });
  }

  if (action === "status") {
    const counts = db
      .prepare(
        `SELECT
          (SELECT COUNT(*) FROM leads) AS leads,
          (SELECT COUNT(*) FROM leads WHERE email IS NOT NULL AND email <> '') AS withEmail,
          (SELECT COUNT(*) FROM exclusions) AS exclusions,
          (SELECT COUNT(*) FROM unsubscribes) AS unsubscribes,
          (SELECT COUNT(*) FROM campaigns) AS campaigns`
      )
      .get();
    const niches = db
      .prepare("SELECT niche, COUNT(*) AS n FROM leads WHERE niche IS NOT NULL AND niche <> '' GROUP BY niche ORDER BY n DESC")
      .all() as Array<{ niche: string; n: number }>;
    return NextResponse.json({ counts, smtpConfigured: smtpConfigured(), areas: TARGET_AREAS.map((a) => a.name), niches });
  }

  if (action === "exclusions") {
    return NextResponse.json({ rows: db.prepare("SELECT * FROM exclusions ORDER BY created_at DESC LIMIT 500").all() });
  }

  if (action === "campaigns") {
    return NextResponse.json({
      campaigns: db.prepare("SELECT * FROM campaigns ORDER BY id DESC LIMIT 50").all(),
    });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}