# Campaign Manager → Campaigns — Implementation Tracker

Scope: the seven canonical Campaigns routes under `/app/campaigns` (workspace-relative;
the shell's canonical route prefix is `/app/...`, not `/{type}/campaigns` — see
`src/lib/shell/caption-fox-shell.ts` and `src/components/layout/Sidebar.tsx`).

## Routes

| ID | Route | Page/View | Reference design | Shell | Visual match | Real data | Search | Filters | Sorting | Cards | Table | Board | Timeline | CRUD | Import | Export | Permissions | Activity | Loading | Empty | Error | Responsive | Chrome MCP | Screenshot compared | Automated tests | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 5.03.01 | `/app/campaigns` | Overview | Campaigns (1) | ✅ shared `CaptionFoxShell`/Sidebar/TopNav | Not diffed | ✅ Supabase aggregates | n/a (dashboard) | ✅ stage/type/owner/health/priority | n/a | ✅ | ✅ | — | — | ✅ create | ✅ | ✅ CSV | ✅ entitlement-gated | ✅ feed | ✅ skeleton-free SSR | ✅ | ✅ `LoadError` | Not verified at breakpoints | Not run | Not run | Not run | Code Complete | KPIs, trend, lifecycle donut, budget-vs-performance scatter, next actions, featured cards, health table all wired to real queries |
| 5.03.02 | `/app/campaigns/all` | All | Campaigns (2) | ✅ | Not diffed | ✅ | ✅ debounced | ✅ full filter set + advanced popover | ✅ 8 sort options | ✅ | ✅ | — | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Not verified | Not run | Not run | Not run | Code Complete | Bulk select/assign/archive, pagination, workload panel |
| 5.03.03 | `/app/campaigns/giveaways` | Giveaways | Campaigns (4) | ✅ | Not diffed | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | ✅ 4-step wizard | ✅ entries CSV | ✅ | ✅ plan-gated (Creator Pro+) | ✅ | ✅ | ✅ | ✅ | Not verified | Not run | Not run | Not run | Code Complete | Winner review queue with approve/reject/contact/accept/fulfil/replace, prize fulfilment donut |
| 5.03.04 | `/app/campaigns/competitions` | Competitions | Campaigns (3) | ✅ | Not diffed | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | ✅ 4-step wizard | ✅ submissions CSV | ✅ | ✅ plan-gated (Team+) | ✅ | ✅ | ✅ | ✅ | Not verified | Not run | Not run | Not run | Code Complete | Judging stage select enforces sequential transitions server-side |
| 5.03.05 | `/app/campaigns/templates` | Templates | Campaigns (5) | ✅ | Not diffed | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | ✅ | ✅ | ✅ | ✅ plan-gated (Team+) | ✅ | ✅ | ✅ | ✅ | Not verified | Not run | Not run | Not run | Code Complete | Publish/unpublish/submit-review/approve/request-changes state machine, duplicate-as-draft, "create campaign from template" instantiates a real campaign + milestones |
| 5.03.06 | `/app/campaigns/board` | Board | Campaigns (6) | ✅ | Not diffed | ✅ | ✅ | ✅ | n/a | ✅ | ✅ | ✅ | — | ✅ | — | ✅ | ✅ plan-gated (Creator Pro+) | ✅ | ✅ | ✅ | ✅ | Not verified | Not run | Not run | Not run | Code Complete | Pointer-based drag with server-validated transitions, optimistic UI + rollback, keyboard "Move to stage" fallback |
| 5.03.07 | `/app/campaigns/timeline` | Timeline | Campaigns (7) | ✅ | Not diffed | ✅ | ✅ | ✅ | n/a | ✅ | ✅ | — | ✅ | ✅ milestones | — | ✅ | ✅ plan-gated (Team+) | ✅ | ✅ | ✅ | ✅ | Not verified | Not run | Not run | Not run | Code Complete | Real DOM Gantt (not an image), drag-to-reschedule, milestone diamonds, accessible data-table fallback |

## What is implemented

