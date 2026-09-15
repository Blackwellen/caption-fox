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
