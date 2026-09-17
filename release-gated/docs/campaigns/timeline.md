# Campaigns → Campaign Timeline — Release Evidence

**Parent section:** Campaigns (`/{type}/campaigns`) · **Sub-tab route:** `/{type}/campaigns/timeline`
**Gate:** Team and above · **Reference:** Campaigns (7)
**Screenshots:** `docs/ui-verification/caption-fox/campaigns/timeline-{reference,implementation}.png`

## Views
Timeline (default) — a real DOM Gantt built from elements, not an image and not one flat SVG —
plus Cards and Table.

## What the Gantt renders
Sticky campaign column (thumbnail, name, owner, stage badge, progress bar and percentage),
week/day headers, a current-date marker, phase bars with labels (Assets & Content, Launch,
Post-launch, Content Production, Live Campaign, Analysis, Build & Setup, Winner Selection,
Discovery, Review & Approvals, Publish …), and milestone diamonds with title and date captions
(Brief approved, Assets due, Launch, Review, Winners announced …). Supporting panels: Timeline
progress, Upcoming milestones, Launch risks, Dependencies, Recent activity.

## Actions tested
Drag-to-reschedule (move and resize-end) persisted server-side with rollback on failure ·
Add milestone · milestone status changes · date range, owner, campaign type and stage filters ·
Export · horizontal scrolling.

## Data sources
`campaigns`, `campaign_phases` (32), `campaign_milestones` (29), `campaign_dependencies` (4),
`campaign_activity` (surface `timeline`).
KPIs: Active timelines 45 · Milestones due 11 · At-risk launches 5 · On-time rate 100% ·
Capacity utilisation 62% · Upcoming launches 6.

## Fixes in this pass
1. Row height 52 → 66px and day column 34 → 27px, matching the design.
2. Left column gained the thumbnail, owner, stage badge and progress bar (design parity).
3. Milestone captions (title + date) added beside each diamond.
4. **"Milestones due" was hard-capped at 6** because it counted a display query limited to six
   rows; it is now a real count of milestones due in the next seven days.
5. **Long-finished campaigns rendered as full-width bars**, pushing live work off screen. The
   Gantt now plots only campaigns whose dates intersect the visible window, with an explicit
   empty state; Cards and Table still list everything.
6. Fake KPI hints ("14% vs last 30 days", "2 vs last 30 days", "8pp vs last 30 days") replaced
   with values derived from the data.

## Shell, responsive and accessibility
Locked app shell. Verified at 1491×1055, 820 and 390 (touch): the Gantt scrolls horizontally
by design, the page body does not. An `sr-only` table exposes the same schedule data to screen
readers, and rescheduling has a form-based alternative to dragging.

## Permissions
Plan gate plus the `manageTimeline` capability; reschedules and milestone changes are
re-checked server-side and audit-logged.

## Tests
`npx tsc --noEmit -p .` clean for this module; `npx vitest run` — 18 files, 244 tests pass.

## Remaining items
See `release-gated/user-fixes/campaigns.md`.
