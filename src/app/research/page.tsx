"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Ban,
  Check,
  Download,
  FileSpreadsheet,
  Loader2,
  Mail,
  Play,
  Send,
  Shield,
  Sparkles,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";

type Lead = {
  id: number;
  company_name: string;
  area: string;
  postcode: string;
  industry: string | null;
  niche: string | null;
  email: string | null;
  email_source: string | null;
  email_confidence: string;
  website: string | null;
  phone: string | null;
  contact: string | null;
  angle: string | null;
  priority: string;
  score: number;
  status: string;
  sic_codes: string | null;
};

type Job = { id: string; status: string; progress: number; total: number; detail: string; error?: string; done: boolean };

const AREAS = [
  "Reading", "Wokingham", "Bracknell", "Theale", "Thatcham", "Crowthorne", "Finchampstead",
  "Winnersh", "Farnborough", "High Wycombe", "Slough", "Basingstoke", "Woodley", "Marlow",
  "Newbury", "Camberley", "Caversham", "Tilehurst",
];

const DEFAULT_SUBJECT = "Executive chauffeur transport for {{company}}";
const DEFAULT_BODY = `Hi {{first_name}},

I'm Ali from Elite Cars. We provide executive chauffeur and guest transportation across Berkshire, London and the South East, and {{company}} stood out as a business that regularly needs vehicles for guests, clients or teams.

How we usually help:
• Guest and client transport for visits, tours and site meetings
• Airport transfers for incoming directors and clients (Heathrow, Gatwick, Heathrow VIP)
• Event-day vehicles on standby, with a named chauffeur and Mercedes-Benz fleet
• Regular scheduled transport for recurring client days
• Discreet, private journeys for private clients

If you'd like a corporate rate card, or a no-obligation trial booking on a specific journey, just reply and I'll arrange it.

Kind regards,
Ali Awan
Elite Cars
elite-cars.co.uk`;

const TARGET_SIC_CODES = [
  "55100","55209","55300","55900","82300","70201","70202","73110","73120","90030","90040",
  "94110","94120","94920","94990","86900","86210","82301","77210","82302","58120","90041",
];

/**
 * Chauffeur-relevant companies (hotels, venues, agencies, offices, clinics).
 * Narrow research beats broad research: it cuts the share of dormant shell
 * companies with no website, which is what limits email hit rate.
 */
const PRIORITY_STYLE: Record<string, string> = {
  "Very High": "bg-emerald-400/10 text-emerald-300 border-emerald-400/20",
  High: "bg-white/10 text-white border-white/20",
  Medium: "bg-zinc-900 text-zinc-400 border-white/10",
  Low: "bg-zinc-900 text-zinc-600 border-white/5",
};

