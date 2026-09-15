# Caption Fox — Brand & Assets Implementation Tracker

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
