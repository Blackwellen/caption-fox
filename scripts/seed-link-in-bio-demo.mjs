// Development-only demo seed for the Link in Bio module.
//
// Idempotent: every demo row is flagged is_demo (pages, reusable links, themes)
// and removed with its cascades before being re-created. Analytics are written
// as daily rollups (the same rows the rollup job produces from raw events) plus
// a handful of raw events for today. A seeded PRNG keeps numbers identical
// across runs. Never run against production.
//
// Usage: node scripts/seed-link-in-bio-demo.mjs [<workspace_id> ...]

import { createClient } from '@supabase/supabase-js'
import { createHash, randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/).filter(line => line && !line.trimStart().startsWith('#')).map(line => {
      const index = line.indexOf('=')
      return [line.slice(0, index).trim(), line.slice(index + 1).trim()]
    }),
)
if (env.NODE_ENV === 'production' || /prod/i.test(env.VERCEL_ENV ?? '')) {
  console.error('Refusing to seed demo Link in Bio data in production.')
  process.exit(1)
}

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const DEFAULT_WORKSPACES = [
  'd7b7c61e-7685-4b15-8a0c-d9fa85f25103', // brand
  '0cf44b57-cf4c-45c8-b600-e435e3bd4e9e', // creator
  '173b63f8-3263-4609-a4f7-c6e113f25bda', // business
  '48d161b1-5db4-4a28-82a4-e19b839aa3ce', // agency
  '68596451-2d06-4670-96ab-460278ef6ba5', // Caption Fox (owner's default creator workspace)
]
const workspaceIds = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_WORKSPACES

function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const MEDIA = '/demo/link-in-bio'
const DAY = 86400000
const now = Date.now()
const ago = (days, hours = 0, minutes = 0) => new Date(now - days * DAY - hours * 3600000 - minutes * 60000).toISOString()
const londonDay = offset => new Date(now - offset * DAY).toLocaleDateString('en-CA', { timeZone: 'Europe/London' })

// ------------------------------------------------------------------ themes
const T = (palette, rest = {}) => ({
  palette: { secondary: '#FDE68A', accent: '#7C3AED', surface: '#FFFFFF', textSecondary: '#475569', border: '#E2E8F0', ...palette },
  typography: { heading: 'Inter', body: 'Inter' },
  buttons: { primaryStyle: 'filled', secondaryStyle: 'outline', radius: 12 },
  cards: { radius: 12, shadow: 'soft' },
  background: { type: 'solid', imageUrl: null },
  accents: { iconStyle: 'outline', divider: 'solid' },
  spacing: { sectionPadding: 24, elementGap: 12 },
  preset: 'soft', mode: 'light',
  ...rest,
})