async function post(action: string, payload?: unknown, form?: FormData) {
  const url = `/api/sales?action=${action}`;
  const res = await fetch(url, {
    method: "POST",
    headers: payload ? { "Content-Type": "application/json" } : undefined,
    body: form ?? (payload ? JSON.stringify(payload) : undefined),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}

async function get(action: string, params: Record<string, string> = {}) {
  const url = new URL(`/api/sales?action=${action}`, window.location.origin);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url);
  return res.json();
}

function useJob() {
  const jobRef = useRef<Job | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const pollers = useRef<number[]>([]);

  function stop() {
    pollers.current.forEach((id) => window.clearInterval(id));
    pollers.current = [];
  }

  function watch(jobId: string) {
    stop();
    const initial: Job = { id: jobId, status: "running", progress: 0, total: 0, detail: "Starting", done: false };
    jobRef.current = initial;
    setJob(initial);
    const id = window.setInterval(async () => {
      const next = await get("job", { jobId });
      setJob(next);
      if (next.done) {
        stop();
      }
    }, 900);
    pollers.current.push(id);
  }

  useEffect(() => stop, []);
  return { job, watch, stop };
}

export default function ResearchPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [counts, setCounts] = useState({ leads: 0, withEmail: 0, exclusions: 0, unsubscribes: 0, campaigns: 0 });
  const [niches, setNiches] = useState<Array<{ niche: string; n: number }>>([]);
  const [nicheFilter, setNicheFilter] = useState("All");
  const [editing, setEditing] = useState<{ id: number; field: "niche" | "phone" | "contact" | "email"; value: string } | null>(null);
  const [smtpOk, setSmtpOk] = useState<boolean | null>(null);
  const [selectedAreas, setSelectedAreas] = useState<Set<string>>(new Set(AREAS));
  const [pagesPerArea, setPagesPerArea] = useState(3);
  const [sicProfile, setSicProfile] = useState<"all" | "targeted">("all");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [query, setQuery] = useState("");
  const [areaFilter, setAreaFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [emailOnly, setEmailOnly] = useState(false);
  const [sort, setSort] = useState<{ key: keyof Lead; dir: "asc" | "desc" }>({ key: "score", dir: "desc" });
  const [exclusions, setExclusions] = useState<Array<Record<string, unknown>>>([]);
  const [tab, setTab] = useState<"prospects" | "exclusions">("prospects");
  const [banner, setBanner] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [showSend, setShowSend] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [body, setBody] = useState(DEFAULT_BODY);
  const [sending, setSending] = useState(false);
  const { job, watch } = useJob();

  useEffect(() => {
    let cancelled = false;
    Promise.all([get("leads"), get("status"), get("exclusions")]).then(([leadRows, status, excl]) => {
      if (cancelled) return;
      setLeads(leadRows.leads ?? []);
      setCounts(status.counts ?? { leads: 0, withEmail: 0, exclusions: 0, unsubscribes: 0, campaigns: 0 });
      setSmtpOk(Boolean(status.smtpConfigured));
      setExclusions(excl.rows ?? []);
      setNiches(status.niches ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function refresh() {
    const [leadRows, status, excl] = await Promise.all([get("leads"), get("status"), get("exclusions")]);
    setLeads(leadRows.leads ?? []);
    setCounts(status.counts ?? counts);
    setSmtpOk(Boolean(status.smtpConfigured));
    setExclusions(excl.rows ?? []);
    setNiches(status.niches ?? []);
  }

  async function runResearch() {
    setBanner(null);
    const jobId = `res-${Date.now()}`;
    watch(jobId);
    try {
      await post("research", {
        jobId,
        areas: Array.from(selectedAreas),
        pagesPerArea,
        sicCodes: sicProfile === "targeted" ? TARGET_SIC_CODES : undefined,
      });
      await refresh();
    } catch (error) {
      setBanner({ kind: "error", text: (error as Error).message });
    }
  }

  async function runEnrich() {
    setBanner(null);
    const jobId = `enr-${Date.now()}`;
    watch(jobId);
    try {
      const result = await post("enrich", { jobId, leadIds: Array.from(selected), limit: 40 });
      setBanner({ kind: "ok", text: `Found ${result.found} email addresses from ${result.checked} companies.` });
      await refresh();
    } catch (error) {
      setBanner({ kind: "error", text: (error as Error).message });
    }
  }

  async function handleUpload(file: File) {
    setUploading(true);
    setBanner(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const result = await post("exclude-upload", undefined, form);
      setBanner({
        kind: "ok",
        text: `Read ${result.rows} rows, added ${result.added} to your exclusion list, removed ${result.removedFromWorkspace} matching companies from the workspace.`,
      });
      await refresh();
      setTab("exclusions");
    } catch (error) {
      setBanner({ kind: "error", text: (error as Error).message });
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function sendCampaign() {
    setSending(true);
    setBanner(null);
    try {
      const result = await post("campaign-create-and-send", {
        name: `Elite Cars outreach ${new Date().toLocaleDateString("en-GB")}`,
        subject,
        body,
        leadIds: Array.from(selected),
        send: true,
        minConfidence: "medium",
      });
      if (result.error) setBanner({ kind: "error", text: result.error });
      else setBanner({ kind: "ok", text: `Queued ${result.queued} emails (${result.skipped} skipped), sent ${result.send?.sent ?? 0} in this batch.` });
      await refresh();
      setShowSend(false);
    } catch (error) {
      setBanner({ kind: "error", text: (error as Error).message });
    } finally {
      setSending(false);
    }
  }

  async function testSmtp() {
    try {
      const result = await post("smtp-verify");
      setBanner(result.ok ? { kind: "ok", text: "SMTP connection works." } : { kind: "error", text: `SMTP failed: ${result.error}` });
    } catch (error) {
      setBanner({ kind: "error", text: (error as Error).message });
    }
  }

  function exportFile(format: "xlsx" | "csv") {
    const params = new URLSearchParams({ format });
    if (selected.size) params.set("ids", Array.from(selected).join(","));
    else {
      if (query.trim()) params.set("q", query.trim());
      if (areaFilter !== "All") params.set("area", areaFilter);
      if (priorityFilter !== "All") params.set("priority", priorityFilter);
      if (nicheFilter !== "All") params.set("niche", nicheFilter);
      if (emailOnly) params.set("emailOnly", "true");
    }
    const anchor = document.createElement("a");
    anchor.href = `/api/export?${params.toString()}`;
    anchor.download = format === "xlsx" ? "elite-cars-prospects.xlsx" : "elite-cars-prospects.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  async function saveEdit() {
    if (!editing) return;
    const { id, field, value } = editing;
    setEditing(null);
    try {
      const res = await fetch("/api/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, [field]: value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Update failed");
      setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...data.lead } : l)));
      if (field === "niche" || field === "email") await refresh();
    } catch (error) {
      setBanner({ kind: "error", text: (error as Error).message });
    }
  }

  function editCell(lead: Lead, field: "niche" | "phone" | "contact" | "email") {
    setEditing({ id: lead.id, field, value: (lead[field] ?? "") as string });
  }

  function inlineCell(lead: Lead, field: "niche" | "phone" | "contact" | "email") {
    if (editing?.id === lead.id && editing.field === field) {
      return (
        <input
          autoFocus
          defaultValue={editing.value}
          onBlur={saveEdit}
          onKeyDown={(e) => {
            if (e.key === "Enter") saveEdit();
            if (e.key === "Escape") setEditing(null);
          }}
          className="w-full rounded-lg border border-white/20 bg-[#08090b] px-2 py-1 text-xs text-zinc-100 outline-none"
        />
      );
    }
    const value = lead[field];
    return (
      <button onClick={() => editCell(lead, field)} className="w-full text-left text-xs text-zinc-400 hover:text-white" title="Click to edit">
        {value || <span className="text-zinc-700">add…</span>}
      </button>
    );
  }

  function toggleArea(name: string) {
    setSelectedAreas((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const areasInData = Array.from(new Set(leads.map((l) => l.area))).sort();

  const filtered = leads
    .filter((l) => {
      const q = query.trim().toLowerCase();
      const hitQuery = !q || [l.company_name, l.area, l.industry, l.email, l.contact, l.angle].some((v) => (v ?? "").toLowerCase().includes(q));
      const hitArea = areaFilter === "All" || l.area === areaFilter;
      const hitPriority = priorityFilter === "All" || l.priority === priorityFilter;
      const hitNiche = nicheFilter === "All" || l.niche === nicheFilter;
      const hitEmail = !emailOnly || Boolean(l.email);
      return hitQuery && hitArea && hitPriority && hitNiche && hitEmail;
    })
    .sort((a, b) => {
      const av = sort.key === "score" ? a.score : String(a[sort.key] ?? "");
      const bv = sort.key === "score" ? b.score : String(b[sort.key] ?? "");
      return (typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv))) * (sort.dir === "asc" ? 1 : -1);
    });

  const selectable = filtered.filter((l) => l.email && l.email_confidence !== "low");

  function sortBy(key: keyof Lead) {
    setSort((prev) => ({ key, dir: prev.key === key && prev.dir === "desc" ? "asc" : "desc" }));
  }

  function addExclusionNow(lead: Lead) {
    setBanner(null);
    post("exclude-single", {
      companyNumber: null,
      companyName: lead.company_name,
      domain: lead.website,
    })
      .then(async () => {
        setBanner({ kind: "ok", text: `${lead.company_name} added to your exclusion list. It will be filtered out of all future research.` });
        setSelected((prev) => {
          const next = new Set(prev);
          next.delete(lead.id);
          return next;
        });
        await refresh();
      })
      .catch((error) => setBanner({ kind: "error", text: (error as Error).message }));
  }

  return (
    <main className="min-h-screen bg-[#07080a] text-white">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0b0c0f]/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1800px] items-center justify-between gap-4 px-5 py-4 lg:px-8">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-black"><Sparkles className="h-5 w-5" /></Link>
            <div>
              <div className="text-sm font-semibold">Elite Cars · Prospect Engine</div>
              <div className="text-xs text-zinc-500">Real Companies House data · Berkshire & Surrey M25 corridor</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] sm:flex ${smtpOk ? "bg-emerald-400/10 text-emerald-300" : "bg-amber-400/10 text-amber-300"}`}>
              <Shield className="h-3 w-3" />{smtpOk === null ? "checking mail" : smtpOk ? "mail ready" : "mail not configured"}
            </span>
            <Link href="/" className="rounded-xl border border-white/10 px-3 py-2 text-sm text-zinc-400 hover:bg-white/5 hover:text-white">Dashboard</Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1800px] p-4 lg:p-7">
        {banner && (
          <div className={`mb-4 flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${banner.kind === "ok" ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200" : "border-red-400/20 bg-red-400/10 text-red-200"}`}>
            {banner.kind === "ok" ? <Check className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
            <span className="flex-1">{banner.text}</span>
            <button onClick={() => setBanner(null)}><X className="h-4 w-4" /></button>
          </div>
        )}

        {job && (
          <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-3 text-sm">
              {job.done ? <Check className="h-4 w-4 text-emerald-400" /> : <Loader2 className="h-4 w-4 animate-spin" />}
              <span className="flex-1">{job.detail || job.status}</span>
              {job.total > 0 && <span className="text-xs text-zinc-500">{job.progress}/{job.total}</span>}
            </div>
            {job.error && <div className="mt-2 text-xs text-red-300">{job.error}</div>}
          </div>
        )}

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 lg:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-semibold">Research real companies in your patch</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">
                Pulls live Companies House records for each town, scores them by SIC code for chauffeur relevance, and drops anything on your exclusion list before it reaches the workspace.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {AREAS.map((area) => (
                  <button
                    key={area}
                    onClick={() => toggleArea(area)}
                    className={`rounded-full border px-3 py-1.5 text-xs transition ${selectedAreas.has(area) ? "border-white bg-white text-black" : "border-white/10 text-zinc-500 hover:border-white/30 hover:text-zinc-300"}`}
                  >
                    {area}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-zinc-600">
                <span>{selectedAreas.size} of {AREAS.length} areas selected</span>
                <label className="flex items-center gap-2">
                  Focus
                  <select value={sicProfile} onChange={(e) => setSicProfile(e.target.value as "all" | "targeted")} className="rounded-lg border border-white/10 bg-[#08090b] px-2 py-1 text-xs">
                    <option value="all">Every company</option>
                    <option value="targeted">Chauffeur sectors only</option>
                  </select>
                </label>
                <label className="flex items-center gap-2">
                  Pages per area
                  <select value={pagesPerArea} onChange={(e) => setPagesPerArea(Number(e.target.value))} className="rounded-lg border border-white/10 bg-[#08090b] px-2 py-1 text-xs">
                    <option value={1}>1</option>
                    <option value={3}>3</option>
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                  </select>
                  <span>≈{selectedAreas.size * pagesPerArea * 100} companies max</span>
                </label>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <button onClick={runResearch} disabled={!selectedAreas.size} className="flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black disabled:opacity-40">
                <Play className="h-4 w-4" /> Research companies
              </button>
            </div>
          </div>
        </section>

        <section className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {[
            { label: "Companies in workspace", value: counts.leads },
            { label: "With email found", value: counts.withEmail },
            { label: "On exclusion list", value: counts.exclusions },
            { label: "Unsubscribed", value: counts.unsubscribes },
            { label: "Campaigns run", value: counts.campaigns },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-xs text-zinc-500">{stat.label}</div>
              <div className="mt-1 text-2xl font-semibold">{Number(stat.value ?? 0).toLocaleString()}</div>
            </div>
          ))}
        </section>

        <section className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="flex items-center gap-2 font-semibold"><Ban className="h-4 w-4 text-zinc-400" /> Exclusion list</h2>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-zinc-500">
                Upload a CSV or Excel sheet of companies you already work, already contacted, or never want to see again. Any column containing a company name works — extra columns like website or email are used too. Matches are removed from the workspace and skipped in all future research and sends.
              </p>
            </div>
            <div className="flex gap-2">
              <input
                ref={fileInput}
                type="file"
                accept=".csv,.xls,.xlsx"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUpload(file);
                }}
              />
              <button onClick={() => fileInput.current?.click()} disabled={uploading} className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm hover:bg-white/5 disabled:opacity-40">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload CSV / Excel
              </button>
              <button onClick={testSmtp} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-zinc-400 hover:bg-white/5">Test mail</button>
            </div>
          </div>
          {exclusions.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {exclusions.slice(0, 12).map((row) => (
                <span key={String(row.id)} className="flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1.5 text-xs text-zinc-400">
                  {String(row.company_name)}
                  {row.source_file ? <span className="text-zinc-600">· {String(row.source_file)}</span> : null}
                </span>
              ))}
              {exclusions.length > 12 && <span className="text-xs text-zinc-600">+{exclusions.length - 12} more</span>}
            </div>
          )}
        </section>

        <div className="mt-4 flex gap-1 rounded-xl border border-white/10 p-1">
          {(["prospects", "exclusions"] as const).map((item) => (
            <button key={item} onClick={() => setTab(item)} className={`flex-1 rounded-lg px-3 py-2 text-sm capitalize ${tab === item ? "bg-white text-black" : "text-zinc-500"}`}>
              {item === "prospects" ? `Prospects (${leads.length})` : `Exclusions (${exclusions.length})`}
            </button>
          ))}
        </div>

        {tab === "exclusions" ? (
          <section className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-[#0a0b0d]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-white/10 text-[11px] uppercase tracking-wide text-zinc-600">
                  <tr>
                    <th className="px-4 py-3">Company</th>
                    <th className="px-4 py-3">Domain</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Reason</th>
                    <th className="px-4 py-3">File</th>
                    <th className="px-4 py-3">Added</th>
                  </tr>
                </thead>
                <tbody>
                  {exclusions.map((row) => (
                    <tr key={String(row.id)} className="border-b border-white/5 text-xs text-zinc-400">
                      <td className="px-4 py-2.5 text-zinc-200">{String(row.company_name)}</td>
                      <td className="px-4 py-2.5">{row.domain ? String(row.domain) : "—"}</td>
                      <td className="px-4 py-2.5">{row.email ? String(row.email) : "—"}</td>
                      <td className="px-4 py-2.5">{row.reason ? String(row.reason) : "—"}</td>
                      <td className="px-4 py-2.5 text-zinc-600">{row.source_file ? String(row.source_file) : "manual"}</td>
                      <td className="px-4 py-2.5 text-zinc-600">{String(row.created_at)}</td>
                    </tr>
                  ))}
                  {!exclusions.length && (
                    <tr><td colSpan={6} className="px-4 py-10 text-center text-zinc-600">No exclusions yet. Upload a sheet to lock companies out of future research.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ) : (
          <section className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-[#0a0b0d]">
            <div className="flex flex-col gap-3 border-b border-white/10 p-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-1 flex-wrap items-center gap-2">
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search company, area, industry, email…" className="min-w-[220px] flex-1 rounded-xl border border-white/10 bg-[#08090b] px-3 py-2.5 text-sm outline-none" />
                <select value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)} className="rounded-xl border border-white/10 bg-[#08090b] px-3 py-2.5 text-xs">
                  <option value="All">All areas</option>
                  {areasInData.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
                <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="rounded-xl border border-white/10 bg-[#08090b] px-3 py-2.5 text-xs">
                  <option value="All">Any priority</option>
                  {["Very High", "High", "Medium", "Low"].map((p) => <option key={p}>{p}</option>)}
                </select>
                {niches.length > 0 && (
                  <select value={nicheFilter} onChange={(e) => setNicheFilter(e.target.value)} className="max-w-[190px] rounded-xl border border-white/10 bg-[#08090b] px-3 py-2.5 text-xs">
                    <option value="All">All niches</option>
                    {niches.map((n) => (
                      <option key={n.niche} value={n.niche}>
                        {n.niche} ({n.n})
                      </option>
                    ))}
                  </select>
                )}
                <label className="flex items-center gap-2 text-xs text-zinc-500">
                  <input type="checkbox" checked={emailOnly} onChange={(e) => setEmailOnly(e.target.checked)} className="accent-white" /> Email only
                </label>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-zinc-500">{filtered.length} shown · {selected.size} selected</span>
                <div className="flex overflow-hidden rounded-xl border border-white/10">
                  <button onClick={() => exportFile("xlsx")} className="flex items-center gap-1.5 bg-white px-3 py-2.5 text-xs font-semibold text-black hover:bg-white/90">
                    <Download className="h-3.5 w-3.5" /> Excel
                  </button>
                  <button onClick={() => exportFile("csv")} className="border-l border-white/10 px-3 py-2.5 text-xs text-zinc-400 hover:bg-white/5">
                    CSV
                  </button>
                </div>
                <button onClick={runEnrich} disabled={!selected.size || !job?.done} className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2.5 text-xs text-zinc-400 hover:bg-white/5 disabled:opacity-30">
                  <FileSpreadsheet className="h-3.5 w-3.5" /> Find emails ({selected.size})
                </button>
                <button
                  onClick={() => setShowSend(true)}
                  disabled={!selectable.length}
                  className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-2.5 text-xs font-semibold text-black disabled:opacity-30"
                >
                  <Send className="h-3.5 w-3.5" /> Email {selectable.length}
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1500px] text-left">
                <thead className="bg-[#0b0c0f] text-[11px] uppercase tracking-wide text-zinc-600">
                  <tr className="border-b border-white/10">
                    <th className="w-11 px-3 py-3">
                      <button
                        onClick={() => {
                          const ids = selectable.map((l) => l.id);
                          setSelected((prev) => (ids.every((id) => prev.has(id)) ? new Set() : new Set(ids)));
                        }}
                        className="flex h-4 w-4 items-center justify-center rounded border border-zinc-700"
                      >
                        {selectable.length > 0 && selectable.every((l) => selected.has(l.id)) && <Check className="h-3 w-3" />}
                      </button>
                    </th>
                    {([
                      ["company_name", "Company"],
                      ["area", "Area"],
                      ["niche", "Niche"],
                      ["score", "Score"],
                      ["priority", "Priority"],
                    ] as Array<[keyof Lead, string]>).map(([key, label]) => (
                      <th key={key} className="px-3 py-3">
                        <button onClick={() => sortBy(key)} className="flex items-center gap-1 hover:text-zinc-300">
                          {label}{sort.key === key ? <span className="text-zinc-400">{sort.dir === "desc" ? "▼" : "▲"}</span> : null}
                        </button>
                      </th>
                    ))}
                    <th className="px-3 py-3">Email</th>
                    <th className="px-3 py-3">Website</th>
                    <th className="px-3 py-3">Phone</th>
                    <th className="px-3 py-3">Contact</th>
                    <th className="px-3 py-3">Angle</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 500).map((lead) => (
                    <tr key={lead.id} className={`border-b border-white/5 hover:bg-white/[0.03] ${selected.has(lead.id) ? "bg-white/[0.04]" : ""}`}>
                      <td className="px-3 py-3">
                        <button onClick={() => toggle(lead.id)} className={`flex h-4 w-4 items-center justify-center rounded border ${selected.has(lead.id) ? "border-white bg-white text-black" : "border-zinc-700"}`}>
                          {selected.has(lead.id) && <Check className="h-3 w-3" />}
                        </button>
                      </td>
                      <td className="max-w-[260px] px-3 py-3">
                        <div className="truncate text-sm font-medium text-zinc-100">{lead.company_name}</div>
                        <div className="truncate text-[11px] text-zinc-600">{lead.postcode || "—"}</div>
                      </td>
                      <td className="px-3 py-3 text-xs text-zinc-400">{lead.area}</td>
                      <td className="max-w-[240px] px-3 py-3">{inlineCell(lead, "niche")}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          {lead.score}
                          <div className="h-1.5 w-12 overflow-hidden rounded-full bg-white/5">
                            <div className="h-full rounded-full bg-white" style={{ width: `${Math.min(lead.score, 100)}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`rounded-full border px-2 py-1 text-[10px] ${PRIORITY_STYLE[lead.priority] ?? PRIORITY_STYLE.Medium}`}>{lead.priority}</span>
                      </td>
                      <td className="px-3 py-3 text-xs">
                        {lead.email ? (
                          <div>
                            <div className="text-zinc-200">{lead.email}</div>
                            <div className="text-[10px] text-zinc-600">
                              via {lead.email_source} ·{" "}
                              <span className={lead.email_confidence === "high" ? "text-emerald-400" : lead.email_confidence === "medium" ? "text-amber-400" : "text-red-400"}>
                                {lead.email_confidence} confidence
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-zinc-700">Not found</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-xs">
                        {lead.website ? (
                          <a href={lead.website} target="_blank" rel="noreferrer" className="text-zinc-400 underline decoration-zinc-700 underline-offset-2 hover:text-white">
                            {lead.website.replace(/^https?:\/\//, "").slice(0, 28)}
                          </a>
                        ) : (
                          <span className="text-zinc-700">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3">{inlineCell(lead, "phone")}</td>
                      <td className="max-w-[220px] px-3 py-3">{inlineCell(lead, "contact")}</td>
                      <td className="max-w-[320px] px-3 py-3 text-xs text-zinc-500">{lead.angle ?? "—"}</td>
                      <td className="px-3 py-3 text-xs text-zinc-500">{lead.status}</td>
                      <td className="px-3 py-3">
                        <button onClick={() => addExclusionNow(lead)} title="Never contact this company" className="rounded-lg p-1.5 text-zinc-600 hover:bg-red-400/10 hover:text-red-300">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!filtered.length && (
                    <tr>
                      <td colSpan={13} className="px-4 py-16 text-center text-sm text-zinc-600">
                        {leads.length
                          ? "No companies match those filters."
                          : "Workspace is empty. Set your Companies House API key in .env.local and press Research companies."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {filtered.length > 500 && (
              <div className="border-t border-white/10 px-4 py-3 text-xs text-zinc-600">
                Showing the top 500 of {filtered.length}. Narrow with filters or export to CSV for the full set.
              </div>
            )}
          </section>
        )}
      </div>

      {showSend && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 lg:p-10">
          <div className="w-full max-w-5xl rounded-2xl border border-white/10 bg-[#0a0b0d] p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold"><Mail className="h-4 w-4" /> Bulk email</h2>
                <p className="mt-1 text-xs text-zinc-500">
                  Sending from <span className="text-zinc-300">ali@elite-cars.co.uk</span> to {selectable.length} companies. Sends in small batches with a delay between each to protect deliverability. Every email carries a one-click unsubscribe link and exclusions are re-checked at send time.
                </p>
              </div>
              <button onClick={() => setShowSend(false)}><X className="h-5 w-5 text-zinc-500" /></button>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-zinc-500">Subject</label>
                  <input value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#08090b] px-3 py-3 text-sm outline-none" />
                </div>
                <div>
                  <label className="text-xs text-zinc-500">Message</label>
                  <textarea value={body} onChange={(e) => setBody(e.target.value)} className="mt-1.5 min-h-[380px] w-full rounded-xl border border-white/10 bg-[#08090b] p-4 text-sm leading-6 text-zinc-200 outline-none" />
                </div>
                <div className="text-[11px] text-zinc-600">
                  Variables: {"{{first_name}} {{company}} {{area}} {{industry}} {{angle}}"}
                </div>
              </div>

              <aside className="space-y-3">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-xs">
                  <div className="flex items-center gap-2 font-semibold text-zinc-300"><Users className="h-3.5 w-3.5" /> Recipients</div>
                  <div className="mt-3 flex justify-between"><span className="text-zinc-500">Selected</span><span>{selected.size}</span></div>
                  <div className="mt-1 flex justify-between"><span className="text-zinc-500">With email</span><span>{selectable.length}</span></div>
                  <div className="mt-1 flex justify-between"><span className="text-zinc-500">Skipped</span><span>{selected.size - selectable.length}</span></div>
                  <div className="mt-1 flex justify-between"><span className="text-zinc-500">High confidence</span><span>{selectable.filter((l) => l.email_confidence === "high").length}</span></div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-xs">
                  <div className="flex items-center gap-2 font-semibold text-zinc-300"><Shield className="h-3.5 w-3.5" /> Compliance</div>
                  <ul className="mt-3 space-y-2 text-zinc-500">
                    <li>· Every message identifies Elite Cars and why it was sent</li>
                    <li>· One-click unsubscribe header plus visible link</li>
                    <li>· Unsubscribes and exclusions are checked at send time</li>
                    <li>· Only high and medium confidence matches are allowed to send</li>
                    <li>· Delayed sends to avoid spam-flagging your domain</li>
                  </ul>
                </div>
                <button
                  onClick={sendCampaign}
                  disabled={sending || !selectable.length}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3.5 text-sm font-semibold text-black disabled:opacity-40"
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {sending ? "Sending…" : `Send to ${selectable.length}`}
                </button>
              </aside>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}