# Caption Fox Application Shell — Design Lock

The white Caption Fox application shell is a **permanent, approved UI primitive**.
It frames every authenticated surface: Creator, Business, Brand, Agency and Supplier
workspaces, Platform Admin, and the Affiliate Portal.

- Visual source of truth: `designs/Universal Sections/Platform Shell#/*.png`
- Implementation: `src/components/shell/app-shell/` (root: `CaptionFoxAppShell.tsx`)
- Navigation source of truth: `src/lib/navigation/registers.ts` + `resolver.ts`
- Tokens: `--color-shell-*` / `--shadow-shell-*` in `src/app/globals.css`
- Tests: `src/lib/navigation/resolver.test.ts` (register counts, routes, gating, active matching)

## Locked geometry

| Element | Value |
| --- | --- |
| Expanded sidebar | 264px, white, 1px `#E1E8F2` right border |
| Collapsed rail | 76px (also forced at 768–1023px) |
| Top bar | 72px desktop / 60px mobile, white, 1px bottom border, sticky (non-scrolling) |
| Nav row | 40px, 10px radius, 18px icon, 14px label |
| Active row | `#EEF5FF` background, `#1769FF` icon + label, semibold, `aria-current="page"` |
| Group label | 11px uppercase, 0.08em tracking, `#7888A3` |
| Primary action | 40px, 10px radius, `#1769FF` |
| Canvas | `#F8FAFD` |

The logo header and the bottom profile block are fixed; only the navigation list scrolls
(mouse wheel, trackpad or touch — `touch-action: pan-y`, overscroll contained).
Collapse/expand is available in two places on desktop: the top-bar toggle and a "Collapse menu"
row at the bottom of the sidebar (an expand icon with tooltip when minimised).
On short viewports (≤700px tall — landscape phones, laptops at 150–200% browser zoom) the logo
header compacts to 56px and the footer tightens so the menu keeps most of the height.
Pinch-zoom is never disabled (no `maximumScale`/`userScalable` in the viewport).
Below 1024px the sidebar becomes a focus-trapped drawer; it is never horizontally compressed.

## Changes that require explicit design approval

- sidebar width, background or border
- top bar height, background or structure
- logo position or treatment (real brand asset, always on white)
- expanded/collapsed architecture
- global search position
- workspace/context switcher position
- notification / help / avatar placement
- active navigation visual treatment
- section-label treatment
- shell borders and shadows
- mobile navigation architecture

## What normal feature work MAY change

- the content area (everything below the top bar and right of the sidebar)
- page headers and module-local navigation (tabs, sub-navigation, view switchers)
- context actions inside a page
- authorised global navigation — **only** by editing the canonical registers and updating the tests
- search scope, primary action label/action, user/context data

## Rules for feature work

1. Pages render inside the shell. They must not set body backgrounds, resize the sidebar,
   change the top bar, hide the logo, add a second global navigation or create another app frame.
2. The persistent sidebar lists section landing areas only. Sub-tabs, record detail pages and
   wizards never become sidebar items.
3. Sidebar visibility is not authorisation. Every gated module also calls
   `requireWorkspaceModule(<id>)` server-side so direct URLs match the sidebar.
4. Do not let automated refactors restyle or reinterpret the shell.