const THEMES = [
  { key: 'summer-glow', name: 'Summer Glow', category: 'Warm', tags: ['Lifestyle'], owner: 'Emma Davis', status: 'active', days: 3,
    tokens: T({ primary: '#F26B3A', secondary: '#FBD3B5', accent: '#0F3D3E', background: '#FBE9DA', surface: '#FFF8F1', textPrimary: '#2A1E17', textSecondary: '#6B4F3F', border: '#F1D2BD' },
      { typography: { heading: 'Playfair Display', body: 'Inter' }, background: { type: 'image', imageUrl: `${MEDIA}/summer-sand.jpg` } }) },
  { key: 'minimal-mono', name: 'Minimal Mono', category: 'Minimal', tags: ['Professional'], owner: 'Liam Chen', status: 'active', days: 4,
    tokens: T({ primary: '#111111', secondary: '#E5E5E5', accent: '#111111', background: '#FFFFFF', surface: '#FFFFFF', textPrimary: '#111111', textSecondary: '#525252', border: '#E5E5E5' },
      { buttons: { primaryStyle: 'filled', secondaryStyle: 'outline', radius: 8 }, cards: { radius: 8, shadow: 'none' }, preset: 'minimal' }) },
  { key: 'creator-pop', name: 'Creator Pop', category: 'Vibrant', tags: ['Creative'], owner: 'Sophia Patel', status: 'active', days: 5,
    tokens: T({ primary: '#FFFFFF', secondary: '#EC4899', accent: '#7C3AED', background: '#7C3AED', surface: '#FFFFFF', textPrimary: '#1E1B4B', textSecondary: '#4C1D95', border: '#DDD6FE' },
      { typography: { heading: 'Poppins', body: 'Inter' }, background: { type: 'gradient', imageUrl: null }, buttons: { primaryStyle: 'filled', secondaryStyle: 'outline', radius: 999 }, mode: 'dark' }) },
  { key: 'earth-tones', name: 'Earth Tones', category: 'Natural', tags: ['Wellness'], owner: 'Ethan Roberts', status: 'active', days: 6,
    tokens: T({ primary: '#8A6A45', secondary: '#D9C7A7', accent: '#4D5B3A', background: '#EFE6D8', surface: '#FBF7F0', textPrimary: '#2D2418', textSecondary: '#5E4E3A', border: '#E2D5C0' },
      { typography: { heading: 'Lora', body: 'DM Sans' }, background: { type: 'image', imageUrl: `${MEDIA}/earth-mountains.jpg` } }) },
  { key: 'ocean-blue', name: 'Ocean Blue', category: 'Cool', tags: ['Ocean'], owner: 'Noah Williams', status: 'active', days: 7,
    tokens: T({ primary: '#1D4ED8', secondary: '#93C5FD', accent: '#0EA5E9', background: '#1E3A8A', surface: '#FFFFFF', textPrimary: '#0F172A', textSecondary: '#334155', border: '#BFDBFE' },
      { background: { type: 'image', imageUrl: `${MEDIA}/ocean-deep.jpg` }, buttons: { primaryStyle: 'filled', secondaryStyle: 'outline', radius: 999 }, mode: 'dark' }) },
  { key: 'launch-night', name: 'Launch Night', category: 'Dark', tags: ['Futuristic'], owner: 'Olivia Moore', status: 'draft', days: 8,
    tokens: T({ primary: '#A855F7', secondary: '#22D3EE', accent: '#F472B6', background: '#0B0B14', surface: '#151524', textPrimary: '#F8FAFC', textSecondary: '#CBD5E1', border: '#312E81' },
      { typography: { heading: 'Space Grotesk', body: 'Inter' }, buttons: { primaryStyle: 'outline', secondaryStyle: 'ghost', radius: 999 }, background: { type: 'image', imageUrl: `${MEDIA}/neon-night.jpg` }, mode: 'dark', preset: 'glass' }) },
  { key: 'gradient-purple', name: 'Gradient Purple', category: 'Vibrant', tags: ['Creator'], owner: 'Sophia Patel', status: 'active', days: 12,
    tokens: T({ primary: '#FFFFFF', secondary: '#A78BFA', accent: '#6D28D9', background: '#6D28D9', surface: '#FFFFFF', textPrimary: '#1E1B4B', textSecondary: '#4C1D95', border: '#DDD6FE' },
      { background: { type: 'gradient', imageUrl: null }, buttons: { primaryStyle: 'filled', secondaryStyle: 'outline', radius: 999 }, mode: 'dark' }) },
  { key: 'minimal-green', name: 'Minimal Green', category: 'Minimal', tags: ['Retail'], owner: 'Emma Davis', status: 'active', days: 14,
    tokens: T({ primary: '#1F3B2D', secondary: '#F59E0B', accent: '#15803D', background: '#0F1F17', surface: '#FFFFFF', textPrimary: '#0F1F17', textSecondary: '#3F5446', border: '#D1E0D6' },
      { background: { type: 'solid', imageUrl: null }, mode: 'dark' }) },
  { key: 'sunset', name: 'Sunset', category: 'Warm', tags: ['Promotional'], owner: 'Liam Chen', status: 'active', days: 16,
    tokens: T({ primary: '#E11D48', secondary: '#FDA4AF', accent: '#F97316', background: '#FCE7EF', surface: '#FFFFFF', textPrimary: '#3F0D1E', textSecondary: '#881337', border: '#FBCFE8' },
      { typography: { heading: 'Poppins', body: 'Inter' }, buttons: { primaryStyle: 'gradient', secondaryStyle: 'outline', radius: 999 } }) },
  { key: 'dark-mode', name: 'Dark Mode', category: 'Dark', tags: ['Tech'], owner: 'Olivia Moore', status: 'active', days: 18,
    tokens: T({ primary: '#FFFFFF', secondary: '#334155', accent: '#38BDF8', background: '#0A0A0A', surface: '#171717', textPrimary: '#FAFAFA', textSecondary: '#A3A3A3', border: '#262626' },
      { mode: 'dark', cards: { radius: 16, shadow: 'none' } }) },
  { key: 'botanical-breeze', name: 'Botanical Breeze', category: 'Natural', tags: ['Wellness'], owner: 'Ethan Roberts', status: 'draft', approval: 'pending', days: 0, hours: 1,
    tokens: T({ primary: '#166534', secondary: '#BBF7D0', accent: '#65A30D', background: '#F0FDF4', surface: '#FFFFFF', textPrimary: '#052E16', textSecondary: '#14532D', border: '#BBF7D0' }, { background: { type: 'image', imageUrl: `${MEDIA}/botanical.jpg` } }) },
  { key: 'neon-wave', name: 'Neon Wave', category: 'Vibrant', tags: ['Music'], owner: 'Sophia Patel', status: 'draft', approval: 'pending', days: 0, hours: 3,
    tokens: T({ primary: '#EC4899', secondary: '#8B5CF6', accent: '#22D3EE', background: '#1E0B3B', surface: '#2A1150', textPrimary: '#FDF4FF', textSecondary: '#E9D5FF', border: '#6B21A8' }, { mode: 'dark', background: { type: 'image', imageUrl: `${MEDIA}/neon-wave.jpg` } }) },
  { key: 'vintage-denim', name: 'Vintage Denim', category: 'Classic', tags: ['Fashion'], owner: 'Noah Williams', status: 'draft', approval: 'pending', days: 0, hours: 5,
    tokens: T({ primary: '#1E3A8A', secondary: '#BFDBFE', accent: '#B45309', background: '#E8EEF7', surface: '#FFFFFF', textPrimary: '#0B1B3F', textSecondary: '#334155', border: '#C7D2FE' }, { typography: { heading: 'Lora', body: 'DM Sans' }, background: { type: 'image', imageUrl: `${MEDIA}/denim.jpg` } }) },
  { key: 'soft-pastel', name: 'Soft Pastel', category: 'Soft', tags: ['Beauty'], owner: 'Olivia Moore', status: 'draft', approval: 'pending', days: 0, hours: 7,
    tokens: T({ primary: '#DB2777', secondary: '#FBCFE8', accent: '#A78BFA', background: '#FDF2F8', surface: '#FFFFFF', textPrimary: '#3B0A24', textSecondary: '#831843', border: '#FBCFE8' }, { background: { type: 'image', imageUrl: `${MEDIA}/pastel.jpg` } }) },
]

