# Release evidence — Calendar › Agenda

| | |
|---|---|
| Parent section / route | Calendar · `/{type}/calendar` |
| Sub-tab / route | Agenda · `/{type}/calendar/agenda` (`?view=day\|week\|agenda`, `?date=yyyy-mm-dd`) |
| Required plan / flag | Creator Pro+ (`calendar.agenda`) |
| Roles tested | Owner (browser); others via unit tests |
| Reference | `designs/Universal Sections/Calendar/… (3).png` @ 1491 × 1055 |
| Score | **82 / 100** |
| Decision | **Blocked pending manual fix** (shell build error) + outstanding QA |

## Tested (browser)
- KPIs: Today's items 17, This week 45, Pending approvals 5, Overdue tasks 4, Open conflicts 10, Team load 17% — footnotes now describe today regardless of the viewed week.
- Day groups: today expanded, other days collapsed with counts; defaults recompute after client navigation; days over 20 items show "Show all N items".
- Mini calendar: Previous / Today / Next month → URL `date=2026-10-01`, window 27 Sept – 3 Oct, title "October 2026"; filter badge no longer counts `date`.
- Today's summary, Next actions (due-in labels), Due soon, Publishing queue preview (next 5, compact times, status visible), Conflicts preview (3), Recent activity with names.
- Filters fit one row; Day / Week / Agenda switcher; console clean after the key fix.

## Data sources / tables
`content_posts`, `campaign_tasks`, `campaigns`, `calendar_items`, `approvals`, `calendar_conflicts`, `publishing_queue`, `audit_logs`.

## Actions (code-reviewed; not yet browser-exercised)
Add agenda item (`saveScheduleItem`, validation, idempotent `requestId`), Create task (campaign must belong to workspace; assignee must be a member; idempotent), Export CSV / ICS (permission-gated route), Re-check conflicts, open-entry drawer with timezone-correct "Move to".

## Bugs fixed
Previews not forward-looking; lost period navigation; every day expanded after navigation; unbounded busy days; `date` counted as filter; "Today" panels tied to viewed week; key warning; clipped queue preview; filter wrapping.

## Outstanding
Week / Day view visual check; browser-exercise create item / create task / drawer reschedule; responsive (3-column rail must stack; mini calendar usable on mobile); live RLS tests.
