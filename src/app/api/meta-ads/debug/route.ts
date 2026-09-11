import { NextResponse } from "next/server";
import { apiError } from "@/server/auth";
import { env } from "@/server/env";
import { providerRequest } from "@/server/http";
import { listAdAccounts } from "@/server/meta/ads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GRAPH = "https://graph.facebook.com";

/**
 * Temporary diagnostic: finds a campaign/ad set by (partial) name and dumps
 * the RAW insights payload (actions/action_values/purchase_roas, every
 * action_type, unfiltered) for its ads over an explicit date range — to
 * check which action_type our shaped "purchases" number should actually be
 * reading, against what Ads Manager's UI shows for the same ad set/range.
 * Removed once the mismatch is understood.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");
  if (!secret || secret !== env.DEBUG_SECRET) return apiError(401, "UNAUTHORIZED", "Not authorized.");

  const nameQuery = url.searchParams.get("name") ?? "";
  const adsetName = url.searchParams.get("adset") ?? "";
  const since = url.searchParams.get("since") ?? "2026-08-12";
  const until = url.searchParams.get("until") ?? "2026-09-10";
  const token = (env.META_ACCESS_TOKEN ?? "").trim();

  try {
    const accounts = await listAdAccounts();
    const out: unknown[] = [];

    if (adsetName) {
      for (const account of accounts) {
        // One filtered call instead of scanning every campaign — avoids repeating the rate-limit hit.
        const filtering = encodeURIComponent(JSON.stringify([{ field: "name", operator: "CONTAIN", value: adsetName }]));
        const adsetsRes = await providerRequest<{ data?: { id: string; name?: string; campaign_id?: string }[] }>({
          provider: "meta-ads-debug",
          url: `${GRAPH}/${env.META_GRAPH_VERSION}/${account.id}/adsets?fields=id,name,campaign_id&filtering=${filtering}&limit=50`,
          token,
          cacheTtlMs: 0,
        });
        for (const adset of adsetsRes.data ?? []) {
          const adsRes = await providerRequest<{ data?: { id: string; name?: string; effective_status?: string }[] }>({
            provider: "meta-ads-debug",
            url: `${GRAPH}/${env.META_GRAPH_VERSION}/${adset.id}/ads?fields=id,name,effective_status&limit=200`,
            token,
            cacheTtlMs: 0,
          });
          for (const ad of adsRes.data ?? []) {
            const insightsRes = await providerRequest<{ data?: unknown[] }>({
              provider: "meta-ads-debug",
              url: `${GRAPH}/${env.META_GRAPH_VERSION}/${ad.id}/insights?fields=ad_id,ad_name,spend,actions,action_values,purchase_roas&time_range=${encodeURIComponent(JSON.stringify({ since, until }))}`,
              token,
              cacheTtlMs: 0,
            });
            out.push({ account: account.name, adset: adset.name, campaignId: adset.campaign_id, ad, insights: insightsRes.data ?? [] });
          }
        }
      }
      return NextResponse.json({ since, until, adsetName, accounts: accounts.map((a) => ({ id: a.id, name: a.name })), matches: out });
    }

    for (const account of accounts) {
      const adsRes = await providerRequest<{ data?: { id: string; name?: string; adset_id?: string; campaign_id?: string; effective_status?: string }[] }>({
        provider: "meta-ads-debug",
        url: `${GRAPH}/${env.META_GRAPH_VERSION}/${account.id}/ads?fields=id,name,adset_id,campaign_id,effective_status&limit=500`,
        token,
        cacheTtlMs: 0,
      });
      const lowerQuery = nameQuery.toLowerCase();
      const allAds = adsRes.data ?? [];
      const matchedAds = allAds.filter((a) => a.name?.toLowerCase().includes(lowerQuery));
      out.push({ account: account.name, totalAdsSeen: allAds.length, sampleNames: allAds.slice(0, 5).map((a) => a.name) });
      if (matchedAds.length === 0) continue;

      for (const ad of matchedAds) {
        const insightsRes = await providerRequest<{ data?: unknown[] }>({
          provider: "meta-ads-debug",
          url: `${GRAPH}/${env.META_GRAPH_VERSION}/${ad.id}/insights?fields=ad_id,ad_name,spend,actions,action_values,purchase_roas&time_range=${encodeURIComponent(JSON.stringify({ since, until }))}`,
          token,
          cacheTtlMs: 0,
        });
        out.push({ account: account.name, ad, insights: insightsRes.data ?? [] });
      }
    }

    return NextResponse.json({
      since,
      until,
      nameQuery,
      accounts: accounts.map((a) => ({ id: a.id, name: a.name, status: a.statusLabel })),
      matches: out,
    });
  } catch (err) {
    return apiError(500, "DEBUG_ERROR", err instanceof Error ? err.message : "Unknown error");
  }
}