// ------------------------------------------------------------------- pages
const L = (title, url) => ({ title, url })
const PAGES = [
  { key: 'summer-launch', slug: 'summer-launch-2026', title: 'Summer Launch 2026', kind: 'link_page', owner: 'Emma Davis', status: 'published', theme: 'summer-glow',
    tags: ['Summer', 'Launch', 'Skincare'], created: 45, updated: 1, clicks: 12842, ctr: 6.31, image: 'summer-sand', domain: true, goal: 'sales', versions: 5,
    description: 'Glow. Hydrate. Repeat. Our most loved collection is back.',
    blocks: [
      { type: 'hero', config: { eyebrow: 'ACME', headline: 'Summer Launch 2026', subheadline: 'Glow. Hydrate. Repeat.', body: 'Our most loved collection is back.', imageUrl: `${MEDIA}/summer-sand.jpg` } },
      { type: 'links', children: [L('Shop Bestsellers', 'https://acme.com/bestsellers'), L('New Arrivals', 'https://acme.com/new'), L('Bundle & Save 20%', 'https://acme.com/bundles'), L('Skincare Quiz', 'https://acme.com/quiz'), L('Read Our Blog', 'https://acme.com/blog'), L('Find Us on Instagram', 'https://instagram.com/acme')], reusable: 'shop-bestsellers' },
      { type: 'product', product: 'Acme Hydrate Serum', config: { name: 'Acme Hydrate Serum', priceLabel: '£32.00', ctaLabel: 'Shop now', url: 'https://acme.com/products/hydrate-serum', imageUrl: `${MEDIA}/moisturizer.jpg` } },
      { type: 'form', form: 'Summer Launch Email Capture', config: { heading: 'Get 15% Off', body: 'Join our community for exclusive offers and skincare tips.', buttonLabel: 'Subscribe', consentText: 'No spam, unsubscribe anytime.' } },
      { type: 'social_proof', config: { quotes: [{ text: 'My skin has never felt this hydrated.', author: 'Priya S.' }, { text: 'The bundle is unbeatable value.', author: 'Marcus L.' }] } },
      { type: 'footer', is_active: false, config: { socials: [{ platform: 'instagram', url: 'https://instagram.com/acme' }, { platform: 'tiktok', url: 'https://tiktok.com/@acme' }], legalText: '© 2026 Acme Global' } },
    ] },
  { key: 'summer-sale-bio', slug: 'summer-sale', title: 'Summer Sale Bio Page', kind: 'conversion_page', owner: 'Liam Chen', status: 'published', theme: 'sunset',
    tags: ['Sale', 'Summer', 'Ecommerce'], created: 40, updated: 3, clicks: 8336, ctr: 5.61, image: 'sunglasses', goal: 'sales', versions: 3,
    description: 'Up to 40% off sunglasses and summer essentials.',
    blocks: [
      { type: 'hero', config: { eyebrow: 'ACME', headline: 'Summer Sale', subheadline: 'Up to 40% off', imageUrl: `${MEDIA}/sunglasses.jpg` } },
      { type: 'button_stack', children: [L('Shop Summer Sale', 'https://acme.com/summer-sale'), L('Bundle & Save 20%', 'https://acme.com/bundles')], reusable: 'summer-sale-cta' },
      { type: 'product', product: 'Acme Sunblock SPF 50', config: { name: 'Acme Sunblock SPF 50', priceLabel: '£18.00', ctaLabel: 'Add to Cart', url: 'https://acme.com/products/sunblock', imageUrl: `${MEDIA}/glow-bundle.jpg` } },
      { type: 'faq', config: { items: [{ q: 'When does the sale end?', a: 'The sale runs until stock lasts.' }, { q: 'Do you ship internationally?', a: 'Yes, to 40+ countries.' }] } },
      { type: 'footer', config: { socials: [], legalText: '© 2026 Acme Global' } },
    ] },
  { key: 'creator-hub', slug: 'creator-resource-hub', title: 'Creator Resource Hub', kind: 'link_page', owner: 'Sophia Patel', status: 'published', theme: 'gradient-purple',
    tags: ['Resources', 'Creators', 'Education'], created: 38, updated: 3, clicks: 6213, ctr: 3.11, image: 'creator-portrait', goal: 'clicks', versions: 2,
    description: 'Guides, templates and tools for creators.',
    blocks: [
      { type: 'hero', config: { eyebrow: 'ACME', headline: 'Resources for Creators', subheadline: 'Everything you need to grow', imageUrl: `${MEDIA}/creator-portrait.jpg` } },
      { type: 'links', children: [L('Creator starter guide', 'https://acme.com/creators/guide'), L('Brand deal templates', 'https://acme.com/creators/templates'), L('Pricing calculator', 'https://acme.com/creators/pricing'), L('Apply to partner', 'https://acme.com/creators/apply')], reusable: 'summer-sale-cta' },
      { type: 'footer', config: { socials: [], legalText: '© 2026 Acme Global' } },
    ] },
  { key: 'spring-drops', slug: 'spring-drops', title: 'Spring Product Drops', kind: 'link_page', owner: 'Emma Davis', status: 'published', theme: 'minimal-green',
    tags: ['Product', 'Spring', 'Shoes'], created: 60, updated: 2, clicks: 5439, ctr: 4.21, image: 'sneakers', goal: 'sales', versions: 3,
    description: 'The new runner range, dropping weekly.',
    blocks: [
      { type: 'hero', config: { eyebrow: 'ACME', headline: 'Spring Product Drops', subheadline: 'New runners every Friday', imageUrl: `${MEDIA}/sneakers.jpg` } },
      { type: 'links', children: [L('Shop the drop', 'https://acme.com/spring'), L('Acme Runner Pro', 'https://acme.com/products/runner-pro'), L('Acme Trail Shoe', 'https://acme.com/products/trail-shoe'), L('Size guide', 'https://acme.com/size-guide')] },
      { type: 'product', product: 'Acme Runner Pro', config: { name: 'Acme Runner Pro', priceLabel: '£120.00', ctaLabel: 'Shop now', url: 'https://acme.com/products/runner-pro', imageUrl: `${MEDIA}/sneakers.jpg` } },
    ] },
  { key: 'waitlist', slug: 'waitlist', title: 'Waitlist Signup', kind: 'conversion_page', owner: 'Noah Williams', status: 'published', theme: 'ocean-blue',
    tags: ['Waitlist', 'Product', 'Launch'], created: 34, updated: 6, clicks: 3114, ctr: 2.08, image: 'waitlist-sky', goal: 'waitlist', versions: 2,
    description: 'Be first to hear when we launch.',
    blocks: [
      { type: 'hero', config: { eyebrow: 'ACME', headline: 'Join the Waitlist', subheadline: 'Be first in line for launch day', imageUrl: `${MEDIA}/waitlist-sky.jpg` } },
      { type: 'form', form: 'Summer Launch Email Capture', config: { heading: 'Reserve your spot', body: 'We will email you the moment it goes live.', buttonLabel: 'Join waitlist', consentText: 'No spam, unsubscribe anytime.' } },
      { type: 'footer', config: { socials: [], legalText: '© 2026 Acme Global' } },
    ] },
  { key: 'app-launch', slug: 'app-launch', title: 'App Launch CTA', kind: 'link_page', owner: 'Olivia Moore', status: 'draft', theme: 'dark-mode',
    tags: ['App', 'Launch', 'CTA'], created: 20, updated: 8, clicks: 0, ctr: 4.0, image: 'app-phones', goal: 'downloads', versions: 1,
    description: 'The future of productivity.',
    blocks: [
      { type: 'hero', config: { eyebrow: 'ACME', headline: 'The Future of Productivity', subheadline: 'Download the new Acme app', imageUrl: `${MEDIA}/app-phones.jpg` } },
      { type: 'links', children: [L('Download on the App Store', 'https://apps.apple.com/app/acme-demo'), L('Get it on Google Play', 'https://play.google.com/store/apps/details?id=com.acme.demo')] },
    ] },
  { key: 'affiliate-toolkit', slug: 'affiliate-toolkit', title: 'Affiliate Toolkit', kind: 'link_page', owner: 'Ethan Roberts', status: 'in_review', approval: 'pending', theme: 'earth-tones',
    tags: ['Affiliate', 'Partner', 'Toolkit'], created: 25, updated: 10, clicks: 1804, ctr: 2.2, image: 'plant-interior', goal: 'clicks', versions: 2,
    description: 'Partner with Acme and earn on every sale.',
    blocks: [
      { type: 'hero', config: { eyebrow: 'ACME', headline: 'Partner with Acme', subheadline: 'Assets, links and payouts', imageUrl: `${MEDIA}/plant-interior.jpg` } },
      { type: 'links', children: [L('Affiliate terms', 'https://acme.com/affiliates/terms'), L('Download brand assets', 'https://acme.com/affiliates/assets'), L('Old commission sheet', 'https://acme.com/affiliates/commissions-2024')], broken: 2 },
    ] },
  { key: 'skincare-quiz', slug: 'skincare-quiz', title: 'Skincare Quiz', kind: 'link_page', owner: 'Emma Davis', status: 'published', theme: 'summer-glow',
    tags: ['Quiz', 'Skincare'], created: 30, updated: 4, clicks: 8741, ctr: 5.1, image: 'skincare-bottles', goal: 'leads', versions: 2,
    description: 'Find your perfect routine in 60 seconds.',
    blocks: [
      { type: 'hero', config: { eyebrow: 'ACME', headline: 'Skincare Quiz', subheadline: 'Find your routine in 60 seconds', imageUrl: `${MEDIA}/skincare-bottles.jpg` } },
      { type: 'links', children: [L('Start the quiz', 'https://acme.com/quiz'), L('Shop routines', 'https://acme.com/routines')] },
    ] },
  { key: 'glow-bundle', slug: 'glow-bundle', title: 'Glow Bundle Promo', kind: 'link_page', owner: 'Sophia Patel', status: 'published', theme: 'summer-glow',
    tags: ['Bundle', 'Promo'], created: 22, updated: 5, clicks: 6310, ctr: 6.2, image: 'glow-bundle', goal: 'sales', versions: 2,
    description: 'Three bestsellers, one price.',
    blocks: [
      { type: 'hero', config: { eyebrow: 'ACME', headline: 'Glow Bundle', subheadline: 'Three bestsellers, one price', imageUrl: `${MEDIA}/glow-bundle.jpg` } },
      { type: 'links', children: [L('Shop the bundle', 'https://acme.com/bundles/glow')] },
    ] },
  { key: 'influencer-toolkit', slug: 'influencer-toolkit', title: 'Influencer Toolkit', kind: 'link_page', owner: 'Liam Chen', status: 'published', theme: 'creator-pop',
    tags: ['Influencer'], created: 28, updated: 7, clicks: 2789, ctr: 6.68, image: 'influencer', goal: 'clicks', versions: 1,
    description: 'Everything our creator partners need.',
    blocks: [
      { type: 'hero', config: { eyebrow: 'ACME', headline: 'Create. Connect. Grow.', subheadline: 'Resources for our partners', imageUrl: `${MEDIA}/influencer.jpg` } },
      { type: 'links', children: [L('Summer Sale link', 'https://acme.com/summer-sale'), L('Content guidelines', 'https://acme.com/partners/guidelines')], reusable: 'summer-sale-cta' },
    ] },
  { key: 'summer-sale-2026', slug: 'summer-sale-2026', title: 'Summer Sale 2026', kind: 'conversion_page', owner: 'Liam Chen', status: 'published', theme: 'sunset',
    tags: ['Sale'], created: 21, updated: 7, clicks: 5212, ctr: 6.31, image: 'sunglasses', goal: 'sales', versions: 1,
    description: 'Limited-time summer offers.',
    blocks: [
      { type: 'hero', config: { eyebrow: 'ACME', headline: 'Summer Sale 2026', subheadline: 'Limited time only', imageUrl: `${MEDIA}/sunglasses.jpg` } },
      { type: 'button_stack', children: [L('Shop Summer Sale', 'https://acme.com/summer-sale')], reusable: 'summer-sale-cta' },
    ] },
  { key: 'cart-checkout', slug: 'cart-checkout', title: 'Cart / Checkout', kind: 'conversion_page', owner: null, status: 'published', theme: 'minimal-mono',
    tags: ['Checkout'], created: 21, updated: 7, clicks: 3120, ctr: 4.27, image: 'workspace', goal: 'sales', versions: 1,
    description: 'Complete your order.',
    blocks: [
      { type: 'hero', config: { eyebrow: 'ACME', headline: 'Your cart is waiting', subheadline: 'Complete your order in one tap', imageUrl: `${MEDIA}/workspace.jpg` } },
      { type: 'button_stack', children: [L('Return to checkout', 'https://acme.com/summer-sale')], reusable: 'summer-sale-cta' },
    ] },
  { key: 'spring-sale-2025', slug: 'spring-sale-2025', title: 'Spring Sale 2025', kind: 'link_page', owner: 'Emma Davis', status: 'archived', theme: 'minimal-green',
    tags: ['Archive'], created: 200, updated: 120, clicks: 0, ctr: 3.2, image: 'sneakers', goal: 'sales', versions: 2,
    description: 'Last year\'s spring campaign.',
    blocks: [{ type: 'hero', config: { eyebrow: 'ACME', headline: 'Spring Sale 2025', subheadline: 'This offer has ended', imageUrl: `${MEDIA}/sneakers.jpg` } }] },
]

