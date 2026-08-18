"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Plug, RefreshCw, Link2Off, Image as ImageIcon, BarChart3, MessageCircle,
  Inbox, AlertTriangle, ShieldAlert, ExternalLink, Eye, Heart, Bookmark, EyeOff, Send,
} from "lucide-react";
import {
  api, ApiRequestError,
  type MetaCapability, type MetaComment, type MetaConnectionStatus,
  type MetaInsightsResponse, type MetaMediaItem, type MetaMessagesResponse, type MetaProfileResponse,
} from "@/lib/api";
import { SectionCard, EmptyState, StatusPill } from "@/components/ui/page-shell";
import { StatusDot } from "@/components/ui/status-dot";
import { Tooltip } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Tab = "content" | "insights" | "comments" | "messages";

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "content", label: "Content", icon: ImageIcon },
  { key: "insights", label: "Insights", icon: BarChart3 },
  { key: "comments", label: "Comments", icon: MessageCircle },
  { key: "messages", label: "Messages", icon: Inbox },
];

export function InstagramOAuthPanel() {
  const [status, setStatus] = useState<MetaConnectionStatus | null>(null);
  const [profile, setProfile] = useState<MetaProfileResponse | null>(null);
  const [caps, setCaps] = useState<MetaCapability[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  /** The direct-token path — what actually powers the data on this page. */
  const [direct, setDirect] = useState<{ connected: boolean; lastSyncAt: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>("content");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reload, setReload] = useState(0);

  /* We land back here from Meta with the outcome in the query string. */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("integration") !== "instagram") return;

    const outcome = params.get("status");
    const message = params.get("message");
    const account = params.get("account");

    // Deferred so no state update happens synchronously in the effect body.
    const timer = setTimeout(() => {
      if (outcome === "connected") {
        toast.success("Instagram connected", {
          description: account ? `Connected as @${account}` : undefined,
        });
      } else {
        toast.error("Couldn't connect Instagram", { description: message ?? "Please try again." });
      }
      setReload((n) => n + 1);
    }, 0);

    // Drop the params so a refresh doesn't replay the toast.
    window.history.replaceState({}, "", window.location.pathname);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        // Instagram can be connected two independent ways: a direct token
        // (System User) or OAuth. Checking only OAuth reported the account as
        // disconnected while its data was plainly on screen.
        const [s, list] = await Promise.all([
          api.integrations.metaStatus(),
          api.integrations.list().catch(() => null),
        ]);

        const directRow = list?.integrations.find((i) => i.key === "instagram-graph");
        if (!cancelled) {
          setDirect(
            directRow?.status === "CONNECTED"
              ? { connected: true, lastSyncAt: directRow.lastSyncAt }
              : { connected: false, lastSyncAt: null }
          );
        }

        let nextProfile: MetaProfileResponse | null = null;
        let nextCaps: MetaCapability[] = [];
        if (s.connected) {
          const [p, c] = await Promise.all([
            api.integrations.metaProfile().catch(() => null),
            api.integrations.metaCapabilities().catch(() => null),
          ]);
          nextProfile = p;
          nextCaps = c?.capabilities ?? [];
        }

        if (cancelled) return;
        setProfile(nextProfile);
        setCaps(nextCaps);
        setStatus(s);
        setApiError(null);
      } catch (err) {
        if (cancelled) return;
        // Three different failures used to render as one message. A 401 means
        // "sign in", an unreachable host means "start the server", and neither
        // is "not configured" — telling you the wrong one costs real time.
        if (err instanceof ApiRequestError && err.status === 401) {
          setNeedsLogin(true);
        } else {
          setApiError(errText(err));
        }
        setStatus(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reload]);

  async function connect() {
    setBusy(true);
    try {
      const res = await api.integrations.authUrl("meta-graph");
      if (res.url) {
        window.location.assign(res.url);
        return;
      }
      toast.error("Couldn't start the connection", { description: res.message ?? "No authorization URL returned." });
    } catch (err) {
      toast.error("Couldn't start the connection", { description: errText(err) });
    }
    setBusy(false);
  }

  async function disconnect() {
    setBusy(true);
    setConfirmOpen(false);
    try {
      setStatus(await api.integrations.metaDisconnect());
      setProfile(null);
      setCaps([]);
      toast("Instagram disconnected", { description: "The stored access token has been erased." });
    } catch (err) {
      toast.error("Couldn't disconnect", { description: errText(err) });
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <Card className="h-40 animate-pulse bg-muted/40" />;
  }

  /* ----------------------------- Not signed in -------------------------- */
  if (needsLogin) {
    return (
      <SectionCard title="Instagram via Meta login" icon={Plug} description="OAuth connection">
        <EmptyState
          icon={ShieldAlert}
          title="Sign in to MC Nexus first"
          description="The API rejected the request as unauthenticated. Log in, then come back to this page — the backend is running fine."
          className="border-0 bg-transparent py-8"
          action={
            <Button onClick={() => window.location.assign("/login")}>Go to login</Button>
          }
        />
      </SectionCard>
    );
  }

  /* --------------------------- API unreachable -------------------------- */
  if (apiError) {
    return (
      <SectionCard title="Instagram via Meta login" icon={Plug} description="OAuth connection">
        <EmptyState
          icon={AlertTriangle}
          title="Can't reach the MC Nexus API"
          description={`${apiError} Start the backend with "npm run dev" in server/, then refresh.`}
          className="border-0 bg-transparent py-8"
          action={
            <Button variant="secondary" onClick={() => setReload((n) => n + 1)}>
              <RefreshCw className="size-4" /> Retry
            </Button>
          }
        />
      </SectionCard>
    );
  }

  /* ------------------------- Not configured / not connected ------------- */
  if (!status?.configured) {
    return (
      <SectionCard title="Instagram via Meta login" icon={Plug} description="OAuth connection">
        <EmptyState
          icon={ShieldAlert}
          title="Instagram integration is not configured"
          description={status?.message ?? "Add META_APP_ID and META_APP_SECRET to server/.env, then restart the API."}
          className="border-0 bg-transparent py-8"
        />
      </SectionCard>
    );
  }

  if (!status.connected) {
    /**
     * The account is already connected by direct token — that is what the
     * data on this page comes from. Showing "Not connected" here was simply
     * wrong from the reader's point of view: OAuth is a second, optional way
     * in, not the definition of being connected.
     */
    if (direct?.connected) {
      return (
        <SectionCard title="Instagram" icon={Plug} description="Account connection">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
                <Plug className="size-[18px]" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold">Instagram is connected</p>
                  <StatusDot state="connected" label="Active" />
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Your profile, posts and insights are syncing.
                  {direct.lastSyncAt && ` Last updated ${new Date(direct.lastSyncAt).toLocaleString()}.`}
                </p>
              </div>
            </div>

            <Tooltip content="Signing in with Meta is an alternative way to connect. Your account is already connected, so this is optional.">
              <span>
                <Button variant="outline" size="sm" onClick={() => void connect()} disabled={busy}>
                  <Plug className="size-4" /> {busy ? "Opening Meta…" : "Sign in with Meta"}
                </Button>
              </span>
            </Tooltip>
          </div>
        </SectionCard>
      );
    }

    return (
      <SectionCard title="Instagram" icon={Plug} description="Account connection">
        <EmptyState
          icon={Plug}
          title="Instagram — Not connected"
          description="Authorize MC Nexus with Meta to pull your profile, posts, insights and comments."
          className="border-0 bg-transparent py-8"
          action={
            <Button onClick={() => void connect()} disabled={busy}>
              <Plug className="size-4" /> {busy ? "Opening Meta…" : "Connect Instagram"}
            </Button>
          }
        />
      </SectionCard>
    );
  }

  /* ------------------------------- Connected ---------------------------- */
  const account = status.account;

  return (
    <>
      <SectionCard
        title="Instagram via Meta login"
        icon={Plug}
        description="OAuth connection"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setReload((n) => n + 1)} disabled={busy}>
              <RefreshCw className={cn("size-4", busy && "animate-spin")} /> Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={() => setConfirmOpen(true)} disabled={busy}>
              <Link2Off className="size-4" /> Disconnect
            </Button>
          </div>
        }
      >
        <div className="flex flex-wrap items-start gap-4">
          {profile?.profile.profilePictureUrl && (
            // Instagram CDN URLs are signed and expire — not optimisable.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.profile.profilePictureUrl}
              alt=""
              className="size-14 rounded-full border border-border object-cover"
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold">@{account?.igUsername ?? profile?.profile.username ?? "—"}</p>
              <StatusPill tone="success">
                <span className="size-1.5 rounded-full bg-success" /> Connected
              </StatusPill>
            </div>
            {profile?.profile.name && <p className="text-sm text-muted-foreground">{profile.profile.name}</p>}
            {profile?.profile.biography && (
              <p className="mt-1 max-w-prose text-sm text-muted-foreground">{profile.profile.biography}</p>
            )}
          </div>

          {profile && (
            <div className="flex gap-5">
              <Metric label="Followers" value={profile.profile.followersCount} />
              <Metric label="Following" value={profile.profile.followsCount} />
              <Metric label="Posts" value={profile.profile.mediaCount} />
            </div>
          )}
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-border pt-4 sm:grid-cols-4">
          <Detail label="Instagram account ID" value={account?.igAccountId ?? "—"} mono />
          <Detail label="Facebook Page" value={account?.pageName ?? "—"} />
          <Detail
            label="Connected"
            value={account?.connectedAt ? new Date(account.connectedAt).toLocaleString() : "—"}
          />
          <Detail
            label="Token expires"
            value={account?.tokenExpiresAt ? new Date(account.tokenExpiresAt).toLocaleDateString() : "Does not expire"}
          />
        </dl>
      </SectionCard>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => {
          const cap = caps.find((c) => c.feature === t.key);
          const blocked = cap && !cap.granted;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                tab === t.key
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border text-muted-foreground hover:border-accent/40"
              )}
            >
              <t.icon className="size-3.5" />
              {t.label}
              {blocked && <span className="size-1.5 rounded-full bg-warning" title="Setup required" />}
            </button>
          );
        })}
      </div>

      {tab === "content" && <ContentTab capability={caps.find((c) => c.feature === "media")} />}
      {tab === "insights" && <InsightsTab capability={caps.find((c) => c.feature === "insights")} />}
      {tab === "comments" && <CommentsTab capability={caps.find((c) => c.feature === "comments")} />}
      {tab === "messages" && <MessagesTab />}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md p-6">
          <DialogTitle>Disconnect Instagram?</DialogTitle>
          <p className="mt-2 text-sm text-muted-foreground">
            The stored access token is erased from the database. Posts and insights already synced by the
            System User integration are unaffected. You can reconnect at any time.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button onClick={() => void disconnect()} disabled={busy}>
              <Link2Off className="size-4" /> Disconnect
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* --------------------------------- Tabs ---------------------------------- */

