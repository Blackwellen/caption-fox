// The one canonical navigation resolver for the Caption Fox shell.
//
// Layouts call getNavigationForContext() server-side and hand the result to
// the shell as plain data. Visibility here is NOT authorisation — routes still
// enforce membership, role, plan and grants — but Business plan-gated modules
// delegate to each module's own entitlement resolver so the sidebar and the
// route guard can never disagree (see requireWorkspaceModule in session.ts).

import { canAccessAdvertising } from '@/lib/advertising/entitlements'
import { canAccessSeoCapability } from '@/lib/seo/entitlements'
import { canAccessPartnershipModule } from '@/lib/partnerships/entitlements'
import { canAccessEventsCapability } from '@/lib/events/entitlements'
import { canAccessAutomationModule } from '@/lib/automations/entitlements'
import { canAccessCreatorModule } from '@/lib/creators/entitlements'
import { PLANS, type PlanId } from '@/lib/plans'
import { canManageWorkspace } from '@/lib/workspace-shared'
import { NAV_REGISTERS } from './registers'
import { findActiveNavItem } from './match'
import type {
  BusinessGatedModule, NavContextId, NavEntitlementContext, NavGroupDef, PrimaryAction,
  ResolvedAction, ResolvedNavGroup, ResolvedNavItem, ShellNavigation, WorkspaceKind,
} from './types'

export { findActiveNavItem }

export const WORKSPACE_KINDS: WorkspaceKind[] = ['creator', 'business', 'brand', 'agency']

/** workspaces.type (DB) -> shell workspace kind. */
const KIND_BY_DB_TYPE: Record<string, WorkspaceKind> = {
  creator: 'creator', small_business: 'business', business: 'business', brand: 'brand', agency: 'agency',
}

export function workspaceKindFromType(type: string | null | undefined): WorkspaceKind {
  // Unknown types get the smallest module set rather than the largest.
  return KIND_BY_DB_TYPE[type ?? ''] ?? 'creator'
}

export function isWorkspaceKind(value: string): value is WorkspaceKind {
  return (WORKSPACE_KINDS as string[]).includes(value)
}

/** workspaces.plan uses starter/brand; lib/plans uses free/agency. */
export function normalisePlan(plan: string | null | undefined): PlanId {
  if (plan === 'starter') return 'free'
  if (plan === 'brand') return 'agency'
  return plan && plan in PLANS ? (plan as PlanId) : 'free'
}

const PLAN_RANK: Record<PlanId, number> = { free: 0, creator_pro: 1, team: 2, agency: 3, enterprise: 4 }
/** Business extensions are included from the Team plan upwards. */
const BUSINESS_EXTENSION_MIN_RANK = PLAN_RANK.team

/**
 * Whether a Business workspace member gets a plan-gated module. The shared
 * plan/status/flag floor is applied first, then the module's own resolver has
 * the final say on workspace type, role and module-level flags.
 */
export function businessModuleEntitled(module: BusinessGatedModule, ctx: NavEntitlementContext): boolean {
  if (ctx.planStatus === 'cancelled' || ctx.planStatus === 'paused') return false
  const flags = ctx.flags ?? {}
  if (flags[module] === false || flags[`modules.${module}`] === false) return false
  const plan = normalisePlan(ctx.plan)
  if (PLAN_RANK[plan] < BUSINESS_EXTENSION_MIN_RANK) return false
  const role = ctx.role ?? ''

  switch (module) {
    case 'advertising':
      return canAccessAdvertising({ workspaceType: 'business', plan, planStatus: ctx.planStatus, role, flags }).allowed
    case 'seo':
      return canAccessSeoCapability(
        { workspaceId: '', workspaceType: 'small_business', plan, role, featureFlags: flags, isPlatformAdmin: ctx.isPlatformAdmin },
        'seo.overview',
      )
    case 'partnerships':
      return canAccessPartnershipModule(
        { workspaceId: '', workspaceType: 'small_business', plan: ctx.plan, planStatus: ctx.planStatus, role, isPlatformAdmin: ctx.isPlatformAdmin },
        'overview',
      ).allowed
    case 'events':
      return canAccessEventsCapability({ surface: 'business', plan, role, featureFlags: flags }, 'events.overview')
    case 'automations':
      return canAccessAutomationModule(
        { workspaceId: '', plan: ctx.plan, planStatus: ctx.planStatus, role, isPlatformAdmin: ctx.isPlatformAdmin },
        'overview',
      ).allowed
    case 'creators':
      return canAccessCreatorModule(
        { workspaceId: '', workspaceType: 'small_business', plan: ctx.plan, planStatus: ctx.planStatus, role, isPlatformAdmin: ctx.isPlatformAdmin },
        'overview',
      ).allowed
    case 'finance':
      // Finance has no module resolver yet; the plan/status/flag floor applies.
      return true
  }
}

