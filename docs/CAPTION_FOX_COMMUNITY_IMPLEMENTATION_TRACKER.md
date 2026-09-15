# Community Module — Implementation Tracker

Status: **built and live** (schema applied, demo data seeded, six pages wired to real Supabase queries). This tracker is the concise record referenced by CLAUDE.md rather than the full 900-item audit checklist — see "Explicitly deferred" at the bottom for what that checklist covers that this pass does not.

## Route map

| Page | Route | File |
|---|---|---|
| Overview | `/app/community` | `src/app/app/community/page.tsx` |
| Communities | `/app/community/communities` | `src/app/app/community/communities/page.tsx` |
| Calendar | `/app/community/calendar` | `src/app/app/community/calendar/page.tsx` |
| Moderation | `/app/community/moderation` | `src/app/app/community/moderation/page.tsx` |
| Members | `/app/community/members` | `src/app/app/community/members/page.tsx` |
| Advocacy | `/app/community/advocacy` | `src/app/app/community/advocacy/page.tsx` |

Sidebar entry already existed (`src/components/layout/Sidebar.tsx`, "Community" → `/app/community`); no nav change was needed.

## Architecture

Mirrors the existing Creators & UGC module pattern exactly (`src/lib/creators/*`, `src/components/creators/*`), so the codebase now has two structurally identical, independently-maintainable modules:

