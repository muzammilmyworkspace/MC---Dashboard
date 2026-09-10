"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle, ChevronRight, ExternalLink, Image as ImageIcon, Layers, Loader2, Megaphone,
  PlayCircle, RefreshCw, Search, SquareStack,
} from "lucide-react";
import { api, ApiRequestError, type Ad, type AdCampaign, type AdCreative, type AdDatePreset, type AdMediaType, type AdSet } from "@/lib/api";
import { MetricCard } from "@/components/analytics/metric-card";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/ui/status-dot";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/page-shell";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ *
 *  Ad Audit — every campaign expands into its ad sets, every ad set
 *  expands into its ad copies, and hovering an ad copy shows the actual
 *  image or plays the actual Reel.
 *
 *  This account has years of history — hundreds of ad sets and ads
 *  across long-paused campaigns. Reading all of that up front is what
 *  timed the page out before, so nothing here is fetched for the whole
 *  account at once: ad sets load when their campaign is expanded, ads
 *  load when their ad set is expanded, and the one account-wide call
 *  (for the searchable list below) asks Meta for activity in the
 *  selected period only, not the account's full history.
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
const errMsg = (err: unknown, fallback: string) => (err instanceof ApiRequestError ? err.message : fallback);

type LoadState<T> = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: T };

export function AdAudit({
  accountId,
  numericAccountId,
  currency,
  preset,
  loading,
  campaigns,
}: {
  /** "act_123…" — used for the account-wide "active ads" call. */
  accountId: string;
  numericAccountId: string;
  currency: string;
  preset: AdDatePreset;
  /** True while `campaigns` itself is still loading. */
  loading: boolean;
  campaigns: AdCampaign[];
}) {
  // Every cached child (expanded rows, loaded ad sets/ads) needs to reset
  // when the account or date range changes. Rather than an effect that
  // clears state — which triggers an extra render pass — the caller keys
  // this component on `${accountId}:${preset}`, so a change simply
  // remounts it with fresh state.
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set());
  const [expandedAdSets, setExpandedAdSets] = useState<Set<string>>(new Set());
  const [adSetsByCampaign, setAdSetsByCampaign] = useState<Record<string, LoadState<AdSet[]>>>({});
  const [adsByAdSet, setAdsByAdSet] = useState<Record<string, LoadState<Ad[]>>>({});
  const [detailAd, setDetailAd] = useState<Ad | null>(null);

  function loadAdSets(campaignId: string) {
    setAdSetsByCampaign((prev) => ({ ...prev, [campaignId]: { status: "loading" } }));
    api.integrations
      .adSetsForCampaign(campaignId, preset)
      .then((r) => setAdSetsByCampaign((prev) => ({ ...prev, [campaignId]: { status: "ready", data: r.adSets } })))
      .catch((err) => setAdSetsByCampaign((prev) => ({ ...prev, [campaignId]: { status: "error", message: errMsg(err, "Couldn't load ad sets.") } })));
  }

  function toggleCampaign(campaign: AdCampaign) {
    const id = campaign.id;
    const wasExpanded = expandedCampaigns.has(id);
    setExpandedCampaigns((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    if (wasExpanded) return;
    const current = adSetsByCampaign[id];
    if (current && current.status !== "error") return;
    loadAdSets(id);
  }

  function loadAds(adsetId: string) {
    setAdsByAdSet((prev) => ({ ...prev, [adsetId]: { status: "loading" } }));
    api.integrations
      .adsForAdSet(adsetId, preset)
      .then((r) => setAdsByAdSet((prev) => ({ ...prev, [adsetId]: { status: "ready", data: r.ads } })))
      .catch((err) => setAdsByAdSet((prev) => ({ ...prev, [adsetId]: { status: "error", message: errMsg(err, "Couldn't load ad copies.") } })));
  }

  function toggleAdSet(adSet: AdSet) {
    const id = adSet.id;
    const wasExpanded = expandedAdSets.has(id);
    setExpandedAdSets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    if (wasExpanded) return;
    const current = adsByAdSet[id];
    if (current && current.status !== "error") return;
    loadAds(id);
  }

  type TreeRow =
    | { kind: "campaign"; campaign: AdCampaign }
    | { kind: "adsets-loading" }
    | { kind: "adsets-error"; campaignId: string; message: string }
    | { kind: "adset"; adSet: AdSet }
    | { kind: "ads-loading" }
    | { kind: "ads-error"; adsetId: string; message: string }
    | { kind: "ad"; ad: Ad };

  const rows = useMemo(() => {
    const out: TreeRow[] = [];
    for (const c of campaigns) {
      out.push({ kind: "campaign", campaign: c });
      if (!expandedCampaigns.has(c.id)) continue;

      const s = adSetsByCampaign[c.id];
      if (!s || s.status === "loading") {
        out.push({ kind: "adsets-loading" });
        continue;
      }
      if (s.status === "error") {
        out.push({ kind: "adsets-error", campaignId: c.id, message: s.message });
        continue;
      }
      for (const adSet of s.data) {
        out.push({ kind: "adset", adSet });
        if (!expandedAdSets.has(adSet.id)) continue;

        const a = adsByAdSet[adSet.id];
        if (!a || a.status === "loading") {
          out.push({ kind: "ads-loading" });
          continue;
        }
        if (a.status === "error") {
          out.push({ kind: "ads-error", adsetId: adSet.id, message: a.message });
          continue;
        }
        for (const ad of a.data) out.push({ kind: "ad", ad });
      }
    }
    return out;
  }, [campaigns, expandedCampaigns, expandedAdSets, adSetsByCampaign, adsByAdSet]);

  return (
    <div className="space-y-6">
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
                {rows.map((row, i) => {
                  if (row.kind === "campaign") {
                    const c = row.campaign;
                    const open = expandedCampaigns.has(c.id);
                    const state = adSetsByCampaign[c.id];
                    return (
                      <tr key={`c-${c.id}`} className="border-b border-border/60 bg-muted/20 hover:bg-muted/30">
                        <td className="px-5 py-3">
                          <button onClick={() => toggleCampaign(c)} className="flex w-full items-center gap-2 text-left">
                            <ChevronRight className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")} />
                            <span className="max-w-[260px] truncate font-medium">{c.name}</span>
                            {state?.status === "ready" && (
                              <Badge variant="secondary" className="shrink-0 text-[10px]">
                                {state.data.length} ad set{state.data.length === 1 ? "" : "s"}
                              </Badge>
                            )}
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

                  if (row.kind === "adsets-loading") {
                    return (
                      <tr key={`asl-${i}`} className="border-b border-border/60">
                        <td colSpan={7} className="py-3 pl-9 pr-5 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-2">
                            <Loader2 className="size-3.5 animate-spin" /> Loading ad sets…
                          </span>
                        </td>
                      </tr>
                    );
                  }

                  if (row.kind === "adsets-error") {
                    return (
                      <tr key={`ase-${row.campaignId}`} className="border-b border-border/60">
                        <td colSpan={7} className="py-3 pl-9 pr-5">
                          <RetryRow message={row.message} onRetry={() => loadAdSets(row.campaignId)} />
                        </td>
                      </tr>
                    );
                  }

                  if (row.kind === "adset") {
                    const s = row.adSet;
                    const open = expandedAdSets.has(s.id);
                    const state = adsByAdSet[s.id];
                    return (
                      <tr key={`s-${s.id}`} className="border-b border-border/60 hover:bg-muted/20">
                        <td className="py-2.5 pl-9 pr-5">
                          <button onClick={() => toggleAdSet(s)} className="flex w-full items-center gap-2 text-left">
                            <ChevronRight className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")} />
                            <Layers className="size-3.5 shrink-0 text-muted-foreground" />
                            <span className="max-w-[220px] truncate text-[13px]">{s.name}</span>
                            {state?.status === "ready" && (
                              <Badge variant="secondary" className="shrink-0 text-[10px]">
                                {state.data.length} ad{state.data.length === 1 ? "" : "s"}
                              </Badge>
                            )}
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

                  if (row.kind === "ads-loading") {
                    return (
                      <tr key={`adl-${i}`} className="border-b border-border/60">
                        <td colSpan={7} className="py-3 pl-16 pr-5 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-2">
                            <Loader2 className="size-3.5 animate-spin" /> Loading ad copies…
                          </span>
                        </td>
                      </tr>
                    );
                  }

                  if (row.kind === "ads-error") {
                    return (
                      <tr key={`ade-${row.adsetId}`} className="border-b border-border/60">
                        <td colSpan={7} className="py-3 pl-16 pr-5">
                          <RetryRow message={row.message} onRetry={() => loadAds(row.adsetId)} />
                        </td>
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

      <ActiveAdsSearch accountId={accountId} preset={preset} currency={currency} onSelect={setDetailAd} />

      <AdDetailDialog
        ad={detailAd}
        currency={currency}
        numericAccountId={numericAccountId}
        onOpenChange={(v) => !v && setDetailAd(null)}
      />
    </div>
  );
}

function RetryRow({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex items-center gap-2 text-xs text-danger">
      <AlertTriangle className="size-3.5 shrink-0" />
      <span className="text-muted-foreground">{message}</span>
      <Button variant="ghost" size="sm" onClick={onRetry} className="h-6 px-2 text-xs">
        <RefreshCw className="size-3" /> Retry
      </Button>
    </div>
  );
}

/* --------------------------- searchable ad copies -------------------------- */

/**
 * Every ad with activity in the selected period, across the whole account —
 * fetched separately from the tree above, and scoped by Meta to "had
 * delivery in this period" rather than the account's full history.
 */
function ActiveAdsSearch({
  accountId,
  preset,
  currency,
  onSelect,
}: {
  accountId: string;
  preset: AdDatePreset;
  currency: string;
  onSelect: (ad: Ad) => void;
}) {
  const [ads, setAds] = useState<Ad[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>("ALL");
  const [reloadKey, setReloadKey] = useState(0);

  /** Derived rather than cleared up front — clearing state synchronously in an effect body is what triggers React's cascading-render warning. */
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const requestKey = accountId ? `${accountId}:${preset}:${reloadKey}` : null;
  const stale = requestKey !== null && loadedFor !== requestKey;

  useEffect(() => {
    if (!accountId || !requestKey) return;
    let cancelled = false;
    void (async () => {
      try {
        const r = await api.integrations.activeAds(accountId, preset);
        if (cancelled) return;
        setAds(r.ads);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(errMsg(err, "Couldn't load ad copies."));
        setAds([]);
      } finally {
        if (!cancelled) setLoadedFor(requestKey);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accountId, preset, requestKey]);

  const counts = useMemo(() => {
    const byType = { IMAGE: 0, VIDEO: 0, CAROUSEL: 0, UNKNOWN: 0 } as Record<AdMediaType, number>;
    const adSetIds = new Set<string>();
    for (const ad of ads ?? []) {
      byType[ad.creative?.mediaType ?? "UNKNOWN"]++;
      if (ad.adsetId) adSetIds.add(ad.adsetId);
    }
    return { adSets: adSetIds.size, ads: ads?.length ?? 0, ...byType };
  }, [ads]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (ads ?? []).filter((ad) => {
      if (mediaFilter !== "ALL" && (ad.creative?.mediaType ?? "UNKNOWN") !== mediaFilter) return false;
      if (!q) return true;
      const haystack = `${ad.name} ${ad.creative?.title ?? ""} ${ad.creative?.bodyText ?? ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [ads, query, mediaFilter]);

  const loading = stale || ads === null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <MetricCard label="Ad sets with activity" value={counts.adSets} loading={loading} help="Ad sets that had spend or delivery in this period." />
        <MetricCard label="Ad copies" value={counts.ads} loading={loading} help="Individual ads with activity in this period." />
        <MetricCard label="Images" value={counts.IMAGE} loading={loading} help="Ad copies running a single static image." />
        <MetricCard label="Videos / Reels" value={counts.VIDEO} loading={loading} help="Ad copies running a video or Reel." />
        <MetricCard label="Carousels" value={counts.CAROUSEL} loading={loading} help="Ad copies running a multi-card carousel." />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold">Every ad copy</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">Search or filter across every campaign for this period.</p>
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
        ) : error ? (
          <EmptyState
            icon={AlertTriangle}
            title="Couldn't load ad copies"
            description={error}
            className="border-0 bg-transparent py-10"
            action={
              <Button size="sm" onClick={() => setReloadKey((k) => k + 1)}>
                <RefreshCw className="size-4" /> Retry
              </Button>
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title={(ads ?? []).length === 0 ? "No ads had activity in this period" : "No ad copies match"}
            description={(ads ?? []).length === 0 ? "Try a wider date range." : "Try a different search or media filter."}
            className="border-0 bg-transparent py-10"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  {["Creative", "Ad copy", "Status", "Spend", "Clicks", "Purchases", "Purchase value", "ROAS"].map((h) => (
                    <th key={h} className="px-5 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((ad) => (
                  <tr key={ad.id} onClick={() => onSelect(ad)} className="cursor-pointer border-b border-border/60 last:border-0 hover:bg-muted/30">
                    <td className="px-5 py-3">
                      <CreativeHoverPreview creative={ad.creative}>
                        <CreativeThumb creative={ad.creative} />
                      </CreativeHoverPreview>
                    </td>
                    <td className="max-w-[320px] px-5 py-3">
                      <p className="truncate font-medium">{ad.creative?.title || ad.name}</p>
                      <p className="line-clamp-1 text-xs text-muted-foreground">{ad.creative?.bodyText || "No ad copy text"}</p>
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
  currency,
  numericAccountId,
  onOpenChange,
}: {
  ad: Ad | null;
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

            {ad?.creative?.callToAction && (
              <p className="text-xs text-muted-foreground">CTA: {ad.creative.callToAction.replaceAll("_", " ").toLowerCase()}</p>
            )}

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
