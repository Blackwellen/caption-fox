# User Fixes — SEO & Discovery

Things Claude Code could not complete in this pass, with exact steps. Grouped by urgency.

---

## 1. Run the browser QA pass (blocks release)

This agent session could not complete a live browser walkthrough of the finished module because:
- The Chrome DevTools MCP browser profile (`C:\Users\PC\.cache\chrome-devtools-mcp\chrome-profile`) was already locked by another running instance for the whole of this session, and killing an unknown Chrome process on your machine without knowing whose it was would have been unsafe.
- The local `next dev` server on port 3004 stopped responding between turns multiple times during this long session, for reasons unrelated to the SEO code (the gaps between messages in this conversation were long enough that the dev server appears to have been separately restarted/stopped outside this agent's control).

**What to do:**
1. Make sure only one `next dev` is running for this project (check `netstat -ano | findstr :3004` on Windows; if something else already owns the port, either use that instance or stop it with `taskkill /PID <pid> /F` before starting your own).
2. `npm run dev`, then log in as `jamahlthomas1996@gmail.com` and switch the active workspace to a **brand** or **agency** type workspace (Local and Backlinks are hidden for creator/small-business by design — see `src/lib/seo/entitlements.ts`).
3. Visit each of the 7 routes and confirm against the 7 reference images in `designs/SEO and Discovery/`:
   - `/app/seo`
   - `/app/seo/keywords`
   - `/app/seo/briefs` (and open one brief's detail page)
   - `/app/seo/rankings`
   - `/app/seo/local`
   - `/app/seo/ai-search`
   - `/app/seo/backlinks`
4. Click through each page's primary wizard button (Add Keywords, Create Brief, Add Location, Track Prompts, Add Outreach List) end to end and confirm a new row actually appears after the page refreshes.
5. If you have Chrome MCP available in a fresh session with no profile lock, ask Claude Code to do this pass for you and produce before/after screenshots.

## 2. Decide on rate limiting for create actions and exports (recommended before release)

None of the five server actions (`addKeywords`, `createBrief`, `addLocation`, `trackPrompt`, `createOutreachList`) or the export endpoint have rate limiting. If this matters for your plan/abuse posture, add it the same way it's presumably done elsewhere in the app (check for an existing rate-limit helper/middleware pattern used by other Campaign Manager modules and apply it here).

## 3. Negative RLS test (recommended before release)

Only positive-path RLS was confirmed live (the seeded test user reading their own workspaces). To prove workspace isolation, create a second real Supabase user with no membership in the seeded workspaces, sign in as them, and confirm every `/app/seo/*` route and the `/api/seo/export` endpoint returns no data / a 403 for that user against the seeded workspace's `site_id`.

## 4. Connect real data sources (out of scope by design — this is on you, not a gap)

Per your original brief: *"Remember the user sets up webhooks and integrations with their own details — we don't set up for them."* This build only defines the `seo_source_connections` data model and seeds demo "connected" rows. To get real data flowing:
1. Decide which of the supported providers you actually want live first (Google Search Console is the obvious starting point — it's free and has the richest keyword/ranking data).
2. Build (or ask for) the OAuth connect flow for that provider, following the same pattern as the existing `/api/integrations/*` routes already in this codebase (Stripe, Xero, Google Calendar, etc. all have working callback routes you can copy).
3. Once a real connection exists, replace the `internal_tracker`/`manual` demo rows in `seo_source_connections` for that site with the real connection, and point a scheduled job at the provider's API to populate `seo_site_daily`, `seo_keyword_rankings`, etc. on a cadence.

## 5. Feature gaps to close before calling any sub-tab "done" (see per-page docs for detail)

| Sub-tab | Gap |
|---|---|
| Briefs | Detail page (`/app/seo/briefs/[id]`) is read-only — no outline editing, no status transitions, no posting a new comment. |
| Rankings | "Breakdown" view only implements the Intent dimension; the design implies ~8 dimensions (device, country, cluster, landing page, SERP feature, competitor, etc.). |
| Local | `AddLocationWizard` doesn't collect coordinates, so new locations won't appear on the map until geocoded some other way. No real listing-directory sync (Google Business Profile, Bing Places, Apple Maps, Facebook). |
| AI Search | "Prompt Brief" and "Data Freshness" explainer cards from the design reference weren't built. No worker exists to actually run a first check when a prompt is newly tracked — it sits at `citation_status: 'unknown'` until you build that. |
| Keywords | No CSV bulk-import wizard (only paste-multiple-lines). No inline edit for owner/status. Favourite star is currently display-only (no toggle). |

## 6. Testing gaps

- No integration tests (real Supabase reads/writes) or E2E tests exist for this module — only pure-function unit tests (`npm test`, 94 passing). If you have an existing E2E setup elsewhere in the repo, extend it here; if not, that's a larger decision (which framework) worth making deliberately rather than bolted on.
- No load test was run against the export endpoint's up-to-5,000-row queries.

## 7. Housekeeping

- `src/components/fox-ai/tabs/AgentTab.tsx` is a placeholder stub added only to unblock the build (a different, pre-existing bug unrelated to SEO — a file was missing that the shared layout imports). It says "Agent mode is coming soon" and does nothing else. Build the real Agent tab, or remove the reference to it, when you get to that feature.
- `supabase/migrations/20260829000200_fix_workspace_members_recursion.sql` was written by an earlier session but never applied until now. It fixed an app-wide bug (every authenticated request against any workspace-scoped table was failing). Worth a broad regression pass across the rest of the app (not just SEO) now that it's live, since it changes how every module resolves workspace membership.


---

## Update — 2026-09-16

Closed since the original list: browser QA (done live at desktop, tablet and mobile), the Keywords favourite toggle, and keyword bulk edits.

### Still to do

1. **Map tiles for production (required before public release).** The Local map defaults to `tile.openstreetmap.org`. That is fine for development, but the OSM tile usage policy doesn't allow production app traffic. Pick a tile provider (for example MapTiler, Stadia or Mapbox raster tiles), then set these in Vercel:
   - `NEXT_PUBLIC_MAP_TILE_URL`, e.g. `https://api.maptiler.com/maps/dataviz-light/{z}/{x}/{y}.png?key=YOUR_KEY`
   - `NEXT_PUBLIC_MAP_TILE_ATTRIBUTION`: the attribution text your provider requires.
2. **Regression-check audit logging app-wide.** Before this fix, `src/lib/audit.ts` never wrote a row (wrong column names). It now writes for every existing caller (11 files). Use a few non-SEO features (billing, team invites and so on), then check that the new `audit_logs` rows have sensible `action` and `resource_type` values.
3. **Negative RLS test.** Create a second Supabase user with no membership in workspace `d7b7c61e-7685-4b15-8a0c-d9fa85f25103`, sign in, and confirm that no `/app/seo/*` route and no `/api/seo/export` call shows data from that workspace.
4. **Rate limiting** on `addKeywords`, `createBrief`, `addLocation`, `trackPrompt`, `createOutreachList`, `updateKeywordsBulk` and `/api/seo/export`, using whichever limiter the rest of the app standardises on.
5. **Click through the remaining wizards live:** Add Keywords, Create Brief, Add Location, Track Prompts and Add Outreach List. Confirm the new row appears after submit.
6. **Marketplace owner:** another session left two marketplace files syntactically broken, which stopped the dev build. They got minimal repairs so the build could run: `src/app/app/marketplace/discover/services/page.tsx` and `src/components/marketplace/module/ProfileCards.tsx`. Whoever owns that work should confirm the repairs match what they intended.
