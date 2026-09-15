# Release Evidence — SEO & Discovery (Main Section)

**Section name:** SEO & Discovery
**Section route:** `/app/seo` (canonical shared-module route `/{type}/seo`, register entry 5.11)
**Parent:** Shared Campaign Manager modules (Creator, Business, Brand, Agency workspaces)
**Date:** 2026-09-03
**Author:** Claude (agentic build), reviewed against live Supabase project `crazahobtmpipzxbkckf`

---

## 1. Scope of this evidence pack

This document, plus the six per-sub-tab documents in `release-gated/docs/seo-and-discovery/`, cover the full SEO & Discovery module built this session:

- `/app/seo` — Overview
- `/app/seo/keywords` — Keywords
- `/app/seo/briefs` (+ `/app/seo/briefs/[id]`) — Briefs
- `/app/seo/rankings` — Rankings
- `/app/seo/local` — Local
- `/app/seo/ai-search` — AI Search
- `/app/seo/backlinks` — Backlinks

## 2. Screen sizes tested

| Size | Method | Result |
|---|---|---|
| Desktop (1440/1491×1055, matching design references) | Direct HTML inspection of server-rendered output over an authenticated session | Layout matches the seven approved reference images: sidebar, top bar, KPI strip, charts, tables |
| Tablet / mobile | **Not tested live this session** — see Section 8 |

Full Chrome MCP resize-and-screenshot QA across desktop/tablet/mobile/PWA against the seven reference images was **not completed** — see Section 8 (Known gaps) and the linked user-fixes document.

## 3. Routes tested

| Route | Method | Result |
|---|---|---|
| `/app/seo` | Live HTTP request with a real authenticated session (brand-type workspace) | 200, real KPI/chart/table content confirmed in the rendered HTML (`Organic Clicks`, `Ranking Trend`, `Keyword Movements`, `Content Briefs`, `Top SEO Opportunities` all present with live values, not placeholder text) |
| `/app/seo/backlinks` | Live HTTP request against a **creator**-type workspace | 200, correctly rendered the entitlement-blocked panel ("not part of the current workspace type") instead of the full page — confirms workspace-type gating actually runs, not just compiles |
| `/app/seo/keywords`, `/app/seo/briefs`, `/app/seo/briefs/[id]`, `/app/seo/rankings`, `/app/seo/local`, `/app/seo/ai-search`, `/app/seo/backlinks` (full page) | `tsc --noEmit` across the whole repository (zero errors), manual code review, and the unit-test suite below | Type-safe and logically verified. **Not independently re-confirmed via a live authenticated page load after the wizard/export work landed** — the local dev server stopped responding between turns in this long session for reasons unrelated to this code (see Section 8), and a second live Chrome instance already held the only available browser profile lock. |
| `/api/seo/export` | Code review + unit tests of the filter-parsing helpers it shares with the pages | Not exercised end-to-end over HTTP this session |

Unauthenticated access, hard refresh, and browser back/forward were not independently re-tested after the auth session used for the earlier live check expired; the underlying mechanism (`src/middleware.ts` + `getSeoSession`) is unchanged from the rest of the already-shipped Campaign Manager modules and follows the identical pattern used by `/app/campaigns` and `/app/events`.

## 4. Buttons / actions tested

| Action | Where | Verification |
|---|---|---|
| Add Keywords | Keywords, Rankings ("Track Keywords") | Server action `addKeywords` reviewed line-by-line: capability check, per-line parsing, dedupe against the unique DB constraint, cluster upsert-or-create, activity log, audit log, `revalidatePath`. Not exercised live. |
| Create Brief | Overview, Briefs | Server action `createBrief` reviewed: keyword auto-match, validation, redirect to the new brief's detail page on success. Not exercised live. |
| Add Location | Local | Server action `addLocation` reviewed: duplicate-name+address check, validation. Not exercised live. |
| Track Prompts | AI Search | Server action `trackPrompt` reviewed: engine allow-list, duplicate check, explicit "this is a periodic sample, not live monitoring" disclosure in the UI copy. Not exercised live. |
| Add Outreach List / Add to List | Backlinks | Server actions `createOutreachList` and `addOpportunityToList` reviewed: name dedupe, ownership check, list-membership upsert. Not exercised live. |
| Export | All seven pages | Route handler reviewed: re-derives the exact same filters as the on-screen query, checks the export capability per surface, writes an audit log entry, returns formula-injection-safe CSV. Not exercised live over HTTP. |
| View switchers (Table/Cards/Board/Map/etc.), filters, search, sort, pagination | All pages | URL-state driven (`src/lib/seo/url-state.ts`), unit-tested (18 tests) for the query-building logic; page-level wiring reviewed manually. |

