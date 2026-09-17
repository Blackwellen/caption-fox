import { describe, it, expect } from 'vitest'
import { canAccessCampaignModule, visibleCampaignModules, campaignCapabilities, type CampaignContext } from './entitlements'
import { parseCampaignQuery, hasAnyFilter } from './query'
import { canTransitionStage, BOARD_STAGES, LIFECYCLE_LABELS } from './constants'
import { campaignsBaseFor, CAMPAIGNS_ROUTE_PATTERN } from './paths'
import { activeCampaignCount, onTrackRate, type CampaignAggregates } from './data'

const ctx = (over: Partial<CampaignContext> = {}): CampaignContext => ({
  workspaceId: 'ws1', workspaceType: 'brand', plan: 'team', planStatus: 'active', role: 'owner', ...over,
})

describe('campaign module entitlements', () => {
  it('allows every module for a brand owner on Team', () => {
    expect(visibleCampaignModules(ctx())).toEqual(
      ['overview', 'all', 'giveaways', 'competitions', 'templates', 'board', 'timeline'])
  })

  it('hides competitions from a creator workspace regardless of plan', () => {
    const creator = ctx({ workspaceType: 'creator', plan: 'enterprise' })
    expect(visibleCampaignModules(creator)).not.toContain('competitions')
    const access = canAccessCampaignModule(creator, 'competitions')
    expect(access.allowed).toBe(false)
    if (!access.allowed) expect(access.reason).toBe('workspace_type')
  })

  it('plan-gates giveaways, templates, board and timeline on Starter', () => {
    const starter = ctx({ plan: 'starter' })
    expect(visibleCampaignModules(starter)).toEqual(['overview', 'all'])
    const giveaways = canAccessCampaignModule(starter, 'giveaways')
    expect(giveaways.allowed).toBe(false)
    if (!giveaways.allowed) {
      expect(giveaways.reason).toBe('plan')
      expect(giveaways.upgrade).toBe(true)
    }
  })

  it('blocks everything when the subscription is cancelled', () => {
    const cancelled = canAccessCampaignModule(ctx({ planStatus: 'cancelled' }), 'overview')
    expect(cancelled.allowed).toBe(false)
    if (!cancelled.allowed) expect(cancelled.reason).toBe('subscription')
  })

  it('gives a read-only viewer no write capabilities', () => {
    const caps = campaignCapabilities(ctx({ role: 'viewer' }))
    expect(caps.create).toBe(false)
    expect(caps.edit).toBe(false)
    expect(caps.archive).toBe(false)
    expect(caps.manageGiveaways).toBe(false)
  })
})

describe('campaign query state', () => {
  it('falls back safely on invalid values', () => {
    const q = parseCampaignQuery({ view: 'nonsense', sort: 'nope', page: '-4', size: '999', from: 'not-a-date' })
    expect(q.view).toBe('cards')
    expect(q.sort).toBe('due_soonest')
    expect(q.page).toBe(1)
    expect(q.size).toBe(12)
    expect(q.from).toBe('')
  })

  it('keeps valid values and honours the view whitelist', () => {
    const q = parseCampaignQuery({ view: 'board', stage: 'live', page: '3' }, { views: ['board', 'cards'], defaultView: 'board' })
    expect(q.view).toBe('board')
    expect(q.stage).toBe('live')
    expect(q.page).toBe(3)
  })

  it('detects whether any filter is active', () => {
    expect(hasAnyFilter(parseCampaignQuery({}))).toBe(false)
    expect(hasAnyFilter(parseCampaignQuery({ health: 'at_risk' }))).toBe(true)
  })
})

describe('board stage transitions', () => {
  it('allows forward delivery moves', () => {
    expect(canTransitionStage('planning', 'in_review')).toBe(true)
    expect(canTransitionStage('scheduled', 'live')).toBe(true)
    expect(canTransitionStage('live', 'completed')).toBe(true)
  })

  it('rejects illegal jumps', () => {
    expect(canTransitionStage('planning', 'completed')).toBe(false)
    expect(canTransitionStage('completed', 'planning')).toBe(false)
    expect(canTransitionStage('nonsense', 'live')).toBe(false)
  })

  it('renders every board column with a label', () => {
    for (const stage of BOARD_STAGES) expect(LIFECYCLE_LABELS[stage]).toBeTruthy()
  })
})

describe('KPI maths', () => {
  const agg = (over: Partial<CampaignAggregates> = {}): CampaignAggregates => ({
    total: 0, byStage: {}, byHealth: {}, activeThisMonth: 0, overdue: 0, budgetAtRisk: 0,
    pendingApprovals: 0, plannedLaunches: 0, upcomingDeadlines: 0, launchingSoon: 0,
    totalBudget: 0, totalSpend: 0, ...over,
  })

  it('counts in-flight stages as active campaigns', () => {
    expect(activeCampaignCount(agg({ byStage: { in_progress: 4, live: 3, scheduled: 2, in_review: 1, planning: 9 } }))).toBe(10)
  })

  it('computes the on-track rate and avoids divide-by-zero', () => {
    expect(onTrackRate(agg({ total: 8, byHealth: { on_track: 6 } }))).toBe(75)
    expect(onTrackRate(agg())).toBe(0)
  })
})

describe('canonical campaign routes', () => {
  it('maps each workspace type to its type-first base', () => {
    expect(campaignsBaseFor('brand')).toBe('/brand/campaigns')
    expect(campaignsBaseFor('small_business')).toBe('/business/campaigns')
    expect(campaignsBaseFor('creator')).toBe('/creator/campaigns')
    expect(campaignsBaseFor('agency')).toBe('/agency/campaigns')
  })

  it('falls back to the smallest module set for an unknown type', () => {
    expect(campaignsBaseFor(undefined)).toBe('/creator/campaigns')
  })

  it('revalidates the whole campaigns subtree', () => {
    expect(CAMPAIGNS_ROUTE_PATTERN).toBe('/[workspaceType]/campaigns')
  })
})
