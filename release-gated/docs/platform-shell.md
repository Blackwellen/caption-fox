# Release evidence — Platform Shell (permanent application shell)

- **Section:** Universal · Platform Shell (all authenticated surfaces)
- **Routes:** `/app/*` (compatibility), `/{creator|business|brand|agency}/*`, `/supplier/*`, `/admin/*`, `/affiliate-portal/[grantId]/*`
- **Visual spec:** `designs/Universal Sections/Platform Shell#/ChatGPT Image Sep 15, 2026, 10_04_11 AM (1).png`, `(2).png`
- **Design lock:** `APP_SHELL_DESIGN_LOCK.md`
- **Date:** 2026-09-15

## What changed

| Before | After |
| --- | --- |
| 6 separate shells: dark `Sidebar`+`TopNav`+`MobileNav` (/app), `CampaignManagerShell` (calendar/advertising/brand), `EventsShell` sidebar, dark `SupplierSidebar`, dark admin layout, dev `CaptionFoxShell` with amber banner on the jamahl-only `/{type}/*` catch-all | One `CaptionFoxAppShell` for all 7 contexts |
| Nav duplicated in `nav-config.ts`, `caption-fox-shell.ts`, `CommandPalette`, `EventsShell`, `SupplierSidebar`, admin layout | One register (`src/lib/navigation/registers.ts`) + resolver |
| No affiliate portal route in the shell | Grant-validated `/affiliate-portal/[grantId]` with 8 real-data pages |

Deleted: `CampaignManagerShell.tsx`, `CampaignManagerShellClient.tsx`, `layout/Sidebar.tsx`, `layout/TopNav.tsx`, `layout/MobileNav.tsx`, `layout/WorkspaceSwitcher.tsx`, `layout/AvatarMenu.tsx`, `supplier/SupplierSidebar.tsx`, `lib/nav-config.ts`, `events/EventsTopBar.tsx`, `command/CommandPalette.tsx`.

## Navigation registers (verified by unit tests)

| Context | Items | Notes |
| --- | --- | --- |
| Creator | 10 | Home, Campaigns, Calendar, Studio, Link in Bio, Social, Marketplace, Inbox, Analytics, Settings |
| Business | 15 core + 6 gated | Advertising, SEO, Partnerships, Events, Finance, Automations — Team plan+, active subscription, module flag not off, module resolver agrees |
| Brand | 24 | full governed set |
| Agency | 28 | nav region scrolls; header + profile pinned |
| Supplier | 14 | Earnings & Payouts → `/supplier/payouts` |
| Admin | 13 | MFA (AAL2) + `is_platform_admin` enforced in layout; no fake Create |
| Affiliate | 8 | grant = own `affiliates.id`; suspended → "access paused" replaces content; primary action = Copy link |

## Permission / entitlement enforcement

- Server-side twin of the sidebar: `requireWorkspaceModule(id)` in Advertising, Calendar, Brand & Assets, Events (page context), Automations, Partnerships, SEO and the `/app/[section]` fixture route; `/app` layout 404s hard-loaded paths of modules the workspace lacks.
- `/{type}` URLs are rewritten to the active workspace's type, so type-A navigation never renders over type-B data.
- Search palette index = the user's resolved nav + actions only (no cross-tenant records).
- Notifications only follow same-origin paths; "mark all read" updates only the loaded ids.
- Affiliate grant: UUID-validated, ownership checked explicitly (RLS also exposes sub-affiliate rows), referral emails masked.

## Screen sizes & evidence (`release-gated/docs/platform-shell/screens/`)