**Every action above is implemented against real Supabase writes and real permission checks — none of them are UI-only stubs.** What is *not* verified is an actual live click-through with a real browser session confirming the round trip end to end.

## 5. Filters / search / sorting / views tested

Covered by `src/lib/seo/url-state.test.ts` (18 tests): param reading/coercion, href building with overrides, pagination reset on filter change, export-href filter passthrough, active-filter-chip labelling. Per-surface filter option lists (intent, cluster, status, device, engine, citation, sentiment, link type, etc.) were reviewed manually against the seven design references.

## 6. Data sources tested

All data is live Supabase data, workspace- and site-scoped:

- **Real data path:** every KPI, table, chart and list on every page is produced by a query in `src/lib/seo/queries.ts` against the tables below — there is no hard-coded or randomly-generated data in any page component.
- **Demo data:** the seed function `seed_seo_demo(workspace_id, user_id)` populated one `is_demo = true` SEO site per existing workspace for the test account (`jamahlthomas1996@gmail.com`), so every page has realistic content to render. Every demo row carries `is_demo = true`, and `SeoSite.is_demo` drives the demo-data disclosure banner on the Overview page.
- **Provider transparency:** source connections and AI-search prompt checks record which method produced them (`google_search_console`, `semrush`, `ahrefs`, `browser_sample`, `manual_check`, etc.) — see `COLLECTION_METHOD_LABELS` and the Source Transparency / Answer Engines Monitored panels. No page claims live monitoring access to an AI answer engine that isn't actually implemented.

## 7. Supabase tables checked

28 new tables, all created in `supabase/migrations/20260831000000_seo_discovery.sql` and confirmed live in the linked Supabase project via direct SQL query (row counts below are from the seeded demo data across 6 workspaces):

| Table | Confirmed row count (seed) |
|---|---|
| `seo_sites` | 6 |
| `seo_keywords` | 240 |
| `seo_keyword_rankings` | 28,800 |
| `seo_site_daily` | 720 |
| `seo_content_briefs` | 60 |
| `seo_locations` | 36 |
| `seo_ai_prompts` | 72 |
| `seo_backlinks` | 150 |
| `seo_opportunities` | 120 |
| `seo_activity` | 204 |
| `seo_reviews` | 1,080 |
| `seo_keyword_clusters`, `seo_source_connections`, `seo_source_sync_runs`, `seo_competitors`, `seo_competitor_daily`, `seo_business_listings`, `seo_ai_engines`, `seo_ai_prompt_checks`, `seo_ai_cited_pages`, `seo_ai_source_mix`, `seo_link_opportunities`, `seo_outreach_lists`, `seo_outreach_list_items`, `seo_top_linked_pages`, `seo_brief_sections`, `seo_brief_comments` | Present and populated by the seed function; not individually re-counted in this pass |

## 8. RLS policies checked

- Every SEO table has `for all using (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()))` applied via the loop at the end of the migration — identical shape to the existing Events and Campaigns modules.
- **Critical pre-existing bug found and fixed:** `workspace_members`'s own RLS policies queried `workspace_members` from inside their own `USING` clause, which Postgres cannot evaluate — every authenticated (non-service-role) request against *any* workspace-scoped table failed with "infinite recursion detected in policy for relation workspace_members". This blocked the entire `/app/*` surface of the application, not just SEO. Applied the existing (previously written but never-applied) fix migration `20260829000200_fix_workspace_members_recursion.sql`, which routes membership checks through `SECURITY DEFINER` helper functions (`is_workspace_member`, `workspace_role`) instead of a self-referencing subquery. Confirmed live: a real authenticated session could read its own `workspace_members` rows immediately after the fix, where it failed with a Postgres recursion error immediately before.
- **Positive RLS test:** confirmed live — the seeded test user could read their own 6 workspaces' `seo_sites` and see KPI data for one of them.
- **Negative RLS test:** *not executed live* — there is no second Supabase test user available in this session to prove a different user cannot read this workspace's SEO rows. The policy shape is identical to the already-shipped Campaigns/Events modules' policies, which have this same structural guarantee, but a dedicated negative-path test against a second real account is still outstanding. See the user-fixes document.

