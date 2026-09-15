# Caption Fox — Shared Marketplace Module Implementation Tracker

Nine approved marketplace designs implemented as separate, route-backed pages inside the
existing Caption Fox `/app` shell (`Sidebar` + `TopNav` + `MobileNav` + `FoxAIBubble`).

**Reference designs:** `designs/Marketplace/ChatGPT Image Jul 24, 2026, 02_55_2*.png` (1–9)
**Reference viewport:** 1491 × 1055
**Canonical base route:** `/app/marketplace`

---

## 1. Route audit and decision record

The prompt proposed `/{type}/marketplace/...`. The repository audit found two distinct surfaces:

| Surface | Route | What it is |
|---|---|---|
| Production app shell | `/app/*` | Real `Sidebar`/`TopNav`/`MobileNav`, real Supabase data, real workspace switching |
| Development fixture shell | `/{workspaceType}/*`, `/shell/*` | `CaptionFoxShell` — deterministic local fixtures, banner reads "Development shell only — local fixtures, no live actions or production data" |

`/app/marketplace` was **already registered** in `Sidebar.tsx` (`workspaceNavAllowlist` for
`creator` and `small_business`, and in the `Collaborate` nav group) and in `MobileNav.tsx`,
but had no route — it fell through to the `/app/[section]/[[...path]]` fixture shell.

**Decision:** the canonical Marketplace lives at `/app/marketplace/*`, matching the existing
sidebar registration and the convention set by the most recent real modules
(`/app/campaigns`, `/app/calendar`). No duplicate per-workspace-type route implementations
were created — one implementation is driven by workspace type, plan, role and permission
through a single entitlement resolver.

---

## 2. Route table

| ID | Route | Page / View | Reference | Shell | Real data | Search | Filters | Views | Compare | Save | Requests | Orders | Escrow | Disputes | CRUD | Export | Permissions | Loading | Empty | Error | Responsive | Types | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 5.14.01 | `/app/marketplace` | Overview | img 1 | ✅ | ✅ | ✅ | ✅ | cards | ✅ | ✅ | preview | preview | KPI | KPI | — | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Code complete |
| 5.14.02 | `/app/marketplace/discover` | Discover | img 2 | ✅ | ✅ | ✅ | ✅ | cards, list | ✅ tray | ✅ | link | — | — | — | — | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Code complete |
| 5.14.02.01 | `/app/marketplace/discover/influencers` | Influencer search | img 3 | ✅ | ✅ | ✅ | ✅ | cards, list | ✅ | ✅ | outreach | — | — | — | — | — | ✅ plan-gated | ✅ | ✅ | ✅ | ✅ | ✅ | Code complete |
| 5.14.02.02 | `/app/marketplace/discover/services` | Services search | img 4 | ✅ | ✅ | ✅ | ✅ | cards, list | ✅ | ✅ | RFQ CTA | — | — | — | — | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Code complete |
| 5.14.02.03 | `/app/marketplace/discover/ugc-creators` | UGC creator search | img 5 | ✅ | ✅ | ✅ | ✅ | cards, list | ✅ | ✅ | outreach | — | — | — | — | — | ✅ plan-gated | ✅ | ✅ | ✅ | ✅ | ✅ | Code complete |
| 5.14.03 | `/app/marketplace/categories` | Categories | img 6 | ✅ | ✅ | ✅ | ✅ | grid, list | compare table | ✅ | — | — | — | — | — | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Code complete |
| 5.14.04 | `/app/marketplace/saved` | Saved | img 7 | ✅ | ✅ | ✅ | ✅ | cards, list | ✅ shortlist | ✅ full CRUD | link | link | — | — | ✅ notes | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Code complete |
| 5.14.05 | `/app/marketplace/requests` | Requests | img 8 | ✅ | ✅ | ✅ | ✅ | cards, table | proposal compare | — | ✅ wizard | — | — | — | ✅ | ✅ CSV | ✅ plan-gated | ✅ | ✅ | ✅ | ✅ | ✅ | Code complete |
| 5.14.06 | `/app/marketplace/orders` | Orders | img 9 | ✅ | ✅ | ✅ | ✅ | table | — | — | link | ✅ | ✅ | ✅ | ✅ | ✅ CSV | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Code complete |
| 5.14.07 | `/app/marketplace/suppliers/[slug]` | Supplier / creator detail | — | ✅ | ✅ | — | — | tabs | — | ✅ | RFQ CTA | — | — | — | — | — | ✅ | ✅ | ✅ | notFound | ✅ | ✅ | Code complete |
| 5.14.08 | `/app/marketplace/compare` | Full comparison | — | ✅ | ✅ | — | — | table | ✅ | ✅ | — | — | — | — | — | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Code complete |

