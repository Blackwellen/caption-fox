# Release Evidence — Web & Conversion Overview

**Section:** Web & Conversion Overview
**Route:** `/app/web`
**Phase:** 1 of a multi-phase build (see `docs/CAPTION_FOX_WEB_CONVERSION_IMPLEMENTATION_TRACKER.md` for full scope, phasing decision and what remains)

## What was tested

- Route loads for an authenticated workspace member on the `small_business`, `brand` and `agency` demo workspaces (the `Sidebar.tsx` nav allowlist gates `/app/web` off `creator` workspaces intentionally — no equivalent conversion-page workflow exists for individual creators, who already have `/app/links` for link-in-bio pages).
- All six routes (`/app/web`, `/app/web/pages`, `/app/web/forms`, `/app/web/funnels`, `/app/web/experiments`, `/app/web/tracking`) return `307 → /login?next=...` for unauthenticated requests (verified with `curl` against the running dev server — see command below); this confirms the auth gate fires before any data is read.
  ```
  curl -s -D - -o /dev/null http://localhost:3014/app/web         → 307 /login?next=%2Fapp%2Fweb
  curl -s -D - -o /dev/null http://localhost:3014/app/web/pages   → 307 /login?next=%2Fapp%2Fweb%2Fpages
  ... (all six routes verified identically)
  ```
- Entitlement gate (`requireWebModule(module)`) renders `AccessBlocked` for roles/plans without access instead of a raw error or blank page — `experiments` and `tracking` are gated to Team+ plan, everything else to any role holding `web.view`.
- KPI strip (Active pages, Active forms, Funnel conversion rate, Experiment uplift, Qualified leads, Tracking health), the four insight panels (Top landing pages, Form performance, Funnel performance, Experiment performance), Next actions, Tracking health / Top traffic sources / Device breakdown / Conversions over time, and the mixed Web experiences table — all query live Supabase data via `src/lib/web/data.ts`; no hardcoded numbers anywhere in the page.
- Every KPI and derived metric has a documented, inspectable formula (not an arbitrary display value):
  - **Tracking health** = weighted average of tracking events (healthy = 1, warning = 0.5, critical = 0).
  - **Qualified leads** = completed submissions on published `lead_capture`/`registration` forms.
  - **Funnel conversion rate** = total conversions ÷ total entries across active/at-risk funnels.
  - **Experiment uplift** = average of `(variant rate − control rate) ÷ control rate` across running/analyzing/completed experiments.
  - **Experiment confidence** = a two-proportion z-test (`computeExperimentStats` in `src/lib/web/data.ts`), requiring ≥100 visitors per arm before reporting a confidence figure at all — below that threshold the UI shows "Collecting data" rather than a fabricated percentage.
  - **Pages needing attention** = published pages with >100 sessions converting below 2%.
- Search, status/owner filters, date range and Cards/Table view all write to the URL (`?q=&status=&owner=&from=&to=&view=`) via the shared `CampaignFilters` component, so refresh/back-forward/shared links restore the exact same view — verified by code path (this is the same component already proven on Campaigns/Messaging).
- Export (`/app/web/export?entity=pages|forms|funnels|experiments|tracking_events`) is permission-gated, filter-respecting, and writes a `web_activity` audit row on every export.
- Empty states verified by code inspection: every panel and the mixed table branch on `rows.length === 0` and render a `WebEmpty`/inline empty message rather than blank space or fabricated rows.
- `npx tsc --noEmit` across the full repo: **0 errors** — 0 pre-existing, 0 introduced by this change.
- Dev server log (`.next/dev/logs/next-development.log`) inspected after hitting all six routes: no error attributable to any `web/*` file (the only entries present are pre-existing, unrelated warnings — a `SecondaryHeaderActions` key warning and a missing `[workspaceType]/calendar/agenda` page, both predating this change).

## Not tested this phase

- **Chrome MCP browser verification at 1440/1280/1024/tablet/mobile/PWA** against the reference image `designs/Web & Conversion/ChatGPT Image Aug 29, 2026, 02_21_30 PM (1).png` — **blocked**, not skipped: the shared `chrome-devtools-mcp` Chrome profile was already locked by another running browser instance for the whole session, so no authenticated browser session could be opened. See `release-gated/user-fixes/web/overview.md` for the exact unblock step and re-run instruction.
- RLS positive/negative tests with a second test workspace/user — not independently re-verified this session (policies mirror the proven `messaging_*` RLS pattern exactly).
- Load/performance testing.
- Accessibility audit (keyboard nav, ARIA, contrast) — built using the same primitives already used elsewhere in the app, but not independently re-checked.

## Data sources / Supabase objects

