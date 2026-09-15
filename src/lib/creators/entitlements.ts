// Central Creators & UGC entitlement resolver.
//
// Navigation, sub-tabs, route guards, actions, imports, exports, financial
// visibility and rights editing all resolve through this one module so
// workspace-type / plan / role checks never get scattered across the six
// surfaces. Route guards call `canAccessCreatorModule`; the pages and server
// actions call `creatorCapabilities`.

import { PERMISSIONS, ROLE_PERMISSIONS, type Permission } from '@/lib/permissions'
import { CREATOR_MODULES, type CreatorModule } from './constants'

/** Plan identifiers as stored on `workspaces.plan`. */
export const PLAN_RANK: Record<string, number> = {
  starter: 0, creator_pro: 1, team: 2, brand: 3, enterprise: 4,
}

export type WorkspaceKind = 'creator' | 'small_business' | 'brand' | 'agency'

/**
 * How this workspace uses the module. A Creator workspace buys creator
 * services rarely; it mostly delivers them, so it gets the self-service mode
 * and never the sourcing/payout screens built for buyers.
 */
export type CreatorsUgcMode = 'buyer-manager' | 'agency-client-manager' | 'creator-self-service' | 'read-only'

export interface CreatorContext {
  workspaceId: string
  workspaceType: string | null | undefined
  plan: string | null | undefined
  planStatus: string | null | undefined
  role: string | null | undefined
  isPlatformAdmin?: boolean
}

export function resolveMode(ctx: CreatorContext): CreatorsUgcMode {
  if (ctx.workspaceType === 'creator') return 'creator-self-service'
  if (ctx.workspaceType === 'agency') return 'agency-client-manager'
  const perms = permissionsFor(ctx)
  if (!perms.includes(PERMISSIONS.MANAGE_CREATORS) && !perms.includes(PERMISSIONS.CREATE_BRIEF)) return 'read-only'
  return 'buyer-manager'
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

const MODULE_RULES: Record<CreatorModule, ModuleRule> = {
  overview: { permission: PERMISSIONS.VIEW_ANALYTICS },
  creators: { permission: PERMISSIONS.VIEW_ANALYTICS },
  briefs: { permission: PERMISSIONS.VIEW_ANALYTICS },
  submissions: { permission: PERMISSIONS.VIEW_ANALYTICS },
  rights: {
    permission: PERMISSIONS.VIEW_ANALYTICS, minPlan: 'team',
    upgradeReason: 'Usage-rights tracking, licence expiry alerts and compliance reporting are available from Team.',
  },
  payments: {
    permission: PERMISSIONS.VIEW_ANALYTICS, minPlan: 'team',
    types: ['small_business', 'brand', 'agency'],
    upgradeReason: 'Creator payments, approvals and payout batches are available from Team.',
  },
}

export type ModuleAccess =
  | { allowed: true }
  | { allowed: false; reason: 'permission' | 'workspace_type' | 'plan' | 'subscription'; message: string; upgrade: boolean }

function permissionsFor(ctx: CreatorContext): Permission[] {
  if (ctx.isPlatformAdmin) return Object.values(PERMISSIONS) as Permission[]
  return ROLE_PERMISSIONS[ctx.role ?? ''] ?? []
}

export function hasCreatorPermission(ctx: CreatorContext, permission: Permission): boolean {
  return permissionsFor(ctx).includes(permission)
}

/** Resolves whether a Creators & UGC module is reachable for this context. */
export function canAccessCreatorModule(ctx: CreatorContext, module: CreatorModule): ModuleAccess {
  const rule = MODULE_RULES[module]

  if (ctx.planStatus === 'cancelled') {
    return {
      allowed: false, reason: 'subscription', upgrade: true,
      message: 'This workspace subscription has been cancelled. Reactivate a plan to use Creators & UGC.',
    }
  }

  if (!hasCreatorPermission(ctx, rule.permission)) {
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

/** The Creators & UGC sub-tabs this context may actually open, in order. */
export function visibleCreatorModules(ctx: CreatorContext): CreatorModule[] {
  return CREATOR_MODULES.filter(module => canAccessCreatorModule(ctx, module).allowed)
}

// ── Action-level capabilities ────────────────────────────────────────────────

export interface CreatorCapabilities {
  view: boolean
  manageCreators: boolean
  invite: boolean
  manageLists: boolean
  createBrief: boolean
  editBrief: boolean
  deleteBrief: boolean
  review: boolean
  approve: boolean
  bulkApprove: boolean
  upload: boolean
  manageRights: boolean
  approveRights: boolean
  viewPayments: boolean
  managePayments: boolean
  approvePayments: boolean
  processPayouts: boolean
  export: boolean
  import: boolean
  /** Bank details, tax profiles and invoice files stay behind this gate. */
  viewSensitiveFinancials: boolean
}

export function creatorCapabilities(ctx: CreatorContext): CreatorCapabilities {
  const perms = permissionsFor(ctx)
  const has = (p: Permission) => perms.includes(p)
  const manageCreators = has(PERMISSIONS.MANAGE_CREATORS)
  const createBrief = has(PERMISSIONS.CREATE_BRIEF)
  const approveUgc = has(PERMISSIONS.APPROVE_UGC)
  const billing = has(PERMISSIONS.MANAGE_BILLING)
  const paymentsModule = canAccessCreatorModule(ctx, 'payments').allowed
  const rightsModule = canAccessCreatorModule(ctx, 'rights').allowed

  return {
    view: has(PERMISSIONS.VIEW_ANALYTICS),
    manageCreators,
    invite: manageCreators,
    manageLists: manageCreators || createBrief,
    createBrief,
    editBrief: createBrief,
    deleteBrief: createBrief && manageCreators,
    review: approveUgc || createBrief,
    approve: approveUgc,
    bulkApprove: approveUgc && manageCreators,
    upload: createBrief || manageCreators,
    manageRights: rightsModule && (manageCreators || createBrief),
    approveRights: rightsModule && approveUgc,
    viewPayments: paymentsModule && (billing || manageCreators),
    managePayments: paymentsModule && billing,
    approvePayments: paymentsModule && billing,
    processPayouts: paymentsModule && billing,
    export: has(PERMISSIONS.EXPORT_DATA),
    import: manageCreators,
    viewSensitiveFinancials: billing,
  }
}
