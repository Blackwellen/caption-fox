# Campaign Manager → Campaigns — Manual Steps Required

## 1. Log in and run a visual QA pass (blocking)
I could not authenticate against the local dev server (no password for the demo
account `jamahlthomas1996@gmail.com`, and I did not want to reset it myself —
same constraint noted in `inbox-copilot.md`). Please:
1. `npm run dev` (or use your already-running instance on port 3004).
2. Log in and visit, in order: `/app/campaigns`, `/app/campaigns/all`,
   `/app/campaigns/giveaways`, `/app/campaigns/competitions`,
   `/app/campaigns/templates`, `/app/campaigns/board`, `/app/campaigns/timeline`.
3. Compare each against its reference image in `designs/Campaigns/ChatGPT Image
   Jul 24, 2026, 01_58_0*.png` (7 images, one per route, in the order listed above).
4. Resize to 1491×1055 (the reference viewport), then 1440, 1280, 1024, tablet
   (portrait + landscape) and mobile. The board and timeline both scroll
   horizontally by design at narrow widths — confirm that's acceptable rather
   than needing a stacked mobile layout.
5. Click through: New campaign / New giveaway / New competition / New template
   wizards, Import (CSV), Export (downloads a file), the board drag (mouse and,
   if you can, touch on a tablet), the timeline drag-to-reschedule, and the
   winner-review and judging-stage controls.
6. Check the browser console for errors on each route — none were exercised
   in-browser this session.

## 2. Screenshot evidence folder (blocking on #1)
Once the pass above is done, save screenshots into
`docs/ui-verification/caption-fox/campaigns/` following the naming convention
in the master brief (`overview-reference.png` / `-implementation.png` /
`-diff.png`, etc.) — this folder does not exist yet.

## 3. Campaign detail page tabs (not blocking, scoped out)
`/app/campaigns/[id]` still uses the pre-existing generic `CampaignDetailClient`
rather than campaign-type-specific tabs (Entries/Winners for giveaways,
Submissions/Judging for competitions). It already reflects the new lifecycle/
health/priority columns since it selects `*`, but the tab set doesn't vary by
`campaign_type` yet. Flag if you want this built out as a follow-up.

## 4. RLS negative-path verification (not blocking, reasoning-only)
Every new table's RLS policy is `workspace_id in (select workspace_id from
workspace_members where user_id = auth.uid())`, matching the existing
`campaigns` policy pattern — this was verified by reading the applied
migration, not by running live cross-workspace/wrong-role queries. If you want
that exercised live, it needs two real test accounts in different workspaces.

## 5. Plan-gate values (confirm these are what you want)
I set the following minimum plans in `src/lib/campaigns/entitlements.ts` —
adjust if the actual pricing tiers differ:
- Giveaways, Board: **Creator Pro** and above
- Competitions, Templates, Timeline: **Team** and above
- Overview, All: every plan