/**
 * Where each workspace module's real page lives today. Modules with a
 * type-first implementation route there; everything else is served by the
 * /app compatibility surface. The canonical /{type}/{module} URL redirects to
 * the same place (see app/[workspaceType]/[[...path]]/page.tsx).
 */
const app = (path: string) => () => `/app/${path}`
const typed = (path: string) => (kind: WorkspaceKind) => `/${kind}/${path}`

const WORKSPACE_IMPLEMENTATION: Record<string, (kind: WorkspaceKind) => string> = {
  home: app('home'),
  strategy: typed('strategy'),
  campaigns: typed('campaigns'),
  calendar: typed('calendar'),
  studio: typed('studio'),
  brand: typed('brand'),
  links: typed('links'),
  'shared-templates': app('templates'),
  social: typed('social'),
  advertising: typed('advertising'),
  messaging: app('messaging'),
  web: app('web'),
  seo: app('seo'),
  creators: typed('creators'),
  marketplace: app('marketplace'),
  partnerships: app('partnerships'),
  reputation: app('reputation'),
  community: app('community'),
  events: typed('events'),
  inbox: typed('inbox'),
  audiences: typed('strategy/audiences'),
  'client-approvals': app('client-approvals'),
  analytics: app('analytics'),
  finance: app('finance'),
  'client-reports': app('client-reports'),
  automations: app('automations'),
  operations: app('agency-operations'),
  clients: app('clients'),
  settings: app('settings'),
}

/** Compatibility routes that belong to a module's local navigation. */
const WORKSPACE_ALSO_MATCH: Record<string, string[]> = {
  social: ['/app/listening'],
  creators: ['/app/ugc'],
  partnerships: ['/app/affiliates'],
}

export function workspaceImplementationHref(kind: WorkspaceKind, moduleId: string): string | null {
  return WORKSPACE_IMPLEMENTATION[moduleId]?.(kind) ?? null
}

function join(base: string, segment: string) {
  return segment ? `${base}/${segment}` : base
}

function resolveGroups(
  groups: NavGroupDef[],
  base: string,
  hrefFor: (itemId: string, segment: string, implementation?: string) => string,
  extraMatch: (itemId: string) => string[],
  include: (gate: BusinessGatedModule | undefined) => boolean,
): ResolvedNavGroup[] {
  return groups
    .map(group => ({
      id: group.id,
      label: group.label,
      items: group.items.filter(item => include(item.gate)).map((item): ResolvedNavItem => {
        const route = join(base, item.segment)
        const href = hrefFor(item.id, item.segment, item.implementation)
        const match = [...new Set([route, href, ...(item.alsoMatch ?? []).map(segment => join(base, segment)), ...extraMatch(item.id)])]
        return { id: item.id, label: item.label, icon: item.icon, href, route, match, ...(item.exact ? { exact: true } : {}) }
      }),
    }))
    .filter(group => group.items.length > 0)
}

