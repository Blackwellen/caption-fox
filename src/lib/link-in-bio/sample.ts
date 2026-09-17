// The sample page a theme is previewed with (theme cards, theme editor,
// create theme). It is clearly generic preview content, never presented as a
// real page, and it exercises every styled element: badge, heading, link
// buttons and a form.

import type { Block, RenderModel } from './records'
import type { ThemeTokens } from './theme'

const link = (id: string, title: string, url: string) => ({
  id, title, url, icon: null, isActive: true, sortOrder: 0, reusableLinkId: null, checkStatus: 'unknown', checkedAt: null, scheduleStart: null, scheduleEnd: null,
})

export function themeSampleModel(tokens: ThemeTokens, opts: { headline?: string; subheadline?: string; body?: string; linkCount?: number; form?: boolean } = {}): RenderModel {
  const links = [
    link('s1', 'Shop Bestsellers', 'https://example.com/shop'),
    link('s2', 'New Arrivals', 'https://example.com/new'),
    link('s3', 'Bundle & Save 20%', 'https://example.com/bundle'),
    link('s4', 'Skincare Quiz', 'https://example.com/quiz'),
    link('s5', 'Read Our Blog', 'https://example.com/blog'),
    link('s6', 'Find Us on Instagram', 'https://instagram.com/example'),
  ].slice(0, opts.linkCount ?? 6)
  const blocks: Block[] = [
    { id: 'hero', type: 'hero', title: null, description: null, isActive: true, sortOrder: 0, children: [], config: { eyebrow: 'ACME', headline: opts.headline ?? 'Summer Glow', subheadline: opts.subheadline ?? 'Bright days. Bold moves.', body: opts.body ?? 'Curated picks to elevate your summer.' } },
    { id: 'links', type: 'links', title: null, description: null, isActive: true, sortOrder: 1, config: { style: 'button' }, children: links.map((l, i) => ({ ...l, sortOrder: i })) },
  ]
  if (opts.form !== false) {
    blocks.push({ id: 'form', type: 'form', title: null, description: null, isActive: true, sortOrder: 2, children: [], config: { heading: 'Get 15% Off', body: 'Join our community for exclusive offers and skincare tips.', buttonLabel: 'Subscribe', consentText: 'No spam, unsubscribe anytime.' } })
  }
  return { title: opts.headline ?? 'Sample page', description: null, kind: 'link_page', tokens, blocks, legal: {}, showBranding: false }
}
