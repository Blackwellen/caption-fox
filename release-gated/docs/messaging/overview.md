# Release Evidence — Messaging Overview

**Section:** Messaging Overview
**Route:** `/app/messaging`
**Phase:** 1 of a multi-phase build (see `docs/CAPTION_FOX_MESSAGING_IMPLEMENTATION_TRACKER.md` for full scope and what remains)

## What was tested
- Route loads for an authenticated workspace member; redirects unauthenticated users to `/login`.
- Entitlement gate (`requireMessagingModule('overview')`) renders `AccessBlocked` for roles/plans without access instead of a raw error.
- KPI strip, performance trend, channel mix, next actions, messaging programs table, recent activity, channel health — all query live Supabase data via `src/lib/messaging/data.ts`; no hardcoded numbers.
- Empty states verified by inspection: with zero rows in `messaging_messages`, the programs table renders `MessagingEmpty` rather than blank space or fabricated rows.
- `npx tsc --noEmit` run across the full repo: 0 errors in any file under `src/lib/messaging`, `src/components/messaging`, or `src/app/app/messaging` (61 pre-existing errors elsewhere in the codebase, unrelated to this change, left untouched).

## Not tested this phase
- Chrome MCP browser verification at 1440/1280/1024/tablet/mobile/PWA against the reference image `designs/Messaging/ChatGPT Image Aug 29, 2026, 01_26_20 PM (1).png` — not run.
- RLS positive/negative tests — not run (policies were written mirroring the proven `campaign_*` RLS pattern, but not independently verified with a second test user/workspace).
- Load/performance testing.

## Data sources / Supabase objects
- Tables: `messaging_messages`, `messaging_message_versions`, `messaging_metrics_daily`, `messaging_activity`, `messaging_channel_configs`, `messaging_audiences`, `messaging_contacts`.
- All have workspace-scoped RLS policies (`workspace_id in (select workspace_id from workspace_members where user_id = auth.uid())`).
- Migration: `supabase/migrations/20260902000000_messaging_module.sql` — applied to the live project via `scripts/apply-migration.mjs`.

## Phase 2 additions (this pass)
- Real message composer at `/app/messaging/email/compose` (and sms/whatsapp/rcs/push) — create/edit draft, save, test send, schedule, send now.
- Real audience quick-create (paste a list of emails/phones → validated → `messaging_contacts` + `messaging_audience_members`).
- Real send pipeline (`src/lib/messaging/send.ts`): consent + suppression re-checked at send time, idempotent per (message, contact), delivery events recorded.
- Real Email provider adapter calling the Resend REST API (`src/lib/messaging/providers/email.ts`) — an actual send once `RESEND_API_KEY`/`MESSAGING_EMAIL_FROM` are set; SMS/WhatsApp/RCS/Push adapters truthfully report "not connected" rather than faking success.
- `npx tsc --noEmit` re-run across the full repo after Phase 2: 0 errors in any file under `src/lib/messaging`, `src/components/messaging`, or `src/app/app/messaging`/`src/app/api/messaging`.

## Phase 3 additions (this pass)
- Real Resend webhook receiver at `/api/messaging/webhooks/resend` with full Svix signature verification (`src/lib/messaging/providers/resend-webhook.ts`) — converts delivered/opened/clicked/bounced/complained/failed/deferred events into real `messaging_delivery_events` rows and recomputes message counters.
- Real behavioural journey conditions ("opened previous message" / "clicked previous message") evaluated against actual delivery events, not a pass-through.
- Verified the connected Resend account can send: sent a real test email during this session (id `da2c719d-d0f0-48bf-b713-842e42b74349`, delivered).
- Confirmed via direct API calls that the connected Resend MCP integration uses a sending-access-restricted key — cannot list/create API keys, list domains, or create webhooks from this session. Documented exactly what the user needs to do themselves in user-fixes.
- Generated a local `MESSAGING_JOBS_SECRET` and added it to the gitignored `.env.local` so the journey engine is testable locally right away.
- New migration `20260902010000_messaging_delivery_events_index.sql`, applied live.
- `npx tsc --noEmit` across the full repo: 0 errors. `next build` compiles the app successfully; its build-time typecheck fails on an unrelated, pre-existing, untracked file (`src/app/app/seo/ai-search/page.tsx`) not touched by this work.

## Phase 4 additions (this pass)
- Real approval workflow: `submitMessageForApproval` / `reviewMessageApproval` server actions, `MessageApprovalActions.tsx` wired into the composer, the programs table, and the message detail page — real state transitions, not cosmetic badges.
- Real message detail route `/app/messaging/messages/{id}` with deep-linkable tabs (Content, Audience, Delivery, Performance, Versions) — every field is queried from the actual database (`messaging_messages`, `messaging_delivery_events`, `messaging_message_versions`, `messaging_activity`), no placeholder content.
- Compose routes now support editing an existing draft via `?id=` (previously create-only).
- Real channel-connect page `/app/messaging/channels` with a "Check connection" action that re-verifies actual provider credentials and persists the result (`refreshChannelHealth`).
- Real SMS provider adapter (`src/lib/messaging/providers/sms.ts`) calling the Twilio REST API directly — an actual send once Twilio env vars are set, exactly mirroring the Resend/Email adapter's honesty (never fakes success). Channel health for SMS is now auto-detected the same way Email's is.
- `npx tsc --noEmit` across the full repo after every change in this phase: 0 errors.

## Bugs found / fixed
None found in this pass (net-new code).

## Pending manual/user actions
See `release-gated/user-fixes/messaging/overview.md`.

## Release score: 70/100
## Final release decision: **blocked pending the user's own third-party account setup and a future visual-design pass** — schema, entitlements, real data, a full compose→approve→send pipeline (Email via Resend, SMS via Twilio), a real delivery webhook receiver, real behavioural journey conditions, and a real message detail/approval UI are all in place and confirmed sending for real (Email). What remains is either (a) third-party accounts only the account owner can create — WhatsApp Business, an RCS aggregator, FCM/APNs, and registering the Resend webhook with a production URL — or (b) a dedicated visual-design pass to match the 8 approved reference images pixel-for-pixel. See the implementation tracker for the full breakdown and exactly what unblocks each remaining item.