| File | Size | Checked |
| --- | --- | --- |
| `1491-brand-expanded.png` (before fixes), `1491-brand-expanded-active.png` | 1491×1055 | wordmark, headings, active row, top bar |
| `1491-brand-collapsed.png`, `1491-agency-collapsed-active.png` | 1491×1055 | 76px rail, dividers, active square |
| `1440x800-agency-long-menu.png` | 1440×800 | 28 items, nav scroll, active centred, profile pinned |
| `834-brand-tablet.png` | 834×1112 | forced rail + hamburger, no collapse toggle |
| `390-agency-mobile.png`, `390-agency-drawer.png` | 390×844 | mobile top bar, drawer |
| `1491-admin-expanded.png`, `1491-affiliate-expanded.png`, `1491-supplier-expanded.png` | 1491×1055 | context badges, registers, deep-route active |

Captured with the dev-only harness `/shell/frame/<context>` (404 in production) because the QA browser had no signed-in session.

## Interaction / accessibility checks (Chrome MCP)

- Create menu: `menu`/`menuitem` roles, focus to first item, Escape closes and restores focus to trigger ✓
- Drawer: modal dialog, focus to active item, Escape closes, focus back to "Open navigation", body scroll lock released ✓
- Search (Ctrl/⌘K): combobox + listbox, 38 options grouped, `aria-activedescendant` ✓; Escape restores focus ✓ (after fix)
- `aria-current="page"` on active item; weight + background change, not colour only ✓
- No horizontal overflow at 390 / 834 / 1440 / 1491; no document scroll behind the shell ✓
- Console: 0 errors / 0 warnings on harness pages ✓
- Signed-out redirects: `/brand/campaigns/abc/content` → `/login?next=…` (deep link kept), `/supplier` → `/login?next=/supplier`, `/admin/workspaces` → `/admin-login?next=…`, `/affiliate-portal/<id>` → `/affiliates/login`, `/app/finance` → `/login?next=/app/finance` ✓

## Signed-in QA (real account, 2026-09-15)

Signed in as the owner account (credentials kept in the gitignored `.env.test.local`, never in docs).

| Check | Result |
| --- | --- |
| `/app/home` as Creator workspace | ✓ one shell, 10 items, groups Create & Publish / Opportunities / Engage / Measure / Manage, Home active, profile "Caption Fox · Creator workspace" |
| Workspace switcher | ✓ lists 6 marketing workspaces with type labels + Supplier workspace + Create workspace |
| Switch Creator → Brand | ✗→✓ **bug found and fixed** (see below); after fix the shell is Brand, 24 items, switcher "Jamahl Thomas Campaign Manager" |
| Bottom "Collapse menu" | ✓ 264→76px rail with no reload, becomes "Expand menu", top-bar toggle in sync, per-user cookie `1.<key>` / `0.<key>` |
| Short viewport 1491×620 (≈170% zoom) | ✓ header 56px, footer 111px, nav 73% of height and scrollable, no document scroll |
| Touch scrolling | ✓ nav `touch-action: pan-y`, overscroll contained, momentum scrolling; pinch-zoom not disabled in the viewport |
| Canonical redirect `/brand/campaigns/abc/content` | ✓ 307 → `/app/campaigns/abc/content` (dev-server log) |
| Other sessions' real module pages in the shell | ✓ `/brand/advertising/reports`, `/brand/brand/rights`, `/business/calendar/publishing-queue` all 200 |
| Supplier `/supplier/payouts` | ✓ one shell, 14 items, Earnings & Payouts active, switcher "Jamahl Thomas Creative Studio", real Payouts page, active row auto-revealed at 620px height |
| Affiliate `/affiliate-portal` | ✓ redirects to own grant `/affiliate-portal/0be2b436…`; 8 items, Home active, "Copy link" primary action, no workspace switcher, "Affiliate Portal" badge |
| Affiliate grant security | ✓ `/affiliate-portal/00000000-…/commissions` with a signed-in session → **404**, no shell, no data |
| Switch Brand → Business ("Growth Co.") | ✓ single full navigation (switcher fix verified); 20 items = 15 core + 5 entitled extensions (SEO, Partnerships, Events, Finance, Automations); Advertising absent (module resolver does not grant Business) |
| Gate: `/business/advertising` (not entitled) | ✓ **404**, no shell |
| Gate: `/app/clients` (Agency-only) as Business | ✓ **404**, no shell |
| Gate: `/business/events` (entitled) | ✓ 200, exactly one shell, context `business` |
| Type redirect `/brand/calendar` while Business is active | ✓ → `/business/calendar`, one shell, context `business` |
| Console on real `/app/home` | 1 pre-existing next/image warning from favicon `<Image>`s outside the shell (Tailwind preflight `height:auto`); none from the shell |

