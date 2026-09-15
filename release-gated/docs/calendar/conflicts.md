# Release evidence — Calendar › Conflicts

| | |
|---|---|
| Parent section / route | Calendar · `/{type}/calendar` |
| Sub-tab / route | Conflicts · `/{type}/calendar/conflicts` (`?view=cards\|table\|calendar`, `?selected=<id>`) |
| Required plan / flag | Team+ (`calendar.conflicts`) and feature flag `calendar_conflicts` (independent of plan — unit-tested) |
| Roles tested | Owner (browser); read-only / plan / flag via unit tests |
| Reference | `designs/Universal Sections/Calendar/… (4).png` @ 1491 × 1055 |
| Score | **74 / 100** |
| Decision | **Blocked pending manual fix** (shell build error) + outstanding QA |

## Tested (browser, pass 1)
- KPIs: Open 10, High severity 3, Capacity clashes 2, Approval blockers 2, Overlapping launches 1, Resolved this week 3.
- Active conflict cards with severity, status, channels, date, impact, owner, due; pagination (1–6 of 8).
- Resolution panel: rule-based recommended actions with Apply, assignee, due date, status, linked records (campaign, posts, queue jobs), resolution note, Mark as resolved / Dismiss.
- Heatmap by channel × week bucket, Conflicts-by-type donut, Recent resolution activity, table view.

## Detection engine
`src/lib/calendar/conflicts.ts` — owner overlaps, channel spacing / saturation, capacity, approval vs publish date, dependency and date checks; stable signatures prevent duplicates; disappeared conditions auto-resolve; severity is calculated (unit-tested: critical → info range, not constant "High").

## Actions (code-reviewed; not yet browser-exercised)
`updateConflict` (assign — assignee must be a workspace member; due date; status; resolve/dismiss require a note; resolved conflicts must be reopened before editing), `applyConflictRecommendation` (reschedule / space posts / reassign / extend deadline / cancel duplicate — each a real state change, then re-detection), `detectConflictsNow`. All guarded, workspace-scoped, audited, with activity rows.

## Bugs fixed
Cards only 3-up ≥1536 px; rail width; filter wrapping; header-action key warning; "UTC (UTC)".

## Outstanding
Re-screenshot pass 2 at 1491 (blocked by build error); browser-exercise resolve / dismiss / reopen / apply recommendation; resolution panel must become a drawer on narrow screens — verify; live RLS tests.
