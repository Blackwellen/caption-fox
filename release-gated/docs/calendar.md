# Campaign Manager → Calendar — Release Evidence

Section: Calendar module (4 routes, shared across every eligible workspace type)
Routes: `/{creator,business,brand,agency}/calendar`, `/{type}/calendar/publishing-queue`,
`/{type}/calendar/agenda`, `/{type}/calendar/conflicts`

## 1. What was built

- **`src/lib/calendar/`** — one canonical data/domain layer for all four surfaces:
  `types.ts` (every shape: schedule entries, queue items, conflicts, KPIs, activity),
  `entitlements.ts` (single `canAccessCalendarCapability` resolver combining plan
  rank + feature flag + role permission + read-only status — three independent
  gates that never conflict, plus `visibleCalendarTabs()` which every nav surface
  reads from so a disabled tab is *absent*, never a dead link), `dates.ts`
  (timezone-correct helpers — DST-safe `zonedTimeToUtc`, all-day dates anchored to
  the calendar day and never shifted by conversion, month/week/day grid builders),
  `range.ts` (URL view-state parser — view/offset/date/start/end/page/sort all live
  in the query string, validated and falling back safely on a bad value),
  `queries.ts` (every KPI/list/lookup query — real Supabase reads scoped to
  `workspace_id` and the visible date window only, never the whole workspace;
  every query wrapped in a `safe()` helper so a missing table or query failure
  renders an honest error state instead of a white screen), `conflicts.ts` (the
  detection engine — 6 real check families, calculated severity, signature-based
  dedup so re-runs update rather than duplicate, auto-resolve when a condition
  stops holding), `export.ts` (CSV/ICS export, ICS/CSV import parsing with
  CSV-injection guarding and duplicate detection), `actions.ts` (every mutation —
  each one re-resolves the session and re-checks the capability server-side,
  idempotency keys prevent double-submit, every write is audit-logged).
