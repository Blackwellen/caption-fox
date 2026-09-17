# Marketplace — actions that need you

Everything else in `release-gated/docs/marketplace.md` is done and applied. These items need your
own accounts or credentials, so I could not complete them.

---

## 1. Stripe Connect — live escrow settlement

**Why:** escrow balances, releases and payouts currently move against the local ledger. The UI is
honest about this (the Orders page says so in the escrow panel), but no money actually moves until
Stripe Connect is connected with your own account.

**Steps**

1. Sign in to your Stripe dashboard and enable **Connect** (Express or Standard).
2. Copy the live keys into `.env.local` / your Vercel project settings:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
3. In Stripe → Developers → Webhooks, add an endpoint pointing at your deployed
   `/api/webhooks/stripe` route and subscribe at minimum to:
   `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`,
   `transfer.created`, `payout.paid`, `payout.failed`.
4. In Caption Fox, go to **Settings → Billing** and complete the Connect onboarding for the
   workspace that will receive marketplace payouts.
5. Place one small real order end-to-end (fund → deliver → approve → release) and confirm the
   escrow figures on `/app/marketplace/orders` reconcile with Stripe.

**Until this is done:** treat escrow numbers as ledger-only. Do not tell customers funds are held
by a payment provider.

---

## 2. Two supplier rows have no profile media

`jamahl-thomas-creative-studio` and `luna-creative-co-9b50fd` are **real** (non-demo) supplier
records, so the demo media seeder deliberately skipped them — I did not want to write stock
photography onto genuine customer-owned rows.

**Steps:** either upload real media through the supplier profile UI (`/supplier/profile`), or tell
me to include them and I will extend the seeder.

---

## 3. Optional — refresh demo recency before a demo or screenshots

Demo timestamps are re-based onto "now" when the seeder runs. If the workspace then sits unused for
weeks, activity will read as old dates again.

```bash
node scripts/apply-migration.mjs supabase/seed_marketplace_recency.sql
```

Safe to re-run at any time; it only touches seeded demo rows.

---

## 4. Optional — re-render demo profile photography

If you want different faces or studio shots in the demo directory:

```bash
python scripts/render-marketplace-seed-media.py          # fetches from Unsplash, falls back to gradients
node scripts/apply-migration.mjs supabase/seed_marketplace_media.sql
```

Photo IDs are listed at the top of the script (`PEOPLE` / `STUDIOS`) and are Unsplash-licensed —
free for commercial use, no attribution required, no Unsplash+ premium photos, and no third-party
brand content.

---

## 5. Pre-existing failures outside this section

Not caused by the Marketplace work, but they will show up in CI:

- `src/lib/events/entitlements.test.ts` — 1 failing assertion (suspended-workspace capability).
- `src/app/app/seo/page.tsx` — imports `OwnerAvatar` and `@/components/seo/PanelControls`, neither
  of which exists; the module does not type-check.

Tell me if you want either picked up.
