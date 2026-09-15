# Caption Fox — Advertising Implementation Tracker

Reference designs: `designs/Universal Sections/Advertising/` (1491 × 1055). Image (1) Overview, (2) Accounts, (3) Campaigns, (4) Creatives, (5) Audiences, (6) Reports.

Standing rules (CLAUDE.md): match designs 1:1; **the product sidebar is not altered** — the design images' sidebars are context only. Advertising is already in `src/lib/nav-config.ts`.

## Phase 1 audit (2026-09-15)

| Area | Finding |
|---|---|
| Framework | Next.js 16 App Router, server components, Supabase (RLS), Tailwind, vitest |
| Route | `src/app/[workspaceType]/advertising/[[...rest]]/page.tsx` → `AdvertisingRoute` switches on module segment |
| Shell | `advertising/layout.tsx` → `CampaignManagerShell` (shared product shell, real sidebar) |
| Workspace surfaces | Route segments `creator`, `business`, `brand`, `agency`. Advertising entitled on `brand` + `agency` only (`entitlements.ts` `ADVERTISING_SURFACES`) |
| Plans | `team`, `agency`, `enterprise`; scheduled reports + shared presets need `agency`/`enterprise` |
| Entitlement resolver | `lib/advertising/entitlements.ts` — surface → plan → flag → role → provider capability. Central, reused by every page |
| Permissions | `lib/permissions.ts` `ADVERTISING_*` permissions, role defaults |
| Providers | `lib/advertising/providers.ts` capability map; clients for Google, Microsoft, Amazon; BYO OAuth apps (`ad_provider_apps`) |
| Credentials | `ad_connection_secrets` / `ad_provider_apps` service-role only, encrypted (`lib/advertising/crypto.ts`) |
| OAuth | `app/api/advertising/oauth/[provider]/callback/route.ts`, state table `ad_oauth_states` |
| Sync | `lib/advertising/sync.ts`, `ad_sync_runs` with idempotency key |
| Schema | `supabase/migrations/20260829000000_advertising.sql` — connections, accounts, campaigns, ad sets, creatives, audiences, overlaps, `ad_metrics_daily`, issues, activity, presets, scheduled reports, exports. All RLS workspace-scoped |
| Metrics | `lib/advertising/metrics.ts` normalise(): CTR, CPC, CPM, CPA, ROAS, conv. rate, frequency, hook rate; zero-denominator safe; mixed currency/window integrity flags |
| Data state | **All ad tables empty** in dev DB → every page rendered only the "connect first account" empty state |
| Seed | Added `scripts/seed-advertising-demo.mjs` (dev-only, `is_demo`, deterministic PRNG, idempotent) |

## Route tracker

| ID | Route | Page/View | Reference | Shell | Visual Match | Real Data | Provider Integration | Search | Filters | Views | CRUD/Actions | Permissions | Loading | Empty | Error | Responsive | Chrome MCP | Screenshot Compared | Tests | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 5.08.01 | /{type}/advertising | Overview | (1) | ✅ | ❌ layout diverges | ✅ queries | ✅ | n/a | ⚠️ | n/a | ⚠️ export dead | ✅ | ⚠️ | ✅ | ⚠️ | ⚠️ | before captured | ❌ | ⚠️ | Audited | Needs design rebuild |
| 5.08.02 | /{type}/advertising/accounts | Accounts | (2) | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | tabs ✅ | ⚠️ | ✅ | ⚠️ | ✅ | ⚠️ | ⚠️ | ❌ | ❌ | ⚠️ | Audited | Provider cards/table/right rail to rebuild |
| 5.08.03 | /{type}/advertising/campaigns | Campaigns | (3) | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | table/cards/board ✅ | ⚠️ create/bulk/export not wired | ✅ | ⚠️ | ✅ | ⚠️ | ⚠️ | ❌ | ❌ | ⚠️ | Audited | |
| 5.08.04 | /{type}/advertising/creatives | Creatives | (4) | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | grid/table/review ✅ | ⚠️ upload not wired | ✅ | ⚠️ | ✅ | ⚠️ | ⚠️ | ❌ | ❌ | ⚠️ | Audited | |
| 5.08.05 | /{type}/advertising/audiences | Audiences | (5) | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | cards/table/overlap ✅ | ⚠️ create not wired | ✅ | ⚠️ | ✅ | ⚠️ | ⚠️ | ❌ | ❌ | ⚠️ | Audited | |
| 5.08.06 | /{type}/advertising/reports | Reports | (6) | ✅ | ❌ | ✅ | ✅ | n/a | ✅ | dashboard/table/breakdown ✅ | ⚠️ create/schedule/export not wired | ✅ | ⚠️ | ✅ | ⚠️ | ⚠️ | ❌ | ❌ | ⚠️ | Audited | |

## Progress update (2026-09-15, later)

All six pages rebuilt to their reference layouts and verified in Chrome at 1491 × 1055 (screenshots in `docs/ui-verification/caption-fox/advertising/*-implementation.png`). Type-check, ESLint (advertising files) and the 125-test vitest suite pass.

| Page | Visual match | Working controls added | Notes |
|---|---|---|---|
| Overview | ✅ structure 1:1 | date/compare/Filters, Campaigns↔Ad Sets, panel filters, trend grain/metric, CSV export | creative tiles use real signed thumbnails |
| Accounts | ✅ | Connect Source (auto-opens from Overview), Refresh Sync, row sync/edit/menu, tabs w/ counts, chip filters, page size, Resolve issue | |
| Campaigns | ✅ | Create Campaign (draft only), Bulk Edit + bulk pause/resume/export, Columns (persisted), table/cards/board, performance tiers | sort-by-spend paging bug fixed |
| Creatives | ✅ | Upload Creative / Create Ad (R2 or Supabase), grid/table/review, review queue actions, rail tabs | |
| Audiences | ✅ | Sync Segments, Create Audience (draft), cards/table/overlap, size/usage filters | |
| Reports | ✅ | staged filters + Apply, presets (save/apply/default/delete), Schedule Report, Create Report, dashboard/table/breakdown | fixed a client-module import crash |
| Detail pages | new | account / campaign / creative / audience with back link + breadcrumbs | |

Shared: page gutter added to `CampaignManagerShell` (fixes Advertising + Calendar on every workspace type); section tabs via `ResponsiveTabs`; `Breadcrumbs`/`PageTrail`, `BackLink`, `TrendChart`, `Donut`, `ExportSplit`, `MiniControls`.
Migrations: `20260915120000_ad_creatives_storage.sql` (private bucket + workspace-folder RLS) — applied.
Not yet done: tablet/mobile/PWA Chrome passes, E2E tests, pixel-diff overlays, real provider write-back (needs live connections). Manual steps: `release-gated/user-fixes/advertising.md`.

## Open questions for the owner

- CLAUDE.md now says "across all workspace types"; the entitlement resolver currently limits Advertising to **brand + agency** surfaces. Confirm whether creator/business should also get it.