**Status legend:** Not Started · Audited · In Progress · **Code Complete** · Visual Review ·
Functional Review · Failed · Passed · Production Ready.

No row is marked *Production Ready* — see §9 for the outstanding gates.

---

## 3. Database

`supabase/migrations/20260831000000_marketplace_module.sql` — **applied** via
`node scripts/apply-migration.mjs …` (HTTP 201).

### Extended
- `marketplace_suppliers` — 24 discovery columns: `tagline`, `region`, `country`, `languages[]`,
  `platforms[]`, `tags[]`, `badges[]`, `starting_price_cents`, `price_unit`, `min_order_cents`,
  `currency`, `turnaround_hours`, `response_time_minutes`, `on_time_delivery_pct`,
  `job_success_pct`, `projects_count`, `available_now`, `audience_size`, `audience_summary`,
  `engagement_rate`, `follower_counts` (jsonb), `portfolio_urls[]`, `is_demo`.
- `marketplace_orders` — `workspace_id`, `reference` (ORD- sequence), `request_id`,
  `proposal_id`, `title`, `category`, `escrow_status`, `delivery_status`, `current_milestone`,
  `due_date`, `dispute_state`, `released_cents`, `refunded_cents`, `completed_at`, `updated_at`.
  `listing_id` relaxed to nullable so RFQ-originated orders do not need a listing.
- `marketplace_disputes` — `workspace_id`, `milestone_id`, `amount_cents`, `severity`,
  `requested_resolution`, `updated_at`.

### New tables
`marketplace_categories`, `marketplace_supplier_categories`, `marketplace_saved_items`,
`marketplace_saved_searches`, `marketplace_shortlist_items`, `marketplace_comparisons`,
`marketplace_requests`, `marketplace_request_invites`, `marketplace_proposals`,
`marketplace_order_milestones`, `marketplace_escrow_transactions`, `marketplace_activity`.

### Indexes
GIN on `tags`/`platforms` and an English `tsvector` over name/headline/tagline/bio;
btree on `type`, `available_now`, workspace + status/escrow/delivery, deadline, and
`(order_id, position)` for milestones. Unique indexes enforce one saved item per
(workspace, user, supplier) and one proposal per (request, supplier).

### RLS
Every new table has RLS enabled. Buyer-side tables gate on
`public.is_workspace_member(workspace_id)` (reused from `20260829000000_brand_assets.sql` —
**not** redefined, which would fail on the parameter rename). Saved items, saved searches,
shortlists and comparisons additionally require `user_id = auth.uid()`. Proposals are
readable by the buying workspace *or* the owning supplier; only suppliers may insert.
Requests are readable by invited suppliers only when `status <> 'draft'`.

### Seed
`supabase/seed_marketplace_module.sql` — **applied**, idempotent. Seeds the category
taxonomy (12 categories, reference data) plus a clearly-flagged demo directory
(`is_demo = true`) and per-workspace buyer data.

Row counts after seeding: 36 suppliers · 38 category links · 72 saved items · 24 saved
searches · 36 requests · 222 proposals · 60 orders · 180 milestones · 78 escrow
transactions · 6 disputes · 84 activity entries.

