// Central Calendar entitlement resolver.
//
// Workspace type, plan, role and feature flags are combined in exactly one place
// so no UI file ever compares a workspace type inline. Anything a workspace is
// not entitled to is OMITTED — never rendered as a dead tab, blank page or
// "coming soon" placeholder.

import { getPlan, type PlanId } from '@/lib/plans'
import { getDefaultPermissions, PERMISSIONS, type Permission } from '@/lib/permissions'
import type { CalendarTabId, CalendarSurface } from './types'

export type CalendarCapability =
  // surfaces
  | 'calendar.view'
  | 'calendar.publishingQueue'
  | 'calendar.agenda'
  | 'calendar.conflicts'
  // actions
  | 'calendar.create'
  | 'calendar.edit'
  | 'calendar.delete'
  | 'calendar.reschedule'
  | 'calendar.import'
  | 'calendar.export'
  | 'queue.create'
  | 'queue.edit'
  | 'queue.approve'
  | 'queue.publish'
  | 'queue.bulkPublish'
  | 'queue.retry'
  | 'queue.cancel'
  | 'agenda.create'
  | 'agenda.complete'
  | 'conflicts.assign'
  | 'conflicts.resolve'
  | 'conflicts.dismiss'
  | 'conflicts.reopen'
  // advanced views
  | 'calendar.weekView'
  | 'calendar.dayView'
  | 'calendar.teamCapacity'

/** Workspace types that receive the Calendar module at all. */
const CALENDAR_SURFACES: CalendarSurface[] = ['creator', 'business', 'brand', 'agency']

/**
 * Plan floor per capability. `free` gets the calendar itself but not the
 * operational surfaces; team capacity and conflict automation are paid.
 */
const PLAN_RANK: Record<PlanId, number> = {
  free: 0, creator_pro: 1, team: 2, agency: 3, enterprise: 4,
}

const PLAN_FLOOR: Partial<Record<CalendarCapability, PlanId>> = {
  'calendar.view': 'free',
  'calendar.publishingQueue': 'creator_pro',
  'calendar.agenda': 'creator_pro',
  'calendar.conflicts': 'team',
  'calendar.weekView': 'creator_pro',
  'calendar.dayView': 'creator_pro',
  'calendar.teamCapacity': 'team',
  'queue.bulkPublish': 'team',
  'calendar.import': 'creator_pro',
}

/** Permission required to exercise a capability. View caps need none beyond membership. */
const PERMISSION_FOR: Partial<Record<CalendarCapability, Permission>> = {
  'calendar.create': PERMISSIONS.SCHEDULE_POST,
  'calendar.edit': PERMISSIONS.EDIT_POST,
  'calendar.delete': PERMISSIONS.DELETE_POST,
  'calendar.reschedule': PERMISSIONS.SCHEDULE_POST,
  'calendar.import': PERMISSIONS.CREATE_POST,
  'calendar.export': PERMISSIONS.EXPORT_DATA,
  'queue.create': PERMISSIONS.SCHEDULE_POST,
  'queue.edit': PERMISSIONS.EDIT_POST,
  'queue.approve': PERMISSIONS.APPROVE_POST,
  'queue.publish': PERMISSIONS.PUBLISH_POST,
  'queue.bulkPublish': PERMISSIONS.PUBLISH_POST,
  'queue.retry': PERMISSIONS.PUBLISH_POST,
  'queue.cancel': PERMISSIONS.SCHEDULE_POST,
  'agenda.create': PERMISSIONS.CREATE_POST,
  'agenda.complete': PERMISSIONS.EDIT_POST,
  'conflicts.assign': PERMISSIONS.EDIT_CAMPAIGN,
  'conflicts.resolve': PERMISSIONS.EDIT_CAMPAIGN,
  'conflicts.dismiss': PERMISSIONS.EDIT_CAMPAIGN,
  'conflicts.reopen': PERMISSIONS.EDIT_CAMPAIGN,
}

/** Feature-flag keys, resolved independently from plan and add-on gating. */
const FLAG_FOR: Partial<Record<CalendarCapability, string>> = {
  'calendar.conflicts': 'calendar_conflicts',
  'calendar.teamCapacity': 'calendar_team_capacity',
  'queue.bulkPublish': 'queue_bulk_publish',
}

export interface CalendarContext {
  workspaceId: string
  workspaceType: string | null
  surface: CalendarSurface
  basePath: string
  planId: PlanId
  role: string
  permissions: string[]
  /** Flags explicitly disabled for this workspace. Absent key = enabled. */
  flags: Record<string, boolean>
  timezone: string
  weekStartsOn: 0 | 1
  locale: string
  userId: string
  userName: string | null
  userEmail: string | null
  isReadOnly: boolean
}

export function isCalendarSurface(type: string | null | undefined): type is CalendarSurface {
  return !!type && (CALENDAR_SURFACES as string[]).includes(type)
}

