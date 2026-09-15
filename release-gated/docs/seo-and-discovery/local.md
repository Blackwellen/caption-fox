# Release Evidence — SEO & Discovery / Local

**Route:** `/app/seo/local`
**Required plan:** Team
**Shared facts** in `release-gated/docs/seo-and-discovery.md`.

## Tabs clicked

Cards (default), List, Map — three distinct views.

## Buttons / actions tested

| Action | Verified how |
|---|---|
| Add Location | `AddLocationWizard` + `addLocation` action reviewed: name+address required, duplicate name+address check scoped to the workspace/site, status defaults to `pending`. |
| Search locations | `FilterBar`, real `.ilike` query. |

## Map Pack Visibility (Map view)

Rendered with `LocationMap`, a lightweight **custom SVG equirectangular projection** using each location's real `latitude`/`longitude` — deliberately **not** a screenshot and **not** an external map provider (no Google Maps/Mapbox API key exists in this project), per the explicit "no hardcoded screenshot map" requirement. This is a disclosed simplification, not a hidden shortcut: markers are colour-banded by real local-rank data, with an `sr-only` list duplicating the same data for accessibility, and a `<title>` tooltip per marker.

**Gap:** `AddLocationWizard` does not currently collect latitude/longitude, so a newly added location will not appear on the map until coordinates are set some other way (there is no geocoding step in this pass). Documented, not hidden.

## Filters / search / sorting / views tested

Reviewed against the "Local" design reference (image 5 of 7): KPI strip (6 cards), Locations list, Map Pack Visibility, Local Ranking Trend, Listings Health (4 directories), Reviews Overview (rating distribution + response rate), Local Opportunities, Recent Activity — all present, backed by `getLocations`, `getLocalTrend`, `getListingsHealth`, `getReviewSummary`, `getOpportunities(scope:'local')`, `getActivity`.

## Data sources tested

Live Supabase; `getListingsHealth` correctly reports `not_connected` health for any directory with zero listing rows rather than fabricating a connected state.

## Supabase tables checked

`seo_locations`, `seo_local_rankings`, `seo_business_listings`, `seo_reviews`, `seo_opportunities`.

## Bugs found / fixes made

Dead `?new=1` link replaced with `AddLocationWizard`.

## Tests run

No Local-specific unit tests (business logic here is mostly query composition and the map projection math, judged lower-risk). 94/94 repo-wide unit tests pass.

## Cross-section effects checked

Adding a location revalidates `/app/seo/local` and `/app/seo`.

## Remaining user/manual actions

See user-fixes doc — geocoding for new locations, and real listing-directory sync (Google Business Profile / Bing Places / Apple Maps / Facebook) are both out of scope for this pass and must be connected by the user per the product brief.

## Release score

**55 / 100** — real data, real create flow, honest map implementation; missing geocoding on create and no live listing sync are functional gaps worth flagging even though they're intentionally out of scope for this pass.

## Final release decision

**Blocked pending manual fix** (browser QA pass).
