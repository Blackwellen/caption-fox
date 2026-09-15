// Canonical Automations vocabulary. Mirrors src/lib/community/constants.ts —
// every label, badge tone and page-size constant used by the Automations
// surfaces resolves from here.

import type { BadgeVariant } from '@/components/ui/Badge'

export const AUTOMATION_MODULES = ['overview', 'logs'] as const
export type AutomationModule = typeof AUTOMATION_MODULES[number]

export const AUTOMATION_BASE = '/app/automations'

export const AUTOMATION_MODULE_META: Record<AutomationModule, {
  label: string; href: string; title: string; description: string; breadcrumb: string
}> = {
  overview: {
    label: 'Automations', href: AUTOMATION_BASE, title: 'Automations',
    description: 'Automate community, moderation, events and advocacy workflows with review-first recipes.',
    breadcrumb: 'Overview',
  },
  logs: {
    label: 'Run history', href: `${AUTOMATION_BASE}/logs`, title: 'Automation run history',
    description: 'Every automation run, its actions, and the outcome — searchable and exportable.',
    breadcrumb: 'Run history',
  },
}

export const AUTOMATION_STATUSES = ['draft', 'active', 'paused', 'archived'] as const
export type AutomationStatus = typeof AUTOMATION_STATUSES[number]
export const AUTOMATION_STATUS_LABELS: Record<AutomationStatus, string> = {
  draft: 'Draft', active: 'Active', paused: 'Paused', archived: 'Archived',
}
export const AUTOMATION_STATUS_BADGE: Record<AutomationStatus, BadgeVariant> = {
  draft: 'slate', active: 'green', paused: 'amber', archived: 'slate',
}

/** Automations may only run when active; every other status is inert. */
export const AUTOMATION_TRANSITIONS: Record<AutomationStatus, AutomationStatus[]> = {
  draft: ['draft', 'active', 'archived'],
  active: ['active', 'paused', 'archived'],
  paused: ['paused', 'active', 'archived'],
  archived: ['archived'],
}
export function canTransitionAutomation(from: string, to: string): boolean {
  const allowed = AUTOMATION_TRANSITIONS[from as AutomationStatus]
  return allowed ? allowed.includes(to as AutomationStatus) : false
}

export const RUN_STATUSES = ['running', 'success', 'failed', 'skipped'] as const
export type RunStatus = typeof RUN_STATUSES[number]
export const RUN_STATUS_LABELS: Record<RunStatus, string> = {
  running: 'Running', success: 'Success', failed: 'Failed', skipped: 'Skipped',
}
export const RUN_STATUS_BADGE: Record<RunStatus, BadgeVariant> = {
  running: 'blue', success: 'green', failed: 'red', skipped: 'slate',
}

export const TRIGGER_SOURCES = ['event', 'schedule', 'manual', 'test'] as const
export const TRIGGER_SOURCE_LABELS: Record<string, string> = {
  event: 'Event', schedule: 'Schedule', manual: 'Manual run', test: 'Test run',
}

export const RISK_LEVELS = ['low', 'medium', 'high'] as const
export const RISK_LEVEL_BADGE: Record<string, BadgeVariant> = {
  low: 'green', medium: 'amber', high: 'red',
}

export const TEMPLATE_CATEGORIES = ['members', 'moderation', 'calendar', 'advocacy', 'admin'] as const
export const TEMPLATE_CATEGORY_LABELS: Record<string, string> = {
  members: 'Members', moderation: 'Moderation', calendar: 'Calendar', advocacy: 'Advocacy', admin: 'Admin',
}

export const AUTOMATION_SORTS = [
  { id: 'recent', label: 'Recently updated' },
  { id: 'name_asc', label: 'Name (A–Z)' },
  { id: 'runs_desc', label: 'Most runs' },
] as const
export type AutomationSort = typeof AUTOMATION_SORTS[number]['id']

export const PAGE_SIZES = [10, 25, 50, 100] as const
export const DEFAULT_PAGE_SIZE = 10
export const TREND_WINDOW_DAYS = 30
