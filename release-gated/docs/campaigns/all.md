# Campaigns → All Campaigns — Release Evidence

**Parent section:** Campaigns (`/{type}/campaigns`) · **Sub-tab route:** `/{type}/campaigns/all`
**Gate:** none beyond the Campaigns module · **Reference:** Campaigns (2)
**Screenshots:** `docs/ui-verification/caption-fox/campaigns/all-{reference,implementation}.png`

## Views
Cards (default, **4-up** per the design) and Table, both URL-backed via `?view=`.

## Filters / search / sorting tested
Debounced search across name and description; type, owner, channel, status and priority
inline; health and approval state in the advanced popover; archived toggle; Clear all; eight
sort options; pagination with page size. Result counter reads "Showing 1–12 of 45".

## Actions tested
New campaign · Import (CSV with column mapping, duplicate and invalid-row reporting) ·
Export (CSV honouring the active filters, search and sort) · header overflow menu · per-card
overflow menus · bulk select with bulk owner / stage / priority update and bulk archive.

## Data sources
`campaigns` (owner embedded from `profiles`), `campaign_activity`, `content_posts` counts.
KPI row, all live: Total 45 · Active this month 37 · On track 35 (78%) · Overdue 0 ·
Budget at risk 3 · Pending approvals 4. Card order matches the design exactly (Summer Launch
2024, Brand Awareness Q2, Giveaway: Win Big, Customer Stories, Spring Sale Push, Webinar
Series Q2, Referral Boost, Product Teaser) with the design owners, stages, progress, budgets,
due dates and channel chips.

## Fixes in this pass
Card grid moved from 3-up to 4-up; dense design type applied at `lg`; type-first routing;
removed duplicated `lg:text-` classes that had cards rendering at 8px instead of 10px.

## Shell, responsive and accessibility
Renders inside the locked app shell. Verified at 1491×1055, 820 and 390 (touch): no
horizontal overflow, 32px touch targets and base type retained below `lg`.

## Permissions
Route-gated server-side by `requireCampaignModule`. Bulk actions and export re-check
capability and workspace ownership server-side and write `campaign_activity`.

## Tests
`npx tsc --noEmit -p .` clean for this module; `npx vitest run` — 18 files, 244 tests pass.

## Remaining items
See `release-gated/user-fixes/campaigns.md` (notably: Total reads 45 against the design's 128,
because only the design's own visible records were seeded).
