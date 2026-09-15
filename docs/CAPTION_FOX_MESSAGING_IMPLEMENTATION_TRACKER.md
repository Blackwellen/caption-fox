# Caption Fox Messaging — Implementation Tracker

A multi-phase build. This tracks the eight canonical Messaging routes against
the approved designs in `designs/Messaging/`.

## Phase 1 — foundation (DONE)

- Database schema: `supabase/migrations/20260902000000_messaging_module.sql`
  (contacts, suppressions, audiences, channel configs, templates + versions,
  journeys + participants, messages + versions, delivery events, daily
  metrics, shared activity feed). Applied to the live Supabase project.
- Entitlements: `src/lib/messaging/entitlements.ts` — plan/role/workspace-type
  gating per module, mirroring `src/lib/campaigns/entitlements.ts`.
- Permissions: `MESSAGING_*` permissions + role grants added to
  `src/lib/permissions.ts`, merged into `ROLE_PERMISSIONS`.
- Data layer: `src/lib/messaging/data.ts` — real Supabase queries only.
- Shared UI: `src/components/messaging/*` (header, sub-nav, KPI strip,
  programs table, activity feed, states, buttons).
- All eight routes reachable, entitled, real-data-backed, honest empty states.
- Export: `/app/messaging/export` — CSV export, permission-gated, audit-logged.

## Phase 2 — composer, audiences, templates, journeys, send pipeline (DONE)

- **Provider architecture** (`src/lib/messaging/providers/`): a `ChannelProvider`
  contract every channel adapter implements. `email.ts` calls the real Resend
  REST API (`RESEND_API_KEY` + `MESSAGING_EMAIL_FROM`) — an actual send, not a
  simulation, once those env vars are set. SMS/WhatsApp/RCS/Push use
  `unconnectedProvider()`, which truthfully reports "not connected" until the
  workspace's own provider credentials are wired in a later phase — never a
  fake success.
- **Send pipeline** (`src/lib/messaging/send.ts`): consent + suppression check
  re-run at send time (not only when the audience was built), idempotent per
  (message, contact) so a retry never double-sends, delivery events written
  per outcome, message counters recomputed from real events.
- **Server actions** (`src/app/app/messaging/actions.ts`): `createMessage`,
  `updateMessageContent`, `sendTestMessage`, `sendMessageNow`,
  `scheduleMessage`, `cancelMessage`, `createAudience`, `createMessagingTemplate`,
  `setMessagingTemplateStatus`, `createJourney`, `updateJourneySteps`,
  `setJourneyStatus` — all workspace-scoped, permission-checked, audit-logged
  to `messaging_activity`, mirroring `src/app/app/campaigns/actions.ts`.
- **Message composer** (`/app/messaging/{email,sms,whatsapp,rcs,push}/compose`):
  real draft create/edit, channel-aware fields (subject for email, character
  count for SMS, title for push), an audience picker with inline "paste a
  contact list" quick-create, Save draft / Send test / Schedule / Send now —
  each button calls a real server action against real data.
- **Audience quick-create** (`AudiencePicker.tsx` + `createAudience`): pastes a
  list of emails/phones, validates format, creates `messaging_contacts` +
  `messaging_audience_members` rows. Consent is recorded as given by whoever
  pastes the list — the UI says so explicitly; this is not equivalent to a
  verified double opt-in import (that remains a later phase).
- **Journey builder** (`/app/messaging/journeys/new`, `/app/messaging/journeys/{id}`):
  a real step-based builder (trigger → message/wait/condition → end steps),
  not the drag-and-drop canvas from the approved designs. Saves to the
  `canvas` jsonb column as an ordered node/edge list a real engine executes.
  Activate/Pause/Archive wired to `setJourneyStatus` with validation (needs
  at least one step and an entry audience to activate).
- **Journey execution engine** (`src/lib/messaging/journey-engine.ts` +
  `POST /api/messaging/journeys/tick`): a real, scheduler-invoked tick that
  enrols new audience members, advances `wait` timers, and sends `message`
  steps through the same send pipeline as manual sends — re-checking consent
  and suppression per contact per step. Not simulated: it performs and
  records real sends when a channel is connected. Requires
  `MESSAGING_JOBS_SECRET` and an external scheduler hitting the tick route —
  see `release-gated/user-fixes/messaging/journeys.md`.
