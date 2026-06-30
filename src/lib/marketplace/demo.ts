import type { MarketplaceListing } from './types'

// DEMO listings for the marketplace scaffold so the premium UI renders before the
// marketplace_* tables are seeded. Replace with real Supabase data (see the
// 20260630010000_marketplace.sql migration) before launch.
export const DEMO_LISTINGS: MarketplaceListing[] = [
  { id: 'l1', supplierName: 'Mara Lewis', supplierType: 'ugc_creator', verified: true, title: 'Authentic UGC video for your product', summary: '3× 30s vertical videos, on-brand, ready for TikTok & Reels.', category: 'UGC Video', priceCents: 18000, currency: 'GBP', deliveryDays: 5, rating: 4.9, reviewsCount: 128, location: 'Manchester, UK', gradient: 'linear-gradient(135deg,#f472b6,#db2777)' },
  { id: 'l2', supplierName: 'Growth Lab', supplierType: 'ads_manager', verified: true, title: 'Meta & TikTok ads management', summary: 'Full-funnel paid social management with weekly reporting.', category: 'Paid Ads', priceCents: 90000, currency: 'GBP', deliveryDays: 30, rating: 4.8, reviewsCount: 64, location: 'London, UK', gradient: 'linear-gradient(135deg,#38bdf8,#1d4ed8)' },
  { id: 'l3', supplierName: 'Theo Brandt', supplierType: 'freelancer', verified: false, title: 'Social content design — 12 posts', summary: 'On-brand carousels and statics for a month of content.', category: 'Design', priceCents: 32000, currency: 'GBP', deliveryDays: 7, rating: 4.7, reviewsCount: 41, location: 'Bristol, UK', gradient: 'linear-gradient(135deg,#a78bfa,#7c3aed)' },
  { id: 'l4', supplierName: 'Northstar Agency', supplierType: 'agency', verified: true, title: 'Full social media management', summary: 'Strategy, content, scheduling and community management.', category: 'Management', priceCents: 150000, currency: 'GBP', deliveryDays: 30, rating: 5.0, reviewsCount: 23, location: 'Leeds, UK', gradient: 'linear-gradient(135deg,#34d399,#059669)' },
  { id: 'l5', supplierName: 'Priya K', supplierType: 'influencer', verified: true, title: 'Sponsored Reel to 180k followers', summary: 'Beauty & lifestyle audience, UK-based, high engagement.', category: 'Influencer', priceCents: 60000, currency: 'GBP', deliveryDays: 10, rating: 4.9, reviewsCount: 87, location: 'Birmingham, UK', gradient: 'linear-gradient(135deg,#fbbf24,#f59e0b)' },
  { id: 'l6', supplierName: 'Sam Okafor', supplierType: 'ugc_creator', verified: false, title: 'Unboxing & review UGC bundle', summary: '5 product videos with hooks tailored to your offer.', category: 'UGC Video', priceCents: 25000, currency: 'GBP', deliveryDays: 6, rating: 4.6, reviewsCount: 52, location: 'Glasgow, UK', gradient: 'linear-gradient(135deg,#fb7185,#e11d48)' },
  { id: 'l7', supplierName: 'PixelPilot', supplierType: 'ads_manager', verified: true, title: 'Google & YouTube ads sprint', summary: '2-week sprint to launch and optimise paid search & video.', category: 'Paid Ads', priceCents: 70000, currency: 'GBP', deliveryDays: 14, rating: 4.8, reviewsCount: 39, location: 'Remote', gradient: 'linear-gradient(135deg,#60a5fa,#2563eb)' },
  { id: 'l8', supplierName: 'Studio Verde', supplierType: 'agency', verified: true, title: 'Brand & content refresh', summary: 'Visual identity refresh plus a 30-day content kit.', category: 'Branding', priceCents: 120000, currency: 'GBP', deliveryDays: 21, rating: 4.9, reviewsCount: 31, location: 'London, UK', gradient: 'linear-gradient(135deg,#2dd4bf,#0d9488)' },
]

export function getDemoListing(id: string): MarketplaceListing | undefined {
  return DEMO_LISTINGS.find(l => l.id === id)
}
