# Caption Fox — Calendar Module Implementation Tracker

Shared Campaign Manager → Calendar module (one canonical implementation for every
workspace type; gated by `src/lib/calendar/entitlements.ts`).

| Route | Reference |
|---|---|
| `/{type}/calendar` | `designs/Universal Sections/Calendar/… (1).png` |
| `/{type}/calendar/publishing-queue` | `… (2).png` |
| `/{type}/calendar/agenda` | `… (3).png` |
| `/{type}/calendar/conflicts` | `… (4).png` |

Reference viewport: **1491 × 1055**, DPR 1. Evidence: `docs/ui-verification/caption-fox/calendar/`.
Demo data: `node scripts/seed-calendar-demo.mjs <workspace_id…>` (dev only, idempotent, tagged demo).

## Status legend
Not Started · Audited · In Progress · Code Complete · Visual Review · Functional Review · Failed · Passed · Production Ready

## Tracker

| ID | Route / view | Shell | Visual match | Real data | Calendar logic | Filters / search / sort | CRUD / actions | Permissions | Loading / empty / error | Responsive | Chrome MCP | Screenshot compared | Automated tests | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 5.04.01 | Calendar — Month | ✅ | Close (pass 2) | ✅ | ✅ | ✅ URL state | New item, import, export, drag/keyboard reschedule | ✅ server guard | ✅ | Not yet | ✅ | ✅ pass 1–2 | Not yet | Visual Review | 5/6-row grid, rail height, preview panels fixed |
| 5.04.01 | Calendar — Week / Day / Agenda | ✅ | Not compared (no reference) | ✅ | ✅ tz-correct drop | ✅ | ✅ | ✅ | ✅ | Not yet | Not yet | n/a | Not yet | In Progress | |
| 5.04.02 | Publishing Queue — Queue view | ✅ | Close (pass 2) | ✅ | ✅ | ✅ | Approve, publish (worker), retry, cancel, reschedule, priority, bulk | ✅ | ✅ | Not yet | ✅ | ✅ pass 1–2 | Not yet | Visual Review | Lane bug fixed; actions column still to confirm at 1491 |
| 5.04.02 | Publishing Queue — Table / Calendar | ✅ | n/a | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Not yet | Not yet | n/a | Not yet | In Progress | |
| 5.04.03 | Agenda | ✅ | Pass 2 in progress | ✅ | ✅ | ✅ | Add item, create task, export | ✅ | ✅ | Not yet | ✅ | ✅ pass 1–2 | Not yet | In Progress | Days collapse by default; previews forward-looking |
| 5.04.04 | Conflicts — Cards | ✅ | Close (pass 1) | ✅ | Detection engine (`conflicts.ts`) | ✅ | Assign, due date, status, apply recommendation, resolve/dismiss/reopen | ✅ | ✅ | Not yet | ✅ | ✅ pass 1 | Not yet | Visual Review | 3-column cards applied, re-screenshot pending |
| 5.04.04 | Conflicts — Table / Calendar | ✅ | n/a | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Not yet | Not yet | n/a | Not yet | In Progress | |

## Bugs found and fixed (this pass)

