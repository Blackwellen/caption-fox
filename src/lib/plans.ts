// Canonical plan + entitlement config — the SINGLE source of truth.
// Pricing page, onboarding, billing, and server-side gates should all read from here.
// (Stripe price IDs are filled in once you create products in Stripe — see PRICE_IDS.)

export type PlanId = 'free' | 'creator_pro' | 'team' | 'agency' | 'enterprise'

export interface PlanLimits {
  brands: number          // -1 = unlimited
  seats: number
  aiMonthly: number       // AI generations/messages per month per workspace
  scheduledPostsMonthly: number
}

export interface Plan {
  id: PlanId
  name: string
  monthly: number | null  // GBP/month; null = "contact us"
  yearly: number | null   // GBP/month billed annually
  limits: PlanLimits
  features: string[]
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: 'free', name: 'Free', monthly: 0, yearly: 0,
    limits: { brands: 1, seats: 1, aiMonthly: 5, scheduledPostsMonthly: 3 },
    features: ['1 brand', '3 scheduled posts/mo', 'Fox AI (5/mo)', '1 team member'],
  },
  creator_pro: {
    id: 'creator_pro', name: 'Creator Pro', monthly: 29, yearly: 23,
    limits: { brands: 3, seats: 1, aiMonthly: 200, scheduledPostsMonthly: -1 },
    features: ['3 brands', 'Unlimited posts', 'Fox AI (200/mo)', 'Calendar', 'Link in bio'],
  },
  team: {
    id: 'team', name: 'Team', monthly: 79, yearly: 63,
    limits: { brands: 10, seats: 5, aiMonthly: 1000, scheduledPostsMonthly: -1 },
    features: ['10 brands', '5 seats', 'Approvals', 'Campaigns', 'UGC', 'Reports', 'Fox AI (1,000/mo)'],
  },
  agency: {
    id: 'agency', name: 'Agency', monthly: 199, yearly: 159,
    limits: { brands: -1, seats: -1, aiMonthly: 5000, scheduledPostsMonthly: -1 },
    features: ['Unlimited brands', 'Unlimited seats', 'Social listening', 'Competitor analysis', 'White-label', 'Fox AI (fair-use)'],
  },
  enterprise: {
    id: 'enterprise', name: 'Enterprise', monthly: null, yearly: null,
    limits: { brands: -1, seats: -1, aiMonthly: -1, scheduledPostsMonthly: -1 },
    features: ['SSO/SAML', 'SCIM', 'DPA', 'Audit export', 'SLA', 'Dedicated support'],
  },
}

export const PLAN_ORDER: PlanId[] = ['free', 'creator_pro', 'team', 'agency', 'enterprise']

export function getPlan(id: string | null | undefined): Plan {
  return PLANS[(id as PlanId)] ?? PLANS.free
}

export function getPlanLimits(id: string | null | undefined): PlanLimits {
  return getPlan(id).limits
}

/** -1 means unlimited. Returns true if `used` is still within `limit`. */
export function withinLimit(used: number, limit: number): boolean {
  return limit === -1 || used < limit
}

// Stripe price IDs — fill these in after creating products in your Stripe dashboard.
// Then wire checkout/portal/webhook routes against them.
export const PRICE_IDS: Partial<Record<PlanId, { monthly?: string; yearly?: string }>> = {
  // creator_pro: { monthly: 'price_xxx', yearly: 'price_xxx' },
  // team:        { monthly: 'price_xxx', yearly: 'price_xxx' },
  // agency:      { monthly: 'price_xxx', yearly: 'price_xxx' },
}
