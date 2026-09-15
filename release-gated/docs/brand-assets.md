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

---

# Update — 2026-09-15

## What changed

| Area | Change |
| --- | --- |
| Shell | The module no longer renders its own sidebar/top bar (that copied the design image and broke CLAUDE.md rule 2). It now lives inside the canonical workspace shell (`app/[workspaceType]/layout.tsx`). Only the Brand & Assets entry was added, for Creator. |
| Pages | All five routes rebuilt to the reference layouts at 1491×1055: KPI strip (84px cards), right rails, lower panels, stacked filter controls, solid view switchers. |
| Detail + create routes | New: `/kits/{id}` (10 tabs), `/assets/{id}` (7), `/rights/{id}` (4), `/products/{id}` (6), `/kits|rights|products/new`, `/activity`. Unknown ids render not-found, never a list page. |
| Mutations | 25 server actions (`src/lib/brand-assets/actions.ts`): kit create/approve/request-changes/archive/comment; asset upload (signed PUT → server-verified finalise), versioning, favourites, folders, approvals, usage requests, signed download; licence create/renew/restrict/suspend, agreement upload; product create/status/link/unlink/bookmark, CSV import. Each re-resolves workspace + role server-side and logs activity. |
| Storage | Cloudflare R2 private bucket through the shared `src/lib/storage/r2.ts`. Paths `r2:brand-assets/{workspace}/…`; every read is a short-lived signed URL, and only paths under the caller's workspace prefix are ever signed. |
| Export | `GET /{type}/brand/rights/export` — CSV of exactly the on-screen filters, gated by `brand.rights.export`, audit-logged, formula-injection safe. |
| Jobs | pg_cron `brand-rights-sweep` (02:15) moves licences to expiring/expired, flags assets, opens conflicts, creates renewals, keeps one alert current. `brand-readiness-sweep` (02:30) recomputes readiness. Both idempotent (verified: second run changes nothing). |
| Readiness | Now computed by one SQL function `brand_product_readiness()` from real links (11 weighted checks). Seeded scores were typed in; they are now computed (54–85%). |
| Seed | Removed `random()` values and a hardcoded 1.28 TB storage figure. Added demo teammates with portraits, deterministic owners, folder filing, a 52-row download audit trail, kit update history and icon styles. Demo media rendered sharp (Unsplash photos + rendered covers/logos) in `supabase/seed-media/brand-assets/`, uploaded via `scripts/seed-brand-media-r2.mjs`. |
| Coverage map | Real geography: Natural Earth 110m → 3° dot grid (`ui/world-dots.ts`), coloured from live licence territories, with a screen-reader table. |

## Bugs found and fixed

1. Module rendered a private sidebar copied from the design image (sidebar rule violation) — removed.
2. Every header action was a link to a `?create=1` URL that nothing handled (dead buttons) — replaced by real routes/dialogs/actions.
3. Filter selects only applied on Enter (no JS submit) — now apply on change and still work without JS.
4. Brand Kit lower panels (tone, guidelines, templates, lockups) were hardcoded strings — now read from the kit's records.
5. Download failed silently when storage was unavailable — now returns a clear message; button catches unexpected failures.
6. Licences stayed `active` after expiry (no scheduled sweep) — pg_cron sweep added; 2 stale licences corrected.
7. CSV export quoted negative numbers as text — encoder fixed and unit-tested.
8. Page overflowed horizontally on Assets (tables forced grid width) — panels now shrink.
9. Seeder re-run failed on `workspace_members` (pre-existing trigger references a missing `updated_at` column) — seeder made insert-only for memberships. **The trigger itself is still wrong for any update to `workspace_members`; see user-fixes.**

## Verified in the browser (Chrome MCP, 1491×1055)

