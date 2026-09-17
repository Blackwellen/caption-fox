# Marketplace — Release Readiness Evidence

**Section:** Marketplace (shared module)
**Base route:** `/app/marketplace` (reached from `/{workspaceType}/marketplace` via the canonical workspace redirect)
**Date:** 2026-09-16
**Workspace tested:** Caption Fox (creator, `68596451-2d06-4670-96ab-460278ef6ba5`), owner/platform-admin account
**Reference designs:** `designs/Universal Sections/Marketplace/*.png` (9 images, 1491 × 1055)

---

## 1. Scope of this pass

The module already existed with a real data layer, entitlement resolver, server actions and a
request wizard. This pass was a **1:1 fidelity + correctness pass**, not a rebuild. It covered:

- Visual density against the nine approved references at the native 1491 × 1055 viewport.
- Real profile media (the directory previously rendered gradient placeholders only).
- Three genuine defects found while verifying against the designs (see §5).

The locked app shell (`CaptionFoxAppShell`) and sidebar were **not** touched, per
`APP_SHELL_DESIGN_LOCK.md`. Content differences versus the design images are corrected through the
SQL/media seeders, never by hard-coding values into components.

---

## 2. Routes tested

| # | Route | Views | Reference image | Screenshot |
|---|---|---|---|---|
| 1 | `/app/marketplace` | cards | `…02_55_27 AM (1).png` | `overview-implementation.png` |
| 2 | `/app/marketplace/discover` | cards, list | `…(2).png` | `discover-implementation.png` |
| 3 | `/app/marketplace/discover/influencers` | cards, list | `…(3).png` | `influencers-implementation.png` |
| 4 | `/app/marketplace/discover/services` | cards, list | `…(4).png` | `services-implementation.png` |
| 5 | `/app/marketplace/discover/ugc-creators` | cards, list | `…(5).png` | `ugc-creators-implementation.png` |
| 6 | `/app/marketplace/categories` | grid, list | `…(6).png` | `categories-implementation.png` |
| 7 | `/app/marketplace/saved` | cards, list | `…(7).png` | `saved-implementation.png` |
| 8 | `/app/marketplace/requests` | cards, table | `…(8).png` | `requests-implementation.png` |
| 9 | `/app/marketplace/orders` | table (+ cards) | `…(9).png` | `orders-implementation.png` |

Screenshots live in `docs/ui-verification/caption-fox/marketplace/`, alongside
`*-reference.png` copies of the approved designs.

Supporting routes exercised: `/app/marketplace/compare`, `/app/marketplace/suppliers/{slug}`.

---

## 3. Screen sizes tested

| Size | Result |
|---|---|
| 1491 × 1055 (reference viewport) | Primary target — all nine pages captured here |
| 390 × 844 (mobile, 2× DPR) | No body-level horizontal overflow on the table-heaviest page (Orders); measured `scrollWidth === clientWidth === 390` |

The dense sizing is applied behind the `lg:` breakpoint only, so tablet and phone keep legible type
and full-size touch targets — the same convention used by Advertising and Events.

---

## 4. Visual fidelity work

Measured off the native-resolution reference (not a downscaled side-by-side), matching the
established house numbers: 77px KPI strip, 17px KPI values, ~9px labels, 19px H1, 11px tabs.

| Element | Before | After (matches reference) |
|---|---|---|
| Page H1 / subtitle | 24px / 14px | 19px / 10.5px at `lg` |
| Tab strip | 14px, 47px tall | 11px, ~39px tall |
| Search hero | 44px input, filters wrapped onto **2 rows** | 40px input, all 7 filters + "More filters" on **one row**, hero 209px tall (reference 206px) |
| KPI strip | six detached cards over **2 rows** | one 79px card, six divided cells (reference 77px) |
| Right rail | 300px | 250px (reference ~252px) |
| Discover results | 2 cards/row | 4 cards/row |
| Influencer / UGC results | 2 cards/row | 3 cards/row |
| Saved results | 3 cards/row | 4 cards/row |
| Categories | 3/row, 2-letter initials in flat blue tiles | 4–5/row, real per-category icon + accent colour (already in `marketplace_categories.icon`/`accent`, previously ignored) |
| Featured suppliers (overview) | 1 large card/row | 3 compact cards/row |
| Profile media | deterministic gradients | real photography for all 37 demo profiles |

**Deliberate deviations from the reference images**

1. **Requests** — the design shows a card panel *and* a table panel stacked on one page, showing the
   same records twice. Implemented as a card/table **view toggle** instead: same functionality,
   without duplicating one dataset in two panels (the audit checklist explicitly calls for redundant
   panels to be removed). Both views are real and URL-addressable (`?view=cards|table`).
2. **Overview "Compare suppliers"** — the reference shows it pre-populated. Live, it renders its
   empty state until the user selects suppliers, because comparison state is held in the URL. The
   populated state is reachable at `?compare=<id>,<id>`.
