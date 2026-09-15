# Marketplace — manual actions required

Everything below needs credentials, a provider account or a human decision, so it could not
be completed from the codebase. Each item lists exact steps.

---

## 1. Stripe Connect — live escrow settlement  **(blocking for real money)**

**Current behaviour.** Escrow is modelled correctly and safely, but no payment provider is
connected in this environment. `releaseEscrow()` in `src/lib/marketplace/actions.ts`:

1. writes a `marketplace_escrow_transactions` row with `state = 'pending'` and a deterministic
   `idempotency_key` of `release-{orderId}-{releasedCents}` — a unique-violation on that key is
   what makes a double-click or retry safe;
2. only then moves the order to `escrow_status = 'released'`.

No funds move. The UI says so explicitly on the Orders page escrow panel.

**To make it real:**

1. Create a Stripe Connect platform account and enable **Separate charges and transfers**.
2. Add to `.env.local` (and to the Vercel project):
   ```
   STRIPE_SECRET_KEY=sk_live_…
   STRIPE_WEBHOOK_SECRET=whsec_…
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_…
   ```
3. Onboard each supplier to a connected account and store the account id on
   `marketplace_suppliers` (add a `stripe_account_id text` column).
4. Fund an order: create a PaymentIntent with `capture_method: 'manual'` (or charge to the
   platform balance), store the id on `marketplace_orders.stripe_payment_intent`, and set
   `escrow_status = 'in_escrow'` **only from the webhook**, never from the browser.
5. Release: create a Transfer to the connected account for
   `amount_cents - released_cents`. Pass the existing `idempotency_key` straight through as
   Stripe's `Idempotency-Key` header — the schema already generates a stable one.
6. Add `POST /api/webhooks/stripe` handling `payment_intent.succeeded`,
   `transfer.created`, `transfer.failed`, `charge.refunded`. Flip
   `marketplace_escrow_transactions.state` to `succeeded`/`failed` there and reconcile the
   order. **Verify the webhook signature.**
7. Refunds: implement `refundEscrow()` alongside the existing actions, gated on the already
   defined `marketplace.escrow.refund` permission.

**Until this is done:** treat the Orders escrow figures as an internal ledger, not settled
money. The permission `marketplace.escrow.release` is already restricted to owner and admin.

---

## 2. Supplier and creator media

The seeded directory has no images, so profile covers render a deterministic brand gradient
and avatars render initials. This is intentional — placeholder stock photography would be
fake content.

**To add real media:**

1. Upload to your R2 bucket under `marketplace/suppliers/{supplierId}/…`.
2. Set `marketplace_suppliers.avatar_url` and `.cover_url` to the public (or signed) URL.
3. For portfolio strips on influencer and UGC cards, populate `portfolio_urls text[]`. The
   card renders the strip only when that array is non-empty.

---

## 3. Demo data — remove before customer launch

`supabase/seed_marketplace_module.sql` inserted a demo directory and demo buyer-side data
for the workspaces owned by `jamahlthomas1996@gmail.com`.

- Seller directory: `delete from public.marketplace_suppliers where is_demo;`
- Buyer-side data cascades from the workspace: deleting a demo workspace removes its
  marketplace requests, orders, saved items, saved searches and activity.

The category taxonomy (12 rows in `marketplace_categories`) is **reference data**, not demo
data — keep it.

---

## 4. Decisions needed from you

1. **Should Marketplace appear for `brand` and `agency` workspaces?**
   `Sidebar.tsx` `workspaceNavAllowlist` currently lists `/app/marketplace` for `creator` and
   `small_business`; `brand` and `agency` have empty allowlists (meaning "show everything").
   The entitlement resolver imposes no workspace-type restriction, so all four types can
   reach it today. Confirm that is intended.

2. **Plan gating.** Influencer search, UGC creator search and Requests currently require
   `creator_pro`. Discover, Services, Categories, Saved and Orders are available on every
   plan. Confirm or tell me the split you want — it is one table in
   `src/lib/marketplace/entitlements.ts` (`MODULE_RULES`).

3. **Compare and saved-item limits.** Currently 2/3/3/4 compare and 25/100/250/500 saved by
   plan rank. Adjust in `limitsFor()` in the same file.

4. **`/help/marketplace`** is linked from every page header ("How it works") and from the
   Services quick actions. That route does not exist yet — either create it or tell me to
   point those links elsewhere.

---

## 5. Not blocking, but worth knowing

- **Supplier-side proposal submission** is modelled (RLS lets a supplier insert a proposal
  for a request they were invited to) but there is no supplier-facing UI for it in this
  module. The existing `/supplier/*` surface would be the place.
- **Order creation** currently happens through the seed and through accepting a proposal.
  A "start order from a package" flow can be added on the supplier detail page once payment
  is wired — creating an order before escrow can be funded would show a misleading state.
- **The production build is currently red** for reasons outside this module —
  `src/lib/partnerships/entitlements.ts` references `PERMISSIONS.PARTNERSHIPS_*` and
  `src/components/advertising/pages/ReportsPage.tsx` references an undefined `formatChange`.
  Both are untracked, in-flight work from another workstream. `npx tsc --noEmit` shows zero
  errors in every marketplace file.
