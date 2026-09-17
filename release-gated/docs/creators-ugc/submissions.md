# Creators & UGC → Submissions

- **Parent section:** Creators & UGC (`/{type}/creators`)
- **Sub-tab:** Submissions
- **Route:** `/{type}/creators/submissions` (detail page: `/{type}/creators/submissions/[id]`)
- **Plan and role gate:** All active plans (review: admin and manager and above)
- **Roles tested (RLS script):** owner, admin, manager, member, viewer, non-member

## Screenshots
- **Location:** `docs/ui-verification/caption-fox/creators-ugc/submissions-{reference,implementation,side-by-side}.png`
- **Sizes tested:** 1448×1086 and 1440/1280/1024 (overflow checks); 820 tablet (sliding tabs tray); 390 mobile (tabs dropdown)
- **Result:** no horizontal overflow at any size

## Tabs
Reached by clicking the section tabs row, which is a desktop row, a tablet tray and a mobile dropdown. Deep links and hard refresh keep the workspace and filters, because all state is in the URL.

## Buttons and actions
Review Queue, Bulk Approve (cap 200), Export, queue row review actions. Detail page: approve, request changes, reject, flag issue, resolve/dismiss, reassign reviewer, upload new version.

## Filters, search, sorting and views
Creator, brief, asset type, status, reviewer, date and rights filters; gallery, table and board views; sort; pagination.

Search is case-insensitive and matches partial text. An empty result shows an empty state.

## Data and tables
ugc_submissions, ugc_submission_assets, ugc_submission_reviews, ugc_submission_issues; bucket ugc-submissions

All data is live from Supabase. The demo seed rows are marked `is_demo`.

## RLS, security and edge functions
- Role-aware policies come from migration `20260916200000_creators_ugc_release.sql`; `scripts/verify-creators-rls.mjs` passes 38/38.
- Server actions re-check capability and workspace ownership.
- No edge functions are used.

## Bugs, fixes and tests
See `release-gated/docs/creators-ugc.md` §7–§8. The latest pass ran tsc, eslint, vitest (61/61) and the RLS script (38/38).

## Remaining manual actions
See `release-gated/user-fixes/creators-ugc.md`.

## Score
**80 / 100: ready for owner/admin-only beta.**
