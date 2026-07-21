import { cn } from "@/lib/utils";

export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <defs>
        <linearGradient id="nx-g" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#a78bfa" />
          <stop offset="0.5" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#6366f1" />
        </linearGradient>
      </defs>
      <rect x="1.5" y="1.5" width="45" height="45" rx="13" fill="url(#nx-g)" opacity="0.14" />
      <rect
        x="1.5"
        y="1.5"
        width="45"
        height="45"
        rx="13"
        stroke="url(#nx-g)"
        strokeWidth="1.5"
        opacity="0.5"
      />
      {/* Stylised N formed from a network node path */}
      <path
        d="M15 33V15L33 33V15"
        stroke="url(#nx-g)"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="15" cy="15" r="3" fill="#a78bfa" />
      <circle cx="33" cy="33" r="3" fill="#6366f1" />
    </svg>
  );
}

export function Logo({ size = 32, showText = true }: { size?: number; showText?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark size={size} />
      {showText && (
        <div className="leading-none">
          <div className="text-[15px] font-bold tracking-tight">
            NEXUS <span className="text-gradient">HQ</span>
          </div>
          <div className="mt-1 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Mission Control
          </div>
        </div>
      )}
    </div>
  );
}
