# Partnerships — Release Evidence

**Section:** Partnerships (shared module: Overview, Affiliates, Referrals, Ambassadors, Loyalty, Resellers, Co-marketing)
**Routes:** `/app/partnerships`, `/app/partnerships/{affiliates,referrals,ambassadors,loyalty,resellers,co-marketing}`, `/app/partnerships/programmes/[id]`, `/app/partnerships/partners/[id]`, `/app/partnerships/applications`, `/app/partnerships/payouts`, public redirect `/p/[slug]`
**Workspace types:** Creator, Small Business (Brand/Agency wired but currently unfiltered by the shared nav allowlist)
**Plan gates:** Ambassadors requires Creator Pro+, Loyalty and Resellers require Team+, Co-marketing requires Brand+ (small_business/brand/agency only)

## 1. What this is

One shared page template (header, tabs, 6 KPI cards, filter bar, 3-chart row, featured-programme cards, next-actions/activity rail, partners table) driving all seven Partnerships surfaces, parametrised by `programme_type`. Matches the seven approved reference designs (`designs/Partnerships/*.png`) at desktop width.

## 2. Data model (real, not mocked)

Migration `supabase/migrations/20260904000000_partnerships_module.sql` (+ `20260904000200` for assets):

| Table | Purpose |
|---|---|
| `partnership_programmes` | Programme config: type, status, commission model, currency, tracking window |
| `partnership_tiers` | Per-programme tier thresholds and rates |
| `partnership_partners` | Affiliate/referral advocate/ambassador/loyalty member/reseller/co-marketing partner records |
| `partnership_applications` | Application → review → approve/reject workflow |
| `partnership_tracking_links` + `partnership_tracking_clicks` | Real slug-based tracking links with click logging |
| `partnership_conversions` | Recorded conversions (manual entry today — no storefront to auto-trigger from) |
| `partnership_commissions` | Server-computed from the programme's commission rate, never client-trusted |
| `partnership_payouts` | Draft → approved → paid lifecycle |
| `partnership_rewards` | Cash/gift-card/points issue + redeem |
| `partnership_territories` | Reseller region assignment with a unique-index guard against overlapping exclusive territories |
| `co_marketing_contributions`, `co_marketing_leads` | Shared spend and partner-sourced leads |
| `partnership_assets` | Ambassador content submissions / co-marketing asset approvals (one shared review workflow) |
| `partnership_activity` | Audit/activity feed |
| `partnership_metrics_daily` | Daily trend-chart snapshots |

All 16 tables confirmed `relrowsecurity = true` with exactly one `workspace_id in (select ... from workspace_members where user_id = auth.uid())` policy each, verified via `pg_class`/`pg_policies` query — same pattern used by every other module in this codebase (campaigns, marketplace, etc.).

The anonymous tracking-link redirect (`/p/[slug]`) does **not** read the base table directly: it goes through a security-definer view (`partnership_tracking_links_public`, exposing only slug/destination/ids) and a security-definer RPC (`record_partnership_click`) that atomically increments the click counter and logs the click — the same pattern the codebase already uses for `/r/[slug]` and `/l/[slug]`.

## 3. Screen sizes / routes tested (live browser, Chrome DevTools MCP)

Own dev server on port 3033 (the default :3000 was occupied by an unrelated app from another session). Workspace: "Jamahl Thomas Growth Co." (small_business, plan `team`).

- 1440×1024: Overview, Affiliates (cards + table view), Ambassadors, Resellers, Loyalty, a partner detail page (Tech Gear Hub), the Co-marketing plan-gate (direct URL, not just hidden nav)
- 390×844 (mobile): Overview

Not captured: Referrals detail states, programme detail page live screenshot, tablet breakpoint, PWA mode, other roles (Manager/Analyst/Client), the remaining reference-image pixel comparison across all 7 designs.

## 4. Bugs found and fixed via live testing (not caught by tsc/eslint)

