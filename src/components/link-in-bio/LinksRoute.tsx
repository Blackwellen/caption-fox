import { notFound, redirect } from 'next/navigation'
import { getLinksGate } from '@/lib/link-in-bio/server/context'
import { BlockedState } from './ui'
import LibraryPage from './library/LibraryPage'
import ThemesPage from './themes/ThemesPage'
import AnalyticsPage from './analytics/AnalyticsPage'

// Server entry point for `/{type}/links/...`. Resolves the entitlement gate
// once, then dispatches on the URL segments:
//
//   (none)                               Overview
//   library | themes | analytics         collections
//   pages                                -> library (pages are listed there)
//   pages/{id}[/{tab}]                   Link Page detail (design, links, products,
//                                        forms, pixels, analytics, settings, versions)
//   new | conversion-pages/new           create wizards
//   reusable-links/new                   create reusable link
//   reusable-links/{id}[/{tab}]          reusable link detail
//   themes/new | themes/{id}[/{tab}]     create theme / theme detail

export const PAGE_TABS = ['design', 'links', 'products', 'forms', 'pixels', 'analytics', 'settings', 'versions'] as const
export const LINK_TABS = ['overview', 'destinations', 'rules', 'analytics', 'settings', 'versions'] as const
export const THEME_TABS = ['overview', 'editor', 'components', 'pages', 'analytics', 'settings', 'versions'] as const

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function linksTitle(segments: string[]): string {
  const [a, b] = segments
  if (!a) return 'Overview'
  if (a === 'library') return 'Link Library'
  if (a === 'themes') return b === 'new' ? 'Create Theme' : b ? 'Theme' : 'Themes'
  if (a === 'analytics') return 'Link Analytics'
  if (a === 'new') return 'Create Link Page'
  if (a === 'conversion-pages') return 'Create Conversion Page'
  if (a === 'reusable-links') return b === 'new' ? 'Create Reusable Link' : 'Reusable Link'
  if (a === 'pages') return 'Link Page'
  return 'Link in Bio'
}

export default async function LinksRoute({ workspaceType, segments, searchParams }: {
  workspaceType: string
  segments: string[]
  searchParams: Record<string, string | string[] | undefined>
}) {
  const gate = await getLinksGate(workspaceType)
  if (!gate.ok) {
    return <div className="py-10"><BlockedState title="Link in Bio is not available" description={gate.denial.message} /></div>
  }
  const { session } = gate
  const [section, second, third, ...extra] = segments
  if (extra.length) notFound()

  switch (section) {
    case undefined: return <LibraryPage session={session} searchParams={searchParams} />
    case 'library': if (second) notFound(); return <LibraryPage session={session} searchParams={searchParams} />
    case 'analytics': if (second) notFound(); return <AnalyticsPage session={session} searchParams={searchParams} />
    case 'themes':
      if (!second) return <ThemesPage session={session} searchParams={searchParams} />
      notFound()
    case 'pages':
      if (!second) redirect(`${session.basePath}/library`)
      if (!UUID.test(second)) notFound()
      if (!third) redirect(`${session.basePath}/pages/${second}/design`)
      notFound()
    default: notFound()
  }
}
