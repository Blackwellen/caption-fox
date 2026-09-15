// The single Advertising entitlement resolver.
//
// Sidebar visibility, route guards, action buttons, server actions and API
// handlers all call canAccessAdvertising / canAccessAdvertisingCapability.
// Nothing else may hardcode a workspace-type or plan check for Advertising.
//
// A capability is granted only when EVERY layer agrees:
//   surface  -> is Advertising part of this workspace type's product at all
//   plan     -> does the subscription include the paid-media module
//   flag     -> is the capability switched on for this workspace
//   role     -> does the member hold the permission
//   provider -> can a connected provider actually perform the operation

import { PERMISSIONS, getDefaultPermissions, type Permission } from '@/lib/permissions'
import { getProvider, unionCapabilities, type AdProvider, type AdProviderCapability } from './providers'

/** Workspace route segments whose product includes the Advertising module. */
export const ADVERTISING_SURFACES = ['brand', 'agency'] as const
export type AdvertisingSurface = typeof ADVERTISING_SURFACES[number]

export function surfaceHasAdvertising(workspaceType: string | null | undefined): workspaceType is AdvertisingSurface {
  return (ADVERTISING_SURFACES as readonly string[]).includes(workspaceType ?? '')
}

/** Plans that include the paid-media module. Mirrors lib/plans.ts plan ids. */
const ADVERTISING_PLANS = new Set(['team', 'agency', 'enterprise'])
/** Plans that additionally include scheduled reports and shared presets. */
const ADVERTISING_REPORTING_PLANS = new Set(['agency', 'enterprise'])

export type AdvertisingCapability =
  | 'view'
  | 'accounts.view' | 'accounts.connect' | 'accounts.edit' | 'accounts.sync' | 'accounts.disconnect'
  | 'campaigns.view' | 'campaigns.create' | 'campaigns.edit' | 'campaigns.pause' | 'campaigns.bulk_edit' | 'campaigns.export'
  | 'creatives.view' | 'creatives.upload' | 'creatives.create' | 'creatives.review' | 'creatives.edit' | 'creatives.export'
  | 'audiences.view' | 'audiences.create' | 'audiences.sync' | 'audiences.edit' | 'audiences.export'
  | 'reports.view' | 'reports.create' | 'reports.schedule' | 'reports.export' | 'reports.manage_presets'

const PERMISSION_FOR: Record<AdvertisingCapability, Permission> = {
  'view': PERMISSIONS.ADVERTISING_VIEW,
  'accounts.view': PERMISSIONS.ADVERTISING_ACCOUNTS_VIEW,
  'accounts.connect': PERMISSIONS.ADVERTISING_ACCOUNTS_CONNECT,
  'accounts.edit': PERMISSIONS.ADVERTISING_ACCOUNTS_EDIT,
  'accounts.sync': PERMISSIONS.ADVERTISING_ACCOUNTS_SYNC,
  'accounts.disconnect': PERMISSIONS.ADVERTISING_ACCOUNTS_DISCONNECT,
  'campaigns.view': PERMISSIONS.ADVERTISING_CAMPAIGNS_VIEW,
  'campaigns.create': PERMISSIONS.ADVERTISING_CAMPAIGNS_CREATE,
  'campaigns.edit': PERMISSIONS.ADVERTISING_CAMPAIGNS_EDIT,
  'campaigns.pause': PERMISSIONS.ADVERTISING_CAMPAIGNS_PAUSE,
  'campaigns.bulk_edit': PERMISSIONS.ADVERTISING_CAMPAIGNS_BULK_EDIT,
  'campaigns.export': PERMISSIONS.ADVERTISING_CAMPAIGNS_EXPORT,
  'creatives.view': PERMISSIONS.ADVERTISING_CREATIVES_VIEW,
  'creatives.upload': PERMISSIONS.ADVERTISING_CREATIVES_UPLOAD,
  'creatives.create': PERMISSIONS.ADVERTISING_CREATIVES_CREATE,
  'creatives.review': PERMISSIONS.ADVERTISING_CREATIVES_REVIEW,
  'creatives.edit': PERMISSIONS.ADVERTISING_CREATIVES_EDIT,
  'creatives.export': PERMISSIONS.ADVERTISING_CREATIVES_EXPORT,
  'audiences.view': PERMISSIONS.ADVERTISING_AUDIENCES_VIEW,
  'audiences.create': PERMISSIONS.ADVERTISING_AUDIENCES_CREATE,
  'audiences.sync': PERMISSIONS.ADVERTISING_AUDIENCES_SYNC,
  'audiences.edit': PERMISSIONS.ADVERTISING_AUDIENCES_EDIT,
  'audiences.export': PERMISSIONS.ADVERTISING_AUDIENCES_EXPORT,
  'reports.view': PERMISSIONS.ADVERTISING_REPORTS_VIEW,
  'reports.create': PERMISSIONS.ADVERTISING_REPORTS_CREATE,
  'reports.schedule': PERMISSIONS.ADVERTISING_REPORTS_SCHEDULE,
  'reports.export': PERMISSIONS.ADVERTISING_REPORTS_EXPORT,
  'reports.manage_presets': PERMISSIONS.ADVERTISING_REPORTS_MANAGE_PRESETS,
}

