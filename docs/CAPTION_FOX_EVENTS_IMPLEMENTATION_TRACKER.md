# Caption Fox — Events Module Implementation Tracker

Six canonical routes, one shared implementation, verified against the six
approved references in `docs/ui-verification/caption-fox/events/`.

- **Reference viewport:** the approved images are `1448 × 1086`, so all
  comparison screenshots are captured at 1448 × 1086 (not 1491 × 1055 — the
  supplied images measure 1448 wide).
- **Workspace used for verification:** Brand demo workspace
  `jamahl-thomas-campaign-manager-demo` (`d7b7c61e…`), signed in as the owner.
- **Route segment:** `/brand/events/*`. The same implementation serves
  `creator`, `business` and `agency` via the entitlement resolver.

## Status key

`Not Started` · `Audited` · `In Progress` · `Code Complete` · `Visual Review` ·
`Functional Review` · `Failed` · `Passed` · `Production Ready`

## Routes

| ID | Route | Page/View | Reference | Shell | Visual Match | Real Data | Gala Dock Ad | Search | Filters | Cards | Table | Calendar | Timeline | Board | Pipeline | Charts | CRUD | Registrations | Run of Show | Sponsorships | Follow-up | Export | Permissions | Activity | Loading | Empty | Error | Responsive | Chrome MCP | Screenshot Compared | Tests | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 5.18.01 | `/{type}/events` | Overview | overview-reference.png | Pass | Close | Pass | wide banner | Pass | Pass | Pass | Pass | Pass | Pass | n/a | n/a | Pass | via wizard | Pass | Pass | KPI link | KPI link | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Passed | KPI band + banner align to reference rows |
| 5.18.02 | `/{type}/events/events` | Directory | events-reference.png | Pass | Close | Pass | tall side card | Pass | Pass | Pass | Pass | Pass | Pass | n/a | n/a | Pass | Pass | Pass | Pass | column | KPI link | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Passed | Two-row filter block matches reference |
| 5.18.03 | `/{type}/events/webinars` | Webinars | webinars-reference.png | Pass | Close | Pass | wide + 2 CTAs | Pass | Pass | Pass | Pass | Pass | Pass | n/a | n/a | Pass | Pass | Pass | Pass | n/a | KPI link | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Passed | Attendance trend bridges days with no webinar |
| 5.18.04 | `/{type}/events/podcasts` | Podcasts | podcasts-reference.png | Pass | Close | Pass | wide banner | Pass | Pass | Pass | Pass | Pass | Pass | n/a | n/a | Pass | Pass | n/a | Pass (offsets) | slots | KPI link | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Passed | Listener series is daily, not episode totals |
| 5.18.05 | `/{type}/events/sponsorships` | Sponsorships | sponsorships-reference.png | Pass | Close | Pass | wide + footer | Pass | Pass | Pass | Pass | n/a | Pass | n/a | Pass | Pass | Pass | n/a | n/a | Pass | KPI link | Pass | Pass (financials) | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Passed | Financial fields gated by `sponsorships.viewFinancials` |
| 5.18.06 | `/{type}/events/follow-up` | Follow-up | follow-up-reference.png | Pass | Close | Pass | wide banner | Pass | Pass | Pass | Pass | n/a | Pass | Pass | n/a | Pass | Pass | n/a | n/a | n/a | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Passed | Board drag-and-drop has a keyboard/status-menu alternative |

## Known, deliberate deviation from the references

The approved designs show the six Events pages as **sidebar sub-items**. The
Caption Fox sidebar is design-locked (`APP_SHELL_DESIGN_LOCK.md`; nav changes
only via `src/lib/navigation/registers.ts`, and sub-tabs never go in the
sidebar), so the module keeps a local tab row instead — the same pattern every
other Caption Fox module uses (`AdvertisingSubNav`, `CampaignsSubNav`, …).

That row costs ~70px of vertical space, so the whole content block sits ~70px
lower than in the reference images. Everything **inside** the content block was
measured and matched:

| Band | Reference | Implementation |
|---|---|---|
| H1 | ~23px | 23px |
| KPI card height | 104px | 104px |
| KPI → banner gap | 16px | 16px |
| Gala Dock banner height (overview) | 107px | 107px |
| Banner → panel row gap | 13px | 14px |
| Overview panel row | 409 / 352 / 376 | same ratio |
| Content column width | 1164px | 1142px (locked shell gutter) |

## Verification evidence

| Artefact | Path |
|---|---|
| Approved references (unmodified) | `docs/ui-verification/caption-fox/events/*-reference.png` |
| Implementation screenshots | `docs/ui-verification/caption-fox/events/*-implementation.png` |
| Native-pixel comparison stacks | `docs/ui-verification/caption-fox/events/overview-stack-*.png` |
| Unit tests | `src/lib/events/__tests__/events.test.ts` (14 tests) |
