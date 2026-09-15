import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Service-role Supabase client, used ONLY where RLS cannot express the rule:
// social_oauth_states and social_channel_secrets carry no policy at all, and
// background workers run without a user session.
//
// Every request-driven caller must have already proved workspace membership on
// the request-scoped RLS client. This client bypasses RLS, so passing an
// unvalidated workspace_id into it would be a cross-tenant leak.

let cached: SupabaseClient | null = null

export function socialServiceClient(): SupabaseClient {
  if (cached) return cached
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase service credentials are not configured on the server.')
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { 'X-Client-Info': 'caption-fox-social' } },
  })
  return cached
}
