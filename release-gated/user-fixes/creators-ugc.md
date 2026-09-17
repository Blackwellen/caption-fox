# Creators & UGC — Manual Steps

## 1. Re-verify the latest fixes in a logged-in browser (blocking for 100/100)
The Chrome session expired. Signing the browser back in by injecting a Supabase session cookie was blocked by
the permission check, so these were not clicked through after the last changes:
1. Log in on `http://localhost:3004` and switch to the Brand workspace.
2. `/brand/creators/briefs` → open any open or in-progress brief. Check that the "Creators assigned" and
   "Deliverables" numbers match the Creators and Deliverables panels on that page (the seed counters were fixed).
3. On the same brief, choose **Upload submission**, pick a creator, add a JPG and submit. The page should land
   on `/brand/creators/submissions/<new id>`.
4. On that submission, try each of these:
   - **Flag an issue**, then check that it appears under issues
   - **Resolve** or **Dismiss** the issue
   - change **Reviewer**
   - **Upload new version**, then check that it shows v2
5. On `/brand/creators/creators/<id>`, open **Usage Requests** and record *Creator accepted*. A rights record
   should appear under Rights with status Pending approval.
6. On `/brand/creators/submissions`, check whether the Next.js dev indicator ("1 issue", bottom left) still appears.
   If it does, open it and send me the message; it showed in the last screenshot and I could not read it.
7. Delete the test submission afterwards, or re-run
   `node scripts/seed-creators-demo.mjs d7b7c61e-7685-4b15-8a0c-d9fa85f25103`.
   The re-run does not delete a non-demo submission, so delete that one by hand.

## 2. Production build
Stop every dev server that shares `.next`, then run `npm run build`, and confirm the `[workspaceType]/creators`
routes compile.

## 3. Payout provider (scoped out)
No money moves. "Record paid/failed" writes the outcome, a payout attempt and the batch roll-up by hand. To pay
automatically, connect your own provider account (Stripe Connect, Wise or similar) under Integrations. Webhooks and
credentials are yours to set up; Caption Fox does not create them for you. Then call `recordPayoutOutcome` from
the provider webhook.

## 4. Confirm plan gates
In `src/lib/creators/entitlements.ts`, Rights and Payments need Team or above, and Payments is limited to
Business, Brand and Agency workspaces. Change these values if your pricing differs.

## 5. Platform Admin feature flag (not built)
Access is controlled by plan and role only. If you want an incident kill-switch, add a `creators` flag in
Platform Admin and check it inside `canAccessCreatorModule`.

## 6. Role test users for Business and Agency
The RLS script uses Brand-only admin and viewer users. To extend the checks to those workspaces, add an admin and
a viewer member to the Business and Agency workspaces.

## 7. Not built
- A self-service portal where creators see their own briefs, submissions and payments
- Linking a marketplace profile (`ugc_creators.marketplace_supplier_id` is unused)
- CSV import of creators
- Email notifications for invitations and review decisions; invitations are records only, with no SMTP send
- A Playwright E2E suite

## 8. Backups
Payments and rights records are financial and legal evidence. Enable PITR on the Supabase project before real
payouts are recorded.
