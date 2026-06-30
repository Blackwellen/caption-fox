export type SupplierType = 'freelancer' | 'ugc_creator' | 'ads_manager' | 'agency' | 'influencer'

export const SUPPLIER_TYPES: { id: SupplierType | 'all'; label: string; icon: string }[] = [
  { id: 'all', label: 'All', icon: '✨' },
  { id: 'ugc_creator', label: 'UGC creators', icon: '🎬' },
  { id: 'freelancer', label: 'Freelancers', icon: '🧑‍💻' },
  { id: 'ads_manager', label: 'Ads managers', icon: '📈' },
  { id: 'agency', label: 'Agencies', icon: '🏢' },
  { id: 'influencer', label: 'Influencers', icon: '⭐' },
]

export interface MarketplaceListing {
  id: string
  supplierName: string
  supplierType: SupplierType
  verified: boolean
  title: string
  summary: string
  category: string
  priceCents: number
  currency: string
  deliveryDays: number
  rating: number
  reviewsCount: number
  location: string
  gradient: string   // CSS gradient used as the card cover (no external image deps)
}

export function formatPrice(cents: number, currency = 'GBP'): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: 0 }).format(cents / 100)
}

export function typeLabel(t: SupplierType): string {
  return SUPPLIER_TYPES.find(s => s.id === t)?.label.replace(/s$/, '') ?? t
}

// Deterministic cover gradient for live listings (DB has no cover image yet).
export const CARD_GRADIENTS = [
  'linear-gradient(135deg,#f472b6,#db2777)', 'linear-gradient(135deg,#38bdf8,#1d4ed8)',
  'linear-gradient(135deg,#a78bfa,#7c3aed)', 'linear-gradient(135deg,#34d399,#059669)',
  'linear-gradient(135deg,#fbbf24,#f59e0b)', 'linear-gradient(135deg,#fb7185,#e11d48)',
  'linear-gradient(135deg,#60a5fa,#2563eb)', 'linear-gradient(135deg,#2dd4bf,#0d9488)',
]
export function gradientFor(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return CARD_GRADIENTS[h % CARD_GRADIENTS.length]
}
