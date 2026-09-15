import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getActiveWorkspace, type WorkspaceLite } from '@/lib/workspace'
import { getDefaultPermissions } from '@/lib/permissions'
import {
  canAccessAdvertising, resolveCapabilities, surfaceHasAdvertising,
  type AdvertisingCapability, type AdvertisingContext, type Denial,
} from '../entitlements'
import { AD_PROVIDER_IDS, type AdProvider } from '../providers'

// One resolver every Advertising route calls first. It authenticates, resolves
// the active workspace, loads the plan, role, flags and connected providers,
// and returns a precomputed capability map.
//
// Route components never re-derive any of this, so a gate cannot drift between
// the sidebar, the page and the server action.

export type AdvertisingSession = {
  supabase: SupabaseClient
  userId: string
  userEmail: string
  userName: string
  workspace: WorkspaceLite
  workspaces: WorkspaceLite[]
  workspaceType: string
  role: string
  plan: string
  planStatus: string
  basePath: string
  connectedProviders: AdProvider[]
  capabilities: Record<AdvertisingCapability, boolean>
  entitlementContext: AdvertisingContext
}

export type AdvertisingGate =
  | { ok: true; session: AdvertisingSession }
  | { ok: false; denial: Denial; workspaces: WorkspaceLite[]; basePath: string; workspaceName: string }

/**
 * Resolves the session for an Advertising route. Cached per request so the
 * layout, page and any nested server component share a single round trip.
 */
export const getAdvertisingGate = cache(async (workspaceType: string): Promise<AdvertisingGate> => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const basePath = `/${workspaceType}/advertising`

  if (!user) redirect(`/login?next=${encodeURIComponent(basePath)}`)

  const { active, workspaces } = await getActiveWorkspace(supabase, user.id)
  if (!active) {
    return {
      ok: false, workspaces, basePath, workspaceName: 'No workspace',
      denial: { allowed: false, reason: 'workspace_status', message: 'You do not have access to a workspace yet.' },
    }
  }

  const { data: workspaceRow } = await supabase
    .from('workspaces')
    .select('plan, plan_status, settings, type')
    .eq('id', active.id)
    .maybeSingle()

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle()

  const settings = (workspaceRow?.settings ?? {}) as Record<string, unknown>
  const flags = (settings.feature_flags ?? {}) as Record<string, boolean>
  const role = active.role ?? 'creator'
  const plan = normalisePlan(workspaceRow?.plan as string | null)

  // Connected providers gate provider-dependent capabilities, so they are
  // resolved before the capability map is computed.
  const { data: connections } = await supabase
    .from('ad_connections')
    .select('provider')
    .eq('workspace_id', active.id)
    .in('status', ['connected', 'attention'])

  const connectedProviders = [...new Set((connections ?? [])
    .map(row => row.provider as AdProvider)
    .filter(provider => AD_PROVIDER_IDS.includes(provider)))]

  const entitlementContext: AdvertisingContext = {
    workspaceType,
    plan,
    planStatus: (workspaceRow?.plan_status as string | null) ?? 'active',
    role,
    permissions: getDefaultPermissions(role) as string[],
    flags,
    connectedProviders,
  }

  const access = canAccessAdvertising(entitlementContext)
  if (!access.allowed) {
    return { ok: false, denial: access, workspaces, basePath, workspaceName: active.name }
  }

  return {
    ok: true,
    session: {
      supabase,
      userId: user.id,
      userEmail: user.email ?? '',
      userName: (profile?.full_name as string | null) ?? user.email?.split('@')[0] ?? 'Member',
      workspace: active,
      workspaces,
      workspaceType,
      role,
      plan,
      planStatus: (workspaceRow?.plan_status as string | null) ?? 'active',
      basePath,
      connectedProviders,
      capabilities: resolveCapabilities(entitlementContext),
      entitlementContext,
    },
  }
})

/**
 * Route guard for the workspace segment itself. Advertising is only part of the
 * brand and agency products, so any other segment is simply not this module.
 */
export function assertAdvertisingSurface(workspaceType: string): boolean {
  return surfaceHasAdvertising(workspaceType)
}

/**
 * The workspaces table predates lib/plans.ts and uses its own plan names.
 * Mapped here rather than at every call site.
 */
function normalisePlan(plan: string | null | undefined): string {
  switch (plan) {
    case 'starter': return 'free'
    case 'brand': return 'agency'
    case 'creator_pro': return 'creator_pro'
    case 'team': return 'team'
    case 'enterprise': return 'enterprise'
    default: return plan ?? 'free'
  }
}
