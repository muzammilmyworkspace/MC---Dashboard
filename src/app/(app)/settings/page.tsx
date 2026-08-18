"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { motion } from "framer-motion";
import {
  User as UserIcon, SlidersHorizontal, ShieldCheck, Plug, LogOut,
  Sun, Moon, Monitor, Info, ArrowRight,
} from "lucide-react";
import { useUI } from "@/lib/store";
import { platformModules } from "@/lib/modules-registry";
import { usePlatformStatus } from "@/lib/platform-status";
import { currentUser, roleLabel, users } from "@/lib/data";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { StatusDot } from "@/components/ui/status-dot";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "account", label: "Account", icon: UserIcon },
  { key: "preferences", label: "Preferences", icon: SlidersHorizontal },
  { key: "security", label: "Security", icon: ShieldCheck },
  { key: "integrations", label: "Integrations", icon: Plug },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function SettingsPage() {
  return (
    <Suspense fallback={<Card className="h-64 animate-pulse bg-muted/40" />}>
      <SettingsInner />
    </Suspense>
  );
}

function SettingsInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { viewAs, signOut } = useUI();
  const requested = params.get("tab") as TabKey | null;
  const [tab, setTab] = useState<TabKey>(
    TABS.some((t) => t.key === requested) ? (requested as TabKey) : "account"
  );
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  const user = users.find((u) => u.role === viewAs) ?? currentUser;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto w-full max-w-5xl space-y-6"
    >
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Settings</h2>
        <p className="mt-1 text-sm text-muted-foreground">Manage your account, preferences and connections.</p>
      </div>

      <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 rounded-lg border px-3.5 py-2 text-[13px] font-medium transition-colors",
              tab === t.key
                ? "border-accent/40 bg-accent-soft text-accent"
                : "border-border text-muted-foreground hover:border-accent/30 hover:text-foreground"
            )}
          >
            <t.icon className="size-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "account" && <AccountTab name={user.name} email={user.email} color={user.avatarColor} role={roleLabel[user.role]} />}
      {tab === "preferences" && <PreferencesTab />}
      {tab === "security" && <SecurityTab />}
      {tab === "integrations" && <IntegrationsTab />}

      <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <p className="text-sm font-semibold">Log out</p>
          <p className="mt-0.5 text-xs text-muted-foreground">End this session on this device.</p>
        </div>
        <Button variant="outline" onClick={() => setConfirmSignOut(true)}>
          <LogOut className="size-4" /> Log out
        </Button>
      </Card>

      <Dialog open={confirmSignOut} onOpenChange={setConfirmSignOut}>
        <DialogContent className="max-w-sm p-6">
          <DialogTitle>Log out?</DialogTitle>
          <p className="mt-2 text-sm text-muted-foreground">
            You&apos;ll need to sign in again. Connected platforms stay connected.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmSignOut(false)}>Cancel</Button>
            <Button onClick={() => { setConfirmSignOut(false); signOut(); router.replace("/login"); }}>
              <LogOut className="size-4" /> Log out
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

/* --------------------------------- tabs ---------------------------------- */

function AccountTab({ name, email, color, role }: { name: string; email: string; color: string; role: string }) {
  return (
    <div className="space-y-4">
      <Section title="Profile" description="How you appear across the workspace.">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name={name} color={color} size={56} />
          <div className="min-w-0">
            <p className="text-sm font-semibold">{name}</p>
            <p className="truncate text-sm text-muted-foreground">{email}</p>
            <p className="mt-1 text-xs text-muted-foreground">{role}</p>
          </div>
        </div>
        <ReadOnlyNote>
          Profile details come from your account on the server. Editing them from the dashboard
          isn&apos;t built yet.
        </ReadOnlyNote>
      </Section>
    </div>
  );
}

function PreferencesTab() {
  const { theme, setTheme } = useTheme();
  const options = [
    { key: "light", label: "Light", icon: Sun },
    { key: "dark", label: "Dark", icon: Moon },
    { key: "system", label: "System", icon: Monitor },
  ];

  return (
    <div className="space-y-4">
      <Section title="Theme" description="Applies immediately and is remembered on this device.">
        <div className="flex flex-wrap gap-2">
          {options.map((o) => (
            <button
              key={o.key}
              onClick={() => setTheme(o.key)}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-[13px] font-medium transition-colors",
                theme === o.key
                  ? "border-accent/40 bg-accent-soft text-accent"
                  : "border-border text-muted-foreground hover:border-accent/30 hover:text-foreground"
              )}
            >
              <o.icon className="size-4" /> {o.label}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Notifications" description="Which events reach you.">
        <ReadOnlyNote>
          Notification delivery isn&apos;t wired up yet. In-app notifications appear in the bell menu.
        </ReadOnlyNote>
      </Section>
    </div>
  );
}

function SecurityTab() {
  return (
    <div className="space-y-4">
      <Section title="Password" description="Used to sign in to MC Nexus.">
        <ReadOnlyNote>
          Password changes aren&apos;t available from the dashboard yet. Accounts are managed on the server.
        </ReadOnlyNote>
      </Section>

      <Section title="Sessions" description="Where you&apos;re signed in.">
        <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
          <div>
            <p className="text-sm font-medium">This device</p>
            <p className="text-xs text-muted-foreground">Current session</p>
          </div>
          <StatusDot state="connected" label="Active" />
        </div>
        <ReadOnlyNote>
          Sessions use refresh tokens that can be revoked server-side. Listing and revoking them
          from here isn&apos;t built yet.
        </ReadOnlyNote>
      </Section>
    </div>
  );
}

function IntegrationsTab() {
  const { statusFor } = usePlatformStatus();
  return (
    <Section title="Connected platforms" description="Manage connections from the Integrations screen.">
      <ul className="divide-y divide-border">
        {platformModules.map((m) => {
          const status = statusFor(m.integrationKey);
          return (
            <li key={m.href} className="flex items-center justify-between gap-3 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <m.icon className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate text-sm">{m.name}</span>
              </div>
              <div className="flex shrink-0 items-center gap-4">
                <StatusDot state={status.state} label={status.label} />
                <Link href={m.href} className="text-muted-foreground transition-colors hover:text-accent">
                  <ArrowRight className="size-4" />
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
      <Button variant="outline" size="sm" className="mt-4" asChild>
        <Link href="/integrations"><Plug className="size-4" /> Open Integrations</Link>
      </Button>
    </Section>
  );
}

/* -------------------------------- helpers -------------------------------- */

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card className="p-5">
      <h3 className="text-sm font-semibold">{title}</h3>
      {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      <div className="mt-4">{children}</div>
    </Card>
  );
}

/** Marks a surface as not-yet-functional instead of showing a dead control. */
function ReadOnlyNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-border bg-muted/30 p-3">
      <Info className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
      <p className="text-xs text-muted-foreground">{children}</p>
    </div>
  );
}
