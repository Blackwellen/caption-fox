import { redirect } from 'next/navigation'
import { getStudioSession } from '@/lib/studio/server'
import { STUDIO_SEGMENTS } from '@/lib/studio/paths'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Legacy /app/studio/* URLs (old sub-routes, `/app/studio/{postId}`,
 * `/app/studio/posts/{postId}` and `/app/studio/new`) all land on the canonical
 * /{type}/studio/* routes. Query strings are carried across.
 */
export default async function LegacyStudioRedirect({ params, searchParams }: {
  params: Promise<{ rest?: string[] }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [{ rest = [] }, raw, session] = await Promise.all([params, searchParams, getStudioSession()])
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(raw)) {
    for (const entry of Array.isArray(value) ? value : value === undefined ? [] : [value]) query.append(key, entry)
  }

  const [first, second] = rest
  let path = session.base
  if (first && (Object.values(STUDIO_SEGMENTS) as string[]).includes(first)) path = `${session.base}/${first}`
  else if (first === 'new') path = `${session.base}/compose`
  else if (first && UUID.test(first)) { path = `${session.base}/compose`; query.set('id', first) }
  else if (first === 'posts' && second && UUID.test(second)) { path = `${session.base}/compose`; query.set('id', second) }

  const qs = query.toString()
  redirect(qs ? `${path}?${qs}` : path)
}
