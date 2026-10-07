import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";

const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const globalForDb = globalThis as unknown as { __eliteDb?: DatabaseSync };

export const db: DatabaseSync = globalForDb.__eliteDb ?? new DatabaseSync(path.join(dataDir, "elite-cars.db"));

if (process.env.NODE_ENV !== "production") globalForDb.__eliteDb = db;

db.exec("PRAGMA busy_timeout = 15000");
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

function migrate() {
  db.exec(`
CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_number TEXT UNIQUE NOT NULL,
  company_name TEXT NOT NULL,
  area TEXT NOT NULL,
  postcode TEXT,
  address TEXT,
  industry TEXT,
  niche TEXT,
  sic_codes TEXT,
  status TEXT,
  company_type TEXT,
  incorporated TEXT,
  website TEXT,
  email TEXT,
  email_source TEXT,
  email_confidence TEXT NOT NULL DEFAULT 'low',
  phone TEXT,
  contact TEXT,
  angle TEXT,
  priority TEXT NOT NULL DEFAULT 'Medium',
  score INTEGER NOT NULL DEFAULT 0,
  lead_type TEXT NOT NULL DEFAULT 'New prospect',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_contacted TEXT,
  enriched_at TEXT
);

CREATE TABLE IF NOT EXISTS exclusions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_number TEXT UNIQUE,
  company_name TEXT NOT NULL,
  domain TEXT,
  email TEXT,
  reason TEXT,
  source_file TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS unsubscribes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  sender TEXT NOT NULL,
  batch_size INTEGER NOT NULL DEFAULT 20,
  delay_ms INTEGER NOT NULL DEFAULT 120000,
  status TEXT NOT NULL DEFAULT 'draft',
  total INTEGER NOT NULL DEFAULT 0,
  sent INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,
  finished_at TEXT
);

CREATE TABLE IF NOT EXISTS sends (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  to_name TEXT,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  message_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  sent_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_leads_score ON leads(score DESC);
CREATE INDEX IF NOT EXISTS idx_leads_area ON leads(area);
CREATE INDEX IF NOT EXISTS idx_sends_campaign ON sends(campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_exclusions_name ON exclusions(company_name);
`);
  addMissingColumns();
}

/**
 * Older databases predate some columns. CREATE TABLE IF NOT EXISTS won't add
 * them, so check each and ALTER only what is absent.
 */
function addMissingColumns() {
  const existing = new Set(
    (db.prepare("PRAGMA table_info(leads)").all() as Array<{ name: string }>).map((row) => row.name)
  );
  const wanted: Array<[string, string]> = [
    ["niche", "TEXT"],
    ["phone", "TEXT"],
    ["contact", "TEXT"],
    ["angle", "TEXT"],
    ["email_confidence", "TEXT NOT NULL DEFAULT 'low'"],
    ["website", "TEXT"],
    ["last_contacted", "TEXT"],
    ["enriched_at", "TEXT"],
  ];
  for (const [column, definition] of wanted) {
    if (!existing.has(column)) db.exec(`ALTER TABLE leads ADD COLUMN ${column} ${definition}`);
  }
}

const lockFile = path.join(dataDir, ".migrate.lock");

function migrateWithLock() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    let handle: number | null = null;
    try {
      handle = fs.openSync(lockFile, "wx");
      migrate();
      return;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      if (attempt % 10 === 9) return;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 200);
    } finally {
      if (handle !== null) {
        try {
          fs.closeSync(handle);
          fs.unlinkSync(lockFile);
        } catch {
          /* another worker cleaned it up */
        }
      }
    }
  }
}

migrateWithLock();

export type LeadRow = {
  id: number;
  company_number: string;
  company_name: string;
  area: string;
  postcode: string | null;
  address: string | null;
  industry: string | null;
  niche: string | null;
  sic_codes: string | null;
  status: string | null;
  company_type: string | null;
  incorporated: string | null;
  website: string | null;
  email: string | null;
  email_source: string | null;
  email_confidence: string;
  phone: string | null;
  contact: string | null;
  angle: string | null;
  priority: string;
  score: number;
  lead_type: string;
  created_at: string;
  last_contacted: string | null;
  enriched_at: string | null;
};