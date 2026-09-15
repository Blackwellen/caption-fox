// Canonical Caption Fox shell navigation types.
//
// Everything the shell renders crosses the Server -> Client boundary as plain
// data, so icons are referenced by key and resolved to components client-side.

export type WorkspaceKind = 'creator' | 'business' | 'brand' | 'agency'
export type NavContextId = WorkspaceKind | 'supplier' | 'admin' | 'affiliate'

/** Modules that are optional (plan-gated) extensions of the Business workspace. */
export type BusinessGatedModule = 'advertising' | 'seo' | 'partnerships' | 'events' | 'finance' | 'automations'

export type NavIconKey =
  | 'home' | 'strategy' | 'campaigns' | 'calendar' | 'studio' | 'brand' | 'links' | 'templates'
  | 'social' | 'advertising' | 'messaging' | 'web' | 'seo' | 'creators' | 'marketplace'
  | 'partnerships' | 'reputation' | 'community' | 'events' | 'inbox' | 'audiences' | 'approvals'
  | 'analytics' | 'finance' | 'reports' | 'automations' | 'operations' | 'settings' | 'clients'
  | 'dashboard' | 'profile' | 'listings' | 'requests' | 'quotes' | 'orders' | 'deliveries'
  | 'messages' | 'availability' | 'reviews' | 'disputes' | 'earnings' | 'workspaces' | 'users'
  | 'billing' | 'safety' | 'connections' | 'support' | 'compliance' | 'flags' | 'audit'
  | 'programme' | 'assets' | 'conversions' | 'commissions' | 'content' | 'schedule' | 'invite'
  | 'help' | 'changelog' | 'status' | 'account' | 'admin' | 'return'

export interface NavItemDef {
  id: string
  label: string
  icon: NavIconKey
  /** Route segment relative to the context base; '' is the base itself. */
  segment: string
  /** Only the exact route activates this item (used for base-path dashboards). */
  exact?: boolean
  /** Business workspaces only show this item when the module is entitled. */
  gate?: BusinessGatedModule
  /** Real page when it lives somewhere other than the canonical segment (relative to base). */
  implementation?: string
  /** Extra relative segments whose descendants also activate this item. */
  alsoMatch?: string[]
}

export interface NavGroupDef {
  id: string
  label: string | null
  items: NavItemDef[]
}

export interface ResolvedNavItem {
  id: string
  label: string
  icon: NavIconKey
  /** Where the link goes: the real, working page. */
  href: string
  /** The canonical architecture route for this module. */
  route: string
  /** Path prefixes whose descendants activate this item. */
  match: string[]
  exact?: boolean
}

export interface ResolvedNavGroup {
  id: string
  label: string | null
  items: ResolvedNavItem[]
}

export interface ResolvedAction {
  id: string
  label: string
  icon: NavIconKey
  href: string
}

export type PrimaryAction =
  | { type: 'create'; label: string; items: ResolvedAction[] }
  | { type: 'copy-link'; label: string }

export interface ShellNavigation {
  context: NavContextId
  base: string
  homeHref: string
  groups: ResolvedNavGroup[]
  primaryAction: PrimaryAction | null
  searchPlaceholder: string
  accountMenu: ResolvedAction[]
  helpMenu: ResolvedAction[]
  profileHref: string
  signOutRedirect: string
}

/** Everything that decides which workspace modules a member can see. */
export interface NavEntitlementContext {
  workspaceType: WorkspaceKind
  /** Raw plan id from workspaces.plan (starter/creator_pro/team/brand/enterprise) or lib/plans ids. */
  plan: string | null | undefined
  planStatus: string | null | undefined
  role: string | null | undefined
  /** workspaces.settings.feature_flags */
  flags?: Record<string, boolean> | null
  isPlatformAdmin?: boolean
}