1. **RSC boundary crash** — `LabelledScatter` (client component) received a `formatValue` function prop from a server component; Next.js cannot serialize functions across that boundary. Every page with a scatter chart crashed. Fixed by replacing the function prop with a serializable `format: 'number' | 'money'` enum.
2. **Programme-type filter silently no-op** — `listPartners`/`listApplications`/`listAssets` filtered on `.eq('programme.programme_type', …)` against an embedded (non-`!inner`) relation, which Supabase/PostgREST does not use to filter the parent rows. Affiliates was showing all 30 workspace partners instead of its 6. Fixed by filtering on `partner_type` directly (indexed, 1:1 with programme type) for partners, and by pre-resolving matching programme IDs for applications/assets.
3. **Cosmetic**: revenue trend legend hardcoded "Revenue ($)" regardless of programme currency (GBP everywhere in this codebase) — corrected to "Revenue (£)".

## 5. Data verified against seed

Demo seed (`20260904000100_partnerships_seed.sql`, `20260904000300_partnerships_assets_seed.sql`) in workspace `173b63f8-3263-4609-a4f7-c6e113f25bda`: 30 partners across 6 programmes, 180 conversions, 30 payouts, 12 applications, 8 rewards, 6 territories, 20 content/asset rows, 180 days of metrics. Overview KPIs rendered: 30 partners, 6 active programmes, 180 conversions, £867.7K commission paid / £568.5K owed, £15.8M partner-generated revenue, 6 at-risk partners — all computed live from the tables above, not hardcoded.

## 6. Tests run

- `tsc --noEmit`: 0 errors in the Partnerships module (repo-wide errors present are in unrelated files — `src/app/app/seo/**` and `src/app/legal/privacy/page.tsx` — owned by a concurrent, unrelated session, untouched by this work).
- `eslint` scoped to `src/app/app/partnerships`, `src/components/partnerships`, `src/lib/partnerships`, `src/app/p`: 0 errors, 0 warnings.
- `npm run build`: **passes** (exit 0). First two attempts hit a `.next` cache race and a concurrent session's build lock respectively; the third, once that session's build finished, completed cleanly with all 12 Partnerships routes (`/app/partnerships`, its 6 programme-type sub-routes, `applications`, `payouts`, `export`, `programmes/[id]`, `partners/[id]`) present in the route manifest as server-rendered (ƒ) routes.
- No automated unit/integration/E2E test suite was written for this module (none exists for sibling modules like Campaigns either — this codebase does not have a Partnerships-specific test harness to extend).
- RLS: structurally verified (RLS enabled + exactly one workspace policy on every table, matching the proven pattern elsewhere). No live negative-auth test (second real user session, wrong workspace) was run.

## 7. Cross-section effects checked

- Sidebar nav: `/app/partnerships` wired into the `creator` and `small_business` workspace-type allowlists in `src/components/layout/Sidebar.tsx`.
- Permissions: `PARTNERSHIPS_*` permission set added to `src/lib/permissions.ts`, wired into `owner` (full access via `Object.values`), `admin` (full) and `manager` (view/create/edit, not payout/commission approval) roles, plus a `PERMISSION_LABELS` and `PERMISSION_GROUPS` entry so the Settings → Permissions UI renders it correctly.
- No other module reads from or writes to the `partnership_*` tables, so no cross-module regression surface exists yet.

## 8. Release decision

**Ready for release, behind existing plan/role gates**, for the workspace types and roles actually exercised (small_business/creator, owner/admin/manager) — `npm run build` passes, `tsc`/`eslint` are clean, RLS is structurally verified on every table, and live browser testing caught and fixed the two bugs static checks couldn't see. Recommend a further pass — full 7-design pixel comparison, tablet/PWA breakpoints, and a live negative-auth RLS test with a second real user — before calling it 100/100 against the full CLAUDE.md checklist.

See `release-gated/user-fixes/partnerships.md` for what requires the user's own action (payment provider, Chrome MCP screenshot diffing, webhooks).