const HELP_MENU: ResolvedAction[] = [
  { id: 'help-centre', label: 'Help Centre', icon: 'help', href: '/help' },
  { id: 'whats-new', label: "What's new", icon: 'changelog', href: '/changelog' },
  { id: 'contact-support', label: 'Contact support', icon: 'support', href: '/contact' },
  { id: 'system-status', label: 'System status', icon: 'status', href: '/status' },
]

interface WorkspaceCreateDef { id: string; label: string; icon: ResolvedAction['icon']; requires: string; href: (kind: WorkspaceKind) => string }

const WORKSPACE_CREATE: Record<string, WorkspaceCreateDef> = {
  campaign: { id: 'campaign', label: 'New campaign', icon: 'campaigns', requires: 'campaigns', href: kind => `/${kind}/campaigns?action=new` },
  content: { id: 'content', label: 'Create content', icon: 'content', requires: 'studio', href: kind => `/${kind}/studio/compose` },
  schedule: { id: 'schedule', label: 'Schedule post', icon: 'schedule', requires: 'calendar', href: kind => `/${kind}/calendar?new=1` },
  link: { id: 'link', label: 'Link in Bio page', icon: 'links', requires: 'links', href: kind => `/${kind}/links/new` },
  message: { id: 'message', label: 'New message', icon: 'messaging', requires: 'messaging', href: () => '/app/messaging' },
  page: { id: 'page', label: 'Landing page or form', icon: 'web', requires: 'web', href: () => '/app/web' },
  brief: { id: 'brief', label: 'UGC brief', icon: 'creators', requires: 'creators', href: kind => `/${kind}/creators/briefs?action=new` },
  report: { id: 'report', label: 'Report', icon: 'reports', requires: 'analytics', href: () => '/app/analytics?action=report' },
  invite: { id: 'invite', label: 'Invite team member', icon: 'invite', requires: 'settings', href: () => '/app/settings?tab=team&action=invite' },
}

const CREATE_SET: Record<WorkspaceKind, string[]> = {
  creator: ['campaign', 'content', 'schedule', 'link'],
  business: ['campaign', 'content', 'schedule', 'message', 'page', 'link', 'invite'],
  brand: ['campaign', 'content', 'schedule', 'brief', 'message', 'page', 'report', 'invite'],
  agency: ['campaign', 'content', 'schedule', 'brief', 'report', 'invite'],
}

export interface NavigationInput {
  context: NavContextId
  /** Required for workspace contexts. */
  entitlements?: NavEntitlementContext
  /** Required for the affiliate portal. */
  grantId?: string
  /** Platform administrators see the admin entry in their account menu. */
  isPlatformAdmin?: boolean
  /** Supplier users that also belong to marketer workspaces. */
  hasWorkspaces?: boolean
}

