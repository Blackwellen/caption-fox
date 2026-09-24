# Campaign Manager → Strategy — Release Evidence

| | |
|---|---|
| Section | Campaign Manager → Strategy (Overview + 6 sub-tabs) |
| Canonical routes | `/{business,brand,agency}/strategy` · `/objectives` · `/audiences` · `/research` · `/positioning` · `/plans` · `/forecasts` |
| Legacy routes | `/app/strategy/*` → 307 to the canonical route (sub-path + query preserved) |
| Workspace types | Business, Brand, Agency. Creator: hidden from nav and 404 by URL |
| Plan / flag gates | Positioning & Plans: Team+. Forecasts: Team+ for Brand/Agency, Brand+ for Business, plus flag `strategy_forecasts` |
| Roles tested | Owner, Admin, Manager, Member, Viewer (RLS + app capabilities) |
| Date | 2026-09-16, revised 2026-09-25 |
| Release score | **98 / 100** — see "Remaining to reach 100" |
| Decision | **Ready for release** |

---

## 1. Screen sizes & evidence

Every route was captured and measured at 5 widths this pass (390, 768, 1024, 1280, 1440), plus the 1491×949 design viewport from the earlier pass. Measurement was automated, not eyeballed: an in-page script checks `document.documentElement.scrollWidth` against the viewport, flags any interactive control under 24×24px (32px minimum height off desktop), flags any KPI label that clips (`scrollWidth > clientWidth`), and confirms the tab strip renders as 7 inline links at ≥768px and collapses to a single dropdown below that.

| Size | Result |
|---|---|
| 1491×949 (design viewport) | Unchanged from the 2026-09-16 pass — all 7 routes match `designs/Universal Sections/Strategy/*` |
| 1440 / 1280 / 1024 (desktop) | **21/21 automated checks clean** across all 7 routes × 3 widths: no horizontal scroll, no clipped/overflowing element outside an intentional scroll region (data tables, the Gantt chart, the differentiation matrix), no clipped KPI label, all 7 tabs visible inline |
| 768 (tablet) | Sliding dropdown-style tab selector engages exactly at the mobile breakpoint (see 390 below is where it actually switches — at 768 the 7 tabs still fit inline); 3-col KPI grid; filter bars wrap to a second row rather than overflow; **0 undersized touch targets** |
| 390 (real phone width — iPhone 12/13/14 class, `isMobile: true, hasTouch: true`) | Tab strip collapses to one dropdown button; KPI cards stack 1-up; **0 horizontal scroll, 0 undersized touch targets** on any of the 7 routes |

Screenshots: `release-gated/docs/strategy/evidence/{page}-{width}.jpeg` for all 7 pages × {390, 1280} plus `overview-1440.jpeg`, `overview-768.jpeg`. Earlier full-page captures remain in `docs/ui-verification/caption-fox/strategy/`.

**Visual fidelity:** layout, grid proportions, card sizes, type scale, colours and component placement match each design. Known, intentional differences:
- The app shell (sidebar, top bar) is design-locked (`SIDEBAR_NAVIGATION_LOCK.md`), so the content column is narrower than the raw design images; internal grids use fractional columns so proportions hold.
- Values differ from the images because every figure is live workspace data.
- The Positioning "All markets" filter and Research "+ Add tag" control from the design images, called out as *not built* in the 2026-09-16 pass, **are now built** (see §2 and §9) — they are no longer a known gap.

## 2. Routes, navigation & registration

- Navigation register (`src/lib/navigation/resolver.ts`) points Strategy and "Leads & Audiences" at the canonical typed routes; resolver tests pass.
- Sidebar unchanged apart from those hrefs (standing rule).
- Breadcrumb: Home › Campaign Manager › Strategy › {tab}. H1, `<title>`, tab label and breadcrumb agree on every page. Breadcrumb links now meet the 36px+ touch-target minimum below desktop (previously 17px).
- Tabs derive active state from the URL: deep links, hard refresh and back/forward verified. Hidden modules are not rendered at all.
- `getStrategyPageContext` resolves auth → workspace → type → plan → role → flags **before** any read; an unentitled module 404s.
- Error boundary `src/app/[workspaceType]/strategy/error.tsx` shows a digest reference only.

## 3. Buttons, actions & flows tested

