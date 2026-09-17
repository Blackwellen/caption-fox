import { notFound } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireWorkspaceModule } from '@/lib/navigation/session'
import {
  canAccessStrategyModule, strategyCapabilities, visibleStrategyModules,
  type StrategyCapabilities, type StrategyContext,
} from './entitlements'
import {
  STRATEGY_ROUTE_KINDS, strategyPath, type StrategyModule, type StrategyRouteKind,
} from './constants'
import type { PersonLite } from './types'

/**
 * Every Strategy route starts here.
 *
 * Auth, workspace membership, workspace type, plan, role and feature flags are
 * resolved once, server-side, before a single record is read. A module the
 * workspace is not entitled to 404s — it is never rendered as an empty page,
 * a disabled tab or a fake upgrade shell.
 */
export interface StrategyPageContext {
  supabase: SupabaseClient
  userId: string
  kind: StrategyRouteKind
  ctx: StrategyContext
  capabilities: StrategyCapabilities
  /** Modules this workspace may open, in canonical tab order. */
  modules: StrategyModule[]
  workspace: { id: string; name: string; currency: string; timezone: string }
  people: PersonLite[]
  href: (module?: StrategyModule, ...rest: string[]) => string
}

export function isStrategyRouteKind(value: string): value is StrategyRouteKind {
  return (STRATEGY_ROUTE_KINDS as readonly string[]).includes(value)
}

export async function getStrategyPageContext(
  workspaceType: string,
  module: StrategyModule,
): Promise<StrategyPageContext> {
  if (!isStrategyRouteKind(workspaceType)) notFound()
  // Sidebar parity: a workspace whose navigation has no Strategy 404s by URL too.
  const session = await requireWorkspaceModule('strategy')
  const active = session.active!

  const ctx: StrategyContext = {
    workspaceId: active.id,
    workspaceType: active.type,
    plan: session.entitlements.plan,
    planStatus: session.entitlements.planStatus,
    role: active.role,
    isPlatformAdmin: session.isPlatformAdmin,
    flags: session.entitlements.flags ?? {},
  }

  if (!canAccessStrategyModule(ctx, module).allowed) notFound()

  const { supabase } = session
  const [{ data: workspaceRow }, people] = await Promise.all([
    supabase.from('workspaces').select('name, settings').eq('id', active.id).maybeSingle(),
    listWorkspacePeople(supabase, active.id),
  ])
  const settings = (workspaceRow?.settings ?? {}) as Record<string, unknown>

  return {
    supabase,
    userId: session.user.id,
    kind: workspaceType,
    ctx,
    capabilities: strategyCapabilities(ctx),
    modules: visibleStrategyModules(ctx),
    workspace: {
      id: active.id,
      name: workspaceRow?.name ?? active.name,
      currency: typeof settings.currency === 'string' ? settings.currency : 'GBP',
      timezone: typeof settings.timezone === 'string' ? settings.timezone : 'Europe/London',
    },
    people,
    href: (target = 'overview', ...rest) => strategyPath(workspaceType, target, ...rest),
  }
}

/** Workspace members for owner filters and pickers — never the whole profiles table. */
export async function listWorkspacePeople(supabase: SupabaseClient, workspaceId: string): Promise<PersonLite[]> {
  // workspace_members has two FKs to profiles (user_id, invited_by), so the
  // embed must name the relationship or PostgREST refuses it (PGRST201).
  const { data, error } = await supabase
    .from('workspace_members')
    .select('user_id, profiles!workspace_members_user_id_fkey!inner(id, full_name, email, avatar_url)')
    .eq('workspace_id', workspaceId)
  if (error) console.error('[strategy] workspace people query failed', { code: error.code })

  type Row = { user_id: string; profiles: PersonLite }
  return ((data ?? []) as unknown as Row[])
    .map(row => row.profiles)
    .filter(Boolean)
    .sort((a, b) => (a.full_name ?? a.email ?? '').localeCompare(b.full_name ?? b.email ?? ''))
}
