# Release evidence — Calendar › Publishing Queue

| | |
|---|---|
| Parent section / route | Calendar · `/{type}/calendar` |
| Sub-tab / route | Publishing Queue · `/{type}/calendar/publishing-queue` |
| Required plan / flag | Creator Pro+ (`calendar.publishingQueue`); bulk publish Team+ and flag `queue_bulk_publish` |
| Roles tested | Owner (browser). Read-only / missing-permission / plan / flag paths covered by unit tests only |
| Reference | `designs/Universal Sections/Calendar/… (2).png` @ 1491 × 1055 |
| Score | **76 / 100** |
| Decision | **Blocked pending manual fix** (shell build error) + outstanding QA |

## Tested (browser, owner, seeded workspace)
- KPI strip: Queued 26, Awaiting approval 5, Ready 7, Failed 3, Scheduled today 8, SLA risk 6 — values match seeded rows.
- Lanes: Draft 3 · Awaiting Approval 5 · Approved 2 · Ready 7 · Scheduled 11 · Failed 3 (lane precedence bug fixed and unit-tested).
- Table: sort headers, pagination (1–10 of 31, pages 1–4), rows-per-page, failure codes (`MEDIA_INVALID`, `RATE_LIMITED`, `AUTH_EXPIRED`), late badges, owner names.
- Filters in one row; view switcher Queue / Table / Calendar present.
- Alerts: "5 items past SLA", "3 failed publishes" linking to filtered views.
- Upcoming schedule mini calendar with scheduled / high-priority / conflict markers; now month-navigable.
- Throughput chart, Delayed items, Recent publishing activity with real actor names.

## Data sources / tables
`publishing_queue`, `content_posts`, `social_channels`, `campaigns`, `workspace_members` + `profiles`, `audit_logs`. RLS: workspace-membership policies (see main doc).

## Actions (code-reviewed; not yet browser-exercised)
Approve / request changes (`setApprovalState`), Publish now + Bulk publish (`publishNow` → worker, blocks awaiting-approval / disconnected / expired channels with reasons), Retry (failed only, max 5 attempts), Cancel (confirm dialog), Reschedule (dialog, workspace timezone), Priority. Every action: server guard + workspace-scoped update + audit log + revalidation; idempotency key on queue creation.

## Bugs fixed
Lane precedence; table overflow (clipped Approval/Delivery/Priority/Actions); lanes only 6-up ≥1536 px; filter bar wrapping; mini-calendar anchor; header-action key warning; "UTC (UTC)".

## Outstanding
Confirm Actions column fully visible at 1491 after the table change (blocked by build error); browser-exercise every row/bulk action; responsive (table horizontal scroll, lanes horizontal scroll on mobile); live RLS negative tests.
