// Central Campaign Manager → Strategy entitlement resolver.
//
// Every Strategy surface — sidebar visibility, sub-tabs, route guards, view
// switchers, actions, uploads and exports — resolves through this one module so
// workspace-type / plan / role / feature-flag checks never get scattered across
// pages. Hiding a control here is a UX affordance only; the matching capability
// is re-checked server-side in every action.

import { PERMISSIONS, ROLE_PERMISSIONS, type Permission } from '@/lib/permissions'
import { STRATEGY_MODULES, type StrategyModule } from './constants'

/** Plan identifiers as stored on `workspaces.plan`, in ascending order. */
export const PLAN_RANK: Record<string, number> = {
  starter: 0, creator_pro: 1, team: 2, brand: 3, enterprise: 4,
}

export type WorkspaceKind = 'creator' | 'small_business' | 'brand' | 'agency'

/** Workspace types the shared Strategy module is designed for. */
export const STRATEGY_WORKSPACE_TYPES: WorkspaceKind[] = ['small_business', 'brand', 'agency']

export interface StrategyContext {
  workspaceId: string
  workspaceType: string | null | undefined
  plan: string | null | undefined
  planStatus: string | null | undefined
  role: string | null | undefined
  isPlatformAdmin?: boolean
  /** Workspace feature flags, resolved once by `getStrategySession`. */
  flags?: Record<string, boolean>
}

interface ModuleRule {
  /** Minimum plan required. Omitted = available on every plan. */
  minPlan?: keyof typeof PLAN_RANK
  /** Per-workspace-type plan floor, overriding `minPlan` for that type. */
  minPlanByType?: Partial<Record<WorkspaceKind, keyof typeof PLAN_RANK>>
  /** Workspace types the module is designed for. Omitted = the Strategy set. */
  types?: WorkspaceKind[]
  /** Permission required to even see the module. */
  permission: Permission
  /** Feature flag key. When present and explicitly false, the module is hidden. */
  flag?: string
  /** Human copy used by the upgrade state when the plan gate blocks access. */
  upgradeReason?: string
}

const MODULE_RULES: Record<StrategyModule, ModuleRule> = {
  overview: { permission: PERMISSIONS.STRATEGY_VIEW },
  objectives: { permission: PERMISSIONS.STRATEGY_OBJECTIVES_VIEW },
  audiences: { permission: PERMISSIONS.STRATEGY_AUDIENCES_VIEW },
  research: { permission: PERMISSIONS.STRATEGY_RESEARCH_VIEW },
  positioning: {
    permission: PERMISSIONS.STRATEGY_POSITIONING_VIEW, minPlan: 'team',
    upgradeReason: 'Positioning frameworks, competitive matrices and message approvals are available from Team.',
  },
  plans: {
    permission: PERMISSIONS.STRATEGY_PLANS_VIEW, minPlan: 'team',
    upgradeReason: 'Strategic plans, milestones and dependency tracking are available from Team.',
  },
  forecasts: {
    permission: PERMISSIONS.STRATEGY_FORECASTS_VIEW, minPlan: 'team',
    // Brand and Agency workspaces run campaign portfolios, so forecasting is
    // part of their Team plan; Business workspaces unlock it on the Brand plan.
    minPlanByType: { small_business: 'brand' },
    flag: 'strategy_forecasts',
    upgradeReason: 'Forecast modelling and scenario comparison are available on a higher plan.',
  },
}

export type ModuleAccess =
  | { allowed: true }
  | { allowed: false; reason: 'permission' | 'workspace_type' | 'plan' | 'subscription' | 'flag'; message: string; upgrade: boolean }

function permissionsFor(ctx: StrategyContext): Permission[] {
  if (ctx.isPlatformAdmin) return Object.values(PERMISSIONS) as Permission[]
  return ROLE_PERMISSIONS[ctx.role ?? ''] ?? []
}

export function hasStrategyPermission(ctx: StrategyContext, permission: Permission): boolean {
  return permissionsFor(ctx).includes(permission)
}

/**
 * Resolves whether a Strategy module is reachable for this context.
 * Order matters: subscription → feature flag → permission → type → plan, so the
 * message the user sees names the *first* real reason, not a later one.
 */
