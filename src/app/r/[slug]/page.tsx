import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { recordLinkClick } from '@/app/l/actions'

// Public short-link redirect for reusable links: /r/[vanity_slug] -> destination_url
// Records a link_click analytics event and bumps the click counter before
// redirecting, then appends UTM params if the link has any configured.
export default async function ReusableLinkRedirect({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: link } = await supabase
    .from('reusable_links_public')
    .select('id, destination_url, utm, status')
    .eq('vanity_slug', slug)
    .single()

  if (!link) notFound()

  await recordLinkClick({ reusableLinkId: link.id })

  let target = link.destination_url
  const utm = (link.utm ?? {}) as Record<string, string>
  const utmKeys = Object.keys(utm).filter(k => utm[k])
  if (utmKeys.length > 0) {
    try {
      const url = new URL(target)
      for (const key of utmKeys) url.searchParams.set(`utm_${key}`, utm[key])
      target = url.toString()
    } catch { /* keep target as-is if the destination URL is malformed */ }
  }

  redirect(target)
}

export const dynamic = 'force-dynamic'