// ----------------------------------------------------------- reusable links
const REUSABLE = [
  { key: 'summer-sale-cta', name: 'Summer Sale CTA', slug: 'summer-sale-cta', destination: 'https://acme.com/summer-sale', label: 'Shop Summer Sale', owner: 'Sophia Patel', status: 'active',
    utm: { source: 'linkinbio', medium: 'link', campaign: 'summer_sale_2026' }, redirect: 301, cloaking: true, created: 20, updated: 1, clicks: 12842, versions: 5, tags: ['summer-sale', 'cta'] },
  { key: 'summer-glow-collection', name: 'Summer Glow Collection', slug: 'summer-glow', destination: 'https://acme.com/collections/summer-glow', label: 'Shop the Summer Glow Collection', owner: 'Sophia Patel', status: 'active',
    utm: { source: 'instagram', medium: 'social', campaign: 'summer-launch-2026', content: 'story-1' }, redirect: 302, created: 12, updated: 2, clicks: 4210, versions: 2, tags: ['summer-launch', 'collection', 'paid-social'],
    rules: [{ id: 'd1', type: 'device', devices: ['mobile'], destination: 'https://acme.com/m/collections/summer-glow' }, { id: 'c1', type: 'country', countries: ['US'], destination: 'https://acme.com/us/collections/summer-glow' }], fallback: 'https://acme.com' },
  { key: 'shop-bestsellers', name: 'Shop Bestsellers', slug: 'bestsellers', destination: 'https://acme.com/bestsellers', label: 'Shop Bestsellers', owner: 'Emma Davis', status: 'active',
    utm: { source: 'linkinbio', medium: 'link', campaign: 'always_on' }, redirect: 302, created: 50, updated: 9, clicks: 3920, versions: 1, tags: ['evergreen'] },
  { key: 'podcast', name: 'Acme Podcast Episode 12', slug: 'podcast-12', destination: 'https://podcasts.acme.com/episodes/12', label: 'Listen now', owner: 'Noah Williams', status: 'active',
    utm: { source: 'linkinbio', medium: 'link', campaign: 'podcast' }, redirect: 302, created: 30, updated: 15, clicks: 846, versions: 1, tags: ['podcast'] },
  { key: 'app-store', name: 'App Store Download', slug: 'get-the-app', destination: 'https://apps.apple.com/app/acme-demo-removed', label: 'Download the app', owner: 'Olivia Moore', status: 'active',
    utm: {}, redirect: 302, created: 40, updated: 20, clicks: 512, versions: 1, tags: ['app'], broken: true },
  { key: 'spring-drop-2025', name: 'Spring Drop 2025', slug: 'spring-drop-2025', destination: 'https://acme.com/spring-2025', label: 'Spring drop', owner: 'Emma Davis', status: 'expired',
    utm: { source: 'linkinbio', medium: 'link', campaign: 'spring_2025' }, redirect: 302, created: 200, updated: 120, clicks: 0, versions: 1, tags: ['archive'], scheduledEnd: 120 },
]

