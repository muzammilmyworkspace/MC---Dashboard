# MC Nexus — Mission Control

**The command center for content, marketing, approvals, and collaboration.**

A premium, neutral operations dashboard. Light-mode-first — soft grey canvas, white cards,
refined slate sidebar, a single understated **blue** accent reserved for important actions.
Designed to feel like Apple × Linear × Notion × Stripe: calm, spacious, whitespace-led,
and immediately understandable for non-technical users.

## Tech

- **Next.js 16** (App Router, Turbopack) · **React 19** · **TypeScript**
- **Tailwind CSS v4** (CSS-based design tokens, light-mode-first, warm luxury palette)
- **Framer Motion** (sidebar collapse, date selection, tab & content transitions, counters)
- **Recharts** · **Radix UI** · **cmdk** (⌘K) · **Zustand** · **sonner** · **canvas-confetti**

## Getting started

```bash
npm install
npm run dev      # http://localhost:4300
npm run build    # production build
npm run lint     # eslint
```

> Note: don't run `next build` and `next dev` against the same `.next` folder back-to-back —
> Turbopack shares that cache and it can corrupt. If dev starts 500ing, `rm -rf .next` and restart.

Open **http://localhost:4300** → splash → login. Pick a **demo profile** to sign in:

| Profile | Role | Lands on |
|---------|------|----------|
| **Muzammil** | Super Admin | Dashboard (full workspace) |
| **Hashaam** | Team Member | Dashboard (creative modules) |
| **Onyema** | Client | Calendar (review & approve) |

The sidebar adapts to the signed-in role. Switch roles live from the topbar "Viewing as" menu.

## What's fully interactive in this MVP

| Area | Highlights |
|------|-----------|
| **Login** | Premium dark branding panel + feature highlights; glass sign-in card; Google button; three quick-access demo profiles (avatar, name, role, email); "Demo Workspace" |
| **Sidebar** | Refined slate hierarchy, always-icons, Linear-style expand/collapse (remembers state); pinned Dashboard + Calendar; **drag-and-drop tasks (dnd-kit)** between **Muzammil Tasks · Hashaam Tasks · Future Assignments** with ghost overlay, drop indicators & auto-save; Future shows an empty "Drop tasks here" state |
| **Social Media Calendar** (the heart) | Month/year header + prev/next/today; animated horizontal date strip with content dots; **click a date → instant day load**; split editor / preview workspace |
| ↳ Editor (left) | Platform tabs (IG/FB/LI/TikTok/YT); inline **Edit → Save / Cancel**; **Translate EN ⇄ NL**; title, caption, hashtags, CTA, time, status |
| ↳ Preview + Review (right) | Image / Reel / **Carousel** preview with premium shadow; approval **workflow stepper**; comment box + **Approve → confetti 🎉 / Needs Changes / Rejected**; review history timeline |
| **Dashboard** | Calm overview — KPIs, "Awaiting Review" queue, channel split, weekly performance, activity, upcoming |
| **Every other module** | Muzammil/Hashaam modules → tailored "building" preview shells; **Phase 2 + Future Assignments → premium "Coming Soon"** pages |

## Design tokens

Defined in `src/app/globals.css`. Palette:
`#F5F7FA` canvas · `#FFFFFF` cards · `#0F172A` slate sidebar · `#E5E7EB` borders ·
`#111827`/`#6B7280` text · `#F3F4F6` hover · **`#2563EB` blue accent** (`#1D4ED8` hover) ·
`#16A34A` success · `#F59E0B` warning · `#DC2626` danger. No gold, no purple.
Clean Geist typography; whitespace as the primary design element.

## Architecture

```
src/
  app/
    page.tsx              splash
    login/                branding + demo profiles
    (app)/
      dashboard/          calm overview
      calendar/           ★ Social Media Calendar (the heart)
      [...slug]/          catch-all → building shells / Coming Soon / Future
  components/
    calendar/             content-editor · preview-review
    layout/               sidebar · topbar · command-palette · mobile-nav · page-transition
    ui/ charts/ brand/
  lib/
    data.ts               users + calendar posts + dashboard mock data
    nav.ts                role-aware navigation
    modules.ts            per-module metadata (building vs phase2)
    store.ts / utils.ts / confetti.ts
```

## Phase 2 — Backend API (`server/`)

The backend is built and lives in [`server/`](server) — Express + TypeScript, PostgreSQL via
Prisma, JWT auth with rotating refresh tokens, RBAC, Socket.io realtime, Nodemailer, audit
logging, and a modular integration layer for all 15 planned APIs.

```bash
cd server
cp .env.example .env      # set the two JWT secrets
docker compose up -d      # PostgreSQL
npm install && npm run setup   # schema + seed (team, July plan, integrations)
npm run dev               # http://localhost:4000  ·  /health
```

Seeded logins (password from `SEED_PASSWORD`, default `MainCharacter#2026`):
`muzammil.myworkspace@gmail.com` (Admin) · `hashaamzafar999@gmail.com` (Team) ·
`onyema@maincharacter.nl` (Client).

Full API reference, security model and data model: **[server/README.md](server/README.md)**.

### Connecting the frontend

The frontend ships a typed client and realtime hook that are ready to use:

```ts
import { api } from "@/lib/api";          // auth, day-plans, integrations, dashboard…
import { useRealtime } from "@/lib/realtime";

const user = await api.auth.login(email, password);
const { plans } = await api.dayPlans.list("2026-07");
useRealtime("dayplan:updated", (plan) => { /* live approvals */ });
```

Point it at the API with `NEXT_PUBLIC_API_URL` in `.env.local` (defaults to
`http://localhost:4000`). Access tokens are held in memory and refreshed silently via an
httpOnly cookie. The UI still renders the seeded mock data in `src/lib/` until the pages are
switched over to `api.*` — that swap is the remaining step.

### Still "Coming Soon"

CRM, Lead Pipeline, Invoices, Finance, AI Assistant, Meeting Notes, Knowledge Base,
Analytics Hub, Automation Center, Reports, Client Portal and Password Vault remain premium
placeholder pages, ready to build on the same design system.
