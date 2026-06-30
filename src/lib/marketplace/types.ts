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
