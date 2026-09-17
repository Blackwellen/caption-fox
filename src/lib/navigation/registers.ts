// The canonical persistent side-navigation registers — one per shell context.
//
// These contain SECTION LANDING AREAS ONLY. Local sub-tabs (Campaigns → Board,
// Studio → Compose, …), record detail pages and wizards never appear here; they
// belong to each module's own local navigation. Changing a register changes
// the product IA, so it is covered by resolver.test.ts.

import type { NavGroupDef, NavItemDef } from './types'

const M = {
  home: { id: 'home', label: 'Home', icon: 'home', segment: 'home' },
  strategy: { id: 'strategy', label: 'Strategy', icon: 'strategy', segment: 'strategy' },
  campaigns: { id: 'campaigns', label: 'Campaigns', icon: 'campaigns', segment: 'campaigns' },
  calendar: { id: 'calendar', label: 'Calendar', icon: 'calendar', segment: 'calendar' },
  studio: { id: 'studio', label: 'Studio', icon: 'studio', segment: 'studio' },
  brand: { id: 'brand', label: 'Brand & Assets', icon: 'brand', segment: 'brand' },
  links: { id: 'links', label: 'Link in Bio', icon: 'links', segment: 'links' },
  sharedTemplates: { id: 'shared-templates', label: 'Shared Templates', icon: 'templates', segment: 'shared-templates' },
  social: { id: 'social', label: 'Social', icon: 'social', segment: 'social' },
  advertising: { id: 'advertising', label: 'Advertising', icon: 'advertising', segment: 'advertising' },
  messaging: { id: 'messaging', label: 'Messaging', icon: 'messaging', segment: 'messaging' },
  web: { id: 'web', label: 'Web & Conversion', icon: 'web', segment: 'web' },
  seo: { id: 'seo', label: 'SEO & Discovery', icon: 'seo', segment: 'seo' },
  creators: { id: 'creators', label: 'Creators & UGC', icon: 'creators', segment: 'creators' },
  marketplace: { id: 'marketplace', label: 'Marketplace', icon: 'marketplace', segment: 'marketplace' },
  partnerships: { id: 'partnerships', label: 'Partnerships', icon: 'partnerships', segment: 'partnerships' },
  reputation: { id: 'reputation', label: 'PR & Reputation', icon: 'reputation', segment: 'reputation' },
  community: { id: 'community', label: 'Community', icon: 'community', segment: 'community' },
  events: { id: 'events', label: 'Events', icon: 'events', segment: 'events' },
  inbox: { id: 'inbox', label: 'Inbox', icon: 'inbox', segment: 'inbox' },
  audiences: { id: 'audiences', label: 'Leads & Audiences', icon: 'audiences', segment: 'audiences' },
  clientApprovals: { id: 'client-approvals', label: 'Client Approvals', icon: 'approvals', segment: 'client-approvals' },
  analytics: { id: 'analytics', label: 'Analytics', icon: 'analytics', segment: 'analytics' },
  finance: { id: 'finance', label: 'Finance', icon: 'finance', segment: 'finance' },
  clientReports: { id: 'client-reports', label: 'Client Reports', icon: 'reports', segment: 'client-reports' },
  automations: { id: 'automations', label: 'Automations', icon: 'automations', segment: 'automations' },
  operations: { id: 'operations', label: 'Agency Operations', icon: 'operations', segment: 'operations' },
  clients: { id: 'clients', label: 'Clients', icon: 'clients', segment: 'clients' },
  settings: { id: 'settings', label: 'Settings', icon: 'settings', segment: 'settings' },
} satisfies Record<string, NavItemDef>

const gated = (item: NavItemDef, gate: NonNullable<NavItemDef['gate']>): NavItemDef => ({ ...item, gate })

const HOME_GROUP: NavGroupDef = { id: 'home', label: null, items: [M.home] }
const MANAGE_GROUP: NavGroupDef = { id: 'manage', label: 'Manage', items: [M.settings] }

export const CREATOR_NAV: NavGroupDef[] = [
  HOME_GROUP,
  { id: 'create-publish', label: 'Create & Publish', items: [M.campaigns, M.calendar, M.studio, M.links, M.social] },
  { id: 'opportunities', label: 'Opportunities', items: [M.marketplace] },
  { id: 'engage', label: 'Engage', items: [M.inbox] },
  { id: 'measure', label: 'Measure', items: [M.analytics] },
  MANAGE_GROUP,
]

