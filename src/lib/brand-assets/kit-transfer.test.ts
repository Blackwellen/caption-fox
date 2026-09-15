import { describe, expect, it } from 'vitest'
import { KIT_EXPORT_FORMAT, parseKitFile } from './kit-transfer'

const file = (over: Record<string, unknown> = {}) => JSON.stringify({
  format: KIT_EXPORT_FORMAT, version: 1,
  kit: { name: 'Acme Care', description: 'Care range', team_name: 'Brand Team', brand: 'Acme Care' },
  colours: [{ name: 'Rose', hex: '#ec4899', role: 'primary' }, { name: 'Bad', hex: 'pink', role: 'accent' }],
  typography: [
    { style_name: 'Heading 1', font_family: 'Manrope' },
    { style_name: 'Body', font_family: 'Inter' },
  ],
  tone: { statement: 'Warm and clear.', traits: ['Warm', 'Clear'] },
  ...over,
})

describe('parseKitFile', () => {
  it('reads an exported kit and normalises colours', () => {
    const r = parseKitFile(file())
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.kit.name).toBe('Acme Care')
    expect(r.kit.colours).toEqual([{ name: 'Rose', hex: '#EC4899', role: 'primary' }])
    expect(r.kit.headingFont).toBe('Manrope')
    expect(r.kit.bodyFont).toBe('Inter')
    expect(r.kit.toneTraits).toEqual(['Warm', 'Clear'])
    expect(r.kit.sourceBrand).toBe('Acme Care')
  })

  it('rejects non-JSON, foreign formats and future versions with a readable error', () => {
    expect(parseKitFile('not json')).toEqual({ ok: false, error: 'This file is not valid JSON.' })
    expect(parseKitFile(JSON.stringify({ format: 'other' })).ok).toBe(false)
    const v2 = parseKitFile(file({ version: 2 }))
    expect(v2.ok).toBe(false)
    if (!v2.ok) expect(v2.error).toMatch(/version 2/)
  })

  it('requires a name, at least one valid colour and typography', () => {
    expect(parseKitFile(file({ kit: { name: 'A' } })).ok).toBe(false)
    expect(parseKitFile(file({ colours: [{ name: 'x', hex: 'nope' }] })).ok).toBe(false)
    expect(parseKitFile(file({ typography: [] })).ok).toBe(false)
  })

  it('caps list sizes so a hostile file cannot flood the kit', () => {
    const colours = Array.from({ length: 50 }, (_, i) => ({ name: `C${i}`, hex: '#112233', role: 'neutral' }))
    const traits = Array.from({ length: 50 }, (_, i) => `t${i}`)
    const r = parseKitFile(file({ colours, tone: { statement: 'x', traits } }))
    expect(r.ok && r.kit.colours.length).toBe(12)
    expect(r.ok && r.kit.toneTraits.length).toBe(8)
  })
})
