import { describe, expect, it } from 'vitest'
import {
  businessModuleEntitled, findActiveNavItem, flatNavItems, getNavigationForContext,
  normalisePlan, workspaceKindFromType, workspaceImplementationHref,
} from './resolver'
import type { NavEntitlementContext, WorkspaceKind } from './types'
import { appPathModule } from './app-path'

const owner = (workspaceType: WorkspaceKind, plan: string, planStatus = 'active'): NavEntitlementContext => ({
  workspaceType, plan, planStatus, role: 'owner', flags: null,
})

const labels = (context: Parameters<typeof getNavigationForContext>[0]) =>
  flatNavItems(getNavigationForContext(context)).map(item => item.label)

describe('canonical persistent navigation registers', () => {
  it('Creator has exactly the 10 canonical modules', () => {
    expect(labels({ context: 'creator', entitlements: owner('creator', 'team') })).toEqual([
      'Home', 'Campaigns', 'Calendar', 'Studio', 'Link in Bio', 'Social', 'Marketplace', 'Inbox', 'Analytics', 'Settings',
    ])
  })

  it('Business has exactly the 15 core modules without entitlements', () => {
    expect(labels({ context: 'business', entitlements: owner('business', 'starter') })).toEqual([
      'Home', 'Strategy', 'Campaigns', 'Calendar', 'Studio', 'Brand & Assets', 'Link in Bio', 'Social',
      'Messaging', 'Web & Conversion', 'Marketplace', 'Inbox', 'Leads & Audiences', 'Analytics', 'Settings',
    ])
  })

  it('Brand has exactly 24 modules', () => {
    expect(labels({ context: 'brand', entitlements: owner('brand', 'brand') })).toEqual([
      'Home', 'Strategy', 'Campaigns', 'Calendar', 'Studio', 'Brand & Assets', 'Link in Bio', 'Social',
      'Advertising', 'Messaging', 'Web & Conversion', 'SEO & Discovery', 'Creators & UGC', 'Marketplace',
      'Partnerships', 'PR & Reputation', 'Community', 'Events', 'Inbox', 'Leads & Audiences', 'Analytics',
      'Finance', 'Automations', 'Settings',
    ])
  })

  it('Agency has exactly 28 modules', () => {
    const items = labels({ context: 'agency', entitlements: owner('agency', 'enterprise') })
    expect(items).toHaveLength(28)
    expect(items).toEqual([
      'Home', 'Clients', 'Strategy', 'Campaigns', 'Calendar', 'Studio', 'Brand & Assets', 'Shared Templates',
      'Social', 'Advertising', 'Messaging', 'Web & Conversion', 'SEO & Discovery', 'Creators & UGC',
      'Marketplace', 'Partnerships', 'PR & Reputation', 'Community', 'Events', 'Inbox', 'Leads & Audiences',
      'Client Approvals', 'Analytics', 'Finance', 'Client Reports', 'Automations', 'Agency Operations', 'Settings',
    ])
  })

  it('Supplier has exactly 14 pages', () => {
    expect(labels({ context: 'supplier' })).toEqual([
      'Dashboard', 'Shopfront & Profile', 'Listings & Packages', 'Requests & Opportunities', 'Quotes', 'Orders',
      'Deliveries', 'Messages', 'Availability', 'Reviews & Reputation', 'Disputes', 'Earnings & Payouts',
      'Analytics', 'Settings',
    ])
  })

  it('Admin has exactly 13 pages', () => {
    expect(labels({ context: 'admin' })).toEqual([
      'Dashboard', 'Workspaces', 'Users', 'Marketplace Operations', 'Plans & Billing', 'Content, AI & Safety',
      'Connections & Webhooks', 'Automation Operations', 'Support & Disputes', 'Compliance & Data',
      'Flags & Releases', 'Platform Analytics', 'Audit & System',
    ])
  })

  it('Affiliate portal has exactly 8 grant-scoped pages', () => {
    const nav = getNavigationForContext({ context: 'affiliate', grantId: 'g1' })
    expect(flatNavItems(nav).map(item => [item.label, item.route])).toEqual([
      ['Home', '/affiliate-portal/g1'],
      ['Programme', '/affiliate-portal/g1/programme'],
      ['Links & Codes', '/affiliate-portal/g1/links'],
      ['Assets', '/affiliate-portal/g1/assets'],
      ['Conversions', '/affiliate-portal/g1/conversions'],
      ['Commissions', '/affiliate-portal/g1/commissions'],
      ['Support', '/affiliate-portal/g1/support'],
      ['Profile', '/affiliate-portal/g1/profile'],
    ])
  })

  it('Affiliate navigation cannot be built without a grant', () => {
    expect(() => getNavigationForContext({ context: 'affiliate' })).toThrow()
  })

  it('never exposes workspace modules to the affiliate portal', () => {
    const ids = flatNavItems(getNavigationForContext({ context: 'affiliate', grantId: 'g1' })).map(item => item.id)
    for (const forbidden of ['campaigns', 'studio', 'social', 'analytics', 'settings', 'finance', 'marketplace']) {
      expect(ids).not.toContain(forbidden)
    }
  })
})

