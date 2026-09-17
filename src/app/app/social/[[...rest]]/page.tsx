import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveWorkspace } from '@/lib/workspace'
import { workspaceKindFromType } from '@/lib/navigation/resolver'

/**
 * Legacy /app/social/… URLs (old bookmarks, OAuth return paths, stored
 * activity links) redirect to the canonical /{type}/social/… route, keeping
 * deep paths and the query string.
 */
export default async function LegacySocialRedirect({ params, searchParams }: {
  params: Promise<{ rest?: string[] }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { active } = await getActiveWorkspace(supabase, user.id)
  if (!active) redirect('/onboarding')

  const { rest = [] } = await params
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const entry of Array.isArray(value) ? value : value === undefined ? [] : [value]) query.append(key, entry)
  }
  const suffix = rest.length ? `/${rest.map(encodeURIComponent).join('/')}` : ''
  const search = query.toString()
  redirect(`/${workspaceKindFromType(active.type)}/social${suffix}${search ? `?${search}` : ''}`)
}
