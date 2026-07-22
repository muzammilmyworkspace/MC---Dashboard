"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { LogoMark } from "@/components/brand/logo";

const words = ["Content", "Approvals", "Campaigns", "Collaboration"];

export default function SplashScreen() {
  const router = useRouter();
  const [progress, setProgress] = useState(0);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const p = setInterval(() => setProgress((v) => (v >= 100 ? 100 : v + Math.random() * 18)), 180);
    const rotate = setInterval(() => setIdx((i) => (i + 1) % words.length), 850);
    const done = setTimeout(() => router.push("/login"), 2600);
    return () => {
      clearInterval(p);
      clearInterval(rotate);
      clearTimeout(done);
    };
  }, [router]);

  return (
    <div className="relative flex h-dvh flex-col items-center justify-center overflow-hidden bg-background">
      <div className="absolute inset-0 bg-grid opacity-50" />
      <motion.div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[480px] w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(36,86,214,0.10), transparent 62%)" }}
        animate={{ scale: [1, 1.1, 1], opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative flex flex-col items-center text-foreground">
        <motion.div
          initial={{ scale: 0.7, opacity: 0, rotate: -10 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 130, damping: 13 }}
        >
          <motion.div animate={{ rotate: [0, 4, -4, 0] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}>
            <LogoMark size={88} />
          </motion.div>
        </motion.div>

        <motion.h1
          className="mt-8 text-3xl font-semibold tracking-tight"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.6 }}
        >
          MC Nexus
        </motion.h1>

        <motion.p
          className="mt-2 text-[11px] font-medium uppercase tracking-[0.24em] text-accent"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.45 }}
        >
          Mission Control
        </motion.p>

        <div className="mt-10 h-1 w-52 overflow-hidden rounded-full bg-muted">
          <motion.div
            className="h-full rounded-full bg-accent"
            animate={{ width: `${Math.min(progress, 100)}%` }}
            transition={{ ease: "easeOut" }}
          />
        </div>

        <div className="mt-4 h-4 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          <AnimatePresence mode="wait">
            <motion.span key={idx} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3 }}>
              {words[idx]}
            </motion.span>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
