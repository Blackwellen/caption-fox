// Central Campaign Manager → Studio entitlement resolver.
//
// Every Studio surface — navigation, sub-tabs, route guards, actions, uploads,
// AI runs, imports and exports — resolves visibility through this one module so
// workspace-type / plan / role checks never get scattered across pages.

import { PERMISSIONS, ROLE_PERMISSIONS, type Permission } from '@/lib/permissions'
import { getPlanLimits, type PlanId } from '@/lib/plans'
import { STUDIO_MODULES, type StudioModule } from './constants'

/** Plan identifiers as stored on `workspaces.plan`, ranked lowest to highest. */
export const PLAN_RANK: Record<string, number> = {
  free: 0, starter: 0, creator_pro: 1, team: 2, brand: 3, agency: 3, enterprise: 4,
}

/** Bridges `workspaces.plan` values onto the `plans.ts` PlanId vocabulary. */
export const PLAN_MAP: Record<string, PlanId> = {
  free: 'free', starter: 'free', creator_pro: 'creator_pro',
  team: 'team', brand: 'agency', agency: 'agency', enterprise: 'enterprise',
}

export type WorkspaceKind = 'creator' | 'small_business' | 'brand' | 'agency'

export interface StudioContext {
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

const MODULE_RULES: Record<StudioModule, ModuleRule> = {
  overview: { permission: PERMISSIONS.STUDIO_VIEW },
  compose: { permission: PERMISSIONS.STUDIO_COMPOSE },
  'ai-generate': {
    permission: PERMISSIONS.STUDIO_AI_VIEW,
    upgradeReason: 'AI Generate is available on every paid plan. Upgrade to create content with AI.',
  },
  ideas: { permission: PERMISSIONS.STUDIO_IDEAS_VIEW },
  templates: {
    permission: PERMISSIONS.STUDIO_TEMPLATES_VIEW, minPlan: 'creator_pro',
    upgradeReason: 'Reusable, brand-approved Studio templates are available from Creator Pro.',
  },
  hashtags: { permission: PERMISSIONS.STUDIO_HASHTAGS_VIEW },
  media: { permission: PERMISSIONS.STUDIO_MEDIA_VIEW },
  content: {
    permission: PERMISSIONS.STUDIO_VIEW, minPlan: 'creator_pro',
    upgradeReason: 'The Content Library, bulk actions and repurposing are available from Creator Pro.',
  },
}

export type ModuleAccess =
  | { allowed: true }
  | { allowed: false; reason: 'permission' | 'workspace_type' | 'plan' | 'subscription'; message: string; upgrade: boolean }

function permissionsFor(ctx: StudioContext): Permission[] {
  if (ctx.isPlatformAdmin) return Object.values(PERMISSIONS) as Permission[]
  return ROLE_PERMISSIONS[ctx.role ?? ''] ?? []
}

export function hasStudioPermission(ctx: StudioContext, permission: Permission): boolean {
  return permissionsFor(ctx).includes(permission)
}

/** Resolves whether a Studio module is reachable for this context. */
export function canAccessStudioModule(ctx: StudioContext, module: StudioModule): ModuleAccess {
  const rule = MODULE_RULES[module]

  if (ctx.planStatus === 'cancelled') {
    return {
      allowed: false, reason: 'subscription', upgrade: true,
      message: 'This workspace subscription has been cancelled. Reactivate a plan to use Studio.',
    }
  }

  if (!hasStudioPermission(ctx, rule.permission)) {
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

/** The Studio sub-tabs this context may actually open, in canonical order. */
export function visibleStudioModules(ctx: StudioContext): StudioModule[] {
  return STUDIO_MODULES.filter(module => canAccessStudioModule(ctx, module).allowed)
}

// ── Action-level capabilities ────────────────────────────────────────────────

export interface StudioCapabilities {
  view: boolean
  compose: boolean
  createContent: boolean
  editContent: boolean
  deleteContent: boolean
  approveContent: boolean
  scheduleContent: boolean
  publishContent: boolean
  exportContent: boolean
  importContent: boolean
  repurpose: boolean
  viewAi: boolean
  generateAi: boolean
  managePrompts: boolean
  useBrandVoice: boolean
  viewIdeas: boolean
  createIdeas: boolean
  editIdeas: boolean
  convertIdeas: boolean
  viewTemplates: boolean
  createTemplates: boolean
  editTemplates: boolean
  publishTemplates: boolean
  approveTemplates: boolean
  viewHashtags: boolean
  createHashtags: boolean
  editHashtags: boolean
  exportHashtags: boolean
  viewMedia: boolean
  uploadMedia: boolean
  editMedia: boolean
  approveMedia: boolean
  deleteMedia: boolean
}

export function studioCapabilities(ctx: StudioContext): StudioCapabilities {
  const perms = permissionsFor(ctx)
  const has = (p: Permission) => perms.includes(p)

  return {
    view: has(PERMISSIONS.STUDIO_VIEW),
    compose: has(PERMISSIONS.STUDIO_COMPOSE),
    createContent: has(PERMISSIONS.STUDIO_CONTENT_CREATE),
    editContent: has(PERMISSIONS.STUDIO_CONTENT_EDIT),
    deleteContent: has(PERMISSIONS.STUDIO_CONTENT_DELETE),
    approveContent: has(PERMISSIONS.STUDIO_CONTENT_APPROVE),
    scheduleContent: has(PERMISSIONS.STUDIO_CONTENT_SCHEDULE),
    publishContent: has(PERMISSIONS.STUDIO_CONTENT_PUBLISH),
    exportContent: has(PERMISSIONS.STUDIO_CONTENT_EXPORT),
    importContent: has(PERMISSIONS.STUDIO_CONTENT_IMPORT),
    repurpose: has(PERMISSIONS.STUDIO_CONTENT_REPURPOSE),
    viewAi: has(PERMISSIONS.STUDIO_AI_VIEW),
    generateAi: has(PERMISSIONS.STUDIO_AI_GENERATE),
    managePrompts: has(PERMISSIONS.STUDIO_AI_MANAGE_PROMPTS),
    useBrandVoice: has(PERMISSIONS.STUDIO_AI_USE_BRAND_VOICE),
    viewIdeas: has(PERMISSIONS.STUDIO_IDEAS_VIEW),
    createIdeas: has(PERMISSIONS.STUDIO_IDEAS_CREATE),
    editIdeas: has(PERMISSIONS.STUDIO_IDEAS_EDIT),
    convertIdeas: has(PERMISSIONS.STUDIO_IDEAS_CONVERT),
    viewTemplates: has(PERMISSIONS.STUDIO_TEMPLATES_VIEW),
    createTemplates: has(PERMISSIONS.STUDIO_TEMPLATES_CREATE),
    editTemplates: has(PERMISSIONS.STUDIO_TEMPLATES_EDIT),
    publishTemplates: has(PERMISSIONS.STUDIO_TEMPLATES_PUBLISH),
    approveTemplates: has(PERMISSIONS.STUDIO_TEMPLATES_APPROVE),
    viewHashtags: has(PERMISSIONS.STUDIO_HASHTAGS_VIEW),
    createHashtags: has(PERMISSIONS.STUDIO_HASHTAGS_CREATE),
    editHashtags: has(PERMISSIONS.STUDIO_HASHTAGS_EDIT),
    exportHashtags: has(PERMISSIONS.STUDIO_HASHTAGS_EXPORT),
    viewMedia: has(PERMISSIONS.STUDIO_MEDIA_VIEW),
    uploadMedia: has(PERMISSIONS.STUDIO_MEDIA_UPLOAD),
    editMedia: has(PERMISSIONS.STUDIO_MEDIA_EDIT),
    approveMedia: has(PERMISSIONS.STUDIO_MEDIA_APPROVE),
    deleteMedia: has(PERMISSIONS.STUDIO_MEDIA_DELETE),
  }
}

// ── Usage limits ─────────────────────────────────────────────────────────────

export interface StudioLimits {
  /** Monthly AI generations included in the plan. -1 = unlimited. */
  aiMonthly: number
  /** Monthly scheduled posts included in the plan. -1 = unlimited. */
  scheduledPostsMonthly: number
  /** Storage ceiling for media uploads, in bytes. */
  storageBytes: number
}

const STORAGE_BY_PLAN: Record<PlanId, number> = {
  free: 2 * 1024 ** 3,
  creator_pro: 50 * 1024 ** 3,
  team: 250 * 1024 ** 3,
  agency: 1024 ** 4,
  enterprise: 5 * 1024 ** 4,
}

export function studioLimits(ctx: StudioContext): StudioLimits {
  const planId = PLAN_MAP[ctx.plan ?? 'starter'] ?? 'free'
  const limits = getPlanLimits(planId)
  return {
    aiMonthly: limits.aiMonthly,
    scheduledPostsMonthly: limits.scheduledPostsMonthly,
    storageBytes: STORAGE_BY_PLAN[planId],
  }
}

/** `-1` means unlimited, so a plain `used < limit` comparison is not enough. */
export function withinLimit(used: number, limit: number): boolean {
  return limit < 0 || used < limit
}