3. Two supplier rows (`jamahl-thomas-creative-studio`, `luna-creative-co-9b50fd`) are **real,
   non-demo** records and are deliberately left without seeded media.

---

### 4.1 Second fidelity pass (measured)

Content-aligned mean pixel diff per page, with each reference's own shell origin (lower is closer):

| Page | Before | After |
|---|---|---|
| Overview | 35.8 | 30.6 |
| Discover | 64.8 | 57.8 (38.5 once the discover-mode row, which only this reference omits, is set aside) |
| Influencers | 38.9 | 35.0 |
| Services | 50.4 | 38.7 |
| UGC creators | 58.4 | 47.1 (before the card rebuild below) |
| Categories | 26.0 | 19.9 |
| Saved | 40.4 | 37.1 |
| Requests | 24.3 | 22.7 |
| Orders | 31.9 | 24.7 |

The rest of the gap is mostly content (live names, photos and numbers vs the mock-ups), which will never reach zero.

Changes: header stack cut by ~49px (the H1 sat 52px below the top bar vs 25px in the references); breadcrumbs dropped on the Discover family; Orders hero rebuilt as one control strip (input + Date range, Order status, Escrow, Delivery, Category, Supplier + More filters) with the new Date range/Supplier filters wired to the existing `from`/`supplier` query bounds; Services hero moved into the results column beside the rail; portfolio strips on UGC and Services cards; UGC card rebuilt to the reference (compare checkbox on the cover, badge on the lower edge, heart save, platform icons, single price/View profile/Compare footer). Third pass (code complete, **not yet screenshot-verified** — the local browser session is signed out): Influencers hero rebuilt to its reference (no keyword row; one segmented filter bar whose choices are staged and applied by "Search influencers"; Save search on the title row; Clear all; hero moved into the results column beside the Compare rail). Saved hero rebuilt (in-field search icon, "Clear filters", removable chip per active filter) and its KPI row changed to six separate cards with the icon on the right. The UGC card rebuild is also still awaiting a screenshot.

Fourth pass (code complete, **not yet screenshot-verified**, same reason):
- Overview: the Compare panel shows the three featured suppliers side by side until the user makes a selection, labelled as featured; Buyer requests, Recent orders and the "Grow with trusted partners" card share one row; both tables fit without a horizontal scrollbar (compact budgets, short dates, ETA column); Recommended for you is four mini cards beside Category spotlight.
- Activity feed: `supabase/seed_marketplace_activity_events.sql` (applied) backfills order-completed, dispute and proposal-received events from existing records at their own timestamps, so the timeline mixes event types as the design does.
- Discover: taller covers, the full-width "Add to comparison" row replaced by a compare icon beside View profile, denser filter sidebar and rail.
- Requests: filter row above the search row; "Clear all" and "New request" beside the search box (header button removed to avoid a duplicate; the search input has its own form so the wizard can never submit it); new Deadline filter on the existing `to` bound; six separate stat cards; compact request cards five across.
- Categories: five cards per row, compact prices, no separate Search button.

## 5. Bugs found and fixed

### 5.1 RLS infinite recursion — buyers could not read their own requests (blocker)

`mkt_requests_invited_supplier` on `marketplace_requests` queried
`marketplace_request_invites`, whose own SELECT policy queries `marketplace_requests`. Postgres
rejected every read with `infinite recursion detected in policy for relation
"marketplace_requests"`.

Effect: the Requests page, the overview "Buyer requests" panel and the open-requests KPI were all
empty for every user, while the rows existed and the workspace policy permitted them. The failure
was silent in the UI — it looked like an empty state.

Fix: `supabase/migrations/20260916000000_marketplace_requests_policy_recursion.sql` resolves the
caller's supplier ids and invited request ids through `SECURITY DEFINER` helpers
(`my_marketplace_supplier_ids()`, `my_invited_request_ids()`) so the policies no longer re-enter
each other. Grants are `authenticated`-only, revoked from `public`/`anon`. Same pattern as the
existing `20260915000200_affiliates_policy_recursion.sql`.

Verified after the fix:

```
marketplace_requests count= 6 (was: null + recursion error)
POSITIVE own-workspace requests: 6
requests visible: 36 | OUTSIDE member workspaces (must be 0): 0
proposals visible: 222 | not tied to a visible request or own supplier (must be 0): 0
```

### 5.2 On-time delivery decayed to 0% (high)

`getOrderInsights` counted a delivered order as on-time only while `due_date >= today`, i.e. it
asked "is the deadline still in the future" rather than "was it delivered by the deadline". Every
correctly delivered order silently became "late" the day after its due date, so the KPI drifted
towards 0% (it read **0.0%** on the live page). Fixed to compare `completed_at` against `due_date`,
with a regression test pinning the rule.

### 5.3 Completed orders badged "overdue" (medium)

The Orders table applied deadline urgency to every row, so delivered/completed orders displayed
"5d overdue" against a past due date. Urgency is now suppressed once an order is delivered,
cancelled, completed or refunded — there is no deadline left to miss.

### Smaller corrections

