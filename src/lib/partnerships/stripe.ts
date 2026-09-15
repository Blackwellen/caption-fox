import 'server-only'
import Stripe from 'stripe'

// Server-only Stripe client for Partnerships Connect payouts.
//
// Safety: outside production this always uses the TEST secret key, even if a
// live key is present in the environment, so local development and QA can
// never move real money through a partner's connected account. Production
// deployments use the live key.
let cached: Stripe | null = null

export function partnershipsStripe(): Stripe {
  if (cached) return cached
  const key = process.env.NODE_ENV === 'production'
    ? process.env.STRIPE_SECRET_KEY
    : (process.env.STRIPE_SECRET_KEY_TEST || process.env.STRIPE_SECRET_KEY)
  if (!key) throw new Error('Stripe secret key is not configured on the server.')
  // No pinned apiVersion — uses the Stripe account's current default so this
  // doesn't need updating every time Stripe ships a new dated API version.
  cached = new Stripe(key)
  return cached
}

export function stripeConnectConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY_TEST || process.env.STRIPE_SECRET_KEY)
}
