import { notFound, redirect } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getActiveWorkspace } from '@/lib/workspace'
import type { WorkspaceLite } from '@/lib/workspace-shared'
import {
  canAccessEventsCapability, EVENTS_ROUTE_SURFACES, eventsCapabilityBlocker,
  requiredPlanFor, tabCapability, visibleEventsTabs, planName,
  type EventsCapability, type EventsContext,
} from './entitlements'
import { resolveEventsContext, type EventsWorkspace } from './queries'
import type { EventsFilters, EventsTabId, EventViewMode } from './types'

/**
 * Every Events route starts here.
 *
 * Auth, workspace resolution, membership, plan, role, feature flags and tab
 * entitlement are resolved once, server-side, before a single record is read.
 * A route the workspace cannot access 404s rather than rendering an empty shell.
 */
export interface EventsPageContext {
  supabase: SupabaseClient
  userId: string
  routeSegment: string
  basePath: string
  workspaceRoot: string
  workspace: EventsWorkspace
  ctx: EventsContext
  workspaces: WorkspaceLite[]
  visibleTabs: EventsTabId[]
  user: { name: string; role: string; avatarUrl: string | null }
  notificationCount: number
  planUsage: { label: string; used: number; limit: number } | null
  can: (capability: EventsCapability) => boolean
  blocker: (capability: EventsCapability) => ReturnType<typeof eventsCapabilityBlocker>
  requiredPlanLabel: (capability: EventsCapability) => string | null
}

export async function getEventsPageContext(
  routeSegment: string,
  tab: EventsTabId,
): Promise<EventsPageContext> {
  const surface = EVENTS_ROUTE_SURFACES[routeSegment]
  if (!surface) notFound()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    const target = tab === 'overview' ? `/${routeSegment}/events` : `/${routeSegment}/events/${tab}`
    redirect(`/login?next=${encodeURIComponent(target)}`)
  }

  const { active, workspaces } = await getActiveWorkspace(supabase, user.id)
  if (!active) redirect('/onboarding')

  const resolved = await resolveEventsContext(supabase, active.id, user.id, surface)
  // Not a member of the workspace behind this route: 404 rather than leak that
  // the workspace exists.
  if (!resolved) notFound()

  const tabs = visibleEventsTabs(resolved.ctx)
  if (!tabs.includes(tab)) notFound()

  const [{ data: profile }, { count: notificationCount }, { count: contactCount }] = await Promise.all([
    supabase.from('profiles').select('full_name, job_title, avatar_url').eq('id', user.id).maybeSingle(),
    supabase.from('notifications').select('id', { count: 'exact', head: true })
      .eq('user_id', user.id).eq('is_read', false),
    supabase.from('event_registrations').select('id', { count: 'exact', head: true })
      .eq('workspace_id', resolved.workspace.id),
  ])

  return {
    supabase,
    userId: user.id,
    routeSegment,
    basePath: `/${routeSegment}/events`,
    workspaceRoot: `/${routeSegment}`,
    workspace: resolved.workspace,
    ctx: resolved.ctx,
    workspaces,
    visibleTabs: tabs,
    user: {
      name: (profile?.full_name as string) ?? user.email?.split('@')[0] ?? 'Team member',
      role: (profile?.job_title as string) ?? roleLabel(resolved.ctx.role),
      avatarUrl: (profile?.avatar_url as string) ?? null,
    },
    notificationCount: notificationCount ?? 0,
    planUsage: {
      label: `${planName(resolved.workspace.plan)} Plan`,
      used: contactCount ?? 0,
      limit: contactLimitFor(resolved.workspace.plan),
    },
    can: capability => canAccessEventsCapability(resolved.ctx, capability),
    blocker: capability => eventsCapabilityBlocker(resolved.ctx, capability),
    requiredPlanLabel: capability => {
      const plan = requiredPlanFor(capability)
      return plan ? planName(plan) : null
    },
  }
}

function roleLabel(role: string): string {
  return role.replaceAll('_', ' ').replace(/\b\w/g, character => character.toUpperCase())
}

function contactLimitFor(plan: string): number {
  const limits: Record<string, number> = {
    free: 500, creator_pro: 2_500, team: 10_000, agency: 25_000, enterprise: 100_000,
  }
  return limits[plan] ?? 500
}

export { tabCapability }

/** Parses query params into typed, bounded filters. Invalid input is ignored. */
export function parseEventsFilters(
  searchParams: Record<string, string | string[] | undefined>,
  allowedViews: EventViewMode[],
  defaultView: EventViewMode,
): EventsFilters & { view: EventViewMode; range: number } {
  const one = (key: string): string | undefined => {
    const value = searchParams[key]
    const raw = Array.isArray(value) ? value[0] : value
    return raw?.trim() ? raw.trim().slice(0, 120) : undefined
  }
  const requestedView = one('view') as EventViewMode | undefined
  const range = Number(one('range'))

  return {
    q: one('q'),
    type: one('type'),
    status: one('status'),
    owner: one('owner'),
    event: one('event'),
    sequence: one('sequence'),
    sponsor: one('sponsor'),
    tier: one('tier'),
    topic: one('topic'),
    speaker: one('speaker'),
    platform: one('platform'),
    recording: one('recording'),
    distribution: one('distribution'),
    dateFrom: one('dateFrom'),
    dateTo: one('dateTo'),
    sort: one('sort'),
    page: Math.max(1, Number(one('page')) || 1),
    pageSize: [10, 25, 50].includes(Number(one('pageSize'))) ? Number(one('pageSize')) : 10,
    view: requestedView && allowedViews.includes(requestedView) ? requestedView : defaultView,
    range: [7, 30, 90].includes(range) ? range : 30,
  }
}