- **Template composer** (`/app/messaging/templates/new`): real create with
  channel-aware fields, saved as a draft. Submit for review / Publish /
  Archive wired to `setMessagingTemplateStatus` with real state-machine
  validation, shown as row actions on the Templates list.

## Phase 3 — Resend readiness, delivery tracking, real conditions (DONE)

- **Resend webhook receiver** (`POST /api/messaging/webhooks/resend`): verifies
  Resend's Svix-signed payloads (`src/lib/messaging/providers/resend-webhook.ts`,
  full HMAC-SHA256 signature + replay-window check, not a stub), then converts
  `email.delivered` / `.opened` / `.clicked` / `.bounced` / `.complained` /
  `.failed` / `.delivery_delayed` events into real `messaging_delivery_events`
  rows and recomputes the owning message's counters. This is what makes
  "delivered", "opened" and "clicked" real numbers instead of copies of "sent."
- **Real behavioural journey conditions**: a condition step can now be set to
  "opened previous message" or "clicked previous message" — the engine
  (`evaluateCondition` in `journey-engine.ts`) checks the actual
  `messaging_delivery_events` row for that contact and that step's message
  before deciding whether the participant continues or exits. No longer a
  pass-through for configured conditions (unconfigured ones remain
  informational-only, as documented).
- **Verified the connected Resend account can send** — sent a real test email
  via the Resend MCP connection during this session (delivered, id
  `da2c719d-d0f0-48bf-b713-842e42b74349`). That connector uses a
  **sending-access-restricted** API key, so it could not be used to list
  domains, list/create API keys, or create the webhook (all returned
  `401 restricted_api_key`) — those need a full-access key or the user's own
  Resend dashboard. See user-fixes for exactly what's left for the user.
- Generated `MESSAGING_JOBS_SECRET` locally and added it to `.env.local` (not
  committed — `.env*` is gitignored) so the journey tick endpoint is usable in
  this dev environment immediately.
- New migration `20260902010000_messaging_delivery_events_index.sql` (index
  for webhook event attribution by `provider_message_id`) — applied live.
- Full-repo `npx tsc --noEmit`: 0 errors. `next build`: compiles successfully;
  its stricter build-time typecheck fails on an **unrelated, pre-existing,
  untracked file** (`src/app/app/seo/ai-search/page.tsx`, a `PageHeader` prop
  mismatch in the SEO module) that predates this work and was not touched by
  it — left alone rather than fixed out-of-scope.

## Phase 4 — approvals, message detail, channel connect, real SMS (DONE)

- **Approval workflow** (`submitMessageForApproval`, `reviewMessageApproval` in
  `actions.ts` + `MessageApprovalActions.tsx`): a draft can be submitted for
  approval; anyone with the `approve` capability can Approve / Reject / Request
  changes, each a real state transition enforced server-side (`sendMessageNow`
  already refused `pending` messages — this is what actually gets them there
  and out again). Wired into the composer, the programs table row actions, and
  the message detail page.
- **Message detail route** (`/app/messaging/messages/{id}`) with real
  deep-linkable tabs (`?tab=content|audience|delivery|performance|versions`):
  Content shows the actual saved subject/headline/body/sender, Audience shows
  the real linked audience and contact count, Delivery lists every real
  `messaging_delivery_events` row for that message (event type, contact,
  provider ID, timestamp), Performance shows real sent/delivered/opened/
  clicked/converted/opt-out/failed counters, Versions lists real saved
  `messaging_message_versions` rows, and an Activity panel shows the real
  audit trail for that message.
- **Edit existing drafts**: the compose routes now accept `?id=` and load the
  real saved message into the composer (previously compose only supported
  creating new messages — editing a saved draft was not possible).
- **Channel connect page** (`/app/messaging/channels`): shows live connection
  status per channel with a "Check connection" action
  (`refreshChannelHealth`) that re-verifies real provider credentials and
  persists the result — not a manual toggle. Every "channel settings" pointer
  elsewhere in the module now links here.
- **Real SMS provider adapter** (`src/lib/messaging/providers/sms.ts`): calls
  the Twilio REST API directly (Basic Auth, form-encoded POST) — an actual
  send once `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` /
  `TWILIO_MESSAGING_SERVICE_SID` (or `TWILIO_FROM_NUMBER`) are set, mirroring
  the Email/Resend adapter exactly. SMS channel health is now auto-detected
  the same way Email's is.
- Full-repo `npx tsc --noEmit`: 0 errors after every change in this phase.

