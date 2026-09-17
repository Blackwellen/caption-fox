// Central Brand & Assets capability resolver.
//
// Every gate in the module reads from here: sidebar visibility, module tabs,
// route protection, header actions, row menus, server actions and API handlers.
// Nothing outside this file may branch on workspace type directly — scattered
// `if (type === 'agency')` checks are exactly what this replaces.

import { getPlan, type PlanId } from '@/lib/plans'

export const BRAND_CAPABILITIES = [
  'brand.view',

  'brand.kits.view',
  'brand.kits.create',
  'brand.kits.edit',
  'brand.kits.approve',
  'brand.kits.publish',
  'brand.kits.share',
  'brand.kits.export',

  'brand.assets.view',
  'brand.assets.upload',
  'brand.assets.edit',
  'brand.assets.download',
  'brand.assets.approve',
  'brand.assets.archive',
  'brand.assets.delete',

  'brand.rights.view',
  'brand.rights.create',
  'brand.rights.edit',
  'brand.rights.renew',
  'brand.rights.restrict',
  'brand.rights.export',

  'brand.products.view',
  'brand.products.create',
  'brand.products.edit',
  'brand.products.import',
  'brand.products.approve',
  'brand.products.archive',
  'brand.products.export',

  'brand.usage_requests.view',
  'brand.usage_requests.create',
  'brand.usage_requests.approve',
] as const

export type BrandCapability = (typeof BRAND_CAPABILITIES)[number]

/** The four module surfaces, in canonical tab order. */
export const BRAND_MODULES = ['overview', 'kits', 'assets', 'rights', 'products'] as const
export type BrandModule = (typeof BRAND_MODULES)[number]

export type WorkspaceRole = 'owner' | 'admin' | 'manager' | 'member' | 'viewer' | 'ugc_creator'

export interface BrandEntitlementContext {
  workspaceType: string | null            // creator | small_business | brand | agency
  plan: string | null
  planStatus: string | null               // trialing | active | past_due | cancelled | paused
  role: WorkspaceRole | string | null
  /** Feature flags resolved from workspace settings; unknown flags default off. */
  flags?: Record<string, boolean>
  /** Storage headroom — upload is blocked when the quota is exhausted. */
  storage?: { bytesUsed: number; bytesQuota: number }
}

// ---------------------------------------------------------------------------
// Workspace-type eligibility
//
// The module is a shared Campaign Manager surface. Creator workspaces run a
// simplified brand kit only: they get Overview + Kits, but not the DAM
// governance, rights register or product catalogue, which are commercial
// concerns those workspaces do not have.
// ---------------------------------------------------------------------------
const MODULES_BY_WORKSPACE_TYPE: Record<string, BrandModule[]> = {
  creator: ['overview', 'kits'],
  small_business: ['overview', 'kits', 'assets', 'rights', 'products'],
  brand: ['overview', 'kits', 'assets', 'rights', 'products'],
  agency: ['overview', 'kits', 'assets', 'rights', 'products'],
}

/** Route segment -> workspaces.type. The URL says `business`, the column says `small_business`. */
export const ROUTE_SEGMENT_TO_WORKSPACE_TYPE: Record<string, string> = {
  creator: 'creator',
  business: 'small_business',
  brand: 'brand',
  agency: 'agency',
}

// Minimum plan required per module. Rights and Product Library are commercial
// governance features and sit above the free tier.
const MODULE_MIN_PLAN: Record<BrandModule, PlanId> = {
  overview: 'free',
  kits: 'free',
  assets: 'creator_pro',
  rights: 'team',
  products: 'team',
}

const PLAN_RANK: Record<PlanId, number> = {
  free: 0, creator_pro: 1, team: 2, agency: 3, enterprise: 4,
}

/** Feature flag guarding each module; absent means always on. */
const MODULE_FLAG: Partial<Record<BrandModule, string>> = {
  rights: 'brand_rights',
  products: 'brand_product_library',
}

// ---------------------------------------------------------------------------
// Role -> capability matrix
// ---------------------------------------------------------------------------
const VIEW_ONLY: BrandCapability[] = [
  'brand.view',
  'brand.kits.view', 'brand.assets.view', 'brand.rights.view',
  'brand.products.view', 'brand.usage_requests.view',
]

const CONTRIBUTOR: BrandCapability[] = [
  ...VIEW_ONLY,
  'brand.assets.upload', 'brand.assets.edit', 'brand.assets.download',
  'brand.kits.edit',
  'brand.products.edit',
  'brand.usage_requests.create',
]

const MANAGER: BrandCapability[] = [
  ...CONTRIBUTOR,
  'brand.kits.create', 'brand.kits.share', 'brand.kits.export',
  'brand.assets.approve', 'brand.assets.archive',
  'brand.rights.create', 'brand.rights.edit', 'brand.rights.renew', 'brand.rights.export',
  'brand.products.create', 'brand.products.import', 'brand.products.archive', 'brand.products.export',
  'brand.usage_requests.approve',
]

const ADMIN: BrandCapability[] = [
  ...MANAGER,
  'brand.kits.approve', 'brand.kits.publish',
  'brand.assets.delete',
  'brand.rights.restrict',
  'brand.products.approve',
]

