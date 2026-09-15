import { redirect } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getActiveWorkspace } from '@/lib/workspace'
import type { WorkspaceLite } from '@/lib/workspace-shared'
import {
  campaignCapabilities, canAccessCampaignModule, visibleCampaignModules,
  type CampaignCapabilities, type CampaignContext,
} from './entitlements'
import type { CampaignModule } from './constants'

export interface CampaignSession {
  supabase: SupabaseClient
  userId: string
  ctx: CampaignContext
  workspace: WorkspaceLite & { plan?: string | null; plan_status?: string | null }
  capabilities: CampaignCapabilities
  modules: CampaignModule[]
}

/**
 * Resolves the authenticated session, active workspace, plan and role for the
 * Campaigns module. Redirects unauthenticated users to login and users with no
 * workspace to onboarding — every Campaigns route funnels through this.
 */
export async function getCampaignSession(): Promise<CampaignSession> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { active } = await getActiveWorkspace(supabase, user.id)
  if (!active) redirect('/onboarding')

  const [{ data: workspace }, { data: profile }] = await Promise.all([
    supabase.from('workspaces').select('id, name, type, plan, plan_status, logo_url').eq('id', active.id).single(),
    supabase.from('profiles').select('is_platform_admin').eq('id', user.id).single(),
  ])

  const ctx: CampaignContext = {
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
    capabilities: campaignCapabilities(ctx),
    modules: visibleCampaignModules(ctx),
  }
}

/**
 * Same as `getCampaignSession`, plus a hard route-level gate for one module.
 * Returns the module's block reason instead of throwing so the page can render
 * the canonical no-access / upgrade state.
 */
export async function requireCampaignModule(module: CampaignModule) {
  const session = await getCampaignSession()
  const access = canAccessCampaignModule(session.ctx, module)
  return { ...session, access }
}
