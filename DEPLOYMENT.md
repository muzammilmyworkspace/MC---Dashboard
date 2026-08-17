# Deploying MC Nexus

This repo is **two applications**, and they deploy to different places:

| Part | What it is | Where it goes |
|---|---|---|
| repo root | Next.js dashboard | **Vercel** |
| `server/` | Express API + Instagram sync scheduler | **Railway / Render / Fly.io** |

Vercel cannot host `server/`. It is a long-running process with a 6-hourly
sync timer and an open Socket.io connection; Vercel's functions are
short-lived and stateless, so the scheduler would never fire and the
follower history — which cannot be backfilled — would never accumulate.

Deploy the backend first: the frontend needs its URL.

---

## 1. Database

Already on Neon. Nothing to do beyond reusing the same `DATABASE_URL`.

If you want production separate from local, create a second Neon project and
run `npm run db:push && npm run db:seed` against it.

---

## 2. Backend → Railway (or Render / Fly.io)

Point the service at the `server/` directory.

```
Root directory : server
Build command  : npm install && npx prisma generate && npm run build
Start command  : node dist/src/index.js
```

Note the start path: `tsconfig.json` sets `rootDir: "."`, so output lands in
`dist/src/`, not `dist/`. (`package.json`'s `start` script points at
`dist/index.js` and is wrong — use the command above.)

### Environment variables

Copy from your local `server/.env`, changing these four:

```ini
NODE_ENV=production
PORT=4000                       # or whatever the host injects
DATABASE_URL=<your Neon string>

# Must be the deployed FRONTEND origin, not localhost.
# The OAuth callback redirects here — a stale value hands the
# connection result to whatever else is at that address.
CORS_ORIGIN=https://your-app.vercel.app

# Must be the deployed BACKEND origin, and must match Meta exactly.
META_REDIRECT_URI=https://your-api.up.railway.app/api/integrations/callback/meta

# Generate fresh ones — do not reuse local values:
#   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
JWT_ACCESS_SECRET=<new>
JWT_REFRESH_SECRET=<new>

# REQUIRED in production — 64 hex chars. Without it the key is derived from
# the JWT secret, and rotating that secret makes stored tokens undecryptable.
#   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=<new>
```

Carry these over unchanged:

```ini
META_APP_ID=1603267481585243
META_APP_SECRET=<from local .env>
META_INSTAGRAM_CONFIG_ID=1038676265802072
META_GRAPH_VERSION=v23.0
META_ACCESS_TOKEN=<from local .env>
IG_BUSINESS_ACCOUNT_ID=17841408654221410
IG_SYNC_INTERVAL_MS=21600000
IG_MEDIA_LIMIT=50
```

Never set any of these on Vercel, and never prefix any with `NEXT_PUBLIC_`.

---

## 3. Frontend → Vercel

Import the repo. Leave the root directory as the repo root (not `server/`).

Set **one** environment variable:

```ini
NEXT_PUBLIC_API_URL=https://your-api.up.railway.app
```

That is the only variable the frontend needs, and it is deliberately public —
it is a URL the browser has to call anyway.

If it is missing, the app falls back to `http://localhost:4000` and every
page shows "Can't reach the MC Nexus API".

---

## 4. Meta dashboard

Add the **production** redirect URI alongside the local one:

<https://developers.facebook.com/apps/1603267481585243/fb-login/settings/>

```
http://localhost:4000/api/integrations/callback/meta       (keep for local)
https://your-api.up.railway.app/api/integrations/callback/meta
```

Byte for byte — a trailing slash or `http` vs `https` mismatch is rejected.

---

## 5. After the first deploy

```bash
# once, against the production database
npm run db:push
npm run db:seed        # skip if you don't want the demo accounts
```

Then check `https://your-api.up.railway.app/health` returns `db: "up"`.

---

## Instagram in production

Two independent paths, both already working:

**System User token** (`META_ACCESS_TOKEN`) — powers followers, posts and
insights. The current token is a Graph API Explorer one and **expires
2026-10-16**. Before then, replace it with a System User token from
<https://business.facebook.com/settings/system-users>, which never expires.

**OAuth** (`Connect Instagram`) — lets someone authorize from the dashboard
without pasting a token. Needs the production redirect URI from step 4.

### The one thing that cannot be recovered

`IgDailySnapshot` holds one row per day and is the only source of historical
follower totals. Meta reports followers as *right now* and sells no history,
so the gained/lost figures are derived from these snapshots.

**Every day the backend is down is a permanent gap in the chart.** Keep
`IG_SYNC_INTERVAL_MS` enabled (default 6h = four attempts a day) and do not
let the service sleep. Free tiers that idle-stop will lose days.

---

## Security checklist before going live

- [ ] `ENCRYPTION_KEY` set explicitly (not derived from the JWT secret)
- [ ] Fresh `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`, not the local ones
- [ ] `SEED_PASSWORD` changed, or the demo accounts deleted
- [ ] Login page's prefilled password removed (`src/app/login/page.tsx`)
- [ ] `CORS_ORIGIN` is the exact frontend origin, not `*`
- [ ] No Meta value set on Vercel, and nothing prefixed `NEXT_PUBLIC_`
- [ ] Meta app secret rotated if it has ever been pasted into a chat or ticket
