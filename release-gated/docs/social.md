# Release evidence — Social (Overview, Publishing, Engagement, Listening, Connections, Analytics)

| | |
|---|---|
| Section | Social (shared module, all workspace types) |
| Routes | `/{creator\|business\|brand\|agency}/social` · `/publishing` · `/engagement` · `/listening` · `/connections` · `/analytics` |
| Detail routes | `/social/posts/:id` · `/social/conversations/:id` · `/social/connections/:id` · `/social/listening/mentions/:id` |
| Legacy routes | `/app/social/…` → 307 to `/{type}/social/…`, deep path and query kept |
| Design references | `designs/Universal Sections/Social/ChatGPT Image Jul 24, 2026, 03_59_39 AM (1–5).png`, `03_59_40 AM (6).png` |
| Reference viewport | 1491 × 1055, DPR 1 |
| Tested as | Owner of "Jamahl Thomas Campaign Manager" (`brand`) and "Caption Fox" (`creator`) |
| Date | 2026-09-16 |
| Release score | **88 / 100** |
| Release decision | **Ready behind feature flag.** UI, data, gating, exports and actions are verified. Live publishing and connecting are **blocked pending manual fix**: platform app credentials and `SOCIAL_JOBS_SECRET` are not set (token encryption currently uses the `ADVERTISING_ENCRYPTION_KEY` fallback) — see user-fixes. |

Manual actions: [/release-gated/user-fixes/social.md](../user-fixes/social.md)

## 1. Architecture

- **One implementation for all workspace types:** `src/app/[workspaceType]/social/[[...rest]]/page.tsx` → `src/components/social/SocialRoute.tsx` → one page component per surface in `src/components/social/pages/*`.
- **Gate order** (`src/lib/social/entitlements.ts`): workspace type → subscription → feature flag → plan → role. `SocialRoute` checks the surface before rendering; a hidden surface is left out of the tab row and a direct URL shows the upgrade or no-access state. Example: Listening on the `creator` workspace shows "not part of this workspace type".
- **Server actions** (`src/lib/social/actions.ts`, 23 actions): every action goes through `run(surface, …)`, which resolves the session server-side, re-checks the surface gate, then the capability permission and record ownership (`assertOwnedRecord`). Every write is also scoped with `.eq('workspace_id', …)`.
- **Shared primitives:** `kit.tsx` (cards, badges, deltas, SVG charts, provider logos), `controls.tsx` (URL-bound selects, tabs, search, menus, export), `Dialog.tsx` (focus trap, Escape to close, phone bottom sheet), `Header.tsx`.
- **Brand logos:** `ProviderIcon` uses the shared `BrandLogo` registry (`simple-icons` paths). Instagram, TikTok, LinkedIn and X use the app-tile form. Facebook and YouTube use the bare mark, as in the references. No hand-drawn or lettered logos remain.
- Legacy Social components (`primitives.tsx`, `AccessGate`, `PostComposer`, `ConversationPanel`, …) were removed once nothing imported them.

## 2. Pages built and verified against the designs (Chrome MCP, 1491 × 1055)

| Page | Design | Result |
|---|---|---|
| Overview | (1) | Header controls, six KPI cards, six platform cards (one per platform, no scrollbar), Content Performance stacked bars, Social Performance Trend, Engagement Feed, Recent Posts with tiers, Upcoming Posts, Activity & Alerts in the reference order |
| Publishing | (2) | View tabs (Calendar / Queue / List / Board), six channel cards, week calendar with time grid, now-line, side-by-side lanes for overlapping posts and "+N more", suggested "+ Schedule" slot; Scheduled Posts; Approval Queue; right rail with Workflow Activity, Publishing Alerts, Publishing Queue and week totals |
| Engagement | (3) | Filter header, tabs with live counts, KPI strip, conversation list, selected thread with post card, messages and reply composer (Reply / Note / Internal Comment / DM, sentiment, tags, templates), Response Analytics, Team Workload, Flagged Conversations |
| Listening | (4) | Six summary cards (sentiment donut, topics, influencers, share of voice, alerts), view tabs, Mentions Stream with pagination, Sentiment Over Time and Breakdown, Trending Conversations with sparklines, Top Keywords cloud, Sources, Mentions by Region (Natural Earth dot map), Listening Alerts, High Priority Mentions |
| Connections | (5) | Filters, Cards / Table / Health toggle, six KPI cards with sparklines, channel cards (scopes x of y, permissions, last sync), Connected Accounts, Source Health Overview, Sync History, Webhook / Activity Log, Issues & Alerts |
| Analytics | (6) | Date / compare / filters / attribution / layout, six KPIs, Performance Over Time, Performance by Channel, Content Performance with type tabs and sortable columns, Top Performing Posts, Audience Demographics, Engagement Breakdown, Outcome Funnel, Insights / Reports rail with report shortcuts and data sources |

**Known differences from the references (intentional):**
- The locked app shell has a wider sidebar and a taller top bar. The Social section tab row (breadcrumb plus tabs) is not in the images, but it is the only way to reach the sub-pages without changing the sidebar. Everything below it sits about 35 px lower than in the reference.
- Figures come from seeded demo data, not the image's numbers.
- Charts with several metrics (Overview trend, Analytics performance) draw the non-axis series on their own scale so the lines don't overlap. The hint and screen-reader summary say so, and tooltips show real values.
- Analytics "Conversions" shows "Not tracked": social has no conversion source. Engagement "Linked Workspaces" became "Mapped Teams", because the data is team mappings.

## 3. Screen sizes and evidence

