"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { LogoMark } from "@/components/brand/logo";

const brandIdeas = ["Mission Control", "PulseOS", "Creator Command", "Elevate Studio", "The Growth Hub"];

export default function SplashScreen() {
  const router = useRouter();
  const [progress, setProgress] = useState(0);
  const [ideaIdx, setIdeaIdx] = useState(0);

  useEffect(() => {
    const p = setInterval(() => {
      setProgress((v) => (v >= 100 ? 100 : v + Math.random() * 18));
    }, 180);
    const rotate = setInterval(() => setIdeaIdx((i) => (i + 1) % brandIdeas.length), 900);
    const done = setTimeout(() => router.push("/login"), 2700);
    return () => {
      clearInterval(p);
      clearInterval(rotate);
      clearTimeout(done);
    };
  }, [router]);

  return (
    <div className="relative flex h-dvh flex-col items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-grid opacity-[0.35]" />
      <motion.div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(139,92,246,0.22), transparent 60%)" }}
        animate={{ scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative flex flex-col items-center">
        <motion.div
          initial={{ scale: 0.6, opacity: 0, rotate: -8 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 140, damping: 12 }}
        >
          <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}>
            <LogoMark size={92} />
          </motion.div>
        </motion.div>

        <motion.h1
          className="mt-7 text-4xl font-bold tracking-tight"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.6 }}
        >
          NEXUS <span className="text-gradient">HQ</span>
        </motion.h1>

        <motion.p
          className="mt-2 text-sm text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          One Dashboard. Every Task. Total Visibility.
        </motion.p>

        <div className="mt-10 h-1 w-56 overflow-hidden rounded-full bg-muted">
          <motion.div
            className="h-full rounded-full"
            style={{ background: "linear-gradient(90deg,#a78bfa,#8b5cf6,#6366f1)" }}
            animate={{ width: `${Math.min(progress, 100)}%` }}
            transition={{ ease: "easeOut" }}
          />
        </div>

        <div className="mt-4 h-4 text-[11px] uppercase tracking-[0.2em] text-muted-foreground/70">
          <AnimatePresence mode="wait">
            <motion.span
              key={ideaIdx}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3 }}
            >
              {brandIdeas[ideaIdx]}
            </motion.span>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
