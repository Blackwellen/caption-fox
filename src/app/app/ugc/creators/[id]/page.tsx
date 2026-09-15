import { redirect } from 'next/navigation'

// The Creators & UGC module moved to /app/creators/creators — this route only
// exists so old bookmarks and links keep working.
export default async function LegacyUgcCreatorRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/app/creators/creators/${id}`)
}
