"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  ArrowRight, ArrowUpRight, ArrowDownRight, Plug, Activity,
  AlertTriangle, RefreshCw, Users, Eye, Clock,
} from "lucide-react";
import { platformModules } from "@/lib/modules-registry";
import { usePlatformStatus } from "@/lib/platform-status";
import { api, apiConfigProblem, type IgOverview } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/ui/status-dot";
import { cn, relativeTime } from "@/lib/utils";

export default function DashboardPage() {
  const { statusFor, reachable, loading } = usePlatformStatus();
  const [ig, setIg] = useState<IgOverview | null>(null);
  const [igLoading, setIgLoading] = useState(true);

  /* The one platform with live data. Everything shown below is measured. */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const data = await api.instagram.overview(30).catch(() => null);
      if (cancelled) return;
      setIg(data);
      setIgLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const statuses = platformModules.map((m) => ({ mod: m, status: statusFor(m.integrationKey) }));
  const connected = statuses.filter((s) => s.status.state === "connected");
  const pending = statuses.filter((s) => s.status.state !== "connected");

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-7"
    >
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[22px] font-semibold tracking-tight">Overview</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {loading
              ? "Checking connections…"
              : `${connected.length} of ${platformModules.length} platforms connected`}
          </p>
        </div>
        {ig?.lastSyncAt && (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="size-3.5" /> Synced {relativeTime(ig.lastSyncAt)}
          </span>
        )}
      </div>

      {!reachable && (
        <Card className="flex items-start gap-3 border-warning/30 bg-warning/[0.06] p-4">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
          <div>
            <p className="text-sm font-medium">Can&apos;t reach the API</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {/* On a deployed site this is nearly always a missing env var,
                  not a stopped server. Naming it saves chasing the wrong thing. */}
              {apiConfigProblem() ??
                "Start the backend, then reload. Connection status and metrics are unavailable."}
            </p>
          </div>
        </Card>
      )}

      {/* Live platform spotlight */}
      {igLoading ? (
        <Card className="h-56 animate-pulse bg-muted/40" />
      ) : ig?.configured && ig.latest ? (
        <InstagramSpotlight data={ig} />
      ) : null}

      {/* Platforms */}
      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Platforms</h3>
            <p className="text-xs text-muted-foreground">Open a platform to manage its connection and data.</p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/integrations"><Plug className="size-4" /> Integrations</Link>
          </Button>
        </div>

        {connected.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {connected.map(({ mod, status }) => (
              <PlatformCard key={mod.href} mod={mod} status={status} highlighted />
            ))}
          </div>
        )}

        {pending.length > 0 && (
          <>
            {connected.length > 0 && (
              <p className="pt-2 text-[11px] uppercase tracking-wider text-muted-foreground">Not connected</p>
            )}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {pending.map(({ mod, status }) => (
                <PlatformCard key={mod.href} mod={mod} status={status} />
              ))}
            </div>
          </>
        )}
      </section>

      {/* Activity */}
      <Card className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Recent activity</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">Syncs and connection changes.</p>
          </div>
        </div>

        {ig?.lastSyncAt ? (
          <ul className="mt-4 divide-y divide-border">
            <li className="flex items-center gap-3 py-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
                <RefreshCw className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium">Instagram synced</p>
                <p className="text-xs text-muted-foreground">
                  {ig.latest?.followers?.toLocaleString()} followers recorded
                </p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">{relativeTime(ig.lastSyncAt)}</span>
            </li>
          </ul>
        ) : (
          <div className="mt-4 flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-10 text-center">
            <Activity className="mb-2 size-5 text-muted-foreground/60" />
            <p className="text-sm font-medium">No activity yet</p>
            <p className="mt-0.5 max-w-xs text-xs text-muted-foreground">
              Connect a platform and syncs will be recorded here.
            </p>
          </div>
        )}
      </Card>
    </motion.div>
  );
}

/* ---------------------------- Instagram spotlight ------------------------- */

