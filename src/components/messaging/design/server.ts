import 'server-only'
import { requireMessagingModule } from '@/lib/messaging/server'
import type { MessagingModule } from '@/lib/messaging/constants'
import { resolvePeriod } from '@/lib/messaging/metrics'
import { members, savedViews } from '@/lib/messaging/dashboard'
import type { RawParams } from '@/lib/messaging/query'

export function one(params: RawParams, key: string): string {
  const v = params[key]
  return ((Array.isArray(v) ? v[0] : v) ?? '').trim().slice(0, 120)
}

/**
 * Everything a redesigned Messaging page needs before rendering: the gated
 * session, the selected period, pagination, workspace members and this
 * member's saved views for the surface.
 */
export async function loadMessagingPage(module: MessagingModule, params: RawParams, defaultSize = 5) {
  const session = await requireMessagingModule(module)
  const period = resolvePeriod(one(params, 'from') || undefined, one(params, 'to') || undefined)
  const page = Math.max(1, Math.min(10_000, Number.parseInt(one(params, 'page'), 10) || 1))
  const rawSize = Number.parseInt(one(params, 'size'), 10)
  const size = [5, 10, 25, 50].includes(rawSize) ? rawSize : defaultSize
  if (!session.access.allowed) return { ...session, period, page, size, people: [], views: [] }
  const [people, views] = await Promise.all([
    members(session.supabase, session.ctx.workspaceId),
    savedViews(session.supabase, session.ctx.workspaceId, session.userId, module),
  ])
  return { ...session, period, page, size, people, views }
}

export async function userEmail(supabase: Awaited<ReturnType<typeof requireMessagingModule>>['supabase']) {
  const { data } = await supabase.auth.getUser()
  return data.user?.email ?? ''
}
