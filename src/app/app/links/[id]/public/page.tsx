import { redirect } from 'next/navigation'

// This route redirects to the public slug-based URL.
// The actual public page is served at /l/[slug] outside the app shell.
export default async function LinkPagePublicRedirect({ params }: { params: { id: string } }) {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()

  const { data: page } = await supabase
    .from('link_pages')
    .select('slug')
    .eq('id', params.id)
    .single()

  if (!page?.slug) redirect('/app/links')
  redirect(`/l/${page.slug}`)
}
