import { describe, expect, it } from 'vitest'
import { MAP_PACK_BANDS, mapPackBand } from './map-pack'

describe('mapPackBand', () => {
  it('treats a missing rank as unranked rather than coercing it to a band', () => {
    expect(mapPackBand(null).label).toBe('Unranked')
  })

  it('places ranks on the band boundaries the legend shows', () => {
    expect(mapPackBand(1).label).toBe('1')
    expect(mapPackBand(1.4).label).toBe('2–3')
    expect(mapPackBand(3).label).toBe('2–3')
    expect(mapPackBand(4.3).label).toBe('4–6')
    expect(mapPackBand(10).label).toBe('7–10')
    expect(mapPackBand(11).label).toBe('11+')
    expect(mapPackBand(97).label).toBe('11+')
  })

  it('keeps legend bands ordered and exhaustive', () => {
    const maxes = MAP_PACK_BANDS.map(band => band.max)
    expect([...maxes].sort((a, b) => a - b)).toEqual(maxes)
    expect(maxes[maxes.length - 1]).toBe(Infinity)
  })
})
