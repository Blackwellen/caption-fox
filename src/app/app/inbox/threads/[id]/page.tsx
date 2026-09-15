import { redirect } from 'next/navigation'

// Superseded by the Unified Inbox's embedded three-pane conversation view,
// which deep-links to a specific thread via ?thread=<id>. Kept as a redirect
// so old bookmarks/links still land somewhere useful instead of a broken page.
export default async function ThreadRedirectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/app/inbox/unified?thread=${id}`)
}
