// The block registry: every block type a Link Page or Conversion Page can
// contain, with its builder label, default config and the capability it needs.
// The builder, snippets panel, server validation and public renderer all read
// from here, so a type cannot exist in one place and not the others.

import type { LinkCapability } from './entitlements'

export type BlockType =
  | 'hero' | 'links' | 'button_stack' | 'product' | 'product_grid' | 'form'
  | 'social_proof' | 'social_feed' | 'countdown' | 'faq' | 'pricing'
  | 'video' | 'image' | 'text' | 'divider' | 'footer'

/** Rows that live under a `links` or `button_stack` block. */
export type ChildType = 'link'

export type BlockIcon =
  | 'hero' | 'list' | 'stack' | 'product' | 'grid' | 'mail' | 'eye' | 'feed' | 'timer'
  | 'faq' | 'pricing' | 'video' | 'image' | 'text' | 'divider' | 'footer'

export type BlockDef = {
  type: BlockType
  label: string
  description: string
  icon: BlockIcon
  hasChildren?: boolean
  requires?: LinkCapability
  defaultConfig: Record<string, unknown>
}

export const BLOCKS: Record<BlockType, BlockDef> = {
  hero: { type: 'hero', label: 'Hero', description: 'Full width hero with background image', icon: 'hero', defaultConfig: { eyebrow: '', headline: 'Your headline', subheadline: 'A short line about what visitors will find here.', imageUrl: null } },
  links: { type: 'links', label: 'Featured links', description: 'Button list style', icon: 'list', hasChildren: true, defaultConfig: { style: 'button' } },
  button_stack: { type: 'button_stack', label: 'Button stack', description: 'Primary CTA buttons', icon: 'stack', hasChildren: true, defaultConfig: { style: 'stack' } },
  product: { type: 'product', label: 'Product spotlight', description: 'Featured product card', icon: 'product', requires: 'products.manage', defaultConfig: { productId: null, name: 'Product name', priceLabel: '', imageUrl: null, ctaLabel: 'Shop now', url: null } },
  product_grid: { type: 'product_grid', label: 'Product grid', description: 'Grid of featured products', icon: 'grid', requires: 'products.manage', defaultConfig: { products: [] } },
  form: { type: 'form', label: 'Email capture form', description: 'Collect emails with incentive', icon: 'mail', requires: 'forms.manage', defaultConfig: { formId: null, heading: 'Join my list', body: 'Get updates and exclusive content.', buttonLabel: 'Subscribe', consentText: 'No spam, unsubscribe anytime.' } },
  social_proof: { type: 'social_proof', label: 'Social proof', description: 'Testimonials carousel', icon: 'eye', defaultConfig: { quotes: [] } },
  social_feed: { type: 'social_feed', label: 'Instagram feed', description: 'Latest posts from a profile', icon: 'feed', defaultConfig: { platform: 'instagram', handle: '' } },
  countdown: { type: 'countdown', label: 'Countdown timer', description: 'Counts down to a launch or deadline', icon: 'timer', defaultConfig: { label: 'Offer ends in', endsAt: null } },
  faq: { type: 'faq', label: 'FAQ', description: 'Accordion style answers', icon: 'faq', defaultConfig: { items: [] } },
  pricing: { type: 'pricing', label: 'Pricing table', description: 'Compare plans or bundles', icon: 'pricing', defaultConfig: { tiers: [] } },
  video: { type: 'video', label: 'Video hero', description: 'YouTube or Vimeo embed', icon: 'video', defaultConfig: { url: null, caption: '' } },
  image: { type: 'image', label: 'Image + CTA', description: 'Image with a call to action', icon: 'image', defaultConfig: { imageUrl: null, alt: '', ctaLabel: '', url: null } },
  text: { type: 'text', label: 'Text', description: 'A paragraph of copy', icon: 'text', defaultConfig: { body: '' } },
  divider: { type: 'divider', label: 'Divider', description: 'Separates sections', icon: 'divider', defaultConfig: {} },
  footer: { type: 'footer', label: 'Footer', description: 'Social links and legal', icon: 'footer', defaultConfig: { socials: [], legalText: '' } },
}

export const BLOCK_TYPES = Object.keys(BLOCKS) as BlockType[]

export function isBlockType(value: unknown): value is BlockType {
  return typeof value === 'string' && value in BLOCKS
}

