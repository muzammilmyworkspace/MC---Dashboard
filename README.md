# NEXUS HQ — Mission Control

**One Dashboard. Every Task. Total Visibility.**

A premium client-collaboration & digital-marketing operations dashboard — the
frontend MVP foundation for the full NEXUS HQ platform. Built to feel like a
$200/month SaaS product: dark-mode-first, glass, violet accent, smooth motion.

## Tech

- **Next.js 16** (App Router, Turbopack) · **React 19** · **TypeScript**
- **Tailwind CSS v4** (CSS-based design tokens, dark-mode-first)
- **Framer Motion** (page transitions, micro-interactions, animated counters)
- **Recharts** (performance / channel / ROAS charts)
- **Radix UI** primitives · **cmdk** (⌘K command palette) · **Zustand** (UI state)
- **sonner** (toasts) · **canvas-confetti** (approval celebration) · **next-themes**

## Getting started

```bash
npm install      # already done during scaffold
npm run dev      # http://localhost:3000
npm run build    # production build
npm run lint     # eslint
```

Open **http://localhost:3000** → animated splash → login. Use a **demo account**
button (Admin / Team / Client) to jump straight in.

## What's fully interactive in this MVP

| Area | Highlights |
|------|-----------|
| **Splash + Login** | Animated logo, aurora background, brand-name rotator, demo-role sign-in, Google-ready, 2FA-ready |
| **App shell** | Collapsible animated sidebar (favorites, filter, badges), topbar with role switcher, notifications, theme toggle, **⌘K command palette**, mobile bottom nav |
| **Dashboard** | Animated KPI counters, weekly performance area chart, channel donut, ROAS trend, campaign-health bars, live activity feed, approvals & meetings |
| **Tasks** | Kanban board with **drag-and-drop** between columns, list view, search, full **task detail drawer** (checklist, priority/status changers, time tracking, comments) |
| **Content Approval** | Filterable content grid, detail drawer with workflow stepper, caption/hashtags, comment thread, **Approve → confetti 🎉** / Request Changes |
| **Every other module** | Tailored, on-brand shells with feature lists, skeleton previews, and Phase-2 **integration status** panels (Connect / Not Connected / last sync) |

## Architecture

```
src/
  app/
    page.tsx              splash screen
    login/                animated auth
    (app)/                authenticated shell (sidebar + topbar + ⌘K)
      dashboard/          KPIs, charts, activity
      tasks/              kanban + detail drawer
      approvals/          content approval workflow
      [...slug]/          catch-all → tailored module shells
  components/
    ui/                   button, card, badge, avatar, dialog, input, progress, tooltip…
    layout/               sidebar, topbar, command-palette, mobile-nav, page-transition
    charts/               recharts wrappers
    tasks/                task detail drawer
    brand/                logo
  lib/
    data.ts               mock data layer  (swap for API/Prisma in Phase 2)
    nav.ts                sidebar navigation config
    modules.ts            per-module metadata for shells
    store.ts              zustand UI state
    utils.ts / confetti.ts
```

## Design system

Tokens live in `src/app/globals.css` (`:root` + `.dark`). Brand palette:
Primary `#0F172A` · Accent `#8B5CF6` · Success `#10B981` · Warning `#F59E0B`
· Danger `#EF4444`. Semantic Tailwind utilities: `bg-card`, `text-muted-foreground`,
`border-border`, `bg-accent`, `.glass`, `.text-gradient`, `.shadow-glow`.

## Phase 2 (backend & live data)

The data layer (`lib/data.ts`) and module "integration" panels are deliberately
seam-lined so you can drop in:
Express + Prisma + PostgreSQL · JWT + RBAC · Socket.io real-time · and the
Meta / Google Ads / GA4 / TikTok / YouTube / LinkedIn service integrations
without reworking the UI.
