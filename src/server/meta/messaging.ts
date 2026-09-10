import "server-only";
import { put } from "@vercel/blob";
import { IgMsgDirection, IgMsgStatus, IgMsgType, type IgConversation, type IgMessage } from "@prisma/client";
import { env } from "../env";
import { prisma } from "../prisma";
import { providerRequest } from "../http";
import { metaConnectionStatus, readMetaCredentials } from "./oauth";

/* ------------------------------------------------------------------ *
 *  Instagram Direct Messages
 *
 *  Uses the OAuth-connected Page Access Token — the System User token
 *  (`META_ACCESS_TOKEN`, used by ads.ts/pages.ts/instagram/client.ts) was
 *  never granted `instagram_manage_messages`; the Facebook-Login-for-
 *  Business connection was. This is that token's first real consumer.
 * ------------------------------------------------------------------ */

const GRAPH = "https://graph.facebook.com";

export class MessagingUnavailableError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "MessagingUnavailableError";
    this.code = code;
  }
}

interface PageAuth {
  pageId: string;
  pageAccessToken: string;
}

/** Everything a Send API call needs, or a clear reason there isn't one. */
export async function requireConnectedPage(): Promise<PageAuth> {
  const [status, credentials] = await Promise.all([metaConnectionStatus(), readMetaCredentials()]);
  if (!status.connected || !status.account) {
    throw new MessagingUnavailableError("not_connected", "Instagram isn't connected. Connect it from the Integrations page first.");
  }
  if (!credentials?.pageAccessToken) {
    throw new MessagingUnavailableError("no_token", "The Instagram connection is missing its Page access token — reconnect it.");
  }
  return { pageId: status.account.pageId, pageAccessToken: credentials.pageAccessToken };
}

async function graphGet<T>(path: string, params: Record<string, string>, token: string): Promise<T> {
  const qs = new URLSearchParams(params);
  return providerRequest<T>({ provider: "meta-messaging", url: `${GRAPH}/${env.META_GRAPH_VERSION}/${path}?${qs}`, token, cacheTtlMs: 0 });
}

async function graphPost<T>(path: string, body: unknown, token: string): Promise<T> {
  return providerRequest<T>({ provider: "meta-messaging", url: `${GRAPH}/${env.META_GRAPH_VERSION}/${path}`, token, method: "POST", body });
}

/**
 * Configuring the webhook URL under the app's Instagram product only says
 * *where* events go — the connected Page still has to be individually
 * subscribed to this app before it actually forwards anything, via
 * `POST /{page-id}/subscribed_apps`. The OAuth flow never did this, so
 * every account connected before this file existed silently sends nothing.
 *
 * Checked at most once per `RECHECK_MS` (module-scoped, so it survives for
 * a warm serverless instance) rather than on every list-conversations poll
 * — it's a no-op most of the time, but self-heals within one interval of
 * this deploying, with no manual step.
 */
let lastSubscribeCheck = 0;
const RECHECK_MS = 6 * 60 * 60 * 1000;

export async function ensurePageSubscribed(): Promise<void> {
  if (Date.now() - lastSubscribeCheck < RECHECK_MS) return;
  lastSubscribeCheck = Date.now();

  try {
    const auth = await requireConnectedPage();
    const url = `${GRAPH}/${env.META_GRAPH_VERSION}/${auth.pageId}/subscribed_apps?subscribed_fields=messages`;
    const res = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${auth.pageAccessToken}` } });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[ig-messaging] page subscribe failed (${res.status}): ${body.slice(0, 300)}`);
    }
  } catch (err) {
    console.error(`[ig-messaging] page subscribe check failed: ${err instanceof Error ? err.message : err}`);
  }
}

/* ----------------------------------- DTOs ---------------------------------- */

export interface MetaConversationDto {
  id: string;
  igUsername: string | null;
  igName: string | null;
  profilePicUrl: string | null;
  lastMessageAt: string | null;
  lastMessagePreview: string;
  lastMessageDirection: IgMsgDirection | null;
  unread: boolean;
  /** True when the last message is inbound and unanswered for 24+ hours — Meta will reject a plain reply to these. */
  unrepliedOver24h: boolean;
}

