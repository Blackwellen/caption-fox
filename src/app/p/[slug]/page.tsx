import { redirect, notFound } from 'next/navigation'
import { headers, cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

// Public partnership tracking-link redirect: /p/[slug] -> destination_url.
// Resolves the slug, increments its click counter and logs the click for
// attribution through one security-definer RPC (record_partnership_click),
// then sets a first-touch attribution cookie so a conversion recorded later
// in this session/browser can be credited to the right partner.
export default async function PartnershipTrackingRedirect({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()
  const hdrs = await headers()

  const { data, error } = await supabase.rpc('record_partnership_click', {
    p_slug: slug,
    p_referer: hdrs.get('referer'),
    p_user_agent: hdrs.get('user-agent'),
  })

  const link = Array.isArray(data) ? data[0] : data
  if (error || !link?.destination_url) notFound()

  const { data: programme } = await supabase
    .from('partnership_programmes')
    .select('tracking_window_days')
    .eq('id', link.programme_id)
    .maybeSingle()

  const windowDays = programme?.tracking_window_days ?? 30
  const cookieStore = await cookies()
  cookieStore.set('cf_partner_attribution', JSON.stringify({
    trackingLinkId: link.tracking_link_id,
    programmeId: link.programme_id,
    partnerId: link.partner_id,
    workspaceId: link.workspace_id,
    capturedAt: Date.now(),
  }), {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
    maxAge: windowDays * 86_400, path: '/',
  })

  redirect(link.destination_url)
}

export const dynamic = 'force-dynamic'