describe('canonical routes', () => {
  it('declares /{type}/{module} routes and links to working implementations', () => {
    const items = flatNavItems(getNavigationForContext({ context: 'brand', entitlements: owner('brand', 'brand') }))
    const byId = Object.fromEntries(items.map(item => [item.id, item]))
    expect(byId.campaigns.route).toBe('/brand/campaigns')
    expect(byId.campaigns.href).toBe('/brand/campaigns')
    expect(byId.calendar.href).toBe('/brand/calendar')
    expect(byId.advertising.href).toBe('/brand/advertising')
    expect(byId.social.href).toBe('/brand/social')
    expect(byId.events.href).toBe('/brand/events')
    expect(byId.strategy.href).toBe('/brand/strategy')
    expect(byId.audiences.href).toBe('/brand/audiences')
    expect(workspaceImplementationHref('brand', 'audiences')).toBe('/app/audiences')
  })

  it('never links a workspace module to another workspace type', () => {
    for (const kind of ['creator', 'business', 'brand', 'agency'] as const) {
      const items = flatNavItems(getNavigationForContext({ context: kind, entitlements: owner(kind, 'enterprise') }))
      for (const item of items) {
        expect(item.route.startsWith(`/${kind}/`)).toBe(true)
        expect(item.href).toBe(item.route)
      }
    }
  })

  it('uses the approved canonical destination for every Supplier, Admin and Affiliate entry', () => {
    for (const context of ['supplier', 'admin', 'affiliate'] as const) {
      for (const item of flatNavItems(getNavigationForContext({ context, grantId: 'g1' }))) {
        expect(item.href).toBe(item.route)
      }
    }
  })

  it('keeps compatibility routes correctly gated after canonical sidebar links are resolved', () => {
    expect(appPathModule('/app/audiences/contacts')).toBe('audiences')
    expect(appPathModule('/app/templates')).toBe('shared-templates')
    expect(appPathModule('/app/agency-operations')).toBe('operations')
    expect(appPathModule('/app/finance/invoices')).toBe('finance')
    expect(appPathModule('/app/affiliates')).toBeNull()
  })

  it('has an implementation mapping for every marketing-workspace menu entry', () => {
    for (const kind of ['creator', 'business', 'brand', 'agency'] as const) {
      const nav = getNavigationForContext({ context: kind, entitlements: owner(kind, 'enterprise') })
      expect(nav.homeHref).toBe(`/${kind}/home`)
      for (const item of flatNavItems(nav)) expect(workspaceImplementationHref(kind, item.id)).toBeTruthy()
    }
  })
})

describe('Business plan-gated extensions', () => {
  it('shows no extensions on the starter plan', () => {
    for (const gated of ['advertising', 'seo', 'partnerships', 'events', 'finance', 'automations', 'creators'] as const) {
      expect(businessModuleEntitled(gated, owner('business', 'starter'))).toBe(false)
    }
  })

  it('adds entitled extensions from the Team plan', () => {
    const items = labels({ context: 'business', entitlements: owner('business', 'team') })
    expect(items).toEqual(expect.arrayContaining(['SEO & Discovery', 'Partnerships', 'Events', 'Finance', 'Automations']))
  })

  it('keeps Creators & UGC in the approved Brand and Agency menus only', () => {
    const business = flatNavItems(getNavigationForContext({ context: 'business', entitlements: owner('business', 'team') }))
    expect(business.find(item => item.id === 'creators')).toBeUndefined()
    expect(labels({ context: 'brand', entitlements: owner('brand', 'enterprise') })).toContain('Creators & UGC')
    expect(labels({ context: 'agency', entitlements: owner('agency', 'enterprise') })).toContain('Creators & UGC')
    expect(labels({ context: 'creator', entitlements: owner('creator', 'enterprise') })).not.toContain('Creators & UGC')
  })

  it('keeps Advertising absent because its resolver does not grant Business', () => {
    expect(labels({ context: 'business', entitlements: owner('business', 'enterprise') })).not.toContain('Advertising')
  })

  it('hides every extension when the subscription is cancelled or paused', () => {
    expect(labels({ context: 'business', entitlements: owner('business', 'enterprise', 'cancelled') })).toHaveLength(15)
    expect(labels({ context: 'business', entitlements: owner('business', 'enterprise', 'paused') })).toHaveLength(15)
  })

  it('respects a workspace feature flag that switches a module off', () => {
    const ctx = { ...owner('business', 'team'), flags: { 'modules.finance': false } }
    expect(businessModuleEntitled('finance', ctx)).toBe(false)
  })

  it('does not add Business extensions to other workspace types', () => {
    expect(labels({ context: 'creator', entitlements: owner('creator', 'enterprise') })).toHaveLength(10)
  })
})

