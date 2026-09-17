# Campaign Manager → Campaigns — Release Evidence

**Section:** Campaigns (7 surfaces)
**Canonical routes (this pass):** `/{type}/campaigns`, `/all`, `/giveaways`, `/competitions`,
`/templates`, `/board`, `/timeline` — where `{type}` is `creator | business | brand | agency`.
Legacy `/app/campaigns/…` URLs redirect to the canonical route (path + query preserved).

**Reference designs:** `designs/Universal Sections/Campaigns/*.png` (1491 × 1055, seven images).
**Screenshots:** `docs/ui-verification/caption-fox/campaigns/{overview,all,giveaways,competitions,templates,board,timeline}-{reference,implementation}.png`

---

## 1. Screen sizes tested (Chrome MCP)

| Viewport | Result |
|---|---|
| 1491 × 1055 (design reference) | Matches design geometry — see section 3 |
| 820 × 1100 (tablet) | No horizontal overflow; base type (22px H1) and 32px touch targets retained |
| 390 × 844 (mobile, DPR 3, touch) | No horizontal overflow; KPI strip 2-up; tabs scroll horizontally; 32px targets |

Dense sizes are applied behind `lg:` only, so tablet and phone keep legible type — per the
project's responsive rule.

## 2. Routes tested

| Route | Result |
|---|---|
| `/brand/campaigns` | 200, live data, all seven tabs |
| `/brand/campaigns/all` | 200, search / filter / sort / paginate |
| `/brand/campaigns/giveaways` | 200, cards + winner review queue |
| `/brand/campaigns/competitions` | 200, cards + judging distribution |
| `/brand/campaigns/templates` | 200, 5-up grid + approval queue |
| `/brand/campaigns/board` | 200, six drag-and-drop columns |
| `/brand/campaigns/timeline` | 200, real DOM Gantt with phases + milestone diamonds |
| `/brand/campaigns/{campaignId}` | 200, detail page renders the record |
| `/app/campaigns/board?owner=test` | Redirects to `/brand/campaigns/board?owner=test` (query preserved) |
| `/creator/campaigns` | 200; **Competitions tab absent** (workspace-type gate) |
| `/creator/campaigns/competitions` | Blocked no-access state, **no data rendered** |

## 3. Visual match — measured, not eyeballed

Design geometry was read from the reference PNGs programmatically (pixel scans for card
edges, text bands and control borders), then compared with live `getBoundingClientRect()`
values from the running app.

| Element | Design | Before | After |
|---|---|---|---|
| H1 | 19px | 26px | 19px |
| Subtitle | 11px | 14px | 11px |
| Breadcrumb | 10px | 12px | 10px |
| Tabs | 11px / 28px tall | 13px / 32px | 11px / 28px |
| KPI label / value / hint | 9.5 / 17 / 8.5px | 12 / 22 / 11px | 9.5 / 17 / 8.5px |
| KPI strip height | 88px | 92px | 87px |
| Filter controls | 30px tall | 36px | 30px |
| First panel top | y=362 | y=396 | y=365 |
| Panel titles | 10.5px | 13px | 9.5–10px |
| Overview panel widths | 412 / 273 / 256 / 252 | 372 / 252 / 276 / 264 | 402 / 267 / 250 / 246 |
| All Campaigns card grid | 4-up | 3-up | 4-up |
| Templates card grid | 5-up | 3-up | 5-up |
| Board columns | 194px | 248px | 194px |
| Timeline rows / day column | 66px / 27px | 52px / 34px | 66px / 27px |

**Known, deliberate deviation:** content starts at x=260 against the design's x=236, because
the locked app shell's sidebar is 264px wide where the design mock drew 204px. The shell is
design-locked (`APP_SHELL_DESIGN_LOCK.md`), so page content is matched *inside* the real
shell width rather than altering the shell.

## 4. Buttons / actions tested

New campaign · Import · Export · header overflow menu · tab navigation (all 7) · view
switchers (Cards / Table / Board / Timeline) · date range · every filter select · advanced
filter popover · Clear all · search (debounced) · sort select · pagination · card overflow
menus · board drag-and-drop (pointer) plus keyboard "move to stage" · timeline
drag-to-reschedule · Add milestone · winner review actions · judging stage select · template
publish / unpublish / submit / approve / duplicate / preview · create-campaign-from-template ·
budget-chart grouping and period selects (new; real URL state, verified to regroup the data).

## 5. Data sources

Every KPI, chart, card, row and feed is a workspace-scoped Supabase read through
`src/lib/campaigns/data.ts`. No mock arrays, no client-side random values, no hardcoded
screenshot numbers. Verified live: Overview reads Active 24 / Planned 7 / On-track 78% /
Budget 62% / Uplift +32% / Deadlines 6 from the seeded records.

**Supabase tables:** `campaigns`, `campaign_templates`, `campaign_phases`,
`campaign_milestones`, `campaign_dependencies`, `campaign_activity`,
`campaign_metrics_daily`, `giveaways`, `giveaway_entries`, `competitions`,
`competition_submissions`, `content_posts`, `workspace_members`, `profiles`, `workspaces`.