| Flow | Result |
| --- | --- |
| Create Brand Kit → submit | Redirects to `/kits/{id}`; DB: 3 colours, 4 type styles, v1, activity row |
| Approve & publish kit | Message "Approved QA Verification Kit."; DB: active/approved, published_version 1, v1 published |
| Asset detail → Approvals | Approve / Request changes / Reject rendered for pending approval |
| Licence detail | Terms, expiry state, row actions render |
| Product detail → readiness | Weighted checks, Approve & activate / Archive |
| Rights CSV export | 200 `text/csv` attachment, UK dates, filters honoured |
| Console | No errors on Overview, Kits, Assets, Products, create form |

Visual diffs (mean abs. pixel difference, content area, 0 = identical): Overview 24.0, Brand Kits 21.7, Assets 24.7, Product Library 20.7. The hottest regions in every page are image slots, which stay blank until the R2 key is fixed.

## Tests

| Command | Result |
| --- | --- |
| `npx tsc --noEmit -p .` | 0 errors (repo-wide) |
| `npx vitest run src/lib/brand-assets` | 21 passed |
| Migrations via PAT | 201 ×2 (`20260915200000`, `20260915210000`) + seed |

Not yet run: Playwright E2E (not installed), `next build` (other sessions are mid-refactor on the shell), responsive passes at tablet/phone.

## Release score — 2026-09-15

**78 / 100** (stricter rubric than 2026-08-29: functional depth and pixel parity now weighted)

| Area | Score | Note |
| --- | --- | --- |
| Schema, RLS, migrations, jobs | 15/15 | Sweeps scheduled and verified idempotent |
| Real data, no fake metrics | 15/15 | Typed-in scores and storage padding removed |
| Entitlements & server-side permissions | 10/10 | Every action gated server-side; unit-tested matrix |
| Routes, detail pages, create flows | 12/15 | Import Kit / Share Kit / asset & product CSV export not built |
| Mutations & workflows | 10/12 | Kit flows E2E-verified; licence/product create not clicked through yet |
| Uploads & storage | 3/8 | Built end to end; untestable until R2 key fixed |
| Visual 1:1 parity | 6/15 | Structure matches; image slots blank; tablet/phone not verified |
| Tests | 4/5 | Unit tests; no E2E runner |
| Docs & evidence | 3/5 | Tracker, this update, screenshots in `docs/ui-verification/caption-fox/brand-assets/` |

## Final release decision

**BLOCKED PENDING MANUAL FIX** — the R2 access key (`release-gated/user-fixes/brand-assets.md`, 2026-09-15). Not complete below 100/100.

## Update — 2026-09-15 (later): R2 live, parity pass 2

- R2 key corrected locally; all demo thumbnails, packshots, avatars and logos are served from R2 through workspace-scoped signed URLs.
- Content-aligned diffs vs the references (`scripts/ui-diff-content.py`, lower is closer): Rights **15.4**, Brand Kits **26.1**, Product Library **28.8**, Overview **37.1**, Assets **37.5**. Residual difference is mostly density: the design-locked app shell's sidebar/top bar are wider/taller than the images', so content renders at ~0.97 scale with more vertical rhythm.
- Fixes this pass: activity-feed icons now round and colour-coded by action (expired/rejected rose, etc.); Overview Rights preview status column widened so "Renewal Pending" no longer truncates; KPI cards 84→74px with 19px values; page heading 26→23px; Rights filter bar fits one row; Rights table cell padding tightened so all columns incl. Actions fit at 1491px; panel "View all" links never wrap (shared `Panel`, plus the Expiring Licences header).
- Verified: `tsc` 0 errors; 21/21 unit tests; no body horizontal overflow on Rights at 1491px.

### Release score — 2026-09-15 (later)

**85 / 100**

