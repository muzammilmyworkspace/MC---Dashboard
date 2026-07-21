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
          "bg-accent text-accent-foreground shadow-[0_1px_0_rgba(255,255,255,0.15)_inset,0_8px_24px_-8px_rgba(139,92,246,0.55)] hover:brightness-110 hover:-translate-y-px",
        secondary:
          "bg-muted text-foreground border border-border hover:bg-background-subtle hover:border-accent/40",
        outline:
          "border border-border bg-transparent hover:bg-muted hover:border-accent/40",
        ghost: "hover:bg-muted text-muted-foreground hover:text-foreground",
        danger:
          "bg-danger text-white shadow-[0_8px_24px_-8px_rgba(239,68,68,0.5)] hover:brightness-110",
        success:
          "bg-success text-white shadow-[0_8px_24px_-8px_rgba(16,185,129,0.5)] hover:brightness-110",
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
