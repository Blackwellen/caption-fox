import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Service-role Supabase client, used ONLY where RLS cannot express the rule:
// reading ad_provider_apps, ad_connection_secrets and ad_oauth_states, which
// carry no policy at all.
//
// Every caller must have already proved workspace membership through the
// request-scoped RLS client. This client bypasses RLS, so passing an
// unvalidated workspace_id into it is a cross-tenant leak.

let cached: SupabaseClient | null = null

export function serviceClient(): SupabaseClient {
  if (cached) return cached
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Supabase service credentials are not configured on the server.')
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { 'X-Client-Info': 'caption-fox-advertising' } },
  })
  return cached
}

/**
 * Confirms the signed-in user is a member of the workspace before any
 * service-role work is done. Returns the member role, or null when not a member.
 */
export async function assertMembership(
  rlsClient: SupabaseClient,
  workspaceId: string,
  userId: string,
): Promise<string | null> {
  const { data } = await rlsClient
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle()
  if (data?.role) return data.role as string

  // Workspace owners are members implicitly in some seeded workspaces.
  const { data: owned } = await rlsClient
    .from('workspaces')
    .select('id')
    .eq('id', workspaceId)
    .eq('owner_id', userId)
    .maybeSingle()
  return owned ? 'owner' : null
}
