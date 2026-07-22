"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-0 disabled:pointer-events-none disabled:opacity-50 active:scale-[.97] [&_svg]:size-4 [&_svg]:shrink-0 select-none",
  {
    variants: {
      variant: {
        default:
          "bg-accent text-accent-foreground shadow-[0_1px_2px_rgba(36,86,214,0.24),0_8px_20px_-10px_rgba(36,86,214,0.55)] hover:bg-accent-hover hover:-translate-y-px",
        accent:
          "bg-accent text-accent-foreground shadow-[0_1px_2px_rgba(36,86,214,0.24),0_8px_20px_-10px_rgba(36,86,214,0.55)] hover:bg-accent-hover hover:-translate-y-px",
        dark:
          "bg-[#0f172a] text-white shadow-[0_8px_20px_-10px_rgba(15,23,42,0.5)] hover:bg-[#111827] hover:-translate-y-px dark:bg-foreground dark:text-background",
        secondary:
          "bg-card text-foreground border border-border shadow-sm hover:bg-muted",
        outline:
          "border border-border bg-transparent hover:bg-muted",
        ghost: "hover:bg-muted text-muted-foreground hover:text-foreground",
        danger:
          "bg-danger text-white shadow-[0_8px_20px_-10px_rgba(220,38,38,0.55)] hover:brightness-105",
        success:
          "bg-success text-white shadow-[0_8px_20px_-10px_rgba(22,163,74,0.55)] hover:brightness-105",
        glass:
          "glass text-foreground hover:border-accent/40",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 px-3 text-xs rounded-md",
        lg: "h-12 px-6 text-base rounded-lg",
        icon: "size-10 rounded-md",
        "icon-sm": "size-8 rounded-md",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
    );
  }
);
Button.displayName = "Button";

export { buttonVariants };
