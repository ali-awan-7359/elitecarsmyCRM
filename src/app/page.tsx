import {
  ArrowUpRight,
  Bell,
  CalendarDays,
  ChevronRight,
  Clock3,
  DollarSign,
  Mail,
  Phone,
  Plus,
  Search,
  TrendingUp,
  Users,
} from "lucide-react";

const pipeline = [
  { label: "New", value: 18, amount: "$1.42M", tone: "blue" },
  { label: "Contacted", value: 12, amount: "$980K", tone: "violet" },
  { label: "Qualified", value: 8, amount: "$760K", tone: "amber" },
  { label: "Proposal", value: 5, amount: "$510K", tone: "orange" },
  { label: "Won", value: 3, amount: "$342K", tone: "green" },
];

const calls = [
  {
    name: "Daniel Mercer",
    company: "Mercer Holdings",
    time: "9:30 AM",
    vehicle: "2025 Porsche 911 Turbo S",
    status: "Due now",
  },
  {
    name: "Sophia Bennett",
    company: "Bennett Capital",
    time: "10:15 AM",
    vehicle: "2025 Range Rover Autobiography",
    status: "Upcoming",
  },
  {
    name: "James Whitmore",
    company: "Whitmore Group",
    time: "11:00 AM",
    vehicle: "2024 Ferrari Roma",
    status: "Upcoming",
  },
  {
    name: "Alexander Cole",
    company: "Cole Ventures",
    time: "1:30 PM",
    vehicle: "2025 Mercedes-AMG GT",
    status: "Upcoming",
  },
];

const activities = [
  {
    icon: Phone,
    title: "Call completed",
    description: "Daniel Mercer — qualified lead",
    time: "8 min ago",
  },
  {
    icon: Mail,
    title: "Email opened",
    description: "Sophia Bennett — inventory update",
    time: "24 min ago",
  },
  {
    icon: Users,
    title: "New prospect added",
    description: "Michael Sterling — Sterling Partners",
    time: "41 min ago",
  },
  {
    icon: CalendarDays,
    title: "Test drive scheduled",
    description: "James Whitmore — Ferrari Roma",
    time: "1 hr ago",
  },
];

