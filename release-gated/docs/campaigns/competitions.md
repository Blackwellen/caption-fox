# Campaigns → Competitions — Release Evidence

**Parent section:** Campaigns (`/{type}/campaigns`) · **Sub-tab route:** `/{type}/campaigns/competitions`
**Gate:** Team and above, **and** business / brand / agency workspace types only
**Reference:** Campaigns (4)
**Screenshots:** `docs/ui-verification/caption-fox/campaigns/competitions-{reference,implementation}.png`

## Views
Cards (default, FEATURED badge on the first card) and Table.

## Actions tested
New competition — four-step wizard with validation · Import submissions (CSV) · Export ·
judging-stage select on every row (the server rejects skipping a stage) · top-performer links
into each competition.

## Data sources
`competitions`, `competition_submissions` (1,337 rows), `campaign_activity` (surface
`competitions`).
KPIs verified live: Active 4 · Total submissions 1,337 · Judging backlog 937 · Conversion
12.4% · Closing soon 4.
The judging donut matches the design exactly: in progress 32%, review 24%, shortlist 18%,
pending 14%, completed 12%. Cards reproduce the design's five competitions — 428 / 312 / 256 /
198 / 143 submissions and 8.7 / 9.3 / 11.2 / 14.6 / 7.9% engagement.

## Entitlement evidence (negative test)
On a **creator** workspace the Competitions tab is not rendered at all, and a direct URL to
`/creator/campaigns/competitions` returns the canonical no-access state ("This area is not
part of the current workspace type") with **no records rendered** — the gate is server-side,
not nav-hiding.

## Fixes in this pass
The same 1,000-row aggregate cap as Giveaways; the judging-status distribution is now exact
per-status counts, and the submissions trend pages in batches.

## Shell, responsive and accessibility
Locked app shell. Verified at 1491×1055, 820 and 390 (touch): no horizontal overflow, 32px
touch targets, base type retained below `lg`.

## Permissions
Plan gate + workspace-type gate + `manageCompetitions` / `judge` capabilities, all enforced
server-side; mutations write `campaign_activity`.

## Tests
`npx tsc --noEmit -p .` clean for this module; `npx vitest run` — 18 files, 244 tests pass,
including an entitlement test asserting creator workspaces are refused with reason
`workspace_type`.

## Remaining items
See `release-gated/user-fixes/campaigns.md` (Active 4 and submissions 1,337 against the
design's 18 and 1,842; approval rate reads 100% because no rejected submissions were seeded).
