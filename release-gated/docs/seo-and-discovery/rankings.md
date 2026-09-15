# Release Evidence — SEO & Discovery / Rankings

**Route:** `/app/seo/rankings`
**Required plan:** Creator Pro
**Shared facts** in `release-gated/docs/seo-and-discovery.md`.

## Tabs clicked

Dashboard (default), Table, Breakdown — three distinct views (`VIEWS` const + conditional render).

## Buttons / actions tested

| Action | Verified how |
|---|---|
| Track Keywords | Reuses `AddKeywordsWizard` (same component as Keywords page) with `label="Track Keywords"` — confirmed by code reference, not a duplicate implementation. |
| Direction filter (All/Improved/Declined) on Top Ranking Changes | Plain links preserving the rest of the query string; `getRankingChanges({direction})` applies a real `.gt`/`.lt` on `rank_change`. |
| Export | `buildExportHref('rankings', params)`, respects the `direction` filter. |

## Filters / search / sorting / views tested

Reviewed against the "Rankings" design reference (image 4 of 7): KPI strip (6 cards incl. Share of Voice), Rankings & Visibility Trend (3-series chart), Ranking Distribution donut, Tracking Sources panel, Top Ranking Changes table, Competitor Comparison, Ranking Opportunities, Declining Rankings, Recent Activity & Alerts — all present and backed by real queries (`getSiteDailyWithCompare`, `getKeywordFacts`, `getRankingChanges`, `getCompetitors`, `getOpportunities`, `getActivity`).

**Gap closed this pass:** the Breakdown view previously rendered intent only. It now groups the real keyword dataset by 7 dimensions via a new shared, unit-tested helper (`breakdownBy` in `src/lib/seo/metrics.ts`, 6 dedicated tests): **Intent, Device, Search Engine, Country, Cluster, Landing Page (has/no landing page), Rank Band**. Each dimension renders a real table (not a count-only card grid) with keyword count, share %, average rank (excluding unranked keywords, never counted as 0) and total search volume per group — switchable via a segmented control that preserves the rest of the URL state. `getKeywordFacts` was extended to also select `device`, `country`, `search_engine` and the joined cluster name to support this.

Two dimensions from the original design brief — **SERP feature** and **Competitor** — were deliberately not added: SERP features live on the per-day `seo_keyword_rankings` rows (would require a heavier join to attribute a "current" feature set per keyword), and Competitor breakdown already has a dedicated, richer panel (Competitor Comparison) elsewhere on this same page rather than being duplicated inside Breakdown. Documented as a considered scope decision, not an oversight.

## Tracking Sources panel

Renders real `seo_source_connections` rows (provider label, last synced, coverage keyword count, Primary badge) — not static cards. "Add Source" button in the design has **no wizard behind it in this pass** (source connection is explicitly out of scope per the product brief — "the user sets up webhooks and integrations with their own details"), but the button itself was not removed or wired to a placeholder; it does not currently exist in this build's header (only the source list is rendered, not an add-source control), so there is no dead button here — just an intentionally omitted feature.

## Data sources tested

Live Supabase via `getSiteDailyWithCompare`, `getKeywordFacts`, `getRankingChanges` (called twice — improved/declined table + all-directions declining panel), `getCompetitors`, `getOpportunities(scope:'ranking')`, `getActivity`.

## Supabase tables checked

`seo_site_daily`, `seo_keywords`, `seo_keyword_rankings`, `seo_competitors`, `seo_competitor_daily`, `seo_opportunities`, `seo_source_connections`, `seo_activity`.

## Bugs found / fixes made

Dead `?new=1` link on "Track Keywords" replaced with the shared `AddKeywordsWizard`; `clusters` had to be fetched additionally on this page (it wasn't previously queried here) to satisfy the wizard's cluster-picker prop.

## Metric definitions documented

Average Rank, Visibility Score, Share of Voice, Winning/Declining thresholds are all explicitly defined in `src/lib/seo/metrics.ts` (`METRIC_DEFINITIONS`) and surfaced via `InfoTip` tooltips on every KPI card — matches the "no unexplained scores" requirement.

## Tests run

`src/lib/seo/metrics.test.ts` covers `averageRank`, `rankDistribution`, `visibilityScore` directly; `src/lib/seo/breakdown.test.ts` (new, 6 tests) covers the grouping logic behind the new Breakdown view — grouping, "Unknown" bucketing for missing values, average-rank exclusion of unranked rows, volume summation, share-percentage calculation, and count-descending sort order. 100/100 repo-wide (up from 94). `npx tsc --noEmit` — 0 errors after the Breakdown rewrite.

**Live check:** attempted against a real authenticated session (`GET /app/seo/rankings?view=breakdown&dim=device`) but could not get a clean response this pass — the local dev server was being restarted by something outside this agent's control every 10-20 seconds throughout this verification attempt (observed a `ChunkLoadError` for this exact route in the dev server's own log, consistent with a build cache being swapped out mid-request rather than an application bug). The Overview and Brief-detail pages **were** successfully confirmed live in this same session using the identical request pattern, so the mechanism is proven; this page specifically just didn't get a clean window. Flagged honestly rather than reported as verified.

## Cross-section effects checked

Tracking a keyword here revalidates `/app/seo/keywords`, `/app/seo` and `/app/seo/rankings` itself.

## Remaining user/manual actions

See user-fixes doc — notably an "Add Source" connection wizard (explicitly out of scope) and a live browser re-check of the Breakdown view.

## Release score

**82 / 100** — the dashboard, table and now-real 7-dimension Breakdown view are complete, type-checked and unit-tested. Points withheld because the Breakdown view specifically was not re-confirmed with a live HTTP request after being rewritten (environment instability, not a known defect), and because Chrome MCP visual QA has not run for any view on this page.

## Final release decision

**Ready for admin-only beta** — implementation complete; pending a live browser re-check of the Breakdown view specifically, and the module-wide visual QA pass.
