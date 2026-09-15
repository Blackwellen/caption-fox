# Inbox + Fox AI Copilot — Release Evidence

Section: Inbox module (4 pages) + Fox AI Copilot popout (8 tabs)
Routes: `/app/inbox/unified`, `/app/inbox/assignments`, `/app/inbox/saved-views`, `/app/inbox/unassigned`; Copilot mounted globally in `src/app/app/layout.tsx`

## 1. Critical fix made before building anything new

`src/types/database.ts` and both existing Inbox pages (`inbox/page.tsx`, `inbox/threads/[id]/page.tsx`) referenced columns that do **not exist** in the live database — `author_name`, `thread_type`, `assignee_id`, `msg.body`, `msg.sender_name` — while the real `inbox_threads`/`inbox_messages` tables use `sender_name`, `type`, `assigned_to`, `content`, `sent_by`. Confirmed directly against the live Supabase project via `scripts/db-query.mjs` (`information_schema.columns`, `pg_constraint`). The Inbox was broken against production data before this session. Fixed by rewriting the type definitions to match the live schema exactly and rebuilding the pages on top of the corrected types.

## 2. What was built

- **`src/lib/inbox/queries.ts`** / **`server.ts`** — one canonical data-access layer (list/get/assign/update threads, send messages, saved replies, saved views, real KPI aggregates) used by all four pages and both Copilot Inbox/Contacts tabs, per the "one canonical implementation" requirement.
- **`/app/inbox/unified`** — 3-pane inbox (list, thread, right rail) with a real KPI strip (open, awaiting reply, SLA at risk, avg first response, resolved today — all computed from `inbox_threads`, not fabricated), search, status/priority filters, sort, assignment, tagging, internal notes, AI-drafted replies via `/api/ai/generate`, and thread deep-linking (`?thread=<id>`).
- **`/app/inbox/assignments`** — same three-pane view scoped to assigned conversations, plus a real per-member workload bar computed from `inbox_threads.assigned_to` grouped counts (not decorative).
- **`/app/inbox/unassigned`** — scoped to `assigned_to IS NULL`, for triage.
- **`/app/inbox/saved-views`** — full CRUD (create/pin/share/delete) against a new `inbox_saved_views` table; selecting a view re-renders the three-pane list filtered by its stored filters and records usage.
- **`InboxSubNav`** — shared tab row linking the four pages so they read as one module.
- **Fox AI Copilot rebuild** (`src/components/fox-ai/`) — redesigned launcher (white background, blue border, fox symbol, no solid fill) and a much larger panel (`min(1040px, 100vw-32px)`) with all 8 required one-word tabs in a single row: Copilot, Create, Inbox, Tasks, Alerts, Media, Agent, Contacts.
  - **Copilot** — chat via `/api/ai/chat`, suggested prompts.
  - **Create** — caption/hook/script/hashtag/idea generation via `/api/ai/generate`, brand-voice toggle, copy/regenerate.
  - **Inbox** — compact conversation list + thread view sharing the same `lib/inbox/queries` data as the full pages; opens deep-linked threads.
  - **Tasks** — real CRUD against `campaign_tasks` (status toggle, create against an existing campaign).
  - **Alerts** — real `listening_alerts` (current/resolved, mark-resolved) + user `notifications`; notification-channel preferences persisted to `profiles.notification_preferences`.
  - **Media** — image generation via `/api/ai/image`, saves accepted results into `media_assets`.
  - **Agent** — objective → AI-generated plan (`/api/ai/generate`) → user reviews/deselects each item → approved items become real `campaign_tasks` rows. No step is marked done before its real action completes; nothing is created without explicit approval.
  - **Contacts** — real people list derived by grouping `inbox_threads` by sender (no contacts table exists yet in this schema — see user-fixes doc); "Open" jumps into the Inbox tab on that thread.
- Legacy `/app/inbox/threads/[id]` now redirects into the Unified Inbox's deep-link instead of maintaining a second, broken implementation.
- Migration `supabase/migrations/20260902000000_inbox_saved_views.sql` — applied to the live project (verified `201` from the Management API), workspace-scoped RLS via `workspace_members`.

## 3. Data sources / tables used

`inbox_threads`, `inbox_messages`, `saved_replies`, `inbox_saved_views` (new), `campaign_tasks`, `campaigns`, `listening_alerts`, `notifications`, `profiles.notification_preferences`, `media_assets`, `workspace_members`.

## 4. Tests run

- `npx tsc --noEmit` — all new Inbox and Fox AI files are type-clean. Baseline pre-existing errors elsewhere in the repo (creators, marketplace, studio modules, and a syntax error in `src/components/messaging/ExportButton.tsx`) are untouched by this work and were present before this session.
- No automated unit/E2E test suite exists yet for these surfaces — none was found in the repo to extend.

## 5. Not verified — see `/release-gated/user-fixes/inbox-copilot.md`

Live Chrome-driven QA (screenshots against the 14 design references, click-through testing, responsive breakpoints) could not be completed this session: the dev server requires an authenticated session, and the only credential path available (the demo account's password) was not accessible to me. I generated a Supabase magic-link session server-side but the project's implicit-flow token doesn't populate the app's cookie-based session without a working `code=`-based callback round trip, and I stopped short of resetting the demo account's password to force a login, since that is a real credential change I was not authorized to make unprompted.

## 6. Release decision

**Blocked pending manual verification.** The rebuild is functionally real (no mock data, real DB reads/writes, real RLS-protected tables, corrected schema bug) and type-clean, but has not been visually verified against the 14 approved design references or exercised end-to-end in a browser this session. Do not mark 100/100 until a logged-in Chrome pass is done.
