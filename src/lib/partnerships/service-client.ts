import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Service-role Supabase client for Partnerships — used ONLY by the Stripe
// webhook route, which runs without a user session and must write payout /
// partner status updates that RLS would otherwise block.
//
// Every write here takes its workspace_id from data already stored against
// the Stripe object (partner.stripe_account_id / payout.provider_reference),
// never from unvalidated webhook input, so it cannot become a cross-tenant
// write primitive.

let cached: SupabaseClient | null = null

export function partnershipsServiceClient(): SupabaseClient {
  if (cached) return cached
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase service credentials are not configured on the server.')
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { 'X-Client-Info': 'caption-fox-partnerships' } },
  })
  return cached
}
