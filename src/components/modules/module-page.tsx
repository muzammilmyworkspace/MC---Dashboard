"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Plug, Check } from "lucide-react";
import { moduleFor } from "@/lib/modules-registry";
import { usePlatformStatus } from "@/lib/platform-status";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/ui/status-dot";

/**
 * The page every not-yet-built platform module renders.
 *
 * It shows what the module will cover and its real connection state, and
 * nothing else. There are deliberately no metric tiles: a blurred "38.4k"
 * behind a "connect to reveal" label reads as data the product already has,
 * which is not true and erodes trust in the numbers that *are* real.
 */
export function ModulePage({ href }: { href: string }) {
  const mod = moduleFor(href);
  const { statusFor } = usePlatformStatus();

  if (!mod) return null;

  const status = statusFor(mod.integrationKey);
  const Icon = mod.icon;
  const canConnect = mod.integrationKey !== null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto w-full max-w-5xl space-y-6"
    >
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/40 text-foreground">
          <Icon className="size-7" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="text-xl font-semibold tracking-tight">{mod.name}</h2>
            <StatusDot state={status.state} label={status.label} />
          </div>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">{mod.description}</p>
        </div>
      </div>

      <Card className="p-6 sm:p-8">
        <div className="mx-auto max-w-md text-center">
          <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-xl bg-muted text-foreground">
            <Icon className="size-6" />
          </div>
          <h3 className="text-base font-semibold">
            {canConnect ? `Connect ${mod.name} to get started` : `${mod.name} is coming next`}
          </h3>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
            {canConnect
              ? `Once connected, ${mod.name.toLowerCase()} data will appear here. Manage the connection from the Integrations screen.`
              : `This module is planned. There's no ${mod.name.toLowerCase()} data to show yet, and nothing is being collected.`}
          </p>

          {canConnect && (
            <Button asChild className="mt-5">
              <Link href="/integrations">
                <Plug className="size-4" /> Open Integrations
              </Link>
            </Button>
          )}
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-sm font-semibold">What this module will cover</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">Planned scope — not available yet.</p>
        <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
          {mod.capabilities.map((c) => (
            <li key={c} className="flex items-start gap-2.5 text-sm text-muted-foreground">
              <Check className="mt-0.5 size-4 shrink-0 text-muted-foreground/50" />
              {c}
            </li>
          ))}
        </ul>
      </Card>

      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-accent"
      >
        Back to dashboard <ArrowRight className="size-3.5" />
      </Link>
    </motion.div>
  );
}