const ROLE_CAPABILITIES: Record<string, BrandCapability[]> = {
  owner: [...BRAND_CAPABILITIES],
  admin: ADMIN,
  manager: MANAGER,
  member: CONTRIBUTOR,
  viewer: VIEW_ONLY,
  // UGC creators submit content; they must never read the rights register or
  // product catalogue, both of which carry commercial terms.
  ugc_creator: ['brand.view', 'brand.kits.view', 'brand.assets.view', 'brand.usage_requests.create'],
}

/** Which module a capability belongs to, so plan/flag gates apply transitively. */
function moduleFor(capability: BrandCapability): BrandModule {
  if (capability.startsWith('brand.kits')) return 'kits'
  if (capability.startsWith('brand.assets')) return 'assets'
  if (capability.startsWith('brand.rights')) return 'rights'
  if (capability.startsWith('brand.products')) return 'products'
  if (capability.startsWith('brand.usage_requests')) return 'assets'
  return 'overview'
}

// Capabilities that write. A suspended or past-due workspace stays readable but
// becomes read-only, so customers can always retrieve their own data.
function isWriteCapability(capability: BrandCapability): boolean {
  return !capability.endsWith('.view') && capability !== 'brand.view'
}

export type DenialReason =
  | 'not_a_member'
  | 'workspace_type'
  | 'plan'
  | 'feature_flag'
  | 'role'
  | 'workspace_status'
  | 'storage_quota'

export interface CapabilityDecision {
  allowed: boolean
  reason: DenialReason | null
  /** Plan the customer must move to, when `reason` is 'plan'. */
  requiredPlan: PlanId | null
  message: string | null
}

/** Is this module available to the workspace at all (type + plan + flag)? */
export function isModuleAvailable(
  ctx: BrandEntitlementContext,
  module: BrandModule,
): CapabilityDecision {
  const type = ctx.workspaceType ?? ''
  const allowedModules = MODULES_BY_WORKSPACE_TYPE[type]

  if (!allowedModules) {
    return { allowed: false, reason: 'workspace_type', requiredPlan: null,
      message: 'Brand & Assets is not available for this workspace type.' }
  }
  if (!allowedModules.includes(module)) {
    return { allowed: false, reason: 'workspace_type', requiredPlan: null,
      message: `${labelFor(module)} is not part of this workspace type.` }
  }

  const flag = MODULE_FLAG[module]
  if (flag && ctx.flags && ctx.flags[flag] === false) {
    return { allowed: false, reason: 'feature_flag', requiredPlan: null,
      message: `${labelFor(module)} is currently disabled for this workspace.` }
  }

  const required = MODULE_MIN_PLAN[module]
  const current = getPlan(ctx.plan).id
  if (PLAN_RANK[current] < PLAN_RANK[required]) {
    return { allowed: false, reason: 'plan', requiredPlan: required,
      message: `${labelFor(module)} requires the ${getPlan(required).name} plan.` }
  }

  return { allowed: true, reason: null, requiredPlan: null, message: null }
}

/**
 * The one gate. Resolves workspace type, plan, flags, role, workspace status and
 * storage headroom into a single allow/deny with a reason the UI can explain.
 */
export function canAccessBrandCapability(
  ctx: BrandEntitlementContext,
  capability: BrandCapability,
): CapabilityDecision {
  if (!ctx.role) {
    return { allowed: false, reason: 'not_a_member', requiredPlan: null,
      message: 'You do not have access to this workspace.' }
  }

  const moduleId = moduleFor(capability)
  const moduleDecision = isModuleAvailable(ctx, moduleId)
  if (!moduleDecision.allowed) return moduleDecision

  const granted = ROLE_CAPABILITIES[String(ctx.role)] ?? []
  if (!granted.includes(capability)) {
    return { allowed: false, reason: 'role', requiredPlan: null,
      message: 'Your role does not permit this action.' }
  }

  if (isWriteCapability(capability)) {
    const status = ctx.planStatus ?? 'active'
    if (status === 'cancelled' || status === 'paused' || status === 'past_due') {
      return { allowed: false, reason: 'workspace_status', requiredPlan: null,
        message: `This workspace is ${status.replace('_', ' ')} and is currently read-only.` }
    }
  }

  if (capability === 'brand.assets.upload' && ctx.storage) {
    const { bytesUsed, bytesQuota } = ctx.storage
    if (bytesQuota > 0 && bytesUsed >= bytesQuota) {
      return { allowed: false, reason: 'storage_quota', requiredPlan: null,
        message: 'Storage quota reached. Free space or upgrade to upload.' }
    }
  }

  return { allowed: true, reason: null, requiredPlan: null, message: null }
}

/** Convenience boolean for render-time gating. */
export function can(ctx: BrandEntitlementContext, capability: BrandCapability): boolean {
  return canAccessBrandCapability(ctx, capability).allowed
}

/** Modules to render as tabs — unavailable ones are removed, never disabled. */
export function visibleModules(ctx: BrandEntitlementContext): BrandModule[] {
  return BRAND_MODULES.filter(m => {
    if (!isModuleAvailable(ctx, m).allowed) return false
    if (m === 'overview') return true
    return can(ctx, `brand.${m}.view` as BrandCapability)
  })
}

export function labelFor(module: BrandModule): string {
  switch (module) {
    case 'overview': return 'Overview'
    case 'kits': return 'Brand Kits'
    case 'assets': return 'Assets'
    case 'rights': return 'Rights'
    case 'products': return 'Product Library'
  }
}

/** URL segment for a module under `/{type}/brand`. Overview is the index. */
export function pathFor(module: BrandModule): string {
  return module === 'overview' ? '' : module
}