/** Shown instead of an empty list when Meta hasn't granted the permission. */
function SetupRequired({ capability }: { capability: MetaCapability }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/[0.06] p-4">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
      <div className="min-w-0">
        <p className="text-sm font-medium">Setup required</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Missing {capability.missing.map((m) => <code key={m} className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">{m}</code>).reduce<React.ReactNode[]>((acc, el, i) => (i ? [...acc, ", ", el] : [el]), [])}
          {capability.appReview && " — this permission requires Meta App Review before it works for accounts outside your business."}
        </p>
        {capability.note && <p className="mt-1 text-xs text-muted-foreground">{capability.note}</p>}
      </div>
    </div>
  );
}

function ContentTab({ capability }: { capability?: MetaCapability }) {
  const [media, setMedia] = useState<MetaMediaItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await api.integrations.metaMedia(12);
        if (!cancelled) setMedia(res.media);
      } catch (err) {
        if (!cancelled) {
          setError(errText(err));
          setMedia([]);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (capability && !capability.granted) return <SetupRequired capability={capability} />;
  if (media === null) return <Card className="h-48 animate-pulse bg-muted/40" />;
  if (error) return <ErrorCard message={error} />;
  if (!media.length) {
    return (
      <EmptyState icon={ImageIcon} title="No posts yet" description="Posts published to this account will appear here." />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {media.map((m) => (
        <div key={m.id} className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="relative aspect-square bg-muted">
            {m.thumbnailUrl || m.mediaUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.thumbnailUrl ?? m.mediaUrl ?? ""} alt="" loading="lazy" className="size-full object-cover" />
            ) : (
              <div className="grid size-full place-items-center text-muted-foreground"><ImageIcon className="size-6" /></div>
            )}
            <span className="absolute left-2 top-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur">
              {m.productType === "REELS" ? "Reel" : m.mediaType === "CAROUSEL_ALBUM" ? "Carousel" : "Post"}
            </span>
          </div>
          <div className="space-y-2 p-3">
            <p className="line-clamp-2 text-xs text-muted-foreground">{m.caption || "No caption"}</p>
            <div className="grid grid-cols-4 gap-1.5 text-center">
              <Mini icon={Heart} value={m.likeCount} />
              <Mini icon={MessageCircle} value={m.commentsCount} />
              <Mini icon={Bookmark} value={m.saved} />
              <Mini icon={Eye} value={m.reach ?? m.views} />
            </div>
            <div className="flex items-center justify-between border-t border-border pt-2 text-[11px] text-muted-foreground">
              <span>{new Date(m.timestamp).toLocaleDateString()}</span>
              {m.permalink && (
                <a href={m.permalink} target="_blank" rel="noreferrer" className="hover:text-accent">
                  <ExternalLink className="size-3.5" />
                </a>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function InsightsTab({ capability }: { capability?: MetaCapability }) {
  const [data, setData] = useState<MetaInsightsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await api.integrations.metaInsights(28);
        if (!cancelled) setData(res);
      } catch (err) {
        if (!cancelled) setError(errText(err));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (capability && !capability.granted) return <SetupRequired capability={capability} />;
  if (error) return <ErrorCard message={error} />;
  if (!data) return <Card className="h-40 animate-pulse bg-muted/40" />;

  if (!data.available) {
    return (
      <EmptyState
        icon={BarChart3}
        title="No insights returned"
        description="Meta served no insight data for this account. New or low-activity accounts often have none yet."
      />
    );
  }

  const totalReach = data.series.reduce((s, d) => s + (d.reach ?? 0), 0);
  const totalNew = data.series.reduce((s, d) => s + (d.newFollowers ?? 0), 0);

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard label={`Reach (${data.days}d)`} value={totalReach} />
      <StatCard label={`New followers (${data.days}d)`} value={totalNew} />
      <StatCard label="Views today" value={data.today.views ?? null} />
      <StatCard label="Profile views today" value={data.today.profileViews ?? null} />
    </div>
  );
}

function CommentsTab({ capability }: { capability?: MetaCapability }) {
  const [media, setMedia] = useState<MetaMediaItem[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [comments, setComments] = useState<MetaComment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await api.integrations.metaMedia(12, false).catch(() => null);
      if (cancelled || !res) return;
      setMedia(res.media);
      setSelected(res.media[0]?.id ?? null);
    })();
    return () => { cancelled = true; };
  }, []);

  // Refetch is driven by a counter rather than a callback so every state
  // update lands in an async continuation, never in the effect body.
  const [reloadKey, setReloadKey] = useState(0);
  const refresh = useCallback(() => setReloadKey((n) => n + 1), []);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await api.integrations.metaComments(selected);
        if (cancelled) return;
        setComments(res.comments);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(errText(err));
        setComments([]);
      }
    })();
    return () => { cancelled = true; };
  }, [selected, reloadKey]);

  async function sendReply(commentId: string) {
    if (!reply.trim()) return;
    setBusy(true);
    try {
      await api.integrations.metaReplyComment(commentId, reply.trim());
      toast.success("Reply posted");
      setReply("");
      refresh();
    } catch (err) {
      toast.error("Couldn't post the reply", { description: errText(err) });
    } finally {
      setBusy(false);
    }
  }

  async function toggleHidden(c: MetaComment) {
    try {
      await api.integrations.metaHideComment(c.id, !c.hidden);
      toast.success(c.hidden ? "Comment un-hidden" : "Comment hidden");
      refresh();
    } catch (err) {
      toast.error("Couldn't moderate the comment", { description: errText(err) });
    }
  }

  if (capability && !capability.granted) return <SetupRequired capability={capability} />;

  return (
    <SectionCard title="Comments" icon={MessageCircle} description="Read, reply and moderate.">
      {media.length > 0 && (
        <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto pb-1">
          {media.map((m) => (
            <button
              key={m.id}
              onClick={() => setSelected(m.id)}
              className={cn(
                "size-12 shrink-0 overflow-hidden rounded-lg border-2 transition-colors",
                selected === m.id ? "border-accent" : "border-transparent opacity-60 hover:opacity-100"
              )}
            >
              {m.thumbnailUrl || m.mediaUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.thumbnailUrl ?? m.mediaUrl ?? ""} alt="" className="size-full object-cover" />
              ) : (
                <div className="grid size-full place-items-center bg-muted"><ImageIcon className="size-4" /></div>
              )}
            </button>
          ))}
        </div>
      )}

      {error && <ErrorCard message={error} />}
      {comments === null && !error && <Card className="h-24 animate-pulse bg-muted/40" />}
      {comments?.length === 0 && !error && (
        <EmptyState icon={MessageCircle} title="No comments" description="This post has no comments yet." className="border-0 bg-transparent py-8" />
      )}

      <div className="space-y-3">
        {comments?.map((c) => (
          <div key={c.id} className={cn("rounded-xl border border-border p-3", c.hidden && "opacity-60")}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">@{c.username}</p>
                <p className="text-sm text-muted-foreground">{c.text}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {new Date(c.timestamp).toLocaleString()} · {c.likeCount} likes
                  {c.hidden && " · hidden"}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => void toggleHidden(c)}>
                {c.hidden ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
              </Button>
            </div>

            {c.replies.length > 0 && (
              <div className="mt-2 space-y-1 border-l-2 border-border pl-3">
                {c.replies.map((r) => (
                  <p key={r.id} className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">@{r.username}</span> {r.text}
                  </p>
                ))}
              </div>
            )}

            <div className="mt-2 flex gap-2">
              <input
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Write a reply…"
                className="flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-accent"
              />
              <Button size="sm" onClick={() => void sendReply(c.id)} disabled={busy || !reply.trim()}>
                <Send className="size-3.5" /> Reply
              </Button>
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function MessagesTab() {
  const [data, setData] = useState<MetaMessagesResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await api.integrations.metaMessages().catch(() => null);
      if (!cancelled) setData(res);
    })();
    return () => { cancelled = true; };
  }, []);

  if (!data) return <Card className="h-32 animate-pulse bg-muted/40" />;

  if (data.setupRequired) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/[0.06] p-4">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
        <div>
          <p className="text-sm font-medium">Setup required — Instagram messaging</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{data.reason}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Conversations arrive by webhook rather than polling, so both the permission and an active
            subscription are needed before anything appears here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <EmptyState icon={Inbox} title="No conversations yet" description="New Instagram messages will appear here." />
  );
}

/* ------------------------------- Bits ------------------------------------ */

function errText(err: unknown): string {
  return err instanceof ApiRequestError ? err.message : "Could not reach the API.";
}

function ErrorCard({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-danger/30 bg-danger/[0.06] p-4">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <p className="text-lg font-semibold tabular-nums">{value.toLocaleString()}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | null }) {
  return (
    <Card className="p-4">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums">
        {value === null || value === undefined ? "—" : value.toLocaleString()}
      </p>
    </Card>
  );
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={cn("mt-0.5 truncate text-sm", mono && "font-mono text-xs")}>{value}</dd>
    </div>
  );
}

function Mini({ icon: Icon, value }: { icon: React.ElementType; value: number | null }) {
  return (
    <div className="rounded-lg bg-muted/40 py-1.5">
      <Icon className="mx-auto size-3 text-muted-foreground" />
      <p className="mt-0.5 text-[11px] font-medium tabular-nums">{value === null ? "—" : value.toLocaleString()}</p>
    </div>
  );
}
