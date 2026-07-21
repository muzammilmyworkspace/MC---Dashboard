"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  CheckCircle2,
  Clock,
  TrendingUp,
  Eye,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Sparkles,
  Calendar,
  BadgeCheck,
  Megaphone,
  MessageSquare,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Avatar } from "@/components/ui/avatar";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { PerformanceChart, ChannelDonut, RoasLine } from "@/components/charts/charts";
import {
  kpis,
  activity,
  campaignHealth,
  upcomingMeetings,
  channelSplit,
  contentItems,
  userById,
  currentUser,
  platformMeta,
} from "@/lib/data";
import { relativeTime, formatCurrency, cn } from "@/lib/utils";

const iconMap = { check: CheckCircle2, clock: Clock, trending: TrendingUp, eye: Eye } as const;
const toneMap: Record<string, string> = {
  accent: "#8b5cf6",
  warning: "#f59e0b",
  success: "#10b981",
  info: "#3b82f6",
};

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};
const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const } },
};

export default function DashboardPage() {
  const pendingApprovals = contentItems.filter((c) => c.status === "client_review" || c.status === "internal_review");

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {/* Greeting */}
      <motion.div variants={item} className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight">
            Welcome back, {currentUser.name.split(" ")[0]} 👋
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Here&apos;s what&apos;s happening across your workspace today.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" asChild>
            <Link href="/calendar"><Calendar className="size-4" /> Calendar</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/tasks"><Plus className="size-4" /> New Task</Link>
          </Button>
        </div>
      </motion.div>

      {/* KPI cards */}
      <motion.div variants={item} className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => {
          const Icon = iconMap[k.icon as keyof typeof iconMap];
          const up = k.delta >= 0;
          const color = toneMap[k.tone];
          return (
            <Card key={k.id} className="group relative overflow-hidden p-5 transition-transform hover:-translate-y-1">
              <div
                className="absolute -right-6 -top-6 size-24 rounded-full opacity-20 blur-2xl transition-opacity group-hover:opacity-40"
                style={{ background: color }}
              />
              <div className="flex items-start justify-between">
                <div
                  className="flex size-10 items-center justify-center rounded-xl"
                  style={{ background: `${color}1f`, color }}
                >
                  <Icon className="size-5" />
                </div>
                <span
                  className={cn(
                    "flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold",
                    up ? "bg-success/15 text-success" : "bg-danger/15 text-danger"
                  )}
                >
                  {up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                  {Math.abs(k.delta)}
                  {k.suffix === "x" ? "x" : "compact" in k && k.compact ? "%" : ""}
                </span>
              </div>
              <div className="mt-4 text-3xl font-bold tracking-tight">
                <AnimatedCounter
                  value={k.value}
                  decimals={k.suffix === "x" ? 1 : 0}
                  compact={"compact" in k && k.compact}
                  suffix={k.suffix}
                />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{k.label}</p>
            </Card>
          );
        })}
      </motion.div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <motion.div variants={item} className="lg:col-span-2">
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="font-semibold tracking-tight">Weekly Performance</h3>
                <p className="text-xs text-muted-foreground">Reach & engagement · last 7 days</p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <Legend color="#8b5cf6" label="Reach" />
                <Legend color="#3b82f6" label="Engagement" />
              </div>
            </div>
            <PerformanceChart />
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card className="p-5">
            <h3 className="font-semibold tracking-tight">Channel Split</h3>
            <p className="text-xs text-muted-foreground">Share of total reach</p>
            <ChannelDonut />
            <div className="mt-2 grid grid-cols-2 gap-2">
              {channelSplit.map((c) => (
                <div key={c.name} className="flex items-center gap-2 text-xs">
                  <span className="size-2.5 rounded-full" style={{ background: c.color }} />
                  <span className="text-muted-foreground">{c.name}</span>
                  <span className="ml-auto font-medium">{c.value}%</span>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Middle row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Campaign health */}
        <motion.div variants={item} className="lg:col-span-2">
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="font-semibold tracking-tight">Campaign Health</h3>
                <p className="text-xs text-muted-foreground">Live spend vs. budget</p>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/meta-ads">View all <ArrowUpRight className="size-3.5" /></Link>
              </Button>
            </div>
            <div className="space-y-4">
              {campaignHealth.map((c) => {
                const pct = Math.round((c.spend / c.budget) * 100);
                const tone = c.status === "healthy" ? "success" : c.status === "watch" ? "warning" : "danger";
                const toneHex = tone === "success" ? "#10b981" : tone === "warning" ? "#f59e0b" : "#ef4444";
                return (
                  <div key={c.name} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <Megaphone className="size-4 text-muted-foreground" />
                        <span className="font-medium">{c.name}</span>
                        <Badge variant={tone as "success" | "warning" | "danger"} className="capitalize">{c.status}</Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">{c.roas}x ROAS</span>
                        <span>{formatCurrency(c.spend)} / {formatCurrency(c.budget)}</span>
                      </div>
                    </div>
                    <Progress value={pct} color={toneHex} />
                  </div>
                );
              })}
            </div>
          </Card>
        </motion.div>

        {/* ROAS trend + quick actions */}
        <motion.div variants={item} className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold tracking-tight">ROAS Trend</h3>
                <p className="text-xs text-muted-foreground">7-month blended</p>
              </div>
              <Badge variant="success"><TrendingUp className="size-3" /> +75%</Badge>
            </div>
            <div className="mt-2"><RoasLine /></div>
          </Card>
        </motion.div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Activity feed */}
        <motion.div variants={item} className="lg:col-span-2">
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold tracking-tight">Recent Activity</h3>
              <Badge variant="secondary"><Sparkles className="size-3" /> Live</Badge>
            </div>
            <div className="relative space-y-4 before:absolute before:left-[15px] before:top-2 before:h-[calc(100%-1rem)] before:w-px before:bg-border">
              {activity.map((a) => {
                const u = userById(a.user);
                return (
                  <div key={a.id} className="relative flex gap-3">
                    <div className="z-10">
                      <Avatar name={u.name} color={u.avatarColor} size={32} />
                    </div>
                    <div className="flex-1 pt-0.5">
                      <p className="text-sm">
                        <span className="font-medium">{u.name}</span>{" "}
                        <span className="text-muted-foreground">{a.action}</span>{" "}
                        <span className="font-medium">{a.target}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">{relativeTime(a.at)}</p>
                    </div>
                    <ActivityIcon type={a.type} />
                  </div>
                );
              })}
            </div>
          </Card>
        </motion.div>

        {/* Right: approvals + meetings */}
        <motion.div variants={item} className="space-y-4">
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold tracking-tight">Pending Approvals</h3>
              <Badge variant="warning">{pendingApprovals.length}</Badge>
            </div>
            <div className="space-y-2.5">
              {pendingApprovals.slice(0, 3).map((c) => (
                <Link
                  key={c.id}
                  href="/approvals"
                  className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-2.5 transition-colors hover:border-accent/40"
                >
                  <div
                    className="flex size-9 items-center justify-center rounded-lg text-lg"
                    style={{ background: c.gradient }}
                  >
                    {c.emoji}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.title}</p>
                    <p className="text-xs text-muted-foreground">{platformMeta[c.platform].label}</p>
                  </div>
                  <BadgeCheck className="size-4 text-accent" />
                </Link>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="mb-3 font-semibold tracking-tight">Upcoming</h3>
            <div className="space-y-3">
              {upcomingMeetings.map((m) => (
                <div key={m.id} className="flex items-start gap-3">
                  <div className="flex size-10 flex-col items-center justify-center rounded-lg border border-border bg-muted/40 text-center">
                    <span className="text-[10px] uppercase text-muted-foreground">
                      {new Date(m.time).toLocaleDateString("en-US", { month: "short" })}
                    </span>
                    <span className="text-sm font-bold leading-none">{new Date(m.time).getDate()}</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{m.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(m.time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-muted-foreground">
      <span className="size-2.5 rounded-full" style={{ background: color }} />
      {label}
    </div>
  );
}

function ActivityIcon({ type }: { type: string }) {
  const map: Record<string, { icon: typeof BadgeCheck; color: string }> = {
    approval: { icon: BadgeCheck, color: "#10b981" },
    task: { icon: CheckCircle2, color: "#3b82f6" },
    comment: { icon: MessageSquare, color: "#8b5cf6" },
    campaign: { icon: Megaphone, color: "#f59e0b" },
    content: { icon: Sparkles, color: "#8b5cf6" },
  };
  const { icon: Icon, color } = map[type] ?? map.task;
  return (
    <div className="flex size-7 shrink-0 items-center justify-center rounded-lg" style={{ background: `${color}1f`, color }}>
      <Icon className="size-3.5" />
    </div>
  );
}
