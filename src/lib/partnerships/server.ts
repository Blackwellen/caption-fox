import { redirect } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getActiveWorkspace } from '@/lib/workspace'
import type { WorkspaceLite } from '@/lib/workspace-shared'
import {
  partnershipCapabilities, canAccessPartnershipModule, visiblePartnershipModules,
  type PartnershipCapabilities, type PartnershipContext,
} from './entitlements'
import type { PartnershipModule } from './constants'

export interface PartnershipSession {
  supabase: SupabaseClient
  userId: string
  ctx: PartnershipContext
  workspace: WorkspaceLite & { plan?: string | null; plan_status?: string | null }
  capabilities: PartnershipCapabilities
  modules: PartnershipModule[]
}

/**
 * Resolves the authenticated session, active workspace, plan and role for the
 * Partnerships module. Redirects unauthenticated users to login and users
 * with no workspace to onboarding — every Partnerships route funnels through this.
 */
export async function getPartnershipSession(): Promise<PartnershipSession> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { active } = await getActiveWorkspace(supabase, user.id)
  if (!active) redirect('/onboarding')

  const [{ data: workspace }, { data: profile }] = await Promise.all([
    supabase.from('workspaces').select('id, name, type, plan, plan_status, logo_url').eq('id', active.id).single(),
    supabase.from('profiles').select('is_platform_admin').eq('id', user.id).single(),
  ])

  const ctx: PartnershipContext = {
    workspaceId: active.id,
    workspaceType: workspace?.type ?? active.type,
    plan: workspace?.plan,
    planStatus: workspace?.plan_status,
    role: active.role,
    isPlatformAdmin: profile?.is_platform_admin ?? false,
  }

  return {
    supabase,
    userId: user.id,
    ctx,
    workspace: { ...active, plan: workspace?.plan, plan_status: workspace?.plan_status },
    capabilities: partnershipCapabilities(ctx),
    modules: visiblePartnershipModules(ctx),
  }
}

/**
 * Same as `getPartnershipSession`, plus a hard route-level gate for one
 * module. Returns the module's block reason instead of throwing so the page
 * can render the canonical no-access / upgrade state.
 */
export async function requirePartnershipModule(module: PartnershipModule) {
  const session = await getPartnershipSession()
  const access = canAccessPartnershipModule(session.ctx, module)
  return { ...session, access }
}
