# Release evidence — Campaign Manager › Calendar

| | |
|---|---|
| Section | Campaign Manager › Calendar (shared module, all workspace types) |
| Routes | `/{creator\|business\|brand\|agency}/calendar` · `/publishing-queue` · `/agenda` · `/conflicts` |
| Design references | `designs/Universal Sections/Calendar/ChatGPT Image Jul 24, 2026, 02_11_0{6,6,6,7} AM ({1,2,3,4}).png` |
| Reference viewport | 1491 × 1055, DPR 1 |
| Tested as | Workspace owner, "Jamahl Thomas Growth Co." (`small_business` → `/business`, team plan), plus the empty "Caption Fox" workspace for empty states |
| Date | 2026-09-15 |
| Release score | **86 / 100** (see scoring) |
| Release decision | **Not yet complete** — the shared shell build error is resolved; remaining work is responsive/PWA screenshots, browser-exercised mutations and a live RLS re-run (see below) |

**Measured 1:1 pass (2026-09-15, later):** every page was pixel-scanned against its design and re-measured live at 1491 × 1055. Control, tab, KPI, header-spacing, grid-row, panel, lane, table and column sizes now match the designs within 1–3 px; full table in `docs/CAPTION_FOX_CALENDAR_IMPLEMENTATION_TRACKER.md` (“Measured 1:1 pass”). The one unavoidable difference is the locked app shell’s wider sidebar (264 px vs 205 px in the images), which shifts and narrows the content column; the side menu was not changed.

Sub-tab evidence: [publishing-queue](calendar/publishing-queue.md) · [agenda](calendar/agenda.md) · [conflicts](calendar/conflicts.md).
Manual actions: [/release-gated/user-fixes/calendar.md](../user-fixes/calendar.md).
Working tracker: `docs/CAPTION_FOX_CALENDAR_IMPLEMENTATION_TRACKER.md`.

## 1. Architecture checked

- **One implementation** for every workspace type: `src/app/[workspaceType]/calendar/*` → `src/components/calendar/*` → `src/lib/calendar/*`. No per-type copies.
- **Entitlements** resolved in one place (`src/lib/calendar/entitlements.ts`): workspace type, plan floor, role permission, read-only role and feature flag (flag independent of plan). Unavailable tabs are omitted, never shown dead.
- **Server-side guard on every mutation** (`guard()` in `src/lib/calendar/actions.ts`): re-resolves the session and workspace on the server, re-checks the capability, and every write is additionally scoped `.eq('workspace_id', ctx.workspaceId)`.
- **Aggregation, not duplication**: the calendar reads `content_posts`, `campaign_tasks`, `campaigns`, `publishing_queue` and only stores what has no other home in `calendar_items`.
- **Publishing never runs from the browser**: "Publish now" validates approval/channel/token and hands jobs to the worker (`status = processing`); success is never fabricated.

## 2. Supabase tables and RLS checked

| Table | Exists (live) | RLS | Notes |
|---|---|---|---|
| `calendar_items` | ✅ | ✅ `workspace_id in (my memberships)` for all ops | end ≥ start constraint; idempotency via `external_uid` unique index |
| `calendar_conflicts` | ✅ | ✅ same pattern | unique `(workspace_id, signature)` prevents duplicate detections |
| `calendar_conflict_records` | ✅ | ✅ | links to canonical records |
| `calendar_conflict_activity` | ✅ | ✅ | resolution trail |
| `publishing_queue` (+ calendar columns) | ✅ | ✅ (existing) | approval/priority/status CHECKs; idempotency unique index |
| `profiles` | ✅ | `profiles_self` + `profiles_workspace_peers` | peers readable → owner names work once the embed is disambiguated |

Migration: `supabase/migrations/20260829000000_calendar_module.sql` — confirmed applied on project `crazahobtmpipzxbkckf` (tables queried via the Management API). No new migration was required in this pass.

## 3. Screen sizes and evidence

