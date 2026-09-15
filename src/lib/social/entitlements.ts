// Central Social entitlement resolver.
//
// Navigation, route guards, sub-tabs, buttons, server actions, exports and
// scheduled jobs all resolve access through this one module so workspace-type,
// plan, add-on, feature-flag, role and provider-capability checks never get
// scattered across page components.

import { PERMISSIONS, ROLE_PERMISSIONS, type Permission } from '@/lib/permissions'
import { capabilitiesFor, type SocialProviderCapabilities } from './providers'
import type { ConnectionHealth, SocialProvider } from '@/types/social'

export const PLAN_RANK: Record<string, number> = {
  starter: 0, creator_pro: 1, team: 2, brand: 3, enterprise: 4,
}

export type WorkspaceKind = 'creator' | 'small_business' | 'brand' | 'agency'

export const SOCIAL_SURFACES = [
  'overview', 'publishing', 'engagement', 'listening', 'connections', 'analytics',
] as const
export type SocialSurface = (typeof SOCIAL_SURFACES)[number]

export const SURFACE_LABELS: Record<SocialSurface, string> = {
  overview: 'Overview',
  publishing: 'Publishing',
  engagement: 'Engagement',
  listening: 'Listening',
  connections: 'Connections',
  analytics: 'Analytics',
}

export interface SocialContextInput {
  workspaceId: string
  workspaceType: string | null | undefined
  plan: string | null | undefined
  planStatus: string | null | undefined
  role: string | null | undefined
  isPlatformAdmin?: boolean
  /** Workspace-level feature flags, read from `workspaces.settings.feature_flags`. */
  flags?: Record<string, boolean>
  /** Number of channels currently connected — used for the plan channel cap. */
  connectedChannels?: number
}

interface SurfaceRule {
  permission: Permission
  minPlan?: keyof typeof PLAN_RANK
  types?: WorkspaceKind[]
  /** Feature flag key. Missing flag = enabled (flags gate, they do not grant). */
  flag?: string
  upgradeReason?: string
}

const SURFACE_RULES: Record<SocialSurface, SurfaceRule> = {
  overview: { permission: PERMISSIONS.SOCIAL_VIEW },
  connections: { permission: PERMISSIONS.SOCIAL_CONNECTIONS_VIEW },
  publishing: {
    permission: PERMISSIONS.SOCIAL_PUBLISHING_VIEW,
    flag: 'social_publishing',
  },
  engagement: {
    permission: PERMISSIONS.SOCIAL_ENGAGEMENT_VIEW,
    minPlan: 'creator_pro',
    flag: 'social_engagement',
    upgradeReason: 'The unified engagement inbox — comments, DMs, mentions, assignments and SLA tracking — is available from Creator Pro.',
  },
  listening: {
    permission: PERMISSIONS.SOCIAL_LISTENING_VIEW,
    minPlan: 'team',
    types: ['small_business', 'brand', 'agency'],
    flag: 'social_listening',
    upgradeReason: 'Social listening — keyword monitoring, sentiment, topics and alerts — is available from Team.',
  },
  analytics: { permission: PERMISSIONS.SOCIAL_ANALYTICS_VIEW },
}

/** Capability-level gates that sit above the surface gates. */
const CAPABILITY_RULES: Partial<Record<Permission, Omit<SurfaceRule, 'permission'>>> = {
  [PERMISSIONS.SOCIAL_ANALYTICS_SCHEDULE_REPORT]: {
    minPlan: 'team',
    upgradeReason: 'Scheduled report delivery is available from Team.',
  },
  [PERMISSIONS.SOCIAL_LISTENING_CREATE_ALERT]: {
    minPlan: 'team',
    upgradeReason: 'Listening alerts are available from Team.',
  },
  [PERMISSIONS.SOCIAL_ENGAGEMENT_ASSIGN]: {
    minPlan: 'team',
    upgradeReason: 'Conversation assignment and team workload need a Team plan.',
  },
  [PERMISSIONS.SOCIAL_ENGAGEMENT_TEMPLATES]: {
    minPlan: 'creator_pro',
    upgradeReason: 'Shared reply templates are available from Creator Pro.',
  },
}

/** Maximum connected channels per plan. `null` = unlimited. */
export const CHANNEL_LIMITS: Record<string, number | null> = {
  starter: 3, creator_pro: 6, team: 15, brand: 40, enterprise: null,
}