---

## 4. Application architecture

| File | Purpose |
|---|---|
| `src/lib/marketplace/module.ts` | Route map, tab/mode registries, filter bands, row shapes, status metadata, formatters, `matchScore()` |
| `src/lib/marketplace/entitlements.ts` | **Single** entitlement resolver — module access, plan gates, capability matrix, plan-scaled compare/saved limits |
| `src/lib/marketplace/server.ts` | `getMarketplaceSession()` / `requireMarketplaceModule()` — auth, workspace, plan, role, platform-admin |
| `src/lib/marketplace/query.ts` | Canonical URL query-state: parse, validate, filter count, href builder, saved-search serialiser |
| `src/lib/marketplace/data.ts` | All reads. Postgres-side filtering/sorting/pagination with exact counts |
| `src/lib/marketplace/actions.ts` | All mutations. `'use server'`, guarded, audited, activity-logged, revalidated |
| `src/components/marketplace/module/*` | 13 shared components — no page owns a one-off card, table or control |

### Permissions added (`src/lib/permissions.ts`)
24 new capabilities: `marketplace.view/search/save/compare`,
`marketplace.requests.{view,create,edit,invite,evaluate,close}`,
`marketplace.orders.{view,create,edit,approve_delivery,cancel}`,
`marketplace.escrow.{view,fund,release,refund}`,
`marketplace.disputes.{view,create,respond,resolve}`, `marketplace.export`.

Granted to `owner` (all), `admin` (all), `manager` (all except escrow release/refund,
dispute resolve, order cancel), `approver` (delivery approval + dispute response),
`analyst` (read + export), `creator` (discovery + read). Added as a `Marketplace` group in
`PERMISSION_GROUPS` so it appears in the role editor.

### Plan gates
| Module | Minimum plan |
|---|---|
| Overview, Discover, Services, Categories, Saved, Orders | any |
| Influencer search, UGC creator search, Requests | `creator_pro` |

Compare limit: 2 (starter) → 3 (creator_pro/team) → 4 (brand/enterprise).
Saved-item limit: 25 → 100 → 250 → 500. Enforced **server-side** in `toggleSavedSupplier`.

---

## 5. What is genuinely wired

**Search** — one `SearchHero` backs all nine surfaces. The input submits to URL state; each
filter select writes a real query param; popular chips run real searches; "Save search"
persists to `marketplace_saved_searches` via a server action and appears in Saved and in the
Discover "Recent searches" rail. Result counts come from `count: 'exact'` on the same query.

**Filtering** — location/region/country, category (resolved through the join table),
platform and language (`contains` on array columns), tag, budget band, rating band,
turnaround band, audience band, engagement band, available-now, verified-only. All applied
in Postgres, all reflected in removable filter chips with individual and bulk clearing.

**Sorting / pagination** — 7 sorts including a deterministic "best match"
(verified → rating → review count). `range()` pagination with page-size control and a
windowed pager. No client-side slicing of a full table.

**Views** — Discover/Influencers/Services/UGC: cards + list. Categories: grid + list.
Requests: cards + table. Orders: table (cards deliberately not forced — the operational
columns are the point). Every switch is a real URL change.

**Save / shortlist / compare** — save and shortlist are optimistic with rollback on server
refusal. Comparison members live in `?compare=` so the tray survives refresh, back/forward
and link sharing; `/app/marketplace/compare` renders the full table and marks the leading
value per row only when every column has a comparable figure.

**Requests** — 5-step wizard (type → brief → budget/timeline → invite → review) with
per-step validation, server-side re-validation, field errors mapped back to the owning step,
draft save, and a disabled submit while in flight. Creates the request, validates invitees
are still active, inserts invites, writes an audit row and an activity entry.