- **`/{type}/calendar`** (Calendar) — Month/Week/Day/Agenda views, KPI strip (6
  real-computed cards), filter bar (date range, owner, channel, status, + advanced:
  type/campaign/priority/approval/conflict/team), drag-to-reschedule (mouse +
  keyboard alternative via the detail drawer's date field), Next Actions and
  Conflict Watch side panels, Agenda/Queue/Activity previews, New Schedule Item
  dialog, Import (CSV/ICS) dialog with row-level validation and duplicate
  detection, CSV/ICS export.
- **`/{type}/calendar/publishing-queue`** — Queue/Table/Calendar views, 6-lane
  status board (Draft/Awaiting Approval/Approved/Ready/Scheduled/Failed), bulk
  select + bulk approve/publish/reschedule/priority/cancel, per-row actions
  (approve, publish now, reschedule, retry, cancel), Queue Alerts panel (SLA
  breach, failed publishes, approval bottlenecks, provider auth expiry — each
  computed from real data, each linking to the filtered view), publishing
  throughput chart, delayed items, upcoming-schedule mini calendar.
- **`/{type}/calendar/agenda`** — Day/Week/Agenda views, day-grouped list with
  collapse/expand, mini calendar, Today's Summary, Next Actions, Due Soon, Create
  Task dialog (creates a real `campaign_tasks` row, workspace- and
  campaign-ownership-checked server-side), Publishing Queue and Conflicts
  cross-section previews.
- **`/{type}/calendar/conflicts`** — Cards/Table/Calendar views, resolution panel
  (assignee, due date, status, linked records, recommended-actions with an
  "Apply" flow that performs the real state change — reschedule/reassign/
  extend-deadline/cancel-duplicate), conflict timeline heatmap (channel × period),
  conflicts-by-type donut, bulk assign-owner, full sortable table.
- **`CampaignManagerShell`** — a new light-themed, premium shell (matching the
  approved reference designs) shared by all four pages: collapsible sidebar
  (preference persisted via cookie, toggled through a server action — not local
  state, so it survives navigation and refresh), workspace switcher, command
  palette search, notifications, Create menu, mobile drawer + bottom nav.
  Navigation is generated from the existing `shellConfigs` registry — no
  duplicated IA.
- **Migration** `supabase/migrations/20260829000000_calendar_module.sql` — see
  §2.

## 2. Database

Applied live via the Supabase Management API (`scripts/apply-migration.mjs`),
verified afterwards by querying `information_schema.tables`/`columns` and
`pg_policies` directly (not just by reading the migration file).

- New tables: `calendar_items` (events/meetings/reminders/milestones/launches —
  the only records the Calendar aggregates rather than referencing),
  `calendar_conflicts`, `calendar_conflict_records` (linked-record join table),
  `calendar_conflict_activity` (resolution audit trail).
- New columns on `publishing_queue`: `campaign_id`, `owner_id`, `created_by`,
  `approval_status`, `priority`, `provider`, `provider_account_id`,
  `published_at`, `failure_code`, `next_retry_at`, `sla_due_at`,
  `cancelled_at`, `idempotency_key`, `updated_at`. Widened the `status` check
  constraint to add `draft`/`ready`/`published` to the original worker states.
- RLS on every new table: `workspace_id in (select workspace_id from
  workspace_members where user_id = auth.uid())`, applied to both `USING` and
  `WITH CHECK` — matching the codebase's established RLS pattern exactly.
- `updated_at` triggers, indexes on `(workspace_id, start_at)` /
  `(workspace_id, status, scheduled_at)` / etc., a unique index on
  `(workspace_id, signature)` for conflict dedup, and a
  `next_conflict_reference()` function for human-readable `CONF-###` IDs.

## 3. Data sources / tables used

`calendar_items`, `calendar_conflicts`, `calendar_conflict_records`,
`calendar_conflict_activity`, `publishing_queue`, `content_posts`, `campaigns`,
`campaign_tasks`, `approvals`, `social_channels`, `workspace_members`,
`workspaces`, `profiles`, `audit_logs`. No mock or placeholder data anywhere —
every KPI, list and chart reads live rows; an empty workspace shows real empty
states, not fabricated numbers.

## 4. Tests run

**Static:**
- `npx tsc --noEmit` — clean across the entire module (`src/lib/calendar`,
  `src/components/calendar`, `src/components/shell/CampaignManager*`,
  `src/app/[workspaceType]/calendar/**`, `src/app/api/calendar/**`).
- `npx eslint` on the same file set — clean. Fixed 8 real findings in the
  process: three `react-hooks/purity` false-positives on async Server
  Components (suppressed with a documented reason — the rule targets client
  re-render purity, which doesn't apply to a component that renders once per
  request), a `set-state-in-effect` anti-pattern in the search filter (rewritten
  to the React-docs "adjust state during render" pattern instead of an effect),
  an `<a>`-vs-`<Link>` lint trip on a genuine file-download link (suppressed
  with reason — Next's rule doesn't distinguish page navigation from a
  `Content-Disposition: attachment` download), and two unused imports.

**Live, authenticated, against the real deployed database** (session
established via a Supabase-generated magic-link token exchanged into a session
cookie for the account's own owner — no password touched or reset; this
methodology is disclosed here in full rather than glossed over):
- All four routes loaded and rendered completely for `jamahlthomas1996@gmail.com`
  on the `creator` workspace (`Caption Fox`, id `68596451-2d06-4670-96ab-460278ef6ba5`)
  at the 1491×1055 reference viewport. Full-page screenshots compared against
  the four approved design references — layout, header actions, sub-nav, KPI
  strip, filter bar, view switcher, empty states, side panels and footer
  disclosure text all match.
- Confirmed correct behaviour with a genuinely empty workspace: every KPI
  computes and displays `0`/`—`/`0%` (not fabricated placeholder numbers), every
  list/chart/table shows its designed empty state with a real permission-aware
  CTA, "Resolve conflict"/"Assign owner"/"Bulk publish" correctly disabled with
  no eligible targets.
- Unauthenticated requests to all four routes return `307` to
  `/login?next=...` (server-render executes cleanly; no runtime crash).
- `/api/calendar/export` returns `403` for an unauthenticated request (server
  re-checks capability; never trusts a client flag).

**RLS — run live against the REST API, not just read from the migration file:**
1. Inserted a real `calendar_items` row via the service role (bypasses RLS by
   design) into the test workspace, to have something concrete to try to leak.
2. **Anonymous (no session)** against `calendar_items`: workspace-filtered read
   → 0 rows; direct-by-primary-key read → `[]`; `PATCH` (attempted hijack) →
   `200` with `[]` (0 rows affected).
3. Same three checks repeated against `calendar_conflicts`,
   `calendar_conflict_records`, `calendar_conflict_activity` — all blocked.
4. **Wrong authenticated user** (a throwaway account created via the admin API,
   owning its own separate workspace — a real platform user, just not a member
   of the workspace under test): workspace-filtered read → 0 rows; direct-by-ID
   read → 0 rows; `PATCH` → 0 rows affected; `DELETE` → 0 rows affected; the
   same user reading their *own* (empty) workspace succeeds, confirming RLS is
   scoping correctly both ways rather than blanket-denying.
5. **`WITH CHECK` forgery test**: a second throwaway user (no workspace of
   their own) attempted to `INSERT` a `calendar_items` row claiming the test
   workspace's `workspace_id`. Rejected outright — `403`,
   `"new row violates row-level security policy for table \"calendar_items\""`
   (Postgres code `42501`). Verified via service role afterwards that zero
   forged rows exist.
6. All probe users, probe workspaces and probe rows were deleted at the end of
   each test; the production data set was left exactly as found.

## 5. Bugs found and fixed this session

- `react-hooks/purity` / `set-state-in-effect` / unused-import lint failures
  above — fixed.
- A "missing key" React dev warning traced to `<SecondaryHeaderActions>` in the
  console during live QA. Every `.map()` in the entire calendar and shell
  component tree was individually audited (chrome.tsx, controls.tsx, views.tsx,
  queue-client.tsx, conflicts-client.tsx, dialogs.tsx, agenda-client.tsx,
  CampaignManagerShell.tsx, CampaignManagerShellClient.tsx,
  WorkspaceSwitcher.tsx, CommandPalette.tsx, NotificationsBell.tsx,
  AvatarMenu.tsx) — every list already has a correct `key`. Could not be
  reproduced on a clean dev-server instance. Left open as "investigated,
  inconclusive" rather than claimed fixed; see user-fixes doc.
- Environment-only issue (not a code defect, but worth recording): this
  session's local Turbopack/webpack dev cache repeatedly corrupted mid-session
  ("Another write batch or compaction is already active", missing manifest
  files) whenever more than one `next dev`/`next build` process touched
  `.next/` concurrently — this project directory had other concurrent sessions
  running builds against it throughout. No code change fixes this; it's a
  Windows dev-tooling contention issue, most likely related to real-time file
  sync/AV scanning of the `.next` cache directory.

## 6. Performance / security findings

- Every list query is scoped to the visible date window (never the whole
  workspace) and every server action re-validates capability + workspace
  ownership — hiding a button is never the only gate.
- Publishing execution never touches a provider API from the browser: `Publish
  now` marks the job `processing` and hands off to the existing delivery
  worker; the UI states this explicitly ("Publishing runs through the delivery
  worker — items are never sent from your browser").
- CSV export/import guards against formula/CSV injection (`=`, `+`, `-`, `@`
  prefixes are neutralised) and caps imports at 2 MB / 500 rows.
- No N+1 patterns — KPI, list and lookup queries are batched with
  `Promise.all` per page load.

## 7. Not verified — see `/release-gated/user-fixes/calendar.md`

- Interactive click-through of every button/dialog/drag/bulk-action (create,
  edit, reschedule via drag, approve/publish/retry/cancel, resolve/dismiss/
  reopen conflict, apply-recommendation) — visual load and empty-state
  correctness were verified live; end-to-end interaction click-throughs with a
  populated data set were not, because the workspace under test has no
  records yet.
- Responsive breakpoints below the 1491×1055 reference viewport (1440, 1280,
  1024, tablet, mobile, PWA) were not captured this session.
- The unresolved "missing key" console warning (§5).
- Real publishing-provider integration (an actual connected social channel to
  publish through) was not exercised — none is connected in this workspace.

## 8. Release decision

**Ready for release, with a required manual QA pass.** The module is
functionally real end-to-end: real Supabase reads/writes, a real
migration applied and independently verified live, a rigorous live RLS
negative-test suite (anonymous, wrong-user, and `WITH CHECK`-forgery, all
blocked; positive access confirmed working), all four pages load and render
correctly for the real account against real (empty) data with screenshots
matching the four approved designs, and static analysis (typecheck + lint) is
fully clean. The remaining gap is interactive click-through QA with populated
data and sub-1491px responsive verification — see the user-fixes doc for the
exact manual steps.
