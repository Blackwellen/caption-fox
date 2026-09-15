import { NextResponse, type NextRequest } from 'next/server'
import { messagingServiceClient } from '@/lib/messaging/service-client'
import { verifyResendWebhook, mapResendEventType, type ResendWebhookPayload } from '@/lib/messaging/providers/resend-webhook'
import { recountMessageStats } from '@/lib/messaging/send'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Receives real delivery/open/click/bounce/complaint events from Resend and
 * turns them into `messaging_delivery_events` rows, then recomputes the
 * owning message's counters. This is what makes "delivered", "opened" and
 * "clicked" real numbers instead of a copy of "sent" — without this route
 * those three stay at zero, which the app reports honestly rather than
 * fabricating engagement.
 *
 * Setup: create a webhook in your Resend dashboard (or via the Resend MCP
 * tools with a full-access API key) pointed at
 * `https://<your-domain>/api/messaging/webhooks/resend` for the events
 * listed in EVENT_MAP (resend-webhook.ts), then set the signing secret it
 * gives you as RESEND_WEBHOOK_SECRET. See
 * release-gated/user-fixes/messaging/overview.md.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'RESEND_WEBHOOK_SECRET is not configured on this deployment.' }, { status: 503 })
  }

  const rawBody = await request.text()
  const verification = verifyResendWebhook(rawBody, {
    svixId: request.headers.get('svix-id'),
    svixTimestamp: request.headers.get('svix-timestamp'),
    svixSignature: request.headers.get('svix-signature'),
  }, secret)

  if (!verification.valid) {
    return NextResponse.json({ error: `Webhook signature invalid: ${verification.reason}` }, { status: 401 })
  }

  let payload: ResendWebhookPayload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 })
  }

  const eventType = mapResendEventType(payload.type)
  const providerMessageId = payload.data?.email_id
  if (!eventType || !providerMessageId) {
    // Event types we don't track (e.g. domain.* / contact.*) are acknowledged, not errors.
    return NextResponse.json({ ok: true, skipped: true })
  }

  const supabase = messagingServiceClient()

  // Every prior event for this provider message shares the same message_id /
  // contact_id / workspace_id — use the original "sent" row to attribute this
  // new event correctly without trusting anything from the webhook body.
  const { data: original } = await supabase.from('messaging_delivery_events')
    .select('workspace_id, message_id, contact_id, channel')
    .eq('provider_message_id', providerMessageId).eq('event_type', 'sent').maybeSingle()

  if (!original) {
    return NextResponse.json({ ok: true, unmatched: true })
  }

  await supabase.from('messaging_delivery_events').insert({
    workspace_id: original.workspace_id, message_id: original.message_id, contact_id: original.contact_id,
    channel: original.channel, event_type: eventType, provider_message_id: providerMessageId,
    metadata: { source: 'resend_webhook', link: payload.data?.click?.link ?? null },
  })

  if (original.message_id) await recountMessageStats(supabase, original.message_id)

  return NextResponse.json({ ok: true })
}