- Tables: `web_pages`, `web_forms`, `web_funnels`, `web_funnel_steps`, `web_experiments`, `web_tracking_destinations`, `web_tracking_events`, `web_metrics_daily`, `web_activity`.
- All nine tables are workspace-scoped with RLS policies named `"<table>_workspace"` using `workspace_id in (select workspace_id from workspace_members where user_id = auth.uid())` — identical pattern to every other Campaign Manager module in this repo.
- Migration: `supabase/migrations/20260905000000_web_conversion_module.sql` — applied to the live project via `node scripts/apply-migration.mjs`.
- Demo seed data: `scripts/tmp/seed-web-demo.sql`, applied to workspace `173b63f8-3263-4609-a4f7-c6e113f25bda` ("Jamahl Thomas Growth Co.", `small_business`) — 6 pages, 6 forms, 5 funnels (main funnel has 5 steps), 4 experiments, 6 tracking events, 8 tracking destinations, 180 daily metric rows (30 days × 6 source/device combinations), 5 activity rows. Re-runnable and idempotent.

## RLS policies checked

- Policy shape confirmed present on all nine tables via the migration file itself; not independently exercised against a second workspace this session (see "Not tested this phase").

## Edge functions checked

- None — this phase reads/writes directly through Supabase RLS-scoped queries and one Next.js route handler (`/app/web/export`). No edge functions are used by Overview.

## Storage buckets checked

- Not applicable this phase — no file uploads exist on Overview.

## Integrations checked

- None live yet. `web_tracking_destinations` provider rows (GA4, Meta Pixel, LinkedIn Insight Tag, Google Ads, Webhook, CRM, Segment, Warehouse) are seeded as records for the Tracking health panel to summarise; no destination actually receives events yet — that is Tracking's own phase.

## Bugs found / fixed

- During implementation, an initial edit to `src/lib/permissions.ts` conflicted with a concurrent edit that had added a `Partnerships` permission block to the same file between read and write — caught by the tool's stale-file guard, re-read, and re-applied cleanly with no lost work.
- Fixed an initial bug where the "Top landing pages" panel used the default `updated_at`-sorted query result instead of ranking by session volume — corrected to sort by `sessions` descending in the page before rendering.
- Fixed a leftover no-op `<LoadError message="" className="hidden" />` placeholder left in from an earlier draft of the page — removed.
- Made the Cards/Table view toggle in the filter bar actually functional (added `WebExperienceCards.tsx`) rather than leaving it as a dead control that only ever rendered the table.

## Migrations applied

- `supabase/migrations/20260905000000_web_conversion_module.sql` (schema)
- `scripts/tmp/seed-web-demo.sql` (demo data only — not a schema migration, not committed to `supabase/migrations`)

## Tests run

- `npx tsc --noEmit -p tsconfig.json` — full repo, 0 errors.
- `curl` smoke test of all six routes' auth redirect behaviour (see above).
- Dev server log inspection for runtime errors after route compilation.
- No automated unit/integration/E2E test suite exists yet for this module — none was added this phase; this is called out explicitly rather than claimed as done.

## Performance/security findings

- No N+1 query patterns: `webAggregates` does one `select` per entity table (5 total), `metricSeries` does one query, `listWebExperiences` does five bounded (`limit: 200`) parallel queries then merges/sorts/paginates in memory — documented in-code as a scaling caveat once a workspace's combined row count grows past a few thousand (should move to a materialized view at that point).
- Export route re-validates permission and workspace scope server-side before querying — it does not trust client-supplied filters beyond using them to narrow the same RLS-scoped query the user already sees.
- No secrets, service-role keys or other sensitive values are read or exposed anywhere in this module.

## Cross-section effects checked

- None yet — Web & Conversion does not currently write into Campaigns, Messaging or any other module's tables. It defines its own `web_activity` feed rather than the shared one, matching the Messaging module's precedent (`messaging_activity` is likewise its own table, not shared).

## Pending manual/user actions

See `release-gated/user-fixes/web/overview.md`.

## Release score: 55/100

Real schema, RLS, entitlements, documented statistics, and a fully live-data-driven Overview page are in place and type-check cleanly. The score is held below the 70s because: (a) Chrome MCP visual verification against the approved reference image could not run this session due to an environment lock, so pixel-level fidelity to the design is unverified; (b) five of the six primary routes (Pages, Forms, Funnels, Experiments, Tracking) are intentionally-honest "coming next" stubs rather than built surfaces — by design, per the phasing decision agreed with the user, but the module as a whole is far from complete; (c) no automated test coverage exists yet.

## Final release decision: **blocked pending manual fix**

Overview is code-complete and functionally real for Phase 1, but cannot be marked release-ready until: (1) the Chrome MCP browser lock is cleared and visual/responsive verification is run against the reference design, and (2) Pages/Forms/Funnels/Experiments/Tracking are built in their own phases. Until then this should be treated as **ready for admin-only beta on the demo workspace**, not a customer-facing release.
