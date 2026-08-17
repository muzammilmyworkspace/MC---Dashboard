import { Server as SocketServer } from "socket.io";
import type { Server as HttpServer } from "node:http";
import { corsOrigins } from "../env.js";
import { verifyAccessToken } from "../lib/tokens.js";

let io: SocketServer | null = null;

export const WORKSPACE_ROOM = "workspace";

export type RealtimeEvent =
  | "dayplan:updated"
  | "review:created"
  | "notification:new"
  | "integration:updated"
  | "deployment:updated"
  | "project:updated"
  | "instagram:synced"
  /** Field name + account id only — webhook payloads are never broadcast. */
  | "instagram:webhook";

export function initRealtime(server: HttpServer) {
  io = new SocketServer(server, {
    cors: { origin: corsOrigins, credentials: true },
  });

  // JWT handshake — unauthenticated sockets are rejected.
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error("Missing auth token"));
    try {
      const payload = verifyAccessToken(token);
      socket.data.user = payload;
      next();
    } catch {
      next(new Error("Invalid auth token"));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.data.user as { sub: string; role: string } | undefined;
    socket.join(WORKSPACE_ROOM);
    if (user) socket.join(`user:${user.sub}`);

    socket.on("disconnect", () => {
      /* rooms are cleaned up automatically */
    });
  });

  return io;
}

/** Broadcast to everyone in the workspace. */
export function emitWorkspace(event: RealtimeEvent, payload: unknown) {
  io?.to(WORKSPACE_ROOM).emit(event, payload);
}

/** Send to a single user's sockets. */
export function emitUser(userId: string, event: RealtimeEvent, payload: unknown) {
  io?.to(`user:${userId}`).emit(event, payload);
}

export function getIo() {
  return io;
}
