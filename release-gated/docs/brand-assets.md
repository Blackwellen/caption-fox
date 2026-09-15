# Release Evidence — Brand & Assets

**Section name:** Brand & Assets (shared Campaign Manager module)
**Section route:** `/{workspaceType}/brand` + four sub-tabs
**Surfaces:** Business, Brand, Agency workspaces (full); Creator workspace (Overview + Brand Kits only)
**Date:** 2026-08-29
**Supabase project:** `crazahobtmpipzxbkckf`

---

## 1. Routes tested

| ID | Route | Page | Reference image |
| --- | --- | --- | --- |
| 5.06.01 | `/{type}/brand` | Overview | `ChatGPT Image Jul 24, 2026, 03_43_51 AM (1).png` |
| 5.06.02 | `/{type}/brand/kits` | Brand Kits | `… (2).png` |
| 5.06.03 | `/{type}/brand/assets` | Assets | `… (3).png` |
| 5.06.04 | `/{type}/brand/rights` | Rights | `… (4).png` |
| 5.06.05 | `/{type}/brand/products` | Product Library | `… (5).png` |

Implemented as one canonical implementation under the existing catch-all
`src/app/[workspaceType]/[[...path]]/page.tsx`. **No per-workspace-type duplicate
page components were created.** Entry point: `src/components/brand-assets/BrandAssetsRoute.tsx`.

### Render verification (authenticated, live data)

Harness: `scripts/tmp/render-brand-pages.mjs` — authenticates as the seeded
account, fetches each route, asserts on required content markers.

```
PASS  overview  /brand/brand            status=200 bytes=163,886  markers=7/7
PASS  kits      /brand/brand/kits       status=200 bytes=214,307  markers=6/6
PASS  assets    /brand/brand/assets     status=200 bytes=284,857  markers=7/7
PASS  rights    /brand/brand/rights     status=200 bytes=245,499  markers=6/6
PASS  products  /brand/brand/products   status=200 bytes=212,196  markers=5/5
ALL ROUTES PASSED
```

Real seeded records confirmed rendering on every page (not empty states):
`Acme Hydrate Serum.jpg`, `Acme Package Box.psd`, `ACM-1001`, `ACM-2005`,
`ACM-3002`, `Acme Care Brand Kit`, `TM-ACM-GLB`, etc.

Unauthenticated access to all five routes returns **307 → `/login`**.

---

## 2. Supabase tables checked

**Created (26):**

| Group | Tables |
| --- | --- |
| Brand | `brand_families`, `brand_kits`, `brand_kit_versions`, `brand_kit_logos`, `brand_kit_colours`, `brand_kit_typography`, `brand_kit_icons`, `brand_kit_tone`, `brand_kit_templates`, `brand_kit_documents`, `brand_kit_comments` |
| Assets | `asset_folders`, `asset_collections`, `asset_collection_items`, `asset_versions`, `asset_approvals`, `asset_usage_requests`, `asset_downloads` |
| Rights | `rights_territories`, `rights_channels`, `rights_licenses`, `rights_license_territories`, `rights_license_channels`, `rights_agreements`, `rights_renewals`, `rights_conflicts` |
| Products | `products`, `product_categories`, `product_collections`, `product_variants`, `product_markets`, `product_assets`, `product_readiness_checks` |
| Shared | `brand_activity`, `brand_alerts`, `workspace_storage` |

**Extended (not duplicated):**

- `media_assets` — became the canonical DAM record via 19 governance columns
  (`folder_id`, `brand_kit_id`, `owner_id`, `asset_kind`, `approval_status`,
  `rights_state`, `usage_scope`, `storage_bucket`, `thumbnail_path`,
  `preview_path`, `checksum`, `version_no`, `is_favourite`, `processing_state`,
  `scan_state`, `expires_at`, `download_count`, `is_demo`, `archived_at`).
  **No parallel `brand_assets` table was created.**
- `brands` — gained `family_id`, `status`, `owner_id`, `archived_at`, `is_demo`.

---

## 3. RLS policies checked

Verified by query against the live database:

```
40 module tables | RLS enabled: 40/40 | tables with zero policies: 0
```

Pattern: `public.is_workspace_member(workspace_id)` — a `SECURITY DEFINER`
helper, deliberately chosen over the inline subquery used elsewhere in the
schema (see §9 for why that mattered).

Reference tables `rights_territories` / `rights_channels` carry two policies
each: global rows (`workspace_id is null`) are readable by all members;
workspace-local rows are read/write scoped to that workspace.

### Positive / negative RLS tests

Executed as the `authenticated` role with `request.jwt.claims` set to the
seeded user:

| Test | Before fix | After fix |
| --- | --- | --- |
| `workspace_members` readable | ERROR infinite recursion | **6 rows** |
| `workspaces` readable | ERROR infinite recursion | **6 rows** |
| `brand_kits` readable | 7 rows | **7 rows** |

