// Central Web & Conversion entitlement resolver.
//
// Every Web & Conversion surface — navigation, sub-tabs, route guards,
// actions, imports and exports — resolves visibility through this one module
// so workspace-type / plan / role checks never get scattered across six
// pages. Mirrors src/lib/messaging/entitlements.ts.

import { PERMISSIONS, ROLE_PERMISSIONS, type Permission } from '@/lib/permissions'
import { WEB_MODULES, type WebModule } from './constants'

/** Plan identifiers as stored on `workspaces.plan`. */
export const PLAN_RANK: Record<string, number> = {
  starter: 0, creator_pro: 1, team: 2, brand: 3, enterprise: 4,
}

export type WorkspaceKind = 'creator' | 'small_business' | 'brand' | 'agency'

export interface WebContext {
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

// Experiments and Tracking are the module's "advanced" surfaces (real
// statistical analysis, destination delivery diagnostics) — gated to Team+ so
// the module stays commercially viable, same pattern as Messaging's
// Journeys/WhatsApp/RCS gating.
const MODULE_RULES: Record<WebModule, ModuleRule> = {
  overview: { permission: PERMISSIONS.WEB_VIEW },
  pages: { permission: PERMISSIONS.WEB_VIEW },
  forms: { permission: PERMISSIONS.WEB_VIEW },
  funnels: { permission: PERMISSIONS.WEB_VIEW },
  experiments: {
    permission: PERMISSIONS.WEB_VIEW, minPlan: 'team',
    upgradeReason: 'A/B testing and conversion experiments are available from Team.',
  },
  tracking: {
    permission: PERMISSIONS.WEB_VIEW, minPlan: 'team',
    upgradeReason: 'Tracking destinations and diagnostics are available from Team.',
  },
}

export type ModuleAccess =
  | { allowed: true }
  | { allowed: false; reason: 'permission' | 'workspace_type' | 'plan' | 'subscription'; message: string; upgrade: boolean }

function permissionsFor(ctx: WebContext): Permission[] {
  if (ctx.isPlatformAdmin) return Object.values(PERMISSIONS) as Permission[]
  return ROLE_PERMISSIONS[ctx.role ?? ''] ?? []
}

export function hasWebPermission(ctx: WebContext, permission: Permission): boolean {
  return permissionsFor(ctx).includes(permission)
}

/** Resolves whether a Web & Conversion module is reachable for this context. */
export function canAccessWebModule(ctx: WebContext, module: WebModule): ModuleAccess {
  const rule = MODULE_RULES[module]

  if (ctx.planStatus === 'cancelled') {
    return {
      allowed: false, reason: 'subscription', upgrade: true,
      message: 'This workspace subscription has been cancelled. Reactivate a plan to use Web & Conversion.',
    }
  }

  if (!hasWebPermission(ctx, rule.permission)) {
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

/** The Web & Conversion sub-tabs this context may actually open, in canonical order. */
export function visibleWebModules(ctx: WebContext): WebModule[] {
  return WEB_MODULES.filter(module => canAccessWebModule(ctx, module).allowed)
}

// ── Action-level capabilities ────────────────────────────────────────────────

export interface WebCapabilities {
  view: boolean
  create: boolean
  edit: boolean
  delete: boolean
  publish: boolean
  export: boolean
  import: boolean
  viewFormSubmissions: boolean
  exportFormSubmissions: boolean
  launchExperiments: boolean
  declareWinner: boolean
  manageTracking: boolean
}

export function webCapabilities(ctx: WebContext): WebCapabilities {
  const perms = permissionsFor(ctx)
  const has = (p: Permission) => perms.includes(p)

  return {
    view: has(PERMISSIONS.WEB_VIEW),
    create: has(PERMISSIONS.WEB_CREATE),
    edit: has(PERMISSIONS.WEB_EDIT),
    delete: has(PERMISSIONS.WEB_DELETE),
    publish: has(PERMISSIONS.WEB_PUBLISH),
    export: has(PERMISSIONS.WEB_EXPORT),
    import: has(PERMISSIONS.WEB_IMPORT),
    viewFormSubmissions: has(PERMISSIONS.WEB_FORMS_SUBMISSIONS_VIEW),
    exportFormSubmissions: has(PERMISSIONS.WEB_FORMS_SUBMISSIONS_EXPORT),
    launchExperiments: has(PERMISSIONS.WEB_EXPERIMENTS_LAUNCH),
    declareWinner: has(PERMISSIONS.WEB_EXPERIMENTS_DECLARE_WINNER),
    manageTracking: has(PERMISSIONS.WEB_TRACKING_MANAGE),
  }
}
