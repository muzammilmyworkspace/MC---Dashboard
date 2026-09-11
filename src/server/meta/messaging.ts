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
 *  Runs on "Instagram API with Instagram Login" — a direct Instagram User
 *  Access Token (no Facebook Page involved), against graph.instagram.com.
 *  The System User token (`META_ACCESS_TOKEN`, used by ads.ts/pages.ts/
 *  instagram/client.ts) is untouched and was never part of this path.
 * ------------------------------------------------------------------ */

const GRAPH = "https://graph.instagram.com";

export class MessagingUnavailableError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "MessagingUnavailableError";
    this.code = code;
  }
}

interface IgAuth {
  igUserId: string;
  igAccessToken: string;
}

/** Everything a Send API call needs, or a clear reason there isn't one. */
export async function requireConnectedAccount(): Promise<IgAuth> {
  const [status, credentials] = await Promise.all([metaConnectionStatus(), readMetaCredentials()]);
  if (!status.connected || !status.account) {
    throw new MessagingUnavailableError("not_connected", "Instagram isn't connected. Connect it from the Integrations page first.");
  }
  if (!credentials?.igAccessToken) {
    throw new MessagingUnavailableError("no_token", "The Instagram connection is missing its access token — reconnect it.");
  }
  return { igUserId: status.account.igAccountId, igAccessToken: credentials.igAccessToken };
}

async function graphGet<T>(path: string, params: Record<string, string>, token: string): Promise<T> {
  const qs = new URLSearchParams(params);
  return providerRequest<T>({ provider: "meta-messaging", url: `${GRAPH}/${env.META_GRAPH_VERSION}/${path}?${qs}`, token, cacheTtlMs: 0 });
}

