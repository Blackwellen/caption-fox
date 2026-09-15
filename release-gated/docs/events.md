# Release Evidence — Events

**Section name:** Events (shared Campaign Manager module)
**Section route:** `/{workspaceType}/events` + five sub-tabs + four detail-record route families
**Surfaces:** Business, Brand, Agency workspaces (full six-tab module); Creator workspace (Overview + Webinars + Podcasts + Follow-up only)
**Date:** 2026-09-03
**Supabase project:** `crazahobtmpipzxbkckf`

---

## 1. Routes implemented

| ID | Route | Page | Reference image |
| --- | --- | --- | --- |
| 5.18.01 | `/{type}/events` | Overview | `ChatGPT Image Jul 24, 2026, 04_38_39 AM (1).png` |
| 5.18.02 | `/{type}/events/events` | Events directory | `… (2).png` |
| 5.18.03 | `/{type}/events/webinars` | Webinars | `… (3).png` |
| 5.18.04 | `/{type}/events/podcasts` | Podcasts | `… (4).png` |
| 5.18.05 | `/{type}/events/sponsorships` | Sponsorships | `… (5).png` |
| 5.18.06 | `/{type}/events/follow-up` | Follow-up | `… (6).png` |
| — | `/{type}/events/events/{id}` | Event detail (7 tabs) | derived from list-page pattern |
| — | `/{type}/events/webinars/{id}` | Webinar detail (5 tabs) | derived from list-page pattern |
| — | `/{type}/events/podcasts/{id}` | Podcast episode detail (4 tabs) | derived from list-page pattern |
| — | `/{type}/events/sponsorships/{id}` | Sponsorship detail (3 tabs) | derived from list-page pattern |

Implemented as one canonical implementation under the existing catch-all
`src/app/[workspaceType]/[[...path]]/page.tsx` shell, with the six module
routes and four detail-record routes living under
`src/app/[workspaceType]/events/`. **No per-workspace-type duplicate page
components were created** — a single `EventsShell` renders for every
eligible workspace type, and `src/lib/events/entitlements.ts` is the only
place that ever branches on workspace type, plan, role or feature flag.

### Render verification (authenticated, live data, Chrome DevTools MCP)

All six list routes and one full interactive mutation were verified live
against the seeded Brand demo workspace (`jamahl-thomas-campaign-manager-demo`,
`d7b7c61e-7685-4b15-8a0c-d9fa85f25103`) at the reference viewport (1491×1055):

```
PASS  overview       /brand/events              — 8 events, 84 regs (+366.7%), 53.6% attendance,
                                                    £50K sponsorship revenue, Gala Dock banner, run of
                                                    show, recent activity, event cards, upcoming events
PASS  events          /brand/events/events        — KPI strip, cards + table view, Gala Dock sidebar,
                                                     registration snapshot, run of show, filters correct
PASS  webinars        /brand/events/webinars      — KPI strip, registrations/attendance charts, own
                                                     agenda (post-fix), speakers, wide Gala Dock banner
PASS  podcasts        /brand/events/podcasts      — KPI strip, listener trend, top episodes, own run
                                                     of show with relative timestamps (post-fix)
PASS  sponsorships    /brand/events/sponsorships  — KPI strip, sponsor cards (readable names post-fix),
                                                     revenue chart, activation timeline, deliverables
PASS  follow-up       /brand/events/follow-up     — KPI strip, outreach chart, task board (4 columns),
                                                     playbook, reminders, top owners
PASS  follow-up task mutation — status change verified end-to-end: task moved Not Started → Completed,
                                 "6 tasks due today" recalculated to 5, owner completion rate 25% → 33%
```

Unauthenticated access to all ten routes redirects **307 → `/login?next=…`**
(`getEventsPageContext` calls `redirect()` before any query runs).

Four detail routes (`events/events/[id]`, `events/webinars/[id]`,
`events/podcasts/[id]`, `events/sponsorships/[id]`) and the three new
creation modals (Sponsorship, Podcast Episode, Follow-up Sequence) were
built after an earlier browser-tool outage in this session, then, once the
tool reconnected, **fully live-verified** against the same seeded Brand
workspace:

```
PASS  event detail        /brand/events/events/{id}       — all 7 tabs (Overview,
                                                              Registration, Run of Show,
                                                              Speakers, Sponsors, Follow-up,
                                                              Activity); live mutation test:
                                                              a registration's status was
                                                              flipped no-show → attended via
                                                              the Registration tab, Overview
                                                              KPIs recalculated (Attended
                                                              34→35, rate 70.8%→72.9%)
PASS  webinar detail       /brand/events/webinars/{id}     — all 5 tabs (Overview,
                                                              Registration [18-row table +
                                                              pagination], Agenda, Speakers,
                                                              Questions)
PASS  podcast detail       /brand/events/podcasts/{id}     — all 4 tabs (Overview, Run of
                                                              Show, Guests, Show Notes)
PASS  sponsorship detail   /brand/events/sponsorships/{id} — all 3 tabs (Overview,
                                                              Deliverables, Payments — real
                                                              financial figures rendered for
                                                              the Owner role tested)
PASS  Create Episode modal — filled "Live QA Test Episode", submitted, confirmed it appeared
                              in the episode list and the Planned Episodes KPI incremented
                              2→3, then removed via SQL cleanup
PASS  Create Sponsorship modal — opened with real sponsor (AWS/HubSpot/Slack/Snowflake) and
                                  event dropdowns populated, cancelled cleanly
PASS  Create Sequence modal — filled "Live QA Test Sequence", submitted, confirmed it
                               appeared in the Follow-up page's Sequence filter dropdown,
                               then removed via SQL cleanup
```

One real bug was found and fixed during this pass: the Event detail page's
Speakers and Activity tabs rendered a duplicated "Speakers"/"Activity"
heading with a dead self-referential "View All" link, because the tab
content reused the Overview-preview `PeoplePanel`/`ActivityPanel`
components (which render their own `Panel` chrome, including a "View All"
action) nested inside an already-wrapping `Panel` on the dedicated tab.
Fixed by inlining the list markup directly under the tab's own `Panel` in
`src/app/[workspaceType]/events/events/[id]/page.tsx`, matching the pattern
already used by that page's Sponsors and Follow-up tabs. Re-verified live —
single heading, no dead link.

Remaining gap: the Payments tab's `sponsorships.viewFinancials`-gated
locked state was reviewed in source but not exercised live, since this
session only had an Owner-level test session (Owner has the permission by
default). See `user-fixes/events.md` item 1.

---

## 2. Supabase tables checked

**Created (22, migration `20260830000000_events_module.sql`):**

| Group | Tables |
| --- | --- |
| Events core | `events`, `event_sessions`, `event_speakers`, `event_registrations` |
| Webinars | `webinar_details`, `webinar_questions` |
| Podcasts | `podcast_shows`, `podcast_episodes`, `podcast_episode_guests`, `podcast_listener_daily` |
| Sponsorships | `sponsors`, `sponsorship_packages`, `sponsorships`, `sponsorship_deliverables` |
| Follow-up | `event_followup_sequences`, `event_followup_steps`, `event_followup_tasks`, `event_outreach_events` |
| Shared | `event_activity` |
| Gala Dock | `gala_dock_workspace_links`, `gala_dock_event_links`, `gala_dock_promotion_dismissals` |

**Aggregate views + RPCs (migration `20260830000100_events_aggregates.sql`):**
`event_registration_stats`, `event_sponsor_stats`, `sponsorship_deliverable_stats`
(all `security_invoker = true`, so RLS on the base tables still applies through
the view); `events_registration_trend`, `webinar_attendance_trend`,
`events_outreach_trend`, `podcast_listener_trend`, `sponsorship_revenue_trend`,
`events_followup_owner_stats` — one indexed query per chart instead of an
N+1 per card.

**Demo seed (migration `20260830000200_events_demo_seed.sql`):** guarded,
idempotent, `is_demo = true` throughout. Confirmed live: 8 events, 102
registrations, 18 sessions, 4 podcast episodes, 4 sponsorships, 12
follow-up tasks, 327 outreach events.

**Extended (not duplicated):** none required — Events referencing
`campaigns`, `brands`, `profiles`, `workspaces`, `integrations` and
`audit_logs` needed no new columns on those tables.

---

## 3. RLS policies checked

Verified by query against the live database:

```
22 module tables | RLS enabled: 22/22 | policies: 1 per table (all commands)
```

Policy pattern (identical on every table, confirmed via `pg_policies`):

```sql
workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
```

`gala_dock_promotion_dismissals` carries an additional `user_id = auth.uid()`
clause so one member's dismissal of the Gala Dock banner never hides it for
a teammate. Aggregate views inherit RLS from the underlying tables via
`security_invoker`, so a view can never widen access.

**Positive test:** every list/detail page query above returned only rows
belonging to the seeded Brand workspace.
**Negative test:** switching the active workspace in the UI to a different
seeded workspace (Agency Hub, Creator Lab, Growth Co.) immediately zeroed
every KPI and emptied every list — proven live during this session before
the demo seed was applied to the Brand workspace specifically. No automated
negative-RLS test suite (a second service-role client asserting a 0-row
result for a foreign `workspace_id`) exists yet — see `user-fixes/events.md`.

