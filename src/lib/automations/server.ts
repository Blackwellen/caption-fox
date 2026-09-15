import { redirect } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getActiveWorkspace } from '@/lib/workspace'
import type { WorkspaceLite } from '@/lib/workspace-shared'
import {
  canAccessAutomationModule, automationCapabilities, visibleAutomationModules,
  type AutomationCapabilities, type AutomationContext,
} from './entitlements'
import type { AutomationModule } from './constants'

export interface AutomationSession {
  supabase: SupabaseClient
  userId: string
  ctx: AutomationContext
  workspace: WorkspaceLite & { plan?: string | null; plan_status?: string | null }
  capabilities: AutomationCapabilities
  modules: AutomationModule[]
}

/**
 * Resolves the authenticated session, active workspace, plan and role for
 * the Automations module. Mirrors src/lib/community/server.ts.
 */
export async function getAutomationSession(): Promise<AutomationSession> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/app/automations')

  const { active } = await getActiveWorkspace(supabase, user.id)
  if (!active) redirect('/onboarding')

  const [{ data: workspace }, { data: profile }] = await Promise.all([
    supabase.from('workspaces').select('id, name, type, plan, plan_status, logo_url').eq('id', active.id).single(),
    supabase.from('profiles').select('is_platform_admin').eq('id', user.id).single(),
  ])

  const ctx: AutomationContext = {
    workspaceId: active.id,
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
    capabilities: automationCapabilities(ctx),
    modules: visibleAutomationModules(ctx),
  }
}

export async function requireAutomationModule(module: AutomationModule) {
  const session = await getAutomationSession()
  const access = canAccessAutomationModule(session.ctx, module)
  return { ...session, access }
}
