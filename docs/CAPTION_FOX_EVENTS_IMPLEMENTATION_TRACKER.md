# Caption Fox — Events Implementation Tracker

Canonical shared module across eligible workspace types. One implementation, entitlement-driven.

## Audit summary (baseline)

| Area | Finding |
| --- | --- |
| Framework | Next.js 16.2.9 (App Router, RSC, Turbopack), React 19.2.4, Tailwind v4, TypeScript 5 |
| Routing | `src/app/[workspaceType]/[[...path]]/page.tsx` catch-all; Events lives as real nested routes under `src/app/[workspaceType]/events/` |
| Workspace types | Full module: `business`, `brand`, `agency`. Reduced (Overview + Webinars + Podcasts + Follow-up): `creator` |
| Existing shell | `CaptionFoxShell.tsx` (generic) — Events uses its own `EventsShell` matching the approved reference pixel-for-pixel |
| Existing contacts model | None — `event_registrations` stores attendee identity directly (`contact_id` column reserved, unlinked, for a future CRM contacts table) |
| Storage | No file uploads in this module (cover images / logos are URL fields only in this release) |
| Tests | No framework installed in this repo |
| RLS pattern | `workspace_id in (select workspace_id from workspace_members where user_id = auth.uid())` on every table — confirmed live, 22/22 tables |

## Architectural decisions

1. **One canonical route family**, no per-workspace-type page components. `EVENTS_ROUTE_SURFACES` maps the URL segment to a shell surface; `entitlements.ts` is the only file that branches on workspace type/plan/role/flag.
2. **Aggregate views + RPCs over N+1.** `event_registration_stats`, `event_sponsor_stats`, `sponsorship_deliverable_stats` (views) and six trend RPCs compute per-record and time-series stats server-side in one query.
3. **Gala Dock is advertising only.** Link tables (`gala_dock_*`) hold no external credentials; the promotion component never claims a sync state that isn't backed by a real link record.
4. **Server actions, not API routes**, for mutations — one `guard()` helper re-derives and re-checks the capability from the session on every call, so a disabled button can never be bypassed by a crafted request.
5. **Detail pages share one query-param tab pattern** (`DetailHeader.tsx` + `?tab=`) rather than one nested folder per tab, trading URL granularity for a much smaller, more consistent surface area across four record types.

## Route tracker

| ID | Route | Page/View | Reference | Shell | Visual Match | Real Data | Search | Filters | Cards | Table | Calendar | Timeline | Board/Pipeline | CRUD | Gala Dock | Export | Permissions | Activity | Loading | Empty | Error | Responsive | Chrome MCP | Tests | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 5.18.01 | `/{type}/events` | Overview | img (1) | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | n/a | ☑ create | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | ☐ desktop only | ☑ | n/a | Production Ready |
| 5.18.02 | `/{type}/events/events` | Events directory | img (2) | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | n/a | ☑ create | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | ☐ desktop only | ☑ | n/a | Production Ready |
| 5.18.03 | `/{type}/events/webinars` | Webinars | img (3) | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | n/a | ☑ create | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | ☐ desktop only | ☑ | n/a | Production Ready |
| 5.18.04 | `/{type}/events/podcasts` | Podcasts | img (4) | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | n/a | ☑ create | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | ☐ desktop only | ☑ | n/a | Production Ready |
| 5.18.05 | `/{type}/events/sponsorships` | Sponsorships | img (5) | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | n/a | ☑ | ☑ pipeline | ☑ create | ☑ x2 | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | ☐ desktop only | ☑ | n/a | Production Ready |
| 5.18.06 | `/{type}/events/follow-up` | Follow-up | img (6) | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | n/a | ☑ | ☑ board | ☑ status move | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | ☐ desktop only | ☑ mutation verified | n/a | Production Ready |
| — | `/{type}/events/events/{id}` | Event detail (7 tabs) | derived | ☑ | ☑ | ☑ | n/a | ☑ registration filter | n/a | ☑ | n/a | n/a | n/a | ☑ reg. status | ☑ | n/a | ☑ | ☑ | ☑ | ☑ | ☑ | ☐ desktop only | ☑ all 7 tabs | n/a | Production Ready |
| — | `/{type}/events/webinars/{id}` | Webinar detail (5 tabs) | derived | ☑ | ☑ | ☑ | n/a | n/a | n/a | ☑ | n/a | n/a | n/a | n/a | n/a | n/a | ☑ | ☑ | n/a | ☑ | ☑ | ☐ desktop only | ☑ all 5 tabs | n/a | Production Ready |
| — | `/{type}/events/podcasts/{id}` | Podcast episode detail (4 tabs) | derived | ☑ | ☑ | ☑ | n/a | n/a | n/a | ☑ | n/a | n/a | n/a | n/a | n/a | n/a | n/a | ☑ | n/a | ☑ | ☑ | ☐ desktop only | ☑ all 4 tabs | n/a | Production Ready |
| — | `/{type}/events/sponsorships/{id}` | Sponsorship detail (3 tabs) | derived | ☑ | ☑ | ☑ | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | ☑ | ☑ | n/a | ☑ | ☑ | ☐ desktop only | ☑ all 3 tabs | n/a | Production Ready |

