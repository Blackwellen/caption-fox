import { redirect } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getActiveWorkspace } from '@/lib/workspace'
import type { WorkspaceLite } from '@/lib/workspace-shared'
import {
  canAccessStrategyModule, strategyCapabilities, visibleStrategyModules,
  type ModuleAccess, type StrategyCapabilities, type StrategyContext,
} from './entitlements'
import type { StrategyModule } from './constants'

export interface StrategySession {
  supabase: SupabaseClient
  userId: string
  ctx: StrategyContext
  workspace: WorkspaceLite & { plan?: string | null; plan_status?: string | null; currency: string; timezone: string }
  capabilities: StrategyCapabilities
  modules: StrategyModule[]
}

/**
 * Resolves the authenticated session, active workspace, plan, role and feature
 * flags for the Strategy module. Redirects unauthenticated users to login and
 * users with no workspace to onboarding — every Strategy route funnels here.
 */
export async function getStrategySession(): Promise<StrategySession> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/app/strategy')

  const { active } = await getActiveWorkspace(supabase, user.id)
  if (!active) redirect('/onboarding')

  const [{ data: workspace }, { data: profile }] = await Promise.all([
    supabase.from('workspaces').select('id, name, type, plan, plan_status, logo_url, settings').eq('id', active.id).single(),
    supabase.from('profiles').select('is_platform_admin').eq('id', user.id).single(),
  ])

  const settings = (workspace?.settings ?? {}) as Record<string, unknown>
  const flags = (settings.feature_flags ?? {}) as Record<string, boolean>

  const ctx: StrategyContext = {
    workspaceId: active.id,
    workspaceType: workspace?.type ?? active.type,
    plan: workspace?.plan,
    planStatus: workspace?.plan_status,
    role: active.role,
    isPlatformAdmin: profile?.is_platform_admin ?? false,
    flags,
  }

  return {
    supabase,
    userId: user.id,
    ctx,
    workspace: {
      ...active,
      plan: workspace?.plan,
      plan_status: workspace?.plan_status,
      currency: (settings.currency as string) ?? 'GBP',
      timezone: (settings.timezone as string) ?? 'Europe/London',
    },
    capabilities: strategyCapabilities(ctx),
    modules: visibleStrategyModules(ctx),
  }
}

/**
 * Same as `getStrategySession`, plus a hard route-level gate for one module.
 * Returns the module's block reason instead of throwing so the page can render
 * the canonical no-access / upgrade state rather than a blank screen.
 */
export async function requireStrategyModule(
  module: StrategyModule,
): Promise<StrategySession & { access: ModuleAccess }> {
  const session = await getStrategySession()
  return { ...session, access: canAccessStrategyModule(session.ctx, module) }
}

/**
 * Workspace members, used to populate owner filters and owner pickers.
 * Scoped to the active workspace — never the whole profiles table.
 */
export async function listWorkspacePeople(supabase: SupabaseClient, workspaceId: string) {
  const { data } = await supabase
    .from('workspace_members')
    .select('user_id, profiles!inner(id, full_name, email, avatar_url)')
    .eq('workspace_id', workspaceId)

  type Row = { user_id: string; profiles: { id: string; full_name: string | null; email: string | null; avatar_url: string | null } }
  return ((data ?? []) as unknown as Row[])
    .map(row => row.profiles)
    .filter(Boolean)
    .sort((a, b) => (a.full_name ?? a.email ?? '').localeCompare(b.full_name ?? b.email ?? ''))
}
