"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, History, Mic, Search, Send, Square, X } from "lucide-react";
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

export function MessagesInbox() {
  const [readiness, setReadiness] = useState<MetaMessagesResponse | null>(null);
  const [conversations, setConversations] = useState<MetaConversation[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [unrepliedOnly, setUnrepliedOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

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
    <Card className="flex h-[680px] overflow-hidden p-0">
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
          </div>
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
              <ConversationRow key={c.id} conv={c} active={c.id === selectedId} onClick={() => setSelectedId(c.id)} />
            ))
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col">
        {selectedId ? (
          <ThreadView key={selectedId} conversationId={selectedId} onMessageSent={() => void loadList()} />
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Select a conversation</div>
        )}
      </div>
    </Card>
  );
}

function ConversationRow({ conv, active, onClick }: { conv: MetaConversation; active: boolean; onClick: () => void }) {
  const label = conv.igName || conv.igUsername || "Instagram user";
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 border-b border-border/60 px-3 py-2.5 text-left transition-colors",
        active ? "bg-accent-soft" : "hover:bg-muted/40"
      )}
    >
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
    </button>
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

function formatElapsed(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const micSupported = typeof window !== "undefined" && "mediaDevices" in navigator && "MediaRecorder" in window;

function Composer({ conversationId, onSent }: { conversationId: string; onSent: (m: MetaMessage) => void }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
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

  async function startRecording() {
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

  function stopRecording() {
    recorderRef.current?.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }

  function discardRecording() {
    setRecordedBlob(null);
    setElapsed(0);
  }

  async function sendVoice() {
    if (!recordedBlob) return;
    setSending(true);
    try {
      const { message } = await api.integrations.metaSendAudio(conversationId, recordedBlob);
      onSent(message);
      setRecordedBlob(null);
      setElapsed(0);
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

  if (recordedBlob) {
    return (
      <div className="flex items-center gap-2 border-t border-border p-3">
        <audio src={recordedUrl ?? undefined} controls className="h-9 flex-1" />
        <Button variant="ghost" size="icon-sm" onClick={discardRecording} disabled={sending} aria-label="Discard recording">
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
      {recording ? (
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          <span className="size-2 animate-pulse rounded-full bg-danger" />
          Recording… {formatElapsed(elapsed)}
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
          variant={recording ? "danger" : "ghost"}
          size="icon-sm"
          onClick={recording ? stopRecording : () => void startRecording()}
          disabled={sending}
          aria-label={recording ? "Stop recording" : "Record a voice note"}
        >
          {recording ? <Square className="size-4" /> : <Mic className="size-4" />}
        </Button>
      )}
      {!recording && (
        <Button size="icon-sm" onClick={() => void sendMessage()} disabled={sending || !text.trim()} aria-label="Send message">
          <Send className="size-4" />
        </Button>
      )}
    </div>
  );
}
