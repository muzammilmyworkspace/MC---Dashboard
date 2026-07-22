import { cn } from "@/lib/utils";

/**
 * MC Nexus mark — a minimal compass: a ring with a four-point needle.
 * Ring uses currentColor (adapts to context); the needle is the accent blue.
 */
export function LogoMark({ size = 34, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={cn("shrink-0", className)} aria-hidden>
      <circle cx="24" cy="24" r="21" stroke="currentColor" strokeOpacity="0.24" strokeWidth="1.5" />
      <circle cx="24" cy="24" r="16" stroke="currentColor" strokeOpacity="0.12" strokeWidth="1" />
      <path d="M24 7 L28.5 21 L24 24 L19.5 21 Z" fill="#2456d6" />
      <path d="M24 41 L19.5 27 L24 24 L28.5 27 Z" fill="#2456d6" fillOpacity="0.45" />
      <circle cx="24" cy="24" r="2" fill="#2456d6" />
      <circle cx="41" cy="24" r="1.3" fill="currentColor" fillOpacity="0.3" />
      <circle cx="7" cy="24" r="1.3" fill="currentColor" fillOpacity="0.3" />
    </svg>
  );
}

export function Logo({
  size = 34,
  showText = true,
  tone = "auto",
}: {
  size?: number;
  showText?: boolean;
  tone?: "auto" | "light" | "dark";
}) {
  const textColor = tone === "light" ? "text-white" : tone === "dark" ? "text-[#111827]" : "text-foreground";
  const subColor = tone === "light" ? "text-white/45" : "text-muted-foreground";
  return (
    <div className={cn("flex items-center gap-2.5", textColor)}>
      <LogoMark size={size} />
      {showText && (
        <div className="leading-none">
          <div className="text-[15px] font-semibold tracking-tight">MC Nexus</div>
          <div className={cn("mt-1 text-[10px] font-medium uppercase tracking-[0.18em]", subColor)}>Mission Control</div>
        </div>
      )}
    </div>
  );
}
