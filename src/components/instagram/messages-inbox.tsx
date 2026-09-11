"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, History, ListChecks, Loader2, Maximize2, Mic, Minimize2, Search, Send, Square, Users, X } from "lucide-react";
import { api, ApiRequestError, type MetaConversation, type MetaMessage, type MetaMessagesResponse } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { relativeTime, cn } from "@/lib/utils";

/* ------------------------------------------------------------------ *
 *  Instagram DM inbox.
 *
 *  A webhook persists new messages to our own database in near-real
 *  time (see src/app/api/webhooks/meta); this just polls that database
 *  every few seconds while it's open — there's no persistent server to
 *  push over a socket from on Vercel, and the codebase already treats
 *  "webhook is the source of truth, polling is the browser noticing" as
 *  the normal pattern (same idea as the deployment-sync fallback).
 * ------------------------------------------------------------------ */

const LIST_POLL_MS = 10_000;
const THREAD_POLL_MS = 5_000;

const micSupported = typeof window !== "undefined" && "mediaDevices" in navigator && "MediaRecorder" in window;

function formatElapsed(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Mic capture shared by the normal reply composer and the broadcast dialog — record, preview, discard. */
function useVoiceRecorder() {
  const [recording, setRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    },
    []
  );

  // Recomputed only when the recording actually changes, and revoked on cleanup —
  // calling createObjectURL directly in the render body would leak one per render.
  const recordedUrl = useMemo(() => (recordedBlob ? URL.createObjectURL(recordedBlob) : null), [recordedBlob]);
  useEffect(() => () => { if (recordedUrl) URL.revokeObjectURL(recordedUrl); }, [recordedUrl]);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4" : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        setRecordedBlob(new Blob(chunksRef.current, { type: mimeType }));
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } catch {
      toast.error("Couldn't access the microphone.", { description: "Allow microphone access in your browser and try again." });
    }
  }

  function stop() {
    recorderRef.current?.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }

  function discard() {
    setRecordedBlob(null);
    setElapsed(0);
  }

  return { recording, recordedBlob, recordedUrl, elapsed, start, stop, discard };
}

