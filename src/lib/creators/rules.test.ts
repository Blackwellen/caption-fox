import { describe, expect, it } from 'vitest'
import {
  batchBlockers, batchCurrency, csvCell, daysLeft, deltaLabel, reviewSecondsBetween, settledBatchStatus,
} from './rules'
import { resolveCreatorsLink, storedLink } from './routes'
import {
  canTransitionBrief, canTransitionPayment, canTransitionRights, canTransitionSubmission, effectiveRightsStatus,
} from './constants'
import { parseCreatorsQuery, parsePaymentsQuery } from './query'

const ready = {
  status: 'approved', approval_state: 'approved', invoice_status: 'submitted', tax_status: 'verified',
  payment_method: 'bank_transfer', batch_id: null, currency: 'GBP',
}

describe('payout batch eligibility', () => {
  it('accepts an approved, invoiced, tax-clear payment for a payment-ready creator', () => {
    expect(batchBlockers(ready, true)).toEqual([])
  })

  it('lists every blocking reason', () => {
    const reasons = batchBlockers({ ...ready, invoice_status: 'required', tax_status: 'missing', payment_method: null, batch_id: 'b1' }, false)
    expect(reasons).toEqual(expect.arrayContaining([
      'Already in a payout batch', 'Creator payout details incomplete', 'Invoice not submitted',
      'Tax information missing', 'No payment method recorded',
    ]))
  })

  it('blocks payments that are not approved', () => {
    expect(batchBlockers({ ...ready, status: 'in_review' }, true)).toContain('Payment not approved')
    expect(batchBlockers({ ...ready, approval_state: 'pending' }, true)).toContain('Payment not approved')
  })

  it('never mixes currencies in one batch', () => {
    expect(batchCurrency([{ currency: 'GBP' }, { currency: 'gbp' }])).toEqual({ ok: true, currency: 'GBP' })
    const mixed = batchCurrency([{ currency: 'GBP' }, { currency: 'USD' }])
    expect(mixed.ok).toBe(false)
    expect(batchCurrency([]).ok).toBe(false)
  })

  it('rolls a batch up from its settled payments', () => {
    expect(settledBatchStatus(['paid', 'paid'])).toBe('completed')
    expect(settledBatchStatus(['paid', 'failed'])).toBe('partially_completed')
    expect(settledBatchStatus(['failed'])).toBe('failed')
    expect(settledBatchStatus(['paid', 'scheduled'])).toBe('processing')
  })
})

describe('lifecycles', () => {
  it('enforces payment transitions', () => {
    expect(canTransitionPayment('approved', 'scheduled')).toBe(true)
    expect(canTransitionPayment('scheduled', 'approved')).toBe(false)
    expect(canTransitionPayment('paid', 'draft')).toBe(false)
    expect(canTransitionPayment('failed', 'scheduled')).toBe(true)
  })

  it('enforces rights transitions and never reopens a revoked licence', () => {
    expect(canTransitionRights('pending_approval', 'active')).toBe(true)
    expect(canTransitionRights('revoked', 'active')).toBe(false)
    expect(canTransitionRights('expired', 'renewal_pending')).toBe(true)
  })

  it('enforces submission and brief transitions', () => {
    expect(canTransitionSubmission('waiting_review', 'approved')).toBe(true)
    expect(canTransitionSubmission('rejected', 'approved')).toBe(false)
    expect(canTransitionBrief('draft', 'completed')).toBe(false)
    expect(canTransitionBrief('submitted', 'completed')).toBe(true)
  })

  it('derives expiry from dates rather than the stored badge', () => {
    expect(effectiveRightsStatus('active', '2000-01-01')).toBe('expired')
    expect(effectiveRightsStatus('revoked', '2000-01-01')).toBe('revoked')
    expect(effectiveRightsStatus('active', '2999-01-01')).toBe('active')
  })
})

