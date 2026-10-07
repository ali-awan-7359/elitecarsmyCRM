import { db } from "./db";
import { isExcluded, normalizeEmail } from "./exclusions";

import dns from "node:dns/promises";

const BLOCKED_HOSTS = new Set([
  "facebook.com", "twitter.com", "x.com", "instagram.com", "linkedin.com", "youtube.com",
  "google.com", "bing.com", "yelp.co.uk", "tripadvisor.co.uk", "amazon.co.uk", "wikipedia.org",
  "amazon.com", "pinterest.com", "tiktok.com", "reddit.com", "indeed.co.uk", "glassdoor.co.uk",
]);

const EMAIL_RE = /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,24}\b/gi;
const MAILTO_RE = /mailto:([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,24})/gi;

const ROLE_PRIORITY = [
  { pattern: /^(info|enquiries|enquiry|inquiries|hello|contact|mail|admin|office|team|reception)/, rank: 1 },
  { pattern: /(sales|bookings|reservations|events|weddings?|hospitality)/, rank: 2 },
  { pattern: /(marketing|marketing2|pr|press)/, rank: 3 },
  { pattern: /(accounts|finance|finance2)/, rank: 4 },
  { pattern: /(admin\.?manager|office\.?manager|general\.?manager)/, rank: 5 },
  { pattern: /^(ceo|md|managing\.?director|founder|owner|principal|partner|director)/, rank: 6 },
];

function rankEmail(email: string) {
  const local = email.split("@")[0];
  for (const { pattern, rank } of ROLE_PRIORITY) if (pattern.test(local)) return rank;
  return 7;
}

function scoreEmail(email: string, siteDomain?: string) {
  const [local, domain] = email.split("@");
  if (!local || !domain) return -100;

  let s = 0;
  if (/^(no-?reply|do-?not-?reply|noreply|donotreply|postmaster|webmaster|hostmaster|abuse|privacy|legal|gdpr|mailer-daemon)@/i.test(local)) return -1000;
  if (/^(sales|bookings|events|reservations|reservations|weddings)@/.test(local)) s += 35;
  if (/^(info|enquiries|enquiry|contact|hello|mail|admin|office|reception|team)@/.test(local)) s += 30;
  if (/(info|enquiries|sales|events|bookings|contact|hello|admin|marketing)@/.test(local)) s += 12;
  if (/\d{4,}/.test(local)) s -= 15;
  if (/\.(png|jpg|jpeg|gif|svg|webp|css|js|html?|aspx|php)$/i.test(local)) s -= 100;
  if (/\.s3$|amazonaws|cloudfront|jsdelivr|googleapis|fastly|akamai|cloudflare|sentry|wixpress|squarespace|godaddy/i.test(domain)) s -= 90;
  if (/(sentry|wixpress|squarespace|wix\.com|godaddy|cloudflare|example|yourname|domain|email|sentry\.io)/i.test(domain)) s -= 40;
  if (/^(send|smtp|mail|email|microsoft|protection|cdn|host|server|web|email-smtp)\./i.test(domain)) s -= 70;
  if (/\.(png|jpg|jpeg|gif|svg|webp|css|js)$/i.test(domain)) s -= 100;
  if (domain.split(".").length > 3) s -= 25;
  if (/\.(co\.uk|com|uk|net|org|biz|io)$/.test(domain)) s += 6;

  if (siteDomain) {
    const site = siteDomain.replace(/^www\./, "").toLowerCase();
    if (domain === site) s += 500;
    else if (domain.endsWith(`.${site}`) || site.endsWith(`.${domain}`)) s += 400;
  }
  return s;
}

const NOISE_WORDS = new Set([
  "limited", "ltd", "llp", "plc", "inc", "incorporated", "company", "co", "group", "holdings",
  "holding", "the", "uk", "international", "services", "service", "management", "solutions",
  "consulting", "consultancy", "partners", "associates", "enterprises", "systems", "technologies",
]);

function candidateHostnames(companyName: string) {
  const words = companyName
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !NOISE_WORDS.has(w));

  if (!words.length) return [];

  const stems = new Set<string>();
  const joined = words.join("");
  if (joined.length >= 4) stems.add(joined);

  const prefixes = [words.join(""), words.slice(0, 2).join(""), words.slice(0, 3).join("")];
  for (const prefix of prefixes) {
    if (prefix.length >= 4) stems.add(prefix);
  }
  if (words.length > 1) {
    const noAnd = words.join("").replace(/and/g, "");
    if (noAnd.length >= 4) stems.add(noAnd);
    const twoTail = `${words[0]}${words[words.length - 1]}`;
    if (twoTail.length >= 6) stems.add(twoTail);
  }
  if (words[0].length >= 5) stems.add(words[0]);

  const suffixes = ["co.uk", "com", "uk"];
  const out: string[] = [];
  for (const suffix of suffixes) {
    for (const stem of stems) {
      if (stem.length < 4) continue;
      out.push(`${stem}.${suffix}`);
    }
  }
  for (const stem of stems) {
    if (stem.length < 4) continue;
    for (const suffix of ["co", "net", "org", "biz", "io"]) out.push(`${stem}.${suffix}`);
  }
  return Array.from(new Set(out));
}

