"use client";

import { useState } from "react";
import { CheckCircle2, AlertTriangle, ExternalLink, RefreshCw } from "lucide-react";
import { api, ApiRequestError, type VercelConnectionResult } from "@/lib/api";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ *
 *  Vercel setup
 *
 *  Explains how to supply the token without ever showing one. Nothing
 *  in this component reads, echoes or accepts a token value — the only
 *  place it may be entered is the environment file on the server.
 * ------------------------------------------------------------------ */

const STEPS = [
  {
    title: "Create a Vercel token",
    body: (
      <>
        Open{" "}
        <a
          href="https://vercel.com/account/tokens"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-medium text-accent hover:underline"
        >
          Vercel → Account Settings → Tokens <ExternalLink className="size-3" />
        </a>{" "}
        and create one. Read access is enough. If the projects belong to a team, give the token access to that team.
      </>
    ),
  },
  {
    title: "Add it to the server environment",
    body: (
      <>
        Put it in <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">.env.local</code> at the project
        root for local work, and in <span className="font-medium">Vercel → Settings → Environment Variables</span> for
        the live dashboard.
      </>
    ),
    code: "VERCEL_TOKEN=your_token_here\nVERCEL_TEAM_ID=team_xxx   # only for team accounts",
  },
  {
    title: "Restart the server",
    body: <>Environment variables are read at startup, so the running server will not pick up a new token on its own.</>,
  },
  {
    title: "Test the connection",
    body: <>Confirm MC Nexus can reach Vercel before trying to import anything.</>,
  },
];

export function SetupDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [result, setResult] = useState<VercelConnectionResult | null>(null);
  const [testing, setTesting] = useState(false);

  async function test() {
    setTesting(true);
    try {
      setResult(await api.landingPages.testVercel());
    } catch (err) {
      setResult({
        ok: false,
        message: err instanceof ApiRequestError ? err.message : "Unable to connect to Vercel.",
        account: null,
        teamScoped: false,
        missingEnv: [],
      });
    } finally {
      setTesting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent side="right" className="flex flex-col gap-0 overflow-hidden p-0">
        <header className="border-b border-border px-5 py-4 pr-14 sm:px-6">
          <DialogTitle>Connect Vercel</DialogTitle>
          <DialogDescription className="mt-1">
            Four steps, done once. MC Nexus reads your deployments; it never changes them.
          </DialogDescription>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <ol className="space-y-5">
            {STEPS.map((step, i) => (
              <li key={step.title} className="flex gap-3.5">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-xs font-semibold text-muted-foreground">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{step.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                  {step.code && (
                    <pre className="mt-2 overflow-x-auto rounded-lg border border-border bg-muted/50 p-3 text-[11px] leading-relaxed text-muted-foreground">
                      {step.code}
                    </pre>
                  )}
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-6 rounded-xl border border-border bg-muted/30 p-4">
            <p className="text-xs leading-relaxed text-muted-foreground">
              The token stays on the server. It is never sent to the browser, never written to the database, and never
              shown in this dashboard.
            </p>
          </div>

          {result && (
            <div
              className={cn(
                "mt-4 flex items-start gap-2.5 rounded-xl border p-3.5",
                result.ok ? "border-success/30 bg-success/5" : "border-danger/30 bg-danger/5"
              )}
              role="status"
            >
              {result.ok ? (
                <CheckCircle2 className="mt-px size-4 shrink-0 text-success" />
              ) : (
                <AlertTriangle className="mt-px size-4 shrink-0 text-danger" />
              )}
              <div className="min-w-0">
                <p className={cn("text-sm font-medium", result.ok ? "text-success" : "text-danger")}>
                  {result.ok ? "Vercel connected successfully" : "Unable to connect to Vercel"}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{result.message}</p>
                {result.missingEnv.length > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Missing: <span className="font-mono">{result.missingEnv.join(", ")}</span>
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <footer className="flex gap-2 border-t border-border px-5 py-3.5 sm:px-6">
          <Button onClick={test} disabled={testing} className="flex-1 sm:flex-none">
            {testing ? <RefreshCw className="size-4 animate-spin" /> : null}
            {testing ? "Testing…" : "Test Connection"}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 sm:flex-none">
            Close
          </Button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
