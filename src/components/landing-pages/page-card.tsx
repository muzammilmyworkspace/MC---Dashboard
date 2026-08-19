"use client";

import { ExternalLink, Eye, RefreshCw, Settings2, Trash2 } from "lucide-react";
import type { LandingPage } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/page-shell";
import { Tooltip } from "@/components/ui/tooltip";
import { statusMeta, frameworkLabel, displayUrl } from "@/lib/landing-pages";
import { relativeTime } from "@/lib/utils";

export function PageCard({
  page,
  refreshing,
  onRefresh,
  onDetails,
  onRemove,
}: {
  page: LandingPage;
  refreshing: boolean;
  onRefresh: () => void;
  onDetails: () => void;
  onRemove: () => void;
}) {
  const meta = statusMeta[page.status];
  const hasUrl = Boolean(page.productionUrl);

  return (
    <Card className="flex flex-col p-5 transition-colors hover:border-accent/30">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold">{page.name}</h3>
          {hasUrl ? (
            <a
              href={page.productionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-0.5 block truncate text-xs text-muted-foreground transition-colors hover:text-accent"
            >
              {displayUrl(page.productionUrl)}
            </a>
          ) : (
            <p className="mt-0.5 text-xs text-muted-foreground">No public address yet</p>
          )}
        </div>
        <Tooltip content={meta.help}>
          <span className="shrink-0">
            <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
          </span>
        </Tooltip>
      </div>

      <dl className="mt-4 space-y-1.5 text-xs">
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Last deployment</dt>
          <dd className="truncate font-medium">
            {page.lastDeploymentAt ? relativeTime(page.lastDeploymentAt) : "—"}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">{page.source === "VERCEL" ? "Vercel project" : "Source"}</dt>
          <dd className="truncate font-medium">
            {page.source === "VERCEL" ? page.vercelProjectName || "—" : "Added manually"}
          </dd>
        </div>
        {page.source === "VERCEL" && (
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Framework</dt>
            <dd className="truncate font-medium">{frameworkLabel(page.framework)}</dd>
          </div>
        )}
      </dl>

      {page.description && (
        <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{page.description}</p>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-4">
        <Button size="sm" asChild disabled={!hasUrl} className="flex-1 min-w-[7.5rem]">
          <a href={page.productionUrl || "#"} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="size-4" /> Open Live Page
          </a>
        </Button>

        <Tooltip content="Preview in a new tab">
          <Button size="icon-sm" variant="outline" asChild disabled={!hasUrl}>
            <a href={page.productionUrl || "#"} target="_blank" rel="noopener noreferrer" aria-label={`Preview ${page.name}`}>
              <Eye className="size-4" />
            </a>
          </Button>
        </Tooltip>

        <Tooltip content={page.source === "VERCEL" ? "Fetch the latest deployment from Vercel" : "Only Vercel pages can be refreshed"}>
          <span>
            <Button
              size="icon-sm"
              variant="outline"
              onClick={onRefresh}
              disabled={refreshing || page.source !== "VERCEL"}
              aria-label={`Refresh ${page.name}`}
            >
              <RefreshCw className={refreshing ? "size-4 animate-spin" : "size-4"} />
            </Button>
          </span>
        </Tooltip>

        <Tooltip content="Details and deployment history">
          <Button size="icon-sm" variant="outline" onClick={onDetails} aria-label={`Settings for ${page.name}`}>
            <Settings2 className="size-4" />
          </Button>
        </Tooltip>

        <Tooltip content="Remove from MC Nexus">
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={onRemove}
            aria-label={`Remove ${page.name} from MC Nexus`}
            className="text-muted-foreground hover:text-danger"
          >
            <Trash2 className="size-4" />
          </Button>
        </Tooltip>
      </div>
    </Card>
  );
}