export const BUSINESS_NAV: NavGroupDef[] = [
  HOME_GROUP,
  { id: 'plan', label: 'Plan', items: [M.strategy, M.campaigns, M.calendar] },
  { id: 'create', label: 'Create', items: [M.studio, M.brand, M.links] },
  { id: 'channels', label: 'Channels', items: [M.social, gated(M.advertising, 'advertising'), M.messaging, M.web, gated(M.seo, 'seo')] },
  { id: 'grow', label: 'Grow', items: [gated(M.creators, 'creators'), M.marketplace, gated(M.partnerships, 'partnerships'), gated(M.events, 'events')] },
  { id: 'engage', label: 'Engage', items: [M.inbox, M.audiences] },
  { id: 'measure', label: 'Measure', items: [M.analytics, gated(M.finance, 'finance')] },
  { id: 'automate', label: 'Automate', items: [gated(M.automations, 'automations')] },
  MANAGE_GROUP,
]

export const BRAND_NAV: NavGroupDef[] = [
  HOME_GROUP,
  { id: 'plan', label: 'Plan', items: [M.strategy, M.campaigns, M.calendar] },
  { id: 'create', label: 'Create', items: [M.studio, M.brand, M.links] },
  { id: 'channels', label: 'Channels', items: [M.social, M.advertising, M.messaging, M.web, M.seo] },
  { id: 'people-growth', label: 'People & Growth', items: [M.creators, M.marketplace, M.partnerships, M.reputation, M.community, M.events] },
  { id: 'engage', label: 'Engage', items: [M.inbox, M.audiences] },
  { id: 'measure-control', label: 'Measure & Control', items: [M.analytics, M.finance] },
  { id: 'automate', label: 'Automate', items: [M.automations] },
  MANAGE_GROUP,
]

export const AGENCY_NAV: NavGroupDef[] = [
  HOME_GROUP,
  { id: 'client-management', label: 'Client Management', items: [M.clients] },
  { id: 'plan', label: 'Plan', items: [M.strategy, M.campaigns, M.calendar] },
  { id: 'create', label: 'Create', items: [M.studio, M.brand, M.sharedTemplates] },
  { id: 'channels', label: 'Channels', items: [M.social, M.advertising, M.messaging, M.web, M.seo] },
  { id: 'people-growth', label: 'People & Growth', items: [M.creators, M.marketplace, M.partnerships, M.reputation, M.community, M.events] },
  { id: 'engage-approve', label: 'Engage & Approve', items: [M.inbox, M.audiences, M.clientApprovals] },
  { id: 'measure-commercial', label: 'Measure & Commercial', items: [M.analytics, M.finance, M.clientReports] },
  { id: 'operate', label: 'Operate', items: [M.automations, M.operations] },
  MANAGE_GROUP,
]

export const SUPPLIER_NAV: NavGroupDef[] = [
  { id: 'home', label: null, items: [{ id: 'dashboard', label: 'Dashboard', icon: 'dashboard', segment: '', exact: true }] },
  { id: 'profile-sell', label: 'Profile & Sell', items: [
    { id: 'profile', label: 'Shopfront & Profile', icon: 'profile', segment: 'profile' },
    { id: 'listings', label: 'Listings & Packages', icon: 'listings', segment: 'listings' },
  ] },
  { id: 'opportunities', label: 'Opportunities', items: [
    { id: 'requests', label: 'Requests & Opportunities', icon: 'requests', segment: 'requests' },
    { id: 'quotes', label: 'Quotes', icon: 'quotes', segment: 'quotes' },
  ] },
  { id: 'delivery', label: 'Delivery', items: [
    { id: 'orders', label: 'Orders', icon: 'orders', segment: 'orders' },
    { id: 'deliveries', label: 'Deliveries', icon: 'deliveries', segment: 'deliveries' },
    { id: 'messages', label: 'Messages', icon: 'messages', segment: 'messages' },
  ] },
  { id: 'operations', label: 'Operations', items: [
    { id: 'availability', label: 'Availability', icon: 'availability', segment: 'availability' },
    { id: 'reviews', label: 'Reviews & Reputation', icon: 'reviews', segment: 'reviews' },
    { id: 'disputes', label: 'Disputes', icon: 'disputes', segment: 'disputes' },
  ] },
  // The earnings module's real page is /supplier/payouts; both activate it.
  { id: 'finance', label: 'Finance', items: [
    { id: 'earnings', label: 'Earnings & Payouts', icon: 'earnings', segment: 'earnings', implementation: 'payouts', alsoMatch: ['payouts'] },
  ] },
  { id: 'measure', label: 'Measure', items: [{ id: 'analytics', label: 'Analytics', icon: 'analytics', segment: 'analytics' }] },
  { id: 'manage', label: 'Manage', items: [{ id: 'settings', label: 'Settings', icon: 'settings', segment: 'settings' }] },
]

