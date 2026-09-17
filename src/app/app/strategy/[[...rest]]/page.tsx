import { notFound, redirect } from 'next/navigation'
import { loadWorkspaceShell } from '@/lib/navigation/session'
import { isStrategyRouteKind } from '@/lib/strategy/page-context'

/**
 * Legacy /app/strategy/* compatibility route. Strategy now lives at the
 * canonical /{business|brand|agency}/strategy/*; old links and bookmarks
 * redirect there, keeping the sub-path and query string.
 */
export default async function LegacyStrategyRedirect({
  params, searchParams,
}: {
  params: Promise<{ rest?: string[] }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [{ rest = [] }, query, session] = await Promise.all([params, searchParams, loadWorkspaceShell()])
  if (!session) redirect(`/login?next=${encodeURIComponent(`/app/strategy/${rest.join('/')}`)}`)
  if (!isStrategyRouteKind(session.kind)) notFound()
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === 'string') qs.set(key, value)
  }
  const safe = rest.filter(part => /^[\w-]{1,64}$/.test(part))
  redirect(`/${session.kind}/strategy${safe.length ? `/${safe.join('/')}` : ''}${qs.size ? `?${qs}` : ''}`)
}
