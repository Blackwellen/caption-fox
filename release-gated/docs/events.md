# Events — Release Evidence

**Section:** Events (shared module)
**Routes:** `/{workspaceType}/events`, `/events/events`, `/events/webinars`,
`/events/podcasts`, `/events/sponsorships`, `/events/follow-up`
**Workspace types:** creator (reduced), business (plan-gated), brand, agency
**Verified in:** Brand demo workspace `jamahl-thomas-campaign-manager-demo`
(`d7b7c61e-7685-4b15-8a0c-d9fa85f25103`), signed in as owner
**Date:** 2026-09-16

---

## 1. Screen sizes tested

Captured with Chrome MCP at **1448 × 1086** — the native size of the six
approved reference images (the brief said 1491 × 1055; the supplied PNGs
measure 1448 × 1086, so comparisons use the images' own size). The viewport is
set with CDP device-metrics emulation, because the physical display cannot open
a window that tall — earlier captures were silently 949px and cut the lower
third of every page.

Responsive behaviour was built against the standing Caption Fox rule of three
layouts per tab row (desktop row / tablet sliding tray / mobile dropdown) via
`EventsMobileNav` and the shared tab row.

## 2. Screenshots / evidence

| Route | Reference | Implementation |
|---|---|---|
| Overview | `docs/ui-verification/caption-fox/events/overview-reference.png` | `overview-implementation.png` |
| Events | `events-reference.png` | `events-implementation.png` |
| Webinars | `webinars-reference.png` | `webinars-implementation.png` |
| Podcasts | `podcasts-reference.png` | `podcasts-implementation.png` |
| Sponsorships | `sponsorships-reference.png` | `sponsorships-implementation.png` |
| Follow-up | `follow-up-reference.png` | `follow-up-implementation.png` |

Native-pixel comparison stacks (reference above implementation, 50px rulers):
`overview-stack-top.png`, `overview-stack-head2.png`, produced with
`scripts/ui-stack.py`.

## 3. Routes tested

All six render, are reachable from the module tab row, survive hard refresh and
deep links, and 404 for a workspace whose entitlements exclude the tab
(`getEventsPageContext` → `visibleEventsTabs`). Unauthenticated access
redirects to `/login?next=…`.

## 4. Buttons / actions tested

Export (per-resource, carries the current query string), Create Event wizard
(4 steps, conditional venue vs platform fields), Create Webinar, Create
Episode, Create Sponsorship, Create Sequence, More-actions menus, KPI links,
panel "View all" links, Gala Dock CTA + dismiss, pagination, page-size,
view switcher, follow-up board drag-and-drop **and** its per-card status menu.

## 5. Filters / search / sorting / views

Search, filters, sort, page, pageSize and view are all URL state
(`src/lib/events/filters.ts`), so they are shareable, refresh-safe and
back/forward-safe, and the server re-queries rather than hiding downloaded
rows. Invalid input is ignored rather than trusted — covered by unit tests.

Views per route: Overview and Events (cards/table/calendar/timeline),
Webinars and Podcasts (cards/table/calendar/timeline), Sponsorships
(cards/table/pipeline/timeline), Follow-up (cards/table/board/timeline).

## 6. Data sources

Every figure is computed from workspace rows. No hard-coded metrics remain.
Demo data is `is_demo = true` and workspace-scoped.

| Surface | Reads |
|---|---|
| Overview | `events`, `event_registrations`, `event_sessions`, `sponsorships`, `event_followup_tasks`, `event_activity`, RPC `events_registration_trend` |
| Events | as above + `gala_dock_event_links` |
| Webinars | `events` (type=webinar), `webinar_details`, `webinar_questions`, `event_registration_stats`, RPC `webinar_attendance_trend` |
| Podcasts | `podcast_shows`, `podcast_episodes`, `podcast_listener_daily`, RPC `podcast_listener_trend` |
| Sponsorships | `sponsors`, `sponsorships`, `sponsorship_deliverables`, `sponsorship_packages` |
| Follow-up | `event_followup_sequences`, `event_followup_steps`, `event_followup_tasks`, `event_outreach_events`, `event_registrations` |

## 7. Bugs found and fixed

| # | Severity | Bug | Fix |
|---|---|---|---|
| 1 | High | **Webinar KPIs capped at exactly 1,000.** Registrations and follow-up leads counted returned rows (`data.length`); PostgREST caps responses at 1,000, so any real workspace silently under-reported. | Switched to `select('id', { count: 'exact', head: true })` and read `count`. |
| 2 | High | **Follow-up KPIs had the same cap.** Outreach rows were fetched and counted in JS. | Replaced with eight server-side counts per type/window. |
| 3 | High | **Suspended workspaces were locked out of their own data.** The resolver returned `false` for *every* capability, so all tabs disappeared and the module 404'd — contradicting the suspended copy ("before event data can be **changed**"). | Suspension now blocks only mutating capabilities; reads remain. Blocker reasons aligned. Covered by tests. |
| 4 | Medium | **Horizontal overflow** on Overview/Events/Webinars/Podcasts/Sponsorships/Follow-up: grid children defaulted to `min-width:auto`, so charts and tables pushed the right rail past the shell edge and the page scrolled sideways. | `min-w-0` on grid children and `Panel`. Verified `scrollWidth - clientWidth === 0`. |
| 5 | Medium | **Attendance trend drew false spikes.** Days with no webinar were plotted as 0%. | Nulls are preserved and the line bridges them (`connectNulls`); `TrendPoint` now allows null. |
| 6 | Medium | **Run of Show emptied the moment an event finished** — it only looked for a live or future event. | Falls back to the most recent event of that type. |
| 7 | Medium | Activity feed printed the stored verb ("Created", "Completed"). | `activityTitle()` maps entity+action to product language ("New registration"). |
| 8 | Low | Attendance rate for webinars counted registrations on *future* webinars as non-attendance. | Rate is computed over webinars that have happened. |
| 9 | Low | Charts animated on load, so screenshots caught them mid-transition. | `isAnimationActive={false}` — also makes visual regression deterministic. |
| 10 | Low | Y-axis labels clipped by a negative chart margin; event cards showed "0%" attendance for events that had not happened; KPI labels truncated ("Sponsorship Reven…"); run-of-show titles truncated. | Margins, `—` for unmeasurable rates, KPI card re-spec, two-line session titles. |
| 11 | **High** | **Sponsorship Revenue compared a lifetime total against one month.** `revenue` summed every contracted/active/completed sponsorship with no date bound while `revenuePrev` was windowed, so the KPI read "+109.3%" against itself. | Revenue is now the value contracted *in the selected window*, matching `revenuePrev` and the Overview's own figure. |
| 12 | Medium | **Follow-up board rendered all 136 tasks**, making the page 9,125px tall against the reference's single screen. | Four cards per column with a "+N more" link into the filtered table view; page is now 2,320px. |
| 13 | Medium | View switcher sat inside the Event Summary panel header (Overview) and above the filter block (Directory); the reference places it at the top of the right rail. | Moved to the right rail on both. |
| 14 | Medium | Content split was 1.6:1 where the reference is 2:1, which squeezed event cards and clipped their stat labels ("Registe…"). | `2fr_1fr` across the list pages; labels now fit. |
| 15 | Medium | The reference table has a selection column, but there was no selection at all. | Added row selection with a real bulk action — "Export selected" posts the chosen ids to the permission-gated export, which applies them **on top of** workspace scope (verified: selecting 2 rows exports exactly 2). |
| 16 | Low | Webinars inside the 30-day window had no registrations, so the attendance-rate trend drew one spike instead of a line. | Registrations spread across in-window webinars; the trend now has a point per webinar date. |
| 17 | Low | Overview filter row offered "More Filters"; the reference shows "Clear Filters" there (More Filters belongs to the directory). Controls were also too wide and wrapped to two rows. | Matched the reference and sized the controls to one row. |
| 18 | **High** | **Panel padding overrides silently failed.** `cn` is plain `clsx` (no tailwind-merge), so `Panel` applied its default `p-4` *and* the caller's `p-0`/`px-3`; CSS order decided which won. Every panel asking for custom padding was 32px taller than intended. | `Panel` applies either the caller's padding or the default, never both. |
| 19 | **High** | **100 demo registrations were dated in the future** (seeded as "day + fixed hour"), so the follow-up list showed every registrant as "Registered just now". | Migration `…000700` moves future rows into the past on the same day (trend buckets unchanged); `formatRelative` now shows a date for any future timestamp instead of "just now". |
| 20 | Medium | **"Meetings this week" could only ever be 0.** It counted `meeting_booked` events dated in the next 7 days, but those events record when a meeting was *booked*, which is always in the past. | Counts bookings made in the last 7 days and is labelled "meetings booked this week". |
| 21 | Medium | **Sponsorship Revenue chart was a spike then a cliff.** All demo contracts were signed in the last 60 days, and the series plotted Oct–Dec of the current year as £0. | Future months are trimmed from the current year; migration `…000600` adds completed contracts across earlier months and last year (all outside the KPI windows, so KPIs are unchanged: £737,000, +9.3%). |
| 22 | Medium | Adding that history pushed completed contracts (no event/package) to the front of Sponsor Portfolio, which sorted purely by value. | Portfolio orders by most recently worked relationship, then value. |
| 23 | Medium | **Horizontal page scroll on phones and tablets** (Events directory 299px at 390, 5px at 768; Sponsorships 21px at 1024). Two causes: page grids had no explicit single-column track below `xl`, and `sr-only` labels inside table cells were absolutely positioned outside any positioned ancestor, escaping the table's `overflow-x-auto`. | `grid-cols-1` on every page grid; table scrollers are `relative`; the sponsorship toolbar wraps below `xl`. Verified 0px overflow on all six routes at 1448 / 1024 / 768 / 390. |
| 24 | Low | "Run of Show (Today)" was shown for any run sheet, including past events. | "(Today)" only when the event's start date is today in the workspace timezone; otherwise the event name is shown. |

### Visual fidelity pass (third round)

Full-page side-by-side evidence (reference left, implementation right, tab row
cropped out): `docs/ui-verification/caption-fox/events/*-side-by-side.png`.

Decisions confirmed by the product owner on 2026-09-16: **keep the module tab
row** (no sidebar sub-items) and **keep Geist** (no Plus Jakarta Sans). Those two
are therefore accepted, permanent differences from the images.

| # | Finding | Fix |
|---|---|---|
| 25 | Dense panel text rendered ~15–20% larger than the images (measured on identical strings: panel titles 0.88×, links 0.8×, list/table/run-of-show text 0.8–0.85×). | Panel titles 13px, links 11px, list/table/badge text 10–11px, chart axes 9.5px across the shared components and all six pages. KPI cards and the page header were already correct and were left alone. |
| 26 | The attendees line fell to zero on the last days of every registration chart. Recent registrations are for events that have not happened, so attendance is unknown, not zero. | Trailing zero-attendee days are left as a gap; lines are smoothed as in the images. |
| 27 | The Run of Show event-name subtitle added ~20px to every panel row, pushing the lower half of each page down. | Event name moves onto the title line ("Run of Show • Product Summit 2024"), the same pattern the Podcasts reference uses. |

Remaining, and not fixable in code: demo names and cover photos differ from the
images' sample content; the Webinars reference banner contains a Gala Dock
product screenshot that has not been supplied (see user-fixes).

### Visual fidelity pass (second round)

The first round measured the references wrongly. The earlier screenshots were
949px tall, not 1086px, so the lower third of every page was never compared.
Re-measured at native pixels, then rebuilt shared components to the spec:

| Element | Reference | Before | Now |
|---|---|---|---|
| H1 | ~23px | 30px | 23px |
| KPI card | 185×104, 37px icon tile, ▲ delta | 180×92, 28px tile, ↗ arrow | 180×104, 35px tile, ▲ delta |
| Wide Gala Dock banner | 107px, 66px bare mark, ~290px wordmark | 116px, tiled small mark | 107px, 66px mark + 46px wordmark |
| Overview panel row | 409 / 352 / 376 | 1.15 / 1 / 1 | 409fr / 352fr / 376fr |
| Overview bottom | one filter+summary panel, one switcher+upcoming panel | four separate blocks | combined as reference |
| Run of Show | 42px rows, 12-hour clock, joined rail | 55px rows, 24-hour | as reference |
| Badges | Upcoming lavender, Live blue + dot, solid on images | mixed | as reference |
| Directory | two-row labelled filters, horizontal card strip, compact table with row ⋮ | one squashed row | as reference |
| Webinars / Podcasts / Follow-up | filters + switcher share a row; charts share one panel | stacked | as reference |
| Sponsorships | filter toolbar + switcher in one row, CTA at banner right | stacked, CTAs under text | as reference |

## 8. Migrations applied

| File | Purpose |
|---|---|
| `20260916000000_events_demo_seed_v2.sql` | 48 events, ~8.2k registrations across 30 days, sponsors, 124 follow-up tasks, episodes, covers |
| `20260916000100_events_demo_prior_window.sql` | Prior 30-day window so period-on-period deltas are real |
| `20260916000200_events_demo_webinar_depth.sql` | Webinars inside the trend window, agendas, 255 questions |
| `20260916000300_events_demo_podcast_depth.sql` | 60-day listener series, run sheet, 18 podcast-read deliverables, unique titles |
| `20260916000400_events_demo_sponsor_variety.sql` | Distinct fictional sponsors, tier-appropriate values, varied activity |
| `20260916000600_events_demo_sponsor_history.sql` | Completed contracts over earlier months and last year, for the revenue trend |
| `20260916000700_events_demo_registration_clock.sql` | Moves future-dated demo registrations into the past |

All are idempotent (guarded on their own footprint) and no-ops on a workspace
that has not been provisioned. **No third-party trademarks** — the v1 seed's
Slack/AWS/HubSpot/Snowflake sponsors were renamed to fictional companies.

## 9. Tests run

```
npx vitest run                 → 280 tests passed
npx vitest run src/lib/events  → 14 tests passed
npx tsc --noEmit               → 0 errors in Events (errors remain in other modules, see §13)
Chrome MCP                     → 0 console errors on all six routes; 0px horizontal
                                 overflow at 1448 / 1024 / 768 / 390
```

New: `src/lib/events/__tests__/events.test.ts` — entitlement resolution
(workspace type, feature flag, plan vs permission, suspension), URL-state
parsing (bounds, whitelists, repeated params), activity titles, rate/duration
formatting, and location labelling.

## 10. Performance / security findings

- Page queries run in parallel (`Promise.all`); no request waterfalls.
- KPI aggregates are counted server-side (see bugs 1–2) rather than by
  downloading rows.
- Every query is workspace-scoped; `getEventsPageContext` resolves auth,
  membership, plan, role, flags and tab entitlement before any record is read,
  and 404s rather than revealing that a workspace exists.
- Financial values are gated behind `sponsorships.viewFinancials` at the
  resolver, not by hiding UI.
- Gala Dock CTAs open externally with `noopener noreferrer` and never claim a
  sync that has no link record.

## 11. Cross-section effects checked

KPI cards deep-link to Sponsorships and Follow-up; run-of-show links to the
event detail route; activity rows link to their record; Create wizards redirect
into the directory; export routes through `/api/events/export` honouring the
current filters.

## 12. Pending user/manual actions

See `release-gated/user-fixes/events.md`.

## 13. Release score

**95 / 100** — not yet 100.

Held back by items that need either assets I do not have or a second test
account, all listed in the user-fixes file:

- Cross-workspace RLS negative tests need a second real user account.
- Provider integrations (Zoom/Riverside/etc.) are modelled and gated but no
  live provider is connected in this environment.
- A full `tsc` run still fails in other modules being built in parallel
  (SEO, Marketplace, Campaigns). None are in Events and none were touched.
- One deliberate layout difference remains: the references show the six pages
  as sidebar sub-items. The sidebar is design-locked, so Events keeps the
  standard module tab row, which puts every page ~70px lower than its image.

## 14. Final release decision

**Ready for release behind the existing entitlement gates**, with the manual
follow-ups in the user-fixes file. Not marked 100/100 — the outstanding items
are genuine and are listed rather than papered over.