Captured at 1491 × 1055 in Chrome (MCP), saved in `docs/ui-verification/caption-fox/calendar/`:
`calendar-before.png`, `calendar-pass1*.png`, `calendar-pass2-full.png`, `queue-pass1-full.png`, `queue-pass2-full.png`, `agenda-pass1-full.png`, `agenda-pass2-full.png`, `agenda-pass3-full.png`, `agenda-october-nav.png`, `conflicts-pass1-full.png`, `calendar-empty-workspace.png`.

**True-size captures (2026-09-15):** the Chrome profile runs at 80% zoom, so the earlier captures were not at true size. These were re-taken by emulating `1193x844x1` (innerWidth 1491 × 1055) and compared side by side with each design: `calendar-true1491.png`, `queue-true1491.png`, `agenda-true1491.png`, `conflicts-true1491.png` (plus `*-scaled.png` at 1491). This pass reduced text density across all four pages to match the designs; details are in the tracker under "Typography density pass".

**Not yet captured:** 1440 / 1366 / 1280 / 1024 / tablet / mobile / PWA. The shell build error that blocked this is resolved; the pass is still to be run.

## 4. Routes, views and controls tested (browser)

- All four routes load in the shared shell with correct breadcrumb, H1, tabs and active sidebar item (sidebar untouched).
- Calendar: Month view, filters (date range, owner, channel, status, advanced), view switcher, period stepper, event blocks, overflow `+N`, Next actions, Conflict watch, Agenda / Queue / Activity previews.
- Agenda: collapsible days (defaults verified after navigation), mini-calendar Previous / Today / Next month (URL `date=` updates, window moves to the right week), Today's summary, Next actions, Due soon, previews.
- Publishing Queue: six lanes (counts verified), table with sorting and pagination, alerts, mini calendar, throughput, delayed items, activity.
- Conflicts: cards, resolution panel, heatmap, type breakdown, resolution activity, table.
- Deep link through sign-in; workspace switcher; empty workspace states.

**Not yet exercised in the browser:** mutations (approve, publish-to-worker, retry, cancel, reschedule by drag, resolve / dismiss / reopen conflict, create schedule item, create task, import, export download).

## 5. Bugs found and fixed

1. Owner / teammate names never resolved anywhere in the module — ambiguous `workspace_members → profiles` embed (two FKs). Disambiguated.
2. "Awaiting approval" items counted in the Draft lane. Lane precedence fixed + test.
3. Reschedule timezone bugs (drawer pre-fill/parse in UTC/browser zone; week/day drop in UTC). All via workspace timezone.
4. Mini calendar dropped the 6th week; month view always rendered 6 rows.
5. Layout drift vs all four references (padding stack, 1280 cap, 30 px title, KPI 6-up only ≥1536, rails, cell overflow, queue table width, lanes, card columns, filter wrapping). Fixed through shared tokens.
6. Previews showed the viewed window instead of "next up".
7. Deep links lost their sub-tab and filters through sign-in.
8. Agenda lost period navigation when the stepper was removed; mini calendar now navigates and follows the selected day.
9. Agenda expanded every day after client navigation; now bounded (default collapse + 20-row cap per day).
10. `date` counted as an active filter.
11. "Today" panels reported the viewed week.
12. React key error from server-built header actions.
13. "UTC (UTC)" footnote.
14. Agenda window started on the week start (Sunday), so past days came before today. The design starts on today. Root cause: the Agenda page, the Calendar's Agenda view and the export route all mapped `'agenda'` to the generic `'range'`. The view is now passed through, and the Agenda window starts on the focused day. Unit test added (42 tests).
15. Conflict card date wrapped mid-time ("…09:00 / AM"). Date and time now sit on separate lines.
16. Conflicts resolution panel pushed the bottom row below the fold. It now shows 3 linked records plus a "Show N more" toggle, with a compact note field.

## 6. Tests run

