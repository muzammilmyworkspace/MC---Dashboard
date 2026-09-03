"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, FileText, Plus, RefreshCw } from "lucide-react";
import { api, ApiRequestError, type BlogPost, type BlogStatus } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, PageBody, PageHeader } from "@/components/ui/page-shell";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { BlogCard } from "./blog-card";

const FILTERS: { key: "ALL" | BlogStatus; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "DRAFT", label: "Drafts" },
  { key: "PUBLISHED", label: "Published" },
];

/**
 * The list is the whole publishing queue at a glance: what's live, what's
 * still being written, and one click into either. Nothing here changes a
 * post's public state — that only happens from inside the editor.
 */
export function BlogsScreen() {
  const router = useRouter();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"ALL" | BlogStatus>("ALL");
  const [creating, setCreating] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<BlogPost | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await api.blogs.list();
        if (cancelled) return;
        setPosts(res.blogs);
        setLoadError(null);
      } catch (err) {
        if (cancelled) return;
        setLoadError(err instanceof ApiRequestError ? err.message : "Could not load blog posts.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const visible = useMemo(() => (filter === "ALL" ? posts : posts.filter((p) => p.status === filter)), [posts, filter]);
  const counts = useMemo(
    () => ({ ALL: posts.length, DRAFT: posts.filter((p) => p.status === "DRAFT").length, PUBLISHED: posts.filter((p) => p.status === "PUBLISHED").length }),
    [posts]
  );

  async function createPost() {
    setCreating(true);
    try {
      const { blog } = await api.blogs.create();
      router.push(`/blogs/${blog.id}`);
    } catch (err) {
      toast.error("Could not create a new post.", { description: err instanceof ApiRequestError ? err.message : undefined });
      setCreating(false);
    }
  }

  async function confirmRemove() {
    const post = pendingRemove;
    if (!post) return;
    setPendingRemove(null);
    try {
      await api.blogs.remove(post.id);
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
      toast.success(`"${post.title}" deleted.`);
    } catch (err) {
      toast.error("Could not delete the post.", { description: err instanceof ApiRequestError ? err.message : undefined });
    }
  }

  return (
    <PageBody>
      <PageHeader
        title="Blogs"
        description="Write, preview and publish SEO posts. Drafts stay private until you hit Publish."
        actions={
          <Button onClick={() => void createPost()} disabled={creating}>
            <Plus className="size-4" /> New Post
          </Button>
        }
      />

      <div className="flex items-center gap-1.5 border-b border-border pb-px">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "relative flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors",
              filter === f.key ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {f.label}
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">{counts[f.key]}</span>
            {filter === f.key && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-accent" />}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="h-[280px] animate-pulse bg-muted/40" />
          ))}
        </div>
      ) : loadError ? (
        <EmptyState
          icon={AlertTriangle}
          title="Could not load blog posts."
          description={loadError}
          action={
            <Button onClick={reload}>
              <RefreshCw className="size-4" /> Retry
            </Button>
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={filter === "ALL" ? "No blog posts yet." : `No ${filter === "DRAFT" ? "drafts" : "published posts"} yet.`}
          description="Start a new post — it saves itself as you write, and stays a private draft until you publish it."
          action={
            <Button onClick={() => void createPost()} disabled={creating}>
              <Plus className="size-4" /> New Post
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((post) => (
            <BlogCard key={post.id} post={post} onRemove={() => setPendingRemove(post)} />
          ))}
        </div>
      )}

      <Dialog open={Boolean(pendingRemove)} onOpenChange={(v) => !v && setPendingRemove(null)}>
        <DialogContent className="w-[calc(100%-1.5rem)] max-w-sm p-0">
          <div className="px-5 py-5 pr-14">
            <DialogTitle>Delete this post?</DialogTitle>
            <DialogDescription className="mt-1.5">
              &quot;{pendingRemove?.title || "Untitled post"}&quot; will be permanently removed
              {pendingRemove?.status === "PUBLISHED" ? ", and taken offline immediately" : ""}. This can&apos;t be undone.
            </DialogDescription>
          </div>
          <div className="flex gap-2 border-t border-border px-5 py-3.5">
            <Button variant="outline" onClick={() => setPendingRemove(null)} className="flex-1">
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void confirmRemove()} className="flex-1">
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageBody>
  );
}
