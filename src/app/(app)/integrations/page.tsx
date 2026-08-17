"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Plug, RefreshCw, CheckCircle2, XCircle, ExternalLink, ArrowRight, ShieldCheck, Clock,
  Zap, Webhook, KeyRound, FlaskConical, ListChecks, Ban, Database,
} from "lucide-react";
import { integrations as seed, integrationCategories, type Integration } from "@/lib/integrations";
import { api, ApiRequestError, type MetaConnectionStatus } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const statusMeta = {
  connected: { label: "Connected", variant: "success" as const, dot: "#16a34a" },
  not_connected: { label: "Not Connected", variant: "secondary" as const, dot: "#94a3b8" },
  error: { label: "Error", variant: "danger" as const, dot: "#e5484d" },
};

/** The one card backed by a real OAuth flow; the rest are still Phase-2 seed data. */
const OAUTH_KEY = "meta-graph";

export default function IntegrationCenterPage() {
  const [list, setList] = useState<Integration[]>(seed);
  const [cat, setCat] = useState<(typeof integrationCategories)[number]>("All");
  const [openKey, setOpenKey] = useState<string | null>(null);

  const [meta, setMeta] = useState<MetaConnectionStatus | null>(null);
  const [metaBusy, setMetaBusy] = useState(false);
  const [metaReload, setMetaReload] = useState(0);

  /* Real connection state for the Meta card. */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const status = await api.integrations.metaStatus().catch(() => null);
      if (!cancelled) setMeta(status);
    })();
    return () => {
      cancelled = true;
    };
  }, [metaReload]);

  /* We land back here from Meta with the outcome in the query string. */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("integration") !== "instagram") return;

    const status = params.get("status");
    const message = params.get("message");
    const account = params.get("account");

    // Deferred so the effect body stays free of synchronous state updates.
    const timer = setTimeout(() => {
      if (status === "connected") {
        toast.success("Instagram connected", {
          description: account ? `Connected as @${account}` : undefined,
        });
      } else {
        toast.error("Couldn't connect Instagram", { description: message ?? "Please try again." });
      }
      setMetaReload((n) => n + 1);
    }, 0);

    // Drop the params so a refresh doesn't replay the toast.
    window.history.replaceState({}, "", window.location.pathname);
    return () => clearTimeout(timer);
  }, []);

  /** Overlays live OAuth state onto the seed card. */
  const withLiveStatus = useMemo(
    () =>
      list.map((i) =>
        i.key === OAUTH_KEY && meta
          ? {
              ...i,
              status: (meta.connected ? "connected" : "not_connected") as Integration["status"],
              health: (meta.connected ? "healthy" : "—") as Integration["health"],
              lastSync: meta.account ? new Date(meta.account.connectedAt).toLocaleString() : "Never",
              oauthStatus: meta.message,
            }
          : i
      ),
    [list, meta]
  );

  const shown = useMemo(
    () => (cat === "All" ? withLiveStatus : withLiveStatus.filter((i) => i.category === cat)),
    [withLiveStatus, cat]
  );
  const active = withLiveStatus.find((i) => i.key === openKey) ?? null;
  const connectedCount = withLiveStatus.filter((i) => i.status === "connected").length;

  function setStatus(key: string, status: Integration["status"]) {
    setList((prev) => prev.map((i) => (i.key === key ? { ...i, status, lastSync: status === "connected" ? "just now" : "Never", health: status === "connected" ? "healthy" : "—" } : i)));
    if (status === "connected") toast.success("Connected", { description: "Phase 2 OAuth flow would run here." });
    else toast("Disconnected");
  }

  /** Sends the browser to Meta. The code never touches the frontend. */
  async function connectMeta() {
    setMetaBusy(true);
    try {
      const res = await api.integrations.authUrl(OAUTH_KEY);
      if (res.url) {
        // assign() rather than `location.href =` so the compiler doesn't read
        // this as mutating a value from outside the component.
        window.location.assign(res.url);
        return; // navigating away — leave the button busy
      }
      toast.error("Couldn't start the connection", { description: res.message ?? "No authorization URL returned." });
    } catch (err) {
      toast.error("Couldn't start the connection", {
        description: err instanceof ApiRequestError ? err.message : "Could not reach the API.",
      });
    }
    setMetaBusy(false);
  }

  async function disconnectMeta() {
    setMetaBusy(true);
    try {
      setMeta(await api.integrations.metaDisconnect());
      toast("Instagram disconnected");
    } catch (err) {
      toast.error("Couldn't disconnect", {
        description: err instanceof ApiRequestError ? err.message : "Could not reach the API.",
      });
    } finally {
      setMetaBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-accent"><Plug className="size-4" /><span className="font-medium">Integration Center</span></div>
          <h2 className="mt-1 text-[28px] font-semibold tracking-tight">Connections</h2>
          <p className="mt-1 text-sm text-muted-foreground">{connectedCount} of {list.length} platforms connected · Phase 2 API preparation</p>
        </div>
      </div>

      {/* Category filter */}
      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        {integrationCategories.map((c) => (
          <button key={c} onClick={() => setCat(c)} className={cn("shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors", cat === c ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground hover:border-accent/40")}>
            {c}
          </button>
        ))}
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {shown.map((i) => {
          const sm = statusMeta[i.status];
          return (
            <motion.div key={i.key} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="flex h-full flex-col p-5">
                <div className="flex items-start gap-3">
                  <div className="flex size-11 items-center justify-center rounded-xl text-xl" style={{ background: `${i.accent}14` }}>{i.emoji}</div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold leading-tight">{i.name}</p>
                    <p className="text-xs text-muted-foreground">{i.category}</p>
                  </div>
                  <Badge variant={sm.variant}><span className="size-1.5 rounded-full" style={{ background: sm.dot }} /> {sm.label}</Badge>
                </div>
                <p className="mt-3 line-clamp-2 flex-1 text-sm text-muted-foreground">{i.description}</p>
                <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1"><Clock className="size-3" /> {i.lastSync}</span>
                  <span className="flex items-center gap-1 capitalize"><span className={cn("size-1.5 rounded-full", i.health === "healthy" ? "bg-success" : i.health === "degraded" ? "bg-warning" : "bg-muted-foreground/40")} /> {i.health}</span>
                </div>
                <div className="mt-4 flex gap-2">
                  {i.status === "connected" ? (
                    <Button
                      variant="secondary" size="sm" className="flex-1"
                      disabled={i.key === OAUTH_KEY && metaBusy}
                      onClick={() => (i.key === OAUTH_KEY ? void disconnectMeta() : setStatus(i.key, "not_connected"))}
                    >
                      Disconnect
                    </Button>
                  ) : (
                    <Button
                      size="sm" className="flex-1"
                      disabled={i.key === OAUTH_KEY && metaBusy}
                      onClick={() => (i.key === OAUTH_KEY ? void connectMeta() : setStatus(i.key, "connected"))}
                    >
                      {i.key === OAUTH_KEY ? (metaBusy ? "Connecting…" : "Connect Instagram") : "Connect"}
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => setOpenKey(i.key)}>Details <ArrowRight className="size-3.5" /></Button>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Detail drawer */}
      <Dialog open={!!active} onOpenChange={(o) => !o && setOpenKey(null)}>
        {active && (
          <DialogContent side="right" className="flex flex-col p-0">
            <div className="border-b border-border p-5 pr-14">
              <div className="flex items-center gap-3">
                <div className="flex size-12 items-center justify-center rounded-xl text-2xl" style={{ background: `${active.accent}14` }}>{active.emoji}</div>
                <div>
                  <DialogTitle>{active.name}</DialogTitle>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge variant={statusMeta[active.status].variant}>{statusMeta[active.status].label}</Badge>
                    <span className="text-xs text-muted-foreground">{active.category}</span>
                  </div>
                </div>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{active.description}</p>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-5">
              <Section icon={<Database className="size-4" />} title="Why this is needed"><p className="text-sm leading-relaxed">{active.whyNeeded}</p></Section>

              <Section icon={<Zap className="size-4" />} title="Data available after connection">
                <div className="flex flex-wrap gap-1.5">{active.dataProvided.map((d) => <span key={d} className="rounded-md bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">{d}</span>)}</div>
              </Section>

              <Section icon={<ShieldCheck className="size-4" />} title="OAuth flow">
                <p className="text-sm leading-relaxed">{active.oauthFlow}</p>
                <Row label="OAuth status" value={active.oauthStatus} />
              </Section>

              <Section icon={<KeyRound className="size-4" />} title="Required scopes & permissions">
                <div className="mb-2 flex flex-wrap gap-1.5">{active.scopes.map((s) => <code key={s} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">{s}</code>)}</div>
                <div className="flex flex-wrap gap-1.5">{active.permissions.map((p) => <span key={p} className="rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground">{p}</span>)}</div>
              </Section>

              <div className="grid grid-cols-2 gap-3">
                <MetaTile icon={<Clock className="size-3.5" />} label="Sync frequency" value={active.syncFrequency} />
                <MetaTile icon={<Zap className="size-3.5" />} label="Rate limit" value={active.rateLimit} />
                <MetaTile icon={<Webhook className="size-3.5" />} label="Webhooks" value={active.webhook} />
                <MetaTile icon={<FlaskConical className="size-3.5" />} label="Testing" value={active.testingStatus} />
              </div>

              <Section icon={<KeyRound className="size-4" />} title="Environment variables">
                <div className="space-y-1">{active.envVars.map((e) => <code key={e} className="block rounded bg-muted px-2 py-1 font-mono text-[11px]">{e}</code>)}</div>
              </Section>

              <Section icon={<Database className="size-4" />} title="Example response">
                <pre className="overflow-x-auto rounded-lg border border-border bg-muted/50 p-3 font-mono text-[11px] leading-relaxed">{active.exampleResponse}</pre>
              </Section>

              <Section icon={<Ban className="size-4" />} title="Limitations">
                <ul className="space-y-1">{active.limitations.map((l) => <li key={l} className="flex items-start gap-2 text-sm"><span className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground" /> {l}</li>)}</ul>
              </Section>

              <Section icon={<ListChecks className="size-4" />} title="Setup checklist">
                <div className="space-y-1.5">
                  {active.setupChecklist.map((c) => (
                    <div key={c.label} className="flex items-center gap-2.5 text-sm">
                      {c.done ? <CheckCircle2 className="size-4 text-success" /> : <XCircle className="size-4 text-muted-foreground/50" />}
                      <span className={cn(c.done && "text-muted-foreground line-through")}>{c.label}</span>
                    </div>
                  ))}
                </div>
              </Section>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2 border-t border-border p-4">
              {active.status === "connected" ? (
                <>
                  <Button
                    variant="secondary" className="flex-1" disabled={active.key === OAUTH_KEY && metaBusy}
                    onClick={() => (active.key === OAUTH_KEY ? void connectMeta() : toast("Reconnecting…", { description: `${active.name} — Phase 2 OAuth flow.` }))}
                  >
                    <RefreshCw className="size-4" /> Reconnect
                  </Button>
                  <Button
                    variant="outline" disabled={active.key === OAUTH_KEY && metaBusy}
                    onClick={() => (active.key === OAUTH_KEY ? void disconnectMeta() : setStatus(active.key, "not_connected"))}
                  >
                    Disconnect
                  </Button>
                </>
              ) : (
                <Button
                  className="flex-1" disabled={active.key === OAUTH_KEY && metaBusy}
                  onClick={() => (active.key === OAUTH_KEY ? void connectMeta() : setStatus(active.key, "connected"))}
                >
                  <Plug className="size-4" />
                  {active.key === OAUTH_KEY ? (metaBusy ? "Connecting…" : "Connect Instagram") : "Connect"}
                </Button>
              )}
              <Button variant="outline" onClick={() => toast("Docs", { description: active.docsUrl })}><ExternalLink className="size-4" /> Docs</Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold">{icon} {title}</p>
      {children}
    </div>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return <div className="mt-2 flex items-center justify-between rounded-lg bg-muted/40 px-3 py-1.5 text-sm"><span className="text-muted-foreground">{label}</span><span className="font-medium">{value}</span></div>;
}
function MetaTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">{icon} {label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}
