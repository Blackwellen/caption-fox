// Central Campaign Manager entitlement resolver.
//
// Every Campaigns surface — navigation, sub-tabs, route guards, actions,
// imports and exports — resolves visibility through this one module so
// workspace-type / plan / role checks never get scattered across pages.

import { PERMISSIONS, ROLE_PERMISSIONS, type Permission } from '@/lib/permissions'
import { CAMPAIGN_MODULES, type CampaignModule } from './constants'

/** Plan identifiers as stored on `workspaces.plan`. */
export const PLAN_RANK: Record<string, number> = {
  starter: 0, creator_pro: 1, team: 2, brand: 3, enterprise: 4,
}

export type WorkspaceKind = 'creator' | 'small_business' | 'brand' | 'agency'

export interface CampaignContext {
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
  /** Workspace types the module is designed for. Omitted = all types. */
  types?: WorkspaceKind[]
  /** Permission required to even see the module. */
  permission: Permission
  /** Human copy used by the upgrade state when the plan gate blocks access. */
  upgradeReason?: string
}

const MODULE_RULES: Record<CampaignModule, ModuleRule> = {
  overview: { permission: PERMISSIONS.VIEW_ANALYTICS },
  all: { permission: PERMISSIONS.VIEW_ANALYTICS },
  giveaways: {
    permission: PERMISSIONS.VIEW_ANALYTICS, minPlan: 'creator_pro',
    upgradeReason: 'Giveaway campaigns, entry imports and winner reviews are available from Creator Pro.',
  },
  competitions: {
    permission: PERMISSIONS.VIEW_ANALYTICS, minPlan: 'team',
    types: ['small_business', 'brand', 'agency'],
    upgradeReason: 'Competition campaigns and judging workflows are available from Team.',
  },
  templates: {
    permission: PERMISSIONS.VIEW_ANALYTICS, minPlan: 'team',
    upgradeReason: 'Reusable campaign templates are available from Team.',
  },
  board: {
    permission: PERMISSIONS.VIEW_ANALYTICS, minPlan: 'creator_pro',
    upgradeReason: 'The campaign board is available from Creator Pro.',
  },
  timeline: {
    permission: PERMISSIONS.VIEW_ANALYTICS, minPlan: 'team',
    upgradeReason: 'The campaign timeline is available from Team.',
  },
}

export type ModuleAccess =
  | { allowed: true }
  | { allowed: false; reason: 'permission' | 'workspace_type' | 'plan' | 'subscription'; message: string; upgrade: boolean }

function permissionsFor(ctx: CampaignContext): Permission[] {
  if (ctx.isPlatformAdmin) return Object.values(PERMISSIONS) as Permission[]
  return ROLE_PERMISSIONS[ctx.role ?? ''] ?? []
}

export function hasCampaignPermission(ctx: CampaignContext, permission: Permission): boolean {
  return permissionsFor(ctx).includes(permission)
}

/** Resolves whether a Campaigns module is reachable for this context. */
export function canAccessCampaignModule(ctx: CampaignContext, module: CampaignModule): ModuleAccess {
  const rule = MODULE_RULES[module]

  if (ctx.planStatus === 'cancelled') {
    return {
      allowed: false, reason: 'subscription', upgrade: true,
      message: 'This workspace subscription has been cancelled. Reactivate a plan to use Campaigns.',
    }
  }

  if (!hasCampaignPermission(ctx, rule.permission)) {
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

/** The Campaigns sub-tabs this context may actually open, in canonical order. */
export function visibleCampaignModules(ctx: CampaignContext): CampaignModule[] {
  return CAMPAIGN_MODULES.filter(module => canAccessCampaignModule(ctx, module).allowed)
}

// ── Action-level capabilities ────────────────────────────────────────────────

export interface CampaignCapabilities {
  view: boolean
  create: boolean
  edit: boolean
  archive: boolean
  delete: boolean
  export: boolean
  import: boolean
  manageBoard: boolean
  manageTimeline: boolean
  manageGiveaways: boolean
  reviewWinners: boolean
  manageCompetitions: boolean
  judge: boolean
  manageTemplates: boolean
  publishTemplates: boolean
  approve: boolean
}

export function campaignCapabilities(ctx: CampaignContext): CampaignCapabilities {
  const perms = permissionsFor(ctx)
  const has = (p: Permission) => perms.includes(p)
  const edit = has(PERMISSIONS.EDIT_CAMPAIGN)

  return {
    view: has(PERMISSIONS.VIEW_ANALYTICS),
    create: has(PERMISSIONS.CREATE_CAMPAIGN),
    edit,
    archive: edit,
    delete: has(PERMISSIONS.DELETE_CAMPAIGN),
    export: has(PERMISSIONS.EXPORT_DATA),
    import: has(PERMISSIONS.CREATE_CAMPAIGN),
    manageBoard: edit,
    manageTimeline: edit,
    manageGiveaways: has(PERMISSIONS.MANAGE_GIVEAWAY),
    reviewWinners: has(PERMISSIONS.MANAGE_GIVEAWAY),
    manageCompetitions: has(PERMISSIONS.MANAGE_COMPETITION),
    judge: has(PERMISSIONS.MANAGE_COMPETITION),
    manageTemplates: edit,
    publishTemplates: has(PERMISSIONS.APPROVE_POST),
    approve: has(PERMISSIONS.APPROVE_POST),
  }
}
