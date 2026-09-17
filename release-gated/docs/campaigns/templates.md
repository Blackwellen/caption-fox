# Campaigns → Campaign Templates — Release Evidence

**Parent section:** Campaigns (`/{type}/campaigns`) · **Sub-tab route:** `/{type}/campaigns/templates`
**Gate:** Team and above · **Reference:** Campaigns (5)
**Screenshots:** `docs/ui-verification/caption-fox/campaigns/templates-{reference,implementation}.png`

## Views
Cards (default, **5-up** per the design) and Table.

## Actions tested
New template · preview · edit · duplicate (always lands as a draft) · publish · unpublish ·
submit for review · approve · request changes — the state machine is enforced server-side ·
favourite · archive and restore · Import · Export · **create campaign from template**, which
instantiates a real campaign plus its milestones (verified persisted, not a UI-only copy).

## Data sources
`campaign_templates`, with usage derived from `campaigns.template_id` — real reuse rather than
a stored counter that can drift.
KPIs: Total 10 · Most used "Summer Launch 2024" (24 times) · Published 4 · Draft 2 · Avg reuse
9.6× · Recently updated 10. Card order, usage counts and linked-workflow counts match the
design (24 / 18 / 12 / 7 / 9 uses), as do the approval queue and recent-activity panels.

## Fixes in this pass
Card grid moved from 3-up to 5-up; dense design type at `lg`; type-first routing.

## Shell, responsive and accessibility
Locked app shell. Verified at 1491×1055, 820 and 390 (touch): no horizontal overflow, 32px
touch targets, base type retained below `lg`.

## Permissions
Plan gate plus `manageTemplates` / `publishTemplates` capabilities. Publish and approve are
separate capabilities from edit, enforced server-side; every transition writes
`campaign_activity`.

## Tests
`npx tsc --noEmit -p .` clean for this module; `npx vitest run` — 18 files, 244 tests pass.

## Remaining items
See `release-gated/user-fixes/campaigns.md` (Total reads 10 against the design's 128 — the
design's ten template cards were seeded; the usage-trend line is spiky because demo
template-derived campaigns are created on few distinct days).
