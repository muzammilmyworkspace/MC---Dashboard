"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Mail, Lock, Eye, EyeOff, ArrowRight, ShieldCheck, Loader2 } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUI } from "@/lib/store";
import { type Role } from "@/lib/data";
import { cn } from "@/lib/utils";

const demoAccounts: { role: Role; name: string; email: string; color: string }[] = [
  { role: "super_admin", name: "Muzammil (Admin)", email: "muzammil@nexus.hq", color: "#8b5cf6" },
  { role: "team_member", name: "Hashaam (Team)", email: "hashaam@nexus.hq", color: "#3b82f6" },
  { role: "client", name: "Elena (Client)", email: "elena@brightwave.co", color: "#10b981" },
];

export default function LoginPage() {
  const router = useRouter();
  const setViewAs = useUI((s) => s.setViewAs);
  const [email, setEmail] = useState("muzammil@nexus.hq");
  const [password, setPassword] = useState("nexus-demo");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function login(role?: Role) {
    if (!email.includes("@") || password.length < 4) {
      setError("Enter a valid email and a password of at least 4 characters.");
      return;
    }
    setError("");
    setLoading(true);
    if (role) setViewAs(role);
    setTimeout(() => router.push("/dashboard"), 850);
  }

  return (
    <div className="relative grid h-dvh lg:grid-cols-2">
      {/* Left — brand / marketing panel */}
      <div className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="absolute inset-0 bg-grid opacity-30" />
        <motion.div
          className="pointer-events-none absolute -left-40 top-0 h-[600px] w-[600px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(139,92,246,0.25), transparent 60%)" }}
          animate={{ x: [0, 40, 0], y: [0, 30, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="pointer-events-none absolute bottom-0 right-0 h-[420px] w-[420px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(59,130,246,0.18), transparent 60%)" }}
          animate={{ x: [0, -30, 0], y: [0, -20, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />

        <div className="relative">
          <Logo size={38} />
        </div>

        <div className="relative max-w-md">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="text-4xl font-bold leading-tight tracking-tight"
          >
            Run your entire agency from{" "}
            <span className="text-gradient">one command center.</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="mt-4 text-muted-foreground"
          >
            Tasks, content approvals, ad performance, the password vault and client
            collaboration — beautifully unified, in real time.
          </motion.p>

          <div className="mt-8 flex flex-wrap gap-2">
            {["Content Approvals", "Meta & Google Ads", "Password Vault", "Real-time Chat"].map((t, i) => (
              <motion.span
                key={t}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.08 }}
                className="glass rounded-full px-3.5 py-1.5 text-xs font-medium"
              >
                {t}
              </motion.span>
            ))}
          </div>
        </div>

        <div className="relative flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="size-4 text-success" />
          SOC 2-ready architecture · AES-256 vault · JWT + RBAC
        </div>
      </div>

      {/* Right — form */}
      <div className="relative flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-sm"
        >
          <div className="mb-8 lg:hidden">
            <Logo size={34} />
          </div>

          <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Sign in to your NEXUS HQ workspace.
          </p>

          <form
            className="mt-7 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              login();
            }}
          >
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Email</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-10"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@agency.com"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">Password</label>
                <button type="button" className="text-xs text-accent hover:underline">
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-10 pr-10"
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setRemember((r) => !r)}
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <span
                  className={cn(
                    "flex size-4 items-center justify-center rounded border transition-colors",
                    remember ? "border-accent bg-accent" : "border-border"
                  )}
                >
                  {remember && <div className="size-2 rounded-[2px] bg-white" />}
                </span>
                Remember me
              </button>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                2FA ready
              </span>
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-xs text-danger"
              >
                {error}
              </motion.p>
            )}

            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Signing in…
                </>
              ) : (
                <>
                  Sign in <ArrowRight className="size-4" />
                </>
              )}
            </Button>

            <Button type="button" variant="secondary" size="lg" className="w-full" onClick={() => login()}>
              <GoogleIcon /> Continue with Google
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-widest text-muted-foreground/60">
            <div className="h-px flex-1 bg-border" /> Demo accounts <div className="h-px flex-1 bg-border" />
          </div>

          <div className="grid gap-2">
            {demoAccounts.map((a) => (
              <button
                key={a.role}
                onClick={() => {
                  setEmail(a.email);
                  login(a.role);
                }}
                className="group flex items-center gap-3 rounded-lg border border-border bg-card/50 px-3 py-2.5 text-left transition-all hover:border-accent/40 hover:bg-muted"
              >
                <span
                  className="flex size-8 items-center justify-center rounded-full text-xs font-semibold text-white"
                  style={{ background: a.color }}
                >
                  {a.name[0]}
                </span>
                <div className="flex-1">
                  <div className="text-sm font-medium">{a.name}</div>
                  <div className="text-xs text-muted-foreground">{a.email}</div>
                </div>
                <ArrowRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
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