| Page | Actions tested this pass |
|---|---|
| Overview | Next-action checkbox (40px touch target below desktop, was 24px), donut legend links (44px+ tall row now, was 18px), Priority-initiatives row link and menu (40px), "View all" (40px) |
| Objectives | Card title link (full-height row, was 20px), donut legend link (44px+ row, was 18px) |
| Audiences | "Linked objectives" count link, top-country links, channel-affinity links (all now 44px+ tall rows, were 17–18px); **view switcher (Cards/Table/Map/Compare) no longer overflows into the hidden scroll region at 1280px** — icon-only + tooltip below the 2xl breakpoint |
| Research | "View all collections", linked-objective refs, method-mix legend links (all 40–44px+, were 17–18px); **"+ Add tag" is now a working control** (see §9) |
| Positioning | "Edit framework →", target-audience link (both 40px+, were 17px); **"All markets" filter is now a working control** (see §9) |
| Plans | No undersized controls found this pass |
| Forecasts | "View full forecast table →" (40px+, was 17px); **fixed overlap** between the "Expected case" scenario name and its "Most likely" badge at 1280px width |

All previously-documented actions (create/edit dialogs, status transitions, CSV import/export, Gantt controls, approval workflow, etc.) were re-verified functional; no regressions from the responsive fixes.

## 4. Filters, search, sorting, views

URL-driven everywhere (`useQueryPatch`). No change to filter logic this pass — only touch-target and overflow fixes to the controls themselves. The Positioning filter bar now includes **Market** (`param=market`) alongside Framework/Audience/Status, wrapping to a second row at narrow desktop widths rather than clipping.

## 5. Data sources & Supabase

Same 33+ `strategy_*` tables as the 2026-09-16 pass, plus `strategy_positioning_frameworks.market` (new, this pass — see §6). No new N+1s introduced by the responsive or feature work; the market filter is a single indexed `eq()` clause.

## 6. Migrations applied (Management API, all idempotent)

| File | Purpose |
|---|---|
| `20260916100000_strategy_release.sql` … `20260916100600_strategy_ai_usage.sql` | Unchanged from the 2026-09-16 pass |
| `20260918000000_strategy_framework_market.sql` | **New.** Adds nullable `market` to `strategy_positioning_frameworks` with a check constraint (uk, ireland, europe, north_america, apac, middle_east, latam, africa, global) and a partial index; seeds a market on existing **demo-workspace-only** frameworks (matched by `workspaces.slug like '%-demo'`) so the new filter has real data to match. Real customer rows are untouched. |
| `20260925000000_strategy_rls_read_perf.sql` | **New.** Adds `strategy_member_workspaces()` (STABLE, SECURITY DEFINER, execute revoked from `anon`) and re-points the 34 workspace-member read policies from the per-row `is_workspace_member(workspace_id)` call to a once-per-statement lookup. **Same access rule** (any workspace member can read); only how often the check runs changes. Found by the load test (section 12). Rollback SQL is in the migration header. |

## 7. RLS / security

Two suites now run, both against the live database in transactions that are always rolled back:

- **`node scripts/verify-strategy-rls.mjs` — 23/23 pass** (unchanged from 2026-09-16: role reads/writes, cross-workspace isolation, append-only activity, cross-workspace link/cycle rejection, private saved views, storage scoping, private bucket).
- **`node scripts/verify-strategy-rls-sweep.mjs` — 694/694 pass (new this pass).** A generated, table-by-table sweep covering all 36 `strategy_*` tables, run as batched `plpgsql` loops (not one API call per table, to stay under the Management API's rate limit):
  1. RLS is enabled on every table, and every policy is scoped by `workspace_id`/`auth.uid()`/`strategy_can_write()` — none is an open `using (true)`.
  2. `anon` (unauthenticated) reads 0 rows from every table.
  3. A Brand-only viewer and a Brand-only admin read 0 rows scoped to the Agency workspace, on all 36 tables.
  4. View-only roles (member, viewer) cannot delete a row in their own workspace, on all 36 tables.
  5. A Brand admin cannot delete a row in the Agency workspace, on all 36 tables.
  6. View-only roles cannot update a row in their own workspace (workspace_id round-trip probe), on all 36 tables.
  7. Positive: an owner **and** a view-only viewer can both read their own workspace's core tables (proves RLS isn't accidentally blocking legitimate reads).
  7b. A user who legitimately belongs to *both* Brand and Agency (Liam Chen) can read Agency rows there, but is still view-only there too — proving the isolation checks above aren't just "no membership → no access" but "wrong role → no write, right role + right workspace → read/write as expected."
  8. Release-specific: the new `market` check constraint rejects an invalid value and accepts a valid one; a member cannot change a framework's market (role check, not just the constraint).
  9. The `strategy_can_write()` SQL function is not directly executable by `anon`.

Total: **717/717 RLS checks pass** across both suites. Both were **re-run after the 2026-09-25 read-policy change** and still pass, so the performance fix did not loosen isolation.

## 8. Tests run

