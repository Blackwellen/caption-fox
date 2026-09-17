# Release evidence — Studio › Content Library

| | |
|---|---|
| Parent section / route | Studio · `/{type}/studio` |
| Sub-tab / route | Content Library · `/{type}/studio/content` (`?scope=`, `?selected=`, `?view=cards\|table`, filters, `?size=`) |
| Required plan / flag | Studio `content` module |
| Roles tested | Owner (browser) |
| Reference | `designs/Universal Sections/Studio/content-library.png` @ 1491 × 1055 |
| Score | **85 / 100** |
| Decision | **Ready for admin-only beta** |

## Tested (browser)
KPIs (30-day deltas), search + channel/status/owner + Filter (campaign, tag), Cards / Table, sort, content cards (covers from attached media, short scheduled dates, engagement), Content Records (View scope, column toggle persisted per device, bulk Submit / Approve / Archive, row menu: Preview, Open in Compose, Repurpose, status moves, Archive / Restore, Delete), pagination with first/last + rows per page, Content Preview (Read more, campaign link, **Engagement Snapshot (Last 7 Days)** from `content_engagement_daily`), Recent Activity.

## Schema / jobs
`content_engagement_daily` (migration `20260916150000`), member read-only; nightly increment = lifetime totals minus recorded days (never negative) via `studio_daily_metrics_snapshot()`.

## Business rules (server)
Transitions enforced by `canTransitionContent`; bulk actions re-scope ids to the workspace before updating; published content cannot be deleted; repurpose trims captions per channel.

## Bugs fixed
Portal-based column control replaced with a header slot; "New in the last 7 days" wording on 30-day KPIs; truncated KPI label; crowded scheduled card dates.

## Outstanding
Demo records are mostly < 30 days old, so KPI deltas read very high (e.g. ↑ 3,000%); engagement history for real workspaces depends on the social sync keeping `content_posts.engagement` current.
