# Sidebar navigation — permanent development contract

The user reconfirmed this menu on 17 September 2026. Preserve it in every workspace. Feature implementation, cleanup and automated refactoring must not remove, rename, reorder, regroup or replace these entries, change their canonical destinations, or substitute a module's local tabs for the global menu. Changes require an explicit user request.

The sole production register is `src/lib/navigation/registers.ts`. Desktop, collapsed rail and mobile drawer must render the same resolved register. Do not derive global navigation from the development fixtures in `src/lib/shell/caption-fox-shell.ts`, the current page, or whichever modules happen to be complete.

## Approved menus

- Creator (10): Home; Campaigns; Calendar; Studio; Link in Bio; Social; Marketplace; Inbox; Analytics; Settings.
- Business (15 core): Home; Strategy; Campaigns; Calendar; Studio; Brand & Assets; Link in Bio; Social; Messaging; Web & Conversion; Marketplace; Inbox; Leads & Audiences; Analytics; Settings.
- Business extensions: Advertising; SEO & Discovery; Partnerships; Events; Finance; Automations. Show only when the existing module entitlement grants access. Do not remove these definitions when a plan or role hides them.
- Brand (24): Home; Strategy; Campaigns; Calendar; Studio; Brand & Assets; Link in Bio; Social; Advertising; Messaging; Web & Conversion; SEO & Discovery; Creators & UGC; Marketplace; Partnerships; PR & Reputation; Community; Events; Inbox; Leads & Audiences; Analytics; Finance; Automations; Settings.
- Agency (28): Home; Clients; Strategy; Campaigns; Calendar; Studio; Brand & Assets; Shared Templates; Social; Advertising; Messaging; Web & Conversion; SEO & Discovery; Creators & UGC; Marketplace; Partnerships; PR & Reputation; Community; Events; Inbox; Leads & Audiences; Client Approvals; Analytics; Finance; Client Reports; Automations; Agency Operations; Settings.
- Supplier (14): Dashboard; Shopfront & Profile; Listings & Packages; Requests & Opportunities; Quotes; Orders; Deliveries; Messages; Availability; Reviews & Reputation; Disputes; Earnings & Payouts; Analytics; Settings.
- Admin (13): Dashboard; Workspaces; Users; Marketplace Operations; Plans & Billing; Content, AI & Safety; Connections & Webhooks; Automation Operations; Support & Disputes; Compliance & Data; Flags & Releases; Platform Analytics; Audit & System.
- Affiliate (8): Home; Programme; Links & Codes; Assets; Conversions; Commissions; Support; Profile.

## Route wiring

Sidebar links use their canonical `route`, including `/{workspaceType}/home`, `/{workspaceType}/audiences`, `/agency/shared-templates`, `/agency/operations` and `/supplier/earnings`. Affiliate destinations remain scoped to the validated grant ID.

Keep implementation mappings separate in `workspaceImplementationHref`. The canonical catch-all redirects legacy modules to their existing implementation, preserving child paths and query parameters. Keep compatibility URLs in active-state matching and in `appPathModule` permission checks. Never point Leads & Audiences at Strategy's audience-research tab.

Existing server authentication, workspace membership, plan, role, admin-elevation and affiliate-grant checks must remain enforced. Fix a missing destination in routing; do not hide its approved sidebar entry as a shortcut. Incomplete module contents are a separate implementation task, not permission to prune the sidebar.

Run the navigation tests after any routing change. They protect exact menu labels/counts, canonical destinations, active states, Business gating and compatibility-route guards. For browser checks, `/shell/frame/{context}` is the development-only harness using the real shell; it does not prove authenticated module functionality.

Visual geometry, top bar and page content remain governed by `APP_SHELL_DESIGN_LOCK.md` and are outside this navigation-only correction.
