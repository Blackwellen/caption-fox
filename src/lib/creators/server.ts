import { redirect } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getActiveWorkspace } from '@/lib/workspace'
import type { WorkspaceLite } from '@/lib/workspace-shared'
import {
  canAccessCreatorModule, creatorCapabilities, resolveMode, visibleCreatorModules,
  type CreatorCapabilities, type CreatorContext, type CreatorsUgcMode,
} from './entitlements'
import type { CreatorModule } from './constants'

export interface CreatorSession {
  supabase: SupabaseClient
  userId: string
  ctx: CreatorContext
  workspace: WorkspaceLite & { plan?: string | null; plan_status?: string | null }
  capabilities: CreatorCapabilities
  modules: CreatorModule[]
  mode: CreatorsUgcMode
}

/**
 * Resolves the authenticated session, active workspace, plan and role for the
 * Creators & UGC module. Redirects unauthenticated users to login and users
 * with no workspace to onboarding — every Creators route funnels through this,
 * so a pasted deep link is protected rather than merely hidden from the nav.
 */
export async function getCreatorSession(): Promise<CreatorSession> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/app/creators')

  const { active } = await getActiveWorkspace(supabase, user.id)
  if (!active) redirect('/onboarding')

  const [{ data: workspace }, { data: profile }] = await Promise.all([
    supabase.from('workspaces').select('id, name, type, plan, plan_status, logo_url').eq('id', active.id).single(),
    supabase.from('profiles').select('is_platform_admin').eq('id', user.id).single(),
  ])

  const ctx: CreatorContext = {
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
    capabilities: creatorCapabilities(ctx),
    modules: visibleCreatorModules(ctx),
    mode: resolveMode(ctx),
  }
}

/**
 * Same as `getCreatorSession`, plus a hard route-level gate for one module.
 * Returns the module's block reason instead of throwing so the page can render
 * the canonical no-access / upgrade state rather than a 404 or a white screen.
 */
export async function requireCreatorModule(module: CreatorModule) {
  const session = await getCreatorSession()
  const access = canAccessCreatorModule(session.ctx, module)
  return { ...session, access }
}