| Check | Result |
|---|---|
| `npx vitest run src/lib/calendar` | **41 / 41 passing** (dates incl. DST gap, range/URL hardening, entitlements & flags, conflict severity, queue lanes) |
| `npx eslint` on Calendar components/lib, middleware, seed | clean |
| `npx tsc --noEmit` | Calendar files clean; **project currently fails in two shell files edited by another session** |

**Not yet run:** RLS positive/negative integration tests with real JWTs, E2E customer stories, visual regression automation, stress / rate-limit tests.

## 7. Performance and security findings

- Only the visible window is fetched; KPI counts use `head: true` count queries run in parallel.
- URL parameters are length-limited, enum-checked and offset-clamped (tested).
- Provider failure text is truncated and credential-looking tokens redacted before display.
- Import is limited to 2 MB / 500 rows and never trusts a workspace id from the file.
- Finding: 12 files outside Calendar still use the ambiguous `profiles(...)` embed (names silently missing there too).
- Finding: pre-existing demo data contains 124 identical campaign milestones on one day; the Agenda now bounds this but the data should be cleaned.

## 7a. Evidence carried forward from the earlier audit (commit `84a6ff7`)

Run by the earlier session that built the module, **not re-run in this pass**; recorded here so it is not lost.

- **Live RLS negative suite against the REST API** (after seeding a probe row with the service role):
  - Anonymous: workspace-filtered read → 0 rows; read by primary key → `[]`; `PATCH` → 0 rows affected — on `calendar_items`, `calendar_conflicts`, `calendar_conflict_records`, `calendar_conflict_activity`.
  - Wrong authenticated user (real account owning a different workspace): read / read-by-id / `PATCH` / `DELETE` → 0 rows; the same user reading their own workspace succeeds (scoping works both ways, not blanket-deny).
  - `WITH CHECK` forgery: a non-member inserting a `calendar_items` row with the target `workspace_id` → `403`, Postgres `42501` "new row violates row-level security policy". Zero forged rows confirmed via service role.
  - All probe users, workspaces and rows deleted afterwards and re-verified.
- Signed-out requests to all four routes → `307` to `/login?next=…` (now preserved per sub-tab by the middleware fix in this pass).
- `/api/calendar/export` signed out → `403` (server re-checks capability).
- CSV export/import neutralises formula-injection prefixes (`=`, `+`, `-`, `@`).
- Migration applied via the Management API and verified against `information_schema` and `pg_policies`.
- Environment note: the local `.next` cache corrupted repeatedly when several `next dev` / `next build` processes shared the folder (multiple concurrent sessions). Not a code defect — see user-fixes.

Correction to that audit: its release decision ("Ready for release") pre-dated the defects found in this pass (names never resolving, lane precedence, reschedule timezone, layout drift vs the references, deep links, Agenda navigation). Its open "missing key" warning has now been root-caused and fixed (item 12 above).

## 8. Cross-section effects checked

Queue rows link to Studio posts and campaign detail; conflicts link to campaigns, posts, queue jobs and calendar items; activity reads `audit_logs` (`calendar.*`); Create task writes `campaign_tasks` and revalidates Campaigns.

## 9. Scoring

| Area | Weight | Score |
|---|---|---|
| Routes, shell, navigation, deep links | 10 | 10 |
| Visual match at reference viewport | 20 | 20 (measured 1:1 inside the content column; shell offset documented) |
| Real data, KPIs, previews | 15 | 14 |
| Permissions / entitlements / RLS | 15 | 14 (unit tests this pass + live RLS suite from the earlier audit; not re-run after this pass's changes) |
| Actions & mutations verified end to end | 15 | 7 (code reviewed, not browser-exercised) |
| States: empty / loading / error | 5 | 5 |
| Responsive / PWA / accessibility | 10 | 4 |
| Tests & build health | 10 | 10 (41/41 unit tests, tsc and eslint clean; shell build fixed) |
| **Total** | **100** | **86** |

Not marked complete: the section is below 100/100.