1. **Owner / teammate names never resolved (all pages).** `workspace_members` has two FKs to `profiles` (`user_id`, `invited_by`), so the embed `profiles(...)` was ambiguous and PostgREST rejected it; every name fell back to "System"/"Unassigned". Fixed with `profiles!workspace_members_user_id_fkey(...)` in `src/lib/calendar/queries.ts`.
2. **Awaiting-approval items landed in the Draft lane.** `laneFor` checked `delivery === 'draft'` before approval state. Order corrected.
3. **Timezone bugs in rescheduling.** Drawer "Move to" pre-filled in UTC and parsed in the browser's zone; week/day drag-drop built UTC wall-clock times. All now convert through the workspace timezone (`zonedTimeToUtc` / `formValueToUtcIso`).
4. **Mini calendar truncated six-week months** (fixed 35 cells). Now 35 or 42 as needed; month view likewise renders 5 rows when the month fits.
5. **Layout drift vs references:** stacked page padding + 1280 px cap, 30 px title, KPI strip only 6-up at 2xl, oversized rails, month-cell overflow line inflating rows, queue table forced to 1000 px, lanes 6-up only at 2xl, conflicts cards 3-up only at 2xl, "UTC (UTC)" footnote. All corrected via shared tokens.
6. **Preview panels used the viewed range, not "next up".** Calendar and Agenda queue previews now show the next 5 unpublished items with a count footer; Agenda preview starts today; Agenda conflicts preview capped at 3.
7. **Deep links lost their sub-tab through sign-in** (`/calendar/agenda?…` returned to `/calendar`). Middleware now preserves the full path + query (since widened on disk to every workspace-type route).
8. **Agenda had no period navigation once the stepper was removed.** Mini calendar now has Previous month / Today / Next month, and follows the selected day (the week start can fall in the previous month).
9. **Agenda expanded every day after client-side navigation**, flooding the page. Only explicit toggles are stored; defaults recompute per window; very busy days show 20 rows with "Show all N items".
10. **`date` (navigation) counted as an active filter** ("Filters 1 · Clear all"). Excluded from the badge.
11. **"Today" panels described the viewed week, not today** ("17 items" beside "Nothing scheduled today"; 0 tasks when browsing October). Now driven by a separate one-day fetch.
12. **React "unique key" error from server-built `primary` elements** passed into client header actions. Keyed on Agenda, Queue and Conflicts; console clean.
13. **Queue table clipped Approval/Delivery/Priority/Actions; lanes and filters wrapped.** Two-line scheduled time, 860 px minimum, six lanes from `xl`, compact search.

## Measured 1:1 pass (reference 1491 × 1055, DPR 1)

Method: long-line pixel scan of each design PNG for card edges, gaps and row heights, then `getBoundingClientRect` on the live page and a diff per element. Shared tokens changed in `primitives.tsx` / `chrome.tsx` / `controls.tsx`, so every page inherits them.

| Element | Design | Live |
|---|---|---|
| Header buttons, filters, view switcher height | 32 | 32 |
| Tabs height | 26 | 26 |
| Title → tabs → KPI → filters → content spacing | 59 / 15 / 13 / 13 | 59 / 15 / 13 / 13 |
| KPI strip height (6-up, round 40px tiles, inset dividers) | 80 | 80 |
| Filter gap | 18 | 18 |
| Calendar: month header row / week rows | 28 / 68.6 | 29 / 69 |
| Calendar: Next Actions / Conflict Watch / bottom panels | 198 / 159 / 284 | 201 / 163 / 281 |
| Calendar: bottom row proportions | 302 / 508 / 370 | same fr proportions |
| Queue: lanes (6-up, tinted header band) | 138 wide | 137 wide |
| Queue: table header / rows | 28 / 37 | 29 / 37 |
| Queue: table → rail gap, rail width | 24 / 290 | 24 / 290 |
| Agenda: day header / day rows | 42 / 44 | 42 / 44 |
| Agenda: columns list / mini+summary / rail | 1fr / 225 / 230 | 1fr / 225 / 230 |
| Conflicts: cards grid gap / panel width | 11 / 335 | 11 / 335 |

Visual treatment matched from zoomed crops: hairline `#e8ebf0` borders with a faint shadow, dividerless panel headers and lists, borderless soft-tint event blocks, soft rounded-rectangle status/severity pills, tinted Next-Actions tiles, solid Activity tiles, date badges in the agenda preview, tinted lane headers, single-card agenda with timeline rows and outcome text, centred footer links, severity-dot conflict rows, inner-card resolution panel with green checks and coloured record pills.

### Typography density pass (true-size comparison)

The Chrome profile runs at 80% zoom, so earlier screenshots were not at true size. Re-captured by emulating a `1193x844x1` viewport (innerWidth 1491 × 1055), scaled to 1491 and stacked against each design (`docs/ui-verification/caption-fox/calendar/{calendar,queue,agenda,conflicts}-true1491*.png`). Box sizes already matched; the remaining gap was **text size**. At equal container sizes the design's text is about 25–35% smaller, and that extra size is what caused truncation ("Thought Le…", "Prom…").

