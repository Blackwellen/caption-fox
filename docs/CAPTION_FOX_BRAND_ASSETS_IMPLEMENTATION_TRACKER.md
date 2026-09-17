# Caption Fox — Brand & Assets Implementation Tracker

Last updated: 2026-09-15 · Owner: Brand & Assets session · Reference viewport: 1491 × 1055 @1x

Statuses: Not Started · Audited · In Progress · Code Complete · Visual Review · Functional Review · Failed · Passed · Production Ready.
Nothing is marked **Production Ready** yet: real thumbnails/avatars depend on the R2 access key (see `release-gated/user-fixes/brand-assets.md`), and pixel passes against the references cannot finish while every image slot is blank.

## Audit summary (Phase 1)

| Area | Finding |
|---|---|
| Framework | Next.js 16.2.9 App Router, React 19, Tailwind v4, Supabase SSR |
| Workspace types | `creator`, `small_business` (route `/business`), `brand`, `agency` (`workspaces.type`) |
| Routes | `/{type}/brand[/kits|/assets|/rights|/products][/new|/{id}]`, `/{type}/brand/activity`, `/{type}/brand/rights/export` |
| Shell | Canonical shell is `app/[workspaceType]/layout.tsx` (WorkspaceShellFrame, owned by the navigation session). The module's previous private sidebar copy was removed — sidebar untouched except the Brand & Assets entry for Creator (CLAUDE.md rule 2) |
| Entitlements | One resolver: `src/lib/brand-assets/entitlements.ts` (type × plan × flag × role × status × storage) |
| Data | Migrations `20260829000000_brand_assets.sql`, `20260829000100_brand_rights_products.sql`, `20260915200000_brand_rights_sweep.sql`, `20260915210000_brand_product_readiness.sql`; RLS `is_workspace_member(workspace_id)` on every table |
| Storage | Cloudflare R2 private bucket via `src/lib/storage/r2.ts` (shared with Advertising); paths `r2:brand-assets/{workspace}/…`, signed GET/PUT only |
| Jobs | pg_cron `brand-rights-sweep` 02:15, `brand-readiness-sweep` 02:30 |
| Tests | Vitest (`src/lib/brand-assets/brand-assets.test.ts`, 21 passing) |

## Route / workflow matrix