function InstagramSpotlight({ data }: { data: IgOverview }) {
  const followers = data.latest?.followers ?? null;
  const net = data.totals?.net ?? 0;
  const reach = data.totals?.reach ?? 0;
  const profileViews = data.totals?.profileViews ?? 0;

  // Reach is the dense series — 31 unbroken days, so it reads as a trend.
  // Follower totals only exist for days we snapshotted ourselves.
  const series = data.history
    .filter((d) => d.reach !== null)
    .map((d) => ({ date: d.date, reach: d.reach ?? 0 }));

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border p-5">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl border border-border bg-muted/40 text-accent">
            <Users className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h3 className="text-sm font-semibold">Instagram</h3>
              <StatusDot state="connected" label="Connected" />
            </div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </div>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/instagram">Open <ArrowRight className="size-3.5" /></Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 divide-border sm:grid-cols-4 sm:divide-x">
        <Metric label="Followers" value={followers} delta={net} />
        <Metric label="Reach" value={reach} icon={Eye} />
        <Metric label="Profile views" value={profileViews} icon={Eye} />
        <Metric label="Days tracked" value={series.length} />
      </div>

      {series.length > 1 && (
        <div className="border-t border-border px-2 pb-2 pt-4">
          <p className="px-3 text-[11px] uppercase tracking-wider text-muted-foreground">Daily reach</p>
          <ResponsiveContainer width="100%" height={120}>
            <AreaChart data={series} margin={{ top: 10, right: 12, left: 12, bottom: 0 }}>
              <defs>
                <linearGradient id="dashReach" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" hide />
              <YAxis hide domain={[0, "dataMax"]} />
              <Tooltip
                cursor={{ stroke: "var(--accent)", strokeWidth: 1, strokeDasharray: "3 3" }}
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  fontSize: 12,
                  color: "var(--popover-foreground)",
                }}
                labelFormatter={(l) =>
                  new Date(String(l)).toLocaleDateString(undefined, { day: "numeric", month: "short" })
                }
                formatter={(v) => [Number(v).toLocaleString(), "Reach"]}
              />
              <Area
                type="monotone"
                dataKey="reach"
                stroke="var(--accent)"
                strokeWidth={2}
                fill="url(#dashReach)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

function Metric({
  label, value, delta, icon: Icon,
}: {
  label: string; value: number | null; delta?: number; icon?: React.ElementType;
}) {
  const showDelta = delta !== undefined && delta !== 0;
  const up = (delta ?? 0) > 0;
  return (
    <div className="p-5">
      <div className="flex items-center gap-1.5">
        {Icon && <Icon className="size-3.5 text-muted-foreground" />}
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      </div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <p className="text-[26px] font-semibold leading-none tabular-nums">
          {value === null ? "—" : value.toLocaleString()}
        </p>
        {showDelta && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-xs font-medium",
              up ? "text-success" : "text-danger"
            )}
          >
            {up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
            {Math.abs(delta ?? 0).toLocaleString()}
          </span>
        )}
      </div>
    </div>
  );
}

/* ------------------------------ Platform card ----------------------------- */

function PlatformCard({
  mod, status, highlighted,
}: {
  mod: (typeof platformModules)[number];
  status: ReturnType<ReturnType<typeof usePlatformStatus>["statusFor"]>;
  highlighted?: boolean;
}) {
  return (
    <Link
      href={mod.href}
      className={cn(
        "group rounded-xl border bg-card p-4 transition-colors",
        highlighted ? "border-success/30 hover:border-success/50" : "border-border hover:border-accent/40"
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/40 transition-colors",
            highlighted ? "border-success/25 text-success" : "border-border text-muted-foreground group-hover:text-accent"
          )}
        >
          <mod.icon className="size-[18px]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-tight">{mod.name}</p>
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{mod.description}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
        <StatusDot state={status.state} label={status.label} />
        <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors group-hover:text-accent">
          Open <ArrowRight className="size-3.5" />
        </span>
      </div>
    </Link>
  );
}