describe('dates and durations', () => {
  const noon = Date.parse('2026-09-17T12:00:00Z')
  it('reports yesterday as -1, never "0 days left"', () => {
    expect(daysLeft('2026-09-16', noon)).toBe(-1)
    expect(daysLeft('2026-09-17', noon)).toBe(1)
    expect(daysLeft('2026-09-20', noon)).toBe(4)
    expect(daysLeft(null, noon)).toBeNull()
  })

  it('measures review time and rejects impossible ranges', () => {
    expect(reviewSecondsBetween('2026-09-17T10:00:00Z', '2026-09-17T12:30:00Z')).toBe(9000)
    expect(reviewSecondsBetween('2026-09-17T12:00:00Z', '2026-09-17T10:00:00Z')).toBeNull()
    expect(reviewSecondsBetween(null, '2026-09-17T10:00:00Z')).toBeNull()
  })

  it('formats deltas without a negative zero', () => {
    expect(deltaLabel(12.34)).toBe('12.3% vs last 30 days')
    expect(deltaLabel(-0.01)).toBe('0.0% vs last 30 days')
  })
})

describe('exports', () => {
  it('neutralises spreadsheet formula injection', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`)
    expect(csvCell('+44 7700')).toBe("'+44 7700")
    expect(csvCell('@handle')).toBe("'@handle")
    expect(csvCell('plain, text')).toBe('"plain, text"')
    expect(csvCell(-12)).toBe('-12')
  })
})

describe('links and URL state', () => {
  it('rewrites stored links onto the active workspace route', () => {
    expect(resolveCreatorsLink(storedLink('payments', 'abc'), '/brand/creators')).toBe('/brand/creators/payments/abc')
    expect(resolveCreatorsLink('/app/creators', '/agency/creators')).toBe('/agency/creators')
    expect(resolveCreatorsLink('https://evil.example', '/brand/creators')).toBeNull()
    expect(resolveCreatorsLink('//evil.example', '/brand/creators')).toBeNull()
  })

  it('falls back safely on invalid query values', () => {
    const q = parseCreatorsQuery({ view: 'map', niche: 'nope', page: '-4', size: '999', status: 'active' })
    expect(q.view).toBe('table')
    expect(q.niche).toBe('')
    expect(q.page).toBe(1)
    expect(q.size).toBe(10)
    expect(q.status).toBe('active')
    expect(parsePaymentsQuery({ method: 'crypto' }).method).toBe('')
  })
})

describe('entitlements and role capabilities', async () => {
  const { canAccessCreatorModule, creatorCapabilities, visibleCreatorModules } = await import('./entitlements')
  const ctx = (role: string, plan = 'team', workspaceType = 'brand', planStatus = 'active') =>
    ({ workspaceId: 'ws', workspaceType, plan, planStatus, role })

  it('gives owners payment approval and payout processing', () => {
    const caps = creatorCapabilities(ctx('owner'))
    expect(caps.approvePayments && caps.processPayouts && caps.viewSensitiveFinancials).toBe(true)
  })

  it('lets managers see payments but not approve or pay them', () => {
    const caps = creatorCapabilities(ctx('manager'))
    expect(caps.viewPayments).toBe(true)
    expect(caps.approvePayments || caps.processPayouts).toBe(false)
  })

  it('keeps viewers read-only', () => {
    const caps = creatorCapabilities(ctx('viewer'))
    expect(caps.view).toBe(true)
    expect(caps.createBrief || caps.invite || caps.approve || caps.manageRights || caps.viewPayments).toBe(false)
  })

  it('lets members brief and upload but not manage creators or money', () => {
    const caps = creatorCapabilities(ctx('member'))
    expect(caps.createBrief && caps.upload).toBe(true)
    expect(caps.manageCreators || caps.approve || caps.viewPayments).toBe(false)
  })

  it('gates rights and payments behind the Team plan with an upgrade path', () => {
    const access = canAccessCreatorModule(ctx('owner', 'starter'), 'payments')
    expect(access).toMatchObject({ allowed: false, reason: 'plan', upgrade: true })
    expect(visibleCreatorModules(ctx('owner', 'starter'))).toEqual(['overview', 'creators', 'briefs', 'submissions'])
  })

  it('never shows payments to creator workspaces and blocks cancelled subscriptions', () => {
    expect(canAccessCreatorModule(ctx('owner', 'enterprise', 'creator'), 'payments').allowed).toBe(false)
    expect(canAccessCreatorModule(ctx('owner', 'enterprise', 'brand', 'cancelled'), 'overview')).toMatchObject({ allowed: false, reason: 'subscription' })
  })
})