export function MessagesInbox() {
  const [readiness, setReadiness] = useState<MetaMessagesResponse | null>(null);
  const [conversations, setConversations] = useState<MetaConversation[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [unrepliedOnly, setUnrepliedOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [fullScreen, setFullScreen] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [broadcastOpen, setBroadcastOpen] = useState(false);

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Exit full screen with Escape, matching every other full-screen overlay's expected behavior.
  useEffect(() => {
    if (!fullScreen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setFullScreen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullScreen]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const loadList = useCallback(async () => {
    try {
      const res = await api.integrations.metaMessages({ search: debouncedSearch || undefined, unrepliedOver24h: unrepliedOnly });
      setReadiness(res);
      setConversations(res.conversations);
      setListError(null);
    } catch (err) {
      setListError(err instanceof ApiRequestError ? err.message : "Could not load conversations.");
    }
  }, [debouncedSearch, unrepliedOnly]);

  // Fetches inline rather than calling `loadList` directly — an effect invoking a
  // function reference that setStates (even from behind its own await) reads as a
  // synchronous setState-in-effect to the linter; a fresh async literal here doesn't.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await api.integrations.metaMessages({ search: debouncedSearch || undefined, unrepliedOver24h: unrepliedOnly });
        if (cancelled) return;
        setReadiness(res);
        setConversations(res.conversations);
        setListError(null);
      } catch (err) {
        if (cancelled) return;
        setListError(err instanceof ApiRequestError ? err.message : "Could not load conversations.");
      }
    })();
    const id = setInterval(() => void loadList(), LIST_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [debouncedSearch, unrepliedOnly, loadList]);

  if (readiness?.setupRequired) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/[0.06] p-4">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
        <div>
          <p className="text-sm font-medium">Setup required — Instagram messaging</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{readiness.reason}</p>
          {!readiness.webhookConfigured && (
            <p className="mt-1 text-xs text-muted-foreground">
              Conversations arrive by webhook rather than polling, so an active subscription is needed too.
            </p>
          )}
        </div>
      </div>
    );
  }

  if (!readiness) return <Card className="h-[680px] animate-pulse bg-muted/40" />;

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await api.integrations.metaSyncHistory();
      toast(res.imported > 0 ? `Imported ${res.imported} conversation${res.imported === 1 ? "" : "s"}` : "Nothing new to import", {
        description: res.skipped > 0 ? `${res.skipped} already up to date.` : undefined,
      });
      await loadList();
    } catch (err) {
      toast.error("Couldn't import history", { description: err instanceof ApiRequestError ? err.message : "Try again." });
    } finally {
      setSyncing(false);
    }
  }

  return (
    <>
      {fullScreen && <div className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm" onClick={() => setFullScreen(false)} />}
      <Card
        className={cn(
          "flex flex-col overflow-hidden p-0",
          fullScreen ? "fixed inset-3 z-50 sm:inset-6" : "h-[680px]"
        )}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2.5">
          <p className="text-sm font-semibold">Messages</p>
          <button
            onClick={() => setFullScreen((v) => !v)}
            title={fullScreen ? "Exit full screen" : "Open full screen, like Instagram"}
            className="rounded-lg border border-border p-1.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            {fullScreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="flex w-[300px] shrink-0 flex-col border-r border-border">
            <div className="space-y-2 border-b border-border p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search people…" className="h-8 pl-8 text-xs" />
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setUnrepliedOnly((v) => !v)}
                  className={cn(
                    "flex-1 rounded-lg border px-2.5 py-1.5 text-left text-xs font-medium transition-colors",
                    unrepliedOnly ? "border-warning/40 bg-warning/10 text-warning" : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  No reply in 24h+{unrepliedOnly ? " · showing" : ""}
                </button>
                <button
                  onClick={() => void handleSync()}
                  disabled={syncing}
                  title="Import conversation history from before this connection was fixed"
                  className="shrink-0 rounded-lg border border-border p-1.5 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                >
                  <History className={cn("size-3.5", syncing && "animate-pulse")} />
                </button>
                <button
                  onClick={() => {
                    setSelectMode((v) => !v);
                    setSelected(new Set());
                  }}
                  title={selectMode ? "Cancel selecting" : "Select conversations to send one voice message to all of them"}
                  className={cn(
                    "shrink-0 rounded-lg border p-1.5 transition-colors",
                    selectMode ? "border-accent/40 bg-accent-soft text-accent" : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  <ListChecks className="size-3.5" />
                </button>
              </div>

              {selectMode && (
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <button
                    onClick={() => setSelected(new Set(conversations.map((c) => c.id)))}
                    className="font-medium text-accent hover:underline"
                  >
                    Select all ({conversations.length})
                  </button>
                  {selected.size > 0 && (
                    <button onClick={() => setSelected(new Set())} className="hover:underline">
                      Clear ({selected.size})
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="no-scrollbar flex-1 overflow-y-auto">
              {listError ? (
                <p className="p-4 text-xs text-danger">{listError}</p>
              ) : conversations.length === 0 ? (
                <p className="p-6 text-center text-xs text-muted-foreground">
                  {unrepliedOnly || debouncedSearch ? "No conversations match." : "No conversations yet."}
                </p>
              ) : (
                conversations.map((c) => (
                  <ConversationRow
                    key={c.id}
                    conv={c}
                    active={c.id === selectedId}
                    selectMode={selectMode}
                    checked={selected.has(c.id)}
                    onClick={() => (selectMode ? toggleSelected(c.id) : setSelectedId(c.id))}
                  />
                ))
              )}
            </div>

            {selectMode && selected.size > 0 && (
              <div className="shrink-0 border-t border-border p-2.5">
                <Button size="sm" className="w-full" onClick={() => setBroadcastOpen(true)}>
                  <Users className="size-3.5" /> Send voice to {selected.size}
                </Button>
              </div>
            )}
          </div>

          <div className="flex flex-1 flex-col">
            {selectedId ? (
              <ThreadView key={selectedId} conversationId={selectedId} onMessageSent={() => void loadList()} />
            ) : (
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Select a conversation</div>
            )}
          </div>
        </div>
      </Card>

      {broadcastOpen && (
        <BroadcastDialog
          conversationIds={[...selected]}
          conversations={conversations}
          onClose={() => setBroadcastOpen(false)}
          onDone={() => {
            setBroadcastOpen(false);
            setSelectMode(false);
            setSelected(new Set());
            void loadList();
          }}
        />
      )}
    </>
  );
}

function ConversationRow({
  conv,
  active,
  selectMode,
  checked,
  onClick,
}: {
  conv: MetaConversation;
  active: boolean;
  selectMode?: boolean;
  checked?: boolean;
  onClick: () => void;
}) {
  const label = conv.igName || conv.igUsername || "Instagram user";
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        "flex w-full cursor-pointer items-center gap-3 border-b border-border/60 px-3 py-2.5 text-left transition-colors",
        active && !selectMode ? "bg-accent-soft" : "hover:bg-muted/40"
      )}
    >
      {selectMode && (
        <input
          type="checkbox"
          checked={!!checked}
          onChange={onClick}
          onClick={(e) => e.stopPropagation()}
          className="size-4 shrink-0 accent-accent"
        />
      )}
      <div className="relative size-11 shrink-0 overflow-hidden rounded-full bg-muted">
        {conv.profilePicUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={conv.profilePicUrl} alt="" className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center text-xs font-semibold text-muted-foreground">
            {label.slice(0, 1).toUpperCase()}
          </div>
        )}
        {conv.unread && <span className="absolute right-0 top-0 size-2.5 rounded-full bg-accent ring-2 ring-card" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className={cn("truncate text-[13px]", conv.unread ? "font-semibold" : "font-medium")}>{label}</p>
          {conv.lastMessageAt && <span className="shrink-0 text-[11px] text-muted-foreground">{relativeTime(conv.lastMessageAt)}</span>}
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {conv.lastMessageDirection === "OUTBOUND" && "You: "}
          {conv.lastMessagePreview || "No messages yet"}
        </p>
      </div>
      {conv.unrepliedOver24h && (
        <span className="shrink-0 rounded-full bg-warning/15 px-1.5 py-0.5 text-[9px] font-semibold text-warning">24h+</span>
      )}
    </div>
  );
}

function ThreadView({ conversationId, onMessageSent }: { conversationId: string; onMessageSent: () => void }) {
  const [thread, setThread] = useState<{ conversation: MetaConversation; messages: MetaMessage[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.integrations.metaThread(conversationId);
      setThread(res);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Could not load this conversation.");
    }
  }, [conversationId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await api.integrations.metaThread(conversationId);
        if (cancelled) return;
        setThread(res);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof ApiRequestError ? err.message : "Could not load this conversation.");
      }
    })();
    const id = setInterval(() => void load(), THREAD_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [conversationId, load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [thread?.messages.length]);

  if (error) {
    return <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-danger">{error}</div>;
  }
  if (!thread) {
    return <div className="flex-1 animate-pulse bg-muted/30" />;
  }

  const label = thread.conversation.igName || thread.conversation.igUsername || "Instagram user";

  return (
    <>
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <div className="size-9 shrink-0 overflow-hidden rounded-full bg-muted">
          {thread.conversation.profilePicUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thread.conversation.profilePicUrl} alt="" className="size-full object-cover" />
          ) : (
            <div className="flex size-full items-center justify-center text-xs font-semibold text-muted-foreground">
              {label.slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>
        <div>
          <p className="text-sm font-semibold">{label}</p>
          {thread.conversation.igUsername && <p className="text-xs text-muted-foreground">@{thread.conversation.igUsername}</p>}
        </div>
        {thread.conversation.unrepliedOver24h && (
          <span className="ml-auto shrink-0 rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-medium text-warning">
            No reply 24h+ — plain replies may be rejected
          </span>
        )}
      </div>

      <div className="no-scrollbar flex-1 space-y-2 overflow-y-auto p-4">
        {thread.messages.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground">No messages yet.</p>
        ) : (
          thread.messages.map((m) => <MessageBubble key={m.id} message={m} />)
        )}
        <div ref={bottomRef} />
      </div>

      <Composer
        conversationId={conversationId}
        onSent={(m) => {
          setThread((t) => (t ? { ...t, messages: [...t.messages, m] } : t));
          onMessageSent();
        }}
      />
    </>
  );
}

function MessageBubble({ message }: { message: MetaMessage }) {
  const own = message.direction === "OUTBOUND";
  return (
    <div className={cn("flex", own ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[75%] rounded-2xl px-3.5 py-2 text-sm",
          own ? "bg-accent text-accent-foreground" : "bg-muted text-foreground"
        )}
      >
        {message.type === "AUDIO" ? (
          message.mediaUrl ? (
            <audio src={message.mediaUrl} controls className="h-9 w-56" />
          ) : (
            <p className="italic opacity-70">Voice message (no longer available)</p>
          )
        ) : message.type === "IMAGE" && message.mediaUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={message.mediaUrl} alt="" className="max-h-64 rounded-lg" />
        ) : message.type === "VIDEO" && message.mediaUrl ? (
          <video src={message.mediaUrl} controls className="max-h-64 rounded-lg" />
        ) : (
          <p className="whitespace-pre-wrap">{message.text || "—"}</p>
        )}
        <p className={cn("mt-1 text-[10px]", own ? "text-accent-foreground/70" : "text-muted-foreground")}>
          {new Date(message.sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          {message.status === "FAILED" && " · Failed to send"}
        </p>
      </div>
    </div>
  );
}

function Composer({ conversationId, onSent }: { conversationId: string; onSent: (m: MetaMessage) => void }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const rec = useVoiceRecorder();

  async function sendVoice() {
    if (!rec.recordedBlob) return;
    setSending(true);
    try {
      const { message } = await api.integrations.metaSendAudio(conversationId, rec.recordedBlob);
      onSent(message);
      rec.discard();
    } catch (err) {
      toast.error("Couldn't send the voice note.", { description: err instanceof ApiRequestError ? err.message : undefined });
    } finally {
      setSending(false);
    }
  }

  async function sendMessage() {
    const trimmed = text.trim();
    if (!trimmed) return;
    setSending(true);
    try {
      const { message } = await api.integrations.metaSendText(conversationId, trimmed);
      onSent(message);
      setText("");
    } catch (err) {
      toast.error("Couldn't send the message.", { description: err instanceof ApiRequestError ? err.message : undefined });
    } finally {
      setSending(false);
    }
  }

  if (rec.recordedBlob) {
    return (
      <div className="flex items-center gap-2 border-t border-border p-3">
        <audio src={rec.recordedUrl ?? undefined} controls className="h-9 flex-1" />
        <Button variant="ghost" size="icon-sm" onClick={rec.discard} disabled={sending} aria-label="Discard recording">
          <X className="size-4" />
        </Button>
        <Button size="icon-sm" onClick={() => void sendVoice()} disabled={sending} aria-label="Send voice note">
          <Send className="size-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 border-t border-border p-3">
      {rec.recording ? (
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          <span className="size-2 animate-pulse rounded-full bg-danger" />
          Recording… {formatElapsed(rec.elapsed)}
        </div>
      ) : (
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void sendMessage();
            }
          }}
          placeholder="Message…"
          className="flex-1"
          disabled={sending}
        />
      )}
      {micSupported && (
        <Button
          variant={rec.recording ? "danger" : "ghost"}
          size="icon-sm"
          onClick={rec.recording ? rec.stop : () => void rec.start()}
          disabled={sending}
          aria-label={rec.recording ? "Stop recording" : "Record a voice note"}
        >
          {rec.recording ? <Square className="size-4" /> : <Mic className="size-4" />}
        </Button>
      )}
      {!rec.recording && (
        <Button size="icon-sm" onClick={() => void sendMessage()} disabled={sending || !text.trim()} aria-label="Send message">
          <Send className="size-4" />
        </Button>
      )}
    </div>
  );
}

type BroadcastResult = { conversationId: string; status: "SENT" | "FAILED"; error: string | null };

/** Record one voice note, then forward it to every conversation selected in the list. */
function BroadcastDialog({
  conversationIds,
  conversations,
  onClose,
  onDone,
}: {
  conversationIds: string[];
  conversations: MetaConversation[];
  onClose: () => void;
  onDone: () => void;
}) {
  const rec = useVoiceRecorder();
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<BroadcastResult[] | null>(null);
  const nameById = useMemo(
    () => new Map(conversations.map((c) => [c.id, c.igName || c.igUsername || "Instagram user"])),
    [conversations]
  );

  async function send() {
    if (!rec.recordedBlob) return;
    setSending(true);
    try {
      const { results: res } = await api.integrations.metaBroadcastAudio(conversationIds, rec.recordedBlob);
      setResults(res);
      const sent = res.filter((r) => r.status === "SENT").length;
      toast(sent > 0 ? `Sent to ${sent} of ${res.length}` : "Couldn't send to anyone", {
        description: sent < res.length ? `${res.length - sent} failed — see details below.` : undefined,
      });
    } catch (err) {
      toast.error("Couldn't send the broadcast.", { description: err instanceof ApiRequestError ? err.message : undefined });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => !sending && onClose()} />
      <Card className="relative flex w-full max-w-sm flex-col gap-3 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Send voice to {conversationIds.length} {conversationIds.length === 1 ? "person" : "people"}</p>
          <Button variant="ghost" size="icon-sm" onClick={onClose} disabled={sending} aria-label="Close">
            <X className="size-4" />
          </Button>
        </div>

        {results ? (
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {results.map((r) => (
              <div key={r.conversationId} className="flex items-center justify-between gap-2 rounded-lg border border-border px-2.5 py-1.5 text-xs">
                <span className="truncate">{nameById.get(r.conversationId) ?? r.conversationId}</span>
                {r.status === "SENT" ? (
                  <span className="shrink-0 text-accent">Sent</span>
                ) : (
                  <span className="shrink-0 text-danger" title={r.error ?? undefined}>Failed</span>
                )}
              </div>
            ))}
          </div>
        ) : rec.recordedBlob ? (
          <div className="flex items-center gap-2">
            <audio src={rec.recordedUrl ?? undefined} controls className="h-9 flex-1" />
            <Button variant="ghost" size="icon-sm" onClick={rec.discard} disabled={sending} aria-label="Discard recording">
              <X className="size-4" />
            </Button>
          </div>
        ) : rec.recording ? (
          <div className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
            <span className="size-2 animate-pulse rounded-full bg-danger" />
            Recording… {formatElapsed(rec.elapsed)}
          </div>
        ) : micSupported ? (
          <button
            onClick={() => void rec.start()}
            className="flex items-center justify-center gap-2 rounded-lg border border-border py-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <Mic className="size-4" /> Tap to record
          </button>
        ) : (
          <p className="text-xs text-danger">This browser can&apos;t record audio.</p>
        )}

        {!results && (
          <div className="flex items-center justify-end gap-2">
            {rec.recording ? (
              <Button size="sm" variant="danger" onClick={rec.stop}>
                <Square className="size-3.5" /> Stop
              </Button>
            ) : (
              <Button size="sm" onClick={() => void send()} disabled={!rec.recordedBlob || sending}>
                {sending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                {sending ? "Sending…" : `Send to ${conversationIds.length}`}
              </Button>
            )}
          </div>
        )}
        {results && (
          <Button size="sm" onClick={onDone}>
            Done
          </Button>
        )}
      </Card>
    </div>
  );
}
