# Caption Fox — Web & Conversion Implementation Tracker

Scope: the shared Campaign Manager "Web & Conversion" module — Overview, Pages, Forms, Funnels, Experiments, Tracking — at `/app/web/*`. See the master spec pasted into this project's working session for the full 600+ requirement checklist; this tracker records what has actually been verified against it, phase by phase.

**Phasing decision (agreed with the user):** build Overview to full real-data production depth first, since it establishes the shared shell, entitlements, data layer and design tokens every other page reuses. Pages/Forms/Funnels/Experiments/Tracking are stubbed with an honest "coming next" state (still entitlement-gated, still reachable, never a dead link) until their own phases.

| ID | Route | Page/View | Reference design | Shell | Real data | Wired controls | Permissions/RLS | Empty/Error states | Responsive | Chrome MCP | Tests | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 5.10.01 | `/app/web` | Overview | `ChatGPT Image Aug 29, 2026, 02_21_30 PM (1).png` | ✅ | ✅ | ✅ | ✅ | ✅ | Not verified in browser this phase | **Blocked** (browser profile locked, see user-fixes) | tsc clean; no manual E2E yet | **In Progress — Phase 1 code-complete, visual QA pending** |
| 5.10.02 | `/app/web/pages` | Pages | `(2).png` | ✅ (shared) | Partial (list/KPIs feed from real `web_pages`; no builder yet) | Header/tabs only | ✅ (same gate) | ✅ ("coming next" state) | Not verified | Not run | — | **Stub — Phase 2 not started** |
| 5.10.03 | `/app/web/forms` | Forms | `(4).png` | ✅ (shared) | Partial (real `web_forms` powers Overview only) | Header/tabs only | ✅ | ✅ | Not verified | Not run | — | **Stub — Phase 2 not started** |
| 5.10.04 | `/app/web/funnels` | Funnels | `(6).png` | ✅ (shared) | Partial (real `web_funnels`/`web_funnel_steps` powers Overview only) | Header/tabs only | ✅ | ✅ | Not verified | Not run | — | **Stub — Phase 2 not started** |
| 5.10.05 | `/app/web/experiments` | Experiments | `(3).png` | ✅ (shared) | Partial (real `web_experiments` + two-proportion z-test powers Overview only) | Header/tabs only | ✅ (Team+ plan gate) | ✅ | Not verified | Not run | — | **Stub — Phase 2 not started** |
| 5.10.06 | `/app/web/tracking` | Tracking | `(5).png` | ✅ (shared) | Partial (real `web_tracking_events`/`web_tracking_destinations` powers Overview only) | Header/tabs only | ✅ (Team+ plan gate) | ✅ | Not verified | Not run | — | **Stub — Phase 2 not started** |

## What "code-complete" means for Overview right now

- Migration `supabase/migrations/20260905000000_web_conversion_module.sql` — 9 tables (`web_pages`, `web_forms`, `web_funnels`, `web_funnel_steps`, `web_experiments`, `web_tracking_destinations`, `web_tracking_events`, `web_metrics_daily`, `web_activity`), each workspace-scoped with RLS mirroring the proven `messaging_*` pattern. **Applied to the live project.**
- `src/lib/permissions.ts` — 12 new `WEB_*` permission keys + role grants for admin/manager/creator/approver/analyst, mirroring `MESSAGING_ROLE_GRANTS`.
- `src/lib/web/{constants,types,entitlements,query,data,server}.ts` — full data layer: real Supabase queries, a documented two-proportion z-test for experiment confidence/uplift (`computeExperimentStats`), a documented tracking-health formula, a documented "qualified lead" definition, and a documented "page needing attention" threshold. No hardcoded or randomised metrics.
- `src/components/web/*` — shared header, sub-nav, KPI strip, filters (reuses `@/components/campaigns/CampaignFilters` and `@/components/campaigns/charts` directly, per the repo's existing Messaging-module precedent), activity feed, mixed-entity table + card view, action buttons, access/empty/error states.
- `src/app/app/web/{layout,page}.tsx` — Overview route: KPI strip, 4 insight panels (top pages / form performance / funnel steps / experiment result) + Next actions, tracking health / traffic source / device / trend row, and a searchable, filterable, paginated mixed "Web experiences" table (Cards and Table views both functional).
- `src/app/app/web/export/route.ts` — permission-gated, filter-respecting CSV export per entity, audit-logged to `web_activity`.
- `src/app/app/web/{pages,forms,funnels,experiments,tracking}/page.tsx` — real route, real entitlement gate, no dead nav links; "coming next" body until their own phase.
- Demo data seeded into the `small_business` demo workspace (`Jamahl Thomas Growth Co.`, `173b63f8-3263-4609-a4f7-c6e113f25bda`) via `scripts/tmp/seed-web-demo.sql` — 6 pages, 6 forms, 5 funnels (main funnel has 5 steps), 4 experiments, 6 tracking events, 8 destinations, 30 days × 6 dimensions of daily metrics, 5 activity rows.
- `npx tsc --noEmit` — 0 errors anywhere in the repo (0 pre-existing, 0 new).

## Known gaps / next phases

1. **Chrome MCP visual verification could not run this session** — the shared `chrome-devtools-mcp` browser profile was already locked by another running instance. Server-side smoke tests confirm all six routes compile and correctly redirect unauthenticated requests to `/login?next=...`; the dev server log shows no errors from any `web/*` route. See `release-gated/user-fixes/web/overview.md` for the exact unblock step.
2. **Pages/Forms/Funnels/Experiments/Tracking detail surfaces** — builder, form logic, funnel canvas, experiment variant assignment engine, tracking destination delivery diagnostics. Each is its own phase per the phasing decision above.
3. **RLS positive/negative tests** — policies mirror the proven `messaging_*` pattern exactly but have not been independently re-verified with a second test workspace/user this session.
4. Only the demo `small_business` workspace has seed data; a fresh workspace correctly renders every empty state (verified by code inspection — every panel branches on `rows.length === 0`) but has not been clicked through live.