export function getNavigationForContext(input: NavigationInput): ShellNavigation {
  const { context } = input

  if (isWorkspaceKind(context)) {
    const kind = context
    const ctx = input.entitlements ?? { workspaceType: kind, plan: null, planStatus: null, role: null }
    const base = `/${kind}`
    const groups = resolveGroups(
      NAV_REGISTERS[kind],
      base,
      itemId => workspaceImplementationHref(kind, itemId) ?? `${base}/${itemId}`,
      itemId => WORKSPACE_ALSO_MATCH[itemId] ?? [],
      gate => !gate || kind !== 'business' || businessModuleEntitled(gate, ctx),
    )
    const present = new Set(groups.flatMap(group => group.items.map(item => item.id)))
    const createItems = CREATE_SET[kind]
      .map(id => WORKSPACE_CREATE[id])
      .filter(def => present.has(def.requires) && (def.id !== 'invite' || canManageWorkspace(ctx.role)))
      .map(def => ({ id: def.id, label: def.label, icon: def.icon, href: def.href(kind) }))

    const accountMenu: ResolvedAction[] = [
      { id: 'account', label: 'Account settings', icon: 'account', href: '/app/settings?tab=account' },
      ...(canManageWorkspace(ctx.role) ? [{ id: 'workspace-settings', label: 'Workspace settings', icon: 'settings' as const, href: '/app/settings' }] : []),
      ...(input.isPlatformAdmin ? [{ id: 'admin', label: 'Platform admin', icon: 'admin' as const, href: '/admin' }] : []),
    ]

    return {
      context,
      base,
      homeHref: '/app/home',
      groups,
      primaryAction: createItems.length ? { type: 'create', label: 'Create', items: createItems } : null,
      searchPlaceholder: 'Search campaigns, content, people or anything…',
      accountMenu,
      helpMenu: HELP_MENU,
      profileHref: '/app/settings?tab=account',
      signOutRedirect: '/login',
    }
  }

  if (context === 'supplier') {
    const base = '/supplier'
    const groups = resolveGroups(NAV_REGISTERS.supplier, base, (_, segment, implementation) => join(base, implementation ?? segment), () => [], () => true)
    const primaryAction: PrimaryAction = {
      type: 'create', label: 'Create', items: [
        { id: 'listing', label: 'New listing', icon: 'listings', href: '/supplier/listings?action=new' },
        { id: 'shopfront', label: 'Edit shopfront', icon: 'profile', href: '/supplier/profile' },
      ],
    }
    return {
      context, base, homeHref: base, groups, primaryAction,
      searchPlaceholder: 'Search listings, orders, requests or anything…',
      accountMenu: [
        { id: 'account', label: 'Account settings', icon: 'account', href: '/supplier/settings' },
        ...(input.hasWorkspaces ? [{ id: 'return', label: 'Go to marketing workspace', icon: 'return' as const, href: '/app/home' }] : []),
        ...(input.isPlatformAdmin ? [{ id: 'admin', label: 'Platform admin', icon: 'admin' as const, href: '/admin' }] : []),
      ],
      helpMenu: HELP_MENU,
      profileHref: '/supplier/profile',
      signOutRedirect: '/login',
    }
  }

  if (context === 'admin') {
    const base = '/admin'
    const groups = resolveGroups(NAV_REGISTERS.admin, base, (_, segment, implementation) => join(base, implementation ?? segment), () => [], () => true)
    return {
      context, base, homeHref: base, groups,
      // No admin route has a verified, legitimate create flow yet, so no primary
      // action is shown rather than a "+ Create" that goes nowhere.
      primaryAction: null,
      searchPlaceholder: 'Search users, workspaces, providers or anything…',
      accountMenu: [
        { id: 'return', label: 'Return to workspace', icon: 'return', href: '/app/home' },
        { id: 'account', label: 'Account settings', icon: 'account', href: '/app/settings?tab=account' },
      ],
      helpMenu: HELP_MENU,
      profileHref: '/app/settings?tab=account',
      signOutRedirect: '/admin-login',
    }
  }

  // Affiliate portal — grant scoped, never a workspace.
  if (!input.grantId) throw new Error('Affiliate navigation requires a validated grant id.')
  const base = `/affiliate-portal/${input.grantId}`
  const groups = resolveGroups(NAV_REGISTERS.affiliate, base, (_, segment, implementation) => join(base, implementation ?? segment), () => [], () => true)
  return {
    context, base, homeHref: base, groups,
    // Affiliates have one referral link; the only link action is copying it.
    primaryAction: { type: 'copy-link', label: 'Copy link' },
    searchPlaceholder: 'Search programme, links, assets or commissions…',
    accountMenu: [
      { id: 'profile', label: 'Affiliate profile', icon: 'profile', href: `${base}/profile` },
      { id: 'programme', label: 'Programme information', icon: 'programme', href: `${base}/programme` },
    ],
    helpMenu: HELP_MENU,
    profileHref: `${base}/profile`,
    signOutRedirect: '/affiliates/login',
  }
}

export function navigationHasItem(nav: ShellNavigation, itemId: string): boolean {
  return nav.groups.some(group => group.items.some(item => item.id === itemId))
}

export function flatNavItems(nav: ShellNavigation): ResolvedNavItem[] {
  return nav.groups.flatMap(group => group.items)
}
