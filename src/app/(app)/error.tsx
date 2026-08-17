"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Route-level error boundary for the authenticated area. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[app] route error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-danger/10 text-danger">
        <AlertTriangle className="size-7" />
      </div>
      <h1 className="mt-5 text-xl font-semibold tracking-tight">Something went wrong on this page</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        The rest of your workspace is fine. Try again, or head back to the dashboard.
      </p>
      {error.digest && <p className="mt-2 font-mono text-[11px] text-muted-foreground/70">Ref: {error.digest}</p>}
      <div className="mt-6 flex gap-2">
        <Button onClick={reset}><RotateCcw className="size-4" /> Try again</Button>
        <Button variant="secondary" asChild><Link href="/dashboard">Back to dashboard</Link></Button>
      </div>
    </div>
  );
}
