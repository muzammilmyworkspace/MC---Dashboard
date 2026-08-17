"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Mail, Lock, Eye, EyeOff, ArrowRight, Loader2, BadgeCheck, Megaphone, Users, LineChart } from "lucide-react";
import { Logo, LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUI } from "@/lib/store";
import { users, roleLabel, type Role, type User } from "@/lib/data";
import { initials, cn } from "@/lib/utils";

const highlights = [
  { icon: BadgeCheck, label: "Content Approval", desc: "Review & approve every post in one place" },
  { icon: Megaphone, label: "Campaign Management", desc: "Ads & marketing operations, unified" },
  { icon: Users, label: "Team Collaboration", desc: "Comments, roles & real-time updates" },
  { icon: LineChart, label: "Marketing Operations", desc: "Your whole ecosystem at a glance" },
];

export default function LoginPage() {
  const router = useRouter();
  const signIn = useUI((s) => s.signIn);
  const [email, setEmail] = useState(users[0].email);
  const [password, setPassword] = useState("maincharacter");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function login(role?: Role) {
    if (!email.includes("@") || password.length < 4) {
      setError("Enter a valid email and a password of at least 4 characters.");
      return;
    }
    setError("");
    setLoading(true);
    const resolved: Role = role ?? users.find((u) => u.email === email)?.role ?? "team";
    signIn(resolved);
    const dest = resolved === "client" ? "/calendar" : "/dashboard";
    setTimeout(() => router.push(dest), 700);
  }

  function pickProfile(u: User) {
    setEmail(u.email);
    login(u.role);
  }

  return (
    <div className="grid h-dvh lg:grid-cols-[1.05fr_1fr]">
      {/* Left — premium branding */}
      <div className="relative hidden overflow-hidden bg-[#111111] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        {/* warm ambient */}
        <div className="absolute inset-0 bg-grid opacity-[0.15]" />
        <motion.div
          className="pointer-events-none absolute -left-32 top-10 h-[520px] w-[520px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(36,86,214,0.28), transparent 62%)" }}
          animate={{ x: [0, 30, 0], y: [0, 20, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="pointer-events-none absolute -bottom-24 right-0 h-[420px] w-[420px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(59,130,246,0.16), transparent 60%)" }}
          animate={{ x: [0, -20, 0], y: [0, -16, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* Faint oversized compass */}
        <div className="pointer-events-none absolute -right-24 top-1/2 -translate-y-1/2 text-white/[0.04]">
          <LogoMark size={440} />
        </div>

        <div className="relative">
          <Logo size={36} tone="light" />
        </div>

        <div className="relative max-w-md">
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-sm font-medium uppercase tracking-[0.2em] text-accent"
          >
            Welcome to
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mt-3 text-4xl font-semibold leading-[1.1] tracking-tight xl:text-[44px]"
          >
            MC Nexus
            <br />
            <span className="text-white/70">Mission Control</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-4 text-white/60"
          >
            Manage your entire digital ecosystem from one beautifully designed workspace.
          </motion.p>

          <div className="mt-9 grid grid-cols-2 gap-3">
            {highlights.map((h, i) => (
              <motion.div
                key={h.label}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.08 }}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-sm"
              >
                <div className="flex size-9 items-center justify-center rounded-xl bg-accent/15 text-accent">
                  <h.icon className="size-[18px]" />
                </div>
                <p className="mt-3 text-sm font-semibold">{h.label}</p>
                <p className="mt-0.5 text-xs text-white/50">{h.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="relative text-xs text-white/40">
          © {new Date().getFullYear()} MC Nexus · Mission Control — the command center for content & collaboration.
        </div>
      </div>

      {/* Right — sign in */}
      <div className="relative flex items-center justify-center bg-background p-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
          className="w-full max-w-sm"
        >
          <div className="mb-8 lg:hidden">
            <Logo size={34} />
          </div>

          <div className="glass rounded-2xl p-6 shadow-glow sm:p-7">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">Sign In</h2>
                <p className="mt-1 text-sm text-muted-foreground">Access your Mission Control</p>
              </div>
              <span className="rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-accent">
                Demo Workspace
              </span>
            </div>

            <Button variant="secondary" size="lg" className="w-full" onClick={() => login()}>
              <GoogleIcon /> Continue with Google
            </Button>

            <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-widest text-muted-foreground/60">
              <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
            </div>

            <form
              className="space-y-3.5"
              onSubmit={(e) => {
                e.preventDefault();
                login();
              }}
            >
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-10" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@maincharacter.nl" />
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-10 pr-10" type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
                <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>

              {error && (
                <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-xs text-danger">
                  {error}
                </motion.p>
              )}

              <Button type="submit" variant="accent" size="lg" className="w-full" disabled={loading}>
                {loading ? (
                  <><Loader2 className="size-4 animate-spin" /> Signing in…</>
                ) : (
                  <>Sign in <ArrowRight className="size-4" /></>
                )}
              </Button>
            </form>
          </div>

          {/* Demo profiles */}
          <div className="mt-6">
            <p className="mb-2.5 text-center text-[11px] font-medium uppercase tracking-widest text-muted-foreground/70">
              Quick-access demo profiles
            </p>
            <div className="space-y-2">
              {users.map((u) => (
                <button
                  key={u.id}
                  onClick={() => pickProfile(u)}
                  className="group flex w-full items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 text-left shadow-sm transition-all hover:-translate-y-px hover:border-accent/50 hover:shadow-card"
                >
                  <span
                    className="flex size-9 items-center justify-center rounded-full text-xs font-semibold text-white"
                    style={{ background: `linear-gradient(135deg, ${u.avatarColor}, ${u.avatarColor}bb)` }}
                  >
                    {initials(u.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{u.name}</span>
                      <span className={cn("rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide", roleTone(u.role))}>
                        {roleLabel[u.role]}
                      </span>
                    </div>
                    <div className="truncate text-xs text-muted-foreground">{u.email}</div>
                  </div>
                  <ArrowRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function roleTone(role: Role) {
  return role === "team" ? "bg-accent/15 text-accent" : "bg-success/15 text-success";
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" />
    </svg>
  );
}
