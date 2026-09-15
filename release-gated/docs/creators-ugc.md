# Creators & UGC — Release Evidence

Section: Creators & UGC module (6 routes + 5 detail routes)
Routes: `/app/creators`, `/app/creators/creators` (+ `/[id]`), `/app/creators/briefs`
(+ `/[id]`), `/app/creators/submissions` (+ `/[id]`), `/app/creators/rights`
(+ `/[id]`), `/app/creators/payments` (+ `/[id]`), `/app/creators/export`.
Old `/app/ugc*` routes now redirect to their equivalents.

## 1. What was built

- **`src/lib/creators/`** — one canonical data/domain layer for all six surfaces,
  mirroring the Campaigns module's architecture: `constants.ts` (relationship,
  brief, submission, rights and payment vocab, every status with a badge-tone and
  a validated state-transition table), `types.ts` (row shapes), `entitlements.ts`
  (a `canAccessCreatorModule` resolver combining role permission + workspace type
  + plan rank, a `resolveMode()` that distinguishes buyer-manager / agency /
  creator-self-service / read-only so buyer-facing sourcing screens are never
  forced onto a Creator workspace, and a `creatorCapabilities()` object every
  button reads from), `query.ts` (URL query-state parser/builder for all five
  list surfaces), `data.ts` (every KPI/aggregate/chart query — real Supabase
  reads, period-over-period deltas, a rights-conflict detector derived from
  actual rights/campaign/submission state rather than a manually set badge),
  `server.ts` (`getCreatorSession` / `requireCreatorModule` route guard).
- **`/app/creators`** (Overview) — KPI strip with sparklines, top-creator
  performance table (reach/engagement/approval-rate/earnings computed from real
  submissions and paid payments), briefs-summary list, rights & payments
  snapshot, submission workflow distribution, campaign performance trend,
  recent activity feed.
- **`/app/creators/creators`** — table/cards views, full filter set (niche,
  audience band, platform, region, availability, status, rights readiness,
  owner, saved-sort), featured/shortlist panel, per-row action menu (shortlist
  toggle, add to list, archive/restore), detail profile page.
- **`/app/creators/briefs`** — board/table/timeline views, a real Kanban board
  (status-menu driven, transitions validated against `BRIEF_TRANSITIONS`),
  status donut, upcoming-deadlines panel, per-creator progress tracked
  separately from the brief-level status.
- **`/app/creators/submissions`** — gallery/table/board views, a full review
  workspace (signed-URL media preview, version history, review history,
  flagged-issue list distinguishing automated-vs-confirmed, approve / request
  changes / reject actions each gated by the enforced `SUBMISSION_TRANSITIONS`
  lifecycle), bulk-approve with confirmation.
- **`/app/creators/rights`** — table/cards/calendar views, licence expiry
  tracking, rights-coverage and status-distribution donuts, a conflict detector
  surfacing expired-in-active-campaign / missing-agreement / unsigned-agreement
  / unapproved-submission-version / campaign-beyond-expiry cases with severity
  and record counts.
- **`/app/creators/payments`** — table/cards/timeline views, payment-eligibility
  checking (creator payout readiness, invoice/tax state, approval state) before
  a payment can join a batch, idempotency-keyed payout-batch creation, spend-
  by-campaign and payment-method-usage panels.
- **Multi-step wizards** (`WizardShell.tsx`) — Create Brief (basics → channels/
  budget/rights → deliverables → creators → review), Add Rights Record
  (creator & asset → scope/coverage → permissions/agreement → review), Create
  Payment Batch (select eligible payments → batch details → review), each with
  per-step validation gating Next and a review step summarising every field
  before submit. Invite Creator, Add Creator and Send Usage Request were
  deliberately kept as single-step modals — 3–8 fields did not warrant a
  wizard.
- **Responsive tab rule** (`src/components/ui/ResponsiveTabs.tsx`) — applied to
  the six-tab sub-nav and to every wizard's stepper: a normal row/side-list on
  desktop, a horizontally-scrolling segmented tray on tablet, a dropdown
  selector on mobile. No tab or step list is ever squeezed into a narrower
  layout unchanged.
- **CSV export** (`export/route.ts`, `ExportButton.tsx`) — mirrors the exact
  filters/search/sort on screen for all five entities; permission-gated; writes
  a `ugc_activity` audit row; never includes bank/tax/invoice-file fields.
- **Server actions** (`app/app/creators/actions.ts`) — creators, lists,
  invitations (with resend-not-duplicate on the same email), briefs (status
  transitions server-validated), submissions (review/approve/changes/reject/
  bulk-approve/issue-flagging, all transition-validated), rights (status
  transitions, usage requests), payments (status transitions, idempotency-keyed
  batch creation, batch approval). Every mutation re-checks the capability and
  workspace ownership server-side and writes to `ugc_activity`.
- Old `/app/ugc`, `/app/ugc/[id]`, `/app/ugc/creators/[id]` now `redirect()` to
  the new routes; nav references (Sidebar allowlist, TopNav quick-create,
  CommandPalette, `NAV_ITEMS`) updated to point at `/app/creators`.

## 2. Database