export type WebsiteResolution = { website: string | null; tried: string[]; rejected: string[] };

const PARKING_MARKERS = [
  /domain (?:is )?for sale/i,
  /this domain (?:is|may be) for sale/i,
  /buy this domain/i,
  /parked (?:free )?(?:at|by) /i,
  /page cannot be displayed/i,
  /error\.? page cannot/i,
  /this site is (?:coming soon|under construction)/i,
  /coming soon/i,
  /under construction/i,
  /domain names? for sale/i,
  /sedoparking|afternic|dan\.com|hugedomains|bodis\.com|parklogic|app-parking|aftermarket/i,
  /your website is (?:ready|coming)/i,
  /window\.location\.href=["']?\/?lander/i,
  /^\s*$/,
];

function visibleText(html: string, limit = 12_000) {
  return html
    .slice(0, limit)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/data:[a-z]+\/[a-z0-9.+-]*;base64,[a-z0-9+/=]+/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function looksParked(html: string) {
  const sample = html.slice(0, 4000);
  if (PARKING_MARKERS.some((re) => re.test(sample))) return true;
  return visibleText(html).length < 220;
}

const GENERIC_WORDS = new Set([
  "hospitality", "hotel", "hotels", "events", "event", "productions", "production", "creative",
  "digital", "media", "solutions", "services", "service", "service", "group", "partners",
  "associates", "consulting", "consultancy", "business", "systems", "technologies", "industries",
  "ventures", "capital", "estates", "properties", "property", "motors", "cars", "vehicles",
  "automotive", "international", "global", "worldwide", "enterprises", "limited", "ltd", "the",
  "and", "ltd", "management", "holdings", "uk", "london", "england", "company", "co", "plc",
]);

function significantWords(companyName: string) {
  return companyName
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !NOISE_WORDS.has(w));
}

function looksLikeCompany(html: string, companyName: string, host: string) {
  const words = significantWords(companyName);
  if (words.length === 0) return true;

  const stem = host.split(".")[0].replace(/^www/, "");
  const stemKey = stem.replace(/[^a-z]/g, "");
  const stemOk = words.some((w) => {
    const key = w.replace(/[^a-z]/g, "");
    return key.length >= 5 && (stemKey.includes(key) || key.includes(stemKey));
  });
  if (!stemOk) return false;

  const haystack = visibleText(stripNoise(html), 300_000).toLowerCase();
  const hit = (w: string) => {
    const key = w.replace(/[^a-z0-9]/g, "");
    if (haystack.includes(key)) return true;
    const short = key.replace(/ies$/, "y").replace(/es$/, "").replace(/s$/, "");
    return short.length >= 4 && haystack.includes(short);
  };
  const hits = words.filter(hit);
  if (hits.length / words.length < 0.6) return false;

  if (words.length === 1) return !GENERIC_WORDS.has(words[0]) && words[0].length >= 6;
  return hits.some((w) => !GENERIC_WORDS.has(w));
}

async function resolves(host: string) {
  try {
    await dns.lookup(host);
    return true;
  } catch {
    return false;
  }
}

export async function resolveWebsite(companyName: string, signal?: AbortSignal): Promise<WebsiteResolution> {
  const tried: string[] = [];
  const rejected: string[] = [];

  for (const host of candidateHostnames(companyName)) {
    if (BLOCKED_HOSTS.has(host)) continue;
    tried.push(host);
    try {
      if (!(await resolves(host))) {
        rejected.push(`${host} (no DNS record)`);
        continue;
      }
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(`https://${host}`, {
        method: "GET",
        redirect: "follow",
        signal: signal ?? controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "en-GB,en;q=0.9",
        },
      });
      clearTimeout(timer);
      const type = res.headers.get("content-type") ?? "";
      if (!res.ok || !/^text\/html/i.test(type)) {
        rejected.push(`${host} (${res.status})`);
        continue;
      }

      const hostInUrl = new URL(res.url).hostname.replace(/^www\./, "");
      const stem = host.split(".")[0];
      if (!(hostInUrl === host || host.endsWith(hostInUrl) || hostInUrl.endsWith(stem))) {
        rejected.push(`${host} (redirects to ${hostInUrl})`);
        continue;
      }

      const html = (await res.text()).slice(0, 200_000);
      if (looksParked(html)) {
        rejected.push(`${host} (parked or placeholder)`);
        continue;
      }
      if (!looksLikeCompany(html, companyName, host)) {
        rejected.push(`${host} (no name match)`);
        continue;
      }
      return { website: `https://${hostInUrl}`, tried, rejected };
    } catch {
      rejected.push(`${host} (unreachable)`);
    }
  }
  return { website: null, tried, rejected };
}

