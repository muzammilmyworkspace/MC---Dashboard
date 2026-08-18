"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Megaphone, AlertTriangle, RefreshCw } from "lucide-react";
import {
  api, ApiRequestError,
  type AdAccount, type AdCampaign, type AdDatePreset, type AdInsights, type AdsAvailability,
} from "@/lib/api";
import { MetricCard } from "@/components/analytics/metric-card";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/ui/status-dot";
import { EmptyState } from "@/components/ui/page-shell";
import { cn } from "@/lib/utils";

/** Meta's ad API works in fixed presets, so the picker matches them exactly. */
const PRESETS: { key: AdDatePreset; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "last_7d", label: "Last 7 days" },
  { key: "last_30d", label: "Last 30 days" },
];

export default function MetaAdsPage() {
  const [availability, setAvailability] = useState<AdsAvailability | null>(null);
  const [account, setAccount] = useState<AdAccount | null>(null);
  const [preset, setPreset] = useState<AdDatePreset>("last_30d");
  const [insights, setInsights] = useState<AdInsights | null>(null);
  const [campaigns, setCampaigns] = useState<AdCampaign[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const a = await api.integrations.adAccounts().catch(() => null);
      if (cancelled) return;
      setAvailability(a);
      if (a?.available && a.accounts.length) setAccount((prev) => prev ?? a.accounts[0]);
    })();
    return () => { cancelled = true; };
  }, [reload]);

  /**
   * Data is tagged with the account+period it belongs to, so "is this stale?"
   * is derived rather than cleared up front — clearing synchronously in the
   * effect body is what triggers the cascading-render warning.
   */
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const requestKey = account ? `${account.id}:${preset}:${reload}` : null;
  const stale = requestKey !== null && loadedFor !== requestKey;

  useEffect(() => {
    if (!account || !requestKey) return;
    let cancelled = false;

    void (async () => {
      try {
        const [i, c] = await Promise.all([
          api.integrations.adInsights(account.id, preset),
          api.integrations.adCampaigns(account.id, preset),
        ]);
        if (cancelled) return;
        setInsights(i.insights);
        setCampaigns(c.campaigns);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof ApiRequestError ? err.message : "Couldn't load ad data.");
        setCampaigns([]);
      } finally {
        if (!cancelled) setLoadedFor(requestKey);
      }
    })();
    return () => { cancelled = true; };
  }, [account, preset, requestKey]);

  const currency = account?.currency ?? "";
  const money = (v: number | null) =>
    v === null ? null : `${currency ? currency + " " : ""}${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-semibold tracking-tight">Meta Ads</h2>
            {availability && (
              <StatusDot
                state={availability.available ? "connected" : "disconnected"}
                label={availability.available ? "Connected" : "Not connected"}
              />
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            How your advertising is performing. Source: Meta Marketing API.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setReload((n) => n + 1)}>
          <RefreshCw className="size-4" /> Refresh
        </Button>
      </div>

      {availability && !availability.available && (
        <Card className="flex items-start gap-3 border-warning/30 bg-warning/[0.06] p-4">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
          <div>
            <p className="text-sm font-medium">Meta Ads needs attention</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{availability.reason}</p>
          </div>
        </Card>
      )}

      {availability?.available && (
        <>
          {/* Account + period */}
          <div className="flex flex-wrap items-center gap-2">
            {availability.accounts.map((a) => (
              <button
                key={a.id}
                onClick={() => setAccount(a)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors",
                  account?.id === a.id
                    ? "border-accent/40 bg-accent-soft text-accent"
                    : "border-border text-muted-foreground hover:border-accent/30 hover:text-foreground"
                )}
              >
                {a.name}
                <span className="ml-2 text-[11px] opacity-70">{a.statusLabel}</span>
              </button>
            ))}
            <div className="ml-auto flex items-center rounded-lg border border-border bg-card p-0.5">
              {PRESETS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPreset(p.key)}
                  className={cn(
                    "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                    preset === p.key ? "bg-accent text-white" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <Card className="flex items-start gap-3 border-danger/30 bg-danger/[0.06] p-4">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
              <p className="text-sm text-muted-foreground">{error}</p>
            </Card>
          )}

          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <MetricCard
              label="Spend" value={money(insights?.spend ?? null)} loading={stale || !insights}
              help="Total amount spent on ads in this period."
            />
            <MetricCard
              label="Reach" value={insights?.reach ?? null} loading={stale || !insights}
              help="How many different people saw your ads. Each person counted once."
            />
            <MetricCard
              label="Impressions" value={insights?.impressions ?? null} loading={stale || !insights}
              help="How many times your ads were shown in total, including repeat views."
            />
            <MetricCard
              label="Clicks" value={insights?.clicks ?? null} loading={stale || !insights}
              help="How many times people clicked your ads."
            />
            <MetricCard
              label="Conversions" value={insights?.conversions ?? null} loading={stale || !insights}
              help="Purchases or leads Meta attributed to these ads."
              unavailable="No conversion tracking set up"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <MetricCard
              label="CTR" value={insights?.ctr != null ? insights.ctr.toFixed(2) : null} suffix="%"
              loading={stale || !insights}
              help="Click-through rate — the share of people who clicked after seeing an ad. Higher is better."
            />
            <MetricCard
              label="Cost per click" value={money(insights?.cpc ?? null)} loading={stale || !insights} inverse
              help="Average amount you paid for each click. Lower is better."
            />
            <MetricCard
              label="Cost per 1,000 views" value={money(insights?.cpm ?? null)} loading={stale || !insights} inverse
              help="Average cost to show your ad 1,000 times. Lower is better."
            />
            <MetricCard
              label="Conversion value" value={money(insights?.purchaseValue ?? null)} loading={stale || !insights}
              help="Total value of the purchases attributed to these ads."
              unavailable="No purchase value tracked"
            />
            <MetricCard
              label="ROAS" value={insights?.roas != null ? insights.roas.toFixed(2) : null} suffix="×"
              loading={stale || !insights}
              help="Return on ad spend — money earned for every 1 spent. Above 1 means the ads made more than they cost."
              unavailable="Needs purchase tracking"
            />
          </div>

          {/* Plain-language summary, generated from the actual figures. */}
          {!stale && insights && insights.spend !== null && <AdSummary insights={insights} currency={currency} />}

          {/* Campaigns */}
          <Card className="overflow-hidden">
            <div className="border-b border-border px-5 py-4">
              <h3 className="text-sm font-semibold">Campaigns</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Campaigns with no figures had no activity in this period.
              </p>
            </div>

            {stale || campaigns === null ? (
              <div className="h-40 animate-pulse bg-muted/40" />
            ) : campaigns.length === 0 ? (
              <EmptyState
                icon={Megaphone} title="No campaigns"
                description="This ad account has no campaigns yet."
                className="border-0 bg-transparent py-10"
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      {["Campaign", "Status", "Spend", "Reach", "Clicks", "CTR", "Cost/click", "Conversions"].map((h) => (
                        <th key={h} className="px-5 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.map((c) => (
                      <tr key={c.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                        <td className="max-w-[260px] truncate px-5 py-3 font-medium">{c.name}</td>
                        <td className="px-5 py-3">
                          <StatusDot
                            state={c.status === "ACTIVE" ? "connected" : "disconnected"}
                            label={c.status === "ACTIVE" ? "Active" : c.status.toLowerCase()}
                          />
                        </td>
                        <Num v={c.insights.spend} fmt={money} />
                        <Num v={c.insights.reach} />
                        <Num v={c.insights.clicks} />
                        <Num v={c.insights.ctr} fmt={(x) => (x === null ? null : `${x.toFixed(2)}%`)} />
                        <Num v={c.insights.cpc} fmt={money} />
                        <Num v={c.insights.conversions} />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {availability === null && <Card className="h-40 animate-pulse bg-muted/40" />}
    </motion.div>
  );
}

function Num({ v, fmt }: { v: number | null; fmt?: (n: number | null) => string | null }) {
  const text = fmt ? fmt(v) : v === null ? null : v.toLocaleString();
  return (
    <td className={cn("px-5 py-3 tabular-nums", text === null && "text-muted-foreground/40")}>
      {text ?? "—"}
    </td>
  );
}

/** Written from the real numbers — nothing here is a fixed sentence. */
function AdSummary({ insights, currency }: { insights: AdInsights; currency: string }) {
  const parts: string[] = [];
  const money = (v: number) => `${currency ? currency + " " : ""}${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

  if (insights.spend !== null) {
    parts.push(`Your campaigns spent ${money(insights.spend)} in this period`);
    if (insights.reach !== null) parts.push(`reaching ${insights.reach.toLocaleString()} people`);
    if (insights.clicks !== null) parts.push(`with ${insights.clicks.toLocaleString()} clicks`);
  }

  let second = "";
  if (insights.conversions !== null && insights.conversions > 0) {
    second = `That produced ${insights.conversions.toLocaleString()} conversion${insights.conversions === 1 ? "" : "s"}`;
    if (insights.roas !== null) {
      second += insights.roas >= 1
        ? `, earning ${insights.roas.toFixed(2)}× what you spent.`
        : `, currently returning ${insights.roas.toFixed(2)}× your spend.`;
    } else second += ".";
  } else if (insights.conversions === null) {
    second = "Conversion tracking isn't set up for this account, so purchases and return on spend can't be shown.";
  }

  return (
    <Card className="p-5">
      <h3 className="text-sm font-semibold">In plain terms</h3>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        {parts.join(", ")}.{second ? ` ${second}` : ""}
      </p>
    </Card>
  );
}
