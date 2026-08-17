"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  BadgeCheck, CheckCircle2, Eye, ArrowUpRight, ArrowDownRight, ArrowRight,
  Sparkles, Gauge, Globe, ServerCog, Mail,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { PerformanceChart } from "@/components/charts/charts";
import {
  activity, platformWidgets, apiConnections,
  userById, users, currentUser,
  type PlatformWidget, type ApiConnection,
} from "@/lib/data";
import { usePosting } from "@/lib/posting";
import { useUI } from "@/lib/store";
import { relativeTime, formatDate, cn } from "@/lib/utils";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const } } };

export default function DashboardPage() {
  const { viewAs } = useUI();
  const me = users.find((u) => u.role === viewAs) ?? currentUser;

  // Content stats come from what the team has actually planned.
  const days = usePosting((s) => s.days);
  const now = new Date();
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  const monthEntries = Object.entries(days).filter(([date, blocks]) => date.startsWith(monthPrefix) && blocks.length > 0);
  const total = monthEntries.reduce((n, [, blocks]) => n + blocks.length, 0);
  const daysCovered = monthEntries.length;
  const withMedia = monthEntries.reduce(
    (n, [, blocks]) => n + blocks.filter((b) => b.postMedia.length > 0 || b.reelMedia).length,
    0
  );
  const withCopy = monthEntries.reduce(
    (n, [, blocks]) => n + blocks.filter((b) => Object.values(b.content).some((c) => c.caption.trim())).length,
    0
  );
  const completion = Math.round((daysCovered / daysInMonth) * 100);

  const upcoming = monthEntries
    .filter(([date]) => date >= `${monthPrefix}-${String(now.getDate()).padStart(2, "0")}`)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, 5);
  const connected = apiConnections.filter((a) => a.connected).length;

  const kpiCards = [
    { label: "Business Health", value: 94, suffix: "%", delta: 3, icon: Gauge, tone: "#2456d6" },
    { label: "Month Planned", value: completion, suffix: "%", delta: 8, icon: CheckCircle2, tone: "#16a34a" },
    { label: "Posts Planned", value: total, suffix: "", delta: 0, icon: BadgeCheck, tone: "#d97706" },
    { label: "Reach (30d)", value: 312000, suffix: "", delta: 18, icon: Eye, tone: "#2456d6", compact: true },
  ];

  const health = [
    { label: "Campaign Health", score: 88, icon: Gauge, note: "4 active · ROAS 4.2x" },
    { label: "Website Health", score: 96, icon: Globe, note: "LCP 1.8s · 99.9% uptime" },
    { label: "System Health", score: 99, icon: ServerCog, note: "All services operational" },
    { label: "Workspace", score: 100, icon: Mail, note: "12 users · 78% storage" },
  ];

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {/* Greeting */}
      <motion.div variants={item}>
        <p className="text-sm text-muted-foreground">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
        <h2 className="mt-1 text-[28px] font-semibold tracking-tight">Welcome back, {me.name}</h2>
        <p className="mt-1 text-sm text-muted-foreground">Business at a glance — every channel, campaign and approval in one calm view.</p>
      </motion.div>

      {/* Headline KPIs */}
      <motion.div variants={item} className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {kpiCards.map((k) => {
          const up = k.delta >= 0;
          return (
            <Card key={k.label} className="relative overflow-hidden p-5 transition-shadow hover:shadow-glow">
              <div className="flex items-start justify-between">
                <div className="flex size-10 items-center justify-center rounded-xl" style={{ background: `${k.tone}14`, color: k.tone }}><k.icon className="size-5" /></div>
                <span className={cn("flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium", up ? "bg-success/10 text-success" : "bg-danger/10 text-danger")}>
                  {up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}{Math.abs(k.delta)}{k.suffix === "%" ? "%" : ""}
                </span>
              </div>
              <div className="mt-4 text-[28px] font-semibold tracking-tight"><AnimatedCounter value={k.value} compact={"compact" in k && k.compact} suffix={k.suffix} /></div>
              <p className="mt-1 text-sm text-muted-foreground">{k.label}</p>
            </Card>
          );
        })}
      </motion.div>

      {/* Performance + health scores + content progress */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <motion.div variants={item} className="lg:col-span-2">
          <Card className="h-full p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="font-semibold tracking-tight">Marketing Performance</h3>
                <p className="text-xs text-muted-foreground">Reach & engagement · last 7 days</p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <Legend color="#2456d6" label="Reach" /><Legend color="#7aa2f0" label="Engagement" />
              </div>
            </div>
            <PerformanceChart />
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card className="flex h-full flex-col p-5">
            <h3 className="font-semibold tracking-tight">Content Progress</h3>
            <p className="text-xs text-muted-foreground">{total} pieces this month</p>
            <div className="mt-4 flex items-center gap-4">
              <ScoreRing value={completion} />
              <div className="flex-1 space-y-2 text-sm">
                <ProgressRow label="Days" value={daysCovered} total={daysInMonth} color="#2456d6" />
                <ProgressRow label="Posts" value={total} total={Math.max(total, daysInMonth)} color="#0f172a" />
                <ProgressRow label="Written" value={withCopy} total={Math.max(total, 1)} color="#16a34a" />
                <ProgressRow label="Media" value={withMedia} total={Math.max(total, 1)} color="#d97706" />
              </div>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Health score mini-cards */}
      <motion.div variants={item} className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {health.map((h) => (
          <Card key={h.label} className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium"><h.icon className="size-4 text-muted-foreground" /> {h.label}</div>
              <span className={cn("text-sm font-semibold", h.score >= 95 ? "text-success" : h.score >= 80 ? "text-accent" : "text-warning")}>{h.score}</span>
            </div>
            <Progress value={h.score} className="mt-3" color={h.score >= 95 ? "#16a34a" : h.score >= 80 ? "#2456d6" : "#d97706"} />
            <p className="mt-2 text-xs text-muted-foreground">{h.note}</p>
          </Card>
        ))}
      </motion.div>

      {/* Platform snapshots */}
      <motion.div variants={item}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold tracking-tight">Platform Snapshots</h3>
          <span className="text-sm text-muted-foreground">Live overview</span>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {platformWidgets.map((w) => <PlatformCard key={w.key} w={w} />)}
        </div>
      </motion.div>

      {/* Connections + awaiting + activity */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <motion.div variants={item}>
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="font-semibold tracking-tight">Platform Connections</h3>
                <p className="text-xs text-muted-foreground">{connected}/{apiConnections.length} connected</p>
              </div>
              <Button variant="ghost" size="sm" asChild><Link href="/integrations">Manage <ArrowRight className="size-3.5" /></Link></Button>
            </div>
            <div className="space-y-0.5">{apiConnections.slice(0, 7).map((a) => <ConnectionRow key={a.name} a={a} />)}</div>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="font-semibold tracking-tight">Upcoming Posts</h3>
                <p className="text-xs text-muted-foreground">Planned for the days ahead</p>
              </div>
              <Button variant="ghost" size="sm" asChild><Link href="/calendar">Open <ArrowRight className="size-3.5" /></Link></Button>
            </div>
            <div className="space-y-2">
              {upcoming.length === 0 && (
                <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
                  <p className="text-sm font-medium">Nothing planned yet</p>
                  <p className="mt-1 text-xs text-muted-foreground">Add your first post in Social Media Posting.</p>
                  <Button size="sm" className="mt-3" asChild><Link href="/calendar">Plan a post</Link></Button>
                </div>
              )}
              {upcoming.map(([date, blocks]) => (
                <Link key={date} href="/calendar" className="group flex items-center gap-3 rounded-xl border border-border bg-muted/20 p-2.5 transition-all hover:border-accent/40 hover:bg-card">
                  <div className="flex size-9 flex-col items-center justify-center rounded-lg border border-border bg-card">
                    <span className="text-sm font-semibold leading-none">{Number(date.slice(-2))}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{formatDate(date, { weekday: "short" })}</p>
                    <p className="text-xs text-muted-foreground">{blocks.length} post{blocks.length > 1 ? "s" : ""} planned</p>
                  </div>
                  <ArrowRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              ))}
            </div>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold tracking-tight">Recent Activity</h3>
              <Badge variant="secondary"><Sparkles className="size-3" /> Live</Badge>
            </div>
            <div className="relative space-y-4 before:absolute before:left-[15px] before:top-2 before:h-[calc(100%-1rem)] before:w-px before:bg-border">
              {activity.slice(0, 5).map((a) => {
                const u = userById(a.user);
                return (
                  <div key={a.id} className="relative flex gap-3">
                    <div className="z-10"><Avatar name={u.name} color={u.avatarColor} size={28} /></div>
                    <div className="flex-1 pt-0.5">
                      <p className="text-sm leading-snug"><span className="font-medium">{u.name}</span> <span className="text-muted-foreground">{a.action}</span> <span className="font-medium">{a.target}</span></p>
                      <p className="text-xs text-muted-foreground">{relativeTime(a.at)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}

function PlatformCard({ w }: { w: PlatformWidget }) {
  return (
    <Card className="flex flex-col p-5 transition-all hover:-translate-y-0.5 hover:shadow-glow">
      <div className="mb-4 flex items-center gap-2.5">
        <div className="flex size-9 items-center justify-center rounded-lg text-lg" style={{ background: `${w.accent}14` }}>{w.emoji}</div>
        <div className="flex-1">
          <p className="text-sm font-semibold leading-tight">{w.name}</p>
          {w.status && <p className="text-[11px] text-success">● {w.status}</p>}
        </div>
      </div>
      <div className="grid flex-1 grid-cols-2 gap-x-4 gap-y-3">
        {w.stats.map((s) => (
          <div key={s.label}>
            <p className="text-[11px] text-muted-foreground">{s.label}</p>
            <p className="mt-0.5 flex items-center gap-1 text-sm font-semibold">
              {s.value}{s.delta && <span className={cn("text-[10px] font-medium", s.delta.startsWith("-") ? "text-danger" : "text-success")}>{s.delta}</span>}
            </p>
          </div>
        ))}
      </div>
      <Button variant="secondary" size="sm" className="mt-4 w-full" asChild><Link href={w.href}>{w.action} <ArrowUpRight className="size-3.5" /></Link></Button>
    </Card>
  );
}

function ConnectionRow({ a }: { a: ApiConnection }) {
  const healthColor = a.health === "healthy" ? "text-success" : a.health === "degraded" ? "text-warning" : a.health === "down" ? "text-danger" : "text-muted-foreground";
  return (
    <div className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/50">
      <span className={cn("size-2 shrink-0 rounded-full", a.connected ? "bg-success" : "bg-muted-foreground/40")} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{a.name}</p>
        <p className="text-[11px] text-muted-foreground">{a.connected ? `Synced ${a.lastSync}` : "Not connected"}</p>
      </div>
      <span className={cn("text-[11px] font-medium capitalize", healthColor)}>{a.health}</span>
    </div>
  );
}

function ScoreRing({ value }: { value: number }) {
  const r = 30, c = 2 * Math.PI * r, off = c - (value / 100) * c;
  return (
    <div className="relative flex size-[84px] shrink-0 items-center justify-center">
      <svg width={84} height={84} className="-rotate-90">
        <circle cx={42} cy={42} r={r} fill="none" stroke="var(--muted)" strokeWidth={7} />
        <circle cx={42} cy={42} r={r} fill="none" stroke="var(--accent)" strokeWidth={7} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} />
      </svg>
      <span className="absolute text-sm font-semibold">{value}%</span>
    </div>
  );
}
function ProgressRow({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-xs text-muted-foreground">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${(value / total) * 100}%`, background: color }} /></div>
      <span className="w-5 shrink-0 text-right text-xs font-medium">{value}</span>
    </div>
  );
}
function Legend({ color, label }: { color: string; label: string }) {
  return <div className="flex items-center gap-1.5 text-muted-foreground"><span className="size-2.5 rounded-full" style={{ background: color }} />{label}</div>;
}
