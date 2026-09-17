import { describe, expect, it } from 'vitest'
import {
  canAccessEventsCapability, eventsCapabilityBlocker, surfaceHasEvents,
  visibleEventsTabs, type EventsContext,
} from '../entitlements'
import { parseEventsFilters } from '../filters'
import { activityTitle, eventLocationLabel, formatRate, formatDuration, formatOffset } from '../format'

const owner = (over: Partial<EventsContext> = {}): EventsContext => ({
  surface: 'brand', plan: 'team', role: 'owner', ...over,
})

describe('events entitlements', () => {
  it('recognises only the workspace types that receive Events', () => {
    expect(surfaceHasEvents('brand')).toBe(true)
    expect(surfaceHasEvents('creator')).toBe(true)
    expect(surfaceHasEvents('supplier')).toBe(false)
  })

  it('gives a Brand owner the full tab set', () => {
    expect(visibleEventsTabs(owner())).toEqual(
      ['overview', 'events', 'webinars', 'podcasts', 'sponsorships', 'follow-up'],
    )
  })

  it('omits tabs a Creator workspace does not receive rather than disabling them', () => {
    const tabs = visibleEventsTabs(owner({ surface: 'creator', plan: 'creator_pro' }))
    expect(tabs).not.toContain('sponsorships')
    expect(tabs).toContain('webinars')
  })

  it('hides a surface turned off by a workspace feature flag', () => {
    const ctx = owner({ featureFlags: { 'events.podcasts': false } })
    expect(visibleEventsTabs(ctx)).not.toContain('podcasts')
    expect(canAccessEventsCapability(ctx, 'events.podcasts')).toBe(false)
    expect(eventsCapabilityBlocker(ctx, 'events.podcasts')).toBe('feature-flag')
  })

  it('separates a plan block from a permission block', () => {
    const readOnly = owner({ role: 'read_only' })
    expect(canAccessEventsCapability(readOnly, 'events.create')).toBe(false)
    expect(eventsCapabilityBlocker(readOnly, 'events.create')).toBe('permission')
  })

  it('stops a suspended workspace from mutating while still allowing reads', () => {
    const suspended = owner({ workspaceStatus: 'suspended' })
    expect(canAccessEventsCapability(suspended, 'events.create')).toBe(false)
    expect(canAccessEventsCapability(suspended, 'events.overview')).toBe(true)
    expect(eventsCapabilityBlocker(suspended, 'events.create')).toBe('workspace-status')
    expect(eventsCapabilityBlocker(suspended, 'events.overview')).toBeNull()
  })
})

describe('events URL state', () => {
  const views = ['cards', 'table'] as const

  it('keeps a supported view and falls back for an unsupported one', () => {
    expect(parseEventsFilters({ view: 'table' }, [...views], 'cards').view).toBe('table')
    expect(parseEventsFilters({ view: 'pipeline' }, [...views], 'cards').view).toBe('cards')
  })

  it('ignores invalid paging and range values instead of trusting them', () => {
    const f = parseEventsFilters({ page: '-4', pageSize: '9999', range: '365' }, [...views], 'cards')
    expect(f.page).toBe(1)
    expect(f.pageSize).toBe(10)
    expect(f.range).toBe(30)
  })

  it('trims and bounds free text so a huge query cannot be pushed through', () => {
    const f = parseEventsFilters({ q: `  ${'x'.repeat(400)}  ` }, [...views], 'cards')
    expect(f.q).toHaveLength(120)
  })

  it('takes the first value when a param is repeated', () => {
    expect(parseEventsFilters({ status: ['live', 'draft'] }, [...views], 'cards').status).toBe('live')
  })
})

describe('events formatting', () => {
  it('labels activity in product language, not the stored verb', () => {
    expect(activityTitle('registration', 'created')).toBe('New registration')
    expect(activityTitle('sponsorship', 'received')).toBe('Sponsorship received')
    // unknown pairs still read as a sentence rather than raw snake_case
    expect(activityTitle('widget', 'frobnicated')).toBe('Frobnicated Widget')
  })

  it('shows a rate only when it is measurable', () => {
    expect(formatRate(0.624)).toBe('62.4%')
    expect(formatRate(null)).toBe('—')
    expect(formatRate(Number.NaN)).toBe('—')
  })

  it('formats watch time and podcast run-sheet offsets', () => {
    expect(formatDuration(2543)).toBe('42m 23s')
    expect(formatDuration(null)).toBe('—')
    expect(formatOffset(150)).toBe('02:30')
  })

  it('shows a venue for in-person events and a platform for virtual ones', () => {
    const base = { location_name: 'The Brewery', location_city: 'London', location_country: 'United Kingdom', online_platform: 'Zoom' }
    expect(eventLocationLabel({ ...base, format: 'in_person' })).toBe('London, United Kingdom')
    expect(eventLocationLabel({ ...base, format: 'virtual' })).toBe('Zoom')
    expect(eventLocationLabel({ ...base, format: 'hybrid' })).toBe('London, United Kingdom + Zoom')
  })
})
