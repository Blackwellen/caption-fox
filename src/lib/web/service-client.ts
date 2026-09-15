import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Service-role Supabase client for public, unauthenticated Web & Conversion
// endpoints — form submissions, experiment assignment/conversion, and
// tracking-event ingestion. These run with no user session to scope RLS
// against, so every query filters explicitly by workspace_id / entity id
// itself. Mirrors src/lib/messaging/service-client.ts.

let cached: SupabaseClient | null = null

export function webServiceClient(): SupabaseClient {
  if (cached) return cached
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase service credentials are not configured on the server.')
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { 'X-Client-Info': 'caption-fox-web-conversion' } },
  })
  return cached
}
