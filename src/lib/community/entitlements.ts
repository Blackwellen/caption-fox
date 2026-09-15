// Central Community module entitlement resolver.
//
// Navigation, sub-tabs, route guards and actions all resolve through this one
// module so workspace-type / plan / role checks never get scattered across
// the six surfaces. Route guards call `canAccessCommunityModule`; the pages
// and server actions call `communityCapabilities`. Mirrors
// src/lib/creators/entitlements.ts.

import { PERMISSIONS, ROLE_PERMISSIONS, type Permission } from '@/lib/permissions'
import { COMMUNITY_MODULES, type CommunityModule } from './constants'

/** Plan identifiers as stored on `workspaces.plan`. */
export const PLAN_RANK: Record<string, number> = {
  starter: 0, creator_pro: 1, team: 2, brand: 3, enterprise: 4,
}

export interface CommunityContext {
  workspaceId: string
  workspaceType: string | null | undefined
  plan: string | null | undefined
  planStatus: string | null | undefined
  role: string | null | undefined
  isPlatformAdmin?: boolean
}

interface ModuleRule {
  /** Minimum plan required. Omitted = available on every plan. */
  minPlan?: keyof typeof PLAN_RANK
  /** Permission required to even see the module. */
  permission: Permission
  /** Human copy used by the upgrade state when the plan gate blocks access. */
  upgradeReason?: string
}

const MODULE_RULES: Record<CommunityModule, ModuleRule> = {
  overview: { permission: PERMISSIONS.COMMUNITY_VIEW },
  communities: { permission: PERMISSIONS.COMMUNITY_COMMUNITIES_VIEW },
  calendar: { permission: PERMISSIONS.COMMUNITY_CALENDAR_VIEW },
  moderation: { permission: PERMISSIONS.COMMUNITY_MODERATION_VIEW },
  members: { permission: PERMISSIONS.COMMUNITY_MEMBERS_VIEW },
  advocacy: {
    permission: PERMISSIONS.COMMUNITY_ADVOCACY_VIEW, minPlan: 'team',
    upgradeReason: 'Ambassador and advocacy programmes are available from Team.',
  },
}

export type ModuleAccess =
  | { allowed: true }
  | { allowed: false; reason: 'permission' | 'plan' | 'subscription'; message: string; upgrade: boolean }

function permissionsFor(ctx: CommunityContext): Permission[] {
  if (ctx.isPlatformAdmin) return Object.values(PERMISSIONS) as Permission[]
  return ROLE_PERMISSIONS[ctx.role ?? ''] ?? []
}

export function hasCommunityPermission(ctx: CommunityContext, permission: Permission): boolean {
  return permissionsFor(ctx).includes(permission)
}

/** Resolves whether a Community module is reachable for this context. */
export function canAccessCommunityModule(ctx: CommunityContext, module: CommunityModule): ModuleAccess {
  const rule = MODULE_RULES[module]

  if (ctx.planStatus === 'cancelled') {
    return {
      allowed: false, reason: 'subscription', upgrade: true,
      message: 'This workspace subscription has been cancelled. Reactivate a plan to use Community.',
    }
  }

  if (!hasCommunityPermission(ctx, rule.permission)) {
    return {
      allowed: false, reason: 'permission', upgrade: false,
      message: 'Your role does not include access to this area. Ask a workspace owner or admin for access.',
    }
  }

  if (rule.minPlan) {
    const current = PLAN_RANK[ctx.plan ?? 'starter'] ?? 0
    if (current < PLAN_RANK[rule.minPlan]) {
      return {
        allowed: false, reason: 'plan', upgrade: true,
        message: rule.upgradeReason ?? 'Upgrade your plan to unlock this area.',
      }
    }
  }

  return { allowed: true }
}

/** The Community sub-tabs this context may actually open, in order. */
export function visibleCommunityModules(ctx: CommunityContext): CommunityModule[] {
  return COMMUNITY_MODULES.filter(module => canAccessCommunityModule(ctx, module).allowed)
}

// ── Action-level capabilities ────────────────────────────────────────────────

export interface CommunityCapabilities {
  view: boolean
  manageCommunities: boolean
  createCommunity: boolean
  archiveCommunity: boolean
  manageCalendar: boolean
  createEvent: boolean
  cancelEvent: boolean
  reviewModeration: boolean
  removeContent: boolean
  warnUser: boolean
  suspendUser: boolean
  banUser: boolean
  manageModerationRules: boolean
  viewMembers: boolean
  inviteMembers: boolean
  approveMembers: boolean
  editMembers: boolean
  manageMemberRoles: boolean
  manageAdvocacy: boolean
  createAdvocacyProgram: boolean
  approveRewards: boolean
  viewAnalytics: boolean
  export: boolean
}

export function communityCapabilities(ctx: CommunityContext): CommunityCapabilities {
  const perms = permissionsFor(ctx)
  const has = (p: Permission) => perms.includes(p)
  const manageCommunities = has(PERMISSIONS.COMMUNITY_COMMUNITIES_EDIT)
  const moderate = has(PERMISSIONS.COMMUNITY_MODERATION_REVIEW)
  const advocacyModule = canAccessCommunityModule(ctx, 'advocacy').allowed

  return {
    view: has(PERMISSIONS.COMMUNITY_VIEW),
    manageCommunities,
    createCommunity: has(PERMISSIONS.COMMUNITY_COMMUNITIES_CREATE),
    archiveCommunity: has(PERMISSIONS.COMMUNITY_COMMUNITIES_ARCHIVE),
    manageCalendar: has(PERMISSIONS.COMMUNITY_CALENDAR_EDIT),
    createEvent: has(PERMISSIONS.COMMUNITY_CALENDAR_CREATE),
    cancelEvent: has(PERMISSIONS.COMMUNITY_CALENDAR_CANCEL),
    reviewModeration: moderate,
    removeContent: has(PERMISSIONS.COMMUNITY_MODERATION_REMOVE_CONTENT),
    warnUser: has(PERMISSIONS.COMMUNITY_MODERATION_WARN),
    suspendUser: has(PERMISSIONS.COMMUNITY_MODERATION_SUSPEND),
    banUser: has(PERMISSIONS.COMMUNITY_MODERATION_BAN),
    manageModerationRules: has(PERMISSIONS.COMMUNITY_MODERATION_RULES_MANAGE),
    viewMembers: has(PERMISSIONS.COMMUNITY_MEMBERS_VIEW),
    inviteMembers: has(PERMISSIONS.COMMUNITY_MEMBERS_INVITE),
    approveMembers: has(PERMISSIONS.COMMUNITY_MEMBERS_APPROVE),
    editMembers: has(PERMISSIONS.COMMUNITY_MEMBERS_EDIT),
    manageMemberRoles: has(PERMISSIONS.COMMUNITY_MEMBERS_ROLES_MANAGE),
    manageAdvocacy: advocacyModule && has(PERMISSIONS.COMMUNITY_ADVOCACY_MANAGE),
    createAdvocacyProgram: advocacyModule && has(PERMISSIONS.COMMUNITY_ADVOCACY_CREATE),
    approveRewards: advocacyModule && has(PERMISSIONS.COMMUNITY_ADVOCACY_REWARDS_APPROVE),
    viewAnalytics: has(PERMISSIONS.COMMUNITY_ANALYTICS_VIEW),
    export: has(PERMISSIONS.COMMUNITY_EXPORT),
  }
}