export interface MetaMessageDto {
  id: string;
  conversationId: string;
  direction: IgMsgDirection;
  type: IgMsgType;
  text: string;
  mediaUrl: string | null;
  status: IgMsgStatus;
  error: string | null;
  sentAt: string;
  sentByUserId: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function isUnrepliedOver24h(c: Pick<IgConversation, "lastMessageDirection" | "lastMessageAt">): boolean {
  return c.lastMessageDirection === IgMsgDirection.INBOUND && !!c.lastMessageAt && Date.now() - c.lastMessageAt.getTime() > DAY_MS;
}

function toConversationDto(c: IgConversation): MetaConversationDto {
  return {
    id: c.id,
    igUsername: c.igUsername,
    igName: c.igName,
    profilePicUrl: c.profilePicUrl,
    lastMessageAt: c.lastMessageAt?.toISOString() ?? null,
    lastMessagePreview: c.lastMessagePreview,
    lastMessageDirection: c.lastMessageDirection,
    unread: c.unread,
    unrepliedOver24h: isUnrepliedOver24h(c),
  };
}

function toMessageDto(m: IgMessage): MetaMessageDto {
  return {
    id: m.id,
    conversationId: m.conversationId,
    direction: m.direction,
    type: m.type,
    text: m.text,
    mediaUrl: m.mediaUrl,
    status: m.status,
    error: m.error,
    sentAt: m.sentAt.toISOString(),
    sentByUserId: m.sentByUserId,
  };
}

/* ------------------------------- reading ------------------------------- */

export async function listConversations(opts: { search?: string; unrepliedOver24h?: boolean } = {}): Promise<MetaConversationDto[]> {
  const rows = await prisma.igConversation.findMany({
    where: opts.search
      ? {
          OR: [
            { igUsername: { contains: opts.search, mode: "insensitive" } },
            { igName: { contains: opts.search, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { lastMessageAt: "desc" },
    take: 200,
  });
  const dtos = rows.map(toConversationDto);
  return opts.unrepliedOver24h ? dtos.filter((c) => c.unrepliedOver24h) : dtos;
}

/** Opening a thread is what marks it read — mirrors how Instagram's own inbox behaves. */
export async function getConversation(id: string): Promise<{ conversation: MetaConversationDto; messages: MetaMessageDto[] } | null> {
  let conversation = await prisma.igConversation.findUnique({ where: { id } });
  if (!conversation) return null;
  if (conversation.unread) {
    conversation = await prisma.igConversation.update({ where: { id }, data: { unread: false } });
  }
  const messages = await prisma.igMessage.findMany({ where: { conversationId: id }, orderBy: { sentAt: "asc" }, take: 500 });
  return { conversation: toConversationDto(conversation), messages: messages.map(toMessageDto) };
}

/* --------------------------------- webhook -------------------------------- */

interface ProfileLookup {
  name?: string;
  username?: string;
  profile_pic?: string;
}

/** Best-effort — a failed lookup still lets the message through, just without a name/avatar yet. */
async function lookupProfile(igsid: string, token: string): Promise<ProfileLookup | null> {
  try {
    return await graphGet<ProfileLookup>(igsid, { fields: "name,username,profile_pic" }, token);
  } catch (err) {
    console.error(`[ig-messaging] profile lookup failed for ${igsid}: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

interface InboundAttachment {
  type?: string;
  payload?: { url?: string };
}
interface InboundMessage {
  mid?: string;
  text?: string;
  attachments?: InboundAttachment[];
  is_echo?: boolean;
}
export interface InboundEvent {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: InboundMessage;
}

function inboundKind(msg: InboundMessage): { type: IgMsgType; text: string; mediaUrl: string | null } {
  const attachment = msg.attachments?.[0];
  if (attachment?.type === "image") return { type: IgMsgType.IMAGE, text: msg.text ?? "", mediaUrl: attachment.payload?.url ?? null };
  if (attachment?.type === "video") return { type: IgMsgType.VIDEO, text: msg.text ?? "", mediaUrl: attachment.payload?.url ?? null };
  if (attachment?.type === "audio") return { type: IgMsgType.AUDIO, text: msg.text ?? "", mediaUrl: attachment.payload?.url ?? null };
  if (attachment) return { type: IgMsgType.UNSUPPORTED, text: msg.text ?? "", mediaUrl: attachment.payload?.url ?? null };
  if (msg.text) return { type: IgMsgType.TEXT, text: msg.text, mediaUrl: null };
  return { type: IgMsgType.UNSUPPORTED, text: "", mediaUrl: null };
}

/**
 * Persists one inbound message from a verified webhook event. Echoes (our
 * own sent messages, which Meta also delivers back through the same
 * webhook) are skipped — `sendText`/`sendAudio` already recorded those
 * when they were sent.
 */
export async function recordInboundMessage(event: InboundEvent, pageAuth: PageAuth): Promise<void> {
  const senderId = event.sender?.id;
  const msg = event.message;
  if (!senderId || !msg || msg.is_echo) return;

  const { type, text, mediaUrl } = inboundKind(msg);
  const sentAt = event.timestamp ? new Date(event.timestamp) : new Date();
  const preview = text || (type === IgMsgType.AUDIO ? "Voice message" : type === IgMsgType.IMAGE ? "Photo" : type === IgMsgType.VIDEO ? "Video" : "Message");

  const existing = await prisma.igConversation.findUnique({ where: { id: senderId } });
  if (!existing) {
    const profile = await lookupProfile(senderId, pageAuth.pageAccessToken);
    await prisma.igConversation.create({
      data: {
        id: senderId,
        igUsername: profile?.username ?? null,
        igName: profile?.name ?? null,
        profilePicUrl: profile?.profile_pic ?? null,
        lastMessageAt: sentAt,
        lastMessagePreview: preview,
        lastMessageDirection: IgMsgDirection.INBOUND,
        unread: true,
      },
    });
  } else {
    await prisma.igConversation.update({
      where: { id: senderId },
      data: { lastMessageAt: sentAt, lastMessagePreview: preview, lastMessageDirection: IgMsgDirection.INBOUND, unread: true },
    });
  }

  await prisma.igMessage.create({
    data: {
      id: msg.mid ?? undefined,
      conversationId: senderId,
      direction: IgMsgDirection.INBOUND,
      type,
      text,
      mediaUrl,
      sentAt,
    },
  });
}

/* --------------------------------- sending --------------------------------- */

interface SendResult {
  message_id?: string;
}

export async function sendText(conversationId: string, text: string, userId: string | null): Promise<MetaMessageDto> {
  const auth = await requireConnectedPage();
  const trimmed = text.trim();
  if (!trimmed) throw new MessagingUnavailableError("empty", "Message text is empty.");

  let status: IgMsgStatus = IgMsgStatus.SENT;
  let error: string | null = null;
  try {
    await graphPost<SendResult>(`${auth.pageId}/messages`, { recipient: { id: conversationId }, message: { text: trimmed } }, auth.pageAccessToken);
  } catch (err) {
    status = IgMsgStatus.FAILED;
    error = err instanceof Error ? err.message : "Send failed.";
  }

  const sentAt = new Date();
  // A failed send never reached Instagram — the conversation's "last message" state (and the
  // 24h-unreplied flag it drives) must not change, even though we still record the attempt below.
  if (status === IgMsgStatus.SENT) {
    await prisma.igConversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: sentAt, lastMessagePreview: trimmed, lastMessageDirection: IgMsgDirection.OUTBOUND, unread: false },
    });
  }
  const row = await prisma.igMessage.create({
    data: { conversationId, direction: IgMsgDirection.OUTBOUND, type: IgMsgType.TEXT, text: trimmed, status, error, sentAt, sentByUserId: userId },
  });
  if (status === IgMsgStatus.FAILED) throw new MessagingUnavailableError("send_failed", error ?? "Meta rejected the message.");
  return toMessageDto(row);
}

/** Uploads once to Meta as a reusable attachment (so it can send without hosting the file ourselves), and separately keeps a playable copy in Vercel Blob for our own thread view. */
async function uploadAudioAttachment(auth: PageAuth, buffer: Buffer, contentType: string): Promise<string> {
  const form = new FormData();
  form.set("message", JSON.stringify({ attachment: { type: "audio", payload: { is_reusable: true } } }));
  form.set("filedata", new Blob([new Uint8Array(buffer)], { type: contentType }), "voice-note.webm");

  const res = await fetch(`${GRAPH}/${env.META_GRAPH_VERSION}/${auth.pageId}/message_attachments`, {
    method: "POST",
    headers: { Authorization: `Bearer ${auth.pageAccessToken}` },
    body: form,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new MessagingUnavailableError("upload_failed", `Meta rejected the voice note (${res.status}): ${body.slice(0, 300)}`);
  }
  const data = (await res.json()) as { attachment_id?: string };
  if (!data.attachment_id) throw new MessagingUnavailableError("upload_failed", "Meta didn't return an attachment id.");
  return data.attachment_id;
}

export async function sendAudio(conversationId: string, buffer: Buffer, contentType: string, userId: string | null): Promise<MetaMessageDto> {
  const auth = await requireConnectedPage();

  let status: IgMsgStatus = IgMsgStatus.SENT;
  let error: string | null = null;

  try {
    const attachmentId = await uploadAudioAttachment(auth, buffer, contentType);
    await graphPost<SendResult>(
      `${auth.pageId}/messages`,
      { recipient: { id: conversationId }, message: { attachment: { type: "audio", payload: { attachment_id: attachmentId } } } },
      auth.pageAccessToken
    );
  } catch (err) {
    status = IgMsgStatus.FAILED;
    error = err instanceof Error ? err.message : "Send failed.";
  }

  // Our own playback copy is a nice-to-have, not part of the send itself — a Blob hiccup here
  // must never turn an actually-delivered message into a reported failure.
  let mediaUrl: string | null = null;
  if (status === IgMsgStatus.SENT) {
    try {
      const blob = await put(`ig-voice-notes/${conversationId}-${Date.now()}.webm`, buffer, { access: "public", contentType });
      mediaUrl = blob.url;
    } catch (err) {
      console.error(`[ig-messaging] voice note delivered but Blob copy failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  const sentAt = new Date();
  if (status === IgMsgStatus.SENT) {
    await prisma.igConversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: sentAt, lastMessagePreview: "Voice message", lastMessageDirection: IgMsgDirection.OUTBOUND, unread: false },
    });
  }
  const row = await prisma.igMessage.create({
    data: { conversationId, direction: IgMsgDirection.OUTBOUND, type: IgMsgType.AUDIO, mediaUrl, status, error, sentAt, sentByUserId: userId },
  });
  if (status === IgMsgStatus.FAILED) throw new MessagingUnavailableError("send_failed", error ?? "Meta rejected the voice note.");
  return toMessageDto(row);
}
