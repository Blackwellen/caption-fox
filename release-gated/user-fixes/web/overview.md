# Manual/user actions — Web & Conversion Overview

These are the items Claude Code could not complete automatically for `/app/web` this phase. Exact steps below.

## 1. Unblock Chrome MCP for visual verification (required before release)

The `chrome-devtools-mcp` server reported:

```
The browser is already running for C:\Users\PC\.cache\chrome-devtools-mcp\chrome-profile.
Use --isolated to run multiple browser instances.
```

This means another Chrome instance already holds the lock on that profile directory — for safety, no attempt was made to force-close it, since that profile may belong to a different active session and killing arbitrary `chrome.exe` processes could destroy someone else's unsaved work.

**To unblock, do one of:**
- Close whatever Claude Code session (or standalone `chrome-devtools-mcp` process) currently has that profile open, then ask Claude to re-run the Chrome MCP visual check.
- Or, if you know it's safe, manually end the process holding `C:\Users\PC\.cache\chrome-devtools-mcp\chrome-profile` and ask Claude to retry.

**Once unblocked, ask Claude to:**
1. Log in to the `Jamahl Thomas Growth Co.` demo workspace (`jamahlthomas1996@gmail.com`, workspace id `173b63f8-3263-4609-a4f7-c6e113f25bda`) — demo data is already seeded there (6 pages, 6 forms, 5 funnels, 4 experiments, 6 tracking events, 8 destinations, 30 days of metrics).
2. Navigate to `/app/web` and resize to 1440, 1280, 1024, tablet and mobile widths, taking a screenshot at each.
3. Compare against `designs/Web & Conversion/ChatGPT Image Aug 29, 2026, 02_21_30 PM (1).png` and note/fix any visual drift.
4. Check the browser console for errors/warnings and the Network tab for failed requests.

## 2. Decide whether Creator workspaces should get Web & Conversion

Right now `/app/web` is visible in the sidebar for `small_business`, `brand` and `agency` workspaces but not `creator` (the `workspaceNavAllowlist.creator` entry in `src/components/layout/Sidebar.tsx` does not include it — Creator workspaces already have `/app/links` for link-in-bio pages, which was the working assumption). If Creator workspaces should also get Pages/Forms/Funnels, tell Claude and it's a one-line allowlist change plus an entitlement review.

## 3. Confirm the plan-gating decision for Experiments and Tracking

Experiments and Tracking are currently gated to the `team` plan and above (mirroring how Messaging gates Journeys/WhatsApp/RCS to Team). This was a reasonable default, not a decision from you — confirm it matches your actual pricing/packaging plan, or tell Claude the correct plan tier.

## 4. Review the two-proportion z-test threshold

Experiment confidence only displays once each arm (control/variant) has reached 100 visitors — below that, the UI shows "Collecting data" rather than a number. If your actual minimum-sample-size policy differs, tell Claude the number you want and it's a one-line change in `computeExperimentStats` (`src/lib/web/data.ts`).

## 5. Remaining phases are not yet built

Pages, Forms, Funnels, Experiments and Tracking each need their own full implementation pass (builder/canvas UIs, submission handling, destination delivery, deterministic visitor assignment, etc.) — see `docs/CAPTION_FOX_WEB_CONVERSION_IMPLEMENTATION_TRACKER.md` for the phase plan. Nothing to do here yet except confirm the phase order is still what you want.
