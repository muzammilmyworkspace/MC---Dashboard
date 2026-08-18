"use client";

/* ------------------------------------------------------------------ *
 *  MC Nexus — realtime client (Socket.io)
 *  Connects with the in-memory access token; reconnects when it changes.
 * ------------------------------------------------------------------ */

import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import { API_URL, getAccessToken, onAccessTokenChange } from "./api";

export type RealtimeEvent =
  | "dayplan:updated"
  | "review:created"
  | "notification:new"
  | "integration:updated"
  | "deployment:updated"
  | "project:updated";

let socket: Socket | null = null;

/**
 * Realtime needs a socket server, which only exists when the API is a
 * separate long-running host. Same-origin (empty API_URL) means the API is
 * running as serverless functions, where no connection can be held open —
 * so connecting is skipped rather than left retrying forever against an
 * endpoint that will never answer.
 */
const realtimeAvailable = API_URL !== "";

export function connectRealtime(): Socket | null {
  if (!realtimeAvailable) return null;

  const token = getAccessToken();
  if (!token) return null;
  if (socket?.connected) return socket;

  socket?.disconnect();
  socket = io(API_URL, { auth: { token }, transports: ["websocket"], withCredentials: true });
  return socket;
}

export function disconnectRealtime() {
  socket?.disconnect();
  socket = null;
}

/** Reconnects automatically whenever the access token changes. */
export function initRealtimeAutoConnect() {
  connectRealtime();
  return onAccessTokenChange((token) => (token ? connectRealtime() : disconnectRealtime()));
}

/**
 * Subscribe to a realtime event for the lifetime of a component.
 *
 *   useRealtime("dayplan:updated", (plan) => setPlans(...));
 */
export function useRealtime<T = unknown>(event: RealtimeEvent, handler: (payload: T) => void) {
  const ref = useRef(handler);

  // Keep the latest handler without re-subscribing on every render.
  useEffect(() => {
    ref.current = handler;
  });

  useEffect(() => {
    const s = connectRealtime();
    if (!s) return;
    const fn = (payload: T) => ref.current(payload);
    s.on(event, fn);
    return () => {
      s.off(event, fn);
    };
  }, [event]);
}
