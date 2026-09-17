# Release evidence — Studio › Hashtags & Keywords

| | |
|---|---|
| Parent section / route | Studio · `/{type}/studio` |
| Sub-tab / route | Hashtags & Keywords · `/{type}/studio/hashtags` (`?tab=sets`, `?selected=`, `?view=cards\|table`, `?kind=`, `?channel=`, `?topic=`, `?language=`) |
| Required plan / flag | Studio `hashtags` module |
| Roles tested | Owner (browser) |
| Reference | `designs/Universal Sections/Studio/hashtags.png` @ 1491 × 1055 |
| Score | **86 / 100** |
| Decision | **Ready for admin-only beta** |

## Tested (browser)
How it works dialog, KPIs (30-day deltas), filter bar, Keyword Clusters / Hashtag Sets list with search + New, group detail (favourite, menu, metrics, **real 30-day volume sparkline**), Top Terms + View all terms dialog (add / remove / block), Suggested Combinations (copy, more), Copy-Ready Output per platform (Copy, Add to composer + draft menu), all-sets table with sparklines and pagination, CSV Export, Recommendations (Trending, Low Competition, Underused Gems, Audience Favourites from published engagement).

## Schema / RLS
`studio_keyword_metrics_daily` (migration `20260916150000`), member read-only; filled nightly by `studio_daily_metrics_snapshot()`; demo history seeded by `scripts/seed-studio-demo.mjs`.

## Actions (server)
`saveKeywordSet`, `addKeywordTerms` (idempotent upsert, blocked terms stripped), `removeKeywordTerm`, `blockTerm` / `unblockTerm` (audited), `toggleKeywordFavourite`, `archiveKeywordSet` (audited), `addTermsToContent`, `logKeywordExport` (`exportHashtags` capability + audit).

## Bugs fixed
Numeric columns as strings; `Intl` compact hydration mismatch; filter bar overflow; tablet platform-tab overflow; KPI label truncation.
