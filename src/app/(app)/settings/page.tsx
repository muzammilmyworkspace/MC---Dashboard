"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import {
  User as UserIcon, Bell, ShieldCheck, Palette, Building2, Plug, Check,
  Monitor, Moon, Sun, LogOut, Laptop, Smartphone, KeyRound,
} from "lucide-react";
import { PageBody, PageHeader, SectionCard, StatusPill } from "@/components/ui/page-shell";
import { Field, TextInput, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { useSettings, languages, timezones, avatarPalette, settingsDefaults, type NotificationPrefs } from "@/lib/settings";
import { connectionConfigs, useConnections, type ConnectionKey } from "@/lib/connections";
import { useUI } from "@/lib/store";
import { roleLabel } from "@/lib/data";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "profile", label: "Profile", icon: UserIcon },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "accounts", label: "Connected accounts", icon: Plug },
  { key: "security", label: "Security", icon: ShieldCheck },
  { key: "appearance", label: "Appearance", icon: Palette },
  { key: "workspace", label: "Workspace", icon: Building2 },
] as const;
type TabKey = (typeof TABS)[number]["key"];

function SettingsInner() {
  const params = useSearchParams();
  const initial = (params.get("tab") as TabKey) ?? "profile";
  const [tab, setTab] = useState<TabKey>(TABS.some((t) => t.key === initial) ? initial : "profile");

  const { profile, notifications, workspace, setProfile, setNotifications, setWorkspace } = useSettings();
  const { viewAs, signOut } = useUI();
  const { theme, setTheme } = useTheme();

  // Draft copies so Cancel actually reverts.
  const [draftProfile, setDraftProfile] = useState(profile);
  const [draftWorkspace, setDraftWorkspace] = useState(workspace);
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwError, setPwError] = useState<string | null>(null);

  function saveProfile() {
    if (!draftProfile.name.trim()) return toast.error("Name can't be empty");
    setProfile(draftProfile);
    toast.success("Profile saved");
  }
  function saveWorkspace() {
    if (!draftWorkspace.name.trim()) return toast.error("Workspace name can't be empty");
    setWorkspace(draftWorkspace);
    toast.success("Workspace settings saved");
  }
  function changePassword() {
    if (pw.next.length < 8) return setPwError("Use at least 8 characters.");
    if (pw.next !== pw.confirm) return setPwError("The two new passwords don't match.");
    if (!pw.current) return setPwError("Enter your current password.");
    setPwError(null);
    setPw({ current: "", next: "", confirm: "" });
    toast.success("Password updated");
  }

  return (
    <PageBody>
      <PageHeader
        icon={UserIcon}
        eyebrow="Settings"
        title="Profile & workspace"
        description="Manage your details, how you're notified, and how the workspace behaves."
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[220px_1fr]">
        {/* Tabs */}
        <nav className="no-scrollbar flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex shrink-0 items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors lg:w-full",
                tab === t.key ? "bg-accent/10 text-accent" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <t.icon className="size-4" /> {t.label}
            </button>
          ))}
        </nav>

        <div className="space-y-5">
          {/* ------------------------------ Profile ----------------------------- */}
          {tab === "profile" && (
            <>
              <SectionCard
                title="Profile information"
                description="How you appear across the workspace."
                actions={
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={() => setDraftProfile(profile)}>Cancel</Button>
                    <Button size="sm" onClick={saveProfile}><Check className="size-4" /> Save</Button>
                  </div>
                }
              >
                <div className="flex flex-col gap-5 sm:flex-row">
                  <div className="flex flex-col items-center gap-3">
                    <Avatar name={draftProfile.name || "MC"} color={draftProfile.avatarColor} size={72} />
                    <div className="flex flex-wrap justify-center gap-1.5" style={{ maxWidth: 132 }}>
                      {avatarPalette.map((c) => (
                        <button
                          key={c}
                          onClick={() => setDraftProfile({ ...draftProfile, avatarColor: c })}
                          aria-label={`Use colour ${c}`}
                          className={cn("size-5 rounded-full ring-2 transition-transform hover:scale-110", draftProfile.avatarColor === c ? "ring-foreground" : "ring-transparent")}
                          style={{ background: c }}
                        />
                      ))}
                    </div>
                    <p className="text-[11px] text-muted-foreground">Avatar colour</p>
                  </div>

                  <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Full name" required htmlFor="name">
                      <TextInput id="name" value={draftProfile.name} onChange={(e) => setDraftProfile({ ...draftProfile, name: e.target.value })} />
                    </Field>
                    <Field label="Job title" htmlFor="title">
                      <TextInput id="title" value={draftProfile.title} onChange={(e) => setDraftProfile({ ...draftProfile, title: e.target.value })} />
                    </Field>
                    <Field label="Email" hint="Used for sign-in and notifications." htmlFor="email">
                      <TextInput id="email" type="email" value={draftProfile.email} onChange={(e) => setDraftProfile({ ...draftProfile, email: e.target.value })} />
                    </Field>
                    <Field label="Role" hint="Set by an administrator.">
                      <div className="flex h-10 items-center rounded-lg border border-border bg-muted/40 px-3 text-sm">{roleLabel[viewAs]}</div>
                    </Field>
                    <Field label="Language" htmlFor="lang">
                      <Select id="lang" value={draftProfile.language} onChange={(e) => setDraftProfile({ ...draftProfile, language: e.target.value })}>
                        {languages.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                      </Select>
                    </Field>
                    <Field label="Timezone" hint="Posting times use this zone." htmlFor="tz">
                      <Select id="tz" value={draftProfile.timezone} onChange={(e) => setDraftProfile({ ...draftProfile, timezone: e.target.value })}>
                        {timezones.map((t) => <option key={t} value={t}>{t}</option>)}
                      </Select>
                    </Field>
                  </div>
                </div>
              </SectionCard>
            </>
          )}

          {/* --------------------------- Notifications -------------------------- */}
          {tab === "notifications" && (
            <SectionCard title="Notification preferences" description="Choose what you want to hear about." icon={Bell}>
              <div className="space-y-1">
                {([
                  ["contentApproved", "Content approved", "When the client approves a post."],
                  ["changesRequested", "Changes requested", "When something needs another pass."],
                  ["newComment", "New comment", "When someone comments on content."],
                  ["upcomingPost", "Upcoming post reminder", "The day before something goes live."],
                  ["weeklySummary", "Weekly summary", "A Monday round-up of the week ahead."],
                  ["emailDigest", "Also send by email", "Receive the same alerts in your inbox."],
                ] as [keyof NotificationPrefs, string, string][]).map(([key, label, hint]) => (
                  <Toggle
                    key={key}
                    checked={notifications[key]}
                    onChange={(v) => { setNotifications({ [key]: v } as Partial<NotificationPrefs>); toast.success("Preference saved"); }}
                    label={label}
                    hint={hint}
                  />
                ))}
              </div>
            </SectionCard>
          )}

          {/* ------------------------- Connected accounts ----------------------- */}
          {tab === "accounts" && <ConnectedAccounts />}

          {/* ------------------------------ Security ---------------------------- */}
          {tab === "security" && (
            <>
              <SectionCard title="Change password" description="Use at least 8 characters." icon={KeyRound}>
                <div className="grid max-w-md grid-cols-1 gap-4">
                  <Field label="Current password" htmlFor="cpw">
                    <TextInput id="cpw" type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
                  </Field>
                  <Field label="New password" htmlFor="npw">
                    <TextInput id="npw" type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
                  </Field>
                  <Field label="Confirm new password" error={pwError ?? undefined} htmlFor="rpw">
                    <TextInput id="rpw" type="password" invalid={!!pwError} value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
                  </Field>
                  <div><Button onClick={changePassword}><Check className="size-4" /> Update password</Button></div>
                </div>
              </SectionCard>

              <SectionCard title="Active sessions" description="Devices currently signed in to this workspace." icon={ShieldCheck}>
                <div className="space-y-2">
                  {[
                    { icon: Laptop, device: "This device — Chrome on Windows", where: "Amsterdam, NL", current: true },
                    { icon: Smartphone, device: "iPhone — Safari", where: "Amsterdam, NL", current: false },
                  ].map((s) => (
                    <div key={s.device} className="flex items-center gap-3 rounded-xl border border-border p-3">
                      <div className="flex size-9 items-center justify-center rounded-lg bg-muted"><s.icon className="size-4 text-muted-foreground" /></div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{s.device}</p>
                        <p className="text-xs text-muted-foreground">{s.where}</p>
                      </div>
                      {s.current ? <StatusPill tone="success">Current</StatusPill> : (
                        <Button variant="outline" size="sm" onClick={() => toast("Session revoked")}>Revoke</Button>
                      )}
                    </div>
                  ))}
                </div>
                <Button variant="outline" className="mt-4" onClick={() => { signOut(); toast("Signed out of all devices"); }}>
                  <LogOut className="size-4" /> Sign out everywhere
                </Button>
              </SectionCard>
            </>
          )}

          {/* ---------------------------- Appearance ---------------------------- */}
          {tab === "appearance" && (
            <SectionCard title="Appearance" description="Choose how the dashboard looks." icon={Palette}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[
                  { key: "light", label: "Light", icon: Sun },
                  { key: "dark", label: "Dark", icon: Moon },
                  { key: "system", label: "System", icon: Monitor },
                ].map((o) => (
                  <button
                    key={o.key}
                    onClick={() => { setTheme(o.key); toast.success(`${o.label} theme applied`); }}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-xl border p-5 transition-colors",
                      theme === o.key ? "border-accent bg-accent/[0.06]" : "border-border hover:border-accent/40"
                    )}
                  >
                    <o.icon className={cn("size-5", theme === o.key ? "text-accent" : "text-muted-foreground")} />
                    <span className="text-sm font-medium">{o.label}</span>
                  </button>
                ))}
              </div>
            </SectionCard>
          )}

          {/* ---------------------------- Workspace ----------------------------- */}
          {tab === "workspace" && (
            <SectionCard
              title="Workspace settings"
              description="Applies to everyone in this workspace."
              icon={Building2}
              actions={
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setDraftWorkspace(workspace)}>Cancel</Button>
                  <Button size="sm" onClick={saveWorkspace}><Check className="size-4" /> Save</Button>
                </div>
              }
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Workspace name" required htmlFor="wsname">
                  <TextInput id="wsname" value={draftWorkspace.name} onChange={(e) => setDraftWorkspace({ ...draftWorkspace, name: e.target.value })} />
                </Field>
                <Field label="Client name" htmlFor="client">
                  <TextInput id="client" value={draftWorkspace.clientName} onChange={(e) => setDraftWorkspace({ ...draftWorkspace, clientName: e.target.value })} />
                </Field>
                <Field label="Default posting time" hint="Used when you add a new post." htmlFor="dpt">
                  <TextInput id="dpt" type="time" value={draftWorkspace.defaultPostTime} onChange={(e) => setDraftWorkspace({ ...draftWorkspace, defaultPostTime: e.target.value })} />
                </Field>
                <Field label="Week starts on">
                  <Select value={draftWorkspace.weekStartsMonday ? "mon" : "sun"} onChange={(e) => setDraftWorkspace({ ...draftWorkspace, weekStartsMonday: e.target.value === "mon" })}>
                    <option value="mon">Monday</option>
                    <option value="sun">Sunday</option>
                  </Select>
                </Field>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-5"
                onClick={() => { setDraftWorkspace(settingsDefaults.workspace); toast("Reset to defaults — press Save to apply"); }}
              >
                Reset to defaults
              </Button>
            </SectionCard>
          )}
        </div>
      </div>
    </PageBody>
  );
}

