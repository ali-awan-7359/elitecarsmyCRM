import { db } from "./db";
import { isExcluded } from "./exclusions";
import { TARGET_AREAS, deriveNiche, priorityFor, scoreForSics } from "./target-areas";

const API_BASE = "https://api.company-information.service.gov.uk";

export type ResearchProgress = {
  area: string;
  found: number;
  added: number;
  excluded: number;
  pages: number;
  done: boolean;
  message?: string;
};

type ChItem = {
  company_name: string;
  company_number: string;
  company_status?: string;
  company_type?: string;
  date_of_creation?: string;
  sic_codes?: string[];
  registered_office_address?: {
    address_line_1?: string;
    address_line_2?: string;
    locality?: string;
    postal_code?: string;
    region?: string;
  };
};

export function companiesHouseKey() {
  return process.env.COMPANIES_HOUSE_API_KEY ?? "";
}

function authHeader() {
  const key = companiesHouseKey();
  return `Basic ${Buffer.from(`${key}:`).toString("base64")}`;
}

async function advancedSearch(params: Record<string, string | number>, signal?: AbortSignal) {
  const url = new URL(`${API_BASE}/advanced-search/companies`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  const res = await fetch(url, { headers: { Authorization: authHeader(), Accept: "application/json" }, signal });
  if (!res.ok) throw new Error(`Companies House search failed: ${res.status} ${res.statusText}`);
  return (await res.json()) as { items?: ChItem[]; total_results?: number };
}

export async function assertCompaniesHouseAccess() {
  const url = `${API_BASE}/advanced-search/companies?company_status=active&items_per_page=1`;
  const res = await fetch(url, { headers: { Authorization: authHeader(), Accept: "application/json" } });
  if (res.status === 401) throw new Error("Companies House rejected the API key. Check COMPANIES_HOUSE_API_KEY in .env.local and make sure the app key is active.");
  if (res.status === 429) throw new Error("Companies House rate limit reached. Wait a minute and try again.");
  if (!res.ok) throw new Error(`Companies House returned ${res.status} ${res.statusText}`);
  const data = (await res.json()) as { total_results?: number };
  return data.total_results ?? 0;
}

function postcodesForArea(areaName: string) {
  return TARGET_AREAS.find((a) => a.name === areaName)?.postcodePrefixes ?? [];
}

function areaFromPostcode(postcode: string, fallback: string) {
  const clean = String(postcode ?? "").replace(/\s+/g, "").toUpperCase();
  for (const area of TARGET_AREAS) {
    if (area.postcodePrefixes.some((prefix) => clean.startsWith(prefix))) return area.name;
  }
  return fallback;
}

export type UpsertResult = { added: number; excluded: number; updated: number };

const upsertStmt = db.prepare(`
  INSERT INTO leads (
    company_number, company_name, area, postcode, address, industry, niche, sic_codes,
    status, company_type, incorporated, angle, priority, score
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(company_number) DO UPDATE SET
    area = excluded.area,
    postcode = excluded.postcode,
    address = excluded.address,
    industry = excluded.industry,
    niche = COALESCE(NULLIF(leads.niche, ''), excluded.niche),
    sic_codes = excluded.sic_codes,
    angle = excluded.angle,
    priority = excluded.priority,
    score = excluded.score
`);

export function upsertLead(item: ChItem, fallbackArea: string): "added" | "excluded" | "updated" {
  const address = item.registered_office_address ?? {};
  const postcode = (address.postal_code ?? "").toUpperCase().trim();
  const sicCodes = item.sic_codes ?? [];
  const { score, industry, angle } = scoreForSics(sicCodes);
  const area = areaFromPostcode(postcode, fallbackArea);

  if (isExcluded({ companyNumber: item.company_number, companyName: item.company_name })) return "excluded";

  const exists = db.prepare("SELECT 1 FROM leads WHERE company_number = ?").get(item.company_number);
  upsertStmt.run(
    item.company_number,
    item.company_name,
    area,
    postcode,
    [address.address_line_1, address.address_line_2, address.locality].filter(Boolean).join(", "),
    industry,
    deriveNiche(sicCodes, item.company_name),
    sicCodes.join(","),
    item.company_status ?? "Active",
    item.company_type ?? "",
    item.date_of_creation ?? "",
    angle,
    priorityFor(score),
    score
  );
  return exists ? "updated" : "added";
}

export type ResearchOptions = {
  areas: string[];
  pagesPerArea: number;
  pageSize: number;
  sicCodes?: string[];
};

export async function researchCompanies(
  options: ResearchOptions,
  onProgress?: (progress: ResearchProgress) => void
): Promise<{ total: number; added: number; excluded: number; updated: number }> {
  if (!companiesHouseKey()) {
    throw new Error("COMPANIES_HOUSE_API_KEY is not set. Add it to .env.local — get a free key at https://developer.companieshouse.gov.uk");
  }
  await assertCompaniesHouseAccess();

  const totals = { total: 0, added: 0, excluded: 0, updated: 0 };

  for (const areaName of options.areas) {
    if (!postcodesForArea(areaName).length) continue;
    let areaAdded = 0;
    let areaExcluded = 0;
    let areaFound = 0;

    for (let page = 0; page < options.pagesPerArea; page += 1) {
      const params: Record<string, string | number> = {
        company_status: "active",
        location: areaName,
        items_per_page: Math.min(options.pageSize, 100),
        start_index: page * options.pageSize,
      };
      if (options.sicCodes?.length) params.sic_codes = options.sicCodes.join(",");

      let data: { items?: ChItem[] };
      try {
        data = await advancedSearch(params);
      } catch (error) {
        onProgress?.({ area: areaName, found: areaFound, added: areaAdded, excluded: areaExcluded, pages: page + 1, done: true, message: (error as Error).message });
        break;
      }

      const items = data.items ?? [];
      if (items.length === 0) break;

      for (const item of items) {
        const result = upsertLead(item, areaName);
        areaFound += 1;
        totals.total += 1;
        if (result === "added") {
          areaAdded += 1;
          totals.added += 1;
        } else if (result === "excluded") {
          areaExcluded += 1;
          totals.excluded += 1;
        } else {
          totals.updated += 1;
        }
      }

      onProgress?.({ area: areaName, found: areaFound, added: areaAdded, excluded: areaExcluded, pages: page + 1, done: items.length < options.pageSize });

      if (items.length < options.pageSize) break;
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }

  return totals;
}

export async function fetchCompanyProfile(companyNumber: string) {
  const res = await fetch(`${API_BASE}/company/${companyNumber}`, {
    headers: { Authorization: authHeader(), Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Company profile failed: ${res.status}`);
  return (await res.json()) as Record<string, unknown>;
}

export async function fetchOfficers(companyNumber: string) {
  const res = await fetch(`${API_BASE}/company/${companyNumber}/officers?items_per_page=20`, {
    headers: { Authorization: authHeader(), Accept: "application/json" },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { items?: Array<Record<string, string>> };
  return (data.items ?? []).filter((o) => o.resigned_on === undefined);
}