describe('active navigation resolution', () => {
  const brand = getNavigationForContext({ context: 'brand', entitlements: owner('brand', 'brand') })
  const agency = getNavigationForContext({ context: 'agency', entitlements: owner('agency', 'brand') })
  const supplier = getNavigationForContext({ context: 'supplier' })
  const admin = getNavigationForContext({ context: 'admin' })
  const affiliate = getNavigationForContext({ context: 'affiliate', grantId: 'xyz' })

  it.each([
    [brand, '/brand/campaigns/abc123/content', 'campaigns'],
    [brand, '/brand/strategy/audiences', 'strategy'],
    [brand, '/brand/audiences/contacts', 'audiences'],
    [brand, '/app/audiences/contacts', 'audiences'],
    [brand, '/brand/strategy/objectives', 'strategy'],
    [brand, '/brand/strategy/plans/abc123', 'strategy'],
    [brand, '/brand/calendar/agenda?view=week', 'calendar'],
    [brand, '/app/listening', 'social'],
    [brand, '/brand/social/engagement?view=flagged', 'social'],
    [agency, '/agency/social/posts/abc123', 'social'],
    [agency, '/agency/clients/123/reports', 'clients'],
    [supplier, '/supplier', 'dashboard'],
    [supplier, '/supplier/orders/ABC/deliveries/new', 'orders'],
    [supplier, '/supplier/payouts', 'earnings'],
    [admin, '/admin', 'dashboard'],
    [admin, '/admin/workspaces/123', 'workspaces'],
    [affiliate, '/affiliate-portal/xyz', 'home'],
    [affiliate, '/affiliate-portal/xyz/commissions/123', 'commissions'],
  ])('%#: %s activates the parent module', (nav, path, expected) => {
    expect(findActiveNavItem(nav.groups, path)).toBe(expected)
  })

  it('does not treat the base-path dashboard as the parent of every page', () => {
    expect(findActiveNavItem(supplier.groups, '/supplier/listings')).toBe('listings')
    expect(findActiveNavItem(admin.groups, '/admin/users')).toBe('users')
  })
})

describe('context actions', () => {
  it('only offers creation actions for modules present in the navigation', () => {
    const creator = getNavigationForContext({ context: 'creator', entitlements: owner('creator', 'team') })
    const ids = creator.primaryAction?.type === 'create' ? creator.primaryAction.items.map(item => item.id) : []
    expect(ids).toEqual(['campaign', 'content', 'schedule', 'link'])
  })

  it('hides invite for roles that cannot manage the workspace', () => {
    const nav = getNavigationForContext({ context: 'brand', entitlements: { ...owner('brand', 'brand'), role: 'creator' } })
    const ids = nav.primaryAction?.type === 'create' ? nav.primaryAction.items.map(item => item.id) : []
    expect(ids).not.toContain('invite')
  })

  it('gives Admin no fake create action and Affiliate a copy-link action', () => {
    expect(getNavigationForContext({ context: 'admin' }).primaryAction).toBeNull()
    expect(getNavigationForContext({ context: 'affiliate', grantId: 'g' }).primaryAction?.type).toBe('copy-link')
  })
})

describe('plan and type normalisation', () => {
  it('maps DB plan ids to lib/plans ids', () => {
    expect(normalisePlan('starter')).toBe('free')
    expect(normalisePlan('brand')).toBe('agency')
    expect(normalisePlan('team')).toBe('team')
    expect(normalisePlan('nonsense')).toBe('free')
  })

  it('maps DB workspace types to shell kinds, least-privilege by default', () => {
    expect(workspaceKindFromType('small_business')).toBe('business')
    expect(workspaceKindFromType('agency')).toBe('agency')
    expect(workspaceKindFromType(null)).toBe('creator')
  })
})