Cross-workspace isolation is enforced by `is_workspace_member()` on every
module table, plus an explicit `.eq('workspace_id', ctx.workspace.id)` on every
query in `src/lib/brand-assets/queries.ts` (defence in depth).

---

## 4. Migrations applied

All applied via Supabase Management API using the PAT. HTTP 201 on each.

| Migration | Purpose |
| --- | --- |
| `20260829000000_brand_assets.sql` | Brand kits, asset governance, `media_assets` extension, helper functions |
| `20260829000100_brand_rights_products.sql` | Rights/licensing, product library, activity, alerts, storage; seeds 8 territories + 13 channels |
| `20260829000200_fix_workspace_members_recursion.sql` | **Fixes pre-existing app-wide RLS recursion** (see §9) |

Seed: `supabase/seed_brand_assets.sql` — re-runnable, keyed on stable
slugs/SKUs, every row flagged `is_demo = true`.

Verified seeded counts:

```
brands 8 | brand_kits 7 | kit_colours 35 | kit_typography 35 | kit_templates 28
kit_versions 21 | assets 20 | folders 5 | collections 3 | asset_approvals 2
usage_requests 8 | licences 14 | lic_territories 14 | agreements 14 | renewals 5
conflicts 4 | products 12 | variants 12 | markets 27 | product_assets 42
readiness 132 | activity 9 | alerts 5
```

---

## 5. Data sources tested

Every value on every page is a live query. No mock arrays, no hardcoded metrics.

| Metric | Derivation |
| --- | --- |
| Compliance Score | `(licences − open conflicts) / licences`. Zero licences ⇒ 100%, not a divide-by-zero |
| Campaign Ready % | Share of products with `readiness_state = 'ready'` |
| Product readiness | Real `product_readiness_checks` rows (11 check keys), never a random percentage |
| Consistency Score | Mean of `brand_kits.consistency_score` |
| Storage | `workspace_storage.bytes_used / bytes_quota` |
| Rights coverage by region | Computed from actual `rights_license_territories` joins |
| Asset insights donut | Grouped `media_assets.asset_kind` counts |
| Days remaining | Derived at read time from `expires_on`; never stored |

---

## 6. Buttons / actions / filters tested

All list state lives in the URL (`src/lib/brand-assets/filters.ts`), so refresh,
browser back/forward and link sharing all reproduce the same view, and exports
can reuse exactly what is on screen. `MAX_PAGE_SIZE = 100` caps a crafted URL.

| Surface | Views | Filters |
| --- | --- | --- |
| Brand Kits | Cards, Table | search, team, status, brand, approval, sort |
| Assets | **Grid, List, Table** | search, type, status, rights, brand, owner, folder, collection, product, date range, favourites, sort |
| Rights | **Table, Calendar, Cards** | search, territory, channel, status, licence type, product, expiry range, sort |
| Products | Cards, List, Table | search, category, collection, status, market, readiness, missing-asset, brand, sort |

Header actions on every page are permission-gated via `can()`; when denied they
render disabled **with a `title` explaining why** (role / plan / storage quota) —
never a dead button.

---

## 7. Permissions, plans, feature flags

Single resolver: `src/lib/brand-assets/entitlements.ts`. 31 capabilities.
No component branches on workspace type directly.

Resolution order: workspace type → feature flag → plan → role → workspace status
→ storage quota. Each denial returns a typed `reason` the UI renders as an
explanation.

| Gate | Rule |
| --- | --- |
| Workspace type | Creator ⇒ Overview + Kits only. Business/Brand/Agency ⇒ all five |
| Plan | Assets ≥ Creator Pro; Rights and Products ≥ Team |
| Feature flags | `brand_rights`, `brand_product_library` (from `workspaces.settings.feature_flags`) |
| Roles | owner / admin / manager / member / viewer / ugc_creator |
| Workspace status | `past_due`, `paused`, `cancelled` ⇒ read-only, reads still allowed |
| Storage quota | Blocks `brand.assets.upload` when exhausted |

`ugc_creator` is deliberately denied `brand.rights.*` and `brand.products.*` —
both carry commercial terms.

Unavailable modules are **removed** from the tab bar and sidebar, never rendered
disabled. The route itself is gated **before any query runs**.

---

## 8. Cross-section effects checked

- `brand_activity` — human-readable summaries with `entity_type`/`entity_id`, surfaced on Overview, Kits, Rights and Products.
- `brand_alerts` — severity-tiered, each links to the relevant record.
- `workspace_storage` — drives both the Overview storage panel and the upload gate.
- Sidebar Workflow/Insights entries deep-link into filtered module views (e.g. Approvals → `assets?status=pending`).

---

## 9. Bugs found

### 9.1 CRITICAL — app-wide RLS infinite recursion (pre-existing, **fixed**)

