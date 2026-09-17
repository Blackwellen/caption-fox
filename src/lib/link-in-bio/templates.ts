// Starter templates for Create Link Page / Create Conversion Page. Each is a
// real block list the create action inserts; nothing here is rendered as a
// static picture. `themeName` picks a workspace theme by name when present.

import { BLANK_CONVERSION_PAGE, BLANK_LINK_PAGE, type StarterBlock } from './blocks'

export type PageTemplate = {
  key: string; name: string; description: string; imageUrl: string | null; themeName: string | null
  kind: 'link_page' | 'conversion_page'; blocks: StarterBlock[]
}

const M = '/demo/link-in-bio'

export const PAGE_TEMPLATES: PageTemplate[] = [
  { key: 'blank', name: 'Blank Canvas', description: 'Start from scratch', imageUrl: null, themeName: null, kind: 'link_page', blocks: BLANK_LINK_PAGE },
  { key: 'summer-sale', name: 'Summer Sale', description: 'Bright & Promotional', imageUrl: `${M}/sunglasses.jpg`, themeName: 'Sunset', kind: 'link_page', blocks: [
    { type: 'hero', config: { eyebrow: 'SALE', headline: 'Summer Sale', subheadline: 'Up to 40% off', imageUrl: `${M}/sunglasses.jpg` } },
    { type: 'links', children: [{ title: 'Shop the sale', url: 'https://example.com/sale' }, { title: 'Bundles', url: 'https://example.com/bundles' }] },
    { type: 'countdown', config: { label: 'Offer ends in', endsAt: null } },
    { type: 'footer' },
  ] },
  { key: 'creator-hub', name: 'Creator Hub', description: 'Personal Brand', imageUrl: `${M}/creator-portrait.jpg`, themeName: 'Creator Pop', kind: 'link_page', blocks: [
    { type: 'hero', config: { headline: 'Hi, I create things', subheadline: 'Everything I make, in one place', imageUrl: `${M}/creator-portrait.jpg` } },
    { type: 'links', children: [{ title: 'Latest video', url: 'https://youtube.com' }, { title: 'My newsletter', url: 'https://example.com/newsletter' }] },
    { type: 'social_feed', config: { platform: 'instagram', handle: '' } },
    { type: 'footer' },
  ] },
  { key: 'product-showcase', name: 'Product Showcase', description: 'Ecommerce', imageUrl: `${M}/skincare-bottles.jpg`, themeName: 'Minimal Mono', kind: 'link_page', blocks: [
    { type: 'hero', config: { headline: 'Product Showcase', subheadline: 'Our bestsellers', imageUrl: `${M}/skincare-bottles.jpg` } },
    { type: 'product' },
    { type: 'product_grid' },
    { type: 'links', children: [{ title: 'Shop all', url: 'https://example.com/shop' }] },
  ] },
  { key: 'event-landing', name: 'Event Landing', description: 'Event & RSVP', imageUrl: `${M}/neon-night.jpg`, themeName: 'Launch Night', kind: 'link_page', blocks: [
    { type: 'hero', config: { headline: 'Event Landing', subheadline: 'Save the date', imageUrl: `${M}/neon-night.jpg` } },
    { type: 'countdown', config: { label: 'Doors open in', endsAt: null } },
    { type: 'button_stack', children: [{ title: 'RSVP now', url: 'https://example.com/rsvp' }] },
    { type: 'faq' },
  ] },
  { key: 'waitlist', name: 'Waitlist Signup', description: 'Lead Generation', imageUrl: `${M}/waitlist-sky.jpg`, themeName: 'Ocean Blue', kind: 'link_page', blocks: [
    { type: 'hero', config: { headline: 'Join the waitlist', subheadline: 'Be first to know', imageUrl: `${M}/waitlist-sky.jpg` } },
    { type: 'form', config: { heading: 'Reserve your spot', body: 'We will email you on launch day.', buttonLabel: 'Join waitlist', consentText: 'No spam, unsubscribe anytime.' } },
  ] },
  { key: 'conversion-blank', name: 'Conversion page', description: 'Governed conversion page', imageUrl: null, themeName: null, kind: 'conversion_page', blocks: BLANK_CONVERSION_PAGE },
]

export function templateByKey(key: string | null | undefined): PageTemplate {
  return PAGE_TEMPLATES.find(template => template.key === key) ?? PAGE_TEMPLATES[0]
}
