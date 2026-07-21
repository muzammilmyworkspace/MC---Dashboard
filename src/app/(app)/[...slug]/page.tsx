"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Plug, RefreshCw, CheckCircle2, ArrowRight, Sparkles, Wrench } from "lucide-react";
import { allNavItems } from "@/lib/nav";
import { moduleInfo, defaultModuleInfo } from "@/lib/modules";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function ModuleShell() {
  const pathname = usePathname();
  const nav = allNavItems.find((i) => i.href === pathname);
  const info = moduleInfo[pathname] ?? defaultModuleInfo;
  const Icon = nav?.icon ?? Wrench;
  const label = nav?.label ?? "Module";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex size-14 items-center justify-center rounded-2xl border border-accent/25 bg-accent/12 text-accent">
            <Icon className="size-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold tracking-tight">{label}</h2>
              {info.category === "integration" && (
                <Badge variant={info.connected ? "success" : "secondary"}>
                  {info.connected ? "Connected" : "Not Connected"}
                </Badge>
              )}
            </div>
            <p className="mt-0.5 max-w-xl text-sm text-muted-foreground">{info.subtitle}</p>
          </div>
        </div>
      </div>

      {/* Stats preview */}
      {info.stats && (
        <div className="grid grid-cols-3 gap-4">
          {info.stats.map((s) => (
            <Card key={s.label} className="p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="mt-1 text-2xl font-bold tracking-tight blur-[3px] select-none">{s.value}</p>
              <p className="mt-1 text-[11px] text-muted-foreground/70">Sample · connect to reveal</p>
            </Card>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Feature list + skeleton preview */}
        <Card className="lg:col-span-2 p-6">
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="size-4 text-accent" />
            <h3 className="font-semibold tracking-tight">What this module does</h3>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {info.features.map((f) => (
              <div key={f} className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/20 p-3">
                <CheckCircle2 className="size-4 shrink-0 text-success" />
                <span className="text-sm">{f}</span>
              </div>
            ))}
          </div>

          {/* Skeleton content preview */}
          <div className="mt-6 space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Interface preview</p>
            <div className="space-y-2.5">
              {[90, 70, 82].map((w, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="skeleton size-10 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <div className="skeleton h-3 rounded" style={{ width: `${w}%` }} />
                    <div className="skeleton h-2.5 w-1/3 rounded" />
                  </div>
                  <div className="skeleton h-6 w-16 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Integration / status panel */}
        <div className="space-y-4">
          {info.category === "integration" ? (
            <Card className="p-6">
              <div className="mb-3 flex items-center gap-2">
                <Plug className="size-4 text-accent" />
                <h3 className="font-semibold tracking-tight">Integration</h3>
              </div>
              <div className="space-y-3 text-sm">
                <Row label="Provider" value={info.provider ?? "—"} />
                <Row label="Status" value={info.connected ? "Connected" : "Not connected"} tone={info.connected ? "success" : "muted"} />
                <Row label="Last sync" value={info.connected ? "2 min ago" : "Never"} />
                <Row label="Health" value={info.connected ? "Healthy" : "—"} />
              </div>
              <Button
                className="mt-4 w-full"
                onClick={() => toast("Phase 2", { description: `${info.provider} OAuth connection flow.` })}
              >
                <RefreshCw className="size-4" /> {info.connected ? "Reconnect" : "Connect"}
              </Button>
              <p className="mt-3 text-center text-[11px] text-muted-foreground">
                Modular service layer — ready for live data in Phase 2.
              </p>
            </Card>
          ) : (
            <Card className="p-6">
              <div className="mb-3 flex items-center gap-2">
                <Wrench className="size-4 text-accent" />
                <h3 className="font-semibold tracking-tight">Status</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                This module&apos;s UI is scaffolded and ready. The full interactive build ships next in the roadmap.
              </p>
              <div className="mt-4 rounded-lg border border-accent/25 bg-accent/10 p-3">
                <p className="text-xs font-semibold">Built in this MVP</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Dashboard, Tasks and Content Approval are fully interactive. Explore them from the sidebar.
                </p>
              </div>
              <Button variant="secondary" className="mt-4 w-full" asChild>
                <Link href="/dashboard">Back to Dashboard <ArrowRight className="size-4" /></Link>
              </Button>
            </Card>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function Row({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "success" | "muted" }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={tone === "success" ? "font-medium text-success" : tone === "muted" ? "text-muted-foreground" : "font-medium"}>{value}</span>
    </div>
  );
}
