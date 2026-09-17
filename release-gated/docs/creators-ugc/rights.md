# Creators & UGC → Rights

- **Parent section:** Creators & UGC (`/{type}/creators`)
- **Sub-tab:** Rights
- **Route:** `/{type}/creators/rights` (detail page: `/{type}/creators/rights/[id]`)
- **Plan and role gate:** Team plan or above
- **Roles tested (RLS script):** owner, admin, manager, member, viewer, non-member

## Screenshots
- **Location:** `docs/ui-verification/caption-fox/creators-ugc/rights-{reference,implementation,side-by-side}.png`
- **Sizes tested:** 1448×1086 and 1440/1280/1024 (overflow checks); 820 tablet (sliding tabs tray); 390 mobile (tabs dropdown)
- **Result:** no horizontal overflow at any size

## Tabs
Reached by clicking the section tabs row, which is a desktop row, a tablet tray and a mobile dropdown. Deep links and hard refresh keep the workspace and filters, because all state is in the URL.

## Buttons and actions
Add Rights Record wizard, Send Usage Request, Export, row menu (status transitions, renew), View all expiring. Activation requires a signed agreement (enforced on the server).

## Filters, search, sorting and views
Territory, channel, campaign, creator, status and expiry range; Reset; table, cards and calendar views.

Search is case-insensitive and matches partial text. An empty result shows an empty state.

## Data and tables
ugc_rights, ugc_rights_requests, ugc_submissions, campaigns

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
**84 / 100: ready for owner/admin-only beta.**
