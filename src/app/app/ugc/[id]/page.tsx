import { redirect } from 'next/navigation'

// The Creators & UGC module moved to /app/creators/briefs — this route only
// exists so old bookmarks and links keep working. The old route mixed brief
// and other detail types under one id; briefs is the closest real match.
export default async function LegacyUgcDetailRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/app/creators/briefs/${id}`)
}
