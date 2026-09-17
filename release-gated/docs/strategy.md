# Campaign Manager → Strategy — Release Evidence

| | |
|---|---|
| Section | Campaign Manager → Strategy (Overview + 6 sub-tabs) |
| Canonical routes | `/{business,brand,agency}/strategy` · `/objectives` · `/audiences` · `/research` · `/positioning` · `/plans` · `/forecasts` |
| Legacy routes | `/app/strategy/*` → 307 to the canonical route (sub-path + query preserved) |
| Workspace types | Business, Brand, Agency. Creator: hidden from nav and 404 by URL |
| Plan / flag gates | Positioning & Plans: Team+. Forecasts: Team+ for Brand/Agency, Brand+ for Business, plus flag `strategy_forecasts` |
| Roles tested | Owner, Admin, Manager, Member, Viewer (RLS + app capabilities) |
| Date | 2026-09-16 |
| Release score | **90 / 100** — not complete; see "Remaining to reach 100" |
| Decision | **Ready for admin-only beta** until the remaining items below are closed |

---

## 1. Screen sizes & evidence

| Size | Result |
|---|---|
| 1491×949 (design viewport, window-capped height) | All 7 routes captured and compared side-by-side with `designs/Universal Sections/Strategy/*` |
| 820 (tablet) | Sliding segmented tab tray, 3-col KPIs, 2-col panels, no clipping |
| 500 (smallest window Chrome allows here; mobile/PWA breakpoint) | Dropdown tab selector, 2-col KPIs, stacked filters, **no horizontal overflow** (measured `scrollWidth === innerWidth`) |

Screenshots: `docs/ui-verification/caption-fox/strategy/overview-implementation.png` (stitched full page) and in-session captures for every tab. References copied to the same folder as `{page}-reference.png`.

**Visual fidelity:** layout, grid proportions, card sizes, type scale, colours and component placement match each design. Known, intentional differences:
- The app shell (264px sidebar, top bar) is design-locked (`APP_SHELL_DESIGN_LOCK.md`), so the content column is ~28px narrower than the images at 1491px; internal grids use fractional columns so proportions hold.
- Values differ from the images because every figure is live workspace data (e.g. 10/18 on track rather than 14/18).
- The Overview "All markets" filter in the Positioning image was not built: there is no market dimension in the data, and a filter that does nothing is worse than none.

## 2. Routes, navigation & registration

- Navigation register (`src/lib/navigation/resolver.ts`) now points Strategy and "Leads & Audiences" at the canonical typed routes; resolver tests updated (`[brand, /brand/strategy/plans/abc123] → strategy`).
- Sidebar unchanged apart from those hrefs (standing rule 2).
- Breadcrumb: Home › Campaign Manager › Strategy › {tab}. H1, `<title>`, tab label and breadcrumb agree on every page.
- Tabs derive active state from the URL: deep links, hard refresh and back/forward verified. Hidden modules are not rendered at all (no disabled or dead tabs).
- `getStrategyPageContext` resolves auth → workspace → type → plan → role → flags **before** any read; an unentitled module 404s.
- Error boundary `src/app/[workspaceType]/strategy/error.tsx` shows a digest reference (message only in development).

## 3. Buttons, actions & flows tested

| Page | Actions (all server actions: auth + capability + ownership + validation + activity + audit) |
|---|---|
| Overview | New objective, Add research, Export CSV/JSON, copy link, print; complete / reopen Next actions (optimistic with rollback); Sort / activity filter; Dashboard ↔ Table view with pagination |
| Objectives | Create / edit (dialog), status change via menu (transition rules enforced server-side), archive → restore → permanent delete (requires archive first), CSV import (all-or-nothing, duplicate + schema checks, 500-row cap, rate-limited), bulk update (skips disallowed transitions and reports them), Cards / Table / Timeline / Kanban (drag to allowed columns only) |
| Audiences | Create / edit / archive / restore, CSV import (1,000 rows, aggregated segments only), **Sync CRM** (runs only with an active HubSpot/Salesforce integration; otherwise explains how to connect — no fake sync), Save view (private), Cards / Table / Map / Compare (≤4) |
| Research | Add research, Create brief, **Upload file** (private bucket, client → storage RLS → server re-inspects size + magic bytes, removes object on any mismatch), signed 120s download (audited), favourite (optimistic), submit for review → approve / request revision (comment required, author notified in-app), move to collection, new collection, archive / restore / delete (removes stored file), Library / Table / Board |
| Positioning | New framework, edit (editing an approved framework creates a new draft version), add proof point (+ evidence link), set verification, add claim, click-to-cycle matrix scores, submit for approval (assigns reviewer / legal / leadership; members validated), approve / request changes (only assigned approver or owner/admin; stages cannot be skipped), send reminder (1 per stage per 24h), make primary, archive |
| Plans | New plan, add milestone/task, assign owner (multi), add dependency (circular chains rejected in app **and** DB trigger), log risk, risk status, plan status transitions, item reschedule/update/complete/block/remove, Gantt: expand/collapse, Days/Weeks/Months, zoom ±, full screen, today marker; Cards / Table / Calendar |
| Forecasts | New forecast (user-entered target + scenario totals; rolls back fully on any failure), add scenario (probabilities must total exactly 100% — live total shown), edit assumptions (before/after logged), refresh model (recomputes scenario totals from periods, rate-limited), archive; Charts / Table / Scenarios |

