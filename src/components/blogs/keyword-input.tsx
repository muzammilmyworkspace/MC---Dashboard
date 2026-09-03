"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { TextInput } from "@/components/ui/field";
import { cn } from "@/lib/utils";

/**
 * Enter or comma turns typed text into a keyword chip. Free text this loose
 * is how every SEO tool collects focus keywords — the value is the list,
 * never the raw string.
 */
export function KeywordInput({
  value,
  onChange,
  placeholder = "Type a keyword and press Enter…",
}: {
  value: string[];
  onChange: (keywords: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");

  function commit(raw: string) {
    const word = raw.trim();
    if (!word) return;
    if (!value.some((k) => k.toLowerCase() === word.toLowerCase())) onChange([...value, word]);
    setDraft("");
  }

  function remove(word: string) {
    onChange(value.filter((k) => k !== word));
  }

  return (
    <div className={cn("flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border border-input bg-background px-2.5 py-1.5")}>
      {value.map((word) => (
        <span key={word} className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2.5 py-1 text-xs font-medium text-accent">
          {word}
          <button type="button" onClick={() => remove(word)} aria-label={`Remove ${word}`} className="rounded-full hover:text-danger">
            <X className="size-3" />
          </button>
        </span>
      ))}
      <TextInput
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commit(draft);
          } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
            remove(value[value.length - 1]);
          }
        }}
        onBlur={() => commit(draft)}
        placeholder={value.length === 0 ? placeholder : "Add another…"}
        className="h-7 min-w-[140px] flex-1 border-none bg-transparent p-0 shadow-none focus:ring-0"
      />
    </div>
  );
}
