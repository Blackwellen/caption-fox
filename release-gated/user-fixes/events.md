# Manual Follow-up — Events

Items Claude Code could not complete, with exact steps.

---

## 1. Screenshot pass of the four detail routes + three creation modals — RESOLVED

All ten routes and all 19 detail-page tabs (Event: 7, Webinar: 5, Podcast
episode: 4, Sponsorship: 3) have now been live-verified against real seeded
data with Chrome DevTools MCP at 1491×1055, once the earlier browser-tool
lock cleared. All three creation modals were exercised end-to-end:
"Create Episode" and "Create Sequence" were filled and submitted, confirmed
to appear in their respective lists (with a KPI recalculation proving the
server round-trip), then removed via a one-off SQL cleanup script;
"Create Sponsorship" was opened with real sponsor/event data populated and
cancelled cleanly. One real bug was found and fixed in the process: the
Event detail page's Speakers and Activity tabs double-rendered their
heading and carried a dead "View All" link, because the tab reused the
Overview-preview `PeoplePanel`/`ActivityPanel` components (which supply
their own Panel chrome) inside an outer `Panel` — see
`src/app/[workspaceType]/events/events/[id]/page.tsx`.

**Still outstanding:** the Payments tab's `EventsLockedState` gate for a
role without `sponsorships.viewFinancials` was reviewed in source
(`page.can('sponsorships.viewFinancials')` gates both the Sponsors-tab
value column and the dedicated Payments tab) but not exercised live, since
this session only had an Owner-level session. To confirm live:
1. Create or switch to a workspace member with a role that lacks
   `sponsorships.viewFinancials` (e.g. a restricted Team Member — check
   `src/lib/events/entitlements.ts` `PERMISSION_FOR` for the exact role
   list).
2. Visit `/brand/events/sponsorships/{id}?tab=payments` as that user and
   confirm the locked/upgrade state renders instead of real figures.

---

## 2. Real Gala Dock logo/icon assets

**Why manual:** the original brief referenced `/mnt/data/gala dock
logo.png` and `/mnt/data/gala favicon.png`, but no such files exist in this
environment or were attached to the conversation. `GalaDockPromotion.tsx`
currently renders an inline SVG spiral mark (`GalaDockMark`) and an inline
SVG wordmark (`GalaDockWordmark`) as a faithful stand-in — purple/indigo,
correct proportions, matches the reference images' layout — but it is not
the real Gala Dock brand asset.

**Steps:**
1. Obtain the official Gala Dock logo and favicon files (PNG or SVG,
   transparent background) from the Gala Dock brand team.
2. Save them under `public/brands/gala-dock/` (e.g.
   `gala-dock-logo.png`, `gala-dock-icon.png`), matching the convention
   described in the original brief.
3. In `src/components/events/GalaDockPromotion.tsx`, replace the bodies of
   `GalaDockMark` and `GalaDockWordmark` with `next/image` `<Image>` tags
   pointing at those files. Keep the same `size`/`className` props so every
   call site (5 placements) continues to work unchanged.

---

## 3. Webinar and podcast provider integrations (Zoom, Teams, Spotify, etc.)

**Why manual:** requires real OAuth app registrations and API credentials
per provider, which only the account owner can create.

**Steps:**
1. Decide which providers to launch with first (the schema already
   supports `zoom`, `teams`, `google_meet`, `webinarjam`, `demio`,
   `livestorm`, `youtube_live` for webinars; `riverside`, `spotify`,
   `apple`, `youtube`, `buzzsprout`, `libsyn`, `transistor`, `captivate`,
   `rss` for podcasts).
2. Register OAuth apps with each provider, add client ID/secret to
   environment variables, and build the connect flow under
   `/{type}/integrations` (existing integrations pattern) writing to
   `webinar_details.provider_connection_id` / `podcast_shows
   .provider_connection_id`, which reference the existing `integrations`
   table.
3. Add a background sync job (existing job-runner pattern, if any) to pull
   registrations, attendance, watch time, questions and recording state
   from the connected provider into `webinar_details` / `event_registrations`
   / `webinar_questions`.
4. Until this is done, "Average Watch Time" and "Attendance Rate" correctly
   show "Needs a connected provider" / "—" rather than a fabricated number
   — this is working as intended, not a bug.

---

## 4. Automated RLS negative-test suite

**Why manual:** requires a second seeded workspace + a decision on how this
repo wants to run automated tests (no test runner is currently installed —
confirmed absent from `package.json`).

**Steps:**
1. Install a test runner (Vitest is the lightest fit for a Next.js App
   Router + Supabase project like this one).
2. Write one negative test per Events table: authenticate as a user who is
   a member of Workspace A only, attempt to read/write a row scoped to
   Workspace B's `workspace_id`, assert zero rows / a permission error.
3. Add positive-path tests: correct member can read/write their own
   workspace's rows.
4. Wire into CI once a CI pipeline exists for this repo.

---

## 5. Tablet and mobile responsive QA pass

**Why manual:** blocked by the same Chrome MCP outage as item 1. The
module was built with the same three-tier responsive pattern
(desktop row nav / tablet sliding tray / mobile dropdown) used everywhere
else in Caption Fox (`EventsMobileNav.tsx` implements the mobile dropdown),
but has only been visually verified at the 1491×1055 desktop reference
size.

**Steps:** once the browser tool is available again, resize to 1024, 768
and 390px widths for all ten routes and fix anything that doesn't match
the rest of the app's responsive behaviour.

---

## 6. Podcast episode "Show Notes" editing and Follow-up sequence step editing

**Why manual/deferred, not a bug:** the podcast episode detail page's Show
Notes tab and the follow-up sequence detail/edit screen are read-only in
this release — `show_notes` and sequence steps can be seeded and read, but
there is no in-app editor yet. This was a deliberate scope cut to ship the
six core list pages and their detail routes first, not an oversight.

**Steps:** build a simple form (same pattern as the creation modals in
`src/components/events/CreateModals.tsx`) with a corresponding
`updatePodcastEpisode` / `updateFollowUpSequenceStep` server action
following the exact guard pattern already established in
`src/lib/events/actions.ts`.
