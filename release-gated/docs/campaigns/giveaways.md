# Campaigns → Giveaways — Release Evidence

**Parent section:** Campaigns (`/{type}/campaigns`) · **Sub-tab route:** `/{type}/campaigns/giveaways`
**Gate:** Creator Pro and above · **Reference:** Campaigns (3)
**Screenshots:** `docs/ui-verification/caption-fox/campaigns/giveaways-{reference,implementation}.png`

## Views
Cards (default, with banner covers) and Table.

## Actions tested
New giveaway — a four-step wizard (basics, prize and fulfilment, entry rules, dates and
review) with per-step validation · Import entries (CSV, duplicate detection, invalid-row
report) · Export · winner review queue: approve, reject, mark contacted, mark accepted, mark
prize fulfilled, request replacement — every transition validated server-side against the
entry's current state and audit-logged.

## Data sources
`giveaways`, `giveaway_entries` (17,224 rows), `campaign_activity` (surface `giveaways`).
KPIs verified live: Active 5 · Total entries 9,842 · Conversion 7.95% · Prize fulfilment 60%
(£28.4K of £39.5K) · **Approval rate 94%** · Ending soon 5.
Cards reproduce the design's five giveaways exactly — 2,416 / 1,852 / 3,124 / 1,740 / 710
entries and 9.60 / 7.18 / 8.90 / 6.32 / 4.08% conversion, with matching prizes, owners,
statuses and progress.

## Fixes in this pass
`giveawayAggregates` selected entries unpaginated, and PostgREST caps responses at 1,000 rows,
so at real volume **the approval rate read 0%**. Winner-status distribution is now exact
per-status HEAD counts, and the entries trend pages in 1,000-row batches.

## Shell, responsive and accessibility
Locked app shell. Verified at 1491×1055, 820 and 390 (touch): no horizontal overflow, 32px
touch targets, base type retained below `lg`. Charts ship an `sr-only` data table.

## Permissions
Plan gate plus `manageGiveaways` / `reviewWinners` capabilities; route-gated server-side.
Entrant emails are only rendered inside the permission-gated review queue.

## Tests
`npx tsc --noEmit -p .` clean for this module; `npx vitest run` — 18 files, 244 tests pass.

## Remaining items
See `release-gated/user-fixes/campaigns.md` (Active reads 5 and entries 9,842 against the
design's 18 and 12,842 — the seeded set is the design's own five cards).