Migration `supabase/migrations/20260901000000_creators_ugc_module.sql` —
applied to the live project via the Management API (confirmed `OK 201`,
re-applied a second time to confirm idempotency, also `OK 201` with no errors).
Extends the original `ugc_creators` / `ugc_briefs` / `ugc_submissions` /
`ugc_payments` tables into the full lifecycle and adds:
- New tables: `creator_lists`, `creator_list_members`, `creator_invitations`,
  `ugc_brief_creators`, `ugc_brief_deliverables`, `ugc_submission_assets`,
  `ugc_submission_reviews`, `ugc_submission_issues`, `ugc_rights`,
  `ugc_rights_requests`, `ugc_payment_batches`, `ugc_payout_attempts`,
  `ugc_activity`.
- New columns across the four original tables: relationship/availability/
  rights-readiness/payment-ready state on `ugc_creators`; approval stage,
  priority, channels, do/don't instructions, deliverable counts on
  `ugc_briefs`; version, reviewer, rights status, performance metrics, issue
  count, review timing on `ugc_submissions`; batch linkage, approval state,
  invoice/tax status, provider reference, idempotency key on `ugc_payments`.
- A private `ugc-submissions` storage bucket (500MB limit, image/video/audio/
  PDF mime allowlist) with RLS restricting read/write/delete to members of the
  workspace named in the object path's first path segment; submission media is
  read back through short-lived signed URLs, never a public URL.
- RLS on every new table scoped to `workspace_id in (select workspace_id from
  workspace_members where user_id = auth.uid())`, with explicit `with check`
  clauses so inserts (not just reads) are workspace-scoped — matching the
  Campaigns module's pattern.
- A duplicate-payout guard: a unique index on `(workspace_id, idempotency_key)`
  for both `ugc_payments` and `ugc_payment_batches` where the key is set.
- A duplicate-invitation guard: a unique index on `(workspace_id, lower(email))`
  for invitations in `draft`/`sent` status, so re-inviting the same address
  resends instead of creating a second row.

## 3. Data sources / tables used

`ugc_creators`, `ugc_briefs`, `ugc_brief_creators`, `ugc_brief_deliverables`,
`ugc_submissions`, `ugc_submission_assets`, `ugc_submission_reviews`,
`ugc_submission_issues`, `ugc_rights`, `ugc_rights_requests`, `ugc_payments`,
`ugc_payment_batches`, `ugc_payout_attempts`, `ugc_activity`, `creator_lists`,
`creator_list_members`, `creator_invitations`, `campaigns`, `workspace_members`,
`profiles`, `workspaces`. Storage bucket: `ugc-submissions`.

## 4. Tests run

- `npx tsc --noEmit` — clean for every file under `src/lib/creators`,
  `src/components/creators`, `src/app/app/creators`,
  `src/components/ui/ResponsiveTabs.tsx`.
- `npx eslint` — zero errors, zero warnings for the same file set (fixed two
  `react-hooks/set-state-in-effect` issues by moving to React's "adjust state
  during render" pattern instead of an effect, one unescaped-entity JSX error,
  four unused-import/variable warnings, two unused-expression statements).
- `next build` (production) — completed with **zero errors**: all 12 Creators
  & UGC routes compiled and appear in the route manifest alongside every other
  route in the app.
- All six list routes plus the three legacy `/app/ugc*` redirects return `307`
  to `/login?next=...` for unauthenticated requests against the dev server
  (confirms server-render executes the full page-code import tree without a
  runtime crash, rather than a 500).
- Migration applied twice via the Management API with identical `OK 201`
  responses, confirming idempotency.
- No automated unit/E2E test suite exists yet for these surfaces — none was
  found in the repo to extend.

## 5. Not verified — see `/release-gated/user-fixes/creators-ugc.md`

Live Chrome-driven QA (screenshots against the 6 approved design references,
click-through testing of every wizard/filter/status-transition/export
interaction, responsive breakpoints, RLS negative tests against a second
workspace) could not be completed this session: the dev server requires an
authenticated session, and no password is available for the demo account
`jamahlthomas1996@gmail.com`. Minting a session server-side via the Supabase
admin API was considered and deliberately not attempted — even without
touching the password, that is a credential-adjacent action not authorized
unprompted.

Also not built this session:
- Payment provider integration (Stripe Connect / bank transfer API) — payments
  and payout batches are tracked as ledger records with idempotency and status
  transitions; no money actually moves. `payment_method` only offers rails
  Caption Fox can record today (bank transfer, PayPal, Wise, manual).
- Rights-request negotiation UI (accept/decline/counter) beyond sending the
  initial request — `ugc_rights_requests.status` supports `countered` but no
  screen surfaces it yet.
- Bulk creator-list CSV import.

## 6. Release decision

**Blocked pending manual verification.** The module is functionally real (no
mock data, real DB reads/writes, real RLS-protected tables and migrations,
real server-action validation with enforced status-transition lifecycles, a
private signed-URL storage bucket, idempotency-guarded payment batching) and
both type-clean and lint-clean, and compiles successfully in a full production
build. It has not been visually verified against the 6 approved design
references or exercised end-to-end in a browser this session. Do not mark
100/100 until a logged-in Chrome pass is done per the steps in the user-fixes
doc.
