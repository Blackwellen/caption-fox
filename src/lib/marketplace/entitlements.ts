// Central Marketplace entitlement resolver.
//
// Sidebar visibility, Marketplace tabs, Discover modes, route guards, compare
// and save limits, request/order creation, escrow, disputes and exports all
// resolve through this module so workspace-type / plan / role checks are never
// scattered across page components.

import { PERMISSIONS, ROLE_PERMISSIONS, type Permission } from '@/lib/permissions'
import { MARKETPLACE_MODULES, MAX_COMPARE, type MarketplaceModule } from './module'

/** Plan identifiers as stored on `workspaces.plan`, ranked low to high. */
export const PLAN_RANK: Record<string, number> = {
  starter: 0, creator_pro: 1, team: 2, brand: 3, enterprise: 4,
}

export type WorkspaceKind = 'creator' | 'small_business' | 'brand' | 'agency'

export interface MarketplaceContext {
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
  permission: Permission
  upgradeReason?: string
}

const MODULE_RULES: Record<MarketplaceModule, ModuleRule> = {
  overview: { permission: PERMISSIONS.MARKETPLACE_VIEW },
  discover: { permission: PERMISSIONS.MARKETPLACE_SEARCH },
  influencers: {
    permission: PERMISSIONS.MARKETPLACE_SEARCH, minPlan: 'creator_pro',
    upgradeReason: 'Influencer search, audience metrics and creator comparison are available from Creator Pro.',
  },
  services: { permission: PERMISSIONS.MARKETPLACE_SEARCH },
  'ugc-creators': {
    permission: PERMISSIONS.MARKETPLACE_SEARCH, minPlan: 'creator_pro',
    upgradeReason: 'UGC creator search and performance filters are available from Creator Pro.',
  },
  categories: { permission: PERMISSIONS.MARKETPLACE_VIEW },
  saved: { permission: PERMISSIONS.MARKETPLACE_SAVE },
  requests: {
    permission: PERMISSIONS.MARKETPLACE_REQUESTS_VIEW, minPlan: 'creator_pro',
    upgradeReason: 'Marketplace requests and RFQs are available from Creator Pro.',
  },
  orders: { permission: PERMISSIONS.MARKETPLACE_ORDERS_VIEW },
}

export type ModuleAccess =
  | { allowed: true }
  | { allowed: false; reason: 'permission' | 'workspace_type' | 'plan' | 'subscription'; message: string; upgrade: boolean }

function permissionsFor(ctx: MarketplaceContext): Permission[] {
  if (ctx.isPlatformAdmin) return Object.values(PERMISSIONS) as Permission[]
  return ROLE_PERMISSIONS[ctx.role ?? ''] ?? []
}

export function hasMarketplacePermission(ctx: MarketplaceContext, permission: Permission): boolean {
  return permissionsFor(ctx).includes(permission)
}

