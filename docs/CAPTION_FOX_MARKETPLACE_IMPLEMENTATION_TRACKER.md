# Caption Fox — Marketplace Implementation Tracker

Nine canonical routes, one shared implementation. Status as of **2026-09-16**.

Full evidence: `release-gated/docs/marketplace.md`.
Manual actions outstanding: `release-gated/user-fixes/marketplace.md`.
Screenshots: `docs/ui-verification/caption-fox/marketplace/` (`*-reference.png` vs `*-implementation.png`).

Legend: ✅ done · ➖ not applicable to this page · ⚠️ see notes

| ID | Route | Views | Shell | Visual match | Real data | Search | Filters | Cards | List/Table | Compare | Save | Requests | Orders | Escrow | Disputes | Permissions | Empty | Error | Responsive | Chrome MCP | Screenshot compared | Tests | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 5.14.01 | `/app/marketplace` | cards | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ➖ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Production Ready |
| 5.14.02 | `/app/marketplace/discover` | cards, list | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ➖ | ➖ | ➖ | ➖ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Production Ready |
| 5.14.02.01 | `/app/marketplace/discover/influencers` | cards, list | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ➖ | ➖ | ➖ | ➖ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Production Ready |
| 5.14.02.02 | `/app/marketplace/discover/services` | cards, list | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ➖ | ➖ | ➖ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Production Ready |
| 5.14.02.03 | `/app/marketplace/discover/ugc-creators` | cards, list | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ➖ | ➖ | ➖ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Production Ready |
| 5.14.03 | `/app/marketplace/categories` | grid, list | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ➖ | ➖ | ➖ | ➖ | ➖ | ➖ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Production Ready |
| 5.14.04 | `/app/marketplace/saved` | cards, list | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ➖ | ➖ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Production Ready |
| 5.14.05 | `/app/marketplace/requests` | cards, table | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ➖ | ➖ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Production Ready |
| 5.14.06 | `/app/marketplace/orders` | table, cards | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ➖ | ➖ | ✅ | ✅ | ⚠️ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Ready behind Stripe Connect setup |

## Notes

- **Services:** portfolio thumbnails now sit under each provider cover, fed by real portfolio media.
- **Requests:** matches the reference: a scrolling card row of recent requests above the paginated
  "All requests" table (with export).
- **Influencers:** the card shows the real starting rate ("From £X") rather than a range. The previous
  upper bound was computed as starting price × 2.1, which was not real data. The "Recent campaigns"
  strip reads `marketplace_portfolio_items` (the same source as Services/UGC); it is hidden when a
  creator has no portfolio rows.
- **Columns menu (Requests, Orders):** hides table columns per browser (localStorage, read via
  `useSyncExternalStore`, so there's no hydration mismatch). ID and Actions always stay visible.
- **Compare tray (all discovery pages):** appears once profiles are selected (state lives in the URL),
  floats inside the content width and stops at the right rail.
- **Save search:** a popover control (`SaveSearchControl`). Discover, Services and UGC show it in the
  results bar, as the references do; Discover and UGC put the search button inside the keyword field.
- **Overview:** featured suppliers page three at a time with header arrows; activity uses solid event
  icons plus "View all activity"; compact tables use short status wording.
- **Orders:** the milestone tracker is a donut of delivery states; "Recent order activity" sits in the
  bottom row and is filtered to order/dispute events (it previously showed saved-search events).
- **Discover modes:** on desktop the specialist-search links sit at the right end of the tab row (no
  extra row); tablet and mobile keep a scrollable row. Previous note: the reference has no specialist-search row. A compact one is kept because it is the
  only navigation into Influencer / Services / UGC search.
- **Orders (⚠️ escrow):** escrow moves against the local ledger; live settlement needs Stripe
  Connect credentials from the account owner (see user-fixes).

## Defects fixed during this pass

| Severity | Defect | Fix |
|---|---|---|
| Blocker | RLS infinite recursion made `marketplace_requests` unreadable for every buyer | `supabase/migrations/20260916000000_marketplace_requests_policy_recursion.sql` |
| High | On-time delivery measured the deadline against *today*, so delivered orders decayed to "late" (read 0.0%) | `getOrderInsights` now compares `completed_at` with `due_date`; regression test added |
| Medium | Completed/delivered orders badged "overdue" | Urgency suppressed once an order is settled |
| Low | KPI deltas could report "↑2700%" off a tiny baseline | Deltas suppressed below a 5-record prior period |
| Low | Empty category rendered a `0.0` star rating | Renders "No suppliers yet" |
| Low | Duplicate verification badge truncated creator names | Redundant pill removed |
| Low | A demo cover carried third-party brand content | Photo replaced |
| Medium | Influencer "Rate range" upper bound was invented (price × 2.1) | Shows real starting rate |
| Low | Boolean filter rendered a literal "false" chip on Saved | `filterValue` maps booleans to '' / 'true' |
| Low | Orders table needed horizontal scroll at 1491 (actions hidden) | Table fits; actions visible |
| Low | Unnamed form fields and unsized lazy images (browser issues) | `name` attributes and image dimensions added |
| Visual | Density, column widths and panel placement drifted from references across all 9 pages | Re-measured against references at 1491×1055 and aligned |
