// Central Inbox + Fox AI capability resolver.
//
// Workspace type, plan, role, member permission overrides and feature flags are
// combined here once. UI files ask `can(capability)`; server actions and API
// routes call `canAccessInboxCapability` again with a freshly resolved context,
// so a hidden control can never be triggered by a crafted request.

import { getDefaultPermissions, PERMISSIONS } from '@/lib/permissions'
import type { PlanId } from '@/lib/plans'
import type { InboxTabId } from './types'

export type InboxSurface = 'creator' | 'business' | 'brand' | 'agency'

export type InboxCapability =
  | 'inbox.view'
  | 'inbox.reply'
  | 'inbox.note'
  | 'inbox.assign'
  | 'inbox.bulk_manage'
  | 'inbox.close'
  | 'inbox.snooze'
  | 'inbox.tags.manage'
  | 'inbox.sla.manage'
  | 'inbox.routing.manage'
  | 'inbox.export'
  | 'inbox.import'
  | 'inbox.saved_views.create'
  | 'inbox.saved_views.share'
  | 'inbox.assignments'
  | 'inbox.saved_views'
  | 'contacts.view'
  | 'contacts.edit'
  | 'contacts.import'
  | 'group_chat.use'
  | 'copilot.use'
  | 'ai_create.use'
  | 'agent.use'
  | 'agent.approve'
  | 'tasks.view'
  | 'tasks.edit'
  | 'alerts.view'
  | 'alerts.manage'
  | 'media_generate.use'

export interface InboxContext {
  surface: InboxSurface
  plan: PlanId
  role: string
  permissions?: string[] | null
  featureFlags?: Record<string, boolean> | null
  workspaceStatus?: string | null
}

const PLAN_RANK: Record<PlanId, number> = { free: 0, creator_pro: 1, team: 2, agency: 3, enterprise: 4 }

/**
 * Fox AI is a paid capability: it is not available on the free/starter plan
 * (cost control — every call is metered against Azure). Team routing surfaces
 * (Assignments, shared Saved Views, bulk management) need a multi-seat plan.
 */
const PLAN_FLOOR: Partial<Record<InboxCapability, PlanId>> = {
  'inbox.assignments': 'team',
  'inbox.bulk_manage': 'team',
  'inbox.saved_views.share': 'team',
  'inbox.routing.manage': 'team',
  'inbox.sla.manage': 'team',
  'group_chat.use': 'team',
  'copilot.use': 'creator_pro',
  'ai_create.use': 'creator_pro',
  'agent.use': 'team',
  'agent.approve': 'team',
  'media_generate.use': 'creator_pro',
}

type Rule = { permission: string; roles?: string[] }

const MANAGERS = ['owner', 'admin', 'manager']
const WRITERS = ['owner', 'admin', 'manager', 'member']

const RULES: Record<InboxCapability, Rule> = {
  'inbox.view': { permission: PERMISSIONS.VIEW_INBOX },
  'inbox.assignments': { permission: PERMISSIONS.VIEW_INBOX },
  'inbox.saved_views': { permission: PERMISSIONS.VIEW_INBOX },
  'inbox.reply': { permission: PERMISSIONS.REPLY_INBOX, roles: WRITERS },
  'inbox.note': { permission: PERMISSIONS.REPLY_INBOX, roles: WRITERS },
  'inbox.close': { permission: PERMISSIONS.REPLY_INBOX, roles: WRITERS },
  'inbox.snooze': { permission: PERMISSIONS.REPLY_INBOX, roles: WRITERS },
  'inbox.tags.manage': { permission: PERMISSIONS.REPLY_INBOX, roles: WRITERS },
  'inbox.assign': { permission: PERMISSIONS.ASSIGN_INBOX, roles: WRITERS },
  'inbox.bulk_manage': { permission: PERMISSIONS.ASSIGN_INBOX, roles: MANAGERS },
  'inbox.sla.manage': { permission: PERMISSIONS.ASSIGN_INBOX, roles: MANAGERS },
  'inbox.routing.manage': { permission: PERMISSIONS.ASSIGN_INBOX, roles: MANAGERS },
  'inbox.export': { permission: PERMISSIONS.VIEW_INBOX, roles: MANAGERS },
  'inbox.import': { permission: PERMISSIONS.ASSIGN_INBOX, roles: MANAGERS },
  'inbox.saved_views.create': { permission: PERMISSIONS.VIEW_INBOX },
  'inbox.saved_views.share': { permission: PERMISSIONS.ASSIGN_INBOX, roles: WRITERS },
  'contacts.view': { permission: PERMISSIONS.VIEW_INBOX },
  'contacts.edit': { permission: PERMISSIONS.REPLY_INBOX, roles: WRITERS },
  'contacts.import': { permission: PERMISSIONS.ASSIGN_INBOX, roles: MANAGERS },
  'group_chat.use': { permission: PERMISSIONS.VIEW_INBOX, roles: WRITERS },
  'copilot.use': { permission: PERMISSIONS.USE_AI },
  'ai_create.use': { permission: PERMISSIONS.USE_AI, roles: WRITERS },
  'agent.use': { permission: PERMISSIONS.USE_AI, roles: WRITERS },
  'agent.approve': { permission: PERMISSIONS.APPROVE_AI_CONTENT, roles: WRITERS },
  'tasks.view': { permission: PERMISSIONS.VIEW_INBOX },
  'tasks.edit': { permission: PERMISSIONS.REPLY_INBOX, roles: WRITERS },
  'alerts.view': { permission: PERMISSIONS.VIEW_INBOX },
  'alerts.manage': { permission: PERMISSIONS.REPLY_INBOX, roles: WRITERS },
  'media_generate.use': { permission: PERMISSIONS.USE_AI, roles: WRITERS },
}

