# Campaigns — items needing a human decision or action

Everything here is deliberately *not* done in code, with the reason. Nothing in this list is
a silent skip.

---

## 1. Low disk space on the dev machine (blocker for builds)

`C:` has **~2.2 GB free**, and `.next` alone is **5.3 GB**. A `tsc` run already failed to
write `tsconfig.tsbuildinfo` with `ENOSPC: no space left on device`. Type-checking and tests
still complete, but a production `next build` will likely fail.

**To fix (your call — I did not delete your build cache while your dev server was running):**

```powershell
# stop the dev server on port 3004 first, then:
Remove-Item -Recurse -Force ".next"
```

This is only a cache; the next `npm run dev` / `next build` regenerates it.

## 2. Demo dataset cannot match every design KPI

The designs were drawn against a fictional 128-campaign workspace. The seeded demo set is 45
curated campaigns that reproduce the designs' *cards, names, owners, stages, budgets, dates,
channels and charts* exactly. Count-style KPIs therefore differ:

| KPI | Design | Live | Why |
|---|---|---|---|
| All Campaigns → Total | 128 | 45 | Only the design's own visible records were seeded |
| All Campaigns → Overdue | 14 | 0 | No overdue records in the curated set |
| Giveaways → Active | 18 | 5 | The design shows five giveaway cards |
| Giveaways → Total entries | 12,842 | 9,842 | Sum of the design's own five per-card figures |
| Competitions → Active | 18 | 4 | The design shows five competition cards |
| Competitions → Total submissions | 1,842 | 1,337 | Sum of the design's own per-card counts |
| Templates → Total | 128 | 10 | The design shows ten template cards |
| Budget utilisation sub-line | £128.6K of £208K | £442.4K of £713.5K | The design's own per-card budgets already exceed £208K, so the *ratio* (62%) was matched instead of the totals |

**Decision needed:** leave as-is (recommended — the ratios, percentages and every card match),
or have the seeder generate ~85 extra filler campaigns purely to make the counts read 128.

## 3. Completed campaigns show "—" instead of a due date

Completed campaigns are seeded with `end_date = NULL`. Giving them real past dates was tested
and rejected: the default sort is "Due date (soonest)" (`end_date ASC`), so past dates pull
all eight completed campaigns to the top of Overview and All Campaigns, filling the first row
of cards with finished work (evidence:
`docs/ui-verification/caption-fox/campaigns/seed-overview-completed-dates.jpeg`).

**Decision needed, one of:**
- leave as-is (a completed campaign has no outstanding due date), or
- change the default sort on Overview/All to "Recently updated" and flip
  `SHOW_COMPLETED_DUE_DATES = true` in `scripts/seed-campaigns-demo.mjs`, or
- add a sort key that pushes finished work last while keeping "Due date (soonest)" as the
  label (needs a computed column or an RPC — a schema change, so not done unilaterally).

## 4. RLS negative tests were done through the UI, not as raw API calls

Verified: a creator-type workspace cannot open `/creator/campaigns/competitions` (route gate
returns the no-access state, no rows rendered), and every query is workspace-scoped.

**Not yet done:** authenticating as a second workspace's user and calling the Supabase REST
endpoints directly for `campaigns`, `giveaway_entries`, `competition_submissions` etc. to
prove the policies reject cross-workspace reads/writes at the database layer. This needs a
second real test account and its credentials.

## 5. Stress-test rows are archived, not deleted

The workspace previously held ~1,975 stress campaigns plus ~490 giveaways and ~489
competitions (mostly created by the `demo-workspaces.ts` bug fixed in this pass). They are
**archived and tagged**, never deleted.

- Reverse: `node scripts/seed-campaigns-demo.mjs --unarchive d7b7c61e-7685-4b15-8a0c-d9fa85f25103`
  (round-trip tested: restores 1,975 campaigns, 490 giveaways, 489 competitions, 2 templates).
- If you would rather they were permanently removed, that is a destructive action and needs
  your explicit go-ahead.

## 6. Pre-existing type errors outside Campaigns

`npx tsc --noEmit` reports errors in `src/lib/brand-assets/queries.ts` and
`src/lib/marketplace/data.ts` (`completed_at` missing on a Row type). These predate this work
and are untouched here — flagging them so they are not mistaken for Campaigns regressions.

## 7. Board column mapping is a product decision

The designs show six board columns, but the lifecycle has nine stages. `in_progress` now maps
to the **Planning** column and `blocked` to **At risk** (`BOARD_COLUMN_FOR` in
`src/lib/campaigns/constants.ts`), so no record disappears and none is mislabelled.

**Confirm** this matches how you want the board to read, or tell me to add explicit
"In progress" and "Blocked" columns (that would deviate from the design's six).