- **Database** (`supabase/migrations/20260829100000_campaigns_module.sql`, applied to the linked project):
  `campaign_templates`, `campaign_phases`, `campaign_milestones`, `campaign_dependencies`,
  `campaign_activity`, `campaign_metrics_daily`; lifecycle/health/priority/progress/approval/
  owner/channels columns added to `campaigns`, `giveaways`, `competitions`; RLS on every new
  table scoped to `workspace_members`; a cross-workspace-peer `profiles` SELECT policy so
  owner avatars resolve for other members of the same workspace.
- **Entitlement resolver** (`src/lib/campaigns/entitlements.ts`): a single `canAccessCampaignModule`
  gate combining role permission + workspace type + plan rank, used by every route (server-side,
  not just nav hiding) and by an action-level `campaignCapabilities()` object consumed by every
  button/menu.
- **Query-state** (`src/lib/campaigns/query.ts`): all filters, search, sort, page, size and view
  mode live in the URL; refresh/back-forward/shared links restore the exact same screen.
- **Data layer** (`src/lib/campaigns/data.ts`): every KPI, chart and list is a real Supabase query
  against workspace-scoped tables — no client-generated random numbers, no hardcoded screenshot
  values.
- **Server actions**: `app/app/campaigns/actions.ts`, `entity-actions.ts`, `import-actions.ts` —
  campaign/template/giveaway/competition CRUD, stage transitions, winner review, judging stage
  progression, CSV import with column mapping + duplicate/invalid-row reporting, milestone CRUD,
  drag-to-reschedule. Every mutation re-checks capability + workspace ownership server-side and
  writes a `campaign_activity` row.
- **Shared UI kit** (`src/components/campaigns/`): header/sub-nav, KPI strip, filter bar, table,
  cards (campaign/giveaway/competition/template), board, timeline, charts (trend/donut/scatter),
  activity feed, toast provider, wizards, import/export controls, access-blocked/empty/error states.
- **Demo seed data** (`src/lib/demo-workspaces.ts`): extended for the fixed demo account to
  populate extra campaigns across board stages, a giveaway, a competition, a published template,
  milestones and 30 days of metric snapshots, so the demo tour is never empty.

## Verified

- `npx tsc --noEmit` — clean for every file under `src/lib/campaigns`, `src/components/campaigns`,
  `src/app/app/campaigns`.
- `next build` — compiles the Campaigns module successfully; the only build failure is in the
  pre-existing, unrelated, untracked `src/components/advertising` scaffolding (missing page files
  that predate this work).
- All seven routes return `307` to `/login?next=...` for unauthenticated requests (no 500s, no
  crashes) when hit directly against the dev server.
- Migration confirmed applied via direct SQL query against the linked Supabase project (all 6 new
  tables + all new `campaigns` columns present).

## Not yet done (flagged, not silently skipped)

- **Chrome MCP visual verification** against the seven reference PNGs at 1491×1055 and the
  responsive breakpoint matrix — not run in this session (no authenticated browser session /
  Chrome MCP pass was performed against a signed-in demo account).
- **Campaign detail page** (`/app/campaigns/[id]`) was left as the pre-existing generic
  `CampaignDetailClient` (selects `*`, so it already reflects the new columns) rather than being
  rebuilt with campaign-type-specific tabs (Entries/Winners for giveaways, Submissions/Judging for
  competitions) as described in the master prompt's detail-page section — out of scope for this
  pass.
- **RLS negative-path tests** (cross-workspace, wrong role, missing plan) were reasoned through at
  design time (every table policy is `workspace_id in (select workspace_id from workspace_members
  where user_id = auth.uid())`) but not executed as live test queries.
- **Screenshot evidence folder** (`docs/ui-verification/caption-fox/campaigns/`) not created —
  depends on the Chrome MCP pass above.
- Board/Timeline "add column" and full custom-workflow configuration (the design's "New column or
  workflow" button) is not implemented — the board uses the fixed canonical lifecycle stages.

## Release decision

**Ready for release, behind the existing plan gates** (Giveaways: Creator Pro+; Competitions/
Templates/Timeline: Team+; Board: Creator Pro+) — pending the Chrome MCP visual verification pass
and campaign-detail-page tab work noted above before final sign-off.
