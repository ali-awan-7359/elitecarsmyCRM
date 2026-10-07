import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { smtpConfigured } from "@/lib/mailer";
import { TARGET_AREAS } from "@/lib/target-areas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function Home() {
  const stats = db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM leads) AS leads,
        (SELECT COUNT(*) FROM leads WHERE email IS NOT NULL AND email <> '') AS withEmail,
        (SELECT COUNT(*) FROM leads WHERE priority = 'Very High') AS veryHigh,
        (SELECT COUNT(*) FROM leads WHERE status = 'Emailed') AS emailed,
        (SELECT COUNT(*) FROM exclusions) AS exclusions,
        (SELECT COUNT(*) FROM unsubscribes) AS unsubscribes`
    )
    .get() as Record<string, number>;

  const byArea = db
    .prepare(
      `SELECT area, COUNT(*) AS n, SUM(CASE WHEN email IS NOT NULL AND email <> '' THEN 1 ELSE 0 END) AS withEmail
       FROM leads GROUP BY area ORDER BY n DESC`
    )
    .all() as Array<{ area: string; n: number; withEmail: number }>;

  const recentCampaigns = db.prepare("SELECT * FROM campaigns ORDER BY id DESC LIMIT 5").all() as Array<Record<string, unknown>>;

  const hasKey = Boolean(process.env.COMPANIES_HOUSE_API_KEY);

  return (
    <main className="min-h-screen bg-[#07080a] text-white">
      <div className="mx-auto max-w-[1400px] p-5 lg:p-10">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-lg font-bold text-black">E</div>
            <div>
              <h1 className="text-lg font-semibold">Elite Cars Sales OS</h1>
              <p className="text-xs text-zinc-500">ali@elite-cars.co.uk · executive chauffeur outreach</p>
            </div>
          </div>
          <a href="/research" className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black">Open prospect engine</a>
        </header>

        {!hasKey && (
          <div className="mt-8 rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-5 text-sm text-amber-100">
            <div className="font-semibold">Set your Companies House API key to start</div>
            <p className="mt-1 leading-6 text-amber-200/70">
              Grab a free key at developer.companieshouse.gov.uk, then put it in <code className="rounded bg-black/30 px-1.5 py-0.5 text-xs">COMPANIES_HOUSE_API_KEY</code> inside{" "}
              <code className="rounded bg-black/30 px-1.5 py-0.5 text-xs">.env.local</code> and restart the app. It already knows about your 18 target towns.
            </p>
          </div>
        )}

        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Companies researched", value: stats.leads },
            { label: "Emails located", value: stats.withEmail },
            { label: "Very high priority", value: stats.veryHigh },
            { label: "Companies emailed", value: stats.emailed },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="text-xs text-zinc-500">{stat.label}</div>
              <div className="mt-2 text-3xl font-semibold">{Number(stat.value ?? 0).toLocaleString()}</div>
            </div>
          ))}
        </section>

        <section className="mt-4 grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="font-semibold">Coverage by area</h2>
            <p className="mt-1 text-xs text-zinc-500">{TARGET_AREAS.length} towns configured for research.</p>
            <div className="mt-4 space-y-2">
              {TARGET_AREAS.map((area) => {
                const row = byArea.find((r) => r.area === area.name);
                const max = Math.max(...byArea.map((r) => r.n), 1);
                return (
                  <div key={area.name} className="flex items-center gap-3">
                    <div className="w-32 shrink-0 truncate text-xs text-zinc-400">{area.name}</div>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/5">
                      <div className="h-full rounded-full bg-white/70" style={{ width: `${((row?.n ?? 0) / max) * 100}%` }} />
                    </div>
                    <div className="w-24 shrink-0 text-right text-[11px] text-zinc-500">
                      {row?.n ?? 0} · {row?.withEmail ?? 0} with email
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <h2 className="font-semibold">Data hygiene</h2>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-zinc-500">Exclusion list</span><span>{stats.exclusions}</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Unsubscribed</span><span>{stats.unsubscribes}</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">SMTP</span><span className={smtpConfigured() ? "text-emerald-300" : "text-amber-300"}>{smtpConfigured() ? "configured" : "not configured"}</span></div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <h2 className="font-semibold">Recent campaigns</h2>
              <div className="mt-3 space-y-2 text-xs">
                {recentCampaigns.length ? (
                  recentCampaigns.map((c) => (
                    <div key={String(c.id)} className="flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2">
                      <span className="truncate text-zinc-300">{String(c.name)}</span>
                      <span className="shrink-0 text-zinc-600">{String(c.sent ?? 0)} sent</span>
                    </div>
                  ))
                ) : (
                  <p className="text-zinc-600">Nothing sent yet.</p>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}