import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { growthRate, isPlausibleHubSpotToken, mapHubSpotLists } from './crm-rules'
import { fetchHubSpotSegments, HubSpotError, testHubSpotToken } from './hubspot'

// Built at runtime so secret scanners never see a token-shaped literal.
const TOKEN = ['pat', 'eu1', 'x'.repeat(8), 'y'.repeat(4), 'z'.repeat(12)].join('-')
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

describe('isPlausibleHubSpotToken', () => {
  it('accepts private-app tokens only', () => {
    expect(isPlausibleHubSpotToken(TOKEN)).toBe(true)
    for (const bad of ['', 'abc', 'sk_live_123', 'pat-eu1-short', 'pat-eu1-' + 'x'.repeat(200), null, 5]) {
      expect(isPlausibleHubSpotToken(bad)).toBe(false)
    }
  })
})

describe('mapHubSpotLists', () => {
  it('maps lists, tolerating missing or odd fields', () => {
    const { segments, hasMore, offset } = mapHubSpotLists({
      lists: [
        { listId: 12, name: '  Newsletter  ', processingType: 'DYNAMIC', additionalProperties: { hs_list_size: '4200' }, updatedAt: '2026-09-01T10:00:00Z' },
        { id: 'a7', name: 'Static list', size: 15.9, processingType: 'MANUAL' },
        { listId: 3, name: '' },
        { name: 'no id' },
        { listId: 9, name: 'Negative', size: -4 },
      ],
      hasMore: true, offset: 100,
    })
    expect(segments).toEqual([
      { externalId: '12', name: 'Newsletter', size: 4200, dynamic: true, updatedAt: '2026-09-01T10:00:00Z' },
      { externalId: 'a7', name: 'Static list', size: 15, dynamic: false, updatedAt: null },
      { externalId: '9', name: 'Negative', size: 0, dynamic: false, updatedAt: null },
    ])
    expect(hasMore).toBe(true)
    expect(offset).toBe(100)
  })
  it('returns nothing for empty or malformed payloads', () => {
    expect(mapHubSpotLists(null).segments).toEqual([])
    expect(mapHubSpotLists({ lists: 'x' }).segments).toEqual([])
  })
  it('truncates long names to the column limit', () => {
    expect(mapHubSpotLists({ lists: [{ listId: 1, name: 'n'.repeat(200) }] }).segments[0].name).toHaveLength(80)
  })
})

describe('growthRate', () => {
  it('is zero without a usable previous value and clamps extremes', () => {
    expect(growthRate(null, 100)).toBe(0)
    expect(growthRate(0, 100)).toBe(0)
    expect(growthRate(100, 150)).toBe(50)
    expect(growthRate(100, 50)).toBe(-50)
    expect(growthRate(1, 1_000_000)).toBe(9999)
  })
})

describe('HubSpot client', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  beforeEach(() => { fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock) })
  afterEach(() => vi.unstubAllGlobals())

  it('verifies the token and the list scope, sending it as a bearer header', async () => {
    fetchMock.mockResolvedValueOnce(json({ portalId: 4242 })).mockResolvedValueOnce(json({ lists: [] }))
    await expect(testHubSpotToken(TOKEN)).resolves.toEqual({ accountLabel: 'HubSpot portal 4242' })
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.hubapi.com/account-info/v3/details')
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${TOKEN}`)
    expect(fetchMock.mock.calls[1][0]).toBe('https://api.hubapi.com/crm/v3/lists/search')
  })

  it.each([
    [401, /rejected the access token/],
    [403, /crm\.lists\.read/],
    [429, /rate limiting/],
    [500, /error \(500\)/],
  ])('turns a %i response into a clear error without echoing the token', async (status, message) => {
    fetchMock.mockResolvedValue(json({ message: 'boom', token: TOKEN }, status))
    const error = await testHubSpotToken(TOKEN).catch(e => e)
    expect(error).toBeInstanceOf(HubSpotError)
    expect(error.status).toBe(status)
    expect(error.message).toMatch(message)
    expect(error.message).not.toContain(TOKEN)
  })

  it('reports an unreachable HubSpot as status 0', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'))
    const error = await fetchHubSpotSegments(TOKEN).catch(e => e)
    expect(error).toBeInstanceOf(HubSpotError)
    expect(error.status).toBe(0)
  })

  it('pages through lists until HubSpot says there are no more', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ lists: [{ listId: 1, name: 'A' }, { listId: 2, name: 'B' }], hasMore: true, offset: 2 }))
      .mockResolvedValueOnce(json({ lists: [{ listId: 3, name: 'C' }], hasMore: false }))
    const result = await fetchHubSpotSegments(TOKEN)
    expect(result.segments.map(s => s.name)).toEqual(['A', 'B', 'C'])
    expect(result.truncated).toBe(false)
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).offset).toBe(2)
  })

  it('stops on a stuck offset instead of looping forever', async () => {
    fetchMock.mockResolvedValue(json({ lists: [{ listId: 1, name: 'A' }], hasMore: true, offset: 0 }))
    await fetchHubSpotSegments(TOKEN)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('caps at 500 lists and flags truncation', async () => {
    let next = 0
    fetchMock.mockImplementation(async () => {
      const lists = Array.from({ length: 100 }, (_, i) => ({ listId: next * 100 + i + 1, name: `L${next * 100 + i}` }))
      next += 1
      return json({ lists, hasMore: true, offset: next * 100 })
    })
    const result = await fetchHubSpotSegments(TOKEN)
    expect(result.segments).toHaveLength(500)
    expect(result.truncated).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(5)
  })
})
