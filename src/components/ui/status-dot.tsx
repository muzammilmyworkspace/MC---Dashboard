import { cn } from "@/lib/utils";
import type { ConnState } from "@/lib/platform-status";

/**
 * The one status indicator used across the app.
 *
 * Colour alone would fail for colour-blind users and in screenshots, so the
 * label always travels with the dot — and a filled dot means connected while
 * a ring means everything else.
 */
export function StatusDot({
  state,
  label,
  className,
}: {
  state: ConnState;
  label: string;
  className?: string;
}) {
  const tone: Record<ConnState, string> = {
    connected: "bg-success",
    disconnected: "border border-muted-foreground/50",
    unavailable: "border border-muted-foreground/30",
    loading: "bg-muted-foreground/40 animate-pulse",
  };
  const text: Record<ConnState, string> = {
    connected: "text-success",
    disconnected: "text-muted-foreground",
    unavailable: "text-muted-foreground/70",
    loading: "text-muted-foreground/70",
  };

  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", text[state], className)}>
      <span className={cn("size-1.5 shrink-0 rounded-full", tone[state])} />
      {label}
    </span>
  );
}
