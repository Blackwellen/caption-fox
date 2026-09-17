// The single Link in Bio entitlement resolver.
//
// Sidebar visibility, route guards, buttons, server actions and API handlers
// all call canAccessLinks / canAccessLinkCapability. Nothing else may hardcode
// a plan or role check for Link in Bio.
//
// A capability is granted only when every layer agrees:
//   surface -> is Link in Bio part of this workspace type's product
//   status  -> is the subscription active
//   flag    -> is the module / capability switched on for this workspace
//   plan    -> does the plan include the capability (limits apply separately)
//   role    -> does the member hold the permission

import { PERMISSIONS, getDefaultPermissions, type Permission } from '@/lib/permissions'

/** Workspace route segments whose product includes Link in Bio. */
export const LINKS_SURFACES = ['creator', 'business', 'brand', 'agency'] as const

export function surfaceHasLinks(workspaceType: string | null | undefined): boolean {
  return (LINKS_SURFACES as readonly string[]).includes(workspaceType ?? '')
}

export type LinkCapability =
  | 'view' | 'pages.create' | 'pages.edit' | 'pages.publish' | 'pages.approve' | 'pages.archive'
  | 'conversion.create' | 'reusable.manage' | 'themes.manage' | 'themes.publish'
  | 'analytics.view' | 'analytics.compare' | 'analytics.revenue' | 'export'
  | 'domains.manage' | 'pixels.manage' | 'forms.manage' | 'products.manage' | 'versions.restore'

type PlanId = 'free' | 'creator_pro' | 'team' | 'agency' | 'enterprise'
const PLAN_RANK: Record<PlanId, number> = { free: 0, creator_pro: 1, team: 2, agency: 3, enterprise: 4 }

const PERMISSION_FOR: Record<LinkCapability, Permission> = {
  'view': PERMISSIONS.LINKS_VIEW,
  'pages.create': PERMISSIONS.LINKS_CREATE,
  'pages.edit': PERMISSIONS.LINKS_EDIT,
  'pages.publish': PERMISSIONS.LINKS_PUBLISH,
  'pages.approve': PERMISSIONS.LINKS_APPROVE,
  'pages.archive': PERMISSIONS.LINKS_ARCHIVE,
  'conversion.create': PERMISSIONS.LINKS_CREATE,
  'reusable.manage': PERMISSIONS.LINKS_REUSABLE_MANAGE,
  'themes.manage': PERMISSIONS.LINKS_THEMES_MANAGE,
  'themes.publish': PERMISSIONS.LINKS_THEMES_PUBLISH,
  'analytics.view': PERMISSIONS.LINKS_ANALYTICS_VIEW,
  'analytics.compare': PERMISSIONS.LINKS_ANALYTICS_VIEW,
  'analytics.revenue': PERMISSIONS.LINKS_ANALYTICS_VIEW,
  'export': PERMISSIONS.LINKS_EXPORT,
  'domains.manage': PERMISSIONS.LINKS_DOMAINS_MANAGE,
  'pixels.manage': PERMISSIONS.LINKS_PIXELS_MANAGE,
  'forms.manage': PERMISSIONS.LINKS_FORMS_MANAGE,
  'products.manage': PERMISSIONS.LINKS_EDIT,
  'versions.restore': PERMISSIONS.LINKS_VERSIONS_RESTORE,
}

/** Minimum plan per capability. Anything unlisted is on every plan. */
const MIN_PLAN: Partial<Record<LinkCapability, PlanId>> = {
  'pixels.manage': 'creator_pro',
  'forms.manage': 'creator_pro',
  'products.manage': 'creator_pro',
  'conversion.create': 'team',
  'domains.manage': 'team',
  'analytics.compare': 'team',
  'analytics.revenue': 'team',
  'export': 'creator_pro',
}

const PLAN_LABEL: Record<PlanId, string> = {
  free: 'Free', creator_pro: 'Creator Pro', team: 'Team', agency: 'Agency', enterprise: 'Enterprise',
}

/** Record limits per plan; null means unlimited. */
export const LINK_LIMITS: Record<PlanId, { pages: number | null; reusableLinks: number | null; themes: number | null; analyticsDays: number }> = {
  free: { pages: 1, reusableLinks: 10, themes: 2, analyticsDays: 30 },
  creator_pro: { pages: 10, reusableLinks: 100, themes: 10, analyticsDays: 90 },
  team: { pages: 50, reusableLinks: 1000, themes: 50, analyticsDays: 365 },
  agency: { pages: null, reusableLinks: null, themes: null, analyticsDays: 730 },
  enterprise: { pages: null, reusableLinks: null, themes: null, analyticsDays: 1095 },
}

