# Campaign Manager → Strategy — Release Evidence

| | |
|---|---|
| Section | Campaign Manager → Strategy (Overview + 6 sub-tabs) |
| Canonical routes | `/{business,brand,agency}/strategy` · `/objectives` · `/audiences` · `/research` · `/positioning` · `/plans` · `/forecasts` |
| Legacy routes | `/app/strategy/*` → 307 to the canonical route (sub-path + query preserved) |
| Workspace types | Business, Brand, Agency. Creator: hidden from nav and 404 by URL |
| Plan / flag gates | Positioning & Plans: Team+. Forecasts: Team+ for Brand/Agency, Brand+ for Business, plus flag `strategy_forecasts` |
| Roles tested | Owner, Admin, Manager, Member, Viewer (RLS + app capabilities) |
| Date | 2026-09-16, revised 2026-09-24 |
| Release score | **97 / 100** — see "Remaining to reach 100" |
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

Total: **717/717 RLS checks pass** across both suites.

## 8. Tests run

| Suite | Result |
|---|---|
| `npx vitest run src/lib/strategy src/lib/navigation` | **69 / 69** |
| `node scripts/verify-strategy.mjs` | 13 / 13 (routes + redirects) |
| `node scripts/verify-strategy-rls.mjs` | **23 / 23** |
| `node scripts/verify-strategy-rls-sweep.mjs` | **694 / 694** (new) |
| `npx tsc --noEmit` (whole repo) | 0 errors in any Strategy file |
| `npx eslint` (all Strategy folders) | 0 errors, 0 warnings |
| Responsive automated audit | 390/768/1024/1280/1440 × 7 pages: 0 horizontal-scroll, 0 undersized-target, 0 clipped-KPI failures |

## 9. Bugs found and fixed during this pass

1. **Positioning "All markets" filter didn't exist** (flagged as a known gap on 2026-09-16). Built for real: a `market` column with a check constraint, wired through the query layer, both framework dialogs, and the filter bar; verified end to end (filtering to "United Kingdom" returns exactly the matching frameworks; an empty market shows the correct empty state).
2. **Research "+ Add tag" didn't exist** (same 2026-09-16 gap). Built for real: a dialog that applies a tag to selected research items via the existing `setResearchTags` server action (permission-checked, audit-logged); verified end to end (tag applied, persists after reload, appears in the tag filter bar).
3. **13 interactive controls were under the 24×24px / 32px touch-target minimum** across Overview, Objectives, Audiences, Research, Positioning and Forecasts (breadcrumb links, donut/legend links, card title links, "View all" links, the Overview next-action checkbox). All now meet the minimum below desktop while keeping the original dense desktop sizing (`lg:` overrides unchanged).
4. **Audiences view switcher (Cards/Table/Map/Compare) overflowed into a hidden horizontal-scroll region at 1280px**, silently hiding "Compare". Fixed with an icon-only + tooltip mode below the 2xl breakpoint, applied only to this switcher (other pages' switchers were unaffected and left as-is).
5. **KPI card labels clipped at 1280–1399px** on all 7 pages (the strip forced 6 columns as soon as `xl` (1280px) hit, leaving ~155px per card). Changed the 6-column breakpoint to 1400px so the layout matches the design's 1491px viewport, and stays 3-across (readable) between 1024–1399px; added a `title` attribute as a fallback for any remaining long label.
6. **Forecasts: "Expected case" scenario name overlapped its "Most likely" badge** at 1280px. Reserved space for the absolute-positioned badge and truncated the name instead of letting it run underneath.

## 10. Cross-section effects checked

Unchanged from 2026-09-16; re-verified no regression: activity feed rows link to the originating tab; audit logs carry actor/workspace/record/action/surface; KPI snapshots update after mutations; `revalidatePath` refreshes all tabs after a write.

## 11. Remaining to reach 100 / 100

| # | Item | Why not done |
|---|---|---|
| 1 | Automated Playwright E2E + visual-regression suite committed to CI | Flows and responsive states were exercised manually through Chrome DevTools MCP (real viewport emulation, not just breakpoint math) this session; no Playwright harness exists in the repo yet |
| 2 | Gantt drag-to-reschedule | Rescheduling works through the item dialog (validated, audited); direct drag is not built |
| 3 | Email delivery for approvals / research review | Only in-app notifications are sent — see `release-gated/user-fixes/strategy.md` |
| 4 | CRM segment sync | HubSpot/Salesforce integrations are "coming soon"; the button is honest about it |
| 5 | Fox AI Copilot actions for Strategy | Not wired in this pass (Copilot is audited separately) |
| 6 | Real device testing (physical iOS/Android) | Verified with Chrome DevTools' real-device emulation (`isMobile`, `hasTouch`, 390×844 = iPhone 12/13/14 class) at full viewport width, not a shrunk desktop browser window; a physical device was not available in this environment |
| 7 | Stress test at 10k+ records per table | Large-data paths are bounded (1000-row semantic sort cap, 5000-row export cap) but not load-tested |