- KPI deltas are now real 30-day-over-30-day changes, and are **suppressed** when the prior period
  has fewer than 5 records, so a freshly seeded workspace cannot report "↑2700%".
- A category with no suppliers showed a `0.0` star rating; it now reads "No suppliers yet".
- Duplicate verification badge on influencer cards removed (a check beside the name *and* a
  "Verified" pill), which was also truncating creator names.
- A demo cover carrying third-party brand content (a Netflix screen) was replaced.

---

## 6. Data, migrations and seeders

| File | Purpose | Applied |
|---|---|---|
| `supabase/migrations/20260916000000_marketplace_requests_policy_recursion.sql` | RLS recursion fix (§5.1) | ✅ via PAT |
| `supabase/seed_marketplace_media.sql` | Attaches demo covers/avatars to `marketplace_suppliers` (demo rows only) | ✅ 35 rows |
| `supabase/seed_marketplace_creator_metrics.sql` | Backfills audience/engagement/platform reach for legacy demo creator rows | ✅ 0 remaining nulls |
| `supabase/seed_marketplace_recency.sql` | Re-bases demo activity, requests, orders, proposals, saved items onto `now()`; sets delivery timestamps | ✅ |
| `supabase/migrations/20260916010000_marketplace_portfolio_items.sql` | New `marketplace_portfolio_items` table (RLS: public read for active suppliers, owner-only write) behind the portfolio strips | ✅ via PAT |
| `supabase/seed_marketplace_portfolio.sql` | Four demo portfolio thumbnails per demo creator/provider (140 rows, 35 suppliers) | ✅ |
| `scripts/render-marketplace-seed-media.py` | Renders 37 covers + 37 avatars from Unsplash-licensed photography, with a designed-gradient fallback | ✅ 37/37 from Unsplash |

All seeders are idempotent, demo-scoped (`is_demo`) and reversible. Derived values are computed
from each row's own signals (reviews, rating, id hash) — never random — so repeated runs are stable.

**Tables touched:** `marketplace_suppliers` (media + creator metrics), `marketplace_activity`,
`marketplace_requests`, `marketplace_orders`, `marketplace_proposals`, `marketplace_saved_items`,
`marketplace_saved_searches`. No schema changes; `avatar_url`/`cover_url`/`completed_at` already existed.

**RLS policies checked:** `mkt_requests_workspace`, `mkt_requests_invited_supplier` (rewritten),
`mkt_request_invites_party` (rewritten), `mkt_proposals_buyer` (rewritten), `mkt_orders_workspace`,
`mkt_orders_party`.

---

## 7. Tests run

| Command | Result |
|---|---|
| `npx vitest run src/lib/marketplace/marketplace.test.ts` | **17 passed** (new file) |
| `npx vitest run` (full suite) | **274 passed, 1 failed** — the failure is `src/lib/events/entitlements.test.ts`, pre-existing and untouched by this work |
| `npx tsc --noEmit` | No errors in marketplace source. Remaining errors are pre-existing: stale `.next` generated route types, and a broken `src/app/app/seo` module |
| `npx eslint src/lib/marketplace src/components/marketplace src/app/app/marketplace` | **0 errors, 0 warnings** after cleanup |

New tests (`src/lib/marketplace/marketplace.test.ts`) cover entitlements and plan gating, URL query
round-tripping, hostile/invalid query parameters, comparison limits, UK money/date formatting,
em-dash-not-zero rendering, deterministic proposal match scoring, and the §5.2 on-time regression.

---

## 8. Browser QA

- Chrome MCP at 1491 × 1055 for all nine routes; screenshots captured and compared side-by-side
  against the approved references.
- Console: no errors on any marketplace route. One benign Next.js `<Image>` aspect-ratio warning
  originates from the shell logo, not this module.
- Network: no failed requests on the happy path.
- Workspace isolation re-tested as the signed-in user via the anon key (not service role).

---

## 9. Remaining issues

| Severity | Issue |
|---|---|
| Low | Portrait photos cropped to a 16:9 cover sit tight on the top of the head on a few profiles. Cosmetic; inherent to reusing one source image for both cover and avatar. |
| Low | Services and Categories carry the bottom trust strip; the Services reference also shows a portfolio thumbnail strip per provider, which is not implemented (needs a real portfolio-media source rather than invented thumbnails). |
| Low | Escrow figures come from the local ledger. Live settlement still requires Stripe Connect — see the user-fixes note. |
| Pre-existing | `src/lib/events/entitlements.test.ts` fails, and `src/app/app/seo` has type errors. Both outside this section. |

---

## 10. Release decision

**Ready for release, pending one visual check of the rebuilt UGC card,** for the buyer-side Marketplace, with live payment settlement gated behind the
Stripe Connect setup documented in `release-gated/user-fixes/marketplace.md`.

The blocker found in this pass (§5.1) is fixed, verified, and covered by workspace-isolation checks;
the two data-integrity defects (§5.2, §5.3) are fixed and regression-tested.
