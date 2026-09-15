// Central Messaging entitlement resolver.
//
// Every Messaging surface — navigation, sub-tabs, route guards, actions,
// composer channel buttons, imports and exports — resolves visibility through
// this one module so workspace-type / plan / role checks never get scattered
// across eight pages.

import { PERMISSIONS, ROLE_PERMISSIONS, type Permission } from '@/lib/permissions'
import { MESSAGING_MODULES, type MessagingModule, type MessagingChannel } from './constants'

/** Plan identifiers as stored on `workspaces.plan`. */
export const PLAN_RANK: Record<string, number> = {
  starter: 0, creator_pro: 1, team: 2, brand: 3, enterprise: 4,
}

export type WorkspaceKind = 'creator' | 'small_business' | 'brand' | 'agency'

export interface MessagingContext {
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

const MODULE_RULES: Record<MessagingModule, ModuleRule> = {
  overview: { permission: PERMISSIONS.MESSAGING_VIEW },
  email: { permission: PERMISSIONS.MESSAGING_VIEW },
  sms: {
    permission: PERMISSIONS.MESSAGING_VIEW, minPlan: 'creator_pro',
    upgradeReason: 'SMS messaging is available from Creator Pro.',
  },
  whatsapp: {
    permission: PERMISSIONS.MESSAGING_VIEW, minPlan: 'team',
    upgradeReason: 'WhatsApp messaging and approved templates are available from Team.',
  },
  rcs: {
    permission: PERMISSIONS.MESSAGING_VIEW, minPlan: 'team',
    upgradeReason: 'RCS rich messaging is available from Team.',
  },
  push: {
    permission: PERMISSIONS.MESSAGING_VIEW, minPlan: 'creator_pro',
    upgradeReason: 'Push messaging is available from Creator Pro.',
  },
  journeys: {
    permission: PERMISSIONS.MESSAGING_JOURNEYS_VIEW, minPlan: 'team',
    upgradeReason: 'Automated messaging journeys are available from Team.',
  },
  templates: { permission: PERMISSIONS.MESSAGING_TEMPLATES_VIEW },
}

/** Channels this workspace type is designed to reach — hides irrelevant composer buttons. */
const TYPE_CHANNELS: Record<WorkspaceKind, MessagingChannel[]> = {
  creator: ['email', 'sms', 'push'],
  small_business: ['email', 'sms', 'whatsapp', 'rcs', 'push'],
  brand: ['email', 'sms', 'whatsapp', 'rcs', 'push'],
  agency: ['email', 'sms', 'whatsapp', 'rcs', 'push'],
}

export type ModuleAccess =
  | { allowed: true }
  | { allowed: false; reason: 'permission' | 'workspace_type' | 'plan' | 'subscription'; message: string; upgrade: boolean }

function permissionsFor(ctx: MessagingContext): Permission[] {
  if (ctx.isPlatformAdmin) return Object.values(PERMISSIONS) as Permission[]
  return ROLE_PERMISSIONS[ctx.role ?? ''] ?? []
}

export function hasMessagingPermission(ctx: MessagingContext, permission: Permission): boolean {
  return permissionsFor(ctx).includes(permission)
}

/** Resolves whether a Messaging module is reachable for this context. */
export function canAccessMessagingModule(ctx: MessagingContext, module: MessagingModule): ModuleAccess {
  const rule = MODULE_RULES[module]

  if (ctx.planStatus === 'cancelled') {
    return {
      allowed: false, reason: 'subscription', upgrade: true,
      message: 'This workspace subscription has been cancelled. Reactivate a plan to use Messaging.',
    }
  }

  if (!hasMessagingPermission(ctx, rule.permission)) {
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

/** The Messaging sub-tabs this context may actually open, in canonical order. */
export function visibleMessagingModules(ctx: MessagingContext): MessagingModule[] {
  return MESSAGING_MODULES.filter(module => canAccessMessagingModule(ctx, module).allowed)
}

/** Channels visible in composer/quick-action UI for this workspace + plan. */
export function visibleMessagingChannels(ctx: MessagingContext): MessagingChannel[] {
  const byType = TYPE_CHANNELS[(ctx.workspaceType ?? 'small_business') as WorkspaceKind] ?? TYPE_CHANNELS.small_business
  const moduleByChannel: Record<MessagingChannel, MessagingModule> = {
    email: 'email', sms: 'sms', whatsapp: 'whatsapp', rcs: 'rcs', push: 'push',
  }
  return byType.filter(channel => canAccessMessagingModule(ctx, moduleByChannel[channel]).allowed)
}

// ── Action-level capabilities ────────────────────────────────────────────────

export interface MessagingCapabilities {
  view: boolean
  create: boolean
  edit: boolean
  delete: boolean
  approve: boolean
  schedule: boolean
  send: boolean
  testSend: boolean
  export: boolean
  import: boolean
  manageJourneys: boolean
  activateJourneys: boolean
  manageTemplates: boolean
  approveTemplates: boolean
  manageAudience: boolean
  viewConsent: boolean
  manageChannels: boolean
}

export function messagingCapabilities(ctx: MessagingContext): MessagingCapabilities {
  const perms = permissionsFor(ctx)
  const has = (p: Permission) => perms.includes(p)

  return {
    view: has(PERMISSIONS.MESSAGING_VIEW),
    create: has(PERMISSIONS.MESSAGING_CREATE),
    edit: has(PERMISSIONS.MESSAGING_EDIT),
    delete: has(PERMISSIONS.MESSAGING_DELETE),
    approve: has(PERMISSIONS.MESSAGING_APPROVE),
    schedule: has(PERMISSIONS.MESSAGING_SCHEDULE),
    send: has(PERMISSIONS.MESSAGING_SEND),
    testSend: has(PERMISSIONS.MESSAGING_TEST_SEND),
    export: has(PERMISSIONS.MESSAGING_EXPORT),
    import: has(PERMISSIONS.MESSAGING_IMPORT),
    manageJourneys: has(PERMISSIONS.MESSAGING_JOURNEYS_EDIT),
    activateJourneys: has(PERMISSIONS.MESSAGING_JOURNEYS_ACTIVATE),
    manageTemplates: has(PERMISSIONS.MESSAGING_TEMPLATES_EDIT),
    approveTemplates: has(PERMISSIONS.MESSAGING_TEMPLATES_APPROVE),
    manageAudience: has(PERMISSIONS.MESSAGING_AUDIENCE_MANAGE),
    viewConsent: has(PERMISSIONS.MESSAGING_CONSENT_VIEW),
    manageChannels: has(PERMISSIONS.MESSAGING_CHANNELS_MANAGE),
  }
}
