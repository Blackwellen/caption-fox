// Central Automations module entitlement resolver. Mirrors
// src/lib/community/entitlements.ts.

import { PERMISSIONS, ROLE_PERMISSIONS, type Permission } from '@/lib/permissions'
import { AUTOMATION_MODULES, type AutomationModule } from './constants'

export interface AutomationContext {
  workspaceId: string
  plan: string | null | undefined
  planStatus: string | null | undefined
  role: string | null | undefined
  isPlatformAdmin?: boolean
}

interface ModuleRule { permission: Permission }

const MODULE_RULES: Record<AutomationModule, ModuleRule> = {
  overview: { permission: PERMISSIONS.AUTOMATIONS_VIEW },
  logs: { permission: PERMISSIONS.AUTOMATIONS_VIEW_LOGS },
}

/**
 * Active-automation cap per plan. This is the profitability control CLAUDE.md
 * calls for on cost-bearing surfaces — without it a single workspace on the
 * cheapest plan could run an unbounded number of DB-trigger-backed
 * automations against shared infrastructure. Enforced both in the UI
 * (`activeAutomationLimit`) and, for the actual write, in the server action.
 */
export const ACTIVE_AUTOMATION_LIMIT: Record<string, number> = {
  starter: 3, creator_pro: 5, team: 15, brand: 25, enterprise: 100,
}
export function activeAutomationLimit(plan: string | null | undefined): number {
  return ACTIVE_AUTOMATION_LIMIT[plan ?? 'starter'] ?? ACTIVE_AUTOMATION_LIMIT.starter
}

export type ModuleAccess =
  | { allowed: true }
  | { allowed: false; reason: 'permission' | 'subscription'; message: string; upgrade: boolean }

function permissionsFor(ctx: AutomationContext): Permission[] {
  if (ctx.isPlatformAdmin) return Object.values(PERMISSIONS) as Permission[]
  return ROLE_PERMISSIONS[ctx.role ?? ''] ?? []
}

export function hasAutomationPermission(ctx: AutomationContext, permission: Permission): boolean {
  return permissionsFor(ctx).includes(permission)
}

export function canAccessAutomationModule(ctx: AutomationContext, module: AutomationModule): ModuleAccess {
  const rule = MODULE_RULES[module]

  if (ctx.planStatus === 'cancelled') {
    return {
      allowed: false, reason: 'subscription', upgrade: true,
      message: 'This workspace subscription has been cancelled. Reactivate a plan to use Automations.',
    }
  }

  if (!hasAutomationPermission(ctx, rule.permission)) {
    return {
      allowed: false, reason: 'permission', upgrade: false,
      message: 'Your role does not include access to this area. Ask a workspace owner or admin for access.',
    }
  }

  return { allowed: true }
}

export function visibleAutomationModules(ctx: AutomationContext): AutomationModule[] {
  return AUTOMATION_MODULES.filter(module => canAccessAutomationModule(ctx, module).allowed)
}

export interface AutomationCapabilities {
  view: boolean
  create: boolean
  edit: boolean
  activate: boolean
  remove: boolean
  runManually: boolean
  viewLogs: boolean
  manageWebhooks: boolean
  export: boolean
  activeLimit: number
}

export function automationCapabilities(ctx: AutomationContext): AutomationCapabilities {
  const perms = permissionsFor(ctx)
  const has = (p: Permission) => perms.includes(p)
  return {
    view: has(PERMISSIONS.AUTOMATIONS_VIEW),
    create: has(PERMISSIONS.AUTOMATIONS_CREATE),
    edit: has(PERMISSIONS.AUTOMATIONS_EDIT),
    activate: has(PERMISSIONS.AUTOMATIONS_ACTIVATE),
    remove: has(PERMISSIONS.AUTOMATIONS_DELETE),
    runManually: has(PERMISSIONS.AUTOMATIONS_RUN_MANUALLY),
    viewLogs: has(PERMISSIONS.AUTOMATIONS_VIEW_LOGS),
    manageWebhooks: has(PERMISSIONS.AUTOMATIONS_MANAGE_WEBHOOKS),
    export: has(PERMISSIONS.AUTOMATIONS_EXPORT),
    activeLimit: activeAutomationLimit(ctx.plan),
  }
}
