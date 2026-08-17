"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Plug, RefreshCw, ShieldCheck, KeyRound, Webhook, FlaskConical, Database,
  ExternalLink, CheckCircle2, XCircle, Info, BarChart3, Megaphone,
} from "lucide-react";
import { connectionConfigs, useConnections, type ConnectionKey } from "@/lib/connections";
import { PageBody, PageHeader, SectionCard, EmptyState, StatusPill } from "@/components/ui/page-shell";
import { Field, TextInput, SecretInput } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function ConnectionPage({ connectionKey }: { connectionKey: ConnectionKey }) {
  const cfg = connectionConfigs[connectionKey];
  const { setCredential, getCredentials, getState, testConnection, connect, disconnect, sync } = useConnections();
  const creds = getCredentials(connectionKey);
  const state = getState(connectionKey);
  const [busy, setBusy] = useState(false);

  const connected = state.status === "connected";
  const isAds = cfg.kind === "ads";

  function handleTest() {
    const r = testConnection(connectionKey);
    if (r.ok) toast.success("Connection test passed", { description: r.message });
    else toast.error("Not ready yet", { description: r.message });
  }
  function handleConnect() {
    setBusy(true);
    setTimeout(() => {
      const r = connect(connectionKey);
      setBusy(false);
      if (r.ok) {
        toast.success(`${cfg.name} connected`, { description: "Credentials saved. Live data will flow once the API is authorized." });
      } else {
        toast.error("Add the required credentials first", { description: r.message });
      }
    }, 500);
  }
  function handleSync() {
    sync(connectionKey);
    toast.success("Sync requested", { description: "Live data arrives once the API credentials are authorized." });
  }

  return (
    <PageBody>
      <PageHeader
        icon={isAds ? Megaphone : Plug}
        eyebrow={isAds ? "Advertising" : "Social platform"}
        title={cfg.name}
        description={cfg.whatItDoes}
        actions={
          <>
            <Button variant="secondary" onClick={handleTest}><FlaskConical className="size-4" /> Test connection</Button>
            {connected ? (
              <>
                <Button variant="secondary" onClick={handleSync}><RefreshCw className="size-4" /> Sync now</Button>
                <Button variant="outline" onClick={() => { disconnect(connectionKey); toast("Disconnected"); }}>Disconnect</Button>
              </>
            ) : (
              <Button onClick={handleConnect} disabled={busy}>
                <Plug className="size-4" /> {busy ? "Connecting…" : "Connect"}
              </Button>
            )}
          </>
        }
      />

      {/* Status strip */}
      <Card className="flex flex-wrap items-center gap-x-8 gap-y-3 p-4">
        <Stat label="Status">
          <StatusPill tone={connected ? "success" : "muted"}>
            <span className={cn("size-1.5 rounded-full", connected ? "bg-success" : "bg-muted-foreground/50")} />
            {connected ? "Connected" : "Not connected"}
          </StatusPill>
        </Stat>
        <Stat label="Health"><span className={cn("text-sm font-medium", connected ? "text-success" : "text-muted-foreground")}>{connected ? "Healthy" : "—"}</span></Stat>
        <Stat label="Last sync"><span className="text-sm font-medium">{state.lastSync ? new Date(state.lastSync).toLocaleString() : "Never"}</span></Stat>
        <Stat label="OAuth"><span className="text-sm font-medium">{connected ? "Authorized" : "Ready — not authorized"}</span></Stat>
        <Stat label="Webhooks"><span className="text-sm font-medium">{cfg.webhook}</span></Stat>
      </Card>

      {/* Performance / metrics — empty until connected */}
      <SectionCard
        title={isAds ? "Performance" : "Account overview"}
        description={connected ? "Live figures appear here once the API is authorized." : "Connect the account to see real numbers here."}
        icon={BarChart3}
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {cfg.metrics.map((m) => (
            <div key={m} className="rounded-xl border border-border bg-muted/20 p-3">
              <p className="text-[11px] text-muted-foreground">{m}</p>
              <p className="mt-1 text-lg font-semibold text-muted-foreground/50">—</p>
            </div>
          ))}
        </div>
      </SectionCard>

      {isAds && (
        <SectionCard title="Campaigns" description="Your live campaigns will be listed here." icon={Megaphone}>
          <EmptyState
            icon={Megaphone}
            title={connected ? "No campaigns synced yet" : "Connect to load campaigns"}
            description={connected ? "Press “Sync now” once the API credentials are authorized." : "Add your credentials below, then connect the account."}
            className="border-0 bg-transparent py-10"
          />
        </SectionCard>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Credentials */}
        <div className="lg:col-span-2">
          <SectionCard
            title="Credentials"
            description="Add these when you have them — they're stored for this workspace and never shown in full."
            icon={KeyRound}
          >
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-accent/25 bg-accent/[0.06] p-3">
              <Info className="mt-0.5 size-4 shrink-0 text-accent" />
              <p className="text-xs text-muted-foreground">
                You don&apos;t need these to use the rest of the dashboard. Fill them in when your {cfg.name} developer
                access is approved, then press <strong className="text-foreground">Test connection</strong>.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {cfg.fields.map((f) => (
                <Field key={f.key} label={f.label} hint={f.hint} required={f.required} htmlFor={`${cfg.key}-${f.key}`} className={f.secret ? "sm:col-span-2" : ""}>
                  {f.secret ? (
                    <SecretInput id={`${cfg.key}-${f.key}`} value={creds[f.key] ?? ""} onChange={(v) => setCredential(connectionKey, f.key, v)} placeholder={f.placeholder} />
                  ) : (
                    <TextInput
                      id={`${cfg.key}-${f.key}`}
                      value={creds[f.key] ?? ""}
                      onChange={(e) => setCredential(connectionKey, f.key, e.target.value)}
                      placeholder={f.placeholder}
                      autoComplete="off"
                      spellCheck={false}
                    />
                  )}
                </Field>
              ))}
            </div>

            {state.lastTest && (
              <div className={cn("mt-4 flex items-start gap-2 rounded-xl border p-3 text-sm", state.lastTest.ok ? "border-success/30 bg-success/[0.06] text-success" : "border-warning/30 bg-warning/[0.06] text-warning")}>
                {state.lastTest.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <XCircle className="mt-0.5 size-4 shrink-0" />}
                <div>
                  <p className="font-medium">{state.lastTest.ok ? "Ready to connect" : "Not ready yet"}</p>
                  <p className="text-xs opacity-80">{state.lastTest.message}</p>
                </div>
              </div>
            )}
          </SectionCard>
        </div>

        {/* Technical detail */}
        <div className="space-y-5">
          <SectionCard title="Permissions" icon={ShieldCheck} description="Scopes requested during authorization.">
            <div className="flex flex-wrap gap-1.5">
              {cfg.scopes.map((s) => (
                <code key={s} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">{s}</code>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Environment variables" icon={KeyRound} description="Set these on the server for production.">
            <div className="space-y-1">
              {cfg.envVars.map((e) => (
                <code key={e} className="block rounded bg-muted px-2 py-1 font-mono text-[11px]">{e}</code>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Webhooks" icon={Webhook}>
            <p className="text-sm">{cfg.webhook}</p>
          </SectionCard>

          <SectionCard title="Sample response" icon={Database} description="What the API returns once connected.">
            <pre className="overflow-x-auto rounded-lg border border-border bg-muted/50 p-3 font-mono text-[11px] leading-relaxed">{cfg.sampleResponse}</pre>
            <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => toast("Documentation", { description: cfg.docsUrl })}>
              <ExternalLink className="size-4" /> View documentation
            </Button>
          </SectionCard>
        </div>
      </div>
    </PageBody>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}
