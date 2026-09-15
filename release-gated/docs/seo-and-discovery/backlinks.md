# Release Evidence — SEO & Discovery / Backlinks

**Route:** `/app/seo/backlinks`
**Required plan:** Team
**Shared facts** in `release-gated/docs/seo-and-discovery.md`.

## Tabs clicked

Table (default), Cards, Opportunities — three distinct views.

## Buttons / actions tested

| Action | Verified how |
|---|---|
| Add Outreach List | `AddOutreachListWizard` + `createOutreachList` action reviewed: name required/deduped per site, description optional. |
| Add to List (per opportunity, both in the sidebar panel and the Opportunities tab) | `AddToListButton` + `addOpportunityToList` action reviewed: looks up the real opportunity row scoped to the workspace/site, upserts into `seo_outreach_list_items` on `(list_id, domain)` conflict, permission-gated behind `backlinks.createOutreach` — the button is hidden entirely (not just disabled) when the viewer lacks that capability. |
| Filters (status incl. "toxic" grouping both `toxic`+`suspected_toxic`, link type) + search | `FilterBar`; `getBacklinks()` applies each. |

## Accuracy check (authority-score naming)

`METRIC_DEFINITIONS.authorityScore` and the KPI tooltip both explicitly state this is *"Caption Fox internal authority score... NOT Moz Domain Authority or Ahrefs Domain Rating"* — reviewed to confirm no page or tooltip anywhere claims a third-party metric this build does not actually compute.

## Filters / search / sorting / views tested

Reviewed against the "Backlinks" design reference (image 7 of 7): KPI strip (6 cards), Backlinks table/cards, Authority Score Trend, New vs Lost Links (grouped bars), Top Linked Pages, Alerts (derived from the real activity feed's warning/critical rows, not a separate fabricated list), Top Link Opportunities with documented match-score formula, Recent Activity — all present and backed by real queries.

## No fabricated outreach/email system

Per the explicit instruction not to invent an email-outreach system where none exists in the repository: this build's "outreach" feature is limited to **list management** (`seo_outreach_lists`, `seo_outreach_list_items`) — there is no email composer, send action, or CRM-style contact tracking anywhere in this module, and none is implied by any button label.

## Data sources tested

Live Supabase via `getBacklinks`, `getLinkOpportunities`, `getOutreachLists`, `getTopLinkedPages`, `getActivity`.

## Supabase tables checked

`seo_backlinks`, `seo_link_opportunities`, `seo_outreach_lists`, `seo_outreach_list_items`, `seo_top_linked_pages`.

## Bugs found / fixes made

Dead `?new=1` link replaced with `AddOutreachListWizard`; wired the previously-unimplemented "Add to List" action (present in the design reference but not built in the first pass) into both places it appears.

## Tests run

`src/lib/seo/metrics.test.ts` covers `linkMatchScore` (the documented `0.6 × relevance + 0.4 × authority` formula) directly. 94/94 repo-wide.

## Cross-section effects checked

Creating a list or adding an opportunity to it revalidates `/app/seo/backlinks`.

## Remaining user/manual actions

See user-fixes doc.

## Release score

**56 / 100** — real data, real list-management writes, and a rigorously honest authority-score disclosure. No live click-through confirmation.

## Final release decision

**Blocked pending manual fix** (browser QA pass).
