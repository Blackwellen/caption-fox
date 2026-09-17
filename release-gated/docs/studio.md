# Release evidence — Studio (Overview)

| | |
|---|---|
| Section / route | Studio · `/{type}/studio` |
| Sub-tabs | Compose, AI Generate, Ideas, Templates, Hashtags & Keywords, Media, Content Library (see `docs/studio/*.md`) |
| Required plan / flag | Studio module gate (`canAccessStudioModule`), per-module entitlements in `src/lib/studio/entitlements.ts` |
| Roles tested | Owner (browser, demo workspace `d7b7c61e…`); other roles via capability map only |
| Reference | `designs/Universal Sections/Studio/*.png` @ 1491 × 1055 |
| Screen sizes | 1491 × 1055 (design), 768 × 1024 tablet, 390 × 844 mobile |
| Score | **86 / 100** |
| Decision | **Ready for admin-only beta** — pending role/RLS negative tests and PWA pass (see user-fixes) |

## Tested (browser)
- Header, tabs, KPI strip (Drafts in progress, Ready to review, Scheduled this week, AI-assisted outputs), Compose New Post (editor, AI Assist menu, Save draft / Schedule), Channel Previews (Instagram / LinkedIn / TikTok), Content Pipeline, Recent Content (cards/table, filters), Quick Actions, Assets, Recent Activity.
- Side-by-side with design: layout, density and card placement match; remaining differences are demo data values (e.g. "Liked by" row only renders for published posts with engagement).
- Every Studio route returns 200 with exactly one H1; no console errors on load; no horizontal overflow at 390 px or 768 px (one tablet overflow on Hashtags fixed).

## Data sources / tables
`content_posts`, `post_versions`, `post_comments`, `approvals`, `ai_generations`, `studio_prompts`, `content_ideas`, `studio_idea_collections`, `studio_idea_tasks`, `content_templates`, `studio_template_usage`, `studio_template_favourites`, `hashtag_sets`, `studio_keyword_terms`, `studio_blocked_terms`, `studio_keyword_metrics_daily`, `media_assets`, `studio_media_collections`, `studio_asset_versions`, `studio_content_assets`, `content_engagement_daily`, `studio_activity`, `audit_logs`.

## RLS
All Studio-owned tables use `workspace_id in (select workspace_id from workspace_members where user_id = auth.uid())`. New this pass: `studio_idea_tasks` (insert also checks the parent idea is in the same workspace); `studio_keyword_metrics_daily` and `content_engagement_daily` are member **read-only** (writes only from the security-definer snapshot job).

## Migrations applied (PAT)
- `20260916140000_studio_idea_tasks.sql`
- `20260916150000_studio_daily_metrics.sql`
- `20260916160000_studio_daily_metrics_snapshot.sql` (function `studio_daily_metrics_snapshot()`, `execute` revoked from public/anon/authenticated; pg_cron `studio-daily-metrics` at 23:50 UTC)

## Cross-section effects checked
Studio activity rows link back to the record (`?selected=` / `compose?id=`); template use, idea conversion, repurpose and AI "Use in Compose" create drafts that appear in Compose recent drafts and Content Library.

## Bugs fixed (whole section)
Numeric Postgres columns returned as strings broke keyword growth maths; `Intl` compact number formatting caused hydration mismatch; duplicate H1 on bar-layout pages; client helper called from a server component (Media crash); CSS grid auto-placement collapsed the Media layout; idea stage could bypass the workflow through `saveIdea`; demo seeding had reset published posts' `updated_at` (restored with trigger paused).

## Tests run
`tsc --noEmit` (Studio clean; an unrelated error exists in `src/components/strategy/StrategyHeader.tsx`), `eslint src/components/studio src/lib/studio` clean, browser QA via Chrome DevTools MCP.

## Performance / security findings
Server components batch queries per page (no N+1: term counts, covers, series and engagement windows each use one `in(...)` query). Storage paths are stripped before media rows reach the client; only signed R2 URLs are sent. Crop reads/writes R2 server-side only and validates workspace prefix, MIME type and 40 MB cap.
