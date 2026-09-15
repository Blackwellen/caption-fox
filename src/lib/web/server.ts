import { redirect } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getActiveWorkspace } from '@/lib/workspace'
import type { WorkspaceLite } from '@/lib/workspace-shared'
import {
  webCapabilities, canAccessWebModule, visibleWebModules,
  type WebCapabilities, type WebContext,
} from './entitlements'
import type { WebModule } from './constants'

export interface WebSession {
  supabase: SupabaseClient
  userId: string
  ctx: WebContext
  workspace: WorkspaceLite & { plan?: string | null; plan_status?: string | null }
  capabilities: WebCapabilities
  modules: WebModule[]
}

/**
 * Resolves the authenticated session, active workspace, plan and role for the
 * Web & Conversion module. Redirects unauthenticated users to login and users
 * with no workspace to onboarding — every Web & Conversion route funnels
 * through this. Mirrors src/lib/messaging/server.ts.
 */
export async function getWebSession(): Promise<WebSession> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { active } = await getActiveWorkspace(supabase, user.id)
  if (!active) redirect('/onboarding')

  const [{ data: workspace }, { data: profile }] = await Promise.all([
    supabase.from('workspaces').select('id, name, type, plan, plan_status, logo_url').eq('id', active.id).single(),
    supabase.from('profiles').select('is_platform_admin').eq('id', user.id).single(),
  ])

  const ctx: WebContext = {
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
    capabilities: webCapabilities(ctx),
    modules: visibleWebModules(ctx),
  }
}

/**
 * Same as `getWebSession`, plus a hard route-level gate for one module.
 * Returns the module's block reason instead of throwing so the page can
 * render the canonical no-access / upgrade state.
 */
export async function requireWebModule(module: WebModule) {
  const session = await getWebSession()
  const access = canAccessWebModule(session.ctx, module)
  return { ...session, access }
}