export type AccessResult =
  | { allowed: true }
  | {
      allowed: false
      reason: 'permission' | 'workspace_type' | 'plan' | 'subscription' | 'feature_flag' | 'quota' | 'provider'
      message: string
      upgrade: boolean
    }

function permissionsFor(ctx: SocialContextInput): Permission[] {
  if (ctx.isPlatformAdmin) return Object.values(PERMISSIONS) as Permission[]
  return ROLE_PERMISSIONS[ctx.role ?? ''] ?? []
}

export function hasSocialPermission(ctx: SocialContextInput, permission: Permission): boolean {
  return permissionsFor(ctx).includes(permission)
}

function planAllows(ctx: SocialContextInput, minPlan?: keyof typeof PLAN_RANK): boolean {
  if (!minPlan) return true
  return (PLAN_RANK[ctx.plan ?? 'starter'] ?? 0) >= PLAN_RANK[minPlan]
}

function flagAllows(ctx: SocialContextInput, flag?: string): boolean {
  if (!flag) return true
  // A flag that has never been set is on; only an explicit `false` disables.
  return ctx.flags?.[flag] !== false
}

function evaluate(ctx: SocialContextInput, rule: SurfaceRule): AccessResult {
  if (ctx.planStatus === 'cancelled') {
    return { allowed: false, reason: 'subscription', upgrade: true, message: 'This workspace subscription has been cancelled. Reactivate billing to use Social.' }
  }
  if (!hasSocialPermission(ctx, rule.permission)) {
    return { allowed: false, reason: 'permission', upgrade: false, message: 'Your role does not include access to this area.' }
  }
  if (rule.types && !rule.types.includes((ctx.workspaceType ?? '') as WorkspaceKind)) {
    return { allowed: false, reason: 'workspace_type', upgrade: false, message: 'This area is not part of this workspace type.' }
  }
  if (!flagAllows(ctx, rule.flag)) {
    return { allowed: false, reason: 'feature_flag', upgrade: false, message: 'This area is turned off for this workspace.' }
  }
  if (!planAllows(ctx, rule.minPlan)) {
    return { allowed: false, reason: 'plan', upgrade: true, message: rule.upgradeReason ?? 'Upgrade your plan to use this area.' }
  }
  return { allowed: true }
}

/** Can this context open a Social page? */
export function canAccessSocialSurface(ctx: SocialContextInput, surface: SocialSurface): AccessResult {
  return evaluate(ctx, SURFACE_RULES[surface])
}

/** Can this context perform a specific Social capability? */
export function canAccessSocialCapability(
  ctx: SocialContextInput,
  capability: Permission,
  options?: { provider?: SocialProvider; providerCapability?: keyof SocialProviderCapabilities },
): AccessResult {
  const extra = CAPABILITY_RULES[capability] ?? {}
  const result = evaluate(ctx, { permission: capability, ...extra })
  if (!result.allowed) return result

  if (options?.provider && options.providerCapability) {
    const value = capabilitiesFor(options.provider)[options.providerCapability]
    const supported = Array.isArray(value) ? value.length > 0 : Boolean(value)
    if (!supported) {
      return { allowed: false, reason: 'provider', upgrade: false, message: `${options.provider} does not support this action.` }
    }
  }
  return { allowed: true }
}

/** Surfaces this context should see in navigation. */
export function visibleSocialSurfaces(ctx: SocialContextInput): SocialSurface[] {
  return SOCIAL_SURFACES.filter(surface => canAccessSocialSurface(ctx, surface).allowed)
}

export function canConnectAnotherChannel(ctx: SocialContextInput): AccessResult {
  const base = canAccessSocialCapability(ctx, PERMISSIONS.SOCIAL_CONNECTIONS_CONNECT)
  if (!base.allowed) return base
  const limit = CHANNEL_LIMITS[ctx.plan ?? 'starter']
  if (limit !== null && limit !== undefined && (ctx.connectedChannels ?? 0) >= limit) {
    return {
      allowed: false, reason: 'quota', upgrade: true,
      message: `Your plan includes ${limit} connected channels. Upgrade to connect more.`,
    }
  }
  return { allowed: true }
}

/** A connection in one of these states cannot publish or reply. */
export const BLOCKED_HEALTH: ConnectionHealth[] = ['error', 'disconnected', 'expired']

export function connectionCanAct(health: ConnectionHealth): boolean {
  return !BLOCKED_HEALTH.includes(health)
}
