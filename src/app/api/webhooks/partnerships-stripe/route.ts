import { NextResponse, type NextRequest } from 'next/server'
import { partnershipsStripe } from '@/lib/partnerships/stripe'
import { partnershipsServiceClient } from '@/lib/partnerships/service-client'
import type Stripe from 'stripe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Receives Stripe Connect account + transfer events for Partnerships payouts.
 * Keeps `partnership_partners.stripe_account_status` and
 * `partnership_payouts.status` in sync even when the change originates on
 * Stripe's side (e.g. a partner finishes verification later, or a transfer
 * later reverses) rather than only when our own server actions run.
 *
 * Setup: in the Stripe dashboard, add a webhook endpoint pointed at
 * `https://<your-domain>/api/webhooks/partnerships-stripe` for
 * `account.updated`, `transfer.updated` and `transfer.reversed`, then set the
 * signing secret it gives you as STRIPE_CONNECT_WEBHOOK_SECRET. See
 * release-gated/user-fixes/partnerships.md.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'STRIPE_CONNECT_WEBHOOK_SECRET is not configured on this deployment.' }, { status: 503 })
  }

  const signature = request.headers.get('stripe-signature')
  if (!signature) return NextResponse.json({ error: 'Missing stripe-signature header.' }, { status: 400 })

  const rawBody = await request.text()
  const stripe = partnershipsStripe()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Signature verification failed.'
    return NextResponse.json({ error: `Webhook signature invalid: ${message}` }, { status: 401 })
  }

  const supabase = partnershipsServiceClient()

  if (event.type === 'account.updated') {
    const account = event.data.object as Stripe.Account
    const status = account.requirements?.disabled_reason ? 'restricted'
      : account.payouts_enabled ? 'verified'
      : 'pending'

    await supabase.from('partnership_partners').update({
      stripe_account_status: status,
      stripe_details_submitted: Boolean(account.details_submitted),
      stripe_payouts_enabled: Boolean(account.payouts_enabled),
      stripe_connected_at: status === 'verified' ? new Date().toISOString() : null,
      stripe_last_synced_at: new Date().toISOString(),
    }).eq('stripe_account_id', account.id)
  }

  if (event.type === 'transfer.reversed') {
    const transfer = event.data.object as Stripe.Transfer
    await supabase.from('partnership_payouts')
      .update({ status: 'failed', provider_error: 'Transfer reversed on Stripe.' })
      .eq('provider_reference', transfer.id)
  }

  return NextResponse.json({ ok: true })
}