export function canAccessCalendarCapability(ctx: CalendarContext, capability: CalendarCapability): boolean {
  // 1. Feature flag — independent of plan/add-on.
  const flag = FLAG_FOR[capability]
  if (flag && ctx.flags[flag] === false) return false

  // 2. Plan floor.
  const floor = PLAN_FLOOR[capability]
  if (floor && PLAN_RANK[ctx.planId] < PLAN_RANK[floor]) return false

  // 3. Role permission.
  const permission = PERMISSION_FOR[capability]
  if (permission && !ctx.permissions.includes(permission)) return false

  // 4. Read-only members never get mutating capabilities.
  if (ctx.isReadOnly && permission) return false

  return true
}

/** Reason a capability is unavailable, for a truthful upgrade/permission state. */
export function capabilityBlockReason(
  ctx: CalendarContext,
  capability: CalendarCapability,
): { reason: 'flag' | 'plan' | 'permission'; requiredPlan?: PlanId } | null {
  const flag = FLAG_FOR[capability]
  if (flag && ctx.flags[flag] === false) return { reason: 'flag' }
  const floor = PLAN_FLOOR[capability]
  if (floor && PLAN_RANK[ctx.planId] < PLAN_RANK[floor]) return { reason: 'plan', requiredPlan: floor }
  const permission = PERMISSION_FOR[capability]
  if (permission && (ctx.isReadOnly || !ctx.permissions.includes(permission))) return { reason: 'permission' }
  return null
}

export const TAB_CAPABILITY: Record<CalendarTabId, CalendarCapability> = {
  'calendar': 'calendar.view',
  'publishing-queue': 'calendar.publishingQueue',
  'agenda': 'calendar.agenda',
  'conflicts': 'calendar.conflicts',
}

const TAB_LABELS: Record<CalendarTabId, string> = {
  'calendar': 'Calendar',
  'publishing-queue': 'Publishing Queue',
  'agenda': 'Agenda',
  'conflicts': 'Conflicts',
}

/** Sub-tabs this workspace is entitled to. Unavailable tabs are omitted entirely. */
export function visibleCalendarTabs(ctx: CalendarContext): { id: CalendarTabId; label: string; href: string }[] {
  return (Object.keys(TAB_CAPABILITY) as CalendarTabId[])
    .filter(tab => canAccessCalendarCapability(ctx, TAB_CAPABILITY[tab]))
    .map(tab => ({
      id: tab,
      label: TAB_LABELS[tab],
      href: tab === 'calendar' ? `${ctx.basePath}/calendar` : `${ctx.basePath}/calendar/${tab}`,
    }))
}

export function planLabel(planId: PlanId): string {
  return getPlan(planId).name
}

/**
 * `workspaces.plan` uses the billing enum (starter/creator_pro/team/brand/
 * enterprise); `lib/plans` uses the product enum. Mapped in one place.
 */
export function normalisePlanId(plan: string | null | undefined): PlanId {
  switch (plan) {
    case 'creator_pro': return 'creator_pro'
    case 'team': return 'team'
    case 'brand':
    case 'agency': return 'agency'
    case 'enterprise': return 'enterprise'
    default: return 'free'
  }
}

/**
 * `workspace_members.role` uses the membership enum (owner/admin/manager/
 * member/viewer/ugc_creator); `lib/permissions` keys off product roles.
 */
export function normaliseRole(role: string | null | undefined): string {
  switch (role) {
    case 'owner': return 'owner'
    case 'admin': return 'admin'
    case 'manager': return 'manager'
    case 'viewer': return 'client'
    case 'ugc_creator': return 'external_creator'
    default: return 'creator'
  }
}

/** Build a context from resolved workspace/member/profile data. */
export function buildCalendarContext(input: {
  workspaceId: string
  workspaceType: string | null
  basePath: string
  planId: string | null | undefined
  role: string | null | undefined
  permissions?: string[] | null
  flags?: Record<string, boolean> | null
  timezone?: string | null
  weekStartsOn?: number | null
  locale?: string | null
  userId: string
  userName?: string | null
  userEmail?: string | null
}): CalendarContext {
  const role = normaliseRole(input.role)
  const permissions = input.permissions?.length
    ? input.permissions
    : (getDefaultPermissions(role) as string[])
  const surface: CalendarSurface = isCalendarSurface(input.workspaceType)
    ? input.workspaceType
    : input.workspaceType === 'small_business'
      ? 'business'
      : 'creator'

  return {
    workspaceId: input.workspaceId,
    workspaceType: input.workspaceType ?? null,
    surface,
    basePath: input.basePath,
    planId: normalisePlanId(input.planId),
    role,
    permissions,
    flags: input.flags ?? {},
    timezone: input.timezone || 'Europe/London',
    weekStartsOn: input.weekStartsOn === 0 ? 0 : 1,
    locale: input.locale || 'en-GB',
    userId: input.userId,
    userName: input.userName ?? null,
    userEmail: input.userEmail ?? null,
    isReadOnly: role === 'client' || role === 'analyst',
  }
}