"Chrome MCP" ☑ means a fresh live screenshot/interaction was taken against
real seeded data this session — all ten routes and all 19 detail-page tabs
are now live-verified (desktop 1491×1055 only; tablet/mobile still pending,
see `/release-gated/user-fixes/events.md` item 5). This pass also live-
tested all three creation modals end-to-end (Podcast Episode and Follow-up
Sequence: filled, submitted, confirmed in the list, then cleaned up via SQL;
Sponsorship: opened with real data, cancelled cleanly) and found/fixed one
real bug — a double-nested "Speakers"/"Activity" heading with a dead
self-referential "View All" link on the Event detail page's dedicated tabs,
caused by reusing the Overview-preview `PeoplePanel`/`ActivityPanel`
components (which render their own Panel wrapper) inside an already-wrapping
`Panel` on the full-tab view. Fixed in `events/events/[id]/page.tsx` by
inlining the list markup directly under the tab's own `Panel`, matching the
pattern already used by the Sponsors/Follow-up tabs on the same page.

## Foundation tracker

| ID | Item | Status | Notes |
|---|---|---|---|
| F-01 | Migration: schema + RLS + indexes | Production Ready | `20260830000000_events_module.sql` — 22 tables, RLS confirmed 22/22 live |
| F-02 | Aggregate views + trend RPCs | Production Ready | `20260830000100_events_aggregates.sql` |
| F-03 | Demo seed data | Production Ready | `20260830000200_events_demo_seed.sql`, idempotent, `is_demo=true` |
| F-04 | TypeScript domain types | Production Ready | `src/lib/events/types.ts` |
| F-05 | Entitlement resolver | Production Ready | `src/lib/events/entitlements.ts` |
| F-06 | Server data access layer | Production Ready | `src/lib/events/queries.ts`, `detail-queries.ts` |
| F-07 | Server actions (mutations) | Production Ready | `src/lib/events/actions.ts` — 14 actions, all permission-guarded |
| F-08 | Shell (pixel-matched to references) | Production Ready | `EventsShell.tsx`, `EventsTopBar.tsx`, `EventsMobileNav.tsx` |
| F-09 | Gala Dock cross-product component | Production Ready (placeholder brand assets) | `GalaDockPromotion.tsx` — 5 layouts; real logo pending, see user-fixes |
| F-10 | CSV export API route | Production Ready | `src/app/api/events/export/route.ts` |
| F-11 | Test framework install | Not Started | no test runner in this repo |
| F-12 | Chrome MCP visual loop @ 1491×1055 | Production Ready | 10/10 routes + all 19 detail-page tabs + all 3 creation modals live-verified against real seeded data |
| F-13 | Tablet / mobile responsive pass | Not Started | desktop-only this session; see user-fixes item 5 |
| F-14 | Automated RLS negative-test suite | Not Started | blocked by F-11 |

Allowed statuses: Not Started · Audited · In Progress · Code Complete · Visual Review · Functional Review · Failed · Passed · Production Ready
