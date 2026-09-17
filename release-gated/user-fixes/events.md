# Events — Manual Actions Required

Things I could not complete from here, with exact steps.

---

## 1. Official Gala Dock logo assets — DONE (2026-09-16)

Supplied as `public/gala dock logo.png` and `public/gala favicon.png`. Trimmed
copies live at `public/brands/gala-dock/gala-dock-logo.png` (lockup) and
`gala-dock-icon.png` (mark), used by `GalaDockLogo` / `GalaDockMark` in
`src/components/events/GalaDockPromotion.tsx`. The SVG stand-ins were removed.
Verified in all placements: overview, events side card, webinars, podcasts,
sponsorships banner and footer, follow-up.

---

## 1b. Supply the Gala Dock product screenshot for the Webinars banner (5 minutes)

**Why:** the approved Webinars image shows a Gala Dock dashboard/phone mockup on
the right of the banner. No such asset exists in the repo, and inventing a fake
product UI would misrepresent Gala Dock.

**Steps:** save it as `public/brands/gala-dock/gala-dock-dashboard.png` (transparent
background, ~620×280) and ask for it to be placed in the `wide-reverse` variant of
`src/components/events/GalaDockPromotion.tsx`.

---

## 2. Confirm the Gala Dock destination URL (2 minutes)

**Why:** `GALA_DOCK_MARKETING_URL` in `GalaDockPromotion.tsx` is set to
`https://galadock.com`. I could not verify that this is the correct production
destination, and the "See How It Works" secondary CTA appends `/how-it-works`.

**Steps:** confirm both URLs resolve, or change the constant. The CTA already
opens in a new tab with `noopener noreferrer` and is tracked through the
existing analytics action.

---

## 3. Cross-workspace RLS negative test (15 minutes, needs a second account)

**Why:** I verified server-side scoping by reading the code path (every query
filters `workspace_id`, and `getEventsPageContext` 404s a non-member before any
record loads). I could **not** run the live negative test, because this
environment has one real user.

**Steps:**
1. Create a second Supabase user and a workspace they own.
2. Sign in as that user and request a first user's event directly, e.g.
   `/brand/events/events/<event-id-from-the-demo-workspace>`.
3. Expect a 404 (not a 403, and not an empty shell).
4. Repeat for `/events/webinars/<id>`, `/events/podcasts/<id>`,
   `/events/sponsorships/<id>`.
5. Repeat against the export endpoint:
   `/api/events/export?resource=events&workspaceType=brand`.

---

## 4. Connect a webinar / podcast provider to exercise sync (30 minutes)

**Why:** provider capability handling is implemented and gated, but no live
provider is connected here, so "Average Watch Time" and recording states read
from stored values rather than a live sync.

**Steps:** connect a provider under `/{type}/integrations`, then confirm the
Webinars KPI strip shows provider-reported watch time and that a webinar with
read-only provider scope does **not** offer write actions.

---

## 5. Decide the demo-data policy for production (5 minutes)

**Why:** the five new migrations seed the Brand demo workspace only (guarded on
slug `jamahl-thomas-campaign-manager-demo`), and every row is `is_demo = true`.
They are safe to ship, but if you do **not** want demo data created on a fresh
production database, exclude the five `20260916000*_events_demo_*.sql` files
from the production migration path.

---

## 6. Pre-existing breakage outside Events (not mine)

`src/components/campaigns/CampaignBoard.tsx` imports `BOARD_COLUMN_FOR`, which
its source module does not export, so a full `npx tsc --noEmit` fails on that
file. It is uncommitted work in the Campaigns module that predates this task —
I did not touch it. Events itself typechecks clean. Worth fixing before a
production build, since `next build` will fail on it.