| Area | Before | After |
|---|---|---|
| Shared controls (`T.control`, Today, view switcher) | 12.5px | 11.5px |
| KPI label / value | 12 / 22px | 11.5 / 20px |
| Priority tag | 12px, 13px icon | 10.5px, 11px icon, no wrap |
| Queue table title / subtitle / cells / scheduled | 12.5 / 11 / 12.5 / 11.5 | 11.5 / 10 / 11.5 / 10.5 |
| Queue lanes title / meta | 11.5 / 10.5 | 10.5 / 10 |
| Queue rail alerts, delayed items | 12 / 11 | 11.5 / 10 |
| Agenda rows | 12.5px; fixed 170px campaign column squeezed titles to ~60px | 11.5px; title block `flex-[1_1_180px]`, campaign column shrinkable 150px basis |
| Agenda side panels / summary | 12–13px | 11.5–12px |
| Conflicts filters | "Severity All" labels, Filters wrapped to 2nd line | `hideAllValue`, 190px search, one row |
| Conflicts cards | 12.5 / 11px, 3-col date wrapped to 3 lines | 11.5 / 10.5px, 48 / 1.6fr / 1fr grid |
| Conflicts resolution panel | 12–13.5px | 11–12.5px |

10px is the floor. The designs use ~8–9px secondary text in places, which would fail readability/WCAG, so it was not copied literally. The queue keeps 10 rows per page (the design shows 7 rows but labels its pager "10 / page"; 10 matches the working pager options), so its bottom panels sit one scroll lower than in the image.

### Band-by-band pass (content-edge aligned, 1.5× crops)

Each design was cut into six bands (header/KPI, main, bottom × left/right) and stacked over the live band aligned on the content column's left edge (`scratchpad/bands.py`). Fixes from that pass:

| Area | Difference | Fix |
|---|---|---|
| Agenda range | Design's week starts on today ("May 20 – 26", 20th = today); ours started Sunday, so two collapsed past days came first | `resolveRange(…, 'agenda')` now starts on the focused day (today by default). Agenda page, Calendar's Agenda view and the export route pass the view through instead of mapping it to `'range'`. New unit test |
| Agenda mini calendar | Rows 28px vs 24px; title 12.5px | `gap-y-0`, day numbers 10.5px, title 11.5px |
| Agenda Next Actions | Design uses soft tinted tiles; ours were solid green | `KindTile soft` variant (emerald-50 tint) on Agenda only; Calendar keeps solid tiles as in its design |
| Agenda rows | Time 10.5px, subtitle 11px | 10px / 10px |
| Calendar rail and bottom panels | 12 / 11px rows, 12px preview table | 11 / 10px rows, 11px table, activity titles medium weight |
| Header action buttons (all pages) | 12.5px | 11.5px |
| Queue table | Owner names cut to "Mason …" | Columns rebalanced (Channel 60, Owner 104, Actions 68); cells 11px |
| Queue rail | 11.5px titles | 11px |
| Conflict cards | Date wrapped as "…09:00 / AM" | Date and time on separate lines, as in the design |
| Conflicts resolution panel | ~150px taller than the design, pushing the bottom row below the fold | First 3 linked records + "Show N more", note field labelled for screen readers only, tighter rows; bottom row now on screen |

### Native-pixel type pass (2026-09-16)

The browser profile no longer runs at 80% zoom, so the reference viewport is now emulated directly as `1491x1055x1` — screenshots come out at 1491 with no rescaling. Measured with `scripts/ui-stack.py` (native-pixel stacks, 50px rulers), stacked on the content-column edge.

Reading text widths off the rulers, the design's type is ~0.87x ours at identical box sizes (breadcrumb 89 vs 104, subtitle 378 vs 417, tabs 90 vs 102, KPI labels 99 vs 110, filter date 111 vs 121). Applied as a scripted desktop-only scale: every `text-[Npx]` in the twelve Calendar component files gained an `lg:` override one step smaller (241 overrides; 22→20, 13→11.5, 12.5→11, 12→10.5, 11.5→10, 11→9.5, 10.5→9, 10→9, 9.5→8.5). Phone and tablet keep the previous sizes, per [[feedback_responsive_tabs]] touch-target rules and readability.

Vertical alignment after the pass (design + 13px shell offset vs live):

| Page | Element | Design | Live |
|---|---|---|---|
| Calendar | filter row / month header | 310 / 352 | 311 / 352 |
| Agenda | filter row / day list | 315 / 345 | 314 / 359 |
| Queue | lanes / table rows | 350 / 37 | 359 / 35 |
| Conflicts | filter row / cards grid | 319 / 365 | 317 / 383 |

Other fixes in this pass:

