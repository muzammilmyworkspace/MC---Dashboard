import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Keep native/server-only packages out of the bundler.
   *
   * Prisma ships a platform-specific query engine binary and resolves it at
   * runtime; bundling the client breaks that path resolution on Vercel. The
   * same applies to ioredis and bcryptjs, which use native or dynamic
   * requires that a bundler cannot statically follow.
   */
  serverExternalPackages: ["@prisma/client", ".prisma/client", "ioredis", "bcryptjs"],
};

export default nextConfig;
