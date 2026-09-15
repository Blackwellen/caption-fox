// Central Partnerships entitlement resolver.
//
// Every Partnerships surface — navigation, tabs, route guards, actions,
// imports and exports — resolves visibility through this one module so
// workspace-type / plan / role checks never get scattered across pages.

import { PERMISSIONS, ROLE_PERMISSIONS, type Permission } from '@/lib/permissions'
import { PARTNERSHIP_MODULES, type PartnershipModule } from './constants'

export const PLAN_RANK: Record<string, number> = {
  starter: 0, creator_pro: 1, team: 2, brand: 3, enterprise: 4,
}

export type WorkspaceKind = 'creator' | 'small_business' | 'brand' | 'agency'

export interface PartnershipContext {
  workspaceId: string
  workspaceType: string | null | undefined
  plan: string | null | undefined
  planStatus: string | null | undefined
  role: string | null | undefined
  isPlatformAdmin?: boolean
}

interface ModuleRule {
  minPlan?: keyof typeof PLAN_RANK
  types?: WorkspaceKind[]
  permission: Permission
  upgradeReason?: string
}

const MODULE_RULES: Record<PartnershipModule, ModuleRule> = {
  overview: { permission: PERMISSIONS.PARTNERSHIPS_VIEW },
  affiliates: { permission: PERMISSIONS.PARTNERSHIPS_VIEW },
  referrals: { permission: PERMISSIONS.PARTNERSHIPS_VIEW },
  ambassadors: {
    permission: PERMISSIONS.PARTNERSHIPS_VIEW, minPlan: 'creator_pro',
    upgradeReason: 'Ambassador programmes and content approvals are available from Creator Pro.',
  },
  loyalty: {
    permission: PERMISSIONS.PARTNERSHIPS_VIEW, minPlan: 'team',
    upgradeReason: 'Loyalty programmes, tiers and rewards are available from Team.',
  },
  resellers: {
    permission: PERMISSIONS.PARTNERSHIPS_VIEW, minPlan: 'team', types: ['small_business', 'brand', 'agency'],
    upgradeReason: 'Reseller programmes, territories and rebates are available from Team.',
  },
  co_marketing: {
    permission: PERMISSIONS.PARTNERSHIPS_VIEW, minPlan: 'brand', types: ['small_business', 'brand', 'agency'],
    upgradeReason: 'Co-marketing programmes and shared-spend tracking are available from Brand.',
  },
}

export type ModuleAccess =
  | { allowed: true }
  | { allowed: false; reason: 'permission' | 'workspace_type' | 'plan' | 'subscription'; message: string; upgrade: boolean }

function permissionsFor(ctx: PartnershipContext): Permission[] {
  if (ctx.isPlatformAdmin) return Object.values(PERMISSIONS) as Permission[]
  return ROLE_PERMISSIONS[ctx.role ?? ''] ?? []
}

export function hasPartnershipPermission(ctx: PartnershipContext, permission: Permission): boolean {
  return permissionsFor(ctx).includes(permission)
}

export function canAccessPartnershipModule(ctx: PartnershipContext, module: PartnershipModule): ModuleAccess {
  const rule = MODULE_RULES[module]

  if (ctx.planStatus === 'cancelled') {
    return {
      allowed: false, reason: 'subscription', upgrade: true,
      message: 'This workspace subscription has been cancelled. Reactivate a plan to use Partnerships.',
    }
  }

  if (!hasPartnershipPermission(ctx, rule.permission)) {
    return {
      allowed: false, reason: 'permission', upgrade: false,
      message: 'Your role does not include access to this area. Ask a workspace owner or admin for access.',
    }
  }

  if (rule.types && !rule.types.includes((ctx.workspaceType ?? '') as WorkspaceKind)) {
    return {
      allowed: false, reason: 'workspace_type', upgrade: false,
      message: 'This area is not part of the current workspace type.',
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

export function visiblePartnershipModules(ctx: PartnershipContext): PartnershipModule[] {
  return PARTNERSHIP_MODULES.filter(module => canAccessPartnershipModule(ctx, module).allowed)
}

// ── Action-level capabilities ────────────────────────────────────────────────

export interface PartnershipCapabilities {
  view: boolean
  createProgramme: boolean
  editProgramme: boolean
  archiveProgramme: boolean
  createPartner: boolean
  editPartner: boolean
  approveApplications: boolean
  manageTracking: boolean
  viewConversions: boolean
  viewCommissions: boolean
  manageCommissions: boolean
  approveCommissions: boolean
  viewPayouts: boolean
  approvePayouts: boolean
  processPayouts: boolean
  manageRewards: boolean
  manageAmbassadorContent: boolean
  manageLoyalty: boolean
  manageTerritories: boolean
  manageCoMarketing: boolean
  export: boolean
  import: boolean
}

export function partnershipCapabilities(ctx: PartnershipContext): PartnershipCapabilities {
  const perms = permissionsFor(ctx)
  const has = (p: Permission) => perms.includes(p)

  return {
    view: has(PERMISSIONS.PARTNERSHIPS_VIEW),
    createProgramme: has(PERMISSIONS.PARTNERSHIPS_PROGRAMMES_CREATE),
    editProgramme: has(PERMISSIONS.PARTNERSHIPS_PROGRAMMES_EDIT),
    archiveProgramme: has(PERMISSIONS.PARTNERSHIPS_PROGRAMMES_ARCHIVE),
    createPartner: has(PERMISSIONS.PARTNERSHIPS_PARTNERS_CREATE),
    editPartner: has(PERMISSIONS.PARTNERSHIPS_PARTNERS_EDIT),
    approveApplications: has(PERMISSIONS.PARTNERSHIPS_PARTNERS_APPROVE),
    manageTracking: has(PERMISSIONS.PARTNERSHIPS_TRACKING_MANAGE),
    viewConversions: has(PERMISSIONS.PARTNERSHIPS_CONVERSIONS_VIEW),
    viewCommissions: has(PERMISSIONS.PARTNERSHIPS_COMMISSIONS_VIEW),
    manageCommissions: has(PERMISSIONS.PARTNERSHIPS_COMMISSIONS_MANAGE),
    approveCommissions: has(PERMISSIONS.PARTNERSHIPS_COMMISSIONS_APPROVE),
    viewPayouts: has(PERMISSIONS.PARTNERSHIPS_PAYOUTS_VIEW),
    approvePayouts: has(PERMISSIONS.PARTNERSHIPS_PAYOUTS_APPROVE),
    processPayouts: has(PERMISSIONS.PARTNERSHIPS_PAYOUTS_PROCESS),
    manageRewards: has(PERMISSIONS.PARTNERSHIPS_REWARDS_MANAGE),
    manageAmbassadorContent: has(PERMISSIONS.PARTNERSHIPS_AMBASSADORS_MANAGE_CONTENT),
    manageLoyalty: has(PERMISSIONS.PARTNERSHIPS_LOYALTY_MANAGE),
    manageTerritories: has(PERMISSIONS.PARTNERSHIPS_RESELLERS_MANAGE_TERRITORIES),
    manageCoMarketing: has(PERMISSIONS.PARTNERSHIPS_CO_MARKETING_MANAGE),
    export: has(PERMISSIONS.PARTNERSHIPS_FINANCIALS_EXPORT),
    import: has(PERMISSIONS.PARTNERSHIPS_PARTNERS_CREATE),
  }
}