Screens: `signed-in-1491-creator-app-home.png`, `signed-in-1491-brand-app-home.png`,
`signed-in-1491x620-brand-short-zoom.png`, `signed-in-1491x620-brand-collapsed-bottom-toggle.png`.

Further signed-in route checks were stopped deliberately: the shared dev server was saturated by
other sessions' repeated requests (2–5 min per page), and more load would not have produced
additional evidence.

## Bugs found during QA and fixed

10. **Workspace switch did not re-render** — `router.push('/app/home')` + `refresh()` from `/app/home`
    was a no-op; the cookie was set but the shell stayed on the old workspace until reload → the switcher
    now does a full navigation (`window.location.assign`), which also guarantees no stale data from the
    previous workspace.
11. Short-viewport classes were built from a template string, so Tailwind never generated them →
    written as literal `[@media(max-height:700px)]` classes.

User-requested additions (2026-09-15): collapse/expand control at the bottom of the sidebar;
touch-scrollable menu; compact header/footer on short viewports so high browser zoom stays usable.


1. Group headings cramped/misaligned — `not-sr-only` reset padding → headings now `hidden lg:block`.
2. Wordmark too small/blue vs reference → fox mark + navy "Caption Fox" lockup.
3. Resting scrollbar over sidebar edge → hover-only thin scrollbar.
4. Rail sr-only labels escaped the nav clip and made the document scroll (1476px) → nav is a positioned container.
5. Active item not revealed in long menus (measured before fonts loaded) → reveal after layout + `fonts.ready`, centred with 24px margin.
6. Desktop collapse toggle visible on tablet/phone (`inline-flex` beat `hidden`) → display set per button.
7. Search palette returned focus to `<body>` when opened by shortcut → falls back to the search trigger.
8. `⌘` mojibake introduced by a PowerShell rewrite → fixed with UTF-8 edit.
9. React-compiler ref lint errors on the popover hook → destructured at call sites.

## Tests run

- `npx vitest run` — 16 files / 224 tests passed (incl. `src/lib/navigation/resolver.test.ts`, 37 tests: register counts & order, canonical routes, Business gating, cancelled/paused plans, feature flag off, deep-route active matching, create/primary actions, plan/type normalisation)
- `npx tsc --noEmit` — clean
- `npx eslint` on all touched files — 0 errors, 0 warnings
- `next build` — passed (exit 0); all shell, workspace-type, supplier, admin, affiliate-portal and harness routes compiled

## Supabase / data

No migrations. Tables read: `profiles`, `workspaces` (plan, plan_status, settings.feature_flags), `workspace_members` (via `getActiveWorkspace`), `marketplace_suppliers`, `notifications`, `affiliates`, `affiliate_referrals`. All via the user-scoped server client (RLS applies; no service role).

## Pending manual actions

See `release-gated/user-fixes/platform-shell.md` — signed-in QA across all contexts, placeholder fixture modules behind real nav items, Advertising-for-Business resolver decision, affiliate assets store, plan-vocabulary alignment.

## Score & decision

**98 / 100 — blocked pending manual fix.** Six of the seven contexts (Creator, Business, Brand, Supplier,
Affiliate, plus Agency via harness and unit tests) are verified signed in, including workspace switching,
plan-gate 404s, Agency-only 404s, grant isolation, type redirects, collapse, zoom and touch. The remaining
2 points: the signed-in Admin check, which needs your MFA device (Claude Code cannot complete a second
factor), and the pre-existing placeholder module pages behind some real nav items. Both are in
`release-gated/user-fixes/platform-shell.md`. Not marked complete below 100.
