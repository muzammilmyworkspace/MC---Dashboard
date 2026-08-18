"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export type ConnState = "connected" | "disconnected" | "unavailable" | "loading";

export interface PlatformStatus {
  state: ConnState;
  label: string;
  lastSyncAt: string | null;
}

const LOADING: PlatformStatus = { state: "loading", label: "Checking…", lastSyncAt: null };

/** No backend integration exists for this module yet — say so, don't guess. */
const UNAVAILABLE: PlatformStatus = { state: "unavailable", label: "Not available yet", lastSyncAt: null };

/**
 * Real connection state for every platform, from the API.
 *
 * One request serves the whole dashboard. Anything the API doesn't know about
 * reports "Not available yet" rather than "Not connected" — the two mean
 * different things, and conflating them is how a UI starts lying about what
 * it can do.
 */
export function usePlatformStatus() {
  const [byKey, setByKey] = useState<Record<string, PlatformStatus> | null>(null);
  const [reachable, setReachable] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { integrations } = await api.integrations.list();
        if (cancelled) return;
        setByKey(
          Object.fromEntries(
            integrations.map((i) => [
              i.key,
              {
                state: i.status === "CONNECTED" ? ("connected" as const) : ("disconnected" as const),
                label: i.status === "CONNECTED" ? "Connected" : "Not connected",
                lastSyncAt: i.lastSyncAt,
              },
            ])
          )
        );
        setReachable(true);
      } catch {
        // Offline API is not the same as a disconnected platform.
        if (cancelled) return;
        setByKey({});
        setReachable(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function statusFor(integrationKey: string | null): PlatformStatus {
    if (integrationKey === null) return UNAVAILABLE;
    if (byKey === null) return LOADING;
    return byKey[integrationKey] ?? UNAVAILABLE;
  }

  return { statusFor, reachable, loading: byKey === null };
}