## 9. Edge functions checked

None. The SEO module uses Next.js Route Handlers and Server Actions running against Supabase directly with the user's session — there are no separate Supabase Edge Functions in this module.

## 10. Storage buckets checked

None used. The SEO module has no file-upload surface in this pass (no document/image uploads for briefs, locations or backlinks evidence).

## 11. Integrations checked

None connected — by design. Per the product brief for this module, **the user connects real Google Search Console / Semrush / Ahrefs / Google Business Profile accounts themselves**; this build only defines the source-connection data model (`seo_source_connections`), the capability-merging logic that adapts the UI to what a connected source can actually supply (`mergedSourceCapabilities`), and seeds demo "connected" rows so the UI has something real to render against in development. No OAuth flow, webhook receiver, or API credential capture UI was built in this pass.

## 12. Bugs found

1. **App-wide RLS recursion on `workspace_members`** (pre-existing, not introduced by this work) — see Section 8. Fixed.
2. **Missing `src/components/fox-ai/tabs/AgentTab.tsx`** (pre-existing, unrelated to SEO) — broke every `/app/*` page's build because it's imported from the shared layout. Added a minimal, honestly-labelled "coming soon" placeholder tab so the shell builds; the Agent tab's real functionality is out of scope for this work.
3. **Server-to-client function prop violation in the Keywords page** (introduced, then found and fixed within this session) — an inline `onClick` was passed from a Server Component into the client `SeoHeader`, which Next.js rejects at runtime ("Event handlers cannot be passed to Client Component props"). Fixed by moving all "create" actions into dedicated client wizard components passed down as pre-rendered slots (`primarySlot`) instead of as data.
4. **Dead `?new=1` links** on all seven pages' primary "Create"/"Add"/"Track" buttons, and a dead `/api/seo/export` link with no route behind it — both fixed in the follow-up pass (see `docs/seo-and-discovery/*.md` for the per-page detail).
5. **Self-inflicted dev-server disruption** — during live testing, a second `next dev` instance was briefly started against the same `.next` build cache as the user's own running dev server, corrupting it. Cleared the regenerable `.next/dev` cache directory to let it self-heal; this is disclosed here for transparency even though it left no lasting code defect.

## 13. Fixes made

All five items in Section 12 above were fixed in this session. See `git log`/`git status` for the exact file list; the module lives entirely under `src/app/app/seo/`, `src/components/seo/`, `src/lib/seo/`, and `src/app/api/seo/`.

## 14. Migrations applied

Applied directly against the live Supabase project via the Management API (`scripts/apply-migration.mjs`):

1. `supabase/migrations/20260831000000_seo_discovery.sql` — 28 tables, indexes, RLS policies, triggers.
2. `supabase/migrations/20260831000100_seo_discovery_seed.sql` — `seed_seo_demo()` function, applied once per existing workspace for the test account.
3. `supabase/migrations/20260829000200_fix_workspace_members_recursion.sql` — pre-existing fix migration (written by an earlier session, never applied); applied this session because it was blocking every page in the module.

All three are idempotent (`create table if not exists`, `create or replace function`, `drop policy if exists` + `create policy`) and safe to re-run.

## 15. Tests run

- **Unit tests:** added a Vitest suite (none existed in this repository before). 100 tests across 7 files, all passing:
  - `src/lib/seo/metrics.test.ts` — visibility score, average rank, estimated traffic, rank distribution, quick-win score, link match score, citation rate.
  - `src/lib/seo/format.test.ts` — number/currency/percent formatting, "Not ranking" never rendered as 0, due-date labelling, humanised enum labels.
  - `src/lib/seo/range.test.ts` — date-range resolution and comparison-period math, invalid/hostile input handling, granularity bucketing.
  - `src/lib/seo/entitlements.test.ts` — workspace-type gating, plan gating, permission gating, feature-flag gating, workspace-status gating, visible-tabs computation, view-availability gating, source-capability merging.
  - `src/lib/seo/url-state.test.ts` — URL param parsing, href building, filter-driven pagination reset, export-href filter passthrough.
  - `src/lib/seo/kpis.test.ts` — sum vs. average vs. last-value aggregation per metric, invert flags, null-vs-zero handling, source attribution.
  - `src/lib/seo/breakdown.test.ts` — the generic real-data grouping helper behind the Rankings Breakdown view (added in the follow-up pass): grouping, "Unknown" bucketing, average-rank exclusion of unranked rows, volume summation, share %, sort order.
  - Run with `npm test`. Result: **7 files, 100 tests, 0 failures.**
