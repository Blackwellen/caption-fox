import { describe, expect, it } from 'vitest'
import {
  buildHref, chipsFor, MAX_PAGE_SIZE, parseAssetFilters, parseKitFilters, parseProductFilters, parseRightsFilters,
} from './filters'
import {
  canAccessBrandCapability, can, isModuleAvailable, visibleModules, type BrandEntitlementContext,
} from './entitlements'
import { csvCell, csvRow } from './csv'
import { formatBytes, formatDaysLeft, formatUkDate, humanise } from '@/components/brand-assets/tokens'

const brandOwner: BrandEntitlementContext = { workspaceType: 'brand', plan: 'team', planStatus: 'active', role: 'owner' }

describe('URL state parsing', () => {
  it('uses reference page densities per module', () => {
    expect(parseAssetFilters({}).pageSize).toBe(10)
    expect(parseRightsFilters({}).pageSize).toBe(6)
    expect(parseProductFilters({}).pageSize).toBe(6)
    expect(parseKitFilters({}).pageSize).toBe(25)
  })

  it('caps page size so a crafted URL cannot request an unbounded scan', () => {
    expect(parseAssetFilters({ pageSize: '99999' }).pageSize).toBe(MAX_PAGE_SIZE)
    expect(parseAssetFilters({ page: '-4' }).page).toBe(1)
  })

  it('falls back to the default view for unknown values', () => {
    expect(parseAssetFilters({ view: 'map' }).view).toBe('grid')
    expect(parseRightsFilters({ view: 'calendar' }).view).toBe('calendar')
    expect(parseProductFilters({ view: 'gantt' }).view).toBe('cards')
  })

  it('turns a Date Added preset into a lower bound and ignores unknown presets', () => {
    const f = parseAssetFilters({ added: '30' })
    const days = (Date.now() - new Date(f.addedFrom!).getTime()) / 86_400_000
    expect(Math.round(days)).toBe(30)
    expect(parseAssetFilters({ added: '9999' }).addedFrom).toBeNull()
  })

  it('reads the selected kit for the brand system panels', () => {
    expect(parseKitFilters({ kit: 'abc' }).kitId).toBe('abc')
  })
})

describe('buildHref', () => {
  it('resets to page 1 when a filter changes', () => {
    expect(buildHref('/brand/brand/assets', { page: '3', type: 'pdf' }, { status: 'approved' }))
      .toBe('/brand/brand/assets?type=pdf&status=approved')
  })

  it('keeps the page when only the page changes', () => {
    expect(buildHref('/x', { q: 'serum' }, { page: 2 })).toBe('/x?q=serum&page=2')
  })

  it('removes a key when patched to null or empty', () => {
    expect(buildHref('/x', { q: 'a', type: 'pdf' }, { type: null })).toBe('/x?q=a')
    expect(buildHref('/x', { q: 'a' }, { q: '' })).toBe('/x')
  })

  it('builds chips only for applied filters', () => {
    expect(chipsFor({ q: 'x', status: null, tags: [] }, { q: 'Search', status: 'Status', tags: 'Tags' }))
      .toEqual([{ key: 'q', label: 'Search', value: 'x' }])
  })
})

describe('entitlements', () => {
  it('gives creator workspaces a simplified module set', () => {
    expect(visibleModules({ ...brandOwner, workspaceType: 'creator' })).toEqual(['overview', 'kits'])
    expect(isModuleAvailable({ ...brandOwner, workspaceType: 'creator' }, 'rights').allowed).toBe(false)
  })

  it('requires the Team plan for Rights and Product Library', () => {
    const free = { ...brandOwner, plan: 'free' }
    const decision = isModuleAvailable(free, 'rights')
    expect(decision.allowed).toBe(false)
    expect(decision.reason).toBe('plan')
    expect(isModuleAvailable(free, 'kits').allowed).toBe(true)
  })

  it('lets a feature flag switch a module off independently of plan', () => {
    const flagged = { ...brandOwner, flags: { brand_rights: false } }
    expect(isModuleAvailable(flagged, 'rights').reason).toBe('feature_flag')
    expect(isModuleAvailable(flagged, 'products').allowed).toBe(true)
  })

  it('enforces the role matrix', () => {
    const viewer = { ...brandOwner, role: 'viewer' }
    expect(can(viewer, 'brand.assets.view')).toBe(true)
    expect(can(viewer, 'brand.assets.upload')).toBe(false)
    expect(can({ ...brandOwner, role: 'member' }, 'brand.rights.create')).toBe(false)
    expect(can({ ...brandOwner, role: 'manager' }, 'brand.rights.create')).toBe(true)
    expect(can({ ...brandOwner, role: 'manager' }, 'brand.kits.approve')).toBe(false)
    expect(can({ ...brandOwner, role: 'ugc_creator' }, 'brand.rights.view')).toBe(false)
  })

  it('makes a past-due workspace read-only rather than locked out', () => {
    const pastDue = { ...brandOwner, planStatus: 'past_due' }
    expect(can(pastDue, 'brand.assets.view')).toBe(true)
    expect(canAccessBrandCapability(pastDue, 'brand.assets.upload').reason).toBe('workspace_status')
  })

  it('blocks uploads when the storage quota is exhausted', () => {
    const full = { ...brandOwner, storage: { bytesUsed: 100, bytesQuota: 100 } }
    expect(canAccessBrandCapability(full, 'brand.assets.upload').reason).toBe('storage_quota')
    expect(can(full, 'brand.assets.download')).toBe(true)
  })

  it('denies everything to a non-member', () => {
    expect(canAccessBrandCapability({ ...brandOwner, role: null }, 'brand.view').reason).toBe('not_a_member')
  })
})

describe('CSV export encoding', () => {
  it('neutralises formula injection in text but not in numbers', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`)
    expect(csvCell('+44 7700')).toBe(`'+44 7700`)
    expect(csvCell(-47)).toBe('-47')
  })

  it('quotes separators and escapes quotes', () => {
    expect(csvRow(['Marketing, Web', 'He said "hi"', null])).toBe(`"Marketing, Web","He said ""hi""",`)
  })
})

describe('UK formatting', () => {
  it('formats dates in en-GB for Europe/London', () => {
    expect(formatUkDate('2026-09-15T23:30:00Z')).toBe('16 Sept 2026')
    expect(formatUkDate(null)).toBe('—')
  })

  it('describes time to expiry with urgency tones', () => {
    expect(formatDaysLeft(null).label).toBe('No expiry')
    expect(formatDaysLeft(-3)).toEqual({ label: '3 days ago', tone: 'text-rose-600' })
    expect(formatDaysLeft(12).tone).toBe('text-rose-600')
    expect(formatDaysLeft(56).tone).toBe('text-amber-600')
    expect(formatDaysLeft(345).tone).toBe('text-emerald-600')
  })

  it('formats sizes and enum labels', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(4404019)).toBe('4.20 MB')
    expect(humanise('expiring_soon')).toBe('Expiring Soon')
  })
})
