# Release evidence — Studio › Ideas

| | |
|---|---|
| Parent section / route | Studio · `/{type}/studio` |
| Sub-tab / route | Ideas · `/{type}/studio/ideas` (`?view=cards\|list\|board`, `?stage=`, `?source=`, `?score=`, `?owner=`, `?tag=`, `?collection=`, `?selected=`) |
| Required plan / flag | Studio `ideas` module |
| Roles tested | Owner (browser) |
| Reference | `designs/Universal Sections/Studio/ideas.png` @ 1491 × 1055 |
| Score | **86 / 100** |
| Decision | **Ready for admin-only beta** |

## Tested (browser)
KPIs (real 7-day deltas), filter bar (Status, Source, Score, Owner, Tags, More filters), Cards / List / Board, sort, pagination, idea cards with stage menu, idea editor dialog (deep-linked via `?selected`), featured idea, Next actions (task completion), idea collections, trend signals, recent activity, idea pipeline.

## Schema / RLS
New table `studio_idea_tasks` (migration `20260916140000`): FK to `content_ideas` with cascade, title length check, member RLS with parent-idea workspace check on write.

## Business rules (server)
Stage changes only through `setIdeaStage` (`ALLOWED_IDEA_TRANSITIONS`); `saveIdea` strips `stage` on update; `convertIdeaToContent` is idempotent.

## Bugs fixed
Stage bypass through edit; stage styles imported from a client module into a server page; truncated KPI labels; Sort button overflowing the filter card.

## Outstanding
Board drag-and-drop is not implemented (stage changes via menu); per-role negative tests.
