import { redirect } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getActiveWorkspace } from '@/lib/workspace'
import type { WorkspaceLite } from '@/lib/workspace-shared'
import {
  studioCapabilities, canAccessStudioModule, visibleStudioModules, studioLimits,
  type StudioCapabilities, type StudioContext, type StudioLimits,
} from './entitlements'
import type { StudioModule } from './constants'

export interface StudioSession {
  supabase: SupabaseClient
  userId: string
  ctx: StudioContext
  workspace: WorkspaceLite & { plan?: string | null; plan_status?: string | null }
  capabilities: StudioCapabilities
  limits: StudioLimits
  modules: StudioModule[]
}

/**
 * Resolves the authenticated session, active workspace, plan and role for the
 * Studio module. Redirects unauthenticated users to login and users with no
 * workspace to onboarding — every Studio route funnels through this.
 */
export async function getStudioSession(): Promise<StudioSession> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { active } = await getActiveWorkspace(supabase, user.id)
  if (!active) redirect('/onboarding')

  const [{ data: workspace }, { data: profile }] = await Promise.all([
    supabase.from('workspaces').select('id, name, type, plan, plan_status, logo_url').eq('id', active.id).single(),
    supabase.from('profiles').select('is_platform_admin').eq('id', user.id).single(),
  ])

  const ctx: StudioContext = {
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
    capabilities: studioCapabilities(ctx),
    limits: studioLimits(ctx),
    modules: visibleStudioModules(ctx),
  }
}

/**
 * Same as `getStudioSession`, plus a hard route-level gate for one module.
 * Returns the module's block reason instead of throwing so the page can render
 * the canonical no-access / upgrade state. A direct URL is protected here, not
 * merely hidden from the sub-nav.
 */
export async function requireStudioModule(module: StudioModule) {
  const session = await getStudioSession()
  const access = canAccessStudioModule(session.ctx, module)
  return { ...session, access }
}
