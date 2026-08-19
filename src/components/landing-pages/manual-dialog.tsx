"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { api, ApiRequestError, type LandingPage, type LandingPageStatus } from "@/lib/api";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { statusMeta } from "@/lib/landing-pages";
import { cn } from "@/lib/utils";

/** Statuses a person can meaningfully choose. Build states belong to Vercel. */
const MANUAL_STATUSES: LandingPageStatus[] = ["LIVE", "BUILDING", "FAILED"];

interface ManualProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: (page: LandingPage) => void;
}

/**
 * Shell only. The form lives in ManualForm, which Radix mounts fresh each
 * time the modal opens, so the fields start empty without a reset effect.
 */
export function ManualDialog({ open, onOpenChange, onSaved }: ManualProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1.5rem)] max-w-md p-0">
        <ManualForm onOpenChange={onOpenChange} onSaved={onSaved} />
      </DialogContent>
    </Dialog>
  );
}

function ManualForm({ onOpenChange, onSaved }: Omit<ManualProps, "open">) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<LandingPageStatus>("LIVE");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      // Typing "example.com" is the common case; adding the scheme here keeps
      // the URL validation on the server from rejecting an obvious intent.
      const normalised = /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
      const res = await api.landingPages.createManual({
        name: name.trim(),
        productionUrl: normalised,
        description: description.trim() || undefined,
        status,
      });
      onSaved(res.page);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Could not save the landing page.");
    } finally {
      setSaving(false);
    }
  }

  return (
        <form onSubmit={save}>
          <header className="border-b border-border px-5 py-4 pr-14">
            <DialogTitle>Add Landing Page Manually</DialogTitle>
            <DialogDescription className="mt-1">
              For a page that isn&apos;t hosted on Vercel.
            </DialogDescription>
          </header>

          <div className="space-y-4 px-5 py-5">
            <Field label="Landing Page Name" required htmlFor="lp-name">
              <Input
                id="lp-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Summer Campaign"
                required
                maxLength={120}
              />
            </Field>

            <Field label="Live URL" required htmlFor="lp-url" hint="The address visitors open.">
              <Input
                id="lp-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                required
                inputMode="url"
              />
            </Field>

            <Field label="Description" htmlFor="lp-desc" hint="Optional — what this page is for.">
              <Input
                id="lp-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Landing page for the autumn promotion"
                maxLength={500}
              />
            </Field>

            <Field label="Status">
              <div className="flex gap-1.5">
                {MANUAL_STATUSES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={cn(
                      "flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
                      status === s
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-border text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {statusMeta[s].label}
                  </button>
                ))}
              </div>
            </Field>

            {error && <p className="text-xs text-danger">{error}</p>}
          </div>

          <footer className="flex gap-2 border-t border-border px-5 py-3.5">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !name.trim() || !url.trim()} className="flex-1">
              {saving ? <RefreshCw className="size-4 animate-spin" /> : null}
              {saving ? "Saving…" : "Save Landing Page"}
            </Button>
          </footer>
        </form>
  );
}