- `src/lib/community/{constants,types,entitlements,server,query,data}.ts` — vocabulary, row types, plan/role/permission resolver (`requireCommunityModule`), URL query-state parsing per page, and every Supabase read (aggregates, paginated lists, activity).
- `src/components/community/{primitives,KpiStrip,FilterBar,Pagination,ActivityFeed,charts,CommunityHeader,CommunitySubNav,states,ModerationDecisionActions,MembershipRequestActions,RewardApprovalActions}.tsx` — shared UI, including inline SVG-free recharts wrappers (`TrendChart`, `DonutChart`, `BarList`) copied from `src/components/creators/charts.tsx`.
- `src/app/app/community/actions.ts` — server actions: `decideModerationReport` (approve / remove content / warn / suspend / ban / escalate, each gated by its own permission and writing an audit decision row), `reviewMembershipRequest` (approve creates a real `community_members` row and increments the community's member count; reject just closes the request), `reviewReward` (approve/reject a pending advocacy reward). Every action re-authorises server-side via `getCommunitySession()` — a hidden button cannot be bypassed by calling the action directly, since the capability check happens inside the action, not just in the UI.

## Database (`supabase/migrations/20260901100000_community_module.sql`)

12 workspace-scoped tables, every one with RLS enabled and a `for all using (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid())) with check (...)` policy — the same pattern used by every other Campaign Manager module:

`communities`, `community_members`, `community_membership_requests`, `community_events`, `community_event_registrations`, `community_moderation_reports`, `community_moderation_decisions`, `community_policies`, `community_advocacy_programs`, `community_advocacy_enrollments`, `community_rewards`, `community_activity`.

Foreign keys rely on Postgres' default `<table>_<column>_fkey` naming so the embedded-resource selects in `data.ts` (e.g. `profiles!communities_owner_id_fkey`) resolve without explicit constraint naming. Indexes cover `workspace_id` plus every column actually filtered or sorted on (status, community_id, created_at, engagement/advocacy score, points). `updated_at` triggers exist on the four tables with an `updated_at` column.

**Migration and seed have both been applied to the live Supabase project** via `node scripts/apply-migration.mjs`, confirmed by direct row-count query:

| Table | Demo rows |
|---|---|
| communities | 4 |
| community_members | 7 |
| community_events | 7 |
| community_moderation_reports | 4 |
| community_advocacy_programs | 4 |
| community_advocacy_enrollments | 5 |
| community_rewards | 3 |
| community_policies | 5 |

## Demo data (`supabase/seed_community_module.sql`)

Every seeded row carries `is_demo = true` and is scoped to the single "Jamahl Thomas Campaign Manager" demo workspace (`slug = jamahl-thomas-campaign-manager-demo`, see `src/lib/demo-workspaces.ts`). The script is idempotent (every insert is guarded by a `where not exists` on a natural key) and safe to re-run. Real workspaces are never touched — they start with zero communities and see the module's genuine empty states (`CommunityEmpty`, `AccessBlocked`) until they create their own data.

## Permissions (`src/lib/permissions.ts`)

26 new dot-namespaced permissions under the `community.*` prefix (`community.view`, `community.communities.create`, `community.moderation.ban`, `community.advocacy.rewards_approve`, etc.). `owner` receives all of them automatically (`Object.values(PERMISSIONS)`); `admin` receives the full Community set; `manager` receives a reduced set (view/create/edit but not archive, ban, or role management). `creator`/`approver`/`analyst`/`client`/`external_creator` receive none — consistent with how those roles are scoped for every other module in this file.

Plan gating: the Advocacy tab additionally requires the `team` plan or higher (`src/lib/community/entitlements.ts`, `MODULE_RULES.advocacy.minPlan`), independent of the role check — a `manager` on the `starter` plan sees the other five tabs but gets the upgrade state on Advocacy.

## What's real vs. what's presentational

- All KPIs, tables, charts, and right-rail panels read live Supabase data via `src/lib/community/data.ts` — nothing is hardcoded in a page.
- "Next actions", "Moderation alerts", and "Community/Advocacy opportunities" panels are computed from real aggregate signals (e.g. an ambassador-programme suggestion only appears when `activeAmbassadors === 0`) rather than static or random copy — see the filtered arrays at the top of each page's JSX.
- Moderation decisions, membership-request approvals, and reward approvals are real mutations with audit trail (`community_moderation_decisions`, `community_activity`) and `router.refresh()` after success — not toast-only fake actions.
- Search, filters, sort, pagination, and cards/table view all live in the URL (`src/lib/community/query.ts`), so a refresh, browser back/forward, or a shared link restores the same screen.

## Verification performed

- `npx tsc --noEmit` — clean (0 errors) across the whole project after clearing the incremental build cache.
- `npx eslint src/app/app/community src/components/community src/lib/community` — clean (0 errors, 0 warnings) after fixing: three `Date.now()`-in-render violations (moved into a `seriesToPoints` helper in `charts.tsx`), one `setState`-in-effect violation in `FilterBar.tsx` (rewritten as the React-recommended render-time state adjustment), and a handful of unused imports.
- Migration and seed SQL applied directly to the live Supabase project and row counts confirmed by query (table above).
- No Chrome MCP / browser QA has been run — see deferred items below.

## Explicitly deferred (not attempted in this pass)

These are each separate, much larger efforts described elsewhere in CLAUDE.md and were out of scope for this build:

1. **Automation engine** (CLAUDE.md Section 7) — the 60-trigger / 40-action recipe/workflow engine, cron jobs, webhooks. Community events/moderation/advocacy would be natural trigger sources for that system once it exists, but no automation code was written here.
2. **AI Copilot** (CLAUDE.md Section 6) — grounded chat, AI moderation-signal generation beyond the static `ai_risk_score` column, prompt-injection test suite, AI usage/cost controls.
3. **Chrome MCP visual verification** — no browser screenshots, no visual-diff against the six reference designs, no responsive/accessibility audit at the 1440/1280/1024/tablet/mobile breakpoints CLAUDE.md specifies.
4. **Load/DDoS and full security test matrix** — no rate-limit or abuse testing was performed against the new server actions or queries.
5. **The full 900-item per-page evidence documents and `/release-gated/...` scoring** CLAUDE.md's audit template calls for — this tracker is the intentionally condensed substitute for those.

## Recommended next steps

1. Run the app locally (`npm run dev`) and click through all six pages as the demo workspace to visually confirm against the six reference designs.
2. If Chrome MCP / browser automation is available in a future session, run the visual and responsive QA pass CLAUDE.md describes.
3. Decide whether Community events should share the canonical `events` table used by the separate Events module (`src/lib/events/types.ts`) rather than the dedicated `community_events` table created here — they were kept separate in this pass because the two feature sets (webinars/podcasts/sponsorships vs. community live sessions/AMAs/challenges) didn't cleanly map to one schema without a larger reconciliation effort.
4. Community record detail pages (`/app/community/communities/{id}`) were not built — the list pages link back to a filtered list view rather than a dedicated detail route, since CLAUDE.md's detail-page section was not in scope for this pass.
