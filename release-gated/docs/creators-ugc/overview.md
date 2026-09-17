# Creators & UGC → Overview

- **Parent section:** Creators & UGC (`/{type}/creators`)
- **Sub-tab:** Overview
- **Route:** `/{type}/creators`
- **Plan and role gate:** All active plans
- **Roles tested (RLS script):** owner, admin, manager, member, viewer, non-member

## Screenshots
- **Location:** `docs/ui-verification/caption-fox/creators-ugc/overview-{reference,implementation,side-by-side}.png`
- **Sizes tested:** 1448×1086 and 1440/1280/1024 (overflow checks); 820 tablet (sliding tabs tray); 390 mobile (tabs dropdown)
- **Result:** no horizontal overflow at any size

## Tabs
Reached by clicking the section tabs row, which is a desktop row, a tablet tray and a mobile dropdown. Deep links and hard refresh keep the workspace and filters, because all state is in the URL.

## Buttons and actions
KPI cards link to filtered sub-pages. Search, date range, campaign, channel and status filters. Card/Table view toggle. View-all links on every panel. Previous/next arrows on Recent Submissions. Create Brief, Invite Creator, Export.

## Filters, search, sorting and views
Dates, campaign, channel and status in the URL. Top creator performance is sorted by reach.

Search is case-insensitive and matches partial text. An empty result shows an empty state.

## Data and tables
ugc_creators, ugc_briefs, ugc_submissions, ugc_rights, ugc_payments, ugc_activity, campaigns

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
**86 / 100: ready for owner/admin-only beta.**
