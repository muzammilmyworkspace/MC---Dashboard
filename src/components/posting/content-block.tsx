"use client";

import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Pencil, Check, Copy, Languages, Upload, Download, RefreshCw, Trash2,
  ImageIcon, Film, ChevronLeft, ChevronRight, Minus,
} from "lucide-react";
import {
  usePosting, platforms, platformLabel, contentToText,
  type ContentBlock, type Language, type MediaItem, type PlatformKey,
} from "@/lib/posting";
import { TextInput, TextArea } from "@/components/ui/field";
import { cn } from "@/lib/utils";

export function ContentBlockCard({
  date,
  block,
  index,
  onRemove,
}: {
  date: string;
  block: ContentBlock;
  index: number;
  onRemove: () => void;
}) {
  const { updateContent, setMediaTab, addPostMedia, setReelMedia, removePostMedia } = usePosting();
  const [platform, setPlatform] = useState<PlatformKey>("instagram");
  const [lang, setLang] = useState<Language>("en");
  const [editing, setEditing] = useState(false);
  const [slide, setSlide] = useState(0);

  const imageInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);

  const c = block.content[platform];
  const isNl = lang === "nl";
  const value = {
    hook: isNl ? c.hookNl : c.hook,
    caption: isNl ? c.captionNl : c.caption,
    cta: isNl ? c.ctaNl : c.cta,
    hashtags: c.hashtags,
  };

  const set = (patch: Partial<typeof c>) => updateContent(date, block.id, platform, patch);
  const setField = (field: "hook" | "caption" | "cta", v: string) =>
    set({ [isNl ? (`${field}Nl` as const) : field]: v } as never);

  async function copyAll() {
    const text = contentToText(c, lang);
    if (!text.trim()) {
      toast.error("Nothing to copy yet");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied", { description: `${platformLabel[platform]} content copied to clipboard.` });
    } catch {
      toast.error("Couldn't copy — check browser permissions");
    }
  }

  function onPickImages(files: FileList | null) {
    if (!files?.length) return;
    const items: MediaItem[] = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .map((f) => ({ id: crypto.randomUUID(), name: f.name, kind: "image" as const, url: URL.createObjectURL(f), size: f.size }));
    if (!items.length) return toast.error("Please choose image files");
    addPostMedia(date, block.id, items);
    toast.success(items.length > 1 ? `${items.length} images added` : "Image added");
  }

  function onPickVideo(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    if (!f.type.startsWith("video/")) return toast.error("Please choose a video file");
    setReelMedia(date, block.id, { id: crypto.randomUUID(), name: f.name, kind: "video", url: URL.createObjectURL(f), size: f.size });
    toast.success("Reel added");
  }

  function download() {
    const media = block.mediaTab === "reel" ? block.reelMedia : block.postMedia[slide];
    if (!media) return toast.error("Nothing to download yet");
    const a = document.createElement("a");
    a.href = media.url;
    a.download = media.name;
    a.click();
  }

  function removeMedia() {
    if (block.mediaTab === "reel") {
      setReelMedia(date, block.id, null);
    } else {
      const m = block.postMedia[slide];
      if (m) removePostMedia(date, block.id, m.id);
      setSlide(0);
    }
    toast("Media removed");
  }

  const hasMedia = block.mediaTab === "reel" ? !!block.reelMedia : block.postMedia.length > 0;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-2.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Post {index + 1}</span>
        <button onClick={onRemove} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger" title="Remove this post">
          <Minus className="size-3.5" /> Remove
        </button>
      </div>

      <div className="grid grid-cols-1 items-stretch lg:grid-cols-2">
        {/* ---------------- Left: content ---------------- */}
        <div className="flex flex-col border-b border-border p-4 lg:border-b-0 lg:border-r">
          {/* Platform tabs — text only */}
          <div className="no-scrollbar mb-3 flex gap-1 overflow-x-auto rounded-xl bg-muted p-1">
            {platforms.map((p) => (
              <button
                key={p}
                onClick={() => setPlatform(p)}
                className={cn(
                  "shrink-0 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors",
                  p === platform ? "bg-card text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {platformLabel[p]}
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {platformLabel[platform]} · {isNl ? "Dutch" : "English"}
            </span>
            <div className="flex items-center gap-1">
              <IconBtn label={editing ? "Done" : "Edit"} onClick={() => setEditing((e) => !e)} active={editing}>
                {editing ? <Check className="size-3.5" /> : <Pencil className="size-3.5" />}
              </IconBtn>
              <IconBtn label="Copy" onClick={copyAll}><Copy className="size-3.5" /></IconBtn>
              <IconBtn label={isNl ? "Switch to English" : "Switch to Dutch"} onClick={() => setLang(isNl ? "en" : "nl")} active={isNl}>
                <Languages className="size-3.5" />
              </IconBtn>
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={platform + lang + String(editing)}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="flex-1 space-y-3"
            >
              {editing ? (
                <>
                  <Labelled label="Hook">
                    <TextInput value={value.hook} onChange={(e) => setField("hook", e.target.value)} placeholder="The scroll-stopping first line…" />
                  </Labelled>
                  <Labelled label="Caption">
                    <TextArea rows={5} value={value.caption} onChange={(e) => setField("caption", e.target.value)} placeholder="Write the caption…" />
                  </Labelled>
                  <Labelled label="Hashtags">
                    <TextInput value={value.hashtags} onChange={(e) => set({ hashtags: e.target.value })} placeholder="#maincharacter #publicspeaking" />
                  </Labelled>
                  <Labelled label="CTA">
                    <TextInput value={value.cta} onChange={(e) => setField("cta", e.target.value)} placeholder="Save this · Link in bio · DM us" />
                  </Labelled>
                </>
              ) : (
                <>
                  <ReadRow label="Hook" value={value.hook} strong />
                  <ReadRow label="Caption" value={value.caption} multiline />
                  <ReadRow label="Hashtags" value={value.hashtags} accent />
                  <ReadRow label="CTA" value={value.cta} />
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ---------------- Right: media ---------------- */}
        <div className="flex flex-col p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex gap-1 rounded-xl bg-muted p-1">
              {(["post", "reel"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => { setMediaTab(date, block.id, t); setSlide(0); }}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium capitalize transition-colors",
                    block.mediaTab === t ? "bg-card text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t === "post" ? <ImageIcon className="size-3.5" /> : <Film className="size-3.5" />} {t}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <IconBtn label="Upload" onClick={() => (block.mediaTab === "reel" ? videoInput : imageInput).current?.click()}>
                <Upload className="size-3.5" />
              </IconBtn>
              <IconBtn label="Download" onClick={download} disabled={!hasMedia}><Download className="size-3.5" /></IconBtn>
              <IconBtn label="Replace" onClick={() => (block.mediaTab === "reel" ? videoInput : imageInput).current?.click()} disabled={!hasMedia}>
                <RefreshCw className="size-3.5" />
              </IconBtn>
              <IconBtn label="Remove" onClick={removeMedia} disabled={!hasMedia} danger><Trash2 className="size-3.5" /></IconBtn>
            </div>
          </div>

          <input ref={imageInput} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { onPickImages(e.target.files); e.target.value = ""; }} />
          <input ref={videoInput} type="file" accept="video/*" className="hidden" onChange={(e) => { onPickVideo(e.target.files); e.target.value = ""; }} />

          <div className="flex flex-1 items-center justify-center rounded-xl bg-background-subtle p-4">
            {block.mediaTab === "reel" ? (
              block.reelMedia ? (
                <video src={block.reelMedia.url} controls className="max-h-[320px] w-auto rounded-xl shadow-glow" />
              ) : (
                <MediaPlaceholder icon={Film} label="No reel uploaded" hint="Upload a video for this day" onUpload={() => videoInput.current?.click()} />
              )
            ) : block.postMedia.length > 0 ? (
              <div className="relative w-full max-w-[300px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={block.postMedia[slide]?.url} alt={block.postMedia[slide]?.name ?? "Post media"} className="aspect-square w-full rounded-xl object-cover shadow-glow" />
                {block.postMedia.length > 1 && (
                  <>
                    <CarouselBtn side="left" onClick={() => setSlide((s) => (s - 1 + block.postMedia.length) % block.postMedia.length)} />
                    <CarouselBtn side="right" onClick={() => setSlide((s) => (s + 1) % block.postMedia.length)} />
                    <div className="absolute right-2 top-2 rounded-full bg-black/50 px-2 py-0.5 text-[11px] font-medium text-white">
                      {slide + 1} / {block.postMedia.length}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <MediaPlaceholder icon={ImageIcon} label="No media uploaded" hint="Upload an image or carousel" onUpload={() => imageInput.current?.click()} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function IconBtn({ children, label, onClick, disabled, active, danger }: { children: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; active?: boolean; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={cn(
        "flex size-7 items-center justify-center rounded-lg border transition-colors",
        disabled && "cursor-not-allowed opacity-40",
        active ? "border-accent/40 bg-accent/10 text-accent" : "border-border text-muted-foreground hover:border-accent/50 hover:text-accent",
        danger && !disabled && "hover:border-danger/50 hover:text-danger"
      )}
    >
      {children}
    </button>
  );
}

function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function ReadRow({ label, value, strong, multiline, accent }: { label: string; value: string; strong?: boolean; multiline?: boolean; accent?: boolean }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      {value ? (
        <p className={cn("mt-1 text-sm", strong && "font-semibold", multiline && "whitespace-pre-line leading-relaxed", accent && "font-medium text-accent")}>{value}</p>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground/60">Not written yet</p>
      )}
    </div>
  );
}

function MediaPlaceholder({ icon: Icon, label, hint, onUpload }: { icon: React.ElementType; label: string; hint: string; onUpload: () => void }) {
  return (
    <button onClick={onUpload} className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border px-6 py-12 text-center transition-colors hover:border-accent/50 hover:bg-muted/40">
      <Icon className="size-7 text-muted-foreground/60" />
      <span className="text-sm font-medium">{label}</span>
      <span className="text-xs text-muted-foreground">{hint}</span>
      <span className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground">
        <Upload className="size-3.5" /> Upload
      </span>
    </button>
  );
}

function CarouselBtn({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn("absolute top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/30 text-white backdrop-blur-md transition-colors hover:bg-white/50", side === "left" ? "left-2" : "right-2")}
    >
      {side === "left" ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />}
    </button>
  );
}
