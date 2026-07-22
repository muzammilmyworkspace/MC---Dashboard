import * as React from "react";
import { cn, initials } from "@/lib/utils";

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  name: string;
  color?: string;
  size?: number;
  online?: boolean;
}

export function Avatar({ name, color = "#2456d6", size = 36, online, className, ...props }: AvatarProps) {
  return (
    <div
      className={cn("relative inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-2 ring-background", className)}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: `linear-gradient(135deg, ${color}, ${color}bb)`,
      }}
      {...props}
    >
      {initials(name)}
      {online !== undefined && (
        <span
          className={cn(
            "absolute -bottom-0 -right-0 rounded-full ring-2 ring-card",
            online ? "bg-success" : "bg-muted-foreground"
          )}
          style={{ width: size * 0.28, height: size * 0.28 }}
        />
      )}
    </div>
  );
}

export function AvatarStack({ names, colors, max = 4 }: { names: string[]; colors: string[]; max?: number }) {
  const shown = names.slice(0, max);
  const extra = names.length - shown.length;
  return (
    <div className="flex items-center -space-x-2">
      {shown.map((n, i) => (
        <Avatar key={n + i} name={n} color={colors[i]} size={28} />
      ))}
      {extra > 0 && (
        <div className="relative z-10 inline-flex size-7 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground ring-2 ring-background">
          +{extra}
        </div>
      )}
    </div>
  );
}
