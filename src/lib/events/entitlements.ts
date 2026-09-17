// Central Events entitlement resolver.
//
// Workspace type, plan, role, feature flags and provider connections are
// combined in exactly ONE place so no UI file ever compares a workspace type
// inline. Anything a workspace is not entitled to is OMITTED — never rendered
// as a dead tab, blank route or "coming soon" placeholder.

import { getPlan, type PlanId } from '@/lib/plans'
import { getDefaultPermissions, PERMISSIONS, type Permission } from '@/lib/permissions'
import type { EventsSurface, EventsTabId } from './types'

export type EventsCapability =
  // surfaces
  | 'events.overview'
  | 'events.directory'
  | 'events.webinars'
  | 'events.podcasts'
  | 'events.sponsorships'
  | 'events.followUp'
  // actions
  | 'events.create'
  | 'events.edit'
  | 'events.delete'
  | 'events.export'
  | 'events.import'
  | 'registrations.view'
  | 'registrations.manage'
  | 'sessions.manage'
  | 'webinars.manage'
  | 'podcasts.manage'
  | 'podcasts.publish'
  | 'sponsorships.manage'
  | 'sponsorships.viewFinancials'
  | 'sponsorships.approve'
  | 'followUp.manage'
  | 'followUp.sequences'
  | 'galaDock.connect'
  // advanced views
  | 'views.calendar'
  | 'views.timeline'
  | 'views.pipeline'
  | 'views.savedViews'

/**
 * Workspace types that receive the Events module at all.
 *
 * Creator workspaces are included but resolve to a reduced surface set
 * (webinars + podcasts + follow-up) — see SURFACE_TABS below.
 */
const EVENTS_SURFACES: EventsSurface[] = ['creator', 'business', 'brand', 'agency']

/** Route segment -> shell surface. Mirrors the catch-all route map. */
export const EVENTS_ROUTE_SURFACES: Record<string, EventsSurface> = {
  creator: 'creator',
  business: 'business',
  brand: 'brand',
  agency: 'agency',
}

/**
 * Which module surfaces each workspace type can ever see. Creators run
 * webinars and podcasts as marketing surfaces; they do not get the full
 * multi-event directory or sponsorship pipeline in V1.
 */
const SURFACE_TABS: Record<EventsSurface, EventsTabId[]> = {
  creator: ['overview', 'webinars', 'podcasts', 'follow-up'],
  business: ['overview', 'events', 'webinars', 'podcasts', 'sponsorships', 'follow-up'],
  brand: ['overview', 'events', 'webinars', 'podcasts', 'sponsorships', 'follow-up'],
  agency: ['overview', 'events', 'webinars', 'podcasts', 'sponsorships', 'follow-up'],
}

const PLAN_RANK: Record<PlanId, number> = {
  free: 0,
  creator_pro: 1,
  team: 2,
  agency: 3,
  enterprise: 4,
}

/** Minimum plan required per capability. Absent = available on every plan. */
const PLAN_FLOOR: Partial<Record<EventsCapability, PlanId>> = {
  'events.webinars': 'creator_pro',
  'events.podcasts': 'creator_pro',
  'events.sponsorships': 'team',
  'events.import': 'team',
  'followUp.sequences': 'team',
  'views.savedViews': 'team',
  'views.pipeline': 'team',
  'views.timeline': 'creator_pro',
}