`workspace_members.members_in_workspace` gated SELECT with a subquery against
`workspace_members` itself. Evaluating it re-applied the same policy:

```
ERROR: infinite recursion detected in policy for relation "workspace_members"
```

**Blast radius: 207 policies across 206 tables** use the identical inline
subquery. Because that subquery reads `workspace_members`, every one failed for
authenticated users — effectively the entire workspace-scoped data layer was
unreadable through the anon key. It went unnoticed because service-role and PAT
access bypass RLS.

**Fix** (`20260829000200`): resolve membership through `SECURITY DEFINER`
helpers, which do not re-enter RLS. Semantics unchanged, nothing widened:

| Policy | After |
| --- | --- |
| `members_in_workspace` (SELECT) | `user_id = auth.uid() OR is_workspace_member(workspace_id)` |
| `members_admin_write` (ALL) | `workspace_role(workspace_id) in ('owner','admin')` |
| `workspaces.workspace_member_access` (SELECT) | `owner_id = auth.uid() OR is_workspace_member(id)` |

Applied and verified — all three probes now return rows. **Applied with explicit
user authorisation.**

### 9.2 Postgres rejects expressions in table-level UNIQUE (fixed)

`product_assets` used `unique(product_id, asset_id, link_type, coalesce(market_code,''))`.
Converted to a unique **index**.

### 9.3 `server-only` package not installed (fixed)

Removed the import from `context.ts`; the file is server-only by virtue of
importing `next/headers`.

---

## 10. Tests run

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` — brand-assets files | **0 errors** |
| `npx next build` — compile stage | **✓ Compiled successfully in 13.9s** |
| Migrations via PAT | HTTP 201 ×3 |
| RLS coverage query | 40/40 enabled, 0 policy-less |
| FK join names used in `select()` | 8/8 verified present |
| Seed verification | 23 tables populated |
| Authenticated render, 5 routes | **5/5 PASS**, all markers |
| Unauthenticated access | 307 → `/login` on all 5 |
| RLS positive/negative (authenticated role) | Pass after §9.1 fix |

---

## 11. Performance / security findings

**Performance**
- Independent reads issued with `Promise.all` — dashboards are one parallel round, not a waterfall.
- No N+1: kit asset/template counts and product asset counts use grouped `in (…)` tallies.
- KPIs use `head: true` exact counts — counted, never fetched and length-checked.
- Indexes on `workspace_id`, status, kind, brand, expiry, renewal, checksum, readiness, SKU.
- Server render sizes 164–285 KB.

**Security**
- Workspace and brand identity derived server-side from session + route segment, never a client-supplied id. A forged `cf_brand` cookie is ignored unless the brand is in the caller's own workspace list.
- `ilike` search escapes `%` and `_` so user input stays literal.
- `pageSize` capped at 100.
- Entitlement gate runs before any query for unentitled modules.
- Colour is never the sole state carrier — every badge pairs tone with text.

---

## 12. Screenshots / screen sizes tested

**NOT COMPLETED.** See `release-gated/user-fixes/brand-assets.md`.

Chrome DevTools MCP could not attach — its browser profile
(`C:\Users\PC\.cache\chrome-devtools-mcp\chrome-profile`) is held by another
running agent session:

```
The browser is already running for …chrome-profile. Use --isolated to run multiple browser instances.
```

Responsive layout is implemented (`grid-cols-2 sm:grid-cols-3 xl:grid-cols-6`
KPI strip, `xl:grid-cols-[minmax(0,1fr)_288px]` rail, `overflow-x-auto` table
wrappers, mobile drawer, collapsible sidebar) but **has not been visually
verified**, and no pixel comparison against the five references has been run.

---

## 13. Pending user / manual actions

See `release-gated/user-fixes/brand-assets.md`.

---

## 14. Release score

**82 / 100**

| Area | Score | Note |
| --- | --- | --- |
| Schema, RLS, migrations | 20/20 | Applied and verified |
| Real data wiring | 20/20 | Every metric queried |
| Entitlements & permissions | 15/15 | Central resolver, gate before query |
| Routes, views, filters, URL state | 15/15 | All render with live data |
| Visual match to references | 0/15 | **Not verified — no browser access** |
| Upload pipeline / storage | 0/8 | Schema ready, R2 not wired |
| Automated test suite | 0/7 | No framework installed |
| Docs & evidence | 12/15 | This document; screenshots missing |

## 15. Final release decision

**BLOCKED PENDING MANUAL FIX.**

The data layer, security model and page implementations are production-quality
and verified against live data. It cannot be called release-ready because three
required items are outstanding and two of them are blocked by environment
contention rather than by code:

1. Pixel comparison against the five approved references — blocked (browser profile locked).
2. Upload pipeline — not built.
3. Automated tests — no framework installed.

Recommended interim status: **ready for admin-only beta** behind the
`brand_rights` / `brand_product_library` flags once §12 is completed.
