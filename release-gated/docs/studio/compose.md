# Release evidence — Studio › Compose

| | |
|---|---|
| Parent section / route | Studio · `/{type}/studio` |
| Sub-tab / route | Compose · `/{type}/studio/compose` (`?id=`, `?new=1`, `?drafts=`, `?view=cards\|table`) |
| Required plan / flag | Studio `compose` module |
| Roles tested | Owner (browser) |
| Reference | `designs/Universal Sections/Studio/compose.png` @ 1491 × 1055 |
| Score | **85 / 100** |
| Decision | **Ready for admin-only beta** |

## Tested (browser)
- Header actions (Save draft, Request review, Schedule, Preview split menu, more menu), KPI strip, channel chips add/remove, internal title, caption editor, CTA text / button / link / UTM switch, tone, labels, schedule (Publish now / Schedule for later / Add to queue).
- Live preview (mobile/desktop toggle), asset picker tabs, upload entry, content quality ring and tips dialog, version history, comments, recent drafts (cards/table, scope filter, search).
- Design pass: CTA text, "Learn More" select, label chips and the schedule date/time ("22 Sept 2026", "6:51 PM") now fit on one row as in the design.

## Actions (code-reviewed; partially browser-exercised)
`saveContent` (autosave, validation), `setContentStatus` (transition rules enforced server-side), `scheduleContent` (future-time + plan quota), `queueContent` (server-computed slot), `archiveContent`, `deleteContent` (published blocked), `restoreContentVersion`, `addContentComment`.

## Bugs fixed
Truncated CTA/labels/date fields; timezone label hydration; drafts scope param dropped by the query parser.

## Outstanding
Browser-exercise schedule/queue/delete with a non-owner role; autosave conflict when two tabs edit the same draft.
