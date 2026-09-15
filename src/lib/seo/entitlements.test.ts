import { describe, expect, it } from 'vitest'
import {
  availableSeoViews, canAccessSeoCapability, mergedSourceCapabilities, seoCapabilities,
  seoCapabilityBlocker, visibleSeoTabs, workspaceTypeHasSeo, type SeoContext,
} from './entitlements'

function ctx(overrides: Partial<SeoContext> = {}): SeoContext {
  return {
    workspaceId: 'ws-1',
    workspaceType: 'brand',
    plan: 'team',
    role: 'owner',
    ...overrides,
  }
}

describe('workspaceTypeHasSeo', () => {
  it('accepts the four eligible workspace types', () => {
    expect(workspaceTypeHasSeo('creator')).toBe(true)
    expect(workspaceTypeHasSeo('small_business')).toBe(true)
    expect(workspaceTypeHasSeo('brand')).toBe(true)
    expect(workspaceTypeHasSeo('agency')).toBe(true)
  })
  it('rejects portal and admin surfaces', () => {
    expect(workspaceTypeHasSeo('portal-client')).toBe(false)
    expect(workspaceTypeHasSeo(null)).toBe(false)
    expect(workspaceTypeHasSeo(undefined)).toBe(false)
  })
})

describe('canAccessSeoCapability — workspace type gating', () => {
  it('never renders Local or Backlinks for a creator workspace, regardless of plan or role', () => {
    const creatorCtx = ctx({ workspaceType: 'creator', plan: 'enterprise', role: 'owner' })
    expect(canAccessSeoCapability(creatorCtx, 'seo.local')).toBe(false)
    expect(canAccessSeoCapability(creatorCtx, 'seo.backlinks')).toBe(false)
  })
  it('grants a creator workspace the tabs it is entitled to on a sufficient plan', () => {
    const creatorCtx = ctx({ workspaceType: 'creator', plan: 'team', role: 'owner' })
    expect(canAccessSeoCapability(creatorCtx, 'seo.overview')).toBe(true)
    expect(canAccessSeoCapability(creatorCtx, 'seo.keywords')).toBe(true)
    expect(canAccessSeoCapability(creatorCtx, 'seo.briefs')).toBe(true)
    expect(canAccessSeoCapability(creatorCtx, 'seo.aiSearch')).toBe(true)
  })
})

describe('canAccessSeoCapability — plan gating', () => {
  it('blocks Local on the free plan even for a brand workspace owner', () => {
    expect(canAccessSeoCapability(ctx({ plan: 'free' }), 'seo.local')).toBe(false)
  })
  it('allows Local once the plan reaches team', () => {
    expect(canAccessSeoCapability(ctx({ plan: 'team' }), 'seo.local')).toBe(true)
  })
})

describe('canAccessSeoCapability — permission gating', () => {
  it('blocks a role with no SEO keyword permission', () => {
    expect(canAccessSeoCapability(ctx({ role: 'external_creator', permissions: [] }), 'seo.keywords')).toBe(false)
  })
  it('allows the owner role, which carries every permission', () => {
    expect(canAccessSeoCapability(ctx({ role: 'owner' }), 'seo.keywords')).toBe(true)
  })
})

describe('canAccessSeoCapability — workspace status', () => {
  it('blocks everything for a suspended workspace', () => {
    expect(canAccessSeoCapability(ctx({ workspaceStatus: 'suspended' }), 'seo.overview')).toBe(false)
  })
})

describe('canAccessSeoCapability — feature flags', () => {
  it('respects a workspace-wide seo flag disable', () => {
    expect(canAccessSeoCapability(ctx({ featureFlags: { seo: false } }), 'seo.overview')).toBe(false)
  })
  it('respects a tab-specific flag disable without affecting other tabs', () => {
    const flagCtx = ctx({ featureFlags: { 'seo.local': false } })
    expect(canAccessSeoCapability(flagCtx, 'seo.local')).toBe(false)
    expect(canAccessSeoCapability(flagCtx, 'seo.keywords')).toBe(true)
  })
})

describe('seoCapabilityBlocker', () => {
  it('reports the plan as the blocker when only plan is insufficient', () => {
    expect(seoCapabilityBlocker(ctx({ plan: 'free' }), 'seo.local')).toBe('plan')
  })
  it('reports workspace-type when the tab does not exist for that surface', () => {
    expect(seoCapabilityBlocker(ctx({ workspaceType: 'creator', plan: 'enterprise' }), 'seo.backlinks')).toBe('workspace-type')
  })
  it('reports permission when plan and workspace type both allow it', () => {
    expect(seoCapabilityBlocker(ctx({ role: 'external_creator', permissions: [] }), 'seo.local')).toBe('permission')
  })
  it('returns null when access is allowed', () => {
    expect(seoCapabilityBlocker(ctx(), 'seo.overview')).toBeNull()
  })
})

describe('visibleSeoTabs', () => {
  it('returns all seven tabs for a fully entitled brand workspace', () => {
    expect(visibleSeoTabs(ctx())).toEqual(['overview', 'keywords', 'briefs', 'rankings', 'local', 'ai-search', 'backlinks'])
  })
  it('omits gated tabs rather than listing them as disabled', () => {
    const tabs = visibleSeoTabs(ctx({ plan: 'free' }))
    expect(tabs).not.toContain('local')
    expect(tabs).not.toContain('backlinks')
    expect(tabs).toContain('overview')
  })
})

describe('availableSeoViews', () => {
  it('gates the clusters view behind creator_pro', () => {
    expect(availableSeoViews(ctx({ plan: 'free' }), ['table', 'clusters'])).toEqual(['table'])
    expect(availableSeoViews(ctx({ plan: 'creator_pro' }), ['table', 'clusters'])).toEqual(['table', 'clusters'])
  })
  it('gates the map view behind team', () => {
    expect(availableSeoViews(ctx({ plan: 'creator_pro' }), ['cards', 'map'])).toEqual(['cards'])
    expect(availableSeoViews(ctx({ plan: 'team' }), ['cards', 'map'])).toEqual(['cards', 'map'])
  })
  it('passes through views with no gate unchanged', () => {
    expect(availableSeoViews(ctx({ plan: 'free' }), ['table', 'cards'])).toEqual(['table', 'cards'])
  })
})

describe('mergedSourceCapabilities', () => {
  it('ignores capabilities from a disconnected source', () => {
    const merged = mergedSourceCapabilities([
      { status: 'connected', capabilities: { keywords: true } },
      { status: 'disconnected', capabilities: { backlinks: true } },
    ])
    expect(merged.keywords).toBe(true)
    expect(merged.backlinks).toBeUndefined()
  })
  it('unions capabilities across multiple connected sources', () => {
    const merged = mergedSourceCapabilities([
      { status: 'connected', capabilities: { keywords: true } },
      { status: 'connected', capabilities: { backlinks: true } },
    ])
    expect(merged.keywords).toBe(true)
    expect(merged.backlinks).toBe(true)
  })
})

describe('seoCapabilities', () => {
  it('reflects export permission per surface', () => {
    const caps = seoCapabilities(ctx({ role: 'external_creator', permissions: [] }))
    expect(caps.exportKeywords).toBe(false)
    expect(caps.exportBriefs).toBe(false)
  })
  it('grants the owner every action capability on a sufficient plan', () => {
    const caps = seoCapabilities(ctx())
    expect(caps.addKeywords).toBe(true)
    expect(caps.createBrief).toBe(true)
    expect(caps.addLocation).toBe(true)
    expect(caps.trackPrompts).toBe(true)
    expect(caps.createOutreachList).toBe(true)
  })
})
