import Link from "next/link";
import { Compass, ArrowRight } from "lucide-react";

/**
 * Replaces the old catch-all route, which answered every unknown path with a
 * plausible-looking module page. That made typos and dead links look like
 * real, half-built features — and made a genuinely missing route impossible
 * to spot. An unknown path is now simply not found.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-background px-6 text-center">
      <div className="flex size-12 items-center justify-center rounded-xl border border-border bg-muted/40 text-muted-foreground">
        <Compass className="size-6" />
      </div>
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Page not found</h1>
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
          This page doesn&apos;t exist. It may have moved, or the link may be out of date.
        </p>
      </div>
      <Link
        href="/dashboard"
        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-[13px] font-medium text-accent-foreground transition-colors hover:bg-accent-hover"
      >
        Back to dashboard <ArrowRight className="size-3.5" />
      </Link>
    </div>
  );
}
