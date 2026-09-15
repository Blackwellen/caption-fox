import { redirect } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getActiveWorkspace } from '@/lib/workspace'
import type { WorkspaceLite } from '@/lib/workspace-shared'
import {
  marketplaceCapabilities, canAccessMarketplaceModule, visibleMarketplaceModules,
  type MarketplaceCapabilities, type MarketplaceContext,
} from './entitlements'
import type { MarketplaceModule } from './module'

export interface MarketplaceSession {
  supabase: SupabaseClient
  userId: string
  ctx: MarketplaceContext
  workspace: WorkspaceLite & { plan?: string | null; plan_status?: string | null }
  capabilities: MarketplaceCapabilities
  modules: MarketplaceModule[]
}

/**
 * Resolves the authenticated session, active workspace, plan and role for the
 * Marketplace module. Every Marketplace route funnels through this: unauthenticated
 * users go to login, users without a workspace go to onboarding.
 */
export async function getMarketplaceSession(): Promise<MarketplaceSession> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/app/marketplace')

  const { active } = await getActiveWorkspace(supabase, user.id)
  if (!active) redirect('/onboarding')

  const [{ data: workspace }, { data: profile }] = await Promise.all([
    supabase.from('workspaces').select('id, name, type, plan, plan_status, logo_url').eq('id', active.id).single(),
    supabase.from('profiles').select('is_platform_admin').eq('id', user.id).single(),
  ])

  const ctx: MarketplaceContext = {
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
    capabilities: marketplaceCapabilities(ctx),
    modules: visibleMarketplaceModules(ctx),
  }
}

/**
 * Same as `getMarketplaceSession`, plus a hard route-level gate for one module.
 * Returns the block reason instead of throwing so the page can render the
 * canonical no-access / upgrade state inside the shell.
 */
export async function requireMarketplaceModule(module: MarketplaceModule) {
  const session = await getMarketplaceSession()
  const access = canAccessMarketplaceModule(session.ctx, module)
  return { ...session, access }
}
