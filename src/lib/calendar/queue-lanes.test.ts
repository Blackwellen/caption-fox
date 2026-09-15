import { describe, expect, it, vi } from 'vitest'

// queries.ts is server-only and pulls in the Supabase server client; none of that
// is exercised here, only the pure lane mapping.
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/workspace', () => ({ getActiveWorkspace: vi.fn() }))

const { laneFor } = await import('./queries')

describe('laneFor', () => {
  it('puts items waiting on a reviewer in Awaiting Approval, even though they are stored as drafts', () => {
    expect(laneFor('awaiting_approval', 'draft')).toBe('awaiting_approval')
    expect(laneFor('changes_requested', 'draft')).toBe('awaiting_approval')
  })
  it('keeps genuine drafts in Draft', () => {
    expect(laneFor('not_required', 'draft')).toBe('draft')
  })
  it('always surfaces failures in Failed', () => {
    expect(laneFor('approved', 'failed')).toBe('failed')
    expect(laneFor('awaiting_approval', 'failed')).toBe('failed')
  })
  it('separates ready and scheduled work', () => {
    expect(laneFor('approved', 'ready')).toBe('ready')
    expect(laneFor('approved', 'queued')).toBe('ready')
    expect(laneFor('approved', 'scheduled')).toBe('scheduled')
    expect(laneFor('not_required', 'processing')).toBe('scheduled')
  })
})