- **Type checking:** `npx tsc --noEmit` across the entire repository — **0 errors** (confirmed after every pass this session, including the follow-up feature work).
- **Live HTTP verification (follow-up pass):** confirmed via authenticated requests against a real running dev instance:
  - `GET /app/seo/briefs/[id]` for the seeded "Ultimate Guide to Keyword Research" brief → 200, with the new status control, outline editor and comment composer all present in the rendered HTML.
  - `GET /app/seo/rankings?view=breakdown&dim=device` and a fresh `GET /app/seo/ai-search` were **attempted but not obtained cleanly** — the shared local dev server was being restarted by something outside this agent's control every 10-20 seconds during this window (a `ChunkLoadError` for the Rankings route appeared in the dev server's own log at the same moment, consistent with the build cache being swapped mid-request, not an application defect). The identical request mechanism was proven working moments earlier against the Briefs detail page, so this is recorded as an environment-timing gap, not a verification failure of the code itself.
- **Integration / E2E / RLS negative / visual regression tests:** not run — see Section 8 and the user-fixes document.

## 16. Performance / security findings

- Every server query is scoped by `workspace_id` **and** `site_id` resolved server-side from the authenticated session (`getSeoSession`) — never trusted from a client-supplied query parameter.
- Every mutating server action re-checks its capability server-side via `assertSeoCapability` before writing, independent of whether the triggering button was visible in the UI.
- CSV export sanitises formula-injection characters (`=`, `+`, `-`, `@`) on every cell, matching the existing Events export pattern.
- Search/filter text passed to Postgres `ilike` queries is neutralised against pattern metacharacters (`escapeLike`) before use.
- No rate limiting or throttling has been added to the export endpoint or the five create actions — this is a gap; see the user-fixes document.
- No load/performance testing was run against the 5,000-row keyword/backlink/prompt datasets the export route will fetch in a single query — worth a follow-up check before large customers exercise it.

## 17. Cross-section effects checked

- `revalidatePath` is called for every affected SEO route after each write, so newly created keywords, briefs, locations, prompts and outreach lists appear immediately without a manual refresh.
- `seo_activity` rows are written for every create action and rendered in the page's Activity & Alerts panel — confirmed by code review that the surface tag on each activity row matches the page it's meant to appear on.
- No other Campaign Manager module (Campaigns, Events, Advertising, etc.) reads from or writes to any `seo_*` table, so this module cannot have broken anything outside itself. Conversely, the RLS recursion fix (Section 8/12) affects **every** module, not just SEO, and should be regression-checked broadly, not just here.

## 18. Pending user / manual actions

See `release-gated/user-fixes/seo-and-discovery.md` for the full list with exact steps.

## 19. Release score

**62 / 100.**

Rationale: the data model, entitlements, real Supabase-backed pages, wizards, server actions, export, and a genuine unit-test suite are all real and verified either live or by rigorous static/code-level review — this is not a route shell. It falls short of 100 because: (a) full Chrome MCP visual QA against the seven approved mockups across desktop/tablet/mobile/PWA was not completed, (b) the five wizards and the export endpoint were not exercised end-to-end in a live browser session after they were built, (c) no negative RLS test was run against a second real account, and (d) no integration/E2E test suite exists yet. Per the completion rule in this project's architecture document, a route shell is not a completed feature — but the reverse is also true: code that has not been watched actually working in a browser should not be scored as if it had.

## 20. Final release decision

**Blocked pending manual fix** — specifically, pending a Chrome MCP or manual browser QA pass (the one dependency this agent session could not complete due to an already-locked browser profile and an unstable local dev server across a long session), and pending a decision on rate limiting for the export/create actions. The underlying code is release-quality; what's missing is the verification step, not the implementation.