// ---------------------------------------------------------------- helpers
async function must(promise, label) {
  const { data, error } = await promise
  if (error) throw new Error(`${label}: ${error.message}`)
  return data
}

async function insertChunks(table, rows, size = 1000) {
  for (let i = 0; i < rows.length; i += size) await must(admin.from(table).insert(rows.slice(i, i + size)), `insert ${table}`)
}

const visitorHash = seed => createHash('sha256').update(`demo-visitor-${seed}`).digest('hex').slice(0, 32)

async function seedWorkspace(workspaceId, index) {
  const rand = mulberry32(20260917 + index)
  const wobble = (day, phase) => Math.max(0.2, 1 + 0.32 * Math.sin(day / 2.4 + phase) + 0.18 * Math.sin(day / 6.3 + phase * 2) + (rand() - 0.5) * 0.22)

  const workspace = await must(admin.from('workspaces').select('id, name, type, owner_id').eq('id', workspaceId).single(), 'workspace')
  console.log(`\n== ${workspace.name} (${workspace.type})`)

  const members = await must(admin.from('workspace_members').select('user_id, profiles!workspace_members_user_id_fkey(full_name)').eq('workspace_id', workspaceId), 'members')
  const byName = new Map(members.map(m => [m.profiles?.full_name, m.user_id]))
  const fallbackOwner = workspace.owner_id ?? members[0]?.user_id
  const person = name => (name && byName.get(name)) || fallbackOwner

  // ---- cleanup (cascades remove items, versions, rollups, pixels)
  const demoPages = await must(admin.from('link_pages').select('id').eq('workspace_id', workspaceId).eq('is_demo', true), 'demo pages')
  const demoLinks = await must(admin.from('reusable_links').select('id').eq('workspace_id', workspaceId).eq('is_demo', true), 'demo links')
  const pageIds = demoPages.map(p => p.id), linkIds = demoLinks.map(l => l.id)
  if (pageIds.length) await must(admin.from('link_analytics_events').delete().in('page_id', pageIds), 'clean page events')
  if (linkIds.length) await must(admin.from('link_analytics_events').delete().in('reusable_link_id', linkIds), 'clean link events')
  await must(admin.from('link_pages').delete().eq('workspace_id', workspaceId).eq('is_demo', true), 'clean pages')
  await must(admin.from('reusable_links').delete().eq('workspace_id', workspaceId).eq('is_demo', true), 'clean links')
  await must(admin.from('link_themes').delete().eq('workspace_id', workspaceId).eq('is_demo', true), 'clean themes')
  await must(admin.from('link_activity').delete().eq('workspace_id', workspaceId).contains('meta', { demo: true }), 'clean activity')
  await must(admin.from('link_domains').delete().eq('workspace_id', workspaceId), 'clean domains')
  await must(admin.from('web_forms').delete().eq('workspace_id', workspaceId).eq('destination_label', 'Link in Bio (demo)'), 'clean forms')

  // ---- domain
  const primary = workspaceId === DEFAULT_WORKSPACES[0]
  const suffix = workspaceId.slice(0, 4)
  const hostname = primary ? 'link.acme.com' : `link-${suffix}.acme.com`
  const domain = await must(admin.from('link_domains').insert({
    workspace_id: workspaceId, hostname, status: 'verified', verification_token: randomBytes(16).toString('hex'),
    verified_at: ago(40), last_checked_at: ago(0, 2), created_by: fallbackOwner,
  }).select('id').single(), 'domain')

  // ---- form (canonical Web & Conversion form engine)
  const form = await must(admin.from('web_forms').insert({
    workspace_id: workspaceId, name: 'Summer Launch Email Capture', form_type: 'subscription', status: 'published', owner_id: person('Emma Davis'),
    destination_label: 'Link in Bio (demo)', fields: [{ id: 'email', type: 'email', label: 'Email address', required: true }],
    confirmation_message: 'Thanks! Check your inbox for your 15% code.', submissions_count: 1842, completed_count: 1842,
  }).select('id').single(), 'form')

  const products = await must(admin.from('products').select('id, name').eq('workspace_id', workspaceId), 'products')
  const productByName = new Map(products.map(p => [p.name, p.id]))
  const campaigns = await must(admin.from('campaigns').select('id, name').eq('workspace_id', workspaceId).is('archived_at', null).limit(3), 'campaigns')

  // ---- themes + versions
  const themeIds = {}
  for (const theme of THEMES) {
    const row = await must(admin.from('link_themes').insert({
      workspace_id: workspaceId, name: theme.name, category: theme.category, tags: theme.tags, owner_id: person(theme.owner),
      status: theme.status, approval_status: theme.approval ?? (theme.status === 'active' ? 'approved' : 'none'),
      tokens: theme.tokens, description: `${theme.name} — ${theme.category.toLowerCase()} theme for ${theme.tags[0].toLowerCase()} pages.`,
      published_version: theme.status === 'active' ? 3 : null, visibility: 'team', is_demo: true,
      created_by: person(theme.owner), updated_by: person(theme.owner),
      created_at: ago(theme.days + 60), updated_at: ago(theme.days, theme.hours ?? 0),
    }).select('id').single(), `theme ${theme.name}`)
    themeIds[theme.key] = row.id
    if (theme.status === 'active') {
      const notes = ['Initial theme release', 'Button styles update', 'Typography scale', 'Color + card updates']
      const who = ['Liam Chen', 'Noah Williams', 'Sophia Patel', theme.owner]
      await must(admin.from('link_theme_versions').insert([1, 2, 3, 4].map(v => ({
        theme_id: row.id, workspace_id: workspaceId, version: v, tokens: theme.tokens, published: v === 4,
        status: v === 4 ? 'published' : 'superseded', change_summary: notes[v - 1], created_by: person(who[v - 1]),
        created_at: ago(theme.days + (4 - v)),
      }))), 'theme versions')
    }
  }

  // ---- reusable links + versions
  const linkIdByKey = {}
  for (const link of REUSABLE) {
    const row = await must(admin.from('reusable_links').insert({
      workspace_id: workspaceId, name: link.name, destination_url: link.destination, vanity_slug: primary ? link.slug : `${link.slug}-${suffix}`,
      label: link.label, utm: link.utm, status: link.status, redirect_type: link.redirect, cloaking: !!link.cloaking,
      rules: link.rules ?? [], fallback_url: link.fallback ?? null, owner_id: person(link.owner), tags: link.tags,
      click_count: link.clicks, current_version: link.versions, check_status: link.broken ? 'broken' : 'healthy', checked_at: ago(0, 6),
      scheduled_end: link.scheduledEnd ? ago(link.scheduledEnd) : null, campaign_id: campaigns[0]?.id ?? null,
      last_used_at: link.clicks ? ago(0, 3, 12) : null, is_demo: true,
      created_by: person(link.owner), updated_by: person(link.owner), created_at: ago(Math.max(link.created, 62)), updated_at: ago(link.updated, 1),
    }).select('id').single(), `link ${link.name}`)
    linkIdByKey[link.key] = row.id
    const notes = ['Re-usable link created', 'Initial rules setup', 'Redirect behaviour', 'Destination URL update', 'UTM update']
    const who = ['Emma Davis', 'Liam Chen', 'Liam Chen', link.owner, link.owner]
    await must(admin.from('reusable_link_versions').insert(Array.from({ length: link.versions }, (_, i) => ({
      link_id: row.id, workspace_id: workspaceId, version: i + 1, change_summary: notes[i] ?? 'Update', status: i + 1 === link.versions ? 'published' : 'superseded',
      snapshot: { name: link.name, destination_url: link.destination, utm: link.utm }, created_by: person(who[i]), created_at: ago(link.created - Math.round((link.created - link.updated) * (i / Math.max(1, link.versions - 1)))),
    }))), 'link versions')
  }

  // ---- pages, blocks, versions, pixels
  const pageMeta = []
  for (const page of PAGES) {
    const owner = page.owner ? person(page.owner) : fallbackOwner
    const row = await must(admin.from('link_pages').insert({
      workspace_id: workspaceId, slug: primary ? page.slug : `${page.slug}-${suffix}`, title: page.title, description: page.description,
      page_kind: page.kind, goal: page.goal, status: page.status, approval_status: page.approval ?? (page.status === 'published' ? 'approved' : 'none'),
      theme_id: themeIds[page.theme], owner_id: owner, created_by: owner, updated_by: owner, tags: page.tags,
      domain_id: page.domain ? domain.id : null, campaign_id: campaigns[PAGES.indexOf(page) % Math.max(1, campaigns.length)]?.id ?? null,
      published_at: page.status === 'published' ? ago(page.updated) : null, published_version: page.status === 'published' ? page.versions : null,
      current_version: page.versions, seo_title: page.title, seo_description: page.description, og_image: `${MEDIA}/${page.image}.jpg`,
      legal: { privacyUrl: 'https://acme.com/privacy', termsUrl: 'https://acme.com/terms' }, consent: { banner: true },
      archived_at: page.status === 'archived' ? ago(page.updated) : null,
      total_clicks: page.clicks, total_views: page.clicks ? Math.round(page.clicks / (page.ctr / 100)) : 0, is_demo: true,
      created_at: ago(Math.max(page.created, 62)), updated_at: ago(page.updated, 2),
    }).select('id').single(), `page ${page.title}`)

    const items = []
    for (const [blockIndex, block] of page.blocks.entries()) {
      const config = { ...(block.config ?? {}) }
      if (block.product) config.productId = productByName.get(block.product) ?? null
      if (block.form) config.formId = form.id
      const blockRow = await must(admin.from('link_page_items').insert({
        page_id: row.id, workspace_id: workspaceId, item_type: block.type, sort_order: blockIndex,
        is_active: block.is_active ?? true, config, title: null,
      }).select('id').single(), 'block')
      for (const [childIndex, child] of (block.children ?? []).entries()) {
        const broken = block.broken === childIndex
        const childRow = await must(admin.from('link_page_items').insert({
          page_id: row.id, workspace_id: workspaceId, parent_id: blockRow.id, item_type: 'link', title: child.title, url: child.url,
          sort_order: childIndex, is_active: true, reusable_link_id: childIndex === 0 && block.reusable ? linkIdByKey[block.reusable] : null,
          check_status: broken ? 'broken' : 'healthy', checked_at: ago(0, 5), config: {},
          schedule_end: page.key === 'summer-launch' && childIndex === 2 ? new Date(now + 21 * DAY).toISOString() : null,
        }).select('id').single(), 'child link')
        items.push(childRow.id)
      }
    }

    const notes = ['Initial page', 'Reordered links', 'Pixel + SEO meta', 'New product card', 'Hero + CTA update', '3 blocks edited']
    const who = ['Emma Davis', 'Emma Davis', 'Liam Chen', 'Noah Williams', 'Sophia Patel', page.owner]
    await must(admin.from('link_page_versions').insert(Array.from({ length: page.versions }, (_, i) => {
      const v = i + 1, latest = v === page.versions
      return {
        page_id: row.id, workspace_id: workspaceId, version: v, published: latest && page.status === 'published',
        status: latest ? (page.status === 'published' ? 'published' : 'draft') : v === page.versions - 1 ? 'approved' : v === 1 && page.versions > 3 ? 'restored' : 'superseded',
        change_summary: page.versions === 1 ? 'Initial page' : notes[Math.min(notes.length - 1, i + Math.max(0, 6 - page.versions))],
        snapshot: { title: page.title, blocks: page.blocks.length }, created_by: person(who[Math.min(who.length - 1, i + Math.max(0, 6 - page.versions))]),
        published_at: latest && page.status === 'published' ? ago(page.updated) : null,
        created_at: ago(page.updated + (page.versions - v) * 1.2),
      }
    })), 'page versions')

    if (page.status === 'published') {
      const snapshot = await must(admin.rpc('link_page_build_snapshot', { p_page_id: row.id }), 'snapshot')
      await must(admin.from('link_page_versions').update({ snapshot }).eq('page_id', row.id).eq('published', true), 'publish snapshot')
    }

    if (page.key === 'summer-launch' || page.key === 'summer-sale-bio') {
      await must(admin.from('link_page_pixels').insert([
        { workspace_id: workspaceId, page_id: row.id, provider: 'meta', pixel_id: '1234567890123456', consent_category: 'marketing', approval_status: 'approved', last_event_at: ago(0, 1), created_by: owner },
        { workspace_id: workspaceId, page_id: row.id, provider: 'google_analytics', pixel_id: 'G-ACME2026X1', consent_category: 'analytics', approval_status: 'approved', last_event_at: ago(0, 1), created_by: owner },
      ]), 'pixels')
    }
    pageMeta.push({ ...page, id: row.id, items })
  }

  // ---- analytics rollups: 60 complete days
  const DEVICE = [['mobile', 0.654], ['desktop', 0.253], ['tablet', 0.079], ['other', 0.014]]
  const SOURCE = [['social', 0.554], ['direct', 0.267], ['search', 0.127], ['email', 0.044], ['referral', 0.008]]
  const REFERRER = [['instagram.com', 0.442], ['t.co', 0.199], ['youtube.com', 0.12], ['facebook.com', 0.085], ['linktr.ee', 0.039]]
  const rollups = []
  const split = (total, shares) => {
    let left = total
    return shares.map(([key, share], i) => {
      const value = i === shares.length - 1 ? Math.max(0, left) : Math.round(total * share * (0.92 + rand() * 0.16))
      left -= value
      return [key, Math.max(0, value)]
    })
  }
  for (const page of pageMeta) {
    if (!page.clicks || page.status === 'draft' || page.status === 'archived') continue
    const phase = rand() * 6
    // Every published page carries a full 60 days so the previous-period
    // comparison is like-for-like rather than inflated by a partial window.
    const lifetime = 60
    for (let offset = 1; offset <= lifetime; offset++) {
      const day = londonDay(offset)
      const clicks = Math.max(0, Math.round((page.clicks / 30) * wobble(offset, phase)))
      const views = Math.round(clicks / (page.ctr / 100) * (0.94 + rand() * 0.12))
      const conversions = Math.round(clicks * (page.kind === 'conversion_page' ? 0.06 : 0.048) * (0.85 + rand() * 0.3))
      const productClicks = page.blocks.some(b => b.type === 'product') ? Math.round(clicks * 0.12) : 0
      const formSubmits = page.blocks.some(b => b.type === 'form') ? Math.round(conversions * 0.35) : 0
      const revenue = Math.round(conversions * (1500 + rand() * 900))
      for (const [source, share] of SOURCE) {
        const f = share
        rollups.push({ workspace_id: workspaceId, day, grain: 'total', page_id: page.id, dimension: source,
          views: Math.round(views * f), clicks: Math.round(clicks * f), product_clicks: Math.round(productClicks * f), form_submits: Math.round(formSubmits * f),
          conversions: Math.round(conversions * f), revenue_pence: Math.round(revenue * f), uniques: Math.round(clicks * 0.452 * f) })
      }
      for (const [device, value] of split(clicks, DEVICE)) rollups.push({ workspace_id: workspaceId, day, grain: 'device', page_id: page.id, dimension: device, clicks: value })
      for (const [host, value] of split(Math.round(clicks * 0.885), REFERRER)) rollups.push({ workspace_id: workspaceId, day, grain: 'referrer', page_id: page.id, dimension: host, clicks: value })
      if (page.items.length) {
        const weights = page.items.map((_, i) => 1 / (i + 1.4))
        const sum = weights.reduce((a, b) => a + b, 0)
        const itemTotal = clicks - productClicks
        page.items.forEach((itemId, i) => rollups.push({ workspace_id: workspaceId, day, grain: 'item', page_id: page.id, item_id: itemId, clicks: Math.round(itemTotal * weights[i] / sum) }))
      }
    }
  }
  const LINK_REFERRER = [['instagram.com', 0.336], ['link-in-bio', 0.256], ['direct', 0.165], ['facebook.com', 0.1], ['mail.google.com', 0.065]]
  for (const link of REUSABLE) {
    if (!link.clicks || link.status !== 'active') continue
    const id = linkIdByKey[link.key]
    const phase = rand() * 6
    for (let offset = 1; offset <= 60; offset++) {
      const day = londonDay(offset)
      const clicks = Math.round((link.clicks / 30) * wobble(offset, phase))
      for (const [source, share] of SOURCE) {
        rollups.push({ workspace_id: workspaceId, day, grain: 'total', reusable_link_id: id, dimension: source, clicks: Math.round(clicks * share), uniques: Math.round(clicks * 0.709 * share) })
      }
      for (const [device, value] of split(clicks, DEVICE)) rollups.push({ workspace_id: workspaceId, day, grain: 'device', reusable_link_id: id, dimension: device, clicks: value })
      for (const [host, value] of split(clicks, LINK_REFERRER)) rollups.push({ workspace_id: workspaceId, day, grain: 'referrer', reusable_link_id: id, dimension: host, clicks: value })
    }
  }
  await must(admin.from('link_analytics_rollups').delete().eq('workspace_id', workspaceId).is('page_id', null).is('reusable_link_id', null), 'clean orphan rollups')
  const ZERO = { page_id: null, reusable_link_id: null, item_id: null, dimension: null, views: 0, clicks: 0, product_clicks: 0, form_submits: 0, conversions: 0, revenue_pence: 0, uniques: 0 }
  await insertChunks('link_analytics_rollups', rollups.map(row => ({ ...ZERO, ...row })))

  // ---- a few raw events for today (not yet rolled up)
  const raw = []
  for (const page of pageMeta.filter(p => p.status === 'published').slice(0, 6)) {
    for (let i = 0; i < 12; i++) {
      raw.push({ workspace_id: workspaceId, page_id: page.id, event_type: 'page_view', device_type: i % 3 ? 'mobile' : 'desktop', source: 'social', referrer: 'instagram.com', visitor_hash: visitorHash(`${page.id}-${i}`), created_at: new Date(now - (i + 1) * 240000).toISOString() })
      if (i % 3 === 0) raw.push({ workspace_id: workspaceId, page_id: page.id, item_id: page.items[0] ?? null, event_type: 'link_click', device_type: 'mobile', source: 'social', referrer: 'instagram.com', visitor_hash: visitorHash(`${page.id}-${i}`), created_at: new Date(now - (i + 1) * 230000).toISOString() })
    }
  }
  if (raw.length) await insertChunks('link_analytics_events', raw.map(row => ({ item_id: null, ...row })))

  // ---- activity
  const P = key => pageMeta.find(p => p.key === key)
  const A = (actor, entityType, entity, action, summary, minutesAgo, meta = {}) => ({
    workspace_id: workspaceId, actor_id: actor ? person(actor) : null, entity_type: entityType, entity_id: entity?.id ?? null,
    entity_name: entity?.name ?? entity?.title ?? null, action, summary, meta: { demo: true, ...meta }, created_at: new Date(now - minutesAgo * 60000).toISOString(),
  })
  const theme = key => ({ id: themeIds[key], name: THEMES.find(t => t.key === key).name })
  const link = key => ({ id: linkIdByKey[key], name: REUSABLE.find(l => l.key === key).name })
  await insertChunks('link_activity', [
    A('Emma Davis', 'page', P('summer-launch'), 'published', 'published version 5', 42, { badge: 'Published', version: 5 }),
    A('Emma Davis', 'page', P('summer-sale-bio'), 'updated', 'updated', 2),
    A('Liam Chen', 'page', P('spring-drops'), 'published', 'published', 15, { badge: 'Published' }),
    A('Sophia Patel', 'page', P('creator-hub'), 'created', 'created', 32),
    A('Noah Williams', 'page', P('waitlist'), 'updated', 'updated', 60),
    A('Olivia Moore', 'page', P('affiliate-toolkit'), 'status_changed', 'changed status to Review for', 120, { badge: 'Review' }),
    A('Sophia Patel', 'page', P('summer-launch'), 'approved', 'approved version 4', 60 * 18, { badge: 'Approved', version: 4 }),
    A('Noah Williams', 'page', P('summer-launch'), 'edited', 'updated CTA buttons', 60 * 22, { badge: 'Edited' }),
    A('Liam Chen', 'pixel', P('summer-launch'), 'pixel_updated', 'updated Meta Pixel', 60 * 42, { badge: 'Pixel updated', pageId: P('summer-launch').id }),
    A(null, 'page', P('summer-launch'), 'autosaved', 'auto-saved changes', 60 * 42 + 1, { badge: 'System' }),
    A('Sophia Patel', 'reusable_link', link('summer-sale-cta'), 'utm_updated', 'updated UTM parameters', 60 * 3),
    A('Sophia Patel', 'reusable_link', link('summer-sale-cta'), 'destination_changed', 'updated destination URL', 60 * 3 + 1),
    A('Liam Chen', 'reusable_link', link('summer-sale-cta'), 'enabled', 'enabled link', 60 * 26),
    A('Emma Davis', 'reusable_link', link('summer-sale-cta'), 'created', 'created reusable link', 60 * 24 * 18),
    A(null, 'reusable_link', link('summer-sale-cta'), 'autosaved', 'auto-saved changes', 60 * 24 * 18 + 1),
    A('Emma Davis', 'theme', theme('summer-glow'), 'updated', 'updated color palette', 2, { themeActivity: true }),
    A('Noah Williams', 'theme', theme('ocean-blue'), 'updated', 'updated', 15, { themeActivity: true }),
    A('Sophia Patel', 'theme', theme('creator-pop'), 'updated', 'updated', 32, { themeActivity: true }),
    A('Olivia Moore', 'theme', theme('launch-night'), 'updated', 'updated', 60, { themeActivity: true }),
    A('Liam Chen', 'theme', theme('minimal-mono'), 'updated', 'updated', 120, { themeActivity: true }),
    A('Sophia Patel', 'theme', theme('summer-glow'), 'approved', 'approved version 4', 60 * 18),
    A('Noah Williams', 'theme', theme('summer-glow'), 'typography', 'adjusted typography scale', 60 * 22),
    A('Liam Chen', 'theme', theme('summer-glow'), 'buttons', 'updated button styles', 60 * 42),
    A(null, 'theme', theme('summer-glow'), 'autosaved', 'auto-saved changes', 60 * 42 + 1),
  ])

  console.log(`  themes ${THEMES.length}, pages ${PAGES.length}, reusable links ${REUSABLE.length}, rollup rows ${rollups.length}, raw events ${raw.length}`)
}

for (const [index, id] of workspaceIds.entries()) {
  try {
    await seedWorkspace(id, index)
  } catch (error) {
    console.error(`  FAILED: ${error.message}`)
    process.exitCode = 1
  }
}
