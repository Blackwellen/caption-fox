'use server'

import { createClient } from '@/lib/supabase/server'

function coarseDeviceType(userAgent: string | null): 'desktop' | 'mobile' | 'tablet' | 'other' {
  if (!userAgent) return 'other'
  const ua = userAgent.toLowerCase()
  if (/ipad|tablet/.test(ua)) return 'tablet'
  if (/mobi|android|iphone/.test(ua)) return 'mobile'
  if (/macintosh|windows|linux/.test(ua)) return 'desktop'
  return 'other'
}

/**
 * Records a page_view for a published public link page. Server action so the
 * public page (an RSC) can fire-and-forget without exposing the analytics
 * table to the client bundle. Never stores IP or the raw user-agent string —
 * only a coarse device bucket, matching the module's privacy-light design.
 */
export async function recordPageView(pageId: string, userAgent: string | null, referrer: string | null) {
  try {
    const supabase = await createClient()
    const { data: page } = await supabase.from('link_pages_public').select('id, workspace_id').eq('id', pageId).single()
    if (!page) return
    await supabase.from('link_analytics_events').insert({
      workspace_id: page.workspace_id,
      page_id: page.id,
      event_type: 'page_view',
      device_type: coarseDeviceType(userAgent),
      referrer: referrer ? new URL(referrer).hostname : null,
    })
    await supabase.rpc('increment_link_page_view', { p_page_id: page.id })
  } catch { /* analytics must never break the public page */ }
}

/**
 * Records a link_click and increments the denormalised click counters used
 * by the collection/detail cards. Called from a client component on click.
 */
export async function recordLinkClick(input: { pageId?: string; itemId?: string; reusableLinkId?: string }) {
  try {
    const supabase = await createClient()
    let workspaceId: string | null = null

    if (input.pageId) {
      const { data: page } = await supabase.from('link_pages_public').select('id, workspace_id').eq('id', input.pageId).single()
      if (!page) return
      workspaceId = page.workspace_id
    } else if (input.reusableLinkId) {
      const { data: rl } = await supabase.from('reusable_links_public').select('id, workspace_id').eq('id', input.reusableLinkId).single()
      if (!rl) return
      workspaceId = rl.workspace_id
    }
    if (!workspaceId) return

    await supabase.from('link_analytics_events').insert({
      workspace_id: workspaceId,
      page_id: input.pageId ?? null,
      item_id: input.itemId ?? null,
      reusable_link_id: input.reusableLinkId ?? null,
      event_type: 'link_click',
    })

    if (input.itemId) await supabase.rpc('increment_link_item_click', { p_item_id: input.itemId })
    if (input.pageId) await supabase.rpc('increment_link_page_click', { p_page_id: input.pageId })
    if (input.reusableLinkId) await supabase.rpc('increment_reusable_link_click', { p_link_id: input.reusableLinkId })
  } catch { /* analytics must never break the click-through */ }
}
