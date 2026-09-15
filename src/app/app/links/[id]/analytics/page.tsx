import { redirect } from 'next/navigation'

// Analytics now lives as a tab on the page detail view rather than a
// separate route, so old links here still land somewhere useful.
export default async function LinkPageAnalyticsRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/app/links/${id}?tab=analytics`)
}
