import { redirect } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getActiveWorkspace } from '@/lib/workspace'
import type { WorkspaceLite } from '@/lib/workspace-shared'
import { PERMISSIONS, ROLE_PERMISSIONS, type Permission } from '@/lib/permissions'

/**
 * Central PR & Reputation session resolver. Every reputation route and
 * server action funnels through this — the workspace is never taken from a
 * client-supplied value. Mirrors src/lib/social/server.ts.
 */
export interface ReputationSession {
  supabase: SupabaseClient
  userId: string
  workspace: WorkspaceLite
  workspaceId: string
  role: string | null
  isPlatformAdmin: boolean
  can: (permission: Permission) => boolean
}

export async function getReputationSession(): Promise<ReputationSession> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/app/reputation')

  const { active } = await getActiveWorkspace(supabase, user.id)
  if (!active) redirect('/onboarding')

  const { data: profile } = await supabase
    .from('profiles').select('is_platform_admin').eq('id', user.id).single()

  const isPlatformAdmin = profile?.is_platform_admin ?? false
  const perms = isPlatformAdmin ? (Object.values(PERMISSIONS) as Permission[]) : (ROLE_PERMISSIONS[active.role ?? ''] ?? [])

  return {
    supabase,
    userId: user.id,
    workspace: active,
    workspaceId: active.id,
    role: active.role ?? null,
    isPlatformAdmin,
    can: (permission: Permission) => perms.includes(permission),
  }
}

export interface AccessResult {
  allowed: boolean
  message?: string
}

export function requireReputationAccess(session: ReputationSession, permission: Permission): AccessResult {
  if (!(session.workspace.type === 'brand' || session.workspace.type === 'agency' || session.isPlatformAdmin)) {
    return { allowed: false, message: 'PR & Reputation is available on Brand and Agency workspaces.' }
  }
  if (!session.can(permission)) {
    return { allowed: false, message: 'Your role does not include access to this area. Ask a workspace owner or admin for access.' }
  }
  return { allowed: true }
}