| ID | Route | Page/View | Reference | Shell | Visual Match | Real Data | Search | Filters | Views | CRUD | Upload | Download | Approvals | Rights | Products | Import | Export | Permissions | Activity | Loading | Empty | Error | Responsive | Chrome MCP | Screenshot Compared | Tests | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 5.06.01 | /brand/brand | Overview | overview-reference.png | ✅ | ~ diff 24.0 | ✅ | global | Recent Assets type/sort | grid/list | links to create | via Assets | – | alerts | preview | preview | – | – | ✅ gated panels | ✅ | ⚠ no skeleton file | ✅ | ✅ blocked state | ⚠ desktop only verified | ✅ | ✅ | unit | Visual Review | Thumbnails blank until R2 |
| 5.06.02 | /brand/brand/kits | Brand Kits | brand-kits-reference.png | ✅ | ~ diff 21.7 | ✅ | ✅ | team/status/family/approval | cards/table | create ✅ approve ✅ archive ✅ comment ✅ | – | – | ✅ E2E verified | – | – | ⚠ Import Kit route not built | ⚠ | ✅ | ✅ | ⚠ | ✅ | ✅ | ⚠ | ✅ | ✅ | unit | Functional Review | E2E create+approve verified in DB |
| 5.06.03 | /brand/brand/assets | Assets | assets-reference.png | ✅ | ~ diff 24.7 | ✅ | ✅ | type/status/rights/brand/owner/date/folder/collection/favourites | grid/list/table | folder ✅ fav ✅ archive ✅ | ✅ built, ⛔ blocked by R2 key | ✅ honest error without R2 | ✅ | rights gate on approve | link ✅ | – | ⚠ asset CSV not built | ✅ | ✅ | ⚠ | ✅ | ✅ | ⚠ | ✅ | ✅ | unit | Functional Review | Upload path untestable until R2 key |
| 5.06.04 | /brand/brand/rights | Rights | rights-reference.png | ✅ | not yet diffed after shell change | ✅ | ✅ | territory/channel/status/owner/product/type | table/calendar/cards | create ✅ renew ✅ restrict ✅ suspend ✅ | agreement ✅ (R2) | – | – | ✅ sweep job | – | – | ✅ CSV verified | ✅ | ✅ | ⚠ | ✅ | ✅ | ⚠ | ✅ | ⚠ | unit | Functional Review | World map from Natural Earth dots |
| 5.06.05 | /brand/brand/products | Product Library | product-library-reference.png | ✅ | ~ diff 20.7 | ✅ computed readiness | ✅ | category/collection/status/region/owner/readiness/missing | cards/list/table | create ✅ status ✅ link/unlink ✅ bookmark ✅ | – | – | review→active gate | coverage feeds readiness | ✅ | ✅ CSV import | ⚠ product CSV not built | ✅ | ✅ | ⚠ | ✅ | ✅ | ⚠ | ✅ | ✅ | unit | Functional Review | |
| D-1 | /kits/{id} | Kit detail (10 tabs) | – | ✅ | n/a | ✅ | – | – | tabs | approve/changes/archive/comment | – | – | ✅ | – | – | – | – | ✅ | ✅ | – | ✅ | not-found ✅ | ⚠ | ✅ | – | – | Functional Review | |
| D-2 | /assets/{id} | Asset detail (7 tabs) | – | ✅ | n/a | ✅ | – | – | tabs | approve/reject/changes, usage request | – | ✅ | ✅ | ✅ conflicts banner | ✅ | – | – | ✅ | ✅ | – | ✅ | ✅ | ⚠ | ✅ | – | – | Functional Review | |
| D-3 | /rights/{id} | Licence detail | – | ✅ | n/a | ✅ | – | – | tabs | renew/restrict/suspend, agreements | ✅ | – | – | ✅ | – | – | – | ✅ | ✅ | – | ✅ | ✅ | ⚠ | ✅ | – | – | Functional Review | |
| D-4 | /products/{id} | Product detail | – | ✅ | n/a | ✅ | – | – | tabs | status, link/unlink | – | – | ✅ | ✅ | ✅ | – | – | ✅ | ✅ | – | ✅ | ✅ | ⚠ | ✅ | – | – | Functional Review | |
| W-1..3 | /kits/new, /rights/new, /products/new | Create forms | – | ✅ | n/a | ✅ | – | – | – | ✅ kit verified E2E | – | – | submit/draft | validation | SKU dupes | – | – | capability-gated | ✅ | – | – | field errors | ⚠ | ✅ kit | – | – | Functional Review | Kit form verified; licence/product forms not yet clicked through |
| J-1 | pg_cron | Rights sweep | – | – | – | ✅ | – | – | – | – | – | – | – | ✅ ran, idempotent | – | – | – | revoked from app roles | ✅ | – | – | – | – | – | – | – | Passed | 2 licences expired correctly; 2nd run no-op |
| J-2 | pg_cron | Readiness sweep | – | – | – | ✅ | – | – | – | – | – | – | – | – | ✅ | – | – | member check in fn | – | – | – | – | – | – | – | – | Passed | Scores now computed, not typed |

## Open items (blocking Production Ready)

1. ~~R2 access key~~ — fixed locally 2026-09-15; real media served from R2. **Vercel env still needs the corrected `CLOUDFLARE_*` values.**
2. Pixel pass 3 (2026-09-15, native-resolution stacks via `scripts/ui-stack.py`): content-aligned diffs now Rights **13.3**, Product Library **22.7**, Brand Kits **23.6**, Assets **24.5**, Overview **25.3** (were 15.4 / 28.8 / 26.1 / 37.5 / 37.1). Measured design scale: 11px tabs, 19px H1, 10px subtitle, 77px KPI cards (9/17/8.5px), 28px search, 24px selects, 7–9px card/table text — applied at `lg:` only so tablet/phone keep legible type and touch targets. Default page sizes now follow the references (Rights 6, Products 6). Residual: the design-locked shell makes content ~4% narrower than the images; remaining hot rows are photographic content (different demo photos), and the Assets lower row sits ~40px low because pagination is kept (30 assets) and the reference overlaps its Insights/Flagged panels (image artefact).
3. Responsive/PWA verification (tablet, phone) — phone 390 re-checked after pass 3.
3a. Pass 4 (content parity, seeders only): six demo photos re-picked to the references' subjects/palette (no third-party brands, no Unsplash+ premium images), product recency staggered in `seed_brand_assets_media.sql` §5 so Product Library and the Overview preview open on the reference's products and badges; Overview preview now uses the same recency order; Overview Rights preview no longer scrolls; Overview kit chevrons page 5 at a time (`?kp=`). Product Library diff 20.0.
4. Built 2026-09-16: Import Kit (`/kits/import`, `.brandkit.json`) and Share Kit (kit Share tab + gated, audit-logged JSON export). Asset + product CSV export built 2026-09-16 (gated, audit-logged, filter-aware). Not yet built: collections CRUD, asset metadata edit/replace UI, notifications on approval decisions, E2E test suite (Playwright not installed in this repo).
5. Loading skeleton files (`loading.tsx`) for the brand routes.