- **Queue paged 10 rows, the reference pages 7** ("Showing 1 to 7 of 128 items"), which pushed the bottom row ~100px down. Default page size is now 7 (`parsePage`, the query clamp, the page-size select and its unit test).
- **Calendar bottom row rhythm**: activity rows 37 → 42px, agenda-preview rows 56 → 52px (desktop only).
- **Conflicts cards 178 → 155px** (reference 145) and the **resolution panel 543 → 469px** (reference 355): tighter padding, 28px controls, 22px kebab, 2px record rows — all `lg:`-scoped.
- The "Conflicts by type" donut renders 7 sectors; an earlier blank ring was a mid-animation capture, not a bug.

**Still taller than the reference:** the resolution panel, by ~110px. The difference is functional controls the reference image does not draw — the resolution-note field, per-recommendation "Apply" buttons and the "Show N more" records toggle. Removing them would cost working behaviour, so they stay.

### Scored pass (2026-09-16, later)

Switched from eyeballing crops to a repeatable score: `scripts/ui-diff-content.py <folder> <page> 205 60 264 73` crops the shell off both sides, scales the reference content to our content width and reports a mean difference plus the hottest 40px rows.

| Page | Start | After header fix | After geometry fixes |
|---|---|---|---|
| Calendar | 13.4 | 12.9 | 12.9 |
| Publishing Queue | 14.0 | 13.4 | 13.2 |
| Agenda | 12.6 | 12.4 | 12.2 |
| Conflicts | 16.7 | 16.2 | 15.8 |

Header alignment was measured by scanning text rows in both images the same way (dark-pixel row bands over the content column), which showed the whole header block sitting ~6px low with a 6px-too-large H1→subtitle gap. Fixed with `lg:-mt-[11px]` on the page wrapper, `lg:leading-6` on the H1 and `lg:mt-0` + `lg:leading-[13px]` on the subtitle. Live element tops now land within a few px of the reference (breadcrumb −1, H1 +4, subtitle −3, tabs −7, KPI −2, filters −2).

Geometry fixes found by native stacks of the lower regions:

| Element | Reference | Was | Now |
|---|---|---|---|
| Conflicts resolution panel | ~290 | 469 | 385 |
| Conflict card | 145 | 155 | 149 |
| Conflicts bottom row top | ~713 | 828 | ~753 |
| Heatmap cell row | ~12 | 24 | 12 |
| Panel header (shared) | ~30 | 36 | 32 |
| Donut | ~110–120 | 168 | 132 |

Panel trims: linked records list moved its "Show N more" onto the label row, the resolution note now opens from an "Add resolution note" link (the field still works, it just no longer occupies space by default), plus tighter control, label and padding rhythm — all `lg:`-scoped.

**Where the remaining score comes from:** the demo data is not the reference's data. Conflicts shows 8 conflicts over 4 channels where the image shows 42 over 6; names, counts, dates and the donut split all differ. Those pixels cannot be matched without faking content, so the per-page score floors out around 12–16 even where geometry matches. Page backgrounds were checked and are near-identical (reference ≈#fefefe, ours ≈#f8fafd).

**Cannot be matched literally:** the locked app shell (see `project_app_shell_lock`) has a 264px sidebar versus 205px in the images and its own top bar, so the content column starts ~59px further right and is ~27px narrower. Everything inside the column is matched; the side menu was not altered (standing rule).

## Tests

`npx vitest run src/lib/calendar` → **5 files, 41 tests, all passing** (`dates`, `range`, `entitlements`, `conflicts` severity, `queue-lanes`). TypeScript and ESLint clean for all Calendar files.

## Open items

- ~~Shared shell mid-edit by another session~~ — resolved by that session; full-project `tsc --noEmit` is clean again (2026-09-15).
- Same ambiguous `profiles(...)` embed exists outside Calendar in 12 files (Settings, Messaging, Inbox, Campaigns, Social, Web, Partnerships) — flagged to the owner, not changed here.
- Pre-existing demo campaigns create 124 identical "Growth Co. — Autumn Refresh ends" milestones on 30 Sept (not from the Calendar seed); the Agenda now bounds this, but the duplicate demo data should be cleaned.
- Responsive pass (1366 / 1280 / 1024 / tablet / mobile / PWA) not yet run.
- Mutation E2E (approve, publish-to-worker, resolve conflict, create item) not yet exercised in the browser.
- Release evidence docs under `/release-gated/docs/calendar/…` not yet written.
