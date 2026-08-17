import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { AppError } from "../lib/errors.js";
import { isProd } from "../env.js";

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found" } });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: { code: "CONFLICT", message: "A record with that value already exists" } });
    }
    if (err.code === "P2025") {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Record not found" } });
    }
  }

  if (err instanceof Prisma.PrismaClientInitializationError) {
    return res.status(503).json({
      error: { code: "DB_UNAVAILABLE", message: "Database is unavailable. Is PostgreSQL running? (docker compose up -d)" },
    });
  }

  const message = err instanceof Error ? err.message : "Unexpected error";
  console.error("[error]", err);
  res.status(500).json({
    error: { code: "INTERNAL", message: isProd ? "Something went wrong" : message },
  });
}
