# Manual steps required — Messaging module

Claude Code cannot complete these steps on your behalf. Each one needs your
own account credentials or a product decision.

## 1. Finish connecting Resend (required before Email can actually send)

The send pipeline, provider adapter, and webhook receiver are all built and
tested. I confirmed the Resend account connected to this session can send —
I sent a real test email through it during this session (delivered). What I
could **not** do for you, because the connected Resend MCP tools use a
**sending-access-restricted API key** (list/create API keys, list domains,
and create webhooks all returned `401 restricted_api_key` when I tried):

1. **Create the app's own API key.** Go to https://resend.com/api-keys and
   create one (Sending access is enough). Set it as `RESEND_API_KEY` in your
   deployment's environment variables (Vercel project settings, or
   `.env.local` for local dev — already scaffolded there, commented out).
   *Alternative:* if you'd rather I do this, reconnect the Resend MCP tool in
   this environment with a **full-access** key instead of the current
   sending-access one, and tell me to retry — I can then call
   `create-api-key` and `create-webhook` directly.
2. **Set the from-address.** `MESSAGING_EMAIL_FROM="Your Brand <hello@yourdomain.com>"`
   — must be on a domain verified in that same Resend account.
3. **Register the delivery webhook** (needed for delivered/opened/clicked
   tracking — see item 1b) once you have a public production URL; a
   `localhost` endpoint isn't reachable from Resend's side.
4. Update that workspace's `email` row in `messaging_channel_configs` to
   `status = 'connected'` so the channel-health panel shows it as operational
   (the send pipeline itself doesn't depend on this flag — only the health
   display does).

## 1b. Register the Resend delivery webhook (delivered/opened/clicked tracking)

The receiver is live at `POST /api/messaging/webhooks/resend` — it verifies
Resend's Svix signature and writes real delivery/open/click/bounce/complaint
events. It just isn't registered with Resend yet (needs your production URL,
which doesn't exist in this local-only environment):

1. Once deployed, go to https://resend.com/webhooks (or ask me to run
   `create-webhook` if you've given this session a full-access key) and add:
   - **Endpoint:** `https://<your-production-domain>/api/messaging/webhooks/resend`
   - **Events:** `email.sent`, `email.delivered`, `email.opened`,
     `email.clicked`, `email.bounced`, `email.complained`, `email.failed`,
     `email.delivery_delayed`
2. Copy the **signing secret** Resend shows you and set it as
   `RESEND_WEBHOOK_SECRET` in your deployment's environment variables.

Until this is registered, sends still work, but `delivered`/`opened`/`clicked`
counters stay at zero (reported honestly as zero, not faked).

## 1c. Finish connecting SMS (Twilio) — the adapter is real and wired

SMS now has a real adapter (`src/lib/messaging/providers/sms.ts`) that calls
the Twilio REST API directly, the same way Email calls Resend. Set these on
your deployment (already scaffolded in `.env.local.example`):

1. `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` — from
   https://console.twilio.com.
2. Either `TWILIO_MESSAGING_SERVICE_SID` (recommended — handles sender
   pooling and, in the US, 10DLC registration for you) or
   `TWILIO_FROM_NUMBER` (a single E.164 number, e.g. `+15551234567`).
3. Open **Messaging → Channels** in the app and click **Check connection** —
   it will show "Connected via Twilio" once the variables above are set.
4. For US traffic, complete Twilio's **10DLC campaign registration** for that
   sender — Twilio enforces this itself; the app cannot register it for you.

## 1d. Connect WhatsApp, RCS and Push (not wired to a real provider yet)

The adapter contract exists (`src/lib/messaging/providers/`) but each of
these is still a stub that truthfully reports "not connected" — Email and SMS
are the only channels with a concrete provider adapter so far. To make one
usable, a future build phase needs to add a concrete adapter for your chosen
provider, once you have the account to test it against:

- **WhatsApp:** a WhatsApp Business Platform account (Meta) with a verified
  business, phone number and at least one approved message template.
- **RCS:** a verified RCS agent through your chosen aggregator.
- **Push:** a mobile app / web push SDK integration (FCM/APNs or a web push
  provider) with your own project credentials.

## 1e. Schedule the journey engine (required for journeys to actually run)

Journeys enrol contacts, wait, and send for real — but only when something
calls `POST /api/messaging/journeys/tick` on a schedule. This repo does not
run its own cron; a secret has already been generated and added to your local
`.env.local` (`MESSAGING_JOBS_SECRET`, not committed — `.env*` is gitignored),
so local testing works right away. For a real deployment you need to:

1. Set the same (or a newly generated) secret as `MESSAGING_JOBS_SECRET` in
   your deployment's environment variables.
2. Point an external scheduler (Vercel Cron, GitHub Actions on a schedule, or
   any cron-capable service) at `POST https://<your-domain>/api/messaging/journeys/tick`
   every few minutes, with header `Authorization: Bearer <the secret>`.

Without step 2, journeys can be created and activated but will never advance —
the route returns 503 until `MESSAGING_JOBS_SECRET` is set, and does nothing
until something calls it on a schedule.

## 2. Decide which workspace types see Messaging in navigation

`src/components/layout/Sidebar.tsx` currently allowlists `/app/messaging` for
`small_business` only (via an explicit list) and implicitly for `brand`/
`agency` (empty allowlist = unrestricted). `creator` workspaces do not see it.
Confirm whether creator workspaces should also get lifecycle messaging (e.g.
for fan/audience email or SMS) — this is a product call, not a technical one.

## 3. Confirm plan gating thresholds

`src/lib/messaging/entitlements.ts` currently gates SMS/Push at `creator_pro`
and WhatsApp/RCS/Journeys at `team`, matching the pattern used by other
Campaign Manager modules. Confirm these match your actual pricing plan.

## 4. Review before the next build phase

Composer (with edit support), audience quick-create, template CRUD, journey
builder with a real execution engine, real Email→Resend and SMS→Twilio send
paths, the Resend delivery webhook receiver, a real approval workflow, a
message detail page, and a channel-connect page all exist now (Phases 1–4).
What remains is genuinely either (a) third-party accounts only you can create
(WhatsApp Business, an RCS aggregator, FCM/APNs, and finishing the Resend
webhook registration), or (b) a dedicated visual-design pass to match the 8
approved reference images pixel-for-pixel (rich block editor, drag-and-drop
journey canvas, WhatsApp/RCS-specific composers). Confirm priority order for
whichever of those you want next.

## 5. Pre-existing, unrelated build issue (not caused by this work)

`npm run build`'s type-check currently fails on `src/app/app/seo/ai-search/page.tsx`
(a `PageHeader` prop mismatch). That file is untracked and predates this
session's Messaging work — left alone rather than fixed out of scope. It will
block a full production build until someone on the SEO module fixes it;
`npx tsc --noEmit` across the whole repo is otherwise clean, including every
Messaging file.