**Proposals** — real `match_score` from price competitiveness within the same request (30%),
capability (30%), availability (20%) and rating (20%). The weighting is stated on the page.
Shortlist/accept write through a guarded action that proves ownership via the request's
workspace, not the client payload.

**Orders / escrow / disputes** — approve delivery, request revision, release escrow, hold
escrow, open dispute. Escrow release writes the ledger row **first** with a deterministic
idempotency key (`release-{orderId}-{releasedCents}`) so a double-click or retry cannot
release twice, and refuses when the delivery is not approved or a dispute is holding funds.
Opening a dispute freezes the remaining balance (`escrow_status → on_hold`).

**Exports** — CSV for requests and orders, permission-gated on `marketplace.export`,
BOM-prefixed, honouring the current filters and the visible columns.

**Activity / audit** — every mutation writes `audit_logs` (workspace, actor, action,
resource type/id, metadata, source route) and a human-readable `marketplace_activity` row
that the on-page feeds render. Neither can break the primary action.

---

## 6. Design fidelity notes

Deliberate deviations from the reference images, and why:

1. **Numbers are calculated, never transcribed.** The references show "8,542 active
   suppliers", "$482,931 escrow", "94% match score". Every one of those is computed from the
   real dataset. With the seeded data the figures are smaller — that is correct behaviour.
2. **Currency is GBP**, matching the rest of Caption Fox and the UK formatting convention in
   `src/lib/utils.ts`, not the USD in the mock-ups.
3. **Portfolio thumbnail strips are omitted where no media exists.** The references show
   4-up campaign thumbnails on influencer and UGC cards. Rendering placeholder tiles would be
   fake content, so the strip renders only when `portfolio_urls` is populated.
4. **Cover images** fall back to a deterministic brand gradient derived from the profile slug
   rather than a stock photo.
5. **"Personalised recommendations"** on the UGC page is a real contact route to the
   marketplace team, not a fabricated AI recommendation panel — there is no recommendation
   engine to ground it.
6. **Orders keeps table as the only view.** A card view would reduce operational clarity for
   a 10-column escrow/delivery/dispute grid.

---

## 7. Accessibility

- Every icon-only control has an `aria-label`; toggles use `aria-pressed`; menus use
  `aria-haspopup`/`aria-expanded`; the availability switches use `role="switch"` + `aria-checked`.
- Tables have `<caption class="sr-only">`, `scope="col"`/`scope="row"` headers.
- Tabs use `aria-current="page"`; pagination is a labelled `<nav>` with `aria-disabled` ends.
- Result counts are `role="status" aria-live="polite"`.
- Filters are native `<select>` with associated `<label>` — full keyboard support, no
  custom-listbox trap.
- Form fields set `aria-invalid` and `aria-describedby` when validation fails.

## 8. Responsive

Shell width `max-w-[1600px]` with `px-4 / sm:px-6 / lg:px-8` gutters, matching the app shell.
Right rails collapse below `xl`; the Discover filter rail is `hidden xl:block` (its filters
remain reachable through the search-card selects); card grids step
1 → 2 → 3; every table sits in an `overflow-x-auto` container with a `min-w-` floor;
the compare tray is sticky and collapsible.

---

## 9. Outstanding gates before *Production Ready*

| # | Item | Owner |
|---|---|---|
| 1 | Chrome MCP interaction pass at 1440 / 1280 / 1024 / tablet / mobile / PWA, with screenshots compared to the nine references | QA |
| 2 | Automated tests (unit for entitlements + query parsing + `matchScore`, integration for RLS positive/negative, E2E for the request and escrow flows) | Eng |
| 3 | Live Stripe Connect wiring — escrow ledger rows are written as `pending` and need provider reconciliation (see `release-gated/user-fixes/marketplace.md`) | User |
| 4 | Production build is currently blocked by unrelated in-flight work outside this module (`src/lib/partnerships/entitlements.ts`, `src/components/advertising/pages/*`) | Other session |

`npx tsc --noEmit` reports **zero errors across every marketplace file**.
