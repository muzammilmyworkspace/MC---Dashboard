# MC Nexus — Mission Control API (Phase 2)

The backend for MC Nexus: Express + TypeScript, PostgreSQL via Prisma, JWT auth with
refresh-token rotation, role-based access control, Socket.io realtime, Nodemailer, audit
logging, and a modular integration layer for all 15 Phase 2 APIs.

## Quick start

```bash
cd server
cp .env.example .env          # then set JWT secrets (see below)
docker compose up -d          # PostgreSQL on :5432 (+ optional Redis)
npm install
npm run db:push               # create the schema
npm run db:seed               # team + full July content plan + integrations
npm run dev                   # http://localhost:4000
```

Generate strong secrets:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Health check: **http://localhost:4000/health** → `{ status, db, uptime }`

### Seeded accounts

| Email | Role | Password |
|---|---|---|
| muzammil.myworkspace@gmail.com | `SUPER_ADMIN` | `SEED_PASSWORD` (default `MainCharacter#2026`) |
| hashaamzafar999@gmail.com | `TEAM_MEMBER` | same |
| onyema@maincharacter.nl | `CLIENT` | same |

## Scripts

| Script | Does |
|---|---|
| `npm run dev` | Hot-reloading API (tsx watch) |
| `npm run build` / `start` | Compile to `dist/` and run |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:push` | Sync schema without migrations (fast dev loop) |
| `npm run db:migrate` | Create a real SQL migration |
| `npm run db:seed` | Seed team, July content, integrations |
| `npm run db:studio` | Prisma Studio |
| `npm run setup` | `db:push` + `db:seed` |

## API

All routes are under `/api`. Protected routes need `Authorization: Bearer <accessToken>`.

### Auth
| Method | Route | Notes |
|---|---|---|
| POST | `/api/auth/login` | Returns `accessToken` + sets an httpOnly refresh cookie. Rate-limited (10 / 15 min). |
| POST | `/api/auth/refresh` | Rotates the refresh token, returns a new access token. |
| POST | `/api/auth/logout` | Revokes the presented refresh token. |
| POST | `/api/auth/logout-all` | Revokes every session for the user. |
| GET | `/api/auth/me` | Current user. |

### Content
| Method | Route | Role |
|---|---|---|
| GET | `/api/day-plans?month=2026-07` | any |
| GET | `/api/day-plans/:date` | any |
| PATCH | `/api/day-plans/:date` | `TEAM_MEMBER`+ — hook, captions, hashtags, CTA, time, status |
| POST | `/api/day-plans/:date/reviews` | any — `APPROVED` / `REJECTED` / `CHANGES` / `COMMENT`. A comment is **required** for reject/changes. |

### Platform & ops
| Method | Route | Role |
|---|---|---|
| GET | `/api/integrations` | any — merged DB state + provider metadata (credentials never leave the server) |
| GET | `/api/integrations/:key/auth-url` | any — OAuth step 1 |
| POST | `/api/integrations/:key/test` | any — liveness probe |
| POST | `/api/integrations/:key/connect` / `disconnect` | `TEAM_MEMBER`+ |
| GET | `/api/integrations/:key/sync-runs` | any |
| GET | `/api/dashboard/overview` | any — aggregated content, integration and review stats |
| GET / PATCH | `/api/notifications` | own notifications |
| GET / POST / PATCH | `/api/users` | read: any · write: `SUPER_ADMIN` |
| GET | `/api/audit` | `SUPER_ADMIN` |

### Instagram
| Method | Route | Role |
|---|---|---|
| GET | `/api/instagram/overview?days=30` | any — headline figures + derived daily movement |
| GET | `/api/instagram/followers?days=30` | any — raw daily series |
| GET | `/api/instagram/media?limit=24&type=ALL` | any — posts + insights |
| GET | `/api/instagram/demographics?breakdown=country` | any — live Graph call |
| POST | `/api/instagram/sync` | `TEAM` — pull from Meta now |
| GET | `/api/instagram/diagnostics` | `TEAM` — token + Page↔IG link probe |

### Realtime (Socket.io)

Connect with the access token; unauthenticated sockets are rejected.

```ts
io("http://localhost:4000", { auth: { token: accessToken } });
```

Events broadcast to the `workspace` room: `dayplan:updated`, `review:created`,
`notification:new`, `integration:updated`.

## Security

JWT access tokens (15 min) + rotating refresh tokens stored **hashed** (SHA-256) and
revocable · bcrypt(12) passwords · RBAC middleware (`SUPER_ADMIN` bypasses) · helmet ·
CORS allow-list · global + per-route rate limiting · Zod validation on body/query/params ·
centralized error mapping (Prisma errors → clean HTTP codes) · append-only audit log.

## Integration layer

`src/services/integrations/` defines one `IntegrationProvider` contract
(`getAuthUrl` / `exchangeCode` / `refreshCredentials` / `testConnection` / `fetchSnapshot`)
and a registry describing all 15 APIs — Meta Graph, Instagram Graph, Facebook Graph,
Google Ads, GA4, Search Console, Workspace Admin SDK, YouTube, LinkedIn, TikTok,
Cloudinary, Google Drive, Dropbox, OpenAI and SMTP — with their scopes, required env vars
and docs. Enabling a provider means filling in its methods; **no route or UI code changes.**

## Instagram setup

Live implementation in `src/services/instagram/`. It authenticates with a **System User
token** rather than the OAuth dance, because the dashboard reads one account we own.

1. **Instagram account** must be Professional (Business/Creator) *and* linked to a
   Facebook Page that the Business Portfolio **owns** (Business Settings → Accounts →
   Pages). A Page you merely admin personally will not work.
2. **App** — developers.facebook.com → your app → App settings → Basic → set the
   Business Account, and add the Instagram product.
3. **System User** — business.facebook.com/settings → Users → System Users → Add.
   Assign assets: the Page (full control), the Instagram account (full control), and
   the App (develop). The App assignment is what makes it appear in step 4.
4. **Generate token** — expiration **Never**, with scopes: `instagram_basic`,
   `instagram_manage_insights`, `instagram_manage_comments`, `pages_show_list`,
   `pages_read_engagement`, `read_insights`, `business_management`. Copy it
   immediately; it is shown once.
5. Fill in `META_ACCESS_TOKEN`, `META_APP_ID`, `META_APP_SECRET` in `.env`, start the
   API, and hit `GET /api/instagram/diagnostics` — it lists every Page with its linked
   IG account id. Put that id in `IG_BUSINESS_ACCOUNT_ID` and restart.

Changing scopes later means **regenerating** the token, so tick generously in step 4.

### Why we snapshot daily

`IgDailySnapshot` holds one row per day and is the only follower history that exists.
The Graph API serves `follower_count` for ~30 days with no backfill, and **never**
exposes unfollows or a follower list — no endpoint, at any tier. Unfollows are derived:

```
unfollows(day) = max(0, new_follows(day) − Δ total_followers(day))
```

Both inputs are sampled at slightly different moments, so this is a close estimate, and
the UI labels it as such. Every day the scheduler doesn't run is a day of history that
cannot be recovered — keep `IG_SYNC_INTERVAL_MS` enabled in production.

## Data model

`User` · `RefreshToken` · `DayPlan` (with `Caption` per platform, `Reel`, `ContentPost`,
`Review`, `MediaAsset`) · `Integration` + `SyncRun` · `Notification` · `AuditLog`.

The seed imports the July plan from `src/lib/july.ts` in the frontend, so content has a
single source of truth.

## Deploy notes

Set `NODE_ENV=production`, a managed `DATABASE_URL`, strong JWT secrets, and
`CORS_ORIGIN` to the deployed frontend. Use `npm run db:migrate` (not `db:push`) for
production schema changes. Railway, Render, Fly.io and DigitalOcean all work; the
frontend stays on Vercel.
