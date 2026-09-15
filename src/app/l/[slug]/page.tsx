import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { recordPageView } from '../actions'
import PublicLinkPageClient from './PublicLinkPageClient'
import type { RenderableItem, RenderablePage } from '@/components/link-in-bio/PublicMicroPageRenderer'

async function loadPage(slug: string) {
  const supabase = await createClient()
  const { data: page } = await supabase.from('link_pages_public').select('*').eq('slug', slug).single()
  return page
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const page = await loadPage(slug)
  if (!page) return { title: 'Page not found · Caption Fox' }
  return {
    title: page.seo_title || page.title,
    description: page.seo_description || page.description || `${page.title} — Link in Bio`,
    openGraph: {
      title: page.seo_title || page.title,
      description: page.seo_description || page.description || undefined,
      images: page.og_image ? [page.og_image] : page.avatar_url ? [page.avatar_url] : undefined,
    },
  }
}

export default async function PublicLinkPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()

  // Public pages are read through the security-definer view, never the raw
  // workspace-scoped table — a draft/archived/private page simply won't
  // appear here, regardless of RLS on the base table.
  const page = await loadPage(slug)
  if (!page) notFound()

  const { data: items } = await supabase
    .from('link_page_items_public')
    .select('*')
    .eq('page_id', page.id)
    .order('sort_order', { ascending: true })

  const hdrs = await headers()
  await recordPageView(page.id, hdrs.get('user-agent'), hdrs.get('referer'))

  const renderPage: RenderablePage = {
    title: page.title,
    description: page.description,
    avatar_url: page.avatar_url,
    background_type: page.background_type,
    background_value: page.background_value,
    primary_color: page.primary_color,
    button_style: page.button_style,
    button_color: page.button_color,
    button_text_color: page.button_text_color,
    font_family: page.font_family,
    show_caption_fox_branding: page.show_caption_fox_branding,
  }

  const renderItems: RenderableItem[] = (items ?? []).map(i => ({
    id: i.id, item_type: i.item_type, title: i.title, url: i.url, is_active: i.is_active, sort_order: i.sort_order,
  }))

  return <PublicLinkPageClient pageId={page.id} page={renderPage} items={renderItems} />
}

export const dynamic = 'force-dynamic'
