import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveWorkspace } from '@/lib/workspace'
import { workspaceKindFromType } from '@/lib/navigation/resolver'

/**
 * Legacy /app/creators/... URLs (old bookmarks, stored activity links, email
 * links) redirect to the canonical /{type}/creators/... route, keeping deep
 * paths and the query string.
 */
export default async function LegacyCreatorsRedirect({ params, searchParams }: {
  params: Promise<{ rest?: string[] }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { rest = [] } = await params
  const suffix = rest.length ? `/${rest.map(encodeURIComponent).join('/')}` : ''
  if (!user) redirect(`/login?next=${encodeURIComponent(`/app/creators${suffix}`)}`)
  const { active } = await getActiveWorkspace(supabase, user.id)
  if (!active) redirect('/onboarding')

  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const entry of Array.isArray(value) ? value : value === undefined ? [] : [value]) query.append(key, entry)
  }
  const search = query.toString()
  redirect(`/${workspaceKindFromType(active.type)}/creators${suffix}${search ? `?${search}` : ''}`)
}