export type EmailHarvest = {
  website: string | null;
  email: string | null;
  emails: string[];
  source: string | null;
  phone: string | null;
  rejected?: string[];
};

const CLOUDFLARE_EMAIL = /([a-z0-9._%+-]+)\s*(?:&#64;|&#x40;|\(at\)|\[at\]|\{at\}|@)\s*([a-z0-9.-]+\s*(?:&#46;|\.)\s*[a-z]{2,24})/gi;

const PHONE_RE = /(?:\+44\s?\(?\d{2,4}\)?[\s-]?\d{3,4}[\s-]?\d{3,4}|\(?0\d{2,4}\)?[\s-]?\d{3,4}[\s-]?\d{3,4})/g;

/**
 * Prefer a switchboard line over a mobile: for selling corporate transport the
 * landline is the number that reaches whoever can actually book a vehicle.
 */
function scorePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  let s = 0;
  if (/^\+44/.test(phone.replace(/[\s-]/g, ""))) s += 10;
  if (/^0(1|2|3)\d/.test(digits)) s += 12;
  if (/^07/.test(digits)) s -= 30;
  if (/^0800|^0845|^0843|^0870|^0370|^0300/.test(digits)) s += 14;
  if (digits.length === 11) s += 6;
  if (digits.length < 10 || digits.length > 12) s -= 40;
  if (/(\d)\1{4,}/.test(digits)) s -= 100;
  return s;
}

function collectFromHtml(html: string): { emails: string[]; phones: string[] } {
  const emails = new Set<string>();
  for (const match of html.matchAll(EMAIL_RE)) emails.add(match[0].toLowerCase());
  for (const match of html.matchAll(MAILTO_RE)) emails.add(match[1].toLowerCase());
  for (const match of html.matchAll(CLOUDFLARE_EMAIL)) {
    emails.add(`${match[1]}@${match[2].replace(/\s+/g, "")}`.toLowerCase());
  }
  const phones = new Set<string>();
  for (const match of html.matchAll(PHONE_RE)) {
    const value = match[0].replace(/\s+/g, " ").trim();
    if (value.replace(/\D/g, "").length >= 10) phones.add(value);
  }
  return { emails: Array.from(emails), phones: Array.from(phones) };
}

function stripNoise(text: string) {
  return text
    .replace(/[\w.+-]{40,}@[\w.-]+/g, " ")
    .replace(/[\w.+-]{60,}/g, " ");
}

async function fetchPage(url: string, signal?: AbortSignal): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      signal: signal ?? controller.signal,
      headers: { "User-Agent": "EliteCarsResearch/1.0 (+https://elite-cars.co.uk)" },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (!/text\/html/i.test(type)) return null;
    const text = await res.text();
    if (text.length > 6_000_000) return null;
    return text;
  } catch {
    return null;
  }
}

function contactPaths(base: string) {
  return [
    "",
    "contact",
    "contact-us",
    "get-in-touch",
    "enquiries",
    "about",
    "about-us",
    "team",
    "who-we-are",
    "contact-us/",
  ];
}

export async function harvestEmail(companyName: string, website: string | null): Promise<EmailHarvest> {
  const emails = new Set<string>();
  const phones = new Set<string>();
  let resolved = website;

  if (!resolved) {
    const lookup = await resolveWebsite(companyName);
    resolved = lookup.website;
  }
  if (!resolved) return { website: null, email: null, emails: [], source: null, phone: null, rejected: [] as string[] };

  const rejected: string[] = [];

  const visited = new Set<string>();
  const queue = contactPaths(resolved).map((p) => new URL(p, resolved).toString());

  const walk = async (limit = 12) => {
    while (queue.length > 0 && visited.size < limit) {
      const url = queue.shift()!;
      if (visited.has(url)) continue;
      visited.add(url);
      const html = await fetchPage(url);
      if (!html) continue;
      const found = collectFromHtml(stripNoise(html));
      found.emails.forEach((e) => emails.add(e));
      found.phones.forEach((p) => phones.add(p));
      for (const href of html.matchAll(/href=["']([^"']+)["']/gi)) {
        const target = href[1];
        if (!target || target.startsWith("#") || /^(mailto|tel|javascript):/i.test(target)) continue;
        if (!/(contact|enquir|inquir|about|team|reach|hello)/i.test(target)) continue;
        try {
          const next = new URL(target, url).toString();
          if (next.startsWith(new URL(resolved).origin) && !visited.has(next)) queue.push(next);
        } catch {
          /* bad href */
        }
      }
      if (emails.size >= 8) return;
    }
  };

  await walk();

  if (emails.size === 0) {
    for (const path of ["sitemap.xml", "sitemap_index.xml"]) {
      const xml = await fetchPage(new URL(path, resolved).toString());
      if (!xml) continue;
      const locs = Array.from(xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)).map((m) => m[1]);
      const useful = locs
        .filter((loc) => /contact|enquir|inquir|about|team|hello|reach/i.test(loc))
        .slice(0, 6);
      for (const loc of useful) {
        if (emails.size > 0) break;
        try {
          const next = new URL(loc, resolved).toString();
          if (!visited.has(next)) {
            visited.add(next);
            queue.push(next);
          }
        } catch {
          /* bad loc */
        }
      }
      if (emails.size === 0) await walk(18);
    }
  }

  const siteDomain = new URL(resolved).hostname;
  const ranked = Array.from(emails)
    .map(normalizeEmail)
    .filter(Boolean)
    .sort((a, b) => scoreEmail(b, siteDomain) - scoreEmail(a, siteDomain) || rankEmail(a) - rankEmail(b));

  return {
    website: resolved,
    email: ranked[0] ?? null,
    emails: ranked.slice(0, 8),
    source: ranked[0] ? new URL(resolved).hostname : null,
    phone:
      Array.from(phones).sort((a, b) => scorePhone(b) - scorePhone(a))[0] ??
      null,
    rejected,
  };
}

