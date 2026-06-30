// Client-safe affiliate helpers/types (two-tier programme).

export interface Affiliate {
  id: string
  user_id: string
  code: string
  parent_affiliate_id: string | null
  status: 'active' | 'suspended'
  payout_email: string | null
  created_at: string
}

export interface AffiliateReferral {
  id: string
  affiliate_id: string
  kind: 'customer' | 'affiliate'
  referred_user_id: string | null
  referred_email: string | null
  status: 'pending' | 'converted' | 'cancelled'
  commission_cents: number
  created_at: string
}

// Commission model (tune to stay profitable):
export const DIRECT_COMMISSION_RATE = 0.30   // 30% of a referred customer's first payment
export const OVERRIDE_COMMISSION_RATE = 0.10 // 10% override on a sub-affiliate's sales

export function makeAffiliateCode(email?: string | null): string {
  const base = (email?.split('@')[0] ?? 'fox').replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 8) || 'fox'
  const suffix = Math.random().toString(36).slice(2, 6)
  return `${base}${suffix}`
}

export function referralLink(appUrl: string, code: string): string {
  return `${appUrl.replace(/\/$/, '')}/?ref=${code}`
}

export function formatGBP(cents: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(cents / 100)
}
