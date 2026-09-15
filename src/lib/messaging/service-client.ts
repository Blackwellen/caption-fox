import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Service-role Supabase client for the Messaging journey engine, which runs as
// a scheduled background job with no user session to scope RLS against.
// Every query in the engine filters explicitly by workspace_id / journey_id
// itself, since this client bypasses RLS entirely.

let cached: SupabaseClient | null = null

export function messagingServiceClient(): SupabaseClient {
  if (cached) return cached
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase service credentials are not configured on the server.')
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { 'X-Client-Info': 'caption-fox-messaging' } },
  })
  return cached
}
