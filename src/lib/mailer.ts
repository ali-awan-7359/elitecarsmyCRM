import nodemailer, { type Transporter } from "nodemailer";
import { db } from "./db";
import { isExcluded, normalizeEmail } from "./exclusions";
import type { EmailConfidence } from "./email-discovery";
import type { LeadRow } from "./db";

export type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  fromName: string;
};

export function smtpFromEnv(): SmtpConfig {
  const user = process.env.SMTP_USER ?? "";
  const domain = user.includes("@") ? user.split("@")[1] : "elite-cars.co.uk";
  return {
    host: process.env.SMTP_HOST ?? `smtp.${domain}`,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    user,
    pass: process.env.SMTP_PASS ?? "",
    from: process.env.MAIL_FROM ?? user,
    fromName: process.env.MAIL_FROM_NAME ?? "Ali at Elite Cars",
  };
}

export function smtpConfigured() {
  const cfg = smtpFromEnv();
  return Boolean(cfg.host && cfg.user && cfg.pass);
}

let cached: Transporter | null = null;
let cachedKey = "";

export function transporter(config?: SmtpConfig) {
  const cfg = config ?? smtpFromEnv();
  const key = `${cfg.host}:${cfg.port}:${cfg.user}`;
  if (cached && cachedKey === key) return cached;
  cached = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
    pool: true,
    maxConnections: 2,
    maxMessages: 5,
  });
  cachedKey = key;
  return cached;
}

export function verifySmtp() {
  return transporter().verify();
}

function salutation(contact: string | null, company: string) {
  if (!contact) return "Hello";
  const first = contact.split(/[\n—|-]/)[0].trim();
  if (!first) return "Hello";
  if (/(team|office|sales|admin|info|enquir)/i.test(first)) return "Hello";
  const parts = first.split(/\s+/);
  if (parts.length >= 2 && parts[0].length <= 20) return `Hello ${parts[0]}`;
  if (parts.length === 1) return `Hello ${parts[0]}`;
  return "Hello";
}

export function renderTemplate(template: string, lead: { company_name: string; area: string; industry: string | null; contact: string | null; angle: string | null }) {
  return template
    .replaceAll("{{first_name}}", salutation(lead.contact, lead.company_name))
    .replaceAll("{{greeting}}", salutation(lead.contact, lead.company_name))
    .replaceAll("{{company}}", lead.company_name)
    .replaceAll("{{area}}", lead.area)
    .replaceAll("{{industry}}", lead.industry ?? "business")
    .replaceAll("{{angle}}", lead.angle ?? "executive transport");
}

export function unsubscribeUrl(leadId: number) {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return `${base}/api/unsubscribe?lead=${leadId}`;
}

export type SendOutcome = { email: string; status: "sent" | "skipped" | "failed"; reason?: string };

export async function sendOne(config: SmtpConfig, message: { to: string; toName?: string | null; subject: string; html: string; text: string; headers?: Record<string, string> }): Promise<SendOutcome> {
  try {
    const info = await transporter(config).sendMail({
      from: { name: config.fromName, address: config.from },
      to: message.toName ? `"${message.toName.replace(/"/g, "")}" <${message.to}>` : message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      headers: message.headers,
    });
    return { email: message.to, status: "sent" };
  } catch (error) {
    return { email: message.to, status: "failed", reason: (error as Error).message };
  }
}

type PendingRow = {
  send_id: number;
  email: string;
  lead_id: number;
  company_name: string;
  area: string;
  industry: string | null;
  angle: string | null;
  contact: string | null;
  company_number: string;
  website: string | null;
};

const pendingQuery = db.prepare(
  `SELECT s.id AS send_id, s.email, l.id AS lead_id, l.company_name, l.area, l.industry, l.angle, l.contact, l.company_number, l.website
   FROM sends s JOIN leads l ON l.id = s.lead_id
   WHERE s.campaign_id = ? AND s.status = 'pending'
   ORDER BY s.id ASC LIMIT ?`
);

export function queueCampaign(campaignId: number, leadIds: number[], options: { minConfidence?: EmailConfidence } = {}) {
  const minConfidence = options.minConfidence ?? "medium";
  const rank: Record<EmailConfidence, number> = { high: 3, medium: 2, low: 1 };
  const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(campaignId) as Record<string, unknown>;
  const subject = String(campaign.subject ?? "");
  const insert = db.prepare(
    `INSERT INTO sends (campaign_id, lead_id, email, to_name, subject, status) VALUES (?, ?, ?, ?, ?, 'pending')`
  );
  let queued = 0;
  let skipped = 0;
  let belowBar = 0;
  for (const leadId of leadIds) {
    const lead = db.prepare("SELECT * FROM leads WHERE id = ?").get(leadId) as unknown as LeadRow | undefined;
    if (!lead) continue;
    const email = normalizeEmail(lead.email ?? "");
    if (!email) {
      skipped += 1;
      continue;
    }
    const confidence = (lead.email_confidence ?? "low") as EmailConfidence;
    if (rank[confidence] < rank[minConfidence]) {
      belowBar += 1;
      continue;
    }
    if (isExcluded({ companyNumber: lead.company_number, companyName: lead.company_name, domain: lead.website, email })) {
      skipped += 1;
      continue;
    }
    if (db.prepare("SELECT 1 FROM unsubscribes WHERE email = ?").get(email)) {
      skipped += 1;
      continue;
    }
    insert.run(campaignId, leadId, email, lead.contact, subject.replaceAll("{{company}}", lead.company_name));
    queued += 1;
  }
  db.prepare("UPDATE campaigns SET total = ?, status = CASE WHEN ? > 0 THEN status ELSE 'draft' END WHERE id = ?").run(queued, queued, campaignId);
  return { queued, skipped, belowBar };
}

