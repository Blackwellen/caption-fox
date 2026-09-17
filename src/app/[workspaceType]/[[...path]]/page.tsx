import { notFound, redirect } from 'next/navigation'
import { loadWorkspaceShell } from '@/lib/navigation/session'
import { flatNavItems, isWorkspaceKind, workspaceImplementationHref } from '@/lib/navigation/resolver'

/**
 * Canonical /{type}/{module}/… URLs for modules whose real implementation is
 * still served by the /app compatibility surface. Deep paths and query strings
 * are carried across; modules the workspace does not include 404.
 */
export default async function CanonicalWorkspaceRoute({ params, searchParams }: {
  params: Promise<{ workspaceType: string; path?: string[] }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { workspaceType, path = [] } = await params
  if (!isWorkspaceKind(workspaceType)) notFound()

  const session = await loadWorkspaceShell()
  if (!session?.nav) notFound()

  const [moduleSegment, ...rest] = path
  if (!moduleSegment) redirect(session.nav.homeHref)

  const item = flatNavItems(session.nav).find(entry => entry.route === `/${workspaceType}/${moduleSegment}`)
  if (!item) notFound()
  const implementation = workspaceImplementationHref(workspaceType, item.id)
  if (!implementation || implementation === item.route) notFound()

  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const entry of Array.isArray(value) ? value : value === undefined ? [] : [value]) query.append(key, entry)
  }
  const suffix = rest.length ? `/${rest.map(encodeURIComponent).join('/')}` : ''
  const search = query.toString()
  redirect(`${implementation}${suffix}${search ? `?${search}` : ''}`)
}
