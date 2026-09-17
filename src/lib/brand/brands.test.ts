import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BRANDS, DOMAIN_BRANDS, brandLabel, hasBrand, rootDomain } from './brands'

describe('brand registry', () => {
  it('gives every brand exactly one way to render a real mark', () => {
    for (const [key, entry] of Object.entries(BRANDS)) {
      expect(Boolean(entry.icon || entry.image), `${key} has no mark`).toBe(true)
      if (entry.special) expect(entry.icon, `${key} special mark needs its vector`).toBeTruthy()
    }
  })

  it('ships every self-hosted logo file it references', () => {
    for (const [key, entry] of Object.entries(BRANDS)) {
      if (!entry.image) continue
      expect(existsSync(join(process.cwd(), 'public', entry.image)), `${key} → ${entry.image} missing`).toBe(true)
    }
  })

  it('covers every social platform the app connects to', () => {
    for (const platform of ['instagram', 'tiktok', 'facebook', 'linkedin', 'youtube', 'x', 'pinterest', 'threads']) {
      expect(hasBrand(platform), platform).toBe(true)
    }
  })

  it('maps known domains onto registered brands', () => {
    for (const brand of Object.values(DOMAIN_BRANDS)) expect(hasBrand(brand), brand).toBe(true)
  })

  it('labels unknown keys readably and normalises domains', () => {
    expect(brandLabel('google_search_console')).toBe('Google Search Console')
    expect(brandLabel('some_new_tool')).toBe('Some New Tool')
    expect(rootDomain('https://www.Forbes.com/sites/x')).toBe('forbes.com')
  })
})