/** Permission required per capability. */
const PERMISSION_FOR: Record<EventsCapability, Permission> = {
  'events.overview': PERMISSIONS.EVENTS_VIEW,
  'events.directory': PERMISSIONS.EVENTS_VIEW,
  'events.webinars': PERMISSIONS.EVENTS_WEBINARS_VIEW,
  'events.podcasts': PERMISSIONS.EVENTS_PODCASTS_VIEW,
  'events.sponsorships': PERMISSIONS.EVENTS_SPONSORSHIPS_VIEW,
  'events.followUp': PERMISSIONS.EVENTS_FOLLOWUP_VIEW,
  'events.create': PERMISSIONS.EVENTS_CREATE,
  'events.edit': PERMISSIONS.EVENTS_EDIT,
  'events.delete': PERMISSIONS.EVENTS_DELETE,
  'events.export': PERMISSIONS.EVENTS_EXPORT,
  'events.import': PERMISSIONS.EVENTS_IMPORT,
  'registrations.view': PERMISSIONS.EVENTS_REGISTRATIONS_VIEW,
  'registrations.manage': PERMISSIONS.EVENTS_REGISTRATIONS_MANAGE,
  'sessions.manage': PERMISSIONS.EVENTS_SESSIONS_MANAGE,
  'webinars.manage': PERMISSIONS.EVENTS_WEBINARS_MANAGE,
  'podcasts.manage': PERMISSIONS.EVENTS_PODCASTS_MANAGE,
  'podcasts.publish': PERMISSIONS.EVENTS_PODCASTS_PUBLISH,
  'sponsorships.manage': PERMISSIONS.EVENTS_SPONSORSHIPS_MANAGE,
  'sponsorships.viewFinancials': PERMISSIONS.EVENTS_SPONSORSHIPS_VIEW_FINANCIALS,
  'sponsorships.approve': PERMISSIONS.EVENTS_SPONSORSHIPS_APPROVE,
  'followUp.manage': PERMISSIONS.EVENTS_FOLLOWUP_MANAGE,
  'followUp.sequences': PERMISSIONS.EVENTS_FOLLOWUP_SEQUENCES_MANAGE,
  'galaDock.connect': PERMISSIONS.EVENTS_GALA_DOCK_CONNECT,
  'views.calendar': PERMISSIONS.EVENTS_VIEW,
  'views.timeline': PERMISSIONS.EVENTS_VIEW,
  'views.pipeline': PERMISSIONS.EVENTS_SPONSORSHIPS_VIEW,
  'views.savedViews': PERMISSIONS.EVENTS_VIEW,
}

/** Capability -> the surface tab it belongs to, so surface gating cascades. */
const TAB_FOR: Partial<Record<EventsCapability, EventsTabId>> = {
  'events.directory': 'events',
  'events.webinars': 'webinars',
  'events.podcasts': 'podcasts',
  'events.sponsorships': 'sponsorships',
  'events.followUp': 'follow-up',
  'webinars.manage': 'webinars',
  'podcasts.manage': 'podcasts',
  'podcasts.publish': 'podcasts',
  'sponsorships.manage': 'sponsorships',
  'sponsorships.viewFinancials': 'sponsorships',
  'sponsorships.approve': 'sponsorships',
  'followUp.manage': 'follow-up',
  'followUp.sequences': 'follow-up',
  'views.pipeline': 'sponsorships',
}

export interface EventsContext {
  surface: EventsSurface
  plan: PlanId
  role: string
  /** Explicit per-member permission overrides stored on workspace_members. */
  permissions?: string[] | null
  /** Feature flags from workspace settings; `events.*` keys disable surfaces. */
  featureFlags?: Record<string, boolean> | null
  workspaceStatus?: string | null
}

function effectivePermissions(ctx: EventsContext): string[] {
  if (ctx.permissions && ctx.permissions.length > 0) return ctx.permissions
  return getDefaultPermissions(ctx.role) as string[]
}

function planAllows(capability: EventsCapability, plan: PlanId): boolean {
  const floor = PLAN_FLOOR[capability]
  if (!floor) return true
  return PLAN_RANK[plan] >= PLAN_RANK[floor]
}

function flagAllows(capability: EventsCapability, flags?: Record<string, boolean> | null): boolean {
  if (!flags) return true
  if (flags['events'] === false) return false
  const tab = TAB_FOR[capability]
  if (tab && flags[`events.${tab}`] === false) return false
  return flags[`capability.${capability}`] !== false
}

/** Does this workspace type receive the Events module at all? */
export function surfaceHasEvents(surface: string): surface is EventsSurface {
  return (EVENTS_SURFACES as string[]).includes(surface)
}

/** The single gate every server component, action and API route calls. */
/**
 * Capabilities that change data. A suspended workspace keeps read access to
 * its own records — it just cannot mutate them — which is what the suspended
 * locked-state copy promises ("before event data can be changed"). Blocking
 * reads as well would 404 the whole module and lock a customer out of their
 * own event history over a billing problem.
 */
