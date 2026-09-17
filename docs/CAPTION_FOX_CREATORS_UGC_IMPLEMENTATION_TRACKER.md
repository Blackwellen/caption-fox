# Caption Fox — Creators & UGC Implementation Tracker

**Designs:** `designs/Universal Sections/UGC & CReators/ChatGPT Image Jul 24, 2026, 04_14_59 AM (1…6).png` (each 1448×1086)

**Evidence:** `docs/ui-verification/caption-fox/creators-ugc/` · `release-gated/docs/creators-ugc.md` (+ `creators-ugc/*.md`) · `release-gated/user-fixes/creators-ugc.md`

| # | Page | Route | Build | 1448 parity | Responsive | Functional |
|---|---|---|---|---|---|---|
| 1 | Overview | `/{type}/creators` | Done | Verified | 820 / 390 | KPIs, filters, links |
| 2 | Creators | `/{type}/creators/creators` | Done | Verified | 820 / 390 | Filter, saved view, lists |
| 3 | Briefs | `/{type}/creators/briefs` | Done | Verified | 820 / 390 | Board move, upload |
| 4 | Submissions | `/{type}/creators/submissions` | Done | Verified | 820 / 390 | Review tools pending re-check |
| 5 | Rights | `/{type}/creators/rights` | Done | Verified | 820 / 390 | Transitions, renew |
| 6 | Payments | `/{type}/creators/payments` | Done | Verified | 820 / 390 | Record payout, approve batches |

## Foundations
- [x] Migration `20260916200000_creators_ugc_release.sql` (role-aware RLS, payment guard trigger, saved views, `is_demo`)
- [x] Entitlements: plan, workspace type and role capabilities, wired into the nav resolver
- [x] Routes under `[workspaceType]`, with a legacy `/app/creators` redirect
- [x] Shared design primitives (`design.tsx`) and URL-state controls (`controls.tsx`)
- [x] Private storage uploads re-checked on the server; avatars and media signed
- [x] Deterministic, idempotent demo seed with rendered media (brief counters derived from real rows as of 2026-09-17)
- [x] Seed ordering matches the designs: the design's 8 submissions are newest, and the top 5 creators by reach are Lena, Noah, Maya, Ethan and Sofia (2026-09-17, not yet checked in the browser)
- [x] Unit tests (61) and RLS script (38)
- [x] Release docs and user-fixes
- [ ] Payout provider integration: user connects their own account
- [ ] Creator self-service portal, marketplace linking, CSV import, email notifications
- [ ] Platform Admin feature flag
- [ ] Playwright E2E suite; `next build` re-run
- [ ] Browser re-check of the review tools, upload redirect and seed counters (session expired)

## Known deviations from the images
- The real shell (sidebar and top bar) is used, as required by CLAUDE.md.
- A section tabs row replaces the design's sidebar sub-items, adding about 44px of vertical offset.
- Values are live data, not the illustrative numbers in the designs.

## Status
**84/100: ready for owner/admin-only beta.**
