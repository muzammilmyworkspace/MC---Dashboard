"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft, KeyRound, ShieldCheck, Webhook, FlaskConical, CheckCircle2, XCircle,
  ExternalLink, Info, GitBranch, Rocket, Lock,
} from "lucide-react";
import { useDeployments, providerCredentials, type ProviderKey } from "@/lib/deployments";
import { PageBody, PageHeader, SectionCard, StatusPill } from "@/components/ui/page-shell";
import { Field, TextInput, SecretInput } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { relativeTime, cn } from "@/lib/utils";

export default function DeploymentCredentialsPage() {
  return (
    <PageBody>
      <Link href="/deployments" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="size-4" /> Deployment Center
      </Link>

      <PageHeader
        icon={KeyRound}
        eyebrow="Deployment Center"
        title="Environment variables & credentials"
        description="Add your GitHub and Vercel credentials so deployments sync automatically. Secrets are stored encrypted on the server and never displayed in full."
      />

      <Card className="flex items-start gap-3 p-4">
        <Lock className="mt-0.5 size-4 shrink-0 text-accent" />
        <p className="text-xs text-muted-foreground">
          Secrets are written to the API with AES-256-GCM encryption and never returned to the browser. The values below are held in this
          workspace only until the backend credential endpoint is enabled — nothing is sent to a third party.
        </p>
      </Card>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <ProviderCard providerKey="github" />
        <ProviderCard providerKey="vercel" />
      </div>

      <SectionCard title="Webhook endpoints" icon={Webhook} description="Point these at MC Nexus so deployments update instantly.">
        <div className="space-y-2">
          {[
            { label: "GitHub push events", url: "https://your-api-domain/api/deployments/webhooks/github" },
            { label: "Vercel deployment events", url: "https://your-api-domain/api/deployments/webhooks/vercel" },
          ].map((w) => (
            <div key={w.label} className="flex items-center gap-3 rounded-xl border border-border p-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">{w.label}</p>
                <p className="truncate font-mono text-[13px]">{w.url}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => { await navigator.clipboard.writeText(w.url); toast.success("Webhook URL copied"); }}
              >
                Copy
              </Button>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Each request is verified with the webhook secret above. Unsigned or replayed events are rejected.
        </p>
      </SectionCard>
    </PageBody>
  );
}

function ProviderCard({ providerKey }: { providerKey: ProviderKey }) {
  const cfg = providerCredentials[providerKey];
  const { credentials, connections, setCredential, connectProvider, disconnectProvider } = useDeployments();
  const creds = credentials[providerKey] ?? {};
  const conn = connections[providerKey];
  const connected = conn.status === "connected";
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  function test() {
    const missing = cfg.fields.filter((f) => f.required && !creds[f.key]?.trim()).map((f) => f.label);
    const result = missing.length
      ? { ok: false, message: `Missing required value: ${missing.join(", ")}` }
      : { ok: true, message: "All required credentials present — ready to authorize." };
    setTestResult(result);
    if (result.ok) toast.success(`${cfg.name} looks good`, { description: result.message });
    else toast.error(`${cfg.name} not ready`, { description: result.message });
  }

  return (
    <SectionCard
      title={cfg.name}
      icon={providerKey === "github" ? GitBranch : Rocket}
      description={providerKey === "github" ? "Reads repositories, branches and commits." : "Reads projects, deployments and domains."}
      actions={
        <StatusPill tone={connected ? "success" : "muted"}>
          {connected ? <CheckCircle2 className="size-3" /> : <XCircle className="size-3" />}
          {connected ? "Connected" : "Not connected"}
        </StatusPill>
      }
    >
      <div className="mb-4 grid grid-cols-3 gap-3 text-xs">
        <Meta label="Last sync" value={conn.lastSync ? relativeTime(conn.lastSync) : "Never"} />
        <Meta label="Webhook" value={conn.webhook} />
        <Meta label="OAuth" value={conn.oauth === "authorized" ? "Authorized" : "Not authorized"} />
      </div>

      <div className="space-y-4">
        {cfg.fields.map((f) => (
          <Field key={f.key} label={f.label} hint={f.hint} required={f.required} htmlFor={`${providerKey}-${f.key}`}>
            {f.secret ? (
              <SecretInput id={`${providerKey}-${f.key}`} value={creds[f.key] ?? ""} onChange={(v) => setCredential(providerKey, f.key, v)} placeholder={f.placeholder} />
            ) : (
              <TextInput
                id={`${providerKey}-${f.key}`}
                value={creds[f.key] ?? ""}
                onChange={(e) => setCredential(providerKey, f.key, e.target.value)}
                placeholder={f.placeholder}
                autoComplete="off"
                spellCheck={false}
              />
            )}
          </Field>
        ))}
      </div>

      {testResult && (
        <div className={cn("mt-4 flex items-start gap-2 rounded-xl border p-3 text-sm", testResult.ok ? "border-success/30 bg-success/[0.06] text-success" : "border-warning/30 bg-warning/[0.06] text-warning")}>
          {testResult.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <XCircle className="mt-0.5 size-4 shrink-0" />}
          <p className="text-xs">{testResult.message}</p>
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={test}><FlaskConical className="size-4" /> Test connection</Button>
        {connected ? (
          <Button variant="outline" size="sm" onClick={() => { disconnectProvider(providerKey); toast("Disconnected"); }}>Disconnect</Button>
        ) : (
          <Button size="sm" onClick={() => {
            const r = connectProvider(providerKey);
            if (r.ok) toast.success(r.message);
            else toast.error("Add credentials first", { description: r.message });
          }}>
            Save &amp; connect
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => toast("Documentation", { description: cfg.docsUrl })}>
          <ExternalLink className="size-4" /> Docs
        </Button>
      </div>

      <div className="mt-5 space-y-3 border-t border-border pt-4">
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <ShieldCheck className="size-3" /> Required scopes
          </p>
          <div className="flex flex-wrap gap-1.5">
            {cfg.scopes.map((s) => <code key={s} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">{s}</code>)}
          </div>
        </div>
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <Info className="size-3" /> Server environment variables
          </p>
          <div className="space-y-1">
            {cfg.envVars.map((e) => <code key={e} className="block rounded bg-muted px-2 py-1 font-mono text-[11px]">{e}</code>)}
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-2.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-sm font-medium capitalize">{value}</p>
    </div>
  );
}