export function canAccessStrategyModule(ctx: StrategyContext, module: StrategyModule): ModuleAccess {
  const rule = MODULE_RULES[module]

  if (ctx.planStatus === 'cancelled') {
    return {
      allowed: false, reason: 'subscription', upgrade: true,
      message: 'This workspace subscription has been cancelled. Reactivate a plan to use Strategy.',
    }
  }

  // A flag that is explicitly disabled removes the module entirely — it is not
  // an upgrade state, because no plan change would reveal it.
  if (rule.flag && ctx.flags && ctx.flags[rule.flag] === false) {
    return {
      allowed: false, reason: 'flag', upgrade: false,
      message: 'This area is not currently enabled for your workspace.',
    }
  }

  if (!hasStrategyPermission(ctx, rule.permission)) {
    return {
      allowed: false, reason: 'permission', upgrade: false,
      message: 'Your role does not include access to this area. Ask a workspace owner or admin for access.',
    }
  }

  const types = rule.types ?? STRATEGY_WORKSPACE_TYPES
  if (!types.includes((ctx.workspaceType ?? '') as WorkspaceKind)) {
    return {
      allowed: false, reason: 'workspace_type', upgrade: false,
      message: 'Strategy is not part of the current workspace type.',
    }
  }

  const minPlan = rule.minPlanByType?.[(ctx.workspaceType ?? '') as WorkspaceKind] ?? rule.minPlan
  if (minPlan) {
    const current = PLAN_RANK[ctx.plan ?? 'starter'] ?? 0
    if (current < PLAN_RANK[minPlan]) {
      return {
        allowed: false, reason: 'plan', upgrade: true,
        message: rule.upgradeReason ?? 'Upgrade your plan to unlock this area.',
      }
    }
  }

  return { allowed: true }
}

/** The Strategy sub-tabs this context may actually open, in canonical order. */
export function visibleStrategyModules(ctx: StrategyContext): StrategyModule[] {
  return STRATEGY_MODULES.filter(module => canAccessStrategyModule(ctx, module).allowed)
}

/** Whether Strategy should appear in the sidebar at all. */
export function strategyVisibleInNav(ctx: StrategyContext): boolean {
  return visibleStrategyModules(ctx).length > 0
}

// ── Action-level capabilities ────────────────────────────────────────────────

export interface StrategyCapabilities {
  view: boolean
  create: boolean
  edit: boolean
  delete: boolean
  export: boolean
  createObjective: boolean
  editObjective: boolean
  deleteObjective: boolean
  createAudience: boolean
  editAudience: boolean
  importAudiences: boolean
  syncCrm: boolean
  createResearch: boolean
  uploadResearch: boolean
  approveResearch: boolean
  deleteResearch: boolean
  createFramework: boolean
  editFramework: boolean
  approveFramework: boolean
  createPlan: boolean
  editPlan: boolean
  manageDependencies: boolean
  createForecast: boolean
  editForecast: boolean
  manageAssumptions: boolean
}

export function strategyCapabilities(ctx: StrategyContext): StrategyCapabilities {
  const perms = permissionsFor(ctx)
  const has = (p: Permission) => perms.includes(p)

  return {
    view: has(PERMISSIONS.STRATEGY_VIEW),
    create: has(PERMISSIONS.STRATEGY_CREATE),
    edit: has(PERMISSIONS.STRATEGY_EDIT),
    delete: has(PERMISSIONS.STRATEGY_DELETE),
    export: has(PERMISSIONS.STRATEGY_EXPORT),
    createObjective: has(PERMISSIONS.STRATEGY_OBJECTIVES_CREATE),
    editObjective: has(PERMISSIONS.STRATEGY_OBJECTIVES_EDIT),
    deleteObjective: has(PERMISSIONS.STRATEGY_OBJECTIVES_DELETE),
    createAudience: has(PERMISSIONS.STRATEGY_AUDIENCES_CREATE),
    editAudience: has(PERMISSIONS.STRATEGY_AUDIENCES_EDIT),
    importAudiences: has(PERMISSIONS.STRATEGY_AUDIENCES_IMPORT),
    syncCrm: has(PERMISSIONS.STRATEGY_AUDIENCES_SYNC),
    createResearch: has(PERMISSIONS.STRATEGY_RESEARCH_CREATE),
    uploadResearch: has(PERMISSIONS.STRATEGY_RESEARCH_UPLOAD),
    approveResearch: has(PERMISSIONS.STRATEGY_RESEARCH_APPROVE),
    deleteResearch: has(PERMISSIONS.STRATEGY_RESEARCH_DELETE),
    createFramework: has(PERMISSIONS.STRATEGY_POSITIONING_CREATE),
    editFramework: has(PERMISSIONS.STRATEGY_POSITIONING_EDIT),
    approveFramework: has(PERMISSIONS.STRATEGY_POSITIONING_APPROVE),
    createPlan: has(PERMISSIONS.STRATEGY_PLANS_CREATE),
    editPlan: has(PERMISSIONS.STRATEGY_PLANS_EDIT),
    manageDependencies: has(PERMISSIONS.STRATEGY_PLANS_MANAGE_DEPENDENCIES),
    createForecast: has(PERMISSIONS.STRATEGY_FORECASTS_CREATE),
    editForecast: has(PERMISSIONS.STRATEGY_FORECASTS_EDIT),
    manageAssumptions: has(PERMISSIONS.STRATEGY_FORECASTS_MANAGE_ASSUMPTIONS),
  }
}
