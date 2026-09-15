import 'server-only'
import { redirect } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getActiveWorkspace } from '@/lib/workspace'
import type { WorkspaceLite } from '@/lib/workspace-shared'
import type { PlanId } from '@/lib/plans'
import {
  canAccessSeoCapability, mergedSourceCapabilities, seoCapabilities, seoCapabilityBlocker,
  tabCapability, visibleSeoTabs,
  type SeoBlocker, type SeoCapabilities, type SeoCapability, type SeoContext,
} from './entitlements'
import type {
  SeoDataFreshness, SeoSite, SeoSourceCapabilities, SeoSourceConnection, SeoTabId,
} from './types'
import { resolveDateRange } from './range'

export interface SeoSession {
  supabase: SupabaseClient
  userId: string
  workspace: WorkspaceLite
  ctx: SeoContext
  capabilities: SeoCapabilities
  tabs: SeoTabId[]
  site: SeoSite | null
  sites: SeoSite[]
  sources: SeoSourceConnection[]
  sourceCapabilities: SeoSourceCapabilities
  freshness: SeoDataFreshness
}

/**
 * Resolves session, active workspace, plan, role, active site and connected
 * sources. Every SEO route funnels through this — workspace and site scoping
 * is decided here on the server and never trusted from the client.
 */
export async function getSeoSession(searchParams?: Record<string, string | string[] | undefined>): Promise<SeoSession> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/app/seo')

  const { active } = await getActiveWorkspace(supabase, user.id)
  if (!active) redirect('/onboarding')

  const [{ data: workspace }, { data: profile }, { data: membership }] = await Promise.all([
    supabase.from('workspaces').select('id, name, type, plan, plan_status, settings').eq('id', active.id).maybeSingle(),
    supabase.from('profiles').select('is_platform_admin').eq('id', user.id).maybeSingle(),
    supabase.from('workspace_members').select('role, permissions').eq('workspace_id', active.id).eq('user_id', user.id).maybeSingle(),
  ])

  const settings = (workspace?.settings ?? {}) as { feature_flags?: Record<string, boolean> }

  const ctx: SeoContext = {
    workspaceId: active.id,
    workspaceType: workspace?.type ?? active.type ?? null,
    plan: ((workspace?.plan as PlanId) ?? 'free'),
    role: membership?.role ?? active.role ?? 'viewer',
    permissions: (membership?.permissions as string[] | null) ?? null,
    featureFlags: settings.feature_flags ?? null,
    workspaceStatus: workspace?.plan_status ?? null,
    isPlatformAdmin: profile?.is_platform_admin ?? false,
  }

  // Sites are always workspace-scoped server side; the `site` query param can
  // only ever select among sites this workspace already owns.
  const { data: siteRows } = await supabase
    .from('seo_sites')
    .select('id, workspace_id, name, domain, is_primary, status, timezone, default_country, default_device, default_search_engine, is_demo')
    .eq('workspace_id', active.id)
    .is('archived_at', null)
    .order('is_primary', { ascending: false })
    .order('name')

  const sites = (siteRows ?? []) as SeoSite[]
  const requested = typeof searchParams?.site === 'string' ? searchParams.site : undefined
  const site = sites.find(s => s.id === requested) ?? sites[0] ?? null

  let sources: SeoSourceConnection[] = []
  if (site) {
    const { data } = await supabase
      .from('seo_source_connections')
      .select('id, site_id, provider, property_label, property_ref, status, is_primary, capabilities, coverage_keywords, coverage_note, last_synced_at, last_attempt_at, last_error, sync_frequency, is_demo')
      .eq('workspace_id', active.id)
      .eq('site_id', site.id)
      .order('is_primary', { ascending: false })
    sources = (data ?? []) as SeoSourceConnection[]
  }

  return {
    supabase,
    userId: user.id,
    workspace: active,
    ctx,
    capabilities: seoCapabilities(ctx),
    tabs: visibleSeoTabs(ctx),
    site,
    sites,
    sources,
    sourceCapabilities: mergedSourceCapabilities(sources),
    freshness: buildFreshness(site, sources),
  }
}

function buildFreshness(site: SeoSite | null, sources: SeoSourceConnection[]): SeoDataFreshness {
  const connected = sources.filter(s => s.status === 'connected')
  const successTimes = connected.map(s => s.last_synced_at).filter(Boolean) as string[]
  const attemptTimes = sources.map(s => s.last_attempt_at).filter(Boolean) as string[]
  const lastSuccess = successTimes.sort().at(-1) ?? null
  const lastAttempt = attemptTimes.sort().at(-1) ?? null

  let status: SeoDataFreshness['status'] = 'never'
  if (sources.some(s => s.status === 'error')) status = 'failed'
  else if (!lastSuccess) status = 'never'
  else if (connected.length < sources.length) status = 'partial'
  else status = Date.now() - new Date(lastSuccess).getTime() > 36 * 3_600_000 ? 'stale' : 'up_to_date'

  return {
    lastSuccessfulSync: lastSuccess,
    lastAttemptedSync: lastAttempt,
    status,
    coverageNote: connected.length
      ? `${connected.length} of ${sources.length} sources connected`
      : 'No sources connected',
    timezone: site?.timezone ?? 'Europe/London',
    country: site?.default_country ?? 'gb',
    device: site?.default_device ?? 'desktop',
    searchEngine: site?.default_search_engine ?? 'google',
    providers: sources.map(s => ({
      provider: s.provider,
      label: s.property_label ?? s.provider,
      lastSyncedAt: s.last_synced_at,
      status: s.status,
    })),
  }
}

export interface SeoRouteGuard extends SeoSession {
  tab: SeoTabId
  blocked: SeoBlocker
  range: ReturnType<typeof resolveDateRange>
}

/**
 * Session plus a hard route-level gate for one surface. Returns the block
 * reason rather than throwing so the page renders the canonical no-access or
 * upgrade state.
 */
export async function requireSeoTab(
  tab: SeoTabId,
  searchParams?: Record<string, string | string[] | undefined>,
): Promise<SeoRouteGuard> {
  const session = await getSeoSession(searchParams)
  return {
    ...session,
    tab,
    blocked: seoCapabilityBlocker(session.ctx, tabCapability(tab)),
    range: resolveDateRange(searchParams),
  }
}

/** Server-side action gate. Throws so no mutation runs without permission. */
export function assertSeoCapability(ctx: SeoContext, capability: SeoCapability): void {
  if (!canAccessSeoCapability(ctx, capability)) {
    throw new Error(`Not permitted: ${capability}`)
  }
}