**End-to-end run in Chrome (Brand demo, owner):** empty submit → field error "Objective name is required." → valid create → dialog closed, row visible, KPI 18→19, `OBJ-20` assigned → export CSV with the row's `=HYPERLINK(...)` target neutralised to `'=HYPERLINK` → archive via menu (menu offered only transitions valid from `not_started`) → archived view → Delete permanently → row gone. DB trail: `created objective, archived objective, deleted objective`; 3 `audit_logs` rows.

## 4. Filters, search, sorting, views

URL-driven everywhere (`useQueryPatch`): shareable, refresh-safe, back/forward-safe; changing any filter resets pagination. Search is debounced and replaces history entries. Date ranges: presets + validated custom range. Priority sort is semantic and now sorts the **whole filtered set before paging** (bug found and fixed — previously each page was sorted independently). Stable secondary ordering by `id` prevents duplicates/skips across pages.

## 5. Data sources & Supabase

Tables: `strategy_records, _objectives, _audiences, _audience_personas, _audience_regions, _audience_metrics, _research_collections, _research_items, _research_findings, _positioning_frameworks, _positioning_pillars, _proof_points, _claims, _competitors, _competitor_attributes, _competitor_scores, _messaging_assets, _plans, _plan_items, _plan_dependencies, _plan_risks, _plan_capacity, _forecasts, _forecast_scenarios, _forecast_periods, _forecast_assumptions, _links, _approvals, _activity, _health_snapshots`, plus new `strategy_actions, strategy_insights, strategy_kpi_snapshots, strategy_saved_views, strategy_comments`; `audit_logs`, `notifications`, `integrations`, `workspace_members`.

KPI "vs last month / quarter" deltas are real: each page merges live metrics into `strategy_kpi_snapshots` for the current month (throttled, skipped for read-only roles) and compares with frozen prior months.

No N+1: links, personas, regions, objective references and owners are resolved in batched queries per page.

## 6. Migrations applied (Management API, all idempotent)

| File | Purpose |
|---|---|
| `20260916100000_strategy_release.sql` | Demo markers, objective refs + completion stamps, forecast refresh cadence, actions/insights/KPI snapshots/saved views tables, role-aware RLS on all 33 tables, append-only activity, private `strategy-research` bucket + storage policies |
| `20260916100100_strategy_release_fields.sql` | Plan priority/target, research method, comments table + RLS, cross-workspace link guard trigger, plan dependency workspace + cycle guard trigger |
| `20260916100200_strategy_demo_seed.sql` | `strategy_seed_demo(ws)` for Business, Brand, Agency demo workspaces (skips if already seeded) |
| `20260916100300_strategy_demo_dates.sql` | Restores realistic `updated_at` on demo research (first seed run's follow-up UPDATE fired triggers) |
| `20260916100400_strategy_rls_roles.sql` | **Security fix:** DB writes limited to owner/admin/manager to match the app (`member` → view-only); storage insert/delete policies aligned |

Demo data: 10 strategies, 19 objectives (1 archived), 42 audiences with personas/regions/metrics, 142 research items, 5 frameworks with pillars/proof/claims/matrix/assets/5-stage approval, 12 plans with items/milestones/dependencies/risks/capacity, 3 forecasts × 3 scenarios × 12 months, next actions, insights, 6 months of KPI history, activity trail. All top-level rows `is_demo = true`; dates relative to the seed date; owners are real teammates; brand names fictional.

## 7. RLS / security — `node scripts/verify-strategy-rls.mjs` (23/23 pass)

Runs real SQL as each user in rolled-back transactions: owner/manager/member/viewer read own workspace; viewer reads 0 rows of another workspace; Brand admin sees no Agency research; owner/admin/manager create; **member and viewer create denied**; Brand admin cannot write into Agency; viewer update and member delete affect 0 rows; activity log is append-only (owner deletes 0); cross-workspace link rejected; circular dependency rejected; saved views private (cannot spoof `user_id`); manager uploads only inside own workspace folder; viewer upload denied; bucket private.

Other controls: every server action re-checks session, module entitlement, capability and record ownership; input validation (length, enums, real calendar dates, money, UUIDs, tags); DB error codes mapped to safe copy; export is permission-gated, rate-limited (30/h), audited, CSV formula-injection safe, aggregated-only for audiences; imports rate-limited (10/h); uploads rate-limited (40/h) with magic-byte validation; approval reminders limited to one per stage per 24h.

## 8. Tests run

| Suite | Result |
|---|---|
| `npx vitest run src/lib/strategy/strategy.test.ts` | **24 / 24** (ranges, deltas, health score, budget alignment, fit bands, competitor gaps, scenario probabilities, cumulative + quarter roll-up, dependency cycles, Gantt window, validation, CSV parse/escape, file signatures, UK formatting, entitlements, role capabilities, status transitions, routes) |
| `src/lib/navigation` tests | pass (38) |
| `node scripts/verify-strategy.mjs` | **13 / 13** (7 routes + 4 alternate views, unauthenticated redirect, legacy redirect) |
| `node scripts/verify-strategy-rls.mjs` | **23 / 23** |
| `npx tsc --noEmit` (Strategy files) | 0 errors |
| `npx eslint` (all Strategy folders) | 0 errors, 0 warnings |

## 9. Bugs found and fixed during this pass

1. Chart `ResizeObserver` created a new ref callback every render → resize/re-render loop that froze the browser tab. Rewritten to observe once after mount with a 2px tolerance.
2. Server → client chart props passed a function (RSC error, page crashed). Charts now take a serialisable `currency` / `valueFormat`.
3. `workspace_members → profiles` embed was ambiguous (two FKs), so **every owner picker and owner filter was silently empty**. Fixed with the explicit relationship and error logging.
4. Database allowed `member` writes the app forbids — closed by migration `…100400`.
5. Priority sort only sorted within the current page.
6. Demo research all showed "Updated today" (trigger side effect in seed).
7. Hydration-unsafe search sync (`setState` in effect) replaced with render-time adjustment.
8. Stale `/app/strategy/*` pages referenced removed server helpers — replaced with a canonical redirect.
9. Gantt tick labels collided on long spans; donut legend clipped at tablet width; several filters truncated at desktop density.

## 10. Cross-section effects checked

Activity feed rows are human-readable and link to the originating tab; `audit_logs` rows carry actor, workspace, record, action, surface; research review decisions and approval requests/reminders create in-app `notifications` for the right user; KPI snapshots update after mutations (`revalidatePath('/[workspaceType]/strategy', 'layout')` refreshes all tabs).

## 11. Remaining to reach 100 / 100

| # | Item | Why not done |
|---|---|---|
| 1 | Automated Playwright E2E + visual-regression suite committed to CI | Browser flows were exercised manually through Chrome DevTools MCP this session; no Playwright harness exists in the repo yet |
| 2 | Gantt drag-to-reschedule | Rescheduling works through the item dialog (validated, audited); direct drag is not built |
| 3 | Email delivery for approvals / research review | Only in-app notifications are sent. Needs the workspace SMTP/Resend decision (see user-fixes) |
| 4 | CRM segment sync | HubSpot/Salesforce integrations are "coming soon" in the catalogue; the button is honest about it |
| 5 | Fox AI Copilot actions for Strategy | Not wired in this pass (Copilot is audited separately) |
| 6 | True 375px phone + installed-PWA capture | This Chrome instance cannot shrink below 500px; the ≤640px layout was verified at 500px |
| 7 | Stress test at 10k+ records per table | Large-data paths are bounded (1000-row semantic sort cap, 5000-row export cap) but not load-tested |
