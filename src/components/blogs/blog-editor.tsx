"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle, ArrowLeft, Check, Clock, ExternalLink, ImageIcon, Loader2, Rocket, Search, Trash2, X,
} from "lucide-react";
import { api, ApiRequestError, type BlogPost } from "@/lib/api";
import { blogStatusMeta, readingMinutes, seoChecklist, slugify } from "@/lib/blogs";
import { celebrate } from "@/lib/confetti";
import { relativeTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Field, TextArea, TextInput } from "@/components/ui/field";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, PageBody } from "@/components/ui/page-shell";
import { KeywordInput } from "./keyword-input";
import { MarkdownPreview } from "./markdown-preview";

type Form = {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: string;
  category: string;
  seoTitle: string;
  seoDescription: string;
  keywords: string[];
};

function formFrom(post: BlogPost): Form {
  return {
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    content: post.content,
    coverImage: post.coverImage,
    category: post.category,
    seoTitle: post.seoTitle,
    seoDescription: post.seoDescription,
    keywords: post.keywords,
  };
}

const AUTOSAVE_DELAY_MS = 900;

export function BlogEditor({ id }: { id: string }) {
  const router = useRouter();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [form, setForm] = useState<Form | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [publishing, setPublishing] = useState(false);
  const [wpError, setWpError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<"edit" | "preview">("edit");

  const skipNextSave = useRef(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { blog } = await api.blogs.get(id);
        if (cancelled) return;
        setPost(blog);
        setForm(formFrom(blog));
        skipNextSave.current = true;
      } catch (err) {
        if (cancelled) return;
        setLoadError(err instanceof ApiRequestError ? err.message : "Could not load this post.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Autosave: every field edit lands in the database on its own, so the
  // only button the user ever has to press on purpose is Publish.
  useEffect(() => {
    if (!form) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }

    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void (async () => {
        try {
          const { blog } = await api.blogs.update(id, {
            title: form.title || "Untitled post",
            slug: form.slug,
            excerpt: form.excerpt,
            content: form.content,
            coverImage: form.coverImage,
            category: form.category,
            seoTitle: form.seoTitle,
            seoDescription: form.seoDescription,
            keywords: form.keywords,
          });
          setPost(blog);
          if (blog.slug !== form.slug) setForm((f) => (f ? { ...f, slug: blog.slug } : f));
          setSaveState("saved");
        } catch (err) {
          setSaveState("error");
          toast.error("Couldn't save your changes.", { description: err instanceof ApiRequestError ? err.message : undefined });
        }
      })();
    }, AUTOSAVE_DELAY_MS);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [form, id]);

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  function onTitleChange(title: string) {
    setForm((f) => {
      if (!f) return f;
      const next = { ...f, title };
      if (!slugTouched) next.slug = slugify(title);
      return next;
    });
  }

  async function togglePublish() {
    if (!post) return;
    setPublishing(true);
    setWpError(null);
    try {
      const { blog, wpError: err } =
        post.status === "PUBLISHED" ? await api.blogs.unpublish(post.id) : await api.blogs.publish(post.id);
      setPost(blog);
      setWpError(err);
      if (blog.status === "PUBLISHED") {
        if (err) {
          toast.warning("Published in MC Nexus, but not on maincharacter.nl.", { description: err });
        } else {
          celebrate();
          toast.success("Published.", { description: "Live on maincharacter.nl." });
        }
      } else {
        toast.success(err ? "Moved back to draft in MC Nexus." : "Moved back to draft — pulled from maincharacter.nl too.", {
          description: err ?? undefined,
        });
      }
    } catch (err) {
      toast.error("Couldn't change the publish state.", { description: err instanceof ApiRequestError ? err.message : undefined });
    } finally {
      setPublishing(false);
    }
  }

  async function confirmDelete() {
    setDeleteOpen(false);
    try {
      await api.blogs.remove(id);
      toast.success("Post deleted.");
      router.push("/blogs");
    } catch (err) {
      toast.error("Couldn't delete the post.", { description: err instanceof ApiRequestError ? err.message : undefined });
    }
  }

  const checklist = useMemo(
    () =>
      form
        ? seoChecklist({
            seoTitle: form.seoTitle,
            title: form.title,
            seoDescription: form.seoDescription,
            excerpt: form.excerpt,
            keywords: form.keywords,
            content: form.content,
          })
        : [],
    [form]
  );
  const score = checklist.length ? Math.round((checklist.filter((c) => c.ok).length / checklist.length) * 100) : 0;

  if (loading) {
    return (
      <PageBody>
        <Card className="h-[70vh] animate-pulse bg-muted/40" />
      </PageBody>
    );
  }

  if (loadError || !post || !form) {
    return (
      <PageBody>
        <EmptyState
          icon={X}
          title="Couldn't load this post."
          description={loadError ?? "It may have been deleted."}
          action={
            <Button asChild>
              <Link href="/blogs">
                <ArrowLeft className="size-4" /> Back to Blogs
              </Link>
            </Button>
          }
        />
      </PageBody>
    );
  }

  const status = blogStatusMeta[post.status];
  const displayTitle = form.seoTitle || form.title || "Untitled post";
  const displayDescription = form.seoDescription || form.excerpt || "Add an excerpt or meta description so search engines have something to show.";

  return (
    <PageBody>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" size="icon-sm" asChild>
            <Link href="/blogs" aria-label="Back to Blogs">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={status.tone === "success" ? "success" : status.tone === "warning" ? "warning" : "secondary"}>
                {status.label}
              </Badge>
              <SaveIndicator state={saveState} />
              {post.wpUrl && (
                <a
                  href={post.wpUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
                >
                  <ExternalLink className="size-3" /> View live on maincharacter.nl
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setDeleteOpen(true)} className="text-muted-foreground hover:text-danger">
            <Trash2 className="size-4" /> Delete
          </Button>
          <Button
            variant={post.status === "PUBLISHED" ? "outline" : "success"}
            onClick={() => void togglePublish()}
            disabled={publishing || (!form.title.trim() && post.status !== "PUBLISHED")}
          >
            {publishing ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />}
            {post.status === "PUBLISHED" ? "Unpublish" : "Publish"}
          </Button>
        </div>
      </div>

      {wpError && (
        <Card className="flex items-start gap-2.5 border-warning/30 bg-warning/5 p-3.5 text-xs">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
          <div>
            <p className="font-medium text-foreground">Couldn&apos;t reach maincharacter.nl.</p>
            <p className="mt-0.5 text-muted-foreground">
              The post is published in MC Nexus, but the live site wasn&apos;t updated: {wpError}. Press Publish again once
              it&apos;s reachable.
            </p>
          </div>
        </Card>
      )}

      {/* Mobile edit/preview switch — desktop shows both panels side by side */}
      <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-1 text-sm lg:hidden">
        {(["edit", "preview"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setMobileTab(t)}
            className={`flex-1 rounded-md py-1.5 text-center font-medium capitalize transition-colors ${
              mobileTab === t ? "bg-card shadow-sm" : "text-muted-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr] lg:items-start">
        <div className={`space-y-6 ${mobileTab === "preview" ? "hidden lg:block" : ""}`}>
          <Card className="space-y-4 p-5">
            <Field label="Title" required>
              <TextInput
                value={form.title}
                onChange={(e) => onTitleChange(e.target.value)}
                placeholder="How to…"
                className="h-12 text-base font-semibold"
              />
            </Field>

            <Field label="URL slug" hint="This is the address the post will live at once published.">
              <div className="flex items-center gap-2">
                <span className="shrink-0 text-xs text-muted-foreground">/blog/</span>
                <TextInput
                  value={form.slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    set("slug", slugify(e.target.value));
                  }}
                  placeholder="post-url"
                />
              </div>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Service / Category" hint="What this post is about.">
                <TextInput value={form.category} onChange={(e) => set("category", e.target.value)} placeholder="SEO, Web Design…" />
              </Field>
              <Field label="Cover image URL">
                <div className="flex items-center gap-2">
                  <ImageIcon className="size-4 shrink-0 text-muted-foreground" />
                  <TextInput value={form.coverImage} onChange={(e) => set("coverImage", e.target.value)} placeholder="https://…" />
                </div>
              </Field>
            </div>

            <Field label="Excerpt" hint="Shown on the blog list, and used as the meta description if you leave that blank below.">
              <TextArea value={form.excerpt} onChange={(e) => set("excerpt", e.target.value)} rows={2} placeholder="One or two sentences…" />
            </Field>

            <Field
              label="Content"
              hint={`Supports # headings, **bold**, *italic*, - lists and [links](https://…). ${readingMinutes(form.content)} min read.`}
            >
              <TextArea
                value={form.content}
                onChange={(e) => set("content", e.target.value)}
                rows={18}
                placeholder="Start writing…"
                className="font-mono text-[13px] leading-relaxed"
              />
            </Field>
          </Card>

          <Card className="space-y-4 p-5">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Search className="size-4 text-accent" /> SEO
              </h2>
              <span className="text-xs font-medium text-muted-foreground">{score}% ready</span>
            </div>
            <Progress value={score} />

            <Field label="SEO title" hint={`${(form.seoTitle || form.title).length}/60 characters. Falls back to the post title.`}>
              <TextInput value={form.seoTitle} onChange={(e) => set("seoTitle", e.target.value)} placeholder={form.title || "Post title"} maxLength={70} />
            </Field>

            <Field label="Meta description" hint={`${(form.seoDescription || form.excerpt).length}/160 characters. Falls back to the excerpt.`}>
              <TextArea
                value={form.seoDescription}
                onChange={(e) => set("seoDescription", e.target.value)}
                rows={2}
                placeholder={form.excerpt || "What this post is about, in one sentence."}
                maxLength={200}
              />
            </Field>

            <Field label="Focus keywords" hint="What you want this post to rank for on Google.">
              <KeywordInput value={form.keywords} onChange={(v) => set("keywords", v)} />
            </Field>

            <ul className="space-y-1.5 pt-1">
              {checklist.map((c) => (
                <li key={c.key} className="flex items-center gap-2 text-xs">
                  {c.ok ? <Check className="size-3.5 shrink-0 text-success" /> : <X className="size-3.5 shrink-0 text-muted-foreground/50" />}
                  <span className={c.ok ? "text-foreground" : "text-muted-foreground"}>{c.label}</span>
                  <span className="ml-auto text-muted-foreground">{c.detail}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className={`space-y-4 lg:sticky lg:top-6 ${mobileTab === "edit" ? "hidden lg:block" : ""}`}>
          <Card className="space-y-1.5 p-5">
            <p className="text-xs font-medium text-muted-foreground">Google preview</p>
            <p className="truncate text-sm text-[#1a0dab]">{displayTitle}</p>
            <p className="truncate text-xs text-[#006621]">yoursite.com › blog › {form.slug || "post-url"}</p>
            <p className="line-clamp-2 text-xs text-muted-foreground">{displayDescription}</p>
          </Card>

          <Card className="overflow-hidden">
            {form.coverImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.coverImage} alt="" className="h-40 w-full object-cover" />
            )}
            <div className="space-y-4 p-5">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {form.category && <Badge variant="secondary">{form.category}</Badge>}
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-3" /> {readingMinutes(form.content)} min read
                  </span>
                  {post.status === "PUBLISHED" && post.publishedAt && <span>Published {relativeTime(post.publishedAt)}</span>}
                </div>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight">{form.title || "Untitled post"}</h1>
              </div>
              <MarkdownPreview content={form.content} />
            </div>
          </Card>
        </div>
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="w-[calc(100%-1.5rem)] max-w-sm p-0">
          <div className="px-5 py-5 pr-14">
            <DialogTitle>Delete this post?</DialogTitle>
            <DialogDescription className="mt-1.5">
              &quot;{form.title || "Untitled post"}&quot; will be permanently removed
              {post.status === "PUBLISHED" ? ", and taken offline immediately" : ""}. This can&apos;t be undone.
            </DialogDescription>
          </div>
          <div className="flex gap-2 border-t border-border px-5 py-3.5">
            <Button variant="outline" onClick={() => setDeleteOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void confirmDelete()} className="flex-1">
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageBody>
  );
}

function SaveIndicator({ state }: { state: "idle" | "saving" | "saved" | "error" }) {
  if (state === "idle") return null;
  if (state === "saving")
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" /> Saving…
      </span>
    );
  if (state === "error")
    return (
      <span className="inline-flex items-center gap-1 text-xs text-danger">
        <X className="size-3" /> Couldn&apos;t save
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Check className="size-3 text-success" /> Saved
    </span>
  );
}