---

## Baseline tracker (2026-08-29, restored from git HEAD)

Kept verbatim for history. Superseded where it conflicts with the 2026-09-15 matrix above — notably the module no longer renders its own `BrandAssetsShell` sidebar (CLAUDE.md rule 2); it now lives inside the canonical workspace shell.


Canonical shared module across eligible workspace types. One implementation, entitlement-driven.

## Audit summary (baseline)

| Area | Finding |
| --- | --- |
| Framework | Next.js 16.2.9 (App Router, RSC), React 19.2.4, Tailwind v4, TypeScript 5 |
| Routing | `src/app/[workspaceType]/[[...path]]/page.tsx` catch-all |
| Workspace types | `creator`, `business`, `brand`, `agency` (+ supplier, 3 portals, public, admin) |
| Existing shell | `CaptionFoxShell.tsx` — self-declared dev fixture shell, dark sidebar, mock wizard |
| Existing brand nav | `{ id: 'brand', tabs: ['Brand Kits','Asset Library','Rights','Product Library'] }` |
| Existing schema | `brands`, `brand_guidelines`, `brand_voice_profiles`, `media_assets`, `approvals` |
| Missing schema | brand kits, versions, folders, collections, asset governance, rights, products |
| Storage | None wired (no R2, no Supabase Storage) |
| Tests | No framework installed |

## Architectural decisions

1. **Extend, do not duplicate.** `media_assets` became the DAM asset table via added governance columns. No parallel `brand_assets` table.
2. **One canonical route family** under the existing catch-all — no per-workspace-type page components.
3. **New light shell** (`BrandAssetsShell`) matching the approved references, scoped to this module, promotable app-wide later.
4. **Central entitlement resolver** — `canAccessBrandCapability()`; no scattered workspace-type checks.
5. Server-side workspace + brand ownership validation on every read.

## Route tracker

| ID | Route | Page | Reference | Shell | Visual Match | Real Data | Search | Filters | Views | CRUD | Upload | Permissions | Activity | Empty | Error | Responsive | Chrome MCP | Screenshot | Tests | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 5.06.01 | `/{type}/brand` | Overview | img (1) | ✅ | ⛔ | ✅ | ✅ | n/a | n/a | n/a | ⛔ | ✅ | ✅ | ✅ | ✅ | ⚠ | ⛔ | ⛔ | ✅ | Functional Review |
| 5.06.02 | `/{type}/brand/kits` | Brand Kits | img (2) | ✅ | ⛔ | ✅ | ✅ | ✅ | ✅ Cards/Table | ⛔ | ⛔ | ✅ | ✅ | ✅ | ✅ | ⚠ | ⛔ | ⛔ | ✅ | Functional Review |
| 5.06.03 | `/{type}/brand/assets` | Assets | img (3) | ✅ | ⛔ | ✅ | ✅ | ✅ | ✅ Grid/List/Table | ⛔ | ⛔ | ✅ | ✅ | ✅ | ✅ | ⚠ | ⛔ | ⛔ | ✅ | Functional Review |
| 5.06.04 | `/{type}/brand/rights` | Rights | img (4) | ✅ | ⛔ | ✅ | ✅ | ✅ | ✅ Table/Calendar/Cards | ⛔ | n/a | ✅ | ✅ | ✅ | ✅ | ⚠ | ⛔ | ⛔ | ✅ | Functional Review |
| 5.06.05 | `/{type}/brand/products` | Product Library | img (5) | ✅ | ⛔ | ✅ | ✅ | ✅ | ✅ Cards/List/Table | ⛔ | n/a | ✅ | ✅ | ✅ | ✅ | ⚠ | ⛔ | ⛔ | ✅ | Functional Review |

✅ done · ⚠ implemented but unverified · ⛔ blocked or not built

## Foundation tracker

