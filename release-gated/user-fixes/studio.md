# User / manual fixes — Studio

These could not be completed by Claude Code in this pass.

1. **Role and RLS negative tests.** Create test users with Admin, Manager, Team Member and Read-only roles in the demo workspace, and one user in a second workspace. For each Studio tab, confirm restricted actions show a disabled state with a reason, and that calling the server actions directly (e.g. `setMediaStatus`, `cropMediaAsset`, `setTemplateStatus`, `bulkContentAction`) returns an error for the wrong role or workspace.
2. **Confirm pg_cron is enabled in production.** In Supabase → Database → Extensions, check `pg_cron` is on, then run `select jobname, schedule from cron.job where jobname = 'studio-daily-metrics';`. If it is missing, re-run migration `20260916160000_studio_daily_metrics_snapshot.sql`.
3. **Engagement source.** Keyword and engagement history only grows if `hashtag_sets.avg_volume` and `content_posts.engagement` are updated by the keyword and social analytics syncs. Confirm those integrations are connected for real workspaces.
4. **Azure OpenAI.** Set the Azure AI environment variables in Vercel for production and run one Generate from AI Generate to confirm credits are deducted and failures do not charge.
5. **`sharp` in production.** `sharp` is now declared in `package.json`; run `npm install` locally and confirm the Vercel build includes it (Crop returns "The image could not be cropped" if it is missing).
6. **File scanning.** Media uploads are stored with `scan_state = 'pending'`; wire an antivirus/scan step if required for release.
7. **PWA check.** Install the app to a phone home screen and check Studio tabs (mobile dropdown), Compose and Media in standalone mode, including safe-area spacing.
8. **Unrelated type error.** `src/components/strategy/StrategyHeader.tsx` imports `./client/StrategyAssistant`, which does not exist; this fails the project-wide `tsc` and is outside Studio.
