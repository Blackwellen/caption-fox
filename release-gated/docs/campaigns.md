# Campaign Manager → Campaigns — Release Evidence

Section: Campaigns module (7 routes)
Routes: `/app/campaigns`, `/app/campaigns/all`, `/app/campaigns/giveaways`, `/app/campaigns/competitions`, `/app/campaigns/templates`, `/app/campaigns/board`, `/app/campaigns/timeline`

## 1. What was built

- **`src/lib/campaigns/`** — one canonical data/domain layer for all seven surfaces:
  `constants.ts` (lifecycle stages, health, priority, approval, channels, template/
  giveaway/competition vocab, all with badge-tone mappings), `types.ts` (row shapes),
  `entitlements.ts` (single `canAccessCampaignModule` resolver combining role
  permission + workspace type + plan rank, plus a `campaignCapabilities()` object
  every button/menu reads from), `query.ts` (URL query-state parser/builder — every
  filter, search term, sort, page, size and view mode lives in the URL), `data.ts`
  (every KPI/chart/list query, real Supabase reads, no mock data), `server.ts`
  (`getCampaignSession` / `requireCampaignModule` route guard used by all 7 pages).
- **`/app/campaigns`** (Overview) — KPI strip, performance trend chart, lifecycle
  donut, budget-vs-performance scatter, next-actions list, featured campaign cards,
  recent activity, campaigns-health table. Cards/Table view toggle.
- **`/app/campaigns/all`** — search/filter/sort/paginate every campaign, bulk
  select + bulk stage/priority/owner update + bulk archive, workload panel.
- **`/app/campaigns/giveaways`** — 4-step creation wizard (basics, prize &
  fulfilment, entry rules, dates & review), entries-trend chart, prize-fulfilment
  donut, winner review queue (approve/reject/contact/accept/fulfil/replace, each
  transition validated server-side against the entry's current state).
- **`/app/campaigns/competitions`** — 4-step creation wizard, submissions-trend
  chart, judging-status donut, top-performers list, sequential judging-stage
  control (server rejects skipping a stage).
- **`/app/campaigns/templates`** — template CRUD, publish/unpublish/submit-review/
  approve/request-changes state machine, duplicate-as-draft, favourite, usage
  trend, most-reused list, approval queue, and a real "create campaign from
  template" flow that instantiates an actual campaign row (+ brief/launch
  milestones) rather than copying the card's UI.
- **`/app/campaigns/board`** — pointer-event drag-and-drop (mouse/pen/touch) across
  the canonical lifecycle stages, with a keyboard/screen-reader "Move to stage"
  menu as the non-drag path, optimistic UI + server-validated rollback on invalid
  transitions, board summary + stage donut.
- **`/app/campaigns/timeline`** — a real DOM Gantt (rows/bars/milestone diamonds
  built from data, not an image), drag-to-move and drag-to-resize-end with
  server-side date validation, a "today" marker, an accessible data-table
  fallback, upcoming milestones / launch risks / dependencies panels.
- **CSV import** (`import-actions.ts`, `ImportButton.tsx`) — campaigns, templates,
  giveaway entries, competition submissions; column-mapping UI, duplicate
  detection, per-row invalid-record reporting with a downloadable issue CSV.
- **CSV export** (`export/route.ts`, `ExportButton.tsx`) — respects the exact
  filters/search/sort currently on screen; permission-gated; writes a
  `campaign_activity` audit row.
- **Server actions** (`actions.ts`, `entity-actions.ts`) — every mutation
  re-validates the capability and workspace ownership server-side (never trusts
  the client), and writes to `campaign_activity` for the activity feeds.

## 2. Database

Migration `supabase/migrations/20260829100000_campaigns_module.sql` — applied to
the live project (verified via the Management API and by querying
`information_schema.tables`/`columns` directly afterwards). Adds:
- New tables: `campaign_templates`, `campaign_phases`, `campaign_milestones`,
  `campaign_dependencies`, `campaign_activity`, `campaign_metrics_daily`.
- New columns on `campaigns`: `owner_id`, `lifecycle_stage`, `priority`, `health`,
  `progress`, `thumbnail_url`, `template_id`, `approval_status`, `archived_at`,
  `channels`, `engagements`, `reach`, `conversions`, `launch_date`.
- New columns on `giveaways`: `owner_id`, `cover_url`, `prize_fulfilment`,
  `approval_status`, `progress`, `health`, `channels`; on `giveaway_entries`:
  `winner_status`, `source`, `review_note`, `reviewed_by`, `reviewed_at`, plus a
  unique index on `(giveaway_id, lower(participant_handle))` for import dedup.
- New columns on `competitions`: `owner_id`, `cover_url`, `judging_stage`,
  `approval_status`, `progress`, `health`, `channels`, `engagement_rate`; on
  `competition_submissions`: `judging_status`, `assigned_judge_id`, `source`,
  `review_note`.
- RLS on every new table scoped to `workspace_id in (select workspace_id from
  workspace_members where user_id = auth.uid())`, matching the existing
  `campaigns` policy exactly. `with check` clauses added to `campaigns`' existing
  policy so inserts (not just reads) are workspace-scoped.
- A `profiles_workspace_peers` SELECT policy so owner avatars/names resolve for
  other members of the same workspace (the original policy only allowed
  `auth.uid() = id`).

## 3. Data sources / tables used

`campaigns`, `campaign_templates`, `campaign_phases`, `campaign_milestones`,
`campaign_dependencies`, `campaign_activity`, `campaign_metrics_daily`,
`giveaways`, `giveaway_entries`, `competitions`, `competition_submissions`,
`competition_judges`, `content_posts`, `workspace_members`, `profiles`,
`workspaces`.

## 4. Tests run

- `npx tsc --noEmit` — clean for every file under `src/lib/campaigns`,
  `src/components/campaigns`, `src/app/app/campaigns`.
- `next build` — the Campaigns module compiles successfully; the build's only
  failure is in the pre-existing, unrelated, untracked `src/components/
  advertising` scaffolding (missing page files that predate this session).
- All seven routes return `307` to `/login?next=...` for unauthenticated
  requests against the dev server (confirms server-render executes without a
  runtime crash), rather than a 500.
- Migration presence confirmed live via `scripts/db-query.mjs` against
  `information_schema.tables`/`columns`.
- No automated unit/E2E test suite exists yet for these surfaces — none was
  found in the repo to extend.

## 5. Not verified — see `/release-gated/user-fixes/campaigns.md`

Live Chrome-driven QA (screenshots against the 7 design references, click-
through testing of every wizard/import/export/drag interaction, responsive
breakpoints) could not be completed this session for the same reason recorded
in `inbox-copilot.md`: the dev server requires an authenticated session, and no
password is available for the demo account `jamahlthomas1996@gmail.com`.
Generating a session server-side via the Supabase admin API was considered and
deliberately not attempted — even without touching the password, minting a
valid session for a real account is a credential-adjacent action I was not
authorized to take unprompted.

Also not built this session: campaign-type-specific detail-page tabs
(Entries/Winners for giveaways, Submissions/Judging for competitions) — the
existing generic `[id]/CampaignDetailClient.tsx` was left as-is.

## 6. Release decision

**Blocked pending manual verification.** The module is functionally real (no
mock data, real DB reads/writes, real RLS-protected tables and migrations,
real server-action validation) and type-clean, but has not been visually
verified against the 7 approved design references or exercised end-to-end in
a browser this session. Do not mark 100/100 until a logged-in Chrome pass is
done per the steps in the user-fixes doc.
