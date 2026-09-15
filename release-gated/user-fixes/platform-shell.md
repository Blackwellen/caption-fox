# Platform Shell — manual follow-ups

Items Claude Code could not complete for the permanent application shell, with exact steps.

## 1. Remaining signed-in checks (required before release)

Already verified signed in by Claude Code (2026-09-15): Creator, Brand, Business, Supplier and
Affiliate contexts; workspace switching; Business plan-gate and Agency-only 404s; affiliate grant
isolation (someone else's portal → 404); type redirects; bottom collapse toggle; short-viewport/zoom
behaviour; touch scrolling; canonical redirect. **Only step 8 (Platform Admin, needs your MFA device)
is still outstanding.**

Also fix locally: `.env.local` has `APP_URL`/`NEXT_PUBLIC_APP_URL` pointing at `http://localhost:3000`
(a different project on this machine), so affiliate referral links in dev read `localhost:3000`.
Set it to `http://localhost:3004` for local work; production must use the real domain.
The QA login lives in the gitignored `.env.test.local` (`QA_LOGIN_EMAIL` / `QA_LOGIN_PASSWORD`) —
never paste it into docs or commit it. Run these on a quiet dev server (`npm run dev`, port 3004;
the shared server was saturated by parallel sessions during QA). Steps 5, 7, 8 and 9 are the ones
still outstanding; step 8 needs your MFA device:

1. `npm run dev` (port 3004), sign in as an owner of a Brand workspace.
2. Visit `/app/home`, `/brand/calendar`, `/brand/advertising`, `/brand/events`, `/brand/brand`:
   one white shell only (no nested/duplicate sidebar or top bar), correct item active.
3. Paste `/brand/campaigns` into a fresh tab → lands on `/app/campaigns` with Campaigns active.
4. Switch to an Agency workspace from the top-bar switcher → sidebar shows 28 items; open
   `/brand/calendar` → you are redirected to `/agency/calendar`.
5. Switch to a Business workspace on the `starter` plan → 15 items; open `/app/automations`,
   `/app/seo`, `/app/partnerships`, `/business/events`, `/app/finance` directly → each 404s.
   Change `workspaces.plan` to `team` → Events, SEO, Partnerships, Finance, Automations appear
   and open. Advertising stays absent (see item 3).
6. Creator workspace → 10 items; `/creator/brand`, `/creator/events`, `/app/strategy` 404.
7. Supplier account → `/supplier` shows 14 items; Earnings & Payouts opens `/supplier/payouts`.
8. Platform admin with MFA → `/admin` shows the white shell with 13 items and the
   "Admin Console" badge; a non-admin visiting `/admin` is sent to `/app/home`.
9. Approved affiliate → `/affiliates/portal` redirects to `/affiliate-portal/<id>`; all 8 pages
   load; `/affiliate-portal/<someone-else's-id>` 404s; set `affiliates.status = 'suspended'` →
   "Portal access is paused" replaces the content.
10. Toggle collapse, refresh → preference kept; sign in as a different user in the same browser →
    their own preference applies.

## 2. Fixture destinations behind real navigation items (pre-existing)

These sidebar items route to the existing `IntegratedFeatureShell` "Shell preview" fixture pages
because no real module exists yet. They are not dead links, but they are placeholders:

- Agency: Clients, Shared Templates (`/app/templates`), Client Approvals, Client Reports,
  Agency Operations (`/app/agency-operations`)
- Brand / Agency / entitled Business: Finance (`/app/finance`)
- Supplier: Requests & Opportunities, Quotes, Deliveries, Messages, Availability,
  Reviews & Reputation, Analytics, Settings
- Admin: Marketplace Operations, Plans & Billing, Content AI & Safety, Connections & Webhooks,
  Automation Operations, Compliance & Data, Flags & Releases, Platform Analytics, Audit & System

Decide per module: build it, or hide it behind a feature flag until built.

## 3. Advertising for Business workspaces

The canonical IA lists Advertising as a Business plan-gated extension, but the Advertising
module's own resolver (`src/lib/advertising/entitlements.ts`, `ADVERTISING_SURFACES`) only grants
Brand and Agency. The sidebar delegates to that resolver so the sidebar and route agree; Business
therefore never shows Advertising. To offer it, add `'business'` to `ADVERTISING_SURFACES`
(and confirm the Advertising pages support Business) — the sidebar picks it up automatically.

## 4. Affiliate programme assets

There is no table for partner-facing assets, so `/affiliate-portal/<id>/assets` shows an honest
empty state. Add an assets store (e.g. `affiliate_assets` with RLS scoped to active affiliates)
if programme assets should be shared.

## 5. Plan vocabulary

`workspaces.plan` uses `starter/creator_pro/team/brand/enterprise`, while `src/lib/plans.ts` uses
`free/creator_pro/team/agency/enterprise`. The navigation resolver normalises both
(`normalisePlan`), but individual module resolvers still disagree (e.g. Advertising does not
recognise `brand`). Align the vocabularies in one migration.