/** Capabilities that additionally require a provider to support the operation. */
const PROVIDER_REQUIREMENT: Partial<Record<AdvertisingCapability, keyof AdProviderCapability>> = {
  'campaigns.create': 'writeCampaigns',
  'campaigns.edit': 'writeCampaigns',
  'campaigns.pause': 'pauseCampaigns',
  'campaigns.bulk_edit': 'pauseCampaigns',
  'creatives.upload': 'uploadCreatives',
  'creatives.create': 'uploadCreatives',
  'audiences.create': 'createAudiences',
  'audiences.sync': 'syncAudiences',
}

/** Capabilities that require a higher plan than the base Advertising module. */
const REPORTING_PLAN_CAPABILITIES = new Set<AdvertisingCapability>(['reports.schedule', 'reports.manage_presets'])

export type AdvertisingContext = {
  workspaceType: string | null | undefined
  /** Plan id from lib/plans.ts. */
  plan: string | null | undefined
  planStatus?: string | null
  /** Member role in the active workspace. */
  role: string | null | undefined
  /** Explicit permission overrides; falls back to role defaults. */
  permissions?: string[] | null
  /** Feature flags stored on the workspace settings blob. */
  flags?: Record<string, boolean> | null
  /** Providers with a live connection in this workspace. */
  connectedProviders?: string[]
  /** Restrict a provider-gated check to one provider. */
  provider?: AdProvider | null
}

export type Denial = {
  allowed: false
  reason: 'surface' | 'plan' | 'plan_tier' | 'flag' | 'role' | 'workspace_status' | 'provider'
  message: string
  /** Set when the block is resolvable by upgrading. */
  upgradeTo?: 'team' | 'agency'
}
export type Grant = { allowed: true }
export type EntitlementResult = Grant | Denial

const GRANT: Grant = { allowed: true }

function effectivePermissions(ctx: AdvertisingContext): string[] {
  if (ctx.permissions && ctx.permissions.length > 0) return ctx.permissions
  return getDefaultPermissions(ctx.role ?? '') as string[]
}

/** Does this workspace/member get the Advertising module at all? */
export function canAccessAdvertising(ctx: AdvertisingContext): EntitlementResult {
  if (!surfaceHasAdvertising(ctx.workspaceType)) {
    return { allowed: false, reason: 'surface', message: 'Advertising is not part of this workspace type.' }
  }
  if (ctx.planStatus === 'cancelled' || ctx.planStatus === 'paused') {
    return { allowed: false, reason: 'workspace_status', message: 'This workspace subscription is not active.' }
  }
  if (!ADVERTISING_PLANS.has(ctx.plan ?? '')) {
    return {
      allowed: false, reason: 'plan', upgradeTo: 'team',
      message: 'Advertising is included from the Team plan upwards.',
    }
  }
  if (ctx.flags && ctx.flags.advertising === false) {
    return { allowed: false, reason: 'flag', message: 'Advertising is switched off for this workspace.' }
  }
  if (!effectivePermissions(ctx).includes(PERMISSIONS.ADVERTISING_VIEW)) {
    return { allowed: false, reason: 'role', message: 'Your role does not include access to Advertising.' }
  }
  return GRANT
}

/** Full gate for one capability. Every action must pass through this. */
export function canAccessAdvertisingCapability(
  ctx: AdvertisingContext,
  capability: AdvertisingCapability,
): EntitlementResult {
  const base = canAccessAdvertising(ctx)
  if (!base.allowed) return base

  if (REPORTING_PLAN_CAPABILITIES.has(capability) && !ADVERTISING_REPORTING_PLANS.has(ctx.plan ?? '')) {
    return {
      allowed: false, reason: 'plan_tier', upgradeTo: 'agency',
      message: 'Scheduled reports and shared presets are included from the Agency plan.',
    }
  }

  const flagKey = `advertising.${capability}`
  if (ctx.flags && ctx.flags[flagKey] === false) {
    return { allowed: false, reason: 'flag', message: 'This action is switched off for this workspace.' }
  }

  if (!effectivePermissions(ctx).includes(PERMISSION_FOR[capability])) {
    return { allowed: false, reason: 'role', message: 'Your role does not include this action.' }
  }

  const requirement = PROVIDER_REQUIREMENT[capability]
  if (requirement) {
    const providers = ctx.provider ? [ctx.provider] : (ctx.connectedProviders ?? [])
    if (providers.length === 0) {
      return { allowed: false, reason: 'provider', message: 'Connect an advertising account to use this action.' }
    }
    const supported = ctx.provider
      ? (getProvider(ctx.provider)?.capabilities[requirement] ?? false)
      : unionCapabilities(providers)[requirement]
    if (!supported) {
      return {
        allowed: false, reason: 'provider',
        message: ctx.provider
          ? `${getProvider(ctx.provider)?.name ?? ctx.provider} does not support this action through its API.`
          : 'None of your connected platforms support this action.',
      }
    }
  }

  return GRANT
}

export function allows(ctx: AdvertisingContext, capability: AdvertisingCapability): boolean {
  return canAccessAdvertisingCapability(ctx, capability).allowed
}

/** Pre-computes a capability map to pass into client components as one prop. */
export function resolveCapabilities(ctx: AdvertisingContext): Record<AdvertisingCapability, boolean> {
  const keys = Object.keys(PERMISSION_FOR) as AdvertisingCapability[]
  return keys.reduce((acc, key) => {
    acc[key] = allows(ctx, key)
    return acc
  }, {} as Record<AdvertisingCapability, boolean>)
}

/** The reason string a disabled control shows in its tooltip. */
export function denialMessage(ctx: AdvertisingContext, capability: AdvertisingCapability): string | null {
  const result = canAccessAdvertisingCapability(ctx, capability)
  return result.allowed ? null : result.message
}