export type EmailConfidence = "high" | "medium" | "low";

export function scoreConfidence(input: {
  companyName: string;
  website: string | null;
  email: string | null;
  source: string | null;
  foundOnSite: boolean;
}): EmailConfidence {
  if (!input.email || !input.website) return "low";
  if (input.source === "apollo") return "high";
  if (!input.foundOnSite) return "low";

  const siteDomain = input.website.replace(/^https?:\/\//, "").replace(/^www\./, "").toLowerCase();
  const emailDomain = input.email.split("@")[1]?.toLowerCase() ?? "";
  if (emailDomain !== siteDomain && !emailDomain.endsWith(`.${siteDomain}`)) return "low";

  const words = significantWords(input.companyName);
  if (!words.length) return "low";

  const stem = siteDomain.split(".")[0].replace(/[^a-z0-9]/g, "");
  const matched = words.filter((w) => {
    const key = w.replace(/[^a-z0-9]/g, "");
    return key.length >= 5 && (stem.includes(key) || key.includes(stem));
  });

  const distinct = matched.filter((w) => !GENERIC_WORDS.has(w));
  if (distinct.length >= 2) return "high";
  if (distinct.length === 1 && distinct[0].length >= 7 && stem === distinct[0].replace(/[^a-z0-9]/g, "")) return "high";
  if (distinct.length === 1 && stem.length >= 6) return "medium";
  return "low";
}

export type EmailProvider = "website" | "apollo" | "manual";

export type EmailProviderResult = { email: string | null; source: EmailProvider };

export async function findEmail(lead: { id: number; company_name: string; website: string | null }, signal?: AbortSignal): Promise<EmailProviderResult> {
  if (process.env.APOLLO_API_KEY) {
    try {
      const res = await fetch("https://api.apollo.io/api/v1/mixed_companies/search", {
        method: "POST",
        signal,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-cache", "x-api-key": process.env.APOLLO_API_KEY },
        body: JSON.stringify({
          q_organization_domains: lead.website ? new URL(lead.website).hostname.replace(/^www\./, "") : "",
          organization_names: [lead.company_name],
          per_page: 3,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { organizations?: Array<{ primary_contacts?: Array<{ email?: string }> }> };
        for (const org of data.organizations ?? []) {
          for (const contact of org.primary_contacts ?? []) {
            const email = normalizeEmail(contact.email ?? "");
            if (email) return { email, source: "apollo" };
          }
        }
      }
    } catch {
      /* fall through to website scraping */
    }
  }

  const harvest = await harvestEmail(lead.company_name, lead.website);
  return { email: harvest.email, source: "website" };
}

export function recordEnrichment(
  leadId: number,
  data: { website: string | null; email: string | null; phone: string | null; contact: string | null; source: string | null; companyName: string; foundOnSite: boolean }
) {
  if (isExcluded({ companyNumber: null, companyName: "", domain: data.website, email: data.email })) return false;
  const confidence = scoreConfidence({
    companyName: data.companyName,
    website: data.website,
    email: data.email,
    source: data.source,
    foundOnSite: data.foundOnSite,
  });
  db.prepare(
    `UPDATE leads SET website = ?, email = ?, email_source = ?, email_confidence = ?, phone = COALESCE(?, phone), contact = COALESCE(?, contact), enriched_at = datetime('now') WHERE id = ?`
  ).run(data.website, data.email, data.source, confidence, data.phone, data.contact, leadId);
  return true;
}