/** Resolves whether a Marketplace surface is reachable for this context. */
export function canAccessMarketplaceModule(ctx: MarketplaceContext, module: MarketplaceModule): ModuleAccess {
  const rule = MODULE_RULES[module]

  if (ctx.planStatus === 'cancelled') {
    return {
      allowed: false, reason: 'subscription', upgrade: true,
      message: 'This workspace subscription has been cancelled. Reactivate a plan to use the Marketplace.',
    }
  }

  if (!hasMarketplacePermission(ctx, rule.permission)) {
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

/** The Marketplace surfaces this context may actually open, in canonical order. */
export function visibleMarketplaceModules(ctx: MarketplaceContext): MarketplaceModule[] {
  return MARKETPLACE_MODULES.filter(module => canAccessMarketplaceModule(ctx, module).allowed)
}

// ── Action-level capabilities ────────────────────────────────────────────────

export interface MarketplaceCapabilities {
  view: boolean
  search: boolean
  save: boolean
  compare: boolean
  compareLimit: number
  savedLimit: number
  viewRequests: boolean
  createRequest: boolean
  editRequest: boolean
  inviteSuppliers: boolean
  evaluateProposals: boolean
  closeRequest: boolean
  viewOrders: boolean
  createOrder: boolean
  editOrder: boolean
  approveDelivery: boolean
  cancelOrder: boolean
  viewEscrow: boolean
  fundEscrow: boolean
  releaseEscrow: boolean
  refundEscrow: boolean
  viewDisputes: boolean
  createDispute: boolean
  respondDispute: boolean
  resolveDispute: boolean
  export: boolean
}

/**
 * Saved-item and comparison ceilings scale with the plan. Higher plans get more
 * shortlist room; the free tier still gets a genuinely usable allowance.
 */
function limitsFor(plan: string | null | undefined) {
  const rank = PLAN_RANK[plan ?? 'starter'] ?? 0
  if (rank >= PLAN_RANK.brand) return { compare: 4, saved: 500 }
  if (rank >= PLAN_RANK.team) return { compare: MAX_COMPARE, saved: 250 }
  if (rank >= PLAN_RANK.creator_pro) return { compare: MAX_COMPARE, saved: 100 }
  return { compare: 2, saved: 25 }
}

export function marketplaceCapabilities(ctx: MarketplaceContext): MarketplaceCapabilities {
  const perms = permissionsFor(ctx)
  const has = (p: Permission) => perms.includes(p)
  const limits = limitsFor(ctx.plan)
  const live = ctx.planStatus !== 'cancelled'

  return {
    view: live && has(PERMISSIONS.MARKETPLACE_VIEW),
    search: live && has(PERMISSIONS.MARKETPLACE_SEARCH),
    save: live && has(PERMISSIONS.MARKETPLACE_SAVE),
    compare: live && has(PERMISSIONS.MARKETPLACE_COMPARE),
    compareLimit: limits.compare,
    savedLimit: limits.saved,
    viewRequests: live && has(PERMISSIONS.MARKETPLACE_REQUESTS_VIEW),
    createRequest: live && has(PERMISSIONS.MARKETPLACE_REQUESTS_CREATE),
    editRequest: live && has(PERMISSIONS.MARKETPLACE_REQUESTS_EDIT),
    inviteSuppliers: live && has(PERMISSIONS.MARKETPLACE_REQUESTS_INVITE),
    evaluateProposals: live && has(PERMISSIONS.MARKETPLACE_REQUESTS_EVALUATE),
    closeRequest: live && has(PERMISSIONS.MARKETPLACE_REQUESTS_CLOSE),
    viewOrders: live && has(PERMISSIONS.MARKETPLACE_ORDERS_VIEW),
    createOrder: live && has(PERMISSIONS.MARKETPLACE_ORDERS_CREATE),
    editOrder: live && has(PERMISSIONS.MARKETPLACE_ORDERS_EDIT),
    approveDelivery: live && has(PERMISSIONS.MARKETPLACE_ORDERS_APPROVE_DELIVERY),
    cancelOrder: live && has(PERMISSIONS.MARKETPLACE_ORDERS_CANCEL),
    viewEscrow: live && has(PERMISSIONS.MARKETPLACE_ESCROW_VIEW),
    fundEscrow: live && has(PERMISSIONS.MARKETPLACE_ESCROW_FUND),
    releaseEscrow: live && has(PERMISSIONS.MARKETPLACE_ESCROW_RELEASE),
    refundEscrow: live && has(PERMISSIONS.MARKETPLACE_ESCROW_REFUND),
    viewDisputes: live && has(PERMISSIONS.MARKETPLACE_DISPUTES_VIEW),
    createDispute: live && has(PERMISSIONS.MARKETPLACE_DISPUTES_CREATE),
    respondDispute: live && has(PERMISSIONS.MARKETPLACE_DISPUTES_RESPOND),
    resolveDispute: live && has(PERMISSIONS.MARKETPLACE_DISPUTES_RESOLVE),
    export: live && has(PERMISSIONS.MARKETPLACE_EXPORT),
  }
}
