// Single source of truth for the Campaign Manager side/bottom navigation.
//
// Sidebar.tsx (desktop) and MobileNav.tsx (mobile "More" sheet) both render
// from this one config so they cannot drift the way they previously did —
// each nav item's route logic, icon and visibility lived in two separate
// hand-maintained copies that disagreed on which sections a workspace type
// could reach and which route a section actually pointed to.
import {
  Home, Calendar, Megaphone, Wand2, Video, Inbox, BarChart2, Settings,
  Radio, Link2, Gift, Store, Target, BadgeDollarSign, Workflow, Users,
  Globe2, Mail, FileSearch, LibraryBig, type LucideIcon,
} from 'lucide-react'

export type NavItemId =
  | 'home' | 'strategy' | 'campaigns' | 'calendar' | 'studio' | 'brand' | 'links'
  | 'social' | 'advertising' | 'messaging' | 'web' | 'seo' | 'creators' | 'marketplace'
  | 'partnerships' | 'reputation' | 'community' | 'events' | 'inbox' | 'audiences'
  | 'analytics' | 'automations' | 'settings'

export interface NavItem {
  id: NavItemId
  label: string
  icon: LucideIcon
  /** Resolves the real route for this item. `typedBase` is the workspace-type
   *  route segment (e.g. "creator"), or null when it isn't known yet. */
  href: (typedBase: string | null) => string
}

export interface NavGroup {
  label: string | null
  items: NavItem[]
}

const app = (path: string) => `/app${path}`
/** Sections whose only real, DB-backed implementation lives on the
 *  type-first surface (e.g. /creator/events) rather than the /app/* shell. */
const typed = (segment: string, fallback: string) => (typedBase: string | null) =>
  typedBase ? `/${typedBase}/${segment}` : fallback

export const NAV_GROUPS: NavGroup[] = [
  { label: null, items: [
    { id: 'home', label: 'Home', icon: Home, href: () => app('/home') },
  ] },
  { label: 'Plan', items: [
    { id: 'strategy', label: 'Strategy', icon: Target, href: () => app('/strategy') },
    { id: 'campaigns', label: 'Campaigns', icon: Megaphone, href: () => app('/campaigns') },
    { id: 'calendar', label: 'Calendar', icon: Calendar, href: () => app('/calendar') },
  ] },
  { label: 'Create', items: [
    { id: 'studio', label: 'Studio', icon: Wand2, href: () => app('/studio') },
    // No standalone brand route exists yet on either surface — brand kits and
    // governed assets live inside Studio until Section 5.06 is built out.
    { id: 'brand', label: 'Brand & Assets', icon: LibraryBig, href: () => app('/studio/brands') },
    { id: 'links', label: 'Link in Bio', icon: Link2, href: () => app('/links') },
  ] },
  { label: 'Promote', items: [
    { id: 'social', label: 'Social', icon: Radio, href: () => app('/social') },
    { id: 'advertising', label: 'Advertising', icon: BadgeDollarSign, href: typed('advertising', app('/advertising')) },
    { id: 'messaging', label: 'Messaging', icon: Mail, href: () => app('/messaging') },
    { id: 'web', label: 'Web & Conversion', icon: Globe2, href: () => app('/web') },
    { id: 'seo', label: 'SEO & Discovery', icon: FileSearch, href: () => app('/seo') },
  ] },
  { label: 'Collaborate', items: [
    { id: 'creators', label: 'Creators & UGC', icon: Video, href: () => app('/creators') },
    { id: 'marketplace', label: 'Marketplace', icon: Store, href: () => app('/marketplace') },
    { id: 'partnerships', label: 'Partnerships', icon: Gift, href: () => app('/partnerships') },
    { id: 'reputation', label: 'PR & Reputation', icon: Radio, href: () => app('/reputation') },
    { id: 'community', label: 'Community', icon: Users, href: () => app('/community') },
    { id: 'events', label: 'Events', icon: Calendar, href: typed('events', app('/events')) },
  ] },
  { label: 'Engage', items: [
    { id: 'inbox', label: 'Inbox', icon: Inbox, href: () => app('/inbox') },
    // No standalone audience CRM route exists yet — audience profiles live
    // inside Strategy until Section 5.20 is built out.
    { id: 'audiences', label: 'Leads & Audiences', icon: Users, href: () => app('/strategy/audiences') },
  ] },
  { label: 'Measure', items: [
    { id: 'analytics', label: 'Analytics', icon: BarChart2, href: () => app('/analytics') },
    // Finance (5.22) has no implementation on any surface yet — omitted
    // entirely rather than shown as a dead link. Re-add once it's built.
  ] },
  { label: 'Operate', items: [
    { id: 'automations', label: 'Automations', icon: Workflow, href: () => app('/automations') },
  ] },
  { label: 'Manage', items: [
    { id: 'settings', label: 'Settings', icon: Settings, href: () => app('/settings') },
  ] },
]

/** Every id that appears in NAV_GROUPS, flattened, for allowlist validation. */
export const ALL_NAV_IDS: NavItemId[] = NAV_GROUPS.flatMap(group => group.items.map(item => item.id))

/**
 * Canonical per-workspace-type visibility. An empty array means "no
 * restriction — show everything" (used by brand/agency, which get the full
 * module set). Desktop and mobile both filter against this same list so a
 * workspace type can never see a different section set depending on device.
 */
export const WORKSPACE_NAV_ALLOWLIST: Record<string, NavItemId[]> = {
  creator: ['home', 'campaigns', 'calendar', 'studio', 'links', 'social', 'marketplace', 'partnerships', 'inbox', 'analytics', 'settings'],
  small_business: ['home', 'strategy', 'campaigns', 'calendar', 'studio', 'brand', 'links', 'social', 'messaging', 'web', 'marketplace', 'partnerships', 'creators', 'inbox', 'audiences', 'analytics', 'settings'],
  brand: [],
  agency: [],
}

export function visibleNavGroups(workspaceType: string | null | undefined): NavGroup[] {
  const allowlist = workspaceType ? WORKSPACE_NAV_ALLOWLIST[workspaceType] : undefined
  return NAV_GROUPS
    .map(group => ({ ...group, items: allowlist?.length ? group.items.filter(item => allowlist.includes(item.id)) : group.items }))
    .filter(group => group.items.length > 0)
}