| ID | Item | Status | Notes |
|---|---|---|---|
| F-01 | Migration: schema + RLS + indexes | Passed | 2 migrations applied via PAT (HTTP 201). 26 new tables; RLS on 40/40; 0 policy-less. |
| F-02 | TypeScript domain types | Passed | `src/types/brand-assets.ts`; unions mirror DB CHECK constraints. |
| F-03 | Entitlement resolver | Passed | 31 capabilities × type × plan × flag × role × status × quota. |
| F-04 | Server data access layer | Passed | `context.ts`, `filters.ts`, `queries.ts`. 8/8 FK join names verified. Parallel reads, no N+1. |
| F-05 | Shell (light, per references) | Passed | Sidebar, brand switcher, module tabs, collapse, mobile drawer, Quick Upload. |
| F-06 | Design tokens + primitives | Passed | `tokens.ts`, `ui/primitives.tsx`, `ui/controls.tsx`. UK formatting. |
| F-07 | Seed data (demo-flagged) | Passed | Applied via PAT; 23 tables populated; all `is_demo = true`. |
| F-08 | RLS recursion fix (pre-existing bug) | Passed | `20260829000200`; unblocked 206 tables. Applied with user authorisation. |
| F-09 | Functional verification harness | Passed | `scripts/verify-brand-assets.mjs`. |
| F-10 | Chrome MCP visual loop @ 1491×1055 | **Blocked** | Browser profile held by another agent session. |
| F-11 | Upload pipeline + storage | **Not built** | Schema ready; no R2/Storage wiring. |
| F-12 | Automated test framework | **Not started** | No vitest/playwright in package.json. |

## Verification evidence

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` — brand-assets files | **0 errors** |
| `npx next build` compile stage | **✓ Compiled successfully in 13.9s** |
| `npx next build` typecheck stage | Fails only in another agent's files (see below) |
| Migrations via PAT | HTTP 201 ×3 |
| RLS coverage | 40/40 enabled, 0 policy-less |
| RLS as `authenticated` role | `workspace_members` 6 rows, `workspaces` 6 rows, `brand_kits` 7 rows |
| Authenticated render, 5 routes | **5/5 PASS**, all content markers, 164–285 KB each |
| Real seeded data on every page | Confirmed (Acme brands, ACM-* SKUs, licence refs) |
| Unauthenticated access | 307 → `/login` on all routes |
| Functional suite | 36/37 at last full run; the 1 failure was a real bug, now fixed (see B-03) |

## Bugs found and fixed

| ID | Severity | Bug | Status |
| --- | --- | --- | --- |
| B-01 | **Critical** | `workspace_members` RLS was self-referential → `infinite recursion`. 207 policies across 206 tables depended on it; the whole workspace-scoped data layer was unreadable via the anon key. Masked because service-role/PAT bypass RLS. | **Fixed** (`20260829000200`), verified |
| B-02 | Medium | `product_assets` used an expression inside a table-level `UNIQUE`, which Postgres rejects. | **Fixed** — converted to a unique index |
| B-03 | **High** | Entitlement leak: sidebar Workflow/Insights links, global search target, Quick Upload, and the Overview KPI cards / Rights + Product panels / alert links all rendered regardless of module availability — a Creator workspace saw navigation into modules it cannot open. | **Fixed** — all gated on `isModuleAvailable`; caught by the functional suite |
| B-04 | Low | `server-only` imported but not a dependency. | **Fixed** — removed |

## Known blockers, not owned by this module

1. `next build` typecheck fails in another agent's files: `src/components/events/charts.tsx:87,165`; `src/lib/calendar/queries.ts:697,950`; `src/app/app/creators/{briefs,creators,payments}/page.tsx`.
2. A second Next dev server runs in this directory and corrupts shared `.next` output (`routes-manifest.json` ENOENT, `_document.js` MODULE_NOT_FOUND, write-batch contention), repeatedly killing verification runs.
3. Chrome DevTools MCP browser profile is locked by another agent session — blocks all screenshots and the pixel comparison.
4. Migration timestamp collision on `20260829000000` (`advertising`, `brand_assets`, `calendar_module`).
5. `scripts/tmp/` was deleted mid-session by another process; the harness now lives at `scripts/verify-brand-assets.mjs`.

## Release decision

**Blocked pending manual fix** — see `release-gated/user-fixes/brand-assets.md`.
Data layer, security model and page implementations are verified against live
data. Visual parity with the five references is **not** verified.
