"use client";

import Link from "next/link";
import { FileText, Tag, Trash2 } from "lucide-react";
import type { BlogPost } from "@/lib/api";
import { blogStatusMeta } from "@/lib/blogs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { relativeTime } from "@/lib/utils";

export function BlogCard({ post, onRemove }: { post: BlogPost; onRemove: () => void }) {
  const status = blogStatusMeta[post.status];

  return (
    <Card className="group flex flex-col overflow-hidden transition-shadow hover:shadow-glow">
      <Link href={`/blogs/${post.id}`} className="flex flex-1 flex-col">
        <div className="flex h-32 items-center justify-center overflow-hidden border-b border-border bg-muted/60">
          {post.coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.coverImage} alt="" className="h-full w-full object-cover" />
          ) : (
            <FileText className="size-8 text-muted-foreground/50" />
          )}
        </div>

        <div className="flex flex-1 flex-col gap-2.5 p-4">
          <div className="flex items-center justify-between gap-2">
            <Badge variant={status.tone === "success" ? "success" : status.tone === "warning" ? "warning" : "secondary"}>
              {status.label}
            </Badge>
            {post.category && (
              <span className="inline-flex items-center gap-1 truncate text-xs text-muted-foreground">
                <Tag className="size-3 shrink-0" /> {post.category}
              </span>
            )}
          </div>

          <h3 className="line-clamp-2 text-sm font-semibold tracking-tight">{post.title || "Untitled post"}</h3>
          <p className="line-clamp-2 flex-1 text-xs text-muted-foreground">
            {post.excerpt || "No excerpt yet — open the post to add one."}
          </p>

          <div className="flex items-center justify-between border-t border-border pt-2.5 text-[11px] text-muted-foreground">
            <span>Updated {relativeTime(post.updatedAt)}</span>
            <span>{post.keywords.length} keyword{post.keywords.length === 1 ? "" : "s"}</span>
          </div>
        </div>
      </Link>

      <div className="flex items-center justify-end border-t border-border px-2 py-1.5">
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.preventDefault();
            onRemove();
          }}
          className="text-muted-foreground hover:text-danger"
        >
          <Trash2 className="size-3.5" /> Delete
        </Button>
      </div>
    </Card>
  );
}
