<!--
  PROJECT REBRAND NOTE (2026-06-29):
  This AGENTS.md was created for the Caption Fox repo. The detailed standing rules live in
  CLAUDE.md, which was adapted from the Propvora project — all "Propvora" brand references in
  that file have been renamed to "Caption Fox", and the webhook headers X-Propvora-Signature /
  X-Propvora-Token are now X-CaptionFox-Signature / X-CaptionFox-Token. Caption Fox is a
  social-media marketing SaaS, NOT a property platform; ignore any property-domain examples and
  use "/app/home" as the UI benchmark (not the inherited "/property-manager/home").
-->

# AGENTS.md — Caption Fox

This file is the entry point for AI coding agents (Claude Code and others) working in this repo.
**The canonical, detailed standing rules are in [CLAUDE.md](./CLAUDE.md) — read it in full and follow it.**
This file is a short orientation layer on top of it.

## What this project is

Caption Fox is an **AI-powered social media marketing SaaS** for creators, brands, and agencies —
content studio, planning calendar, campaigns (incl. giveaways/competitions), UGC workflows, a unified
inbox, analytics, social listening, and link-in-bio. It is **not** a property platform; disregard any
property-domain examples inherited from the source playbook in CLAUDE.md.

## Stack

- **Next.js 16** (App Router, React 19) · **TypeScript** · **Tailwind v4**
- **Supabase** (Auth + Postgres + RLS + Storage) via `@supabase/ssr`
- **Anthropic SDK** (Fox AI copilot + AI generation routes) · **recharts** (charts)
- Hosted on **Vercel** (production: https://caption-fox.vercel.app). Plain Tailwind components — **no shadcn/ui**.

## Where things live

- App routes: `src/app/**` (public, `(auth)`, `/app/*`, `/admin/*`)
- Shared UI primitives: `src/components/ui`, layout shell: `src/components/layout`
- Copilot: `src/components/fox-ai/FoxAIBubble.tsx`, AI routes: `src/app/api/ai/{generate,chat,image}`
- Supabase clients: `src/lib/supabase/{client,server}.ts` · constants/plans: `src/lib/constants.ts`
- Schema: `supabase/schema.sql`

## Working rules (summary — CLAUDE.md is authoritative)

1. Follow the release-readiness checklists in CLAUDE.md; do not mark work complete until a section is genuinely release-ready.
2. Audit the real app with **Chrome MCP** across desktop/tablet/mobile/PWA; click and test every route/control/action.
3. Use shared design tokens/primitives — no one-off colours, spacing, shadows, or typography.
4. Respect Supabase RLS, permissions, plan gates, and audit logging; never expose the service-role key client-side.
5. Keep marketing claims aligned to shipped features (see the audit doc before promising functionality).
6. Env vars are NOT committed (`.env.local` is gitignored) — required runtime vars are documented in `.env.local.example` and must be set in Vercel.

## Current state

See **[CAPTION_FOX_BUILD_GRADE_AUDIT.md](./CAPTION_FOX_BUILD_GRADE_AUDIT.md)** for the full build-grade audit; Section 19 (2026-06-29) covers the route-by-route commercial-depth audit, the Propvora copilot comparison, pricing, and the gap-to-enterprise roadmap.
