# Caption Fox — Campaign Manager → Strategy Implementation Tracker

Reference images: `designs/Universal Sections/Strategy/*.png` (1491 × 1055, copied to
`docs/ui-verification/caption-fox/strategy/{page}-reference.png`).

## Phase 1 audit (2026-09-16)

| Area | Finding |
|---|---|
| Framework | Next.js 16.2.9 App Router, React 19, TypeScript, Tailwind v4, recharts 3, Supabase SSR |
| Routing | Type-first `/{creator,business,brand,agency}/{module}` under `src/app/[workspaceType]`; modules not yet migrated redirect to the `/app/*` compatibility surface via `[[...path]]` |
| Strategy before this work | Served from `/app/strategy/*` (compat surface). `/brand/strategy` redirected there |
| Shell | Design-locked `CaptionFoxAppShell` (264px sidebar, 72px top bar). Sidebar comes only from `src/lib/navigation/registers.ts`; Strategy already registered for Business / Brand / Agency, absent for Creator |
| Local nav | `StrategySubNav` existed (dropdown on mobile, scroll strip ≥ sm) |
| Entitlements | `src/lib/strategy/entitlements.ts` — plan / flag / role / type resolver; Forecasts required the `brand` plan, so it was hidden for every demo workspace (all on `team`) |
| Permissions | `src/lib/permissions.ts` `ROLE_PERMISSIONS` (owner, admin, manager, member, viewer) |
| Schema | `20260831000000_strategy_module.sql` — 30 workspace-scoped tables with RLS, applied. **Zero rows** in every table |
| RLS | Member-of-workspace `for all` policies; role checks existed only in server actions |
| Server actions | `src/app/app/strategy/actions.ts` (40 actions) — **none were called from any UI**. Every header CTA was a static link or dead button |
| Storage | No Strategy bucket existed; research uploads had nowhere to go |
| Export | No Strategy export endpoint |
| Activity / audit | `strategy_activity` table + `logActivity`; global `audit_logs` via `logAudit` |
| Tests | Vitest (`npm test`); no Strategy tests |
| Seed | No Strategy seed. Demo workspaces: `jamahl-thomas-{business,campaign-manager,agency}-demo` with teammates Emma Davis, Liam Chen, Sophia Patel, Noah Williams (all with avatars); Grace Kim is a Brand `viewer` |
| Chrome MCP | Available; dev server on port 3004 only |
| Visual state | Overview rendered empty panels, 26px H1, 13px tabs, no Forecasts tab — far from the reference density |
| Environment | C: drive had < 1 GB free (Turbopack cache 2.8 GB) — cache cleared to unblock work |

## Route rows

| ID | Route | Page | Reference Image | Default View | Alternate Views | Shell | Visual Match | Real Data | CRUD | Filters | Sorting | Search | Export | Permissions | Empty State | Error State | Responsive | Chrome MCP | Screenshot Compared | Tests | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| S1 | /{type}/strategy | Overview | overview-reference.png | Dashboard | Table | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Built — beta | Next actions optimistic complete; "View all actions" → Plans |
| S2 | /{type}/strategy/objectives | Objectives | objectives-reference.png | Cards | Table, Timeline, Kanban | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Built — beta | Full create→archive→delete E2E verified; import + bulk update |
| S3 | /{type}/strategy/audiences | Audiences | audiences-reference.png | Cards | Table, Map, Compare | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Built — beta | Natural Earth choropleth; CRM sync gated on real integration |
| S4 | /{type}/strategy/research | Research | research-reference.png | Library | Table, Board | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Built — beta | Private bucket uploads with magic-byte check; review workflow |
| S5 | /{type}/strategy/positioning | Positioning | positioning-reference.png | Framework | Matrix, Cards, Table | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Built — beta | 5-stage approval, editable matrix; "All markets" omitted (no data) |
| S6 | /{type}/strategy/plans | Plans | plans-reference.png | Gantt | Cards, Table, Calendar | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Built — beta | Gantt drag-reschedule not built (dialog reschedule instead) |
| S7 | /{type}/strategy/forecasts | Forecasts | forecasts-reference.png | Charts | Table, Scenarios | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Built — beta | Probabilities must total 100%; assumptions audited |

Evidence: `release-gated/docs/strategy.md` (score 90/100, admin-only beta). Manual actions: `release-gated/user-fixes/strategy.md`.

## Reference geometry (measured at native pixels, Overview)

| Element | Reference |
|---|---|
| Breadcrumb | 11px, centre y≈87 |
| H1 | ~19px semibold, subtitle ~11px slate-500 |
| Tabs | ~11.5px, 32px between labels, 2px active underline, row rule y=214 |
| KPI cards | 6 × 187 × 88, 18px gaps, 40px icon tile, 10.5px label / 18px value / 10px delta |
| Filter controls | 30px tall, 10.5px text |
| Panels | 14px padding, 12px semibold titles, 16px grid gaps; row 1 columns 417 / 354 / 407 |