export type CampaignProgress = { campaignId: number; sent: number; failed: number; remaining: number };

export async function runCampaign(campaignId: number, config?: SmtpConfig, limit?: number): Promise<CampaignProgress> {
  const cfg = config ?? smtpFromEnv();
  const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(campaignId) as Record<string, unknown> | undefined;
  if (!campaign) throw new Error("Campaign not found");

  const body = String(campaign.body ?? "");
  const subject = String(campaign.subject ?? "");
  const batchSize = Number(campaign.batch_size ?? 20);
  const delayMs = Number(campaign.delay_ms ?? 120_000);
  const cap = limit ?? batchSize;

  db.prepare("UPDATE campaigns SET status = 'sending', started_at = COALESCE(started_at, datetime('now')) WHERE id = ?").run(campaignId);

  const queue = pendingQuery.all(campaignId, cap) as unknown as PendingRow[];
  const markSent = db.prepare("UPDATE sends SET status = 'sent', sent_at = datetime('now') WHERE id = ?");
  const markFailed = db.prepare("UPDATE sends SET status = 'failed', error = ? WHERE id = ?");

  let sent = 0;
  let failed = 0;

  for (const row of queue) {
    const lead = {
      company_name: String(row.company_name),
      area: String(row.area),
      industry: (row.industry as string) ?? null,
      angle: (row.angle as string) ?? null,
      contact: (row.contact as string) ?? null,
    };
    const renderedSubject = renderTemplate(subject, lead);
    const renderedBody = renderTemplate(body, lead);
    const unsub = unsubscribeUrl(Number(row.lead_id));

    const outcome = await sendOne(cfg, {
      to: String(row.email),
      toName: (row.contact as string) ?? null,
      subject: renderedSubject,
      html: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1a1a1a">${renderedBody
        .split("\n\n")
        .map((p) => `<p style="margin:0 0 16px">${p.replace(/\n/g, "<br/>")}</p>`)
        .join("")}<hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0"/><p style="font-size:12px;color:#737373;margin:0">${cfg.fromName} · Elite Cars<br/>You are receiving this because we identified your organisation as a potential corporate or private client transport fit in ${lead.area}.<br/><a href="${unsub}" style="color:#737373">Unsubscribe</a></p></div>`,
      text: `${renderedBody}\n\n---\n${cfg.fromName} · Elite Cars\nYou are receiving this because we identified your organisation as a potential corporate or private client transport fit in ${lead.area}.\nUnsubscribe: ${unsub}`,
      headers: {
        "List-Unsubscribe": `<${unsub}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });

    if (outcome.status === "sent") {
      markSent.run(row.send_id);
      db.prepare("UPDATE leads SET status = 'Emailed', last_contacted = datetime('now') WHERE id = ?").run(row.lead_id);
      sent += 1;
    } else {
      markFailed.run(outcome.reason ?? "unknown", row.send_id);
      failed += 1;
      if (/EENOBYTES|ECONN|ETIMEDOUT|EAUTH/i.test(outcome.reason ?? "")) {
        await new Promise((resolve) => setTimeout(resolve, 30_000));
      } else {
        await new Promise((resolve) => setTimeout(resolve, Math.min(delayMs, 4000)));
      }
      continue;
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  const counts = db
    .prepare(
      `SELECT
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS sent,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending
       FROM sends WHERE campaign_id = ?`
    )
    .get(campaignId) as { sent: number | null; failed: number | null; pending: number | null };

  const totals = db.prepare("SELECT sent, failed FROM campaigns WHERE id = ?").get(campaignId) as { sent: number; failed: number };
  const remaining = Number(counts.pending ?? 0);
  const totalSent = Number(counts.sent ?? 0);
  const totalFailed = Number(counts.failed ?? 0);

  db.prepare("UPDATE campaigns SET sent = ?, failed = ?, status = ?, finished_at = ? WHERE id = ?").run(
    totalSent,
    totalFailed,
    remaining === 0 ? "complete" : "paused",
    remaining === 0 ? new Date().toISOString() : null,
    campaignId
  );

  return { campaignId, sent: totalSent, failed: totalFailed, remaining };
}

export function campaignStats(campaignId: number) {
  return db
    .prepare(
      `SELECT
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS sent,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
        COUNT(*) AS total
       FROM sends WHERE campaign_id = ?`
    )
    .get(campaignId) as { sent: number | null; failed: number | null; pending: number | null; total: number };
}