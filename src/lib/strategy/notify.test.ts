import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { notifyStrategy } from './notify'

type Row = Record<string, unknown>

function makeSession(opts: { profile?: Row | null; workspace?: Row; insertError?: { code: string } | null } = {}) {
  const inserted: Row[] = []
  const profile = opts.profile === undefined ? { email: 'sophia@example.com', full_name: 'Sophia', notification_preferences: null } : opts.profile
  const workspace = opts.workspace ?? { name: 'Acme Brand', slug: 'acme', type: 'brand', settings: {} }
  const supabase = {
    from(table: string) {
      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: table === 'profiles' ? profile : workspace }) }) }),
        insert: async (row: Row) => { inserted.push(row); return { error: opts.insertError ?? null } },
      }
    },
  }
  const session = { supabase, userId: 'actor-1', ctx: { workspaceId: 'ws-1', workspaceType: 'brand' } }
  return { session: session as never, inserted }
}

const base = { recipientId: 'user-2', type: 'strategy_approval_request' as const, title: 'Approval requested: <Core message>', body: 'Please review "Q4" & confirm', module: 'positioning' as const, entityId: 'fw-1' }

describe('notifyStrategy', () => {
  const env = { ...process.env }
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key'
    process.env.MESSAGING_EMAIL_FROM = 'Acme <hello@acme.test>'
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.com/'
    fetchMock = vi.fn(async () => new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => { process.env = { ...env }; vi.unstubAllGlobals(); vi.restoreAllMocks() })

  it('writes the in-app row and sends an escaped email with a deep link', async () => {
    const { session, inserted } = makeSession()
    const result = await notifyStrategy(session, base)
    expect(result).toEqual({ inApp: true, email: 'sent' })
    expect(inserted[0]).toMatchObject({ workspace_id: 'ws-1', user_id: 'user-2', type: 'strategy_approval_request', link: '/brand/strategy/positioning?focus=fw-1' })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.resend.com/emails')
    const body = JSON.parse(init.body)
    expect(body.from).toBe('Acme <hello@acme.test>')
    expect(body.to).toBe('sophia@example.com')
    expect(body.html).toContain('&lt;Core message&gt;')
    expect(body.html).not.toContain('<Core message>')
    expect(body.html).toContain('https://app.example.com/brand/strategy/positioning?focus=fw-1')
    expect(init.headers.Authorization).toBe('Bearer re_test_key')
    expect(init.headers['Idempotency-Key']).toMatch(/^strategy_approval_request-fw-1-user-2-\d+$/)
  })

  it('skips everything when notifying yourself or nobody', async () => {
    const { session, inserted } = makeSession()
    expect(await notifyStrategy(session, { ...base, recipientId: 'actor-1' })).toEqual({ inApp: false, email: 'skipped' })
    expect(await notifyStrategy(session, { ...base, recipientId: null })).toEqual({ inApp: false, email: 'skipped' })
    expect(inserted).toHaveLength(0)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('respects opt-outs per channel', async () => {
    const emailOff = makeSession({ profile: { email: 'a@b.test', notification_preferences: { approvals: { email: false } } } })
    expect(await notifyStrategy(emailOff.session, base)).toEqual({ inApp: true, email: 'skipped' })
    const inAppOff = makeSession({ profile: { email: 'a@b.test', notification_preferences: { approvals: { in_app: false } } } })
    expect(await notifyStrategy(inAppOff.session, base)).toEqual({ inApp: false, email: 'sent' })
    const legacyOff = makeSession({ profile: { email: 'a@b.test', notification_preferences: { approval_requests: false } } })
    expect(await notifyStrategy(legacyOff.session, base)).toEqual({ inApp: false, email: 'skipped' })
  })

  it('never emails from demo workspaces', async () => {
    const bySlug = makeSession({ workspace: { name: 'Demo', slug: 'brand-demo', settings: {} } })
    expect(await notifyStrategy(bySlug.session, base)).toEqual({ inApp: true, email: 'skipped' })
    const bySetting = makeSession({ workspace: { name: 'X', slug: 'x', settings: { demo: true } } })
    expect(await notifyStrategy(bySetting.session, base)).toEqual({ inApp: true, email: 'skipped' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('stays in-app only until the workspace supplies its own Resend key and sender', async () => {
    delete process.env.RESEND_API_KEY
    const noKey = makeSession()
    expect(await notifyStrategy(noKey.session, base)).toEqual({ inApp: true, email: 'skipped' })
    process.env.RESEND_API_KEY = 're_test_key'
    delete process.env.MESSAGING_EMAIL_FROM
    const noFrom = makeSession()
    expect(await notifyStrategy(noFrom.session, base)).toEqual({ inApp: true, email: 'skipped' })
    const noEmail = makeSession({ profile: { email: null, notification_preferences: null } })
    process.env.MESSAGING_EMAIL_FROM = 'a@b.test'
    expect(await notifyStrategy(noEmail.session, base)).toEqual({ inApp: true, email: 'skipped' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reports a rejected or unreachable provider without throwing, and keeps the in-app row', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{"message":"bad"}', { status: 422 }))
    const rejected = makeSession()
    expect(await notifyStrategy(rejected.session, base)).toEqual({ inApp: true, email: 'failed' })
    expect(rejected.inserted).toHaveLength(1)
    fetchMock.mockRejectedValueOnce(new DOMException('timeout', 'TimeoutError'))
    expect(await notifyStrategy(makeSession().session, base)).toEqual({ inApp: true, email: 'failed' })
  })

  it('does not log the recipient address or key on failure', async () => {
    fetchMock.mockResolvedValueOnce(new Response('nope', { status: 500 }))
    await notifyStrategy(makeSession().session, base)
    const logged = JSON.stringify((console.error as unknown as { mock: { calls: unknown[] } }).mock.calls)
    expect(logged).not.toContain('sophia@example.com')
    expect(logged).not.toContain('re_test_key')
  })

  it('still sends the email if the in-app insert fails', async () => {
    const { session } = makeSession({ insertError: { code: '42501' } })
    expect(await notifyStrategy(session, base)).toEqual({ inApp: false, email: 'sent' })
  })
})
