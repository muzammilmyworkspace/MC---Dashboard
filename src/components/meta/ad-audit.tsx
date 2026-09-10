"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronRight, ExternalLink, Image as ImageIcon, Layers, Loader2, Megaphone,
  PlayCircle, Search, SquareStack,
} from "lucide-react";
import { api, type Ad, type AdCampaign, type AdCreative, type AdMediaType, type AdSet } from "@/lib/api";
import { MetricCard } from "@/components/analytics/metric-card";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusDot } from "@/components/ui/status-dot";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/page-shell";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ *
 *  Ad Audit — every campaign expands into its ad sets, every ad set
 *  expands into its ad copies, and hovering an ad copy shows the actual
 *  image or plays the actual Reel, so an audit never requires opening
 *  Ads Manager to see what's actually running.
 * ------------------------------------------------------------------ */

const MEDIA_META: Record<AdMediaType, { label: string; icon: typeof ImageIcon }> = {
  IMAGE: { label: "Image", icon: ImageIcon },
  VIDEO: { label: "Video / Reel", icon: PlayCircle },
  CAROUSEL: { label: "Carousel", icon: SquareStack },
  UNKNOWN: { label: "Unknown", icon: Layers },
};

type MediaFilter = "ALL" | AdMediaType;

const money = (currency: string, v: number | null) =>
  v === null ? null : `${currency ? currency + " " : ""}${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const pct = (v: number | null) => (v === null ? null : `${v.toFixed(2)}%`);
const roasFmt = (v: number | null) => (v === null ? null : `${v.toFixed(2)}×`);

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
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set());
  const [expandedAdSets, setExpandedAdSets] = useState<Set<string>>(new Set());

  const campaignName = useMemo(() => new Map(campaigns.map((c) => [c.id, c.name])), [campaigns]);
  const adSetName = useMemo(() => new Map(adSets.map((s) => [s.id, s.name])), [adSets]);

  const adSetsByCampaign = useMemo(() => {
    const map = new Map<string, AdSet[]>();
    for (const s of adSets) map.set(s.campaignId, [...(map.get(s.campaignId) ?? []), s]);
    return map;
  }, [adSets]);

  const adsByAdSet = useMemo(() => {
    const map = new Map<string, Ad[]>();
    for (const a of ads) map.set(a.adsetId, [...(map.get(a.adsetId) ?? []), a]);
    return map;
  }, [ads]);

  const counts = useMemo(() => {
    const byType = { IMAGE: 0, VIDEO: 0, CAROUSEL: 0, UNKNOWN: 0 } as Record<AdMediaType, number>;
    for (const ad of ads) byType[ad.creative?.mediaType ?? "UNKNOWN"]++;
    return { adSets: adSets.length, ads: ads.length, ...byType };
  }, [ads, adSets]);

  function toggleCampaign(id: string) {
    setExpandedCampaigns((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAdSet(id: string) {
    setExpandedAdSets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  type TreeRow =
    | { kind: "campaign"; campaign: AdCampaign; adSetCount: number }
    | { kind: "adset"; adSet: AdSet; adCount: number }
    | { kind: "ad"; ad: Ad };

  const rows = useMemo(() => {
    const out: TreeRow[] = [];
    for (const c of campaigns) {
      const cAdSets = adSetsByCampaign.get(c.id) ?? [];
      out.push({ kind: "campaign", campaign: c, adSetCount: cAdSets.length });
      if (!expandedCampaigns.has(c.id)) continue;
      for (const s of cAdSets) {
        const sAds = adsByAdSet.get(s.id) ?? [];
        out.push({ kind: "adset", adSet: s, adCount: sAds.length });
        if (!expandedAdSets.has(s.id)) continue;
        for (const a of sAds) out.push({ kind: "ad", ad: a });
      }
    }
    return out;
  }, [campaigns, adSetsByCampaign, adsByAdSet, expandedCampaigns, expandedAdSets]);

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

      {/* Campaigns → ad sets → ad copies */}
      <Card className="overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h3 className="text-sm font-semibold">Campaigns</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Click a campaign to open its ad sets, then an ad set to open its ad copies. Hover an ad copy to see the actual creative.
          </p>
        </div>

        {loading ? (
          <div className="h-40 animate-pulse bg-muted/40" />
        ) : campaigns.length === 0 ? (
          <EmptyState icon={Megaphone} title="No campaigns" description="This ad account has no campaigns yet." className="border-0 bg-transparent py-10" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  {["Name", "Status", "Spend", "Clicks", "Purchases", "Purchase value", "ROAS"].map((h) => (
                    <th key={h} className="px-5 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  if (row.kind === "campaign") {
                    const c = row.campaign;
                    const open = expandedCampaigns.has(c.id);
                    return (
                      <tr key={`c-${c.id}`} className="border-b border-border/60 bg-muted/20 hover:bg-muted/30">
                        <td className="px-5 py-3">
                          <button onClick={() => toggleCampaign(c.id)} className="flex w-full items-center gap-2 text-left">
                            <ChevronRight className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")} />
                            <span className="max-w-[260px] truncate font-medium">{c.name}</span>
                            <Badge variant="secondary" className="shrink-0 text-[10px]">
                              {row.adSetCount} ad set{row.adSetCount === 1 ? "" : "s"}
                            </Badge>
                          </button>
                        </td>
                        <td className="px-5 py-3">
                          <StatusDot state={c.status === "ACTIVE" ? "connected" : "disconnected"} label={c.status.toLowerCase()} />
                        </td>
                        <NumCell v={c.insights.spend} fmt={(v) => money(currency, v)} />
                        <NumCell v={c.insights.clicks} />
                        <NumCell v={c.insights.conversions} />
                        <NumCell v={c.insights.purchaseValue} fmt={(v) => money(currency, v)} />
                        <NumCell v={c.insights.roas} fmt={roasFmt} />
                      </tr>
                    );
                  }

                  if (row.kind === "adset") {
                    const s = row.adSet;
                    const open = expandedAdSets.has(s.id);
                    return (
                      <tr key={`s-${s.id}`} className="border-b border-border/60 hover:bg-muted/20">
                        <td className="py-2.5 pl-9 pr-5">
                          <button onClick={() => toggleAdSet(s.id)} className="flex w-full items-center gap-2 text-left">
                            <ChevronRight className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")} />
                            <Layers className="size-3.5 shrink-0 text-muted-foreground" />
                            <span className="max-w-[220px] truncate text-[13px]">{s.name}</span>
                            <Badge variant="secondary" className="shrink-0 text-[10px]">
                              {row.adCount} ad{row.adCount === 1 ? "" : "s"}
                            </Badge>
                          </button>
                        </td>
                        <td className="py-2.5 pr-5">
                          <StatusDot state={s.status === "ACTIVE" ? "connected" : "disconnected"} label={s.status.toLowerCase()} />
                        </td>
                        <NumCell v={s.insights.spend} fmt={(v) => money(currency, v)} />
                        <NumCell v={s.insights.clicks} />
                        <NumCell v={s.insights.conversions} />
                        <NumCell v={s.insights.purchaseValue} fmt={(v) => money(currency, v)} />
                        <NumCell v={s.insights.roas} fmt={roasFmt} />
                      </tr>
                    );
                  }

                  const a = row.ad;
                  return (
                    <tr
                      key={`a-${a.id}`}
                      onClick={() => setDetailAd(a)}
                      className="cursor-pointer border-b border-border/60 last:border-0 hover:bg-muted/20"
                    >
                      <td className="py-2 pl-16 pr-5">
                        <div className="flex items-center gap-2.5">
                          <CreativeHoverPreview creative={a.creative}>
                            <CreativeThumb creative={a.creative} size="sm" />
                          </CreativeHoverPreview>
                          <div className="min-w-0">
                            <p className="max-w-[200px] truncate text-[13px] font-medium">{a.creative?.title || a.name}</p>
                            <p className="line-clamp-1 max-w-[200px] text-[11px] text-muted-foreground">
                              {a.creative?.bodyText || "No ad copy text"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-2 pr-5">
                        <StatusDot state={a.status === "ACTIVE" ? "connected" : "disconnected"} label={a.status.toLowerCase()} />
                      </td>
                      <NumCell v={a.insights.spend} fmt={(v) => money(currency, v)} />
                      <NumCell v={a.insights.clicks} />
                      <NumCell v={a.insights.conversions} />
                      <NumCell v={a.insights.purchaseValue} fmt={(v) => money(currency, v)} />
                      <NumCell v={a.insights.roas} fmt={roasFmt} />
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Ad copies — searchable across every campaign */}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold">Every ad copy</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">Search or filter across all campaigns at once.</p>
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
                      <CreativeHoverPreview creative={ad.creative}>
                        <CreativeThumb creative={ad.creative} />
                      </CreativeHoverPreview>
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
                    <NumCell v={ad.insights.spend} fmt={(v) => money(currency, v)} />
                    <NumCell v={ad.insights.clicks} />
                    <NumCell v={ad.insights.conversions} />
                    <NumCell v={ad.insights.purchaseValue} fmt={(v) => money(currency, v)} />
                    <NumCell v={ad.insights.roas} fmt={roasFmt} />
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

/* ------------------------------ hover preview ------------------------------ */

const videoSourceCache = new Map<string, string | null>();

/**
 * Wraps a thumbnail. On hover, floats an enlarged preview near the cursor —
 * the actual image for a static ad, or the actual video playing muted for a
 * Reel. The video file is fetched lazily, once per video id, only when
 * someone actually hovers it — never in bulk with the ad list.
 */
function CreativeHoverPreview({ creative, children }: { creative: AdCreative | null; children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  /** Only the freshly-fetched result — an already-cached video reads straight from `videoSourceCache` below, no state round-trip needed. */
  const [fetchedSrc, setFetchedSrc] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const fetchedFor = useRef<string | null>(null);

  const src = creative?.imageUrl || creative?.thumbnailUrl;
  const isVideo = creative?.mediaType === "VIDEO" && Boolean(creative.videoId);
  const cachedSrc = creative?.videoId ? videoSourceCache.get(creative.videoId) : undefined;
  const videoSrc = cachedSrc !== undefined ? cachedSrc : fetchedSrc;

  useEffect(() => {
    if (!show || !isVideo) return;
    const videoId = creative?.videoId;
    if (!videoId) return;
    if (fetchedFor.current === videoId || videoSourceCache.has(videoId)) return;
    fetchedFor.current = videoId;

    setVideoLoading(true);
    api.integrations
      .adVideoSource(videoId)
      .then((r) => {
        videoSourceCache.set(videoId, r.source);
        setFetchedSrc(r.source);
      })
      .catch(() => videoSourceCache.set(videoId, null))
      .finally(() => setVideoLoading(false));
  }, [show, isVideo, creative]);

  if (!src) return <>{children}</>;

  function handleEnter(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const width = 240;
    const left = Math.min(rect.right + 12, window.innerWidth - width - 12);
    const top = Math.min(rect.top, window.innerHeight - 320);
    setPos({ left, top: Math.max(12, top) });
    setShow(true);
  }

  return (
    <div className="relative inline-flex" onMouseEnter={handleEnter} onMouseLeave={() => setShow(false)}>
      {children}
      {show &&
        pos &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            style={{ position: "fixed", left: pos.left, top: pos.top, width: 240 }}
            className="pointer-events-none z-[100] overflow-hidden rounded-xl border border-border bg-popover shadow-glow"
          >
            {isVideo ? (
              videoSrc ? (
                <video src={videoSrc} autoPlay muted loop playsInline className="aspect-[4/5] w-full bg-black object-contain" />
              ) : (
                <div className="relative aspect-[4/5] w-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="size-full object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    {videoLoading ? <Loader2 className="size-6 animate-spin text-white" /> : <PlayCircle className="size-8 text-white/90" />}
                  </div>
                </div>
              )
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt="" className="max-h-80 w-full object-cover" />
            )}
            {creative?.bodyText && (
              <p className="max-h-16 overflow-hidden px-3 py-2 text-[11px] leading-snug text-muted-foreground">{creative.bodyText}</p>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}

function CreativeThumb({ creative, size = "md" }: { creative: AdCreative | null; size?: "sm" | "md" }) {
  const meta = MEDIA_META[creative?.mediaType ?? "UNKNOWN"];
  const src = creative?.thumbnailUrl || creative?.imageUrl;
  return (
    <div className={cn("relative shrink-0 overflow-hidden rounded-lg border border-border bg-muted", size === "sm" ? "size-9" : "size-12")}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        <div className="flex size-full items-center justify-center text-muted-foreground/50">
          <meta.icon className={size === "sm" ? "size-4" : "size-5"} />
        </div>
      )}
      {creative?.mediaType === "VIDEO" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <PlayCircle className={cn("text-white drop-shadow", size === "sm" ? "size-4" : "size-5")} />
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
  const fmtMoney = (v: number | null | undefined) => (v == null ? "—" : money(currency, v) ?? "—");
  const adsManagerUrl = `https://adsmanager.facebook.com/adsmanager/manage/ads?act=${numericAccountId}&selected_ad_ids=${ad?.id ?? ""}`;

  const metrics: { label: string; value: string }[] = [
    { label: "Spend", value: fmtMoney(ad?.insights.spend) },
    { label: "Impressions", value: ad?.insights.impressions?.toLocaleString() ?? "—" },
    { label: "Reach", value: ad?.insights.reach?.toLocaleString() ?? "—" },
    { label: "Clicks", value: ad?.insights.clicks?.toLocaleString() ?? "—" },
    { label: "CTR", value: pct(ad?.insights.ctr ?? null) ?? "—" },
    { label: "Cost / click", value: fmtMoney(ad?.insights.cpc) },
    { label: "Purchases", value: ad?.insights.conversions?.toLocaleString() ?? "—" },
    { label: "Purchase value", value: fmtMoney(ad?.insights.purchaseValue) },
    { label: "ROAS", value: roasFmt(ad?.insights.roas ?? null) ?? "—" },
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