export const ADMIN_NAV: NavGroupDef[] = [
  { id: 'overview', label: 'Overview', items: [{ id: 'dashboard', label: 'Dashboard', icon: 'dashboard', segment: '', exact: true }] },
  { id: 'tenants', label: 'Tenants', items: [
    { id: 'workspaces', label: 'Workspaces', icon: 'workspaces', segment: 'workspaces' },
    { id: 'users', label: 'Users', icon: 'users', segment: 'users' },
  ] },
  // The affiliate programme console is a marketplace/partner operation.
  { id: 'marketplace-billing', label: 'Marketplace & Billing', items: [
    { id: 'marketplace', label: 'Marketplace Operations', icon: 'marketplace', segment: 'marketplace', alsoMatch: ['affiliates'] },
    { id: 'billing', label: 'Plans & Billing', icon: 'billing', segment: 'billing' },
  ] },
  { id: 'platform-operations', label: 'Platform Operations', items: [
    { id: 'ai-safety', label: 'Content, AI & Safety', icon: 'safety', segment: 'ai-safety' },
    { id: 'connections', label: 'Connections & Webhooks', icon: 'connections', segment: 'connections' },
    { id: 'automations', label: 'Automation Operations', icon: 'automations', segment: 'automations' },
  ] },
  { id: 'support-compliance', label: 'Support & Compliance', items: [
    { id: 'support', label: 'Support & Disputes', icon: 'support', segment: 'support' },
    { id: 'compliance', label: 'Compliance & Data', icon: 'compliance', segment: 'compliance' },
  ] },
  { id: 'releases-insights', label: 'Releases & Insights', items: [
    { id: 'flags', label: 'Flags & Releases', icon: 'flags', segment: 'flags' },
    { id: 'platform-analytics', label: 'Platform Analytics', icon: 'analytics', segment: 'platform-analytics' },
  ] },
  { id: 'system', label: 'System', items: [{ id: 'audit', label: 'Audit & System', icon: 'audit', segment: 'audit' }] },
]

export const AFFILIATE_NAV: NavGroupDef[] = [
  { id: 'overview', label: 'Overview', items: [{ id: 'home', label: 'Home', icon: 'home', segment: '', exact: true }] },
  { id: 'programme', label: 'Programme', items: [
    { id: 'programme', label: 'Programme', icon: 'programme', segment: 'programme' },
    { id: 'links', label: 'Links & Codes', icon: 'links', segment: 'links' },
    { id: 'assets', label: 'Assets', icon: 'assets', segment: 'assets' },
  ] },
  { id: 'performance', label: 'Performance', items: [
    { id: 'conversions', label: 'Conversions', icon: 'conversions', segment: 'conversions' },
    { id: 'commissions', label: 'Commissions', icon: 'commissions', segment: 'commissions' },
  ] },
  { id: 'support', label: 'Support', items: [{ id: 'support', label: 'Support', icon: 'support', segment: 'support' }] },
  { id: 'account', label: 'Account', items: [{ id: 'profile', label: 'Profile', icon: 'profile', segment: 'profile' }] },
]

export const NAV_REGISTERS = {
  creator: CREATOR_NAV,
  business: BUSINESS_NAV,
  brand: BRAND_NAV,
  agency: AGENCY_NAV,
  supplier: SUPPLIER_NAV,
  admin: ADMIN_NAV,
  affiliate: AFFILIATE_NAV,
} as const