const MUTATING_CAPABILITIES = new Set<EventsCapability>([
  'events.create', 'events.edit', 'events.delete', 'events.import',
  'registrations.manage', 'sessions.manage', 'webinars.manage',
  'podcasts.manage', 'podcasts.publish', 'sponsorships.manage',
  'sponsorships.approve', 'followUp.manage', 'followUp.sequences',
  'galaDock.connect',
])

export function canAccessEventsCapability(ctx: EventsContext, capability: EventsCapability): boolean {
  if (!surfaceHasEvents(ctx.surface)) return false
  if (ctx.workspaceStatus === 'suspended' && MUTATING_CAPABILITIES.has(capability)) return false

  const tab = TAB_FOR[capability]
  if (tab && !SURFACE_TABS[ctx.surface].includes(tab)) return false

  if (!planAllows(capability, ctx.plan)) return false
  if (!flagAllows(capability, ctx.featureFlags)) return false

  return effectivePermissions(ctx).includes(PERMISSION_FOR[capability])
}

/**
 * Reason a capability is unavailable — drives upgrade vs. permission states.
 * Returns null when the capability IS available.
 */
export function eventsCapabilityBlocker(
  ctx: EventsContext,
  capability: EventsCapability,
): 'workspace-type' | 'plan' | 'feature-flag' | 'permission' | 'workspace-status' | null {
  if (!surfaceHasEvents(ctx.surface)) return 'workspace-type'
  // Mirrors canAccessEventsCapability: suspension blocks changes, not reads.
  if (ctx.workspaceStatus === 'suspended' && MUTATING_CAPABILITIES.has(capability)) return 'workspace-status'
  const tab = TAB_FOR[capability]
  if (tab && !SURFACE_TABS[ctx.surface].includes(tab)) return 'workspace-type'
  if (!planAllows(capability, ctx.plan)) return 'plan'
  if (!flagAllows(capability, ctx.featureFlags)) return 'feature-flag'
  if (!effectivePermissions(ctx).includes(PERMISSION_FOR[capability])) return 'permission'
  return null
}

/** Minimum plan that unlocks a capability, for upgrade copy. */
export function requiredPlanFor(capability: EventsCapability): PlanId | null {
  return PLAN_FLOOR[capability] ?? null
}

export function planName(plan: PlanId): string {
  return getPlan(plan).name
}

const TAB_CAPABILITY: Record<EventsTabId, EventsCapability> = {
  overview: 'events.overview',
  events: 'events.directory',
  webinars: 'events.webinars',
  podcasts: 'events.podcasts',
  sponsorships: 'events.sponsorships',
  'follow-up': 'events.followUp',
}

export const EVENTS_TAB_ORDER: EventsTabId[] = [
  'overview', 'events', 'webinars', 'podcasts', 'sponsorships', 'follow-up',
]

export const EVENTS_TAB_LABELS: Record<EventsTabId, string> = {
  overview: 'Overview',
  events: 'Events',
  webinars: 'Webinars',
  podcasts: 'Podcasts',
  sponsorships: 'Sponsorships',
  'follow-up': 'Follow-up',
}

/** Navigation is entitlement-driven: hidden tabs are omitted, never disabled. */
export function visibleEventsTabs(ctx: EventsContext): EventsTabId[] {
  return EVENTS_TAB_ORDER.filter(tab => canAccessEventsCapability(ctx, TAB_CAPABILITY[tab]))
}

export function tabCapability(tab: EventsTabId): EventsCapability {
  return TAB_CAPABILITY[tab]
}

/** Which view modes a surface may offer, after plan gating. */
export function availableViews(
  ctx: EventsContext,
  candidates: readonly string[],
): string[] {
  return candidates.filter(view => {
    if (view === 'calendar') return canAccessEventsCapability(ctx, 'views.calendar')
    if (view === 'timeline') return canAccessEventsCapability(ctx, 'views.timeline')
    if (view === 'pipeline') return canAccessEventsCapability(ctx, 'views.pipeline')
    return true
  })
}
