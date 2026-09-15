import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Service-role client for server actions that must act outside the caller's
// RLS scope (publishing onboarding uploads, writing audit rows without a
// workspace, creating affiliate applicants). Never import from client code.
export function createServiceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}