| Area | Score | Note |
| --- | --- | --- |
| Schema, RLS, migrations, jobs | 15/15 | unchanged |
| Real data, no fake metrics | 15/15 | "Campaign Ready 0%" is real — no product has reached the ready threshold yet |
| Entitlements & server-side permissions | 10/10 | unchanged |
| Routes, detail pages, create flows | 12/15 | Import Kit / Share Kit / asset & product CSV export still not built |
| Mutations & workflows | 10/12 | licence/product create forms not yet clicked through |
| Uploads & storage | 5/8 | R2 read path verified live; browser upload E2E not yet run |
| Visual 1:1 parity | 10/15 | real imagery; diffs above; density still looser than references |
| Tests | 4/5 | no E2E runner |
| Docs & evidence | 4/5 | screenshots + diffs in `docs/ui-verification/caption-fox/brand-assets/` |

**Decision: BLOCKED PENDING MANUAL FIX** — the corrected `CLOUDFLARE_*` values must be added to Vercel before any deployed build can serve or accept media. Not complete below 100/100.

## Update — 2026-09-15 (pass 3): measured density

Method change: instead of eyeballing downscaled side-by-sides, `scripts/ui-stack.py` renders the reference and the implementation region at **native pixels** with x/y rulers, anchored on the module tab underline; `scripts/ui-ruler.py` does the same at content scale. Every size below was read off those stacks, and live element rects were checked with Chrome MCP.

- Shared (all five pages, `lg:` breakpoint only): tabs 11px/18px padding; H1 19px; subtitle 10px; buttons 11px text, 20px padding; KPI cards 77px, 36px icon, 9/17/8.5px; panel titles 11px, "View all" 9.5px; search 28px, selects 24px, stacked selects 30px, 9px text; compact pagination; xs badges 7.5px.
- Per page: asset cards (text 7–8.5px, body −25px); asset rail rows and mini-tables (27px rows); Overview kit row pages five kits with working chevrons (`?kp=`), no scrollbar; Overview captions, rights preview, product cards, activity, alerts 7–8px; kit cards 200px; kit rail rows; Rights rows 36px thumbnails, 8px text, **default 6 rows** (as the reference); Product tiles 160:165 image + divided body, **default 6 per page** (as the reference).
- Results (content-aligned mean diff; before → after): Overview 37.1 → **25.3**, Brand Kits 26.1 → **23.6**, Assets 37.5 → **24.5**, Rights 15.4 → **13.3**, Product Library 28.8 → **22.7**. Remaining hot rows are photographic content (different demo photos) rather than geometry.
- Known, accepted deviations: content ~4% narrower (locked shell); Assets lower row ~40px low (pagination kept for 30 assets; the reference overlaps two panels, an image artefact).
- Verified: `tsc` 0 errors; 21/21 unit tests (page-size defaults updated); no horizontal overflow at 1491 or 390; phone/tablet type sizes unchanged (all density changes are `lg:`).

Visual 1:1 parity sub-score: 10/15 → **12/15**. Overall **87 / 100**. Decision unchanged: **BLOCKED PENDING MANUAL FIX** (Vercel R2 env).

## Update — 2026-09-15 (pass 4): content parity via the seeders

With geometry aligned, the remaining difference was the demo content itself. Changed only through the R2 + SQL seeders, as required:
- `scripts/render-brand-seed-media.py`: swapped six Unsplash (free-licence, non-premium) photos for subjects and colours matching the references — blue dropper serum, blue/grey runners, navy headphones, dark tote, unbranded granola bar, plain packaging-box mockup, dark studio frame for the launch video. A photo carrying a real third-party brand ("Blue Dinosaur") was rejected. Re-rendered and re-uploaded (69 objects) with `scripts/seed-brand-media-r2.mjs`.
- `supabase/seed_brand_assets_media.sql` §5: staggered product `updated_at` so "Recently Updated" opens on Serum, Runner Pro, Protein Bars, Headphones, Tote, Coffee — the reference's row, including its Active/Active/Review/Active/Draft/Review badges. Applied to the database.
- Code: Overview panels +16px below the KPI row (reference gap 26px); Assets folder rows 33px pitch.
- Diffs: Product Library 22.7 → **20.0**; Assets **24.6**, Overview **25.8** (pixel metric still dominated by photographs that cannot be identical). `tsc` 0 errors; 21/21 unit tests.