const MUTATING = new Set<InboxCapability>([
  'inbox.reply', 'inbox.note', 'inbox.assign', 'inbox.bulk_manage', 'inbox.close', 'inbox.snooze',
  'inbox.tags.manage', 'inbox.sla.manage', 'inbox.routing.manage', 'inbox.import', 'contacts.edit',
  'contacts.import', 'ai_create.use', 'agent.use', 'agent.approve', 'tasks.edit', 'alerts.manage',
  'media_generate.use', 'copilot.use',
])

export const INBOX_ROUTE_SURFACES: Record<string, InboxSurface> = {
  creator: 'creator', business: 'business', brand: 'brand', agency: 'agency',
}

/** Creators are single-seat: no assignment routing surfaces. */
const SURFACE_TABS: Record<InboxSurface, InboxTabId[]> = {
  creator: ['unified', 'saved-views', 'unassigned'],
  business: ['unified', 'assignments', 'saved-views', 'unassigned'],
  brand: ['unified', 'assignments', 'saved-views', 'unassigned'],
  agency: ['unified', 'assignments', 'saved-views', 'unassigned'],
}

export const INBOX_TAB_LABELS: Record<InboxTabId, string> = {
  unified: 'Unified',
  assignments: 'Assignments',
  'saved-views': 'Saved Views',
  unassigned: 'Unassigned',
}

const TAB_CAPABILITY: Record<InboxTabId, InboxCapability> = {
  unified: 'inbox.view',
  assignments: 'inbox.assignments',
  'saved-views': 'inbox.saved_views',
  unassigned: 'inbox.view',
}

function effectivePermissions(ctx: InboxContext): string[] {
  if (ctx.permissions && ctx.permissions.length > 0) return ctx.permissions
  return getDefaultPermissions(ctx.role) as string[]
}

export type InboxBlocker = 'plan' | 'feature-flag' | 'permission' | 'workspace-status' | 'workspace-type' | null

export function inboxCapabilityBlocker(ctx: InboxContext, capability: InboxCapability): InboxBlocker {
  if (!(ctx.surface in SURFACE_TABS)) return 'workspace-type'
  if (ctx.workspaceStatus === 'suspended' && MUTATING.has(capability)) return 'workspace-status'
  if (capability === 'inbox.assignments' && !SURFACE_TABS[ctx.surface].includes('assignments')) return 'workspace-type'
  const floor = PLAN_FLOOR[capability]
  if (floor && PLAN_RANK[ctx.plan] < PLAN_RANK[floor]) return 'plan'
  const flags = ctx.featureFlags
  if (flags) {
    const moduleId = capability.startsWith('inbox') || capability.startsWith('contacts') || capability.startsWith('group_chat') ? 'inbox' : 'fox_ai'
    if (flags[moduleId] === false || flags[`capability.${capability}`] === false) return 'feature-flag'
  }
  const rule = RULES[capability]
  if (rule.roles && !rule.roles.includes(ctx.role)) return 'permission'
  if (!effectivePermissions(ctx).includes(rule.permission)) return 'permission'
  return null
}

export function canAccessInboxCapability(ctx: InboxContext, capability: InboxCapability): boolean {
  return inboxCapabilityBlocker(ctx, capability) === null
}

export function requiredPlanFor(capability: InboxCapability): PlanId | null {
  return PLAN_FLOOR[capability] ?? null
}

export function visibleInboxTabs(ctx: InboxContext): InboxTabId[] {
  return SURFACE_TABS[ctx.surface].filter(tab => canAccessInboxCapability(ctx, TAB_CAPABILITY[tab]))
}

/** Maps the stored workspaces.plan value onto the canonical plan ids. */
export const PLAN_MAP: Record<string, PlanId> = {
  starter: 'free', free: 'free', creator_pro: 'creator_pro', team: 'team', brand: 'agency', agency: 'agency', enterprise: 'enterprise',
}

export function surfaceForWorkspaceType(type: string | null | undefined): InboxSurface {
  if (type === 'small_business' || type === 'business') return 'business'
  if (type === 'brand') return 'brand'
  if (type === 'agency') return 'agency'
  return 'creator'
}
