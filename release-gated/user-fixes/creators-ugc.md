# Creators & UGC — Manual Steps Required

## 1. Log in and run a visual QA pass (blocking)
I could not authenticate against the local dev server (no password for the
demo account `jamahlthomas1996@gmail.com`, and I did not want to reset it
myself — same constraint noted in `campaigns.md`). Please:
1. `npm run dev` (or use your already-running instance on port 3004).
2. Log in and visit, in order: `/app/creators`, `/app/creators/creators`,
   `/app/creators/briefs`, `/app/creators/submissions`, `/app/creators/rights`,
   `/app/creators/payments`.
3. Compare each against its reference image in `designs/UGC & CReators/ChatGPT
   Image Jul 24, 2026, 04_1*.png` (6 images, one per route).
4. Resize to 1448×1086 (the reference viewport), then 1440, 1280, 1024, tablet
   (portrait + landscape) and mobile. Confirm the tab strip and every wizard's
   stepper actually switch layout at the tablet/mobile breakpoints (sliding
   tray / dropdown) rather than just shrinking.
5. Click through: Invite Creator, Add Creator, Create Brief (5-step wizard),
   Add Rights Record (4-step wizard), Send Usage Request, Create Payment Batch
   (3-step wizard), the submission review workspace (approve / request changes
   / reject, on a submission in each reachable status), brief status changes on
   the board, bulk-approve on Submissions, Export (downloads a CSV that matches
   the on-screen filters) on all five list surfaces.
6. Try to reach `/app/creators/payments` as a role without billing access, and
   `/app/creators/rights` on a plan below Team — confirm the blocked/upgrade
   states render correctly rather than leaking data.
7. Check the browser console for errors on each route — none were exercised
   in-browser this session.

## 2. Screenshot evidence folder (blocking on #1)
Once the pass above is done, save screenshots into
`docs/ui-verification/caption-fox/creators-ugc/` following the naming
convention in the master brief — this folder does not exist yet.

## 3. Payment provider integration (not blocking, scoped out)
Payments and payout batches are real ledger records (status, approval,
idempotency keys, batch grouping) but no money actually moves — there is no
Stripe Connect / bank-transfer API call behind "Approve" or a batch reaching
`processing`. `PAYMENT_METHODS` in `src/lib/creators/constants.ts` only lists
rails Caption Fox can record today (bank transfer, PayPal, Wise, manual).
Wiring an actual payout provider is a distinct, larger piece of work — flag if
you want it scoped next.

## 4. Rights-request negotiation UI (not blocking, scoped out)
`sendUsageRequest` creates a request record and the creator side can in
principle accept/decline/counter it (the `ugc_rights_requests.status` column
supports `countered`), but there is no screen yet for a creator to respond, or
for the workspace to review a counter-offer. Currently a request just sits as
`sent` until someone manually updates the rights record.

## 5. RLS negative-path verification (not blocking, reasoning-only)
Every new table's RLS policy is `workspace_id in (select workspace_id from
workspace_members where user_id = auth.uid())`, matching the Campaigns
module's pattern — verified by reading the applied migration, not by running
live cross-workspace/wrong-role queries. If you want that exercised live, it
needs two real test accounts in different workspaces.

## 6. Plan-gate values (confirm these are what you want)
Set in `src/lib/creators/entitlements.ts` — adjust if the actual pricing tiers
differ:
- Overview, Creators, Briefs, Submissions: every plan
- Rights: **Team** and above
- Payments: **Team** and above, and only for `small_business` / `brand` /
  `agency` workspace types (a Creator workspace gets `creator-self-service`
  mode instead — see below)

## 7. Creator-workspace self-service mode (not built, flagged only)
`resolveMode()` in `src/lib/creators/entitlements.ts` already distinguishes a
`creator-self-service` mode for `workspaceType === 'creator'` — a creator
account shouldn't see buyer-facing sourcing/payout screens, and the Sidebar
allowlist for the `creator` workspace type deliberately does **not** include
`/app/creators`. No actual "My Briefs / My Submissions / My Payments" creator-
facing UI was built this session — only the buyer/manager surfaces (used by
`small_business`, `brand` and `agency` workspaces). If Creator workspaces need
their own view into briefs they've been invited to, that's a separate build.

## 8. Marketplace-profile linking (not built, scoped out)
`ugc_creators.marketplace_supplier_id` exists as a column but nothing populates
or reads it yet — converting a public marketplace creator profile into a
workspace creator relationship (rather than manually re-entering their details)
is not wired up.
