# Campaign Manager → Campaigns — Implementation Tracker

Canonical routes are now **type-first**: `/{type}/campaigns/…` where `{type}` is the
active workspace kind (`creator` | `business` | `brand` | `agency`), matching the
Calendar / Advertising / Brand modules. The legacy `/app/campaigns/…` URLs redirect
to the canonical route for the active workspace (path + query preserved).

Reference designs: `designs/Universal Sections/Campaigns/*.png` (1491 × 1055).
Screenshots: `docs/ui-verification/caption-fox/campaigns/`.

## Routes

| ID | Route | Page/View | Reference | Shell | Visual match | Real data | Search | Filters | Sorting | Cards | Table | Board | Timeline | CRUD | Import | Export | Permissions | Activity | Loading | Empty | Error | Responsive | Chrome MCP | Screenshot compared | Automated tests | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 5.03.01 | `/{type}/campaigns` | Overview | (1) | ✅ shared shell | ✅ geometry matched | ✅ Supabase | n/a | ✅ | n/a | ✅ | ✅ | — | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ 1491/820/390 | ✅ | ✅ | ✅ nav tests | Passed | KPI 88px, tabs 11px/28px, panel grid ratios from design; budget chart grouping + period are real URL state |
| 5.03.02 | `/{type}/campaigns/all` | All | (2) | ✅ | ✅ 4-up card grid | ✅ | ✅ debounced | ✅ full set | ✅ 8 sorts | ✅ | ✅ | — | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Passed | Bulk actions, pagination, workload panel |
| 5.03.03 | `/{type}/campaigns/giveaways` | Giveaways | (3) | ✅ | ✅ banner cards | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | ✅ wizard | ✅ entries CSV | ✅ | ✅ Creator Pro+ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Passed | Winner review queue + prize fulfilment donut |
| 5.03.04 | `/{type}/campaigns/competitions` | Competitions | (4) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | ✅ wizard | ✅ submissions CSV | ✅ | ✅ Team+, business/brand/agency only | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Passed | Creator workspace: tab hidden AND direct URL blocked (verified) |
| 5.03.05 | `/{type}/campaigns/templates` | Templates | (5) | ✅ | ✅ 5-up grid | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | ✅ | ✅ | ✅ | ✅ Team+ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Passed | Publish/review state machine, create-campaign-from-template |
| 5.03.06 | `/{type}/campaigns/board` | Board | (6) | ✅ | ✅ 194px columns | ✅ | ✅ | ✅ | n/a | ✅ | ✅ | ✅ | — | ✅ | — | ✅ | ✅ Creator Pro+ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Passed | Pointer drag + keyboard "move to stage", server-validated transitions |
| 5.03.07 | `/{type}/campaigns/timeline` | Timeline | (7) | ✅ | ✅ 66px rows, 27px/day | ✅ | ✅ | ✅ | n/a | ✅ | ✅ | — | ✅ | ✅ milestones | — | ✅ | ✅ Team+ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Passed | Left column now carries thumb, owner, stage badge, progress (per design) |

## This pass

1. **Route port** — pages moved from `src/app/app/campaigns/**` to
   `src/app/[workspaceType]/campaigns/**`; new layout gates the module
   (`requireWorkspaceModule('campaigns')`) and provides the shell gutter + toasts.
   `resolver.ts` marks campaigns as a type-first implementation. Server actions and
   the CSV export route stay at `src/app/app/campaigns/` (imports unchanged).
2. **Type-aware links** — `lib/campaigns/paths.ts` (`campaignsBaseFor`) for server
   pages (`session.base`), `components/campaigns/links.tsx`
   (`useCampaignsBase` / `CampaignLink`) for client components. Activity rows store
   canonical links. Mutations revalidate `/[workspaceType]/campaigns` as a layout.
3. **Legacy redirect** — `src/app/app/campaigns/[[...rest]]/page.tsx`.
4. **Visual pass to the designs** — dense sizes applied behind `lg:` so tablet and
   phone keep legible type and ≥32px touch targets (see measurements below).

## Measured geometry (design → implementation, 1491 × 1055)

| Element | Design | Before | After |
|---|---|---|---|
| H1 | 19px | 26px | 19px |
| Subtitle | 11px | 14px | 11px |
| Tabs | 11px / 28px tall | 13px / 32px | 11px / 28px |
| KPI label / value / hint | 9.5 / 17 / 8.5px | 12 / 22 / 11px | 9.5 / 17 / 8.5px |
| KPI strip height | 88px | 92px | 87px |
| Filter row | 30px tall, y=317 | 36px, y=302 | 30px, y=320 |
| First panel top / height | 362 / 248px | 396 / 290px | 365 / 277px |
| Panel titles | 10.5px | 13px | 10.5px |

Content column starts at x=260 vs the design's x=236 because the locked app shell's
sidebar is 264px wide against the design mock's 204px — the shell is design-locked
(`APP_SHELL_DESIGN_LOCK.md`), so page content matches inside the real shell width.

## Final verification (this pass)

- `npx tsc --noEmit -p .` — clean for `src/lib/campaigns`, `src/components/campaigns`,
  `src/app/[workspaceType]/campaigns`. (Pre-existing, unrelated errors remain in
  `src/lib/brand-assets/queries.ts` and `src/lib/marketplace/data.ts`.)
- `npx vitest run` — 18 files, 244 tests passed, including the new
  `src/lib/campaigns/campaigns.test.ts` (16 tests).
- Chrome MCP: all seven routes plus a campaign detail page rendered at 1491x1055; tablet
  (820) and mobile (390, touch) checked for overflow and touch targets; legacy
  `/app/campaigns/...` redirect verified with query preserved; creator-workspace gating
  verified both in nav and by direct URL.
- No Campaigns-related console errors.

## Additional defects found and fixed while verifying

| # | Defect | Fix |
|---|---|---|
| 1 | `demo-workspaces.ts` re-seeded the workspace on **every page view** (`maybeSingle()` throws on duplicate names, so the guard failed open) — ~1,975 junk campaigns accumulated | every lookup now `.limit(1).maybeSingle()` |
| 2 | Giveaway/competition aggregates read only the first 1,000 child rows (PostgREST max-rows); approval rate showed **0%** at real volume | status distributions are now exact per-status counts; trends page in 1,000-row batches |
| 3 | Board dumped `in_progress` + `blocked` into **At risk** (10 shown, 3 real) | explicit `BOARD_COLUMN_FOR` map; KPI row counts the same buckets as the columns |
| 4 | Board/Timeline shipped hardcoded KPI deltas ("14% vs last 30 days") | replaced with values derived from live data |
| 5 | Timeline "Milestones due" capped at 6 by a display query limit | real count for the next 7 days |
| 6 | Timeline plotted long-finished campaigns as full-width bars, hiding live work | only campaigns intersecting the visible window are plotted, with an empty state |
| 7 | A scripted dense-type pass double-applied, rendering card text at 8px instead of 10px | 27 duplicated `lg:text-` classes removed |

## Environment note

The machine ran out of disk during verification (`ENOSPC` while writing
`tsconfig.tsbuildinfo`), which killed the dev server once. Removing the stale `.next-build`
output recovered space (3.6 GB free at the end) and the server was restarted on port 3004.
Keep an eye on free space before a production `next build`.