async function graphPost<T>(path: string, body: unknown, token: string): Promise<T> {
  return providerRequest<T>({ provider: "meta-messaging", url: `${GRAPH}/${env.META_GRAPH_VERSION}/${path}`, token, method: "POST", body });
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
 * Persists one message from a verified webhook event — inbound (a contact
 * messaged us) or an echo (we sent a message, on any surface — our own
 * dashboard or the Instagram app directly; Meta delivers both through the
 * same webhook). An echo is skipped only when it's one we already recorded
 * ourselves: `sendText`/`sendAudio`/`broadcastAudio` store Meta's own
 * message id as the row id, so a matching id here means "already have it."
 * An echo with no match means the reply happened outside this dashboard —
 * the only way to keep the two in sync is to record it now.
 */
export async function recordInboundMessage(event: InboundEvent, igAuth: IgAuth): Promise<void> {
  const msg = event.message;
  if (!msg) return;

  const isEcho = !!msg.is_echo;
  // An echo reports us as the sender and the contact as the recipient — the opposite of an inbound event.
  const contactId = isEcho ? event.recipient?.id : event.sender?.id;
  if (!contactId) return;

  if (isEcho) {
    if (!msg.mid) return;
    const existing = await prisma.igMessage.findUnique({ where: { id: msg.mid } });
    if (existing) return;
  }

  const direction = isEcho ? IgMsgDirection.OUTBOUND : IgMsgDirection.INBOUND;
  const { type, text, mediaUrl } = inboundKind(msg);
  const sentAt = event.timestamp ? new Date(event.timestamp) : new Date();
  const preview = text || (type === IgMsgType.AUDIO ? "Voice message" : type === IgMsgType.IMAGE ? "Photo" : type === IgMsgType.VIDEO ? "Video" : "Message");

  const existingConversation = await prisma.igConversation.findUnique({ where: { id: contactId } });
  if (!existingConversation) {
    const profile = await lookupProfile(contactId, igAuth.igAccessToken);
    await prisma.igConversation.create({
      data: {
        id: contactId,
        igUsername: profile?.username ?? null,
        igName: profile?.name ?? null,
        profilePicUrl: profile?.profile_pic ?? null,
        lastMessageAt: sentAt,
        lastMessagePreview: preview,
        lastMessageDirection: direction,
        unread: !isEcho,
      },
    });
  } else {
    await prisma.igConversation.update({
      where: { id: contactId },
      data: { lastMessageAt: sentAt, lastMessagePreview: preview, lastMessageDirection: direction, unread: !isEcho },
    });
  }

  await prisma.igMessage.create({
    data: {
      id: msg.mid ?? undefined,
      conversationId: contactId,
      direction,
      type,
      text,
      mediaUrl,
      sentAt,
    },
  });
}

/* --------------------------------- backfill --------------------------------- */

interface GraphParticipant {
  id?: string;
  username?: string;
}
interface GraphMessage {
  id: string;
  message?: string;
  from?: GraphParticipant;
  created_time?: string;
}
interface GraphConversation {
  participants?: { data?: GraphParticipant[] };
  messages?: { data?: GraphMessage[] };
}

/**
 * One-time historical import: pulls conversations directly from the Graph
 * API for any contact the webhook has never recorded yet. Only used to
 * backfill history from before the webhook subscription was working —
 * everything from here on arrives live via the webhook instead.
 *
 * Safe to re-run: a conversation already present locally is left
 * untouched, so this never re-creates or duplicates a message the webhook
 * already stored.
 *
 * The "self" participant is matched by username, not by igUserId — the
 * conversations/messages edge identifies participants with a different
 * Instagram id namespace (IGSID) than the one `/me` and the Send API use
 * for the same account, so comparing ids here would misclassify every
 * message.
 */
export async function syncHistoricalConversations(): Promise<{ imported: number; skipped: number }> {
  const [auth, status] = await Promise.all([requireConnectedAccount(), metaConnectionStatus()]);
  const selfUsername = status.account?.igUsername;
  if (!selfUsername) throw new MessagingUnavailableError("no_token", "The Instagram connection is missing its username — reconnect it.");

  const res = await graphGet<{ data?: GraphConversation[] }>(
    `${auth.igUserId}/conversations`,
    { fields: "participants,messages.limit(100){id,message,from,created_time}", limit: "100" },
    auth.igAccessToken
  );

  let imported = 0;
  let skipped = 0;

  for (const conv of res.data ?? []) {
    const participants = conv.participants?.data ?? [];
    const other = participants.length === 2 ? participants.find((p) => p.username !== selfUsername) : undefined;
    if (!other?.id) continue;

    const existing = await prisma.igConversation.findUnique({ where: { id: other.id } });
    if (existing) {
      skipped++;
      continue;
    }

    const messages = [...(conv.messages?.data ?? [])].reverse(); // Graph returns newest-first; store oldest-first.
    if (messages.length === 0) continue;

    const profile = await lookupProfile(other.id, auth.igAccessToken);

    await prisma.igConversation.create({
      data: {
        id: other.id,
        igUsername: profile?.username ?? other.username ?? null,
        igName: profile?.name ?? null,
        profilePicUrl: profile?.profile_pic ?? null,
      },
    });

    let lastMessageAt: Date | null = null;
    let lastMessagePreview = "";
    let lastMessageDirection: IgMsgDirection | null = null;

    for (const m of messages) {
      const direction = m.from?.username === selfUsername ? IgMsgDirection.OUTBOUND : IgMsgDirection.INBOUND;
      const text = m.message ?? "";
      const sentAt = m.created_time ? new Date(m.created_time) : new Date();
      const preview = text || "Message";

      await prisma.igMessage.upsert({
        where: { id: m.id },
        create: { id: m.id, conversationId: other.id, direction, type: text ? IgMsgType.TEXT : IgMsgType.UNSUPPORTED, text, sentAt },
        update: {},
      });

      lastMessageAt = sentAt;
      lastMessagePreview = preview;
      lastMessageDirection = direction;
    }

    await prisma.igConversation.update({
      where: { id: other.id },
      data: { lastMessageAt, lastMessagePreview, lastMessageDirection, unread: lastMessageDirection === IgMsgDirection.INBOUND },
    });

    imported++;
  }

  return { imported, skipped };
}

/* --------------------------------- sending --------------------------------- */

interface SendResult {
  message_id?: string;
}

export async function sendText(conversationId: string, text: string, userId: string | null): Promise<MetaMessageDto> {
  const auth = await requireConnectedAccount();
  const trimmed = text.trim();
  if (!trimmed) throw new MessagingUnavailableError("empty", "Message text is empty.");

  let status: IgMsgStatus = IgMsgStatus.SENT;
  let error: string | null = null;
  let messageId: string | undefined;
  try {
    const result = await graphPost<SendResult>(`${auth.igUserId}/messages`, { recipient: { id: conversationId }, message: { text: trimmed } }, auth.igAccessToken);
    messageId = result.message_id;
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
  // Storing Meta's own message id (rather than letting Prisma generate one) is what lets the
  // webhook's echo of this exact send recognize it later and skip re-recording it as a duplicate.
  const row = await prisma.igMessage.create({
    data: { id: messageId, conversationId, direction: IgMsgDirection.OUTBOUND, type: IgMsgType.TEXT, text: trimmed, status, error, sentAt, sentByUserId: userId },
  });
  if (status === IgMsgStatus.FAILED) throw new MessagingUnavailableError("send_failed", error ?? "Meta rejected the message.");
  return toMessageDto(row);
}

/** Uploads once to Meta as a reusable attachment (so it can send without hosting the file ourselves), and separately keeps a playable copy in Vercel Blob for our own thread view. */
async function uploadAudioAttachment(auth: IgAuth, buffer: Buffer, contentType: string): Promise<string> {
  const form = new FormData();
  form.set("message", JSON.stringify({ attachment: { type: "audio", payload: { is_reusable: true } } }));
  form.set("filedata", new Blob([new Uint8Array(buffer)], { type: contentType }), "voice-note.webm");

  const res = await fetch(`${GRAPH}/${env.META_GRAPH_VERSION}/${auth.igUserId}/message_attachments`, {
    method: "POST",
    headers: { Authorization: `Bearer ${auth.igAccessToken}` },
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
  const auth = await requireConnectedAccount();

  let status: IgMsgStatus = IgMsgStatus.SENT;
  let error: string | null = null;
  let messageId: string | undefined;

  try {
    const attachmentId = await uploadAudioAttachment(auth, buffer, contentType);
    const result = await graphPost<SendResult>(
      `${auth.igUserId}/messages`,
      { recipient: { id: conversationId }, message: { attachment: { type: "audio", payload: { attachment_id: attachmentId } } } },
      auth.igAccessToken
    );
    messageId = result.message_id;
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
    data: { id: messageId, conversationId, direction: IgMsgDirection.OUTBOUND, type: IgMsgType.AUDIO, mediaUrl, status, error, sentAt, sentByUserId: userId },
  });
  if (status === IgMsgStatus.FAILED) throw new MessagingUnavailableError("send_failed", error ?? "Meta rejected the voice note.");
  return toMessageDto(row);
}

export interface BroadcastResult {
  conversationId: string;
  status: IgMsgStatus;
  error: string | null;
}

/** Upper bound on one broadcast call — keeps it well inside the route's time limit and matches the account's realistic scale. */
const MAX_BROADCAST_RECIPIENTS = 30;

/**
 * Sends one recorded voice note to many conversations at once — "forward to
 * multiple people" for the DM inbox. The recording is uploaded to Meta once
 * (a reusable attachment, same as a single send) and that one attachment id
 * is reused for every recipient's Send API call, so the file only leaves
 * the browser once no matter how many people it goes to.
 *
 * Recipients outside Meta's 24h messaging window (see unrepliedOver24h) may
 * still be rejected by Meta itself — that surfaces as a normal per-recipient
 * failure here, same as any other declined send.
 */
export async function broadcastAudio(
  conversationIds: string[],
  buffer: Buffer,
  contentType: string,
  userId: string | null
): Promise<BroadcastResult[]> {
  const auth = await requireConnectedAccount();
  const ids = [...new Set(conversationIds)].slice(0, MAX_BROADCAST_RECIPIENTS);
  if (ids.length === 0) throw new MessagingUnavailableError("empty", "No recipients selected.");

  const attachmentId = await uploadAudioAttachment(auth, buffer, contentType);

  let mediaUrl: string | null = null;
  try {
    const blob = await put(`ig-voice-notes/broadcast-${Date.now()}.webm`, buffer, { access: "public", contentType });
    mediaUrl = blob.url;
  } catch (err) {
    console.error(`[ig-messaging] broadcast voice note Blob copy failed: ${err instanceof Error ? err.message : err}`);
  }

  const results: BroadcastResult[] = [];
  for (const conversationId of ids) {
    // One recipient's failure — a Meta rejection or a DB hiccup recording it — must not stop the rest of the broadcast.
    try {
      let status: IgMsgStatus = IgMsgStatus.SENT;
      let error: string | null = null;
      let messageId: string | undefined;
      try {
        const result = await graphPost<SendResult>(
          `${auth.igUserId}/messages`,
          { recipient: { id: conversationId }, message: { attachment: { type: "audio", payload: { attachment_id: attachmentId } } } },
          auth.igAccessToken
        );
        messageId = result.message_id;
      } catch (err) {
        status = IgMsgStatus.FAILED;
        error = err instanceof Error ? err.message : "Send failed.";
      }

      const sentAt = new Date();
      if (status === IgMsgStatus.SENT) {
        await prisma.igConversation.update({
          where: { id: conversationId },
          data: { lastMessageAt: sentAt, lastMessagePreview: "Voice message", lastMessageDirection: IgMsgDirection.OUTBOUND, unread: false },
        });
      }
      await prisma.igMessage.create({
        data: {
          id: messageId,
          conversationId,
          direction: IgMsgDirection.OUTBOUND,
          type: IgMsgType.AUDIO,
          mediaUrl: status === IgMsgStatus.SENT ? mediaUrl : null,
          status,
          error,
          sentAt,
          sentByUserId: userId,
        },
      });

      results.push({ conversationId, status, error });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unexpected error.";
      console.error(`[ig-messaging] broadcast failed for ${conversationId}: ${message}`);
      results.push({ conversationId, status: IgMsgStatus.FAILED, error: message });
    }
  }

  return results;
}
