export class AppError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (msg = "Bad request", details?: unknown) => new AppError(400, "BAD_REQUEST", msg, details);
export const unauthorized = (msg = "Not authenticated") => new AppError(401, "UNAUTHORIZED", msg);
export const forbidden = (msg = "You do not have access to this resource") => new AppError(403, "FORBIDDEN", msg);
export const notFound = (msg = "Not found") => new AppError(404, "NOT_FOUND", msg);
export const conflict = (msg = "Conflict") => new AppError(409, "CONFLICT", msg);
export const tooMany = (msg = "Too many requests") => new AppError(429, "RATE_LIMITED", msg);