| Suite | Result |
|---|---|
| `npx vitest run src/lib/strategy src/lib/navigation` | **97 / 97** (adds notify 8, HubSpot 14, Fox AI render helpers 6) |
| `node scripts/load-test-strategy.mjs 12000` | **41 / 41 within budget** (new, section 12) |
| `node scripts/verify-strategy.mjs` | 13 / 13 (routes + redirects) |
| `node scripts/verify-strategy-rls.mjs` | **23 / 23** |
| `node scripts/verify-strategy-rls-sweep.mjs` | **694 / 694** (new) |
| `npx tsc --noEmit` (whole repo) | 0 errors in any Strategy file |
| `npx eslint` (Strategy folders, AI route, load-test script) | 0 errors, 0 warnings |
| Responsive automated audit | 390/768/1024/1280/1440 × 7 pages: 0 horizontal-scroll, 0 undersized-target, 0 clipped-KPI failures |

## 9. Bugs found and fixed during this pass

1. **Positioning "All markets" filter didn't exist** (flagged as a known gap on 2026-09-16). Built for real: a `market` column with a check constraint, wired through the query layer, both framework dialogs, and the filter bar; verified end to end (filtering to "United Kingdom" returns exactly the matching frameworks; an empty market shows the correct empty state).
2. **Research "+ Add tag" didn't exist** (same 2026-09-16 gap). Built for real: a dialog that applies a tag to selected research items via the existing `setResearchTags` server action (permission-checked, audit-logged); verified end to end (tag applied, persists after reload, appears in the tag filter bar).
3. **13 interactive controls were under the 24×24px / 32px touch-target minimum** across Overview, Objectives, Audiences, Research, Positioning and Forecasts (breadcrumb links, donut/legend links, card title links, "View all" links, the Overview next-action checkbox). All now meet the minimum below desktop while keeping the original dense desktop sizing (`lg:` overrides unchanged).
4. **Audiences view switcher (Cards/Table/Map/Compare) overflowed into a hidden horizontal-scroll region at 1280px**, silently hiding "Compare". Fixed with an icon-only + tooltip mode below the 2xl breakpoint, applied only to this switcher (other pages' switchers were unaffected and left as-is).
5. **KPI card labels clipped at 1280–1399px** on all 7 pages (the strip forced 6 columns as soon as `xl` (1280px) hit, leaving ~155px per card). Changed the 6-column breakpoint to 1400px so the layout matches the design's 1491px viewport, and stays 3-across (readable) between 1024–1399px; added a `title` attribute as a fallback for any remaining long label.
6. **Forecasts: "Expected case" scenario name overlapped its "Most likely" badge** at 1280px. Reserved space for the absolute-positioned badge and truncated the name instead of letting it run underneath.

7. **Read policies re-ran a SECURITY DEFINER function once per row scanned** (found by the 12k-row load test). Unindexed sorts and KPI aggregates cost about 180 ms at 12k rows and about 930 ms at 60k plan items. Fixed by migration `20260925000000` (section 6): 180 ms to about 5 ms and 930 ms to 25 ms, with isolation re-proven (section 7).
8. **Latent bug in the Strategy AI route:** the audit row's `metadata.surface` referenced the JavaScript global `module` instead of the page, so the surface was logged as an object. It now records the Strategy area (lint flagged it: `no-assign-module-variable`).

## 10. Cross-section effects checked

Unchanged from 2026-09-16; re-verified no regression: activity feed rows link to the originating tab; audit logs carry actor/workspace/record/action/surface; KPI snapshots update after mutations; `revalidatePath` refreshes all tabs after a write.

## 11. Items closed this pass (2026-09-25)

### Gantt drag-to-reschedule — built (the previous version of this doc was stale), now verified end to end
- Bars are `role="slider"`: drag the body to move, drag either edge to resize; ← → move one day, Shift+← → the end date, Alt+← → the start date. Commit happens once on release; failures snap back and show the reason.
- **Keyboard (verified live):** "Discovery — Wave 2" 12 Jul → 13 Jul; the database row and the Recent-activity feed ("moved task … Just now") updated.
- **Real pointer drag (verified live, Chrome DevTools `drag`):** the bar moved +23 days keeping its duration and persisted. The row was then restored to its original dates.
- **Dependency rule (verified live):** moving the "Gen Z Market Expansion" plan (it depends on "Revenue Growth Program", which ends 24 Sept) was **rejected by the server**, snapped back, and toasted: "…depends on … which ends 2026-09-24. Start on or after that date." Database unchanged.

### Approval / review emails — built and tested; dormant until you supply a sender
- `notifyStrategy` (src/lib/strategy/notify.ts) writes the in-app row **and** sends an email through Resend when the workspace has its own `RESEND_API_KEY` and `MESSAGING_EMAIL_FROM`, the recipient has not opted out (Account Settings → Notifications, including the legacy preference), the recipient has an address, and the workspace is not a demo. It never throws; a failure leaves the in-app row and the approval intact.
- **8 unit tests with a mocked provider:** payload, headers and idempotency key; HTML-escaped title and body; deep link; self/no recipient; per-channel and legacy opt-outs; demo by slug and by setting; missing key / sender / address; provider 422 and timeout; no address or key in logs; in-app failure does not block the email.
- **Not verified against real Resend:** no key is configured here on purpose (the workspace supplies its own). Steps: `release-gated/user-fixes/strategy.md` §1.

### CRM sync — HubSpot built and tested; Salesforce is not built
- Workspace owners/admins connect HubSpot with **their own private-app token** (verified against HubSpot, scope-checked, encrypted at rest, masked tail shown, 5 attempts/hour). "Sync CRM" imports list names and sizes only (never contacts), pages up to 500 lists, is rate limited (6/hour), audited, and re-syncs update in place.
- **14 unit tests with a mocked HubSpot:** token shape; list mapping edge cases; 401/403/429/500/unreachable messages (the token is never echoed); paging; stuck-offset guard; 500-list cap and truncation flag; growth-rate clamp.
- **Not verified against a real HubSpot account** (needs your token). **Salesforce is not implemented** and nothing in Strategy claims otherwise.

### Fox AI in Strategy — built, verified against the real model
- Every page's **More actions → "Ask Fox AI about …"** opens one shared dialog (no change to the approved page headers). Read-only, module-aware starter questions, 600-character limit, Enter to send, stops on close, plan / limit / upgrade / offline states, no chat persistence.
- Server (`/api/strategy/ai`): auth, workspace and module entitlement, plan gate (Team+), per-user and per-workspace limits, grounded only in records the caller's RLS client can read, citation tags mapped to server-built same-origin links, audit row and `ai_usage_logs`.
- **Verified live (Azure):** Objectives, "off track or at risk?" returned 5 objectives, each citing a record that opens; Plans, "behind schedule?" returned 7 plans with status and progress and working links; the remaining allowance decremented (60 to 59). The blocked (plan) state shows the message and "See plans" pointing at `/app/settings?tab=billing` with the input disabled; a 429 shows the limit message inline. 6 unit tests cover the render helpers (citation parsing, safe-link filter, module detection).
- Evidence: `evidence/fox-ai-1280.jpeg`, `evidence/fox-ai-390.jpeg`. The close button of the shared dialog is 36 px on mobile (design-system component, left as is).

## 12. Load test at 10k+ rows per table

`node scripts/load-test-strategy.mjs 12000` runs in one transaction that is always rolled back, in the Brand workspace: **12,000 rows in each of objectives, audiences, research, frameworks, plans and forecasts; 60,000 plan items; 60,000 activity rows.** Queries run as the real `authenticated` owner so RLS executes, using the exact query shapes in `data.ts`. Best of 3, database time, against budgets (page 100 ms, deep page 150, filter 150, search 400, count 150, KPI aggregate 200).

| | Before migration | After migration |
|---|---|---|
| Within budget | 28 / 41 | **41 / 41** |
| Unindexed-sort first page (audiences, research, frameworks, forecasts) | ~180 ms | ~6 ms |
| Deep page (offset 9,600) | ~185 ms | 8-12 ms |
| KPI count by status | ~180 ms | ~4.5 ms |
| Plan-item KPI aggregate (60k rows) | 928 ms | 25 ms |
| Search `%term%` across text columns (no trigram index) | 210-226 ms | 32-45 ms |
| Exact counts (11.4k to 60k rows) | not separately shown | 3-12 ms |

Search is a sequential scan: well inside budget at this size, and the first thing to index (trigram) if one workspace grows past roughly 100k rows per table. Not tested: many simultaneous users, and browser render time.

## 13. Remaining to reach 100 / 100 (currently 98 / 100)

| # | Item | Why not done |
|---|---|---|
| 1 | Automated Playwright E2E and visual-regression suite committed to CI | Flows and responsive states were exercised through Chrome DevTools MCP with real viewport emulation; no Playwright harness exists in the repo yet |
| 2 | Physical iOS/Android device pass | No device available here. Verified with DevTools device emulation (`isMobile`, `hasTouch`, DPR 2, 390x844). A ready-to-run checklist is in `user-fixes/strategy.md` §8 |
| 3 | Live check of email delivery and HubSpot sync | Both need **your** credentials by design; both are covered by mocked-provider tests and the user-fixes steps |

Salesforce is out of scope (not built, not advertised in Strategy).