function MetricCard({
  label,
  value,
  change,
  icon: Icon,
}: {
  label: string;
  value: string;
  change: string;
  icon: typeof Users;
}) {
  return (
    <div className="rounded-2xl border border-white/7 bg-white/[0.035] p-5">
      <div className="mb-5 flex items-center justify-between">
        <span className="text-sm text-zinc-400">{label}</span>
        <div className="rounded-xl border border-white/8 bg-white/[0.04] p-2.5">
          <Icon className="h-4 w-4 text-zinc-300" strokeWidth={1.7} />
        </div>
      </div>

      <div className="flex items-end justify-between gap-3">
        <span className="text-3xl font-semibold tracking-tight text-white">
          {value}
        </span>
        <span className="mb-1 flex items-center gap-1 text-xs font-medium text-emerald-400">
          <TrendingUp className="h-3.5 w-3.5" />
          {change}
        </span>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen bg-[#08090b] text-zinc-100">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 border-r border-white/7 bg-[#0b0c0f] lg:flex lg:flex-col">
          <div className="flex h-20 items-center border-b border-white/7 px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-black">
                <span className="text-sm font-black tracking-tighter">EC</span>
              </div>
              <div>
                <div className="text-sm font-semibold tracking-wide text-white">
                  ELITE CARS
                </div>
                <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">
                  Sales OS
                </div>
              </div>
            </div>
          </div>

          <nav className="flex-1 px-3 py-6">
            <div className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-600">
              Workspace
            </div>

            <a
              href="#"
              className="flex items-center gap-3 rounded-xl bg-white/7 px-3 py-2.5 text-sm font-medium text-white"
            >
              <TrendingUp className="h-4 w-4" />
              Dashboard
            </a>

            {[
              ["Prospects", Users],
              ["Companies", Users],
              ["Calls", Phone],
              ["Follow-ups", Clock3],
              ["Campaigns", Mail],
            ].map(([label, Icon]) => (
              <a
                key={String(label)}
                href="#"
                className="mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-white"
              >
                <Icon className="h-4 w-4" />
                {String(label)}
              </a>
            ))}

            <div className="mb-3 mt-9 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-600">
              Intelligence
            </div>

            {[
              ["Market Signals", Search],
              ["Analytics", TrendingUp],
            ].map(([label, Icon]) => (
              <a
                key={String(label)}
                href="#"
                className="mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-white"
              >
                <Icon className="h-4 w-4" />
                {String(label)}
              </a>
            ))}
          </nav>

          <div className="border-t border-white/7 p-4">
            <div className="rounded-xl border border-white/7 bg-white/[0.025] p-3">
              <div className="text-xs font-medium text-zinc-300">
                Sales target
              </div>
              <div className="mt-2 flex items-end justify-between">
                <span className="text-lg font-semibold text-white">$2.4M</span>
                <span className="text-xs text-zinc-500">72%</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/8">
                <div className="h-full w-[72%] rounded-full bg-white" />
              </div>
            </div>
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          <header className="flex h-20 items-center justify-between border-b border-white/7 px-5 sm:px-8">
            <div>
              <div className="text-xs text-zinc-500">Wednesday, October 7, 2026</div>
              <h1 className="mt-1 text-xl font-semibold tracking-tight text-white">
                Good evening, Ali
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <button className="hidden h-10 items-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-3 text-sm text-zinc-300 sm:flex">
                <Search className="h-4 w-4" />
                Search
                <span className="ml-2 rounded-md border border-white/8 px-1.5 py-0.5 text-[10px] text-zinc-500">
                  /
                </span>
              </button>

              <button className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/8 bg-white/[0.03] text-zinc-300">
                <Bell className="h-4 w-4" />
              </button>

              <button className="flex h-10 items-center gap-2 rounded-xl bg-white px-3 text-sm font-semibold text-black">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Add prospect</span>
              </button>
            </div>
          </header>

          <div className="mx-auto max-w-[1500px] p-5 sm:p-8">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Pipeline value"
                value="$4.01M"
                change="+18.4%"
                icon={DollarSign}
              />
              <MetricCard
                label="Active prospects"
                value="46"
                change="+12.2%"
                icon={Users}
              />
              <MetricCard
                label="Calls today"
                value="18"
                change="+5.8%"
                icon={Phone}
              />
              <MetricCard
                label="Win rate"
                value="28.6%"
                change="+4.1%"
                icon={TrendingUp}
              />
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-[1.45fr_1fr]">
              <section className="rounded-2xl border border-white/7 bg-white/[0.025]">
                <div className="flex items-center justify-between border-b border-white/7 px-5 py-4">
                  <div>
                    <h2 className="font-semibold text-white">Sales pipeline</h2>
                    <p className="mt-1 text-xs text-zinc-500">
                      Current opportunity distribution
                    </p>
                  </div>
                  <button className="flex items-center gap-1 text-xs font-medium text-zinc-400 hover:text-white">
                    View pipeline
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="grid gap-3 p-5 sm:grid-cols-5">
                  {pipeline.map((stage) => (
                    <div
                      key={stage.label}
                      className="rounded-xl border border-white/7 bg-[#0c0e11] p-4"
                    >
                      <div className="text-xs text-zinc-500">{stage.label}</div>
                      <div className="mt-3 text-2xl font-semibold text-white">
                        {stage.value}
                      </div>
                      <div className="mt-1 text-xs text-zinc-600">
                        {stage.amount}
                      </div>
                      <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/6">
                        <div
                          className={`h-full rounded-full ${
                            stage.tone === "blue"
                              ? "w-[85%] bg-blue-400"
                              : stage.tone === "violet"
                                ? "w-[68%] bg-violet-400"
                                : stage.tone === "amber"
                                  ? "w-[52%] bg-amber-400"
                                  : stage.tone === "orange"
                                    ? "w-[38%] bg-orange-400"
                                    : "w-[26%] bg-emerald-400"
                          }`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-white/7 bg-white/[0.025]">
                <div className="flex items-center justify-between border-b border-white/7 px-5 py-4">
                  <div>
                    <h2 className="font-semibold text-white">Today&apos;s calls</h2>
                    <p className="mt-1 text-xs text-zinc-500">
                      4 priority conversations
                    </p>
                  </div>
                  <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/8 text-zinc-400 hover:text-white">
                    <Phone className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="divide-y divide-white/6">
                  {calls.map((call) => (
                    <div
                      key={call.name}
                      className="flex items-center gap-3 px-5 py-3.5"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/8 bg-white/[0.04] text-xs font-semibold text-zinc-300">
                        {call.name
                          .split(" ")
                          .map((part) => part[0])
                          .join("")}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium text-white">
                            {call.name}
                          </span>
                          {call.status === "Due now" && (
                            <span className="rounded-md bg-amber-400/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-300">
                              Due
                            </span>
                          )}
                        </div>
                        <div className="truncate text-xs text-zinc-600">
                          {call.vehicle}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs font-medium text-zinc-300">
                          {call.time}
                        </div>
                        <div className="mt-0.5 text-[10px] text-zinc-600">
                          {call.company}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1fr]">
              <section className="rounded-2xl border border-white/7 bg-white/[0.025]">
                <div className="flex items-center justify-between border-b border-white/7 px-5 py-4">
                  <div>
                    <h2 className="font-semibold text-white">Recent activity</h2>
                    <p className="mt-1 text-xs text-zinc-500">
                      Latest sales interactions
                    </p>
                  </div>
                  <button className="text-xs text-zinc-500 hover:text-white">
                    See all
                  </button>
                </div>

                <div className="divide-y divide-white/6">
                  {activities.map((activity) => {
                    const Icon = activity.icon;

                    return (
                      <div
                        key={activity.title + activity.time}
                        className="flex items-center gap-4 px-5 py-4"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/7 bg-white/[0.03]">
                          <Icon className="h-4 w-4 text-zinc-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-zinc-200">
                            {activity.title}
                          </div>
                          <div className="mt-1 truncate text-xs text-zinc-600">
                            {activity.description}
                          </div>
                        </div>
                        <span className="shrink-0 text-[11px] text-zinc-600">
                          {activity.time}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="relative overflow-hidden rounded-2xl border border-white/7 bg-gradient-to-br from-white/[0.07] to-white/[0.015] p-6">
                <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/[0.025] blur-3xl" />

                <div className="relative">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Sales intelligence
                  </div>

                  <h2 className="mt-4 max-w-md text-2xl font-semibold tracking-tight text-white">
                    Your highest-value opportunities are concentrated in private
                    equity prospects.
                  </h2>

                  <p className="mt-3 max-w-lg text-sm leading-6 text-zinc-500">
                    7 active prospects have estimated buying capacity above
                    $250K. Three have interacted with your inventory this week.
                  </p>

                  <button className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black">
                    Review opportunities
                    <ArrowUpRight className="h-4 w-4" />
                  </button>
                </div>
              </section>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
