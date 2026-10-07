import { db } from "./db";

export function normalizeName(value: string) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’.]/g, "")
    .replace(/\b(limited|ltd|llp|plc|inc|incorporated|company|co|uk|group|holdings?|the)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function domainOf(value: string) {
  if (!value) return "";
  let v = String(value).trim().toLowerCase();
  v = v.replace(/^[a-z]+:\/\//, "");
  v = v.replace(/^www\./, "");
  v = v.split(/[/?#]/)[0];
  v = v.split("@").pop() ?? "";
  if (!v.includes(".") || /\s/.test(v)) return "";
  const generic = ["gmail.com", "hotmail.com", "outlook.com", "yahoo.co.uk", "aol.com", "icloud.com", "live.co.uk", "btinternet.com", "me.com", "proton.me", "protonmail.com", "mail.com", "yahoo.com", "googlemail.com", "msn.com", "virginmedia.com", "sky.com"];
  if (generic.includes(v)) return "";
  return v;
}

export function normalizeEmail(value: string) {
  const v = String(value ?? "").trim().toLowerCase().replace(/^mailto:/, "");
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : "";
}

const statement = {
  byNumber: db.prepare("SELECT * FROM exclusions WHERE company_number = ?"),
  byName: db.prepare("SELECT * FROM exclusions WHERE company_number = ? OR lower(company_name) = ?"),
  insert: db.prepare(
    `INSERT OR IGNORE INTO exclusions (company_number, company_name, domain, email, reason, source_file)
     VALUES (?, ?, ?, ?, ?, ?)`
  ),
  list: db.prepare("SELECT * FROM exclusions ORDER BY created_at DESC LIMIT ?"),
  count: db.prepare("SELECT COUNT(*) AS n FROM exclusions"),
  remove: db.prepare("DELETE FROM exclusions WHERE id = ?"),
  unsubscribe: db.prepare("INSERT OR IGNORE INTO unsubscribes (email, reason) VALUES (?, ?)"),
  unsubCount: db.prepare("SELECT COUNT(*) AS n FROM unsubscribes"),
};

export function isExcluded(input: { companyNumber?: string | null; companyName?: string; domain?: string | null; email?: string | null }) {
  const email = input.email ? normalizeEmail(input.email) : "";
  if (email && db.prepare("SELECT 1 FROM unsubscribes WHERE email = ?").get(email)) return true;
  if (input.companyNumber) {
    const hit = statement.byNumber.get(input.companyNumber);
    if (hit) return true;
    if (input.companyName) {
      const norm = normalizeName(input.companyName);
      const fuzzy = db
        .prepare("SELECT 1 FROM exclusions WHERE replace(replace(lower(company_name),' ltd',''),' limited','') = ?")
        .get(norm);
      if (fuzzy) return true;
    }
  }
  const domain = domainOf(input.domain ?? "");
  if (domain) {
    const row = db.prepare("SELECT 1 FROM exclusions WHERE domain = ?").get(domain);
    if (row) return true;
  }
  return false;
}

export function addExclusion(row: { companyNumber?: string | null; companyName: string; domain?: string | null; email?: string | null; reason?: string; sourceFile?: string | null }) {
  const res = statement.insert.run(
    row.companyNumber ?? null,
    row.companyName.trim(),
    domainOf(row.domain ?? "") || null,
    normalizeEmail(row.email ?? "") || null,
    row.reason ?? null,
    row.sourceFile ?? null
  );
  return Number(res.changes) > 0;
}

export function unsubscribe(email: string, reason?: string) {
  statement.unsubscribe.run(normalizeEmail(email), reason ?? null);
}

export function exclusionCount() {
  return (statement.count.get() as { n: number }).n;
}

export function unsubscribeCount() {
  return (statement.unsubCount.get() as { n: number }).n;
}

export function listExclusions(limit = 500) {
  return statement.list.all(limit) as Array<Record<string, unknown>>;
}