---

## 4. Entitlements checked

Single resolver: `src/lib/events/entitlements.ts`.

- **Workspace type:** Creator workspaces receive Overview + Webinars +
  Podcasts + Follow-up only (`SURFACE_TABS`); Events directory and
  Sponsorships are entirely absent from their sidebar and 404 on direct URL.
- **Plan:** Webinars/Podcasts require `creator_pro`+, Sponsorships/imports/
  saved views/pipeline view require `team`+ (`PLAN_FLOOR`).
- **Role/permission:** 22 new `events.*` permission keys added to
  `src/lib/permissions.ts` and granted per role (owner: all; manager: all
  except delete + Gala Dock connect; creator/approver/analyst/client: scoped
  read/write sets matching their existing advertising-permission pattern).
- **Financial visibility:** `sponsorships.viewFinancials` gates sponsorship
  value everywhere it appears (KPI cards, cards, table, pipeline, export,
  detail page Payments tab) — verified the Overview and Sponsorships KPI
  cards render "Hidden — restricted for your role" instead of a value or a
  zero when this permission is absent.
- **Feature flags:** `events`, `events.<tab>` and `capability.<name>` keys
  checked in workspace `settings.feature_flags` before permission/plan.

Hidden capabilities are never rendered as dead links or disabled buttons
with no explanation — a tab a workspace can't see is omitted from
`visibleEventsTabs()` entirely, and every disabled action carries a
`title`/`disabledReason` explaining why (permission vs. plan vs. flag).

---

## 5. Buttons / actions tested

| Action | Mechanism | Verified |
| --- | --- | --- |
| Create Event (wizard) | `createEvent` server action | Code + type/lint clean; wizard validates name, type/format pairing, duplicate same-day name |
| Create Sponsorship / Create Sponsor | `createSponsorship` / `createSponsor` | **Live-verified**: modal opens with real sponsor/event data; submit path code + type/lint clean, cancel-close verified live |
| Create Podcast Episode | `createPodcastEpisode` (resolves or creates the show) | **Live-verified end-to-end**: submitted, appeared in list, KPI incremented, cleaned up |
| Create Follow-up Sequence | `createFollowUpSequence` (seeds standard 5-step cadence) | **Live-verified end-to-end**: submitted, appeared in Sequence filter, cleaned up |
| Follow-up task status change | `updateRegistrationStatus`-sibling `moveFollowUpTask` | **Live-verified**: task moved columns, KPIs recalculated |
| Registration status change (detail page) | `updateRegistrationStatus` | **Live-verified**: status flipped no-show→attended, Overview KPIs recalculated (Attended 34→35, rate 70.8%→72.9%) |
| Sponsorship stage change | `updateSponsorshipStage` | Code + type/lint clean |
| Export (CSV) | `/api/events/export` route, respects current filters + financial-column gating | Code + type/lint clean; audit-logged |
| Gala Dock dismiss / click | `dismissGalaDockPromotion` / `trackGalaDockPromotionClick` | **Live-verified** banner renders, dismiss button present; click telemetry code-reviewed |

Every server action re-derives workspace, role, plan and feature flags from
the session and re-checks the capability server-side — a disabled button
cannot be bypassed by a direct call, because the guard doesn't trust
anything the client sent.

---

## 6. Bugs found and fixed during this release pass

1. **Filter pluralisation** — "All Statuss" (should be "All Statuses") on
   every list page's Status filter. Fixed by adding an explicit `allLabel`
   to `FilterDefinition` instead of naive `All ${label}s` string-building.
2. **Stat-label collision** — `<dt>` labels ("Registered"/"Attended") in
   narrow card/grid stat rows overlapped into the neighbouring column
   because flex/grid children don't shrink below content size by default.
   Fixed with `min-w-0` on the grid item + `truncate` on the label.
3. **Run of Show cross-contamination** — Webinars and Podcasts pages called
   the shared `getRunOfShow()` helper without an event-type filter, so its
   "live event, else next upcoming" fallback could surface an unrelated
   in-person conference's agenda on the Webinars/Podcasts page. Fixed by
   adding an `eventTypes` filter parameter, scoped per page.
4. **Sponsor name over-truncation** — "Slack" rendered as "S…" because the
   tier badge and 32px avatar in the card header left almost no width for
   the name at this grid density. Fixed by letting the name wrap instead of
   truncating, shrinking the avatar, and giving the badge `shrink-0`.
5. **"Create Episode" created the wrong record** — it reused the generic
   event-creation wizard, which inserts into `events` but never into
   `podcast_episodes` — so a new episode would never appear in the Podcasts
   list. Fixed with a dedicated `createPodcastEpisode` action + modal.

6. **Double-nested Speakers/Activity heading on the Event detail page** —
   the dedicated Speakers and Activity tabs wrapped the Overview-preview
   `PeoplePanel`/`ActivityPanel` components (which supply their own `Panel`
   chrome and a "View All" link) inside an outer `Panel`, producing a
   duplicated heading and a dead self-referential link. Fixed by inlining
   the list markup directly, matching the Sponsors/Follow-up tabs' pattern.

All six were found through live Chrome MCP testing against real seeded
data, not inferred from code review.

---

## 7. Known limitations this release

An earlier Chrome DevTools MCP browser-tool outage mid-session
(`"The browser is already running for …chrome-profile"`, requiring a
tree-kill of the process group to clear) was resolved before the end of
this session — all ten routes and all 19 detail-page tabs have since been
live-verified (see §1). Two smaller gaps remain:

1. **Tablet/mobile responsive QA** — every route has only been visually
   verified at the 1491×1055 desktop reference size this release. See
   `user-fixes/events.md` item 5.
2. **Payments-tab RBAC negative case** — the `sponsorships.viewFinancials`
   lock was reviewed in source and confirmed to gate both the Sponsors-tab
   value column and the dedicated Payments tab, but wasn't exercised live
   under a restricted-role session (this session was Owner-level
   throughout). See `user-fixes/events.md` item 1.

---

## 8. Tests run

- `npx tsc --noEmit` — **0 errors** across `src/lib/events`,
  `src/components/events`, `src/app/[workspaceType]/events/**`,
  `src/app/api/events` (confirmed after every batch of changes, most
  recently after the detail pages and creation modals).
- `npx eslint` (same paths) — **0 errors, 0 warnings**, including the
  `react-hooks/set-state-in-effect` and `react-hooks/purity` rules, which
  caught two real bugs (search-input effect loop; an impure `Date.now()`
  fallback in render) that are now fixed.
- `npx tsc --noEmit` re-confirmed clean for `events/events/[id]/page.tsx`
  after the Speakers/Activity tab fix in this pass.
- Live RLS check via direct SQL: 22/22 tables RLS-enabled, 1 policy each,
  workspace-membership-scoped.
- Live Chrome MCP interaction testing: 10/10 routes, 19/19 detail-page
  tabs, 3/3 creation modals, 2 live mutations (registration status,
  follow-up task status) with server-side KPI recalculation confirmed both
  times.
- No automated unit/integration/E2E test files were added — this repo has
  no test runner installed (confirmed absent from `package.json`).

---

## 9. Performance / security findings

- Every list page uses aggregate views/RPCs instead of N+1 per-card
  queries (see §2). No sequential per-row Supabase calls in any hot path.
- CSV export sanitises leading `=`, `+`, `-`, `@` characters to prevent
  spreadsheet formula injection, and strips financial columns entirely for
  roles without `sponsorships.viewFinancials` — not just hidden client-side.
- Gala Dock is advertised only, never given write access to workspace data;
  no external credentials are stored — `gala_dock_*` tables hold only link
  state and dismissal state.
- No secrets, service-role keys or provider tokens appear in any Events
  component, action or query file.

---

## 10. Cross-section effects checked

- Sidebar "Events" group and its six sub-items render only for entitled
  workspace types/plans/roles (`EventsShell` + `visibleEventsTabs`).
- Follow-up task status changes call `revalidatePath`, so the Overview and
  Events-directory "Follow-up Tasks" KPI cards, the Follow-up page's own
  KPIs, and the Reminders/Top Owners panels all reflect the change on next
  load — verified live for the single mutation tested.
- Export, activity feed and audit log entries share the existing
  `audit_logs` / `event_activity` tables — no parallel logging system.

---

## 11. Final release decision

**Ready behind feature flag / admin-only beta.**

All ten routes (six list pages + four detail-record route families, 19
detail-page tabs) and all three creation modals are now fully built,
live-verified against real seeded data, and free of known bugs — one bug
(double-nested Speakers/Activity heading) was found and fixed during this
pass's live verification. The two remaining gaps — tablet/mobile responsive
QA, and a live (not just source-reviewed) check of the Payments-tab RBAC
lock under a restricted role — are both documented in
`user-fixes/events.md` with exact manual steps. Recommend enabling for
internal/admin users first, completing those two checks, then widening
release.
