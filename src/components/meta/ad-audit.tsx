"use client";

import { useMemo, useState } from "react";
import { Image as ImageIcon, Layers, Megaphone, PlayCircle, Search, SquareStack, ExternalLink } from "lucide-react";
import type { Ad, AdCampaign, AdCreative, AdMediaType, AdSet } from "@/lib/api";
import { MetricCard } from "@/components/analytics/metric-card";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusDot } from "@/components/ui/status-dot";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/page-shell";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ *
 *  Ad Audit — every ad set and every ad copy in the account, so a full
 *  audit doesn't require opening Ads Manager: which ad sets exist, how
 *  many images vs. reels are running, and — the point of an audit —
 *  which specific ad copy produced which sales.
 * ------------------------------------------------------------------ */

const MEDIA_META: Record<AdMediaType, { label: string; icon: typeof ImageIcon }> = {
  IMAGE: { label: "Image", icon: ImageIcon },
  VIDEO: { label: "Video / Reel", icon: PlayCircle },
  CAROUSEL: { label: "Carousel", icon: SquareStack },
  UNKNOWN: { label: "Unknown", icon: Layers },
};

type MediaFilter = "ALL" | AdMediaType;

export function AdAudit({
  numericAccountId,
  currency,
  loading,
  campaigns,
  adSets,
  ads,
}: {
  numericAccountId: string;
  currency: string;
  loading: boolean;
  campaigns: AdCampaign[];
  adSets: AdSet[];
  ads: Ad[];
}) {
  const [query, setQuery] = useState("");
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>("ALL");
  const [detailAd, setDetailAd] = useState<Ad | null>(null);

  const campaignName = useMemo(() => new Map(campaigns.map((c) => [c.id, c.name])), [campaigns]);
  const adSetName = useMemo(() => new Map(adSets.map((s) => [s.id, s.name])), [adSets]);
  const adsPerAdSet = useMemo(() => {
    const counts = new Map<string, number>();
    for (const ad of ads) counts.set(ad.adsetId, (counts.get(ad.adsetId) ?? 0) + 1);
    return counts;
  }, [ads]);

  const counts = useMemo(() => {
    const byType = { IMAGE: 0, VIDEO: 0, CAROUSEL: 0, UNKNOWN: 0 } as Record<AdMediaType, number>;
    for (const ad of ads) byType[ad.creative?.mediaType ?? "UNKNOWN"]++;
    return { adSets: adSets.length, ads: ads.length, ...byType };
  }, [ads, adSets]);

  const money = (v: number | null) =>
    v === null ? null : `${currency ? currency + " " : ""}${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

  const filteredAds = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ads.filter((ad) => {
      if (mediaFilter !== "ALL" && (ad.creative?.mediaType ?? "UNKNOWN") !== mediaFilter) return false;
      if (!q) return true;
      const haystack = `${ad.name} ${ad.creative?.title ?? ""} ${ad.creative?.bodyText ?? ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [ads, query, mediaFilter]);

  return (
    <div className="space-y-6">
      {/* Audit summary — every ad set and every ad copy, at a glance */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <MetricCard label="Ad sets" value={counts.adSets} loading={loading} help="How many ad sets are running in this account." />
        <MetricCard label="Ad copies" value={counts.ads} loading={loading} help="Every individual ad — one row per creative." />
        <MetricCard label="Images" value={counts.IMAGE} loading={loading} help="Ad copies running a single static image." />
        <MetricCard label="Videos / Reels" value={counts.VIDEO} loading={loading} help="Ad copies running a video or Reel." />
        <MetricCard label="Carousels" value={counts.CAROUSEL} loading={loading} help="Ad copies running a multi-card carousel." />
      </div>

      {/* Ad sets */}
      <Card className="overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h3 className="text-sm font-semibold">Ad sets</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">Every ad set in this account, grouped under its campaign.</p>
        </div>
        {loading ? (
          <div className="h-32 animate-pulse bg-muted/40" />
        ) : adSets.length === 0 ? (
          <EmptyState icon={Layers} title="No ad sets" description="This account has no ad sets yet." className="border-0 bg-transparent py-10" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  {["Ad set", "Campaign", "Ads", "Status", "Spend", "Purchases", "Purchase value", "ROAS"].map((h) => (
                    <th key={h} className="px-5 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {adSets.map((s) => (
                  <tr key={s.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                    <td className="max-w-[240px] truncate px-5 py-3 font-medium">{s.name}</td>
                    <td className="max-w-[200px] truncate px-5 py-3 text-muted-foreground">{campaignName.get(s.campaignId) ?? "—"}</td>
                    <NumCell v={adsPerAdSet.get(s.id) ?? 0} />
                    <td className="px-5 py-3">
                      <StatusDot state={s.status === "ACTIVE" ? "connected" : "disconnected"} label={s.status.toLowerCase()} />
                    </td>
                    <NumCell v={s.insights.spend} fmt={money} />
                    <NumCell v={s.insights.conversions} />
                    <NumCell v={s.insights.purchaseValue} fmt={money} />
                    <NumCell v={s.insights.roas} fmt={(x) => (x === null ? null : `${x.toFixed(2)}×`)} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Ad copies */}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold">Ad copies</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">Every ad, its creative and the sales it produced.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search ad copy…" className="h-8 w-44 pl-8 text-xs" />
            </div>
            <div className="flex items-center rounded-lg border border-border bg-card p-0.5">
              {(["ALL", "IMAGE", "VIDEO", "CAROUSEL"] as MediaFilter[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMediaFilter(m)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                    mediaFilter === m ? "bg-accent text-white" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {m === "ALL" ? "All" : MEDIA_META[m].label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="h-40 animate-pulse bg-muted/40" />
        ) : filteredAds.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title={ads.length === 0 ? "No ads" : "No ad copies match"}
            description={ads.length === 0 ? "This account has no ads yet." : "Try a different search or media filter."}
            className="border-0 bg-transparent py-10"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  {["Creative", "Ad copy", "Campaign › Ad set", "Status", "Spend", "Clicks", "Purchases", "Purchase value", "ROAS"].map((h) => (
                    <th key={h} className="px-5 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredAds.map((ad) => (
                  <tr
                    key={ad.id}
                    onClick={() => setDetailAd(ad)}
                    className="cursor-pointer border-b border-border/60 last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-5 py-3">
                      <CreativeThumb creative={ad.creative} />
                    </td>
                    <td className="max-w-[280px] px-5 py-3">
                      <p className="truncate font-medium">{ad.creative?.title || ad.name}</p>
                      <p className="line-clamp-1 text-xs text-muted-foreground">{ad.creative?.bodyText || "No ad copy text"}</p>
                    </td>
                    <td className="max-w-[220px] truncate px-5 py-3 text-xs text-muted-foreground">
                      {campaignName.get(ad.campaignId) ?? "—"} › {adSetName.get(ad.adsetId) ?? "—"}
                    </td>
                    <td className="px-5 py-3">
                      <StatusDot state={ad.status === "ACTIVE" ? "connected" : "disconnected"} label={ad.status.toLowerCase()} />
                    </td>
                    <NumCell v={ad.insights.spend} fmt={money} />
                    <NumCell v={ad.insights.clicks} />
                    <NumCell v={ad.insights.conversions} />
                    <NumCell v={ad.insights.purchaseValue} fmt={money} />
                    <NumCell v={ad.insights.roas} fmt={(x) => (x === null ? null : `${x.toFixed(2)}×`)} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <AdDetailDialog
        ad={detailAd}
        campaignLabel={detailAd ? campaignName.get(detailAd.campaignId) ?? null : null}
        adSetLabel={detailAd ? adSetName.get(detailAd.adsetId) ?? null : null}
        currency={currency}
        numericAccountId={numericAccountId}
        onOpenChange={(v) => !v && setDetailAd(null)}
      />
    </div>
  );
}

function CreativeThumb({ creative }: { creative: AdCreative | null }) {
  const meta = MEDIA_META[creative?.mediaType ?? "UNKNOWN"];
  const src = creative?.thumbnailUrl || creative?.imageUrl;
  return (
    <div className="relative size-12 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        <div className="flex size-full items-center justify-center text-muted-foreground/50">
          <meta.icon className="size-5" />
        </div>
      )}
      {creative?.mediaType === "VIDEO" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <PlayCircle className="size-5 text-white drop-shadow" />
        </div>
      )}
    </div>
  );
}

function NumCell({ v, fmt }: { v: number | null; fmt?: (n: number | null) => string | null }) {
  const text = fmt ? fmt(v) : v === null ? null : v.toLocaleString();
  return <td className={cn("px-5 py-3 tabular-nums", text === null && "text-muted-foreground/40")}>{text ?? "—"}</td>;
}

function AdDetailDialog({
  ad,
  campaignLabel,
  adSetLabel,
  currency,
  numericAccountId,
  onOpenChange,
}: {
  ad: Ad | null;
  campaignLabel: string | null;
  adSetLabel: string | null;
  currency: string;
  numericAccountId: string;
  onOpenChange: (open: boolean) => void;
}) {
  const meta = MEDIA_META[ad?.creative?.mediaType ?? "UNKNOWN"];
  const src = ad?.creative?.imageUrl || ad?.creative?.thumbnailUrl;
  const money = (v: number | null | undefined) =>
    v == null ? "—" : `${currency ? currency + " " : ""}${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  const adsManagerUrl = `https://adsmanager.facebook.com/adsmanager/manage/ads?act=${numericAccountId}&selected_ad_ids=${ad?.id ?? ""}`;

  const metrics: { label: string; value: string }[] = [
    { label: "Spend", value: money(ad?.insights.spend) },
    { label: "Impressions", value: ad?.insights.impressions?.toLocaleString() ?? "—" },
    { label: "Reach", value: ad?.insights.reach?.toLocaleString() ?? "—" },
    { label: "Clicks", value: ad?.insights.clicks?.toLocaleString() ?? "—" },
    { label: "CTR", value: ad?.insights.ctr != null ? `${ad.insights.ctr.toFixed(2)}%` : "—" },
    { label: "Cost / click", value: money(ad?.insights.cpc) },
    { label: "Purchases", value: ad?.insights.conversions?.toLocaleString() ?? "—" },
    { label: "Purchase value", value: money(ad?.insights.purchaseValue) },
    { label: "ROAS", value: ad?.insights.roas != null ? `${ad.insights.roas.toFixed(2)}×` : "—" },
  ];

  return (
    <Dialog open={Boolean(ad)} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1.5rem)] max-w-lg p-0">
        <div className="max-h-[85vh] overflow-y-auto">
          {src && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt="" className="h-48 w-full border-b border-border object-cover" />
          )}
          <div className="space-y-4 px-5 py-5 pr-14">
            <div>
              <Badge variant="secondary" className="mb-2">
                <meta.icon className="size-3" /> {meta.label}
              </Badge>
              <DialogTitle>{ad?.creative?.title || ad?.name || ""}</DialogTitle>
              <DialogDescription className="mt-1.5 whitespace-pre-wrap">
                {ad?.creative?.bodyText || "No ad copy text was set for this creative."}
              </DialogDescription>
            </div>

            <p className="text-xs text-muted-foreground">
              {campaignLabel ?? "—"} › {adSetLabel ?? "—"}
              {ad?.creative?.callToAction && ` · CTA: ${ad.creative.callToAction.replaceAll("_", " ").toLowerCase()}`}
            </p>

            <div className="grid grid-cols-3 gap-3 rounded-lg border border-border bg-muted/30 p-3">
              {metrics.map((m) => (
                <div key={m.label}>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{m.label}</p>
                  <p className="mt-0.5 text-sm font-semibold tabular-nums">{m.value}</p>
                </div>
              ))}
            </div>

            <a
              href={adsManagerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline"
            >
              <ExternalLink className="size-3.5" /> Open in Meta Ads Manager
            </a>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
