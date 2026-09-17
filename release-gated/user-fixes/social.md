# Social — manual actions required

These can't be done from the codebase. Until they are, the Social pages work on synced and demo data, but **connecting accounts and live publishing are disabled**. The Connect dialog shows "Not set up" for each platform.

## 1. Credential encryption key (recommended)

Social currently falls back to `ADVERTISING_ENCRYPTION_KEY`, which is set, so connections can already encrypt tokens. A dedicated key keeps the two modules independent:

1. Generate a 32-byte key: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
2. Add `SOCIAL_ENCRYPTION_KEY=<value>` to `.env.local` and to Vercel (Production and Preview).
3. Keep it permanent. Rotating it makes stored tokens unreadable, so every account would need reconnecting.

## 2. Publishing worker secret

1. Generate a random string in the same way.
2. Set `SOCIAL_JOBS_SECRET=<value>` in Vercel.
3. Add a Vercel Cron (or another scheduler) that calls `POST /api/social/jobs/publish` every minute with the header `Authorization: Bearer <SOCIAL_JOBS_SECRET>`.

## 3. Platform developer apps (each workspace user then connects their own accounts)

Create an app in each developer console. Set the redirect URI to `https://<your domain>/api/social/oauth/<provider>/callback` (add the `http://localhost:3004/…` version for local testing), then set these variables:

| Platform | Variables | Console |
|---|---|---|
| Instagram + Facebook | `META_APP_ID`, `META_APP_SECRET` | developers.facebook.com (needs Business verification and App Review for publishing/insights permissions) |
| Threads | `THREADS_APP_ID`, `THREADS_APP_SECRET` | developers.facebook.com |
| TikTok | `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` | developers.tiktok.com (Content Posting API audit) |
| LinkedIn | `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` | linkedin.com/developers (Community Management API access) |
| YouTube | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | console.cloud.google.com (YouTube Data API v3, OAuth consent verification) |
| X | `X_CLIENT_ID`, `X_CLIENT_SECRET` | developer.x.com (paid tier for posting) |
| Pinterest | `PINTEREST_APP_ID`, `PINTEREST_APP_SECRET` | developers.pinterest.com |

Check `NEXT_PUBLIC_APP_URL` matches the deployed domain; it is used to build the redirect URI.

## 4. Verify after configuring

1. Social → Connections → Connect Channel → pick a platform → approve → you return to Connections and the account shows as Healthy.
2. Create a post on that channel with "Publish now". The delivery moves Queued → Published on the post detail page once the provider confirms.
3. Run "Sync now" on the connection and confirm a new row in Sync History.

## 5. Remaining QA not yet done

- Screenshots at 1440, 1280, 1024, tablet and in PWA standalone mode for all six pages.
- An RLS negative test run with a second user who is not a member of the workspace. Supabase SQL: `set request.jwt.claims` to that user, then `select count(*) from social_channels where workspace_id = '<other workspace>'`. Expected result: 0.
- End-to-end browser tests: the repo has no Playwright harness. Add one if automated E2E is required for release.

## Demo data

`node scripts/seed-social-demo.mjs [workspace_id …]` refills demo data. It is idempotent, every row is marked `is_demo` / tagged `seed:social`, and it refuses to run in production. It was run for the four "Jamahl Thomas …" workspaces and for "Caption Fox" (68596451-…), including six demo channels on that workspace.
