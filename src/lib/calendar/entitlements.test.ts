import { describe, expect, it } from 'vitest'
import { PERMISSIONS } from '@/lib/permissions'
import {
  buildCalendarContext, canAccessCalendarCapability, capabilityBlockReason,
  isCalendarSurface, normalisePlanId, visibleCalendarTabs,
} from './entitlements'

const ALL = Object.values(PERMISSIONS) as string[]

function ctx(overrides: Partial<Parameters<typeof buildCalendarContext>[0]> = {}) {
  return buildCalendarContext({
    workspaceId: 'ws', workspaceType: 'small_business', basePath: '/business',
    planId: 'team', role: 'owner', permissions: ALL, userId: 'user', ...overrides,
  })
}

describe('visibleCalendarTabs', () => {
  it('gives a team-plan owner all four sub-tabs with canonical routes', () => {
    const tabs = visibleCalendarTabs(ctx())
    expect(tabs.map(t => t.id)).toEqual(['calendar', 'publishing-queue', 'agenda', 'conflicts'])
    expect(tabs[1].href).toBe('/business/calendar/publishing-queue')
  })
  it('omits operational tabs on the free plan instead of showing dead tabs', () => {
    expect(visibleCalendarTabs(ctx({ planId: 'starter' })).map(t => t.id)).toEqual(['calendar'])
  })
  it('omits Conflicts below the team plan', () => {
    expect(visibleCalendarTabs(ctx({ planId: 'creator_pro' })).map(t => t.id)).not.toContain('conflicts')
  })
})

describe('feature flags are independent of plan', () => {
  it('a disabled flag removes the surface even on the top plan', () => {
    const c = ctx({ planId: 'enterprise', flags: { calendar_conflicts: false } })
    expect(canAccessCalendarCapability(c, 'calendar.conflicts')).toBe(false)
    expect(capabilityBlockReason(c, 'calendar.conflicts')).toEqual({ reason: 'flag' })
  })
  it('reports the plan needed when the plan is the blocker', () => {
    expect(capabilityBlockReason(ctx({ planId: 'creator_pro' }), 'calendar.conflicts'))
      .toEqual({ reason: 'plan', requiredPlan: 'team' })
  })
})

describe('roles and permissions', () => {
  it('read-only members can view but never mutate, even if permissions are present', () => {
    const viewer = ctx({ role: 'viewer' })
    expect(viewer.isReadOnly).toBe(true)
    expect(canAccessCalendarCapability(viewer, 'calendar.view')).toBe(true)
    expect(canAccessCalendarCapability(viewer, 'calendar.create')).toBe(false)
    expect(canAccessCalendarCapability(viewer, 'queue.publish')).toBe(false)
    expect(canAccessCalendarCapability(viewer, 'conflicts.resolve')).toBe(false)
  })
  it('a missing permission blocks the action with a permission reason', () => {
    const c = ctx({ permissions: ALL.filter(p => p !== PERMISSIONS.PUBLISH_POST) })
    expect(canAccessCalendarCapability(c, 'queue.publish')).toBe(false)
    expect(capabilityBlockReason(c, 'queue.publish')).toEqual({ reason: 'permission' })
    expect(canAccessCalendarCapability(c, 'queue.approve')).toBe(true)
  })
})

describe('normalisation', () => {
  it('maps the billing plan enum onto product plans', () => {
    expect(normalisePlanId('brand')).toBe('agency')
    expect(normalisePlanId('something-new')).toBe('free')
  })
  it('maps small_business onto the business surface and rejects non-calendar surfaces', () => {
    expect(ctx().surface).toBe('business')
    expect(isCalendarSurface('portal')).toBe(false)
    expect(isCalendarSurface('agency')).toBe(true)
  })
})