**RLS:** every campaigns table is scoped by `workspace_id IN (SELECT workspace_id FROM
workspace_members WHERE user_id = auth.uid())`. Verified positively (the brand workspace
renders its own records) and negatively (a creator workspace is denied `competitions` at the
route gate and renders no rows).

**Storage:** demo cover images live in the public `media` bucket under
`campaigns-demo/<workspace_id>/…`; a sample URL returns `200 image/jpeg`.

## 6. Bugs found and fixed in this pass

1. **Campaigns was not on a canonical route.** It lived at `/app/campaigns` while Calendar,
   Advertising, Brand and Events had moved to `/{type}/…`. Ported to
   `src/app/[workspaceType]/campaigns/**` with a module gate, a type-aware link layer
   (`lib/campaigns/paths.ts`, `components/campaigns/links.tsx`) and a legacy redirect.
2. **Double page gutter.** Pages applied `CAMPAIGN_PAGE` padding inside the new layout's
   gutter, insetting all content. The gutter is now layout-owned.
3. **The whole module rendered about 1.3× the design scale** (see section 3).
4. **Donut legend lost its labels** — fixed-width value and percent columns squeezed the
   label out; now reads `Planning 7 (16%)` as in the design.
5. **Fake KPI hints.** Board and Timeline shipped hardcoded deltas ("14% vs last 30 days",
   "2 vs last 30 days", "8pp vs last 30 days"). Replaced with values derived from the data.
6. **Timeline "Milestones due" was capped at 6** because it reused a display query limited to
   6 rows. It is now a real count of milestones due in the next 7 days.
7. **Board mislabelled records.** Every stage that was not a column (`in_progress`,
   `blocked`) fell into **At risk**. There is now an explicit `BOARD_COLUMN_FOR` map
   (in-progress → Planning, blocked → At risk), and the KPI row counts the same buckets as
   the columns, so a header count can never disagree with its column.
8. **Aggregates were silently wrong past 1,000 rows.** `giveawayAggregates`,
   `competitionAggregates` and both trend queries selected child rows unpaginated, and
   PostgREST caps responses at max-rows (1,000 here). With roughly 17k seeded entries the
   giveaway approval rate read 0%. All four now page in 1,000-row batches (`fetchAll`).
9. **Demo workspaces grew on every page view.** `src/lib/demo-workspaces.ts` guarded each
   top-up row with `.eq(name).maybeSingle()`; `maybeSingle()` throws once two rows share a
   name, so the guard failed open and re-inserted on each load. This had accumulated roughly
   1,975 junk campaigns. Every lookup is now `.limit(1).maybeSingle()`.
10. **Timeline plotted out-of-window campaigns** as full-width bars, pushing live work off
    screen. The Gantt now plots only campaigns intersecting the visible range, with an
    explicit empty state; Cards and Table still show everything.

## 7. Tests run

```
npx tsc --noEmit -p .      # clean for src/lib/campaigns, src/components/campaigns,
                           # src/app/[workspaceType]/campaigns
npx vitest run             # 18 files, 244 tests passed
```

New: `src/lib/campaigns/campaigns.test.ts` (16 tests) covering module entitlements (per type,
plan, role and cancelled subscription), URL query-state fallbacks, board stage transitions,
KPI maths (active count, on-track rate, divide-by-zero) and canonical route mapping.
`src/lib/navigation/resolver.test.ts` was updated for the type-first campaigns route.

## 8. Performance and security findings

- Aggregate queries are now pagination-safe (item 8 above) and remain a constant number of
  queries — no N+1: owners resolve through a single embedded select and content counts
  through one grouped query.
- Route-level gating is enforced server-side (`requireCampaignModule`), not only by hiding
  nav items; verified by direct URL against a workspace type without the module.
- Mutations re-check capability and workspace ownership server-side and write
  `campaign_activity`; revalidation is a single layout-level `revalidatePath`.

## 9. Cross-section effects checked

Sidebar/nav resolver (campaigns is now type-first; `resolver.test.ts` updated) · the global
"New campaign" quick action now targets `/{type}/campaigns?action=new` · `/app/analytics` and
`/app/creators/briefs/[id]` campaign links keep working through the legacy redirect ·
campaign, giveaway and competition detail routes moved with the module.

## 10. Remaining items

See `release-gated/user-fixes/campaigns.md`.

## 11. Release decision

**Ready for release behind the existing plan gates** (Giveaways and Board: Creator Pro+;
Competitions, Templates and Timeline: Team+; Competitions additionally business/brand/agency
only).

**Score: 92/100.** Held below 100 by the items in the user-fixes file — principally that
several count-style KPIs cannot equal the design's numbers with the current demo dataset, and
that RLS negative paths have been verified through the UI route gate but not yet as direct
authenticated API calls from a second workspace's session.