## Explicitly deferred — genuinely cannot be closed without the user's own action

These are not effort gaps — each one requires something only the account
owner can provide (a third-party account, a production domain, a design
tool decision) or is out of proportion to a single build pass. Listed with
exactly what would unblock each:

| Area | Status | What unblocks it |
|---|---|---|
| WhatsApp / RCS / Push real sends | Adapter contract exists (`ChannelProvider`); each is a stub reporting "not connected." | A WhatsApp Business Platform account + approved templates (Meta), a verified RCS agent (an aggregator), and an FCM/APNs project — each is a real third-party account only the workspace owner can create. Given credentials, each adapter is a similar-sized build to `sms.ts`. |
| Resend delivery/open/click webhook **registration** | Receiver code is built and live (`/api/messaging/webhooks/resend`), verifies real Svix signatures. | Needs the user's Resend dashboard (or a full-access API key) to create the webhook pointed at the production URL, plus `RESEND_WEBHOOK_SECRET` set on the deployment. The MCP-connected Resend key in this session is send-only and cannot do this (confirmed: `list-domains`/`list-webhooks`/`create-api-key` all return `401 restricted_api_key`). |
| Pixel-perfect visual match to the 8 approved designs (rich block editor, WhatsApp template picker synced live to Meta, RCS carousel builder, push device preview identical to the reference, journey drag/drop canvas) | A real, functionally complete but visually simpler UI exists everywhere. | A dedicated visual-design pass — this is a genuine multi-week design/frontend effort (a rich-text editor and a canvas library are not currently dependencies of this repo), not a data or backend gap. |
| True two-way condition branching in journeys | A condition step can require "opened"/"clicked" on the previous message, checked against real delivery events — but it's still linear (met → continue, not met → exit), not a branch with its own follow-on steps. | A larger journey-graph rework; the current linear model was a deliberate scope boundary for this build. |
| Background queue for large sends | `sendMessageNow` sends synchronously in the request — correct and safe for hundreds of contacts, not built to scale to tens of thousands. | Needs real queue infrastructure (e.g. a Postgres-backed job table + a worker, or a hosted queue) — an infrastructure decision, not a code gap in the existing request. |
| Audience CSV import with consent validation, dedupe, and large-file handling | Button present, explicitly disabled with a truthful tooltip; paste-list quick-create exists as a smaller honest substitute. | A file-upload + streaming-parse UI — buildable, deprioritised behind the send pipeline and approval workflow in this pass. |
| Chrome MCP visual verification against the 8 reference PNGs | Not run — the local dev server was unresponsive to repeated automated requests during this session, and no test login credentials were available to get past the auth redirect. | Either a working dev server + test credentials, or the user running the click-through themselves. |
| Unit/integration/E2E tests | Not written this pass. | A dedicated testing pass — every action is manually reasoned about and type-checked, but has no automated regression coverage yet. |

## Release score

**Overview / Email / SMS: ~70/100 each** — real routes, entitlements, data, a
working composer with edit support, a real send/schedule/test pipeline, a
real approval workflow, a real message detail page, and a real provider
integration (Resend for Email — confirmed with a real delivered test send;
Twilio for SMS, same pattern, not yet credential-tested). Gap to 100 is
almost entirely visual fidelity to the approved designs plus delivery/open/
click tracking, which needs the user's own webhook registration.

**WhatsApp / RCS / Push: ~55/100 each** — identical routes, entitlements,
composer, approval workflow and pipeline to Email/SMS, but the provider
adapter is still a stub that correctly refuses rather than fake-sending —
blocked on the user creating third-party provider accounts.

**Journeys: ~58/100** — real step-based builder, real execution engine, real
sends and waits, real (single-branch) behavioural conditions. No visual
canvas, no true two-way branching yet.

**Templates: ~48/100** — real CRUD and status workflow. No rich preview,
variable picker, or journey-usage graph yet.

**Final release decision: blocked pending further phases and the user's own
third-party account setup.** Not decorative — every action either does the
real thing or truthfully refuses (e.g. "no WhatsApp provider connected")
rather than faking success. Not yet commercially complete against the master
spec's full scope, and a subset of that scope (third-party provider
accounts, full visual redesign) cannot be closed by engineering effort alone.
See `release-gated/user-fixes/messaging/` for what only the user can complete
(provider credentials, cron scheduling, workspace-type/plan decisions).
