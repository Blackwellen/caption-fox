# Sidebar navigation correction — 17 September 2026

Scope: canonical sidebar destinations and the permanent developer lock. No shell styling, top-bar layout or module content was changed.

- All marketing-workspace menu links now use their approved `/{workspaceType}/{section}` route. Legacy implementations remain behind the guarded route bridge, with child paths and query parameters preserved.
- Leads & Audiences resolves to its own section rather than Strategy's audience research tab.
- Supplier Earnings & Payouts uses `/supplier/earnings`, which redirects to the existing payouts implementation.
- Business retains the 15 approved core entries and six defined entitlement-controlled extensions. Creators & UGC remains in Brand and Agency, as specified by the supplied menu contract.
- Added `SIDEBAR_NAVIGATION_LOCK.md` and linked it from AGENTS.md, CLAUDE.md and the shell design lock.

Validation: 360 tests passed; targeted ESLint passed; diff whitespace check passed. Chrome MCP inspected actual sidebar labels and destinations in the development harness for Creator (10), Business Team (20, with Advertising denied by its existing entitlement), Brand (24), Agency (28), Supplier (14), Admin (13), Affiliate (8). The full approved menus were present in the rendered shell. No authenticated end-to-end module audit was performed.

The production build compiled successfully; the session was interrupted during TypeScript checking when the user requested the push. Final build completion is not claimed for this change.
