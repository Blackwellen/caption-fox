# Campaigns → Campaign Board — Release Evidence

**Parent section:** Campaigns (`/{type}/campaigns`) · **Sub-tab route:** `/{type}/campaigns/board`
**Gate:** Creator Pro and above · **Reference:** Campaigns (6)
**Screenshots:** `docs/ui-verification/caption-fox/campaigns/board-{reference,implementation}.png`

## Views
Board (default — six columns at the design's 194px width: Planning, In review, Scheduled,
Live, Completed, At risk), Cards and Table.

## Actions tested
Pointer drag-and-drop between stages with an optimistic update, server-side validation
(`canTransitionStage`) and rollback plus an error toast on failure · a keyboard-accessible
"Move to stage" alternative in each card menu · auto-scroll while dragging near an edge ·
search, owner, campaign type and priority filters · Export · New campaign. Illegal
transitions are rejected server-side and the card returns to its original column.

## Data sources
`campaigns` (every matching row, not one page) and `campaign_activity` (surface `board`).
Column headers, the board summary and the stage donut all derive from the same buckets, so
they cannot disagree.

## Fixes in this pass
**Records were mislabelled.** Any lifecycle stage that was not a board column (`in_progress`,
`blocked`) fell into **At risk** — ten cards read at-risk when only three were. There is now an
explicit `BOARD_COLUMN_FOR` map in `src/lib/campaigns/constants.ts` (in-progress → Planning as
pre-review delivery work, blocked → At risk), nothing disappears from the board, and the KPI
row counts the same buckets the columns use. The hardcoded "14% vs last 30 days" KPI hint was
also replaced with a derived value.

## Shell, responsive and accessibility
Locked app shell. Verified at 1491×1055, 820 and 390 (touch): the board scrolls horizontally
by design, page body does not; 32px touch targets; base type retained below `lg`.

## Permissions
Plan gate plus the `manageBoard` capability; drags are refused for users without it and every
stage change is re-checked server-side and audit-logged.

## Tests
`npx tsc --noEmit -p .` clean for this module; `npx vitest run` — 18 files, 244 tests pass,
including stage-transition tests (valid moves allowed, illegal jumps such as planning →
completed rejected).

## Remaining items
See `release-gated/user-fixes/campaigns.md` — in particular, confirm the column mapping is how
you want the board to read, and note completed cards show "—" for due date.