function ConnectedAccounts() {
  const { getState } = useConnections();
  const keys = Object.keys(connectionConfigs) as ConnectionKey[];
  return (
    <SectionCard title="Connected accounts" description="Ad and social platforms linked to this workspace." icon={Plug}>
      <div className="space-y-2">
        {keys.map((k) => {
          const cfg = connectionConfigs[k];
          const st = getState(k);
          const connected = st.status === "connected";
          return (
            <div key={k} className="flex items-center gap-3 rounded-xl border border-border p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{cfg.name}</p>
                <p className="truncate text-xs text-muted-foreground">{cfg.blurb}</p>
              </div>
              <StatusPill tone={connected ? "success" : "muted"}>{connected ? "Connected" : "Not connected"}</StatusPill>
              <Button variant="outline" size="sm" asChild><Link href={`/${k}`}>Manage</Link></Button>
            </div>
          );
        })}
      </div>
      <Card className="mt-4 p-3">
        <p className="text-xs text-muted-foreground">
          Looking for storage, email or AI connections? Those live in the{" "}
          <Link href="/integrations" className="font-medium text-accent hover:underline">Integration Center</Link>.
        </p>
      </Card>
    </SectionCard>
  );
}

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint: string }) {
  return (
    <button onClick={() => onChange(!checked)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-muted/50">
      <span className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors", checked ? "bg-accent" : "bg-muted-foreground/30")}>
        <span className={cn("absolute top-0.5 size-4 rounded-full bg-white transition-transform", checked ? "translate-x-[18px]" : "translate-x-0.5")} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </button>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="skeleton h-96 rounded-2xl" />}>
      <SettingsInner />
    </Suspense>
  );
}
