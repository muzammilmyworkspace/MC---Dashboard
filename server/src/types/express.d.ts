import type { AccessPayload } from "../lib/tokens.js";

declare global {
  namespace Express {
    interface Request {
      user?: AccessPayload;
    }
  }
}

export {};
