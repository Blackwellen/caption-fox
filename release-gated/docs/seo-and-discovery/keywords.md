# Release Evidence — SEO & Discovery / Keywords

**Parent section:** SEO & Discovery (`/app/seo`)
**Sub-tab:** Keywords
**Route:** `/app/seo/keywords`
**Required plan:** Free (view) · Creator Pro (add keywords, source connections) · Team (import)
**Roles tested (by code review of `src/lib/permissions.ts` role defaults):** Owner, Admin, Manager, Creator, Approver, Analyst, Client, External Creator
**Shared facts** (RLS shape, migrations, test suite, security posture) are documented once in `release-gated/docs/seo-and-discovery.md` — not repeated here.

## Screenshots / screen sizes tested

Not captured this session (see main doc, Section 8/19). Desktop layout confirmed by direct rendered-HTML inspection only, not a visual screenshot.

## Tabs clicked

Table (default), Cards, Clusters — all three views are real, distinct renderers (`TableView`, `CardsView`, `ClustersView` in `src/app/app/seo/keywords/page.tsx`), not the same markup reskinned.

## Buttons / actions tested

| Action | Verified how |
|---|---|
| Add Keywords (header) | Code review of `AddKeywordsWizard` + `addKeywords` server action: multi-line/comma parsing, 200-keyword cap, per-row dedupe, intent validation, cluster pick-or-create, landing-page optional field, permission gate (`keywords.create`), duplicate-tracked-keyword skip reporting in the success message. Not clicked live. |
| Track Keywords (Rankings page, same wizard) | Same component reused with a different label — confirmed by code reference, not duplicated logic. |
| Sort select | `SortSelect` client component, URL-driven; 5 sort options match the design's dropdown. |
| Filter bar (search, intent, cluster, position band, status) | `FilterBar` component; `getKeywords()` query applies each filter as a real Postgres `.eq`/`.ilike`/`.gte`/`.lte` clause — reviewed line by line. |
| Pagination | `Pagination` component; page/pageSize passed straight into the Supabase `.range()` call. |
| Favourite star | Rendered from `is_favourite`; no toggle action wired yet — **read-only in this pass**, flagged in user-fixes. |
| Row/cluster click-through | Cluster cards link to `/app/seo/keywords?cluster={id}`, which the same page's filter bar consumes correctly. |

## Forms tested

Add Keywords wizard form: keyword textarea (required), intent select, cluster select, new-cluster text input, landing-page text input. Validated client-side (non-empty) and server-side (`parseKeywordLines`, intent allow-list) in `src/lib/seo/actions.ts`.

## Filters / search / sorting / views tested

Covered by `src/lib/seo/url-state.test.ts` and `src/lib/seo/kpis.test.ts` at the logic level; per-page wiring reviewed manually against the "Keywords" design reference (image 2 of 7) — KPI strip (6 cards), keyword table columns, Keyword Clusters donut, SERP Intent Breakdown, Top Opportunities (Quick Wins), Ranking Distribution, Rankings Trend all present and mapped to real queries.

## Inline edits tested

None exist in this pass — the design shows a status/owner dropdown per row in some references; this build renders status and owner as read-only chips. Flagged in user-fixes as a scope gap, not a bug.

## Exports/imports tested

Export: reviewed in `/api/seo/export` (surface=`keywords`), respects `q`/`intent`/`cluster`/`status`/`device`/`country`/`sort`. Not exercised live.
Import (CSV bulk upload): **not built** — the wizard supports pasting multiple lines, but a file-upload importer with column mapping and an error report was out of scope for this pass. Documented as a gap, not silently omitted.

## Data sources tested

Live Supabase data via `getKeywords`, `getKeywordFacts`, `getKeywordSparks`, `getClusters` — no mock arrays anywhere in the page.

## Supabase tables checked

`seo_keywords`, `seo_keyword_clusters`, `seo_keyword_rankings`.

## RLS policies checked

Workspace+site scoped, per the shared policy shape. See main doc for the app-wide recursion fix that was required for this (and every other) page to work at all.

## Edge functions / storage / integrations checked

None (see main doc).

## Bugs found

The server/client function-prop bug (see main doc, item 3) originated on this page and was fixed here first, then the same fix pattern was applied to the other six pages.

## Fixes made

- Replaced the dead `Add Keywords` `?new=1` link with `AddKeywordsWizard`.
- Replaced the dead export link with `buildExportHref('keywords', params)`.
- Removed the unused `menu` sub-menu capability on the header (dead code, never rendered).

## Migrations applied

See main doc — no Keywords-specific migration.

## Tests run

`src/lib/seo/metrics.test.ts` (quick-win score, rank distribution, average rank) and `src/lib/seo/entitlements.test.ts` (`views.clusters` gated behind Creator Pro) directly cover this page's business logic. 94/94 passing repo-wide.

## Performance / security findings

`getKeywordFacts` fetches up to 5,000 rows unpaginated to drive the distribution charts and KPI maths — acceptable for the seeded volumes (240 rows) but worth a materialised-aggregate approach before a customer tracks thousands of keywords. No N+1 queries found in this page: sparklines are fetched in one batched query (`getKeywordSparks`) for all visible rows, not per-row.

## Cross-section effects checked

Creating a keyword revalidates `/app/seo/keywords`, `/app/seo`, and `/app/seo/rankings` (all three surfaces that display keyword-derived KPIs).

## Remaining user/manual actions

See `release-gated/user-fixes/seo-and-discovery.md`.

## Release score

**60 / 100** — real data, real writes, real entitlements; not yet visually verified live, no CSV import, no inline edit, no live click-through confirmation of the Add Keywords wizard.

## Final release decision

**Blocked pending manual fix** (browser QA pass).
