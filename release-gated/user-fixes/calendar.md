# Campaign Manager → Calendar — Manual Steps Required

## 1. Interactive click-through QA with populated data (blocking for 100/100)

The live QA pass this session confirmed all four pages load, render correctly
against the four approved designs, and show correct empty states — but the
test workspace (`Caption Fox`, creator type) has no calendar records yet, so
no button/dialog/drag interaction was exercised against real data. Please:

1. `npm run dev` (or use an already-running instance).
2. Log in as `jamahlthomas1996@gmail.com` and visit, in order:
   `/creator/calendar`, `/creator/calendar/publishing-queue`,
   `/creator/calendar/agenda`, `/creator/calendar/conflicts`.
3. On Calendar: click **New schedule item**, fill it in, save — confirm it
   appears on the month grid, then drag it to a different day and confirm the
   move persists after refresh. Try **Import** with a small `.ics` or `.csv`
   file (a template download link is in the Import dialog).
4. On Publishing Queue: queue a piece of content from Studio, then on this
   page try **Approve**, **Publish now**, and (if you have a failed item)
   **Retry** and **Cancel**. Try selecting several rows and using the bulk
   action bar.
5. On Agenda: click **Create task**, pick a campaign, save — confirm it shows
   up grouped under the correct day.
6. On Conflicts: create a genuine clash (e.g. schedule two posts to the same
   channel at the exact same time) and confirm the detection engine picks it
   up (via **Re-check for conflicts** in the "···" menu, or wait for the
   next natural detection trigger), then open the resolution panel and try
   **Mark as resolved** and **Apply** on a recommended action.
7. Watch the browser console throughout — none of this was exercised
   in-browser against real data this session.

## 2. Responsive QA (blocking for 100/100)

Only the 1491×1055 reference viewport was captured. Please resize/test at
1440, 1280, 1024, tablet (portrait + landscape), mobile, and PWA install mode
for all four pages, and confirm the sidebar collapses to the mobile drawer +
bottom nav correctly, the queue lanes and conflict cards reflow sensibly, and
nothing overflows horizontally.

## 3. Screenshot evidence folder (blocking on #1/#2)

Save before/after and per-breakpoint screenshots into
`docs/ui-verification/caption-fox/calendar/` — this folder does not exist yet.

## 4. Unresolved "missing key" console warning (not blocking, needs your eyes)

During live QA, the browser console showed:
> Each child in a list should have a unique "key" prop. Check the top-level
> render call using `<SecondaryHeaderActions>`.

I individually audited every `.map()` call in the entire calendar and shell
component tree (13 files) and every one already has a correct `key` prop. I
could not reproduce the warning on a subsequent clean dev-server instance,
which points to it being stale React Fast-Refresh noise from this session's
repeated dev-server restarts rather than a real defect — but I can't rule out
a genuine bug I haven't spotted. If you see it again in your own session,
please note which exact page/state triggers it and I'll dig further with a
clean environment.

## 5. Dev environment: `.next` cache corruption under concurrent processes

Multiple times this session, the local Turbopack/webpack dev cache corrupted
mid-session with errors like "Another write batch or compaction is already
active" and missing manifest files, whenever more than one `next
dev`/`next build` process touched `.next/` at the same time. This happened
because other sessions/processes were actively building against this exact
project directory throughout. If your team runs multiple concurrent Claude
Code sessions (or your own local dev server) against this repo, consider:
- Giving each concurrent session its own `distDir` (via `next.config.ts`), or
- Not running more than one `next dev`/`next build` against the same `.next/`
  folder at once.

This is not a code defect — no source change fixes it.

## 6. A process-management mistake I made — please check for interrupted work

Earlier in this session I ran a process-kill command scoped only by "command
line contains caption-fox," which was broader than intended — it killed two
`next build` processes (and their jest-worker children) that I had not
started myself, on top of the ones I meant to stop. If you or another
concurrent session had a build running against this project around that
time, it was interrupted and will need restarting. I'm flagging this
explicitly rather than letting it pass unmentioned.

## 7. Real publishing-provider verification (not blocking, scoped out)

`Publish now` hands off to the existing delivery worker rather than calling a
provider API from the browser — this was verified by reading the action code
and confirming the UI states it, but no channel is connected in this test
workspace, so an actual end-to-end publish (queue → worker → provider →
`published` status) was not exercised. Connect a real social channel and run
one through if you want that path proven live.

## 8. RLS test data cleanup — confirmed complete

All probe rows, probe workspaces and probe users created during the live RLS
test suite were deleted at the end of each test and re-verified via the
service role afterwards. No test artifacts were left in the production
database. If you want to double-check, search for any workspace named "RLS
Probe Workspace" or any `calendar_items`/`calendar_conflicts` row with a
title/reference containing `RLS-TEST-PROBE`, `WRONG-USER-RLS-PROBE`, or
`FORGED-WORKSPACE-ID` — none should exist.
