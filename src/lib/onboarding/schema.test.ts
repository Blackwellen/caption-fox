import { describe, expect, it } from 'vitest'
import {
  ACCOUNT_TYPES, FLOWS, completionPercent, firstIncompleteStep, isAccountType, sanitizeAll, sanitizeStep,
  validateAll, validateStep,
} from './schema'

const UID = '3f1b2c9e-7a4d-4e1a-9c2b-5d6e7f8a9b0c'

describe('account types', () => {
  it('has exactly the five supported types, each with four steps', () => {
    expect([...ACCOUNT_TYPES].sort()).toEqual(['agency', 'brand', 'business', 'creator', 'supplier'])
    for (const t of ACCOUNT_TYPES) expect(FLOWS[t].steps).toHaveLength(4)
  })
  it('rejects spoofed types', () => {
    expect(isAccountType('admin')).toBe(false)
    expect(isAccountType('small_business')).toBe(false)
    expect(isAccountType('creator')).toBe(true)
  })
})

describe('sanitizeStep', () => {
  it('drops fields that do not belong to the step (hidden-field manipulation)', () => {
    const out = sanitizeStep('supplier', 1, { company_name: 'Luna', verified: true, is_platform_admin: true, status: 'active' }, UID)
    expect(out).not.toHaveProperty('verified')
    expect(out).not.toHaveProperty('is_platform_admin')
    expect(out).not.toHaveProperty('status')
    expect(out.company_name).toBe('Luna')
  })

  it('rejects enum values outside the option list', () => {
    const out = sanitizeStep('agency', 2, { client_model: 'shared_tenant_bypass', service_lines: ['Campaigns', 'Hacking'] }, UID)
    expect(out.client_model).toBe('')
    expect(out.service_lines).toEqual(['Campaigns'])
  })

  it('only keeps uploads inside the caller’s own folder with allowed types', () => {
    const out = sanitizeStep('brand', 2, {
      logo: [{ path: `00000000-0000-0000-0000-000000000000/logo/a.png`, name: 'a.png', type: 'image/png', size: 10 }],
      brand_assets: [
        { path: `${UID}/brand_assets/b.png`, name: 'b.png', type: 'image/png', size: 10 },
        { path: `${UID}/brand_assets/c.svg`, name: 'c.svg', type: 'image/svg+xml', size: 10 },
        { path: `${UID}/brand_assets/../../x.png`, name: 'x', type: 'image/png', size: 10 },
      ],
    }, UID)
    expect(out.logo).toEqual([])
    expect((out.brand_assets as unknown[]).length).toBe(1)
  })

  it('normalises colours, urls and invites', () => {
    const colors = sanitizeStep('brand', 2, { brand_colors: ['#1769ff', 'red', '#1769FF', '#0a1630'] }, UID).brand_colors
    expect(colors).toEqual(['#1769FF', '#0A1630'])
    expect(sanitizeStep('brand', 1, { website: 'acme.co' }, UID).website).toBe('https://acme.co')
    const invites = sanitizeStep('business', 4, { invites: [{ email: 'A@x.com', role: 'owner' }, { email: 'a@x.com', role: 'viewer' }] }, UID).invites
    expect(invites).toEqual([{ email: 'a@x.com', role: 'member' }])
  })
})

describe('validation + progression', () => {
  const creator = {
    creator_type: 'content_creator', display_name: 'Alex Smith', primary_platform: 'instagram',
    audience_focus: 'Gen Z (13–24)', content_categories: ['UGC'], posting_frequency: 'Daily',
    content_formats: ['Photos'], collab_types: ['Gifted products'],
  }

  it('reports missing required fields per step', () => {
    expect(validateStep('creator', 2, {})).toHaveProperty('display_name')
    expect(validateStep('creator', 2, creator)).toEqual({})
  })

  it('does not let a user skip ahead past an incomplete step', () => {
    expect(firstIncompleteStep('creator', {})).toBe(1)
    expect(firstIncompleteStep('creator', { creator_type: 'influencer' })).toBe(2)
    expect(firstIncompleteStep('creator', creator)).toBe(4)
  })

  it('validates a complete draft end to end', () => {
    expect(validateAll('creator', sanitizeAll('creator', creator, UID))).toBeNull()
    expect(completionPercent('creator', creator)).toBe(100)
  })

  it('requires a supplier portfolio example or link', () => {
    expect(validateStep('supplier', 3, {})).toHaveProperty('portfolio')
    expect(validateStep('supplier', 3, { portfolio_link: 'https://luna.co/work' })).toEqual({})
  })

  it('rejects invalid urls', () => {
    expect(validateStep('brand', 1, { brand_name: 'Acme', industry: 'Technology', website: 'https://not a url' })).toHaveProperty('website')
  })
})