- 1491 × 1055 screenshots for all six pages, both workspaces, iterated against the designs. Files in the session scratchpad: `ov1–4`, `pub1–3`, `eng1–2`, `lis1–3`, `con1`, `ana1–2`, `post-detail`, `composer2`.
- 390 × 844 mobile (DPR 2, touch): Publishing, Engagement, Listening, Connections and Analytics each measured `documentElement.scrollWidth = 390` with no unclipped overflowing element. Section tabs become a dropdown on mobile and a sliding tray on tablet (`ResponsiveTabs`).
- **Not yet captured:** 1440 / 1280 / 1024 / tablet screenshots, and PWA standalone mode.

## 4. Data, tables and RLS

Tables read and written: `social_channels`, `channel_analytics`, `content_posts`, `post_analytics`, `publishing_queue`, `inbox_threads`, `inbox_messages`, `saved_replies`, `brand_mentions`, `listening_keywords`, `listening_topics`, `listening_sources`, `listening_alert_rules`, `listening_alerts`, `competitor_profiles`, `social_sync_runs`, `social_webhook_events`, `social_connection_issues`, `social_audience_metrics`, `social_report_presets`, `scheduled_reports`, `social_activity`, `social_oauth_states`, `media_assets`, `campaigns`, `profiles`, `workspace_members`.

Migrations `20260831000000_social_module.sql` and `20260916120000_social_release.sql` are applied on project `crazahobtmpipzxbkckf`; each table has workspace-membership RLS. No new migration was needed in this pass.

**Cross-workspace check (browser):** opening `/brand/social/posts/<id>` for a post in the Caption Fox workspace shows the same "not found" state as a malformed id or an unknown page. Nothing reveals that the record exists.

## 5. Bugs found and fixed this pass

1. `compactNumber` dropped trailing zeros on whole numbers ("20K" rendered as "2K", "100K" as "1K"), which broke every chart axis. Fixed, with a unit test.
2. PostgREST errors on ambiguous embeds were swallowed, so data came back empty: `workspace_members → profiles` (two foreign keys) left Team Workload and the assignee lists blank, and `publishing_queue → social_channels` (two foreign keys) left "Channel deliveries" blank. Both now name the foreign key.
3. "Reconnect" linked with GET to an endpoint that only accepts POST. It is now a real OAuth start (POST, then redirect to the authorize URL).
4. `schedulePost` trusted client media paths and campaign ids. It now only accepts media from this workspace's library (or already on the post) and campaigns that belong to this workspace, and rejects read-only channels. Titles and captions are length-limited, and dates are validated.
5. The export route accepted `dataset=toString` (a prototype key) and `days=abc` (NaN). It now uses `Object.hasOwn` and a clamped parser, checks the surface gate as well as the capability, and is rate-limited.
6. `oauth.ts` had a broken string literal in `safeReturnPath`, which stopped the file compiling. Fixed, with tests for `//host`, `/\host`, absolute URLs and CRLF.
7. `publish-worker.ts` was missing an import. Fixed.
8. Server actions checked the permission but not whether the surface is open. All 23 now go through the surface gate first.
9. Seed: rates were stored as percentages in fraction columns (numeric overflow); mixed-shape bulk inserts sent NULL instead of column defaults; there was no previous-period baseline, which produced a "+1216%" delta. All fixed.

## 6. Buttons and actions verified

- Create Post / Schedule Post open the composer (`?compose=1`). Editing a post uses `?compose=<id>`, and an empty calendar slot passes its time (`?compose=at:…`).
- Exports CSV / XLSX / PDF for posts, analytics, listening, connections and engagement: 200, correct MIME type and filename. An unknown dataset returns 400; `days=abc` falls back to the default.
- Rate limit: the export after the 20th in 10 minutes returns 429 with a plain-language message. Manual sync is limited to 10 per 10 minutes.
- Detail pages: approve, request changes (note required), publish now, send for approval, retry failed channels, duplicate, cancel (with confirmation); reply, internal note, assign, resolve or reopen, flag; sync now, reconnect, disconnect (with confirmation), team mapping, resolve issue; star, read or unread, actioned.
- Listening: star, resolve alert, Create Alert dialog. Analytics: Create Report (save, optionally schedule), pause or resume a schedule. Connections: Connect Channel dialog (shows "Not set up" per platform until credentials exist), Sync now, Refresh.

## 7. Tests run

- `npx vitest run`: **23 files, 301 tests passed**, including the new `src/lib/social/social.test.ts` (15 tests: URL parsers, number formatting, performance tiers, weekly rollup, CSV injection escaping, CRC-32, ZIP/XLSX/PDF structure, OAuth return path).
- `tsc --noEmit`: no errors in Social code. `eslint` on `src/components/social`, `src/lib/social` and `src/app/[workspaceType]/social`: clean.
- Console on Overview: no errors (one favicon warning from the shared shell).

## 8. Score breakdown

| Area | Score | Gap |
|---|---|---|
| Design match (6 pages) | 18 / 20 | Shell offset; demo figures differ |
| Data wiring and correctness | 15 / 15 | |
| Gating, permissions, cross-workspace | 14 / 15 | No automated RLS negative suite run in this pass |
| Actions and workflows | 13 / 15 | Live provider publishing and OAuth untested (no credentials) |
| Responsive / accessibility | 8 / 10 | 1440 / 1280 / 1024 / tablet / PWA screenshots outstanding |
| Tests | 10 / 15 | Unit tests only; no Playwright E2E harness in the repo |
| Error, empty and loading states | 10 / 10 | Route `error.tsx` and `loading.tsx` added |

**88 / 100.** This does not reach 100: completing section 8 and the user-fixes is what's left.
