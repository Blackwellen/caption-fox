import { redirect } from 'next/navigation'
import { loadWorkspaceShell } from '@/lib/navigation/session'

/**
 * Link in Bio moved from the /app compatibility surface to /{type}/links.
 * Old URLs (bookmarks, activity links) redirect to their canonical route.
 */
export default async function LegacyLinksRedirect({ params }: { params: Promise<{ rest?: string[] }> }) {
  const { rest = [] } = await params
  const session = await loadWorkspaceShell()
  const base = `/${session?.kind ?? 'creator'}/links`
  const [a, b, c] = rest

  if (!a) redirect(base)
  if (a === 'library' || a === 'analytics') redirect(`${base}/${a}`)
  if (a === 'themes') redirect(b ? `${base}/themes/${encodeURIComponent(b)}/${c === 'editor' ? 'editor' : 'overview'}` : `${base}/themes`)
  if (a === 'reusable-links' && b) redirect(`${base}/reusable-links/${encodeURIComponent(b)}`)
  if (b === 'analytics') redirect(`${base}/pages/${encodeURIComponent(a)}/analytics`)
  redirect(`${base}/pages/${encodeURIComponent(a)}/design`)
}
