# Release Evidence — SEO & Discovery / Briefs

**Parent section:** SEO & Discovery (`/app/seo`)
**Sub-tab:** Briefs
**Routes:** `/app/seo/briefs`, `/app/seo/briefs/[id]`
**Required plan:** Creator Pro (view/create) · Team (review)
**Shared facts** (RLS, migrations, test suite) in `release-gated/docs/seo-and-discovery.md`.

## Tabs clicked

Cards (default), Table, Board — three distinct renderers (`CardsListView`, `TableView`, `BoardView`). Board groups by the real `status` enum (draft → in_progress → awaiting_review → changes_requested → approved → published), matching the design's Kanban columns.

## Buttons / actions tested

| Action | Verified how |
|---|---|
| Create Brief (Overview + Briefs headers) | `CreateBriefWizard` + `createBrief` action reviewed: title/keyword required, auto-matches an existing tracked keyword by case-insensitive name, redirects to the new brief's detail page on success. |
| Empty-state "Create your first brief" | Same wizard, `variant="link"` rendering — confirmed it is the same component, not a second dead link. |
| Brief row/card click-through | Links to `/app/seo/briefs/[id]`, a real detail page querying the same `seo_content_briefs` row plus its sections and comments. |
| Filters (status, content type, priority) + search | `FilterBar`; `getBriefs()` applies each as a real query clause. |
| Sort (due date, completion, traffic potential, title) | `SortSelect`, 4 options. |

## Forms tested

Create Brief wizard: title, target keyword, content type (9 options), priority, due date. Server-validated required fields.

## Detail page (`/app/seo/briefs/[id]`) — editing workflow closed this pass

Previously read-only; now has a real edit/review/publish workflow, confirmed live against the seeded "Ultimate Guide to Keyword Research" brief (`GET /app/seo/briefs/cd8834f6-d718-43af-b9c0-0dc4b78e7665` → 200, rendered HTML contains the live status control, outline editor and comment composer, not the old static markup):

- **Status control** (`BriefStatusControl`): a select bound to `updateBriefStatus`. Requires `briefs.edit` for any transition and additionally `briefs.publish` to set `published` (which also stamps `published_at`). Writes a `seo_activity` row and an audit-log entry recording the from/to status. Renders as a plain `StatusChip` (no control) for a viewer who lacks `briefs.edit`, rather than a disabled-but-visible dropdown.
- **Outline editor** (`BriefOutlineEditor`): toggle a section complete/incomplete (`toggleBriefSection`), add a new H1/H2/H3 section (`addBriefSection`), remove a section (`removeBriefSection`), and reorder with up/down (`moveBriefSection`, swaps the two rows' `position` values). Every write recalculates `seo_content_briefs.completion` server-side from the real section-completion ratio (`recalculateBriefCompletion`) — the completion percentage shown elsewhere in the app is never stale after an edit. All five actions are gated behind `briefs.edit` and hidden (not disabled) for viewers without it.
- **Comment composer** (`BriefCommentComposer`): posts through `addBriefComment`, gated behind `briefs.comment`, 2000-character cap, writes a `seo_activity` row.
- Source-keyword panel (rank, volume, difficulty, CPC) only renders when a `keyword_id` match exists — confirmed the conditional, not a fake empty state.
- 404s via `notFound()` for a brief ID that doesn't belong to the current workspace/site — reviewed, not clicked live.

**Not yet built:** editing a section's title after creation (only add/remove/reorder/toggle exist), and threaded comment replies (the `parent_id` column and `addBriefComment(id, body, parentId)` support it, but no reply-UI was built — every comment posts as a top-level comment).

## Filters / search / sorting / views tested

Covered at the logic level by `url-state.test.ts`; page wiring reviewed against the "Briefs" design reference (image 3 of 7) — KPI strip (6 cards), Brief Insights panel, Brief Outline Preview, Opportunities to Brief Next, Recent Activity, Comments all present and mapped to real queries, not static mockup content.

## Exports/imports tested

Export reviewed (`surface=briefs`, respects q/status/contentType/priority/sort). Not exercised live. No import — briefs are created one at a time by design (no bulk-brief-creation workflow existed in the source design references).

## Data sources tested

Live Supabase via `getBriefs`, `getBriefCounts`, `getBriefSections`, `getBriefComments`, `getOpportunities(scope:'content')`.

## Supabase tables checked

`seo_content_briefs`, `seo_brief_sections`, `seo_brief_comments`, `seo_keywords` (for the auto-match).

## Bugs found / fixes made

Same class of `?new=1` dead-link fix as every other page, applied twice (header create action + empty-state link) since Briefs is the only page with two separate entry points to the same wizard. This pass additionally closed the "detail page is read-only" gap flagged in the previous evidence pack — see the Detail page section above.

## Migrations applied

None specific to this page beyond the shared migration.

## Tests run

Repo-wide 100/100 unit tests pass (94 → 100 this pass, +6 for the new `breakdownBy` helper used elsewhere in the module). No Brief-specific unit tests were written (the business logic here is mostly CRUD plus a keyword-matching lookup and a completion-percentage recalculation, judged lower-risk than the scoring/entitlement logic that received dedicated tests). `GET /app/seo/briefs/[id]` confirmed live: 200, with the status control, outline editor and comment composer all present in the rendered HTML.

## Performance / security findings

`createBrief`'s keyword auto-match runs a `.ilike()` lookup scoped to `workspace_id` + `site_id` before insert — cannot leak or match a keyword from another workspace.

## Cross-section effects checked

Creating/updating a brief revalidates `/app/seo/briefs` and `/app/seo`.

## Remaining user/manual actions

See `release-gated/user-fixes/seo-and-discovery.md`. Notably: section-title editing and threaded comment replies are not built (see the Detail page section above) — neither was in the original design reference, so they're a scope decision, not a defect.

## Release score

**88 / 100** — creation flow, detail page, status transitions, outline editing and comment posting are all real, permission-gated, and confirmed live (`GET` request against a real seeded brief returns 200 with every new control present in the rendered HTML). The remaining 12 points are withheld because no browser click-through (as opposed to a server-rendered HTML fetch) confirmed the client-side interactivity — the `useTransition`/`router.refresh()` round trip — actually completes in a real browser, and because Chrome MCP visual QA against the design reference has still not run.

## Final release decision

**Ready for admin-only beta** — the implementation is complete and live-render-verified; a full click-through browser QA pass (tracked in the user-fixes doc) is the only thing standing between this and a general release decision.
