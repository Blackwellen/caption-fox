import { redirect } from 'next/navigation'
import { loadWorkspaceShell } from '@/lib/navigation/session'

/**
 * Legacy /app/campaigns/… URLs (saved links, older activity records, other
 * modules' deep links) redirect to the canonical /{type}/campaigns/… route for
 * the active workspace. Deep paths and query strings are carried across.
 */
export default async function LegacyCampaignsRedirect({ params, searchParams }: {
  params: Promise<{ rest?: string[] }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { rest = [] } = await params
  const session = await loadWorkspaceShell()
  const kind = session?.kind ?? 'creator'

  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const entry of Array.isArray(value) ? value : value === undefined ? [] : [value]) query.append(key, entry)
  }
  const suffix = rest.length ? `/${rest.map(encodeURIComponent).join('/')}` : ''
  const search = query.toString()
  redirect(`/${kind}/campaigns${suffix}${search ? `?${search}` : ''}`)
}
