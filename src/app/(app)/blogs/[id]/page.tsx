"use client";

import { use } from "react";
import { BlogEditor } from "@/components/blogs/blog-editor";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <BlogEditor id={id} />;
}
