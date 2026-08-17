"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/** Labelled form row with optional helper text and inline error. */
export function Field({
  label,
  hint,
  error,
  required,
  htmlFor,
  className,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="flex items-center gap-1 text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-danger">*</span>}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

const baseControl =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-accent/60 focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-60";

export const TextInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  ({ className, invalid, ...props }, ref) => (
    <input ref={ref} className={cn(baseControl, "h-10", invalid && "border-danger focus:border-danger focus:ring-danger/20", className)} {...props} />
  )
);
TextInput.displayName = "TextInput";

export const TextArea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(
  ({ className, invalid, ...props }, ref) => (
    <textarea ref={ref} className={cn(baseControl, "resize-y", invalid && "border-danger focus:border-danger focus:ring-danger/20", className)} {...props} />
  )
);
TextArea.displayName = "TextArea";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }>(
  ({ className, invalid, children, ...props }, ref) => (
    <select ref={ref} className={cn(baseControl, "h-10 cursor-pointer", invalid && "border-danger", className)} {...props}>
      {children}
    </select>
  )
);
Select.displayName = "Select";

/** Read-only credential field with a copy-friendly monospace look. */
export function SecretInput({
  value,
  onChange,
  placeholder,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  id?: string;
}) {
  const [visible, setVisible] = React.useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        className={cn(baseControl, "h-10 pr-16 font-mono text-[13px]")}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        {visible ? "Hide" : "Show"}
      </button>
    </div>
  );
}