/** Snippets offered in the builder's side panel (design: Block snippets). */
export type Snippet = { id: string; label: string; type: BlockType; preview: 'countdown' | 'image-cta' | 'video' | 'product-grid' | 'link-icons' | 'feed' | 'testimonials' | 'pricing' | 'hero-cta' | 'product-benefits' | 'lead-form' | 'before-after' | 'faq' | 'footer'; config?: Record<string, unknown> }

export const LINK_PAGE_SNIPPETS: Snippet[] = [
  { id: 'countdown', label: 'Countdown timer', type: 'countdown', preview: 'countdown' },
  { id: 'image-cta', label: 'Image + CTA', type: 'image', preview: 'image-cta' },
  { id: 'video-hero', label: 'Video hero', type: 'video', preview: 'video' },
  { id: 'product-grid', label: 'Product grid', type: 'product_grid', preview: 'product-grid' },
  { id: 'link-icons', label: 'Link list (icons)', type: 'links', preview: 'link-icons', config: { style: 'icon' } },
  { id: 'instagram-feed', label: 'Instagram feed', type: 'social_feed', preview: 'feed' },
  { id: 'testimonials', label: 'Testimonials', type: 'social_proof', preview: 'testimonials' },
  { id: 'pricing', label: 'Pricing table', type: 'pricing', preview: 'pricing' },
]

export const CONVERSION_SNIPPETS: Snippet[] = [
  { id: 'hero-ctas', label: 'Hero + CTAs', type: 'hero', preview: 'hero-cta' },
  { id: 'product-benefits', label: 'Product + Benefits', type: 'product', preview: 'product-benefits' },
  { id: 'lead-form', label: 'Lead gen form', type: 'form', preview: 'lead-form' },
  { id: 'before-after', label: 'Before / After', type: 'image', preview: 'before-after' },
  { id: 'testimonials', label: 'Testimonials', type: 'social_proof', preview: 'testimonials' },
  { id: 'faq', label: 'FAQ', type: 'faq', preview: 'faq' },
  { id: 'pricing', label: 'Pricing table', type: 'pricing', preview: 'pricing' },
  { id: 'footer', label: 'Simple footer', type: 'footer', preview: 'footer' },
]

/** Starter block lists for templates and blank pages. */
export type StarterBlock = { type: BlockType; title?: string; config?: Record<string, unknown>; children?: { title: string; url: string }[]; is_active?: boolean }

export const BLANK_LINK_PAGE: StarterBlock[] = [
  { type: 'hero', config: { headline: 'My Link Page', subheadline: 'Your bio goes here. Share what matters.' } },
  { type: 'links', children: [{ title: 'First link', url: 'https://example.com/1' }, { title: 'Second link', url: 'https://example.com/2' }, { title: 'Third link', url: 'https://example.com/3' }] },
  { type: 'product', config: { name: 'Product name', priceLabel: '£49.00', ctaLabel: 'Shop now' } },
  { type: 'form' },
  { type: 'social_proof' },
  { type: 'footer', is_active: false },
]

export const BLANK_CONVERSION_PAGE: StarterBlock[] = [
  { type: 'hero', title: 'Hero offer', config: { headline: 'Your offer headline', subheadline: 'One clear promise for this page.' } },
  { type: 'button_stack', children: [{ title: 'Primary action', url: 'https://example.com/shop' }, { title: 'Secondary action', url: 'https://example.com/bundle' }] },
  { type: 'product' },
  { type: 'form', title: 'Lead capture form' },
  { type: 'social_proof', title: 'Testimonial strip' },
  { type: 'faq' },
  { type: 'footer' },
]

export function blockSummary(type: BlockType, childCount: number): string | null {
  if (type === 'links') return `${childCount} ${childCount === 1 ? 'link' : 'links'}`
  if (type === 'button_stack') return `${childCount} ${childCount === 1 ? 'button' : 'buttons'}`
  return null
}

/** Only YouTube and Vimeo embeds are rendered, via their privacy-enhanced hosts. */
export function videoEmbedUrl(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '')
    if (host === 'youtu.be') return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(u.pathname.slice(1))}`
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const id = u.searchParams.get('v')
      return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` : null
    }
    if (host === 'vimeo.com') {
      const id = u.pathname.split('/').filter(Boolean)[0]
      return id && /^\d+$/.test(id) ? `https://player.vimeo.com/video/${id}?dnt=1` : null
    }
  } catch { /* not a URL */ }
  return null
}