export type LinksContext = {
  workspaceType: string | null | undefined
  plan: string | null | undefined
  planStatus?: string | null
  role: string | null | undefined
  permissions?: string[] | null
  flags?: Record<string, boolean> | null
}

export type LinkDenial = {
  allowed: false
  reason: 'surface' | 'workspace_status' | 'flag' | 'plan' | 'role' | 'limit'
  message: string
  upgradeTo?: PlanId
  upgradeLabel?: string
}
export type LinkEntitlement = { allowed: true } | LinkDenial

const GRANT = { allowed: true } as const

export function normaliseLinksPlan(plan: string | null | undefined): PlanId {
  if (plan === 'starter') return 'free'
  if (plan === 'brand') return 'agency'
  return plan && plan in PLAN_RANK ? (plan as PlanId) : 'free'
}

function effectivePermissions(ctx: LinksContext): string[] {
  if (ctx.permissions && ctx.permissions.length > 0) return ctx.permissions
  return getDefaultPermissions(ctx.role ?? '') as string[]
}

/** Does this workspace/member get Link in Bio at all? */
export function canAccessLinks(ctx: LinksContext): LinkEntitlement {
  if (!surfaceHasLinks(ctx.workspaceType)) {
    return { allowed: false, reason: 'surface', message: 'Link in Bio is not part of this workspace type.' }
  }
  if (ctx.planStatus === 'cancelled' || ctx.planStatus === 'paused') {
    return { allowed: false, reason: 'workspace_status', message: 'This workspace subscription is not active.' }
  }
  if (ctx.flags && (ctx.flags.links === false || ctx.flags['modules.links'] === false)) {
    return { allowed: false, reason: 'flag', message: 'Link in Bio is switched off for this workspace.' }
  }
  if (!effectivePermissions(ctx).includes(PERMISSIONS.LINKS_VIEW)) {
    return { allowed: false, reason: 'role', message: 'Your role does not include access to Link in Bio.' }
  }
  return GRANT
}

export function canAccessLinkCapability(ctx: LinksContext, capability: LinkCapability): LinkEntitlement {
  const base = canAccessLinks(ctx)
  if (!base.allowed) return base

  if (ctx.flags && ctx.flags[`links.${capability}`] === false) {
    return { allowed: false, reason: 'flag', message: 'This feature is switched off for this workspace.' }
  }

  const minPlan = MIN_PLAN[capability]
  const plan = normaliseLinksPlan(ctx.plan)
  if (minPlan && PLAN_RANK[plan] < PLAN_RANK[minPlan]) {
    return {
      allowed: false, reason: 'plan', upgradeTo: minPlan, upgradeLabel: PLAN_LABEL[minPlan],
      message: `Included from the ${PLAN_LABEL[minPlan]} plan upwards.`,
    }
  }

  if (!effectivePermissions(ctx).includes(PERMISSION_FOR[capability])) {
    return { allowed: false, reason: 'role', message: 'Your role does not include this action.' }
  }
  return GRANT
}

/** Enforces a plan record limit. `current` is the live count before creating. */
export function checkLinkLimit(
  ctx: LinksContext,
  kind: 'pages' | 'reusableLinks' | 'themes',
  current: number,
): LinkEntitlement {
  const limit = LINK_LIMITS[normaliseLinksPlan(ctx.plan)][kind]
  if (limit === null || current < limit) return GRANT
  const noun = kind === 'pages' ? 'link pages' : kind === 'reusableLinks' ? 'reusable links' : 'themes'
  return {
    allowed: false, reason: 'limit',
    message: `Your plan includes ${limit} ${noun}. Archive one or upgrade to add more.`,
  }
}

export function resolveLinkCapabilities(ctx: LinksContext): Record<LinkCapability, boolean> {
  return (Object.keys(PERMISSION_FOR) as LinkCapability[]).reduce((acc, key) => {
    acc[key] = canAccessLinkCapability(ctx, key).allowed
    return acc
  }, {} as Record<LinkCapability, boolean>)
}

/** Disabled-control tooltip text, or null when the action is allowed. */
export function linkDenialMessage(ctx: LinksContext, capability: LinkCapability): string | null {
  const result = canAccessLinkCapability(ctx, capability)
  return result.allowed ? null : result.message
}
