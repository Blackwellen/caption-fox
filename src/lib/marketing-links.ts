// Canonical public-site link registry. Every href here resolves to a real,
// shipped route (or an in-page anchor on the homepage). Do not add a link
// without shipping its destination — withhold it instead.

export interface MarketingLink {
  label: string
  href: string
  description?: string
}

export const AUTH_LINKS = {
  signIn: '/login',
  startFree: '/signup',
} as const

/** Deep links land on the matching section of /features (sections carry these ids). */
export const PRODUCT_LINKS: MarketingLink[] = [
  { label: 'Campaigns', href: '/features#campaigns', description: 'Plan, run and track campaigns end to end' },
  { label: 'Studio', href: '/features#ai', description: 'Create on-brand content with Fox AI' },
  { label: 'Social', href: '/features#calendar', description: 'Plan, schedule and publish across channels' },
  { label: 'Creators & UGC', href: '/features#ugc', description: 'Brief creators and review submissions' },
  { label: 'Messaging', href: '/features#inbox', description: 'Comments, mentions and DMs in one inbox' },
  { label: 'Analytics', href: '/features#analytics', description: 'See what is working across every channel' },
  { label: 'Approvals & teams', href: '/features#team', description: 'Roles, reviews and sign-off' },
  { label: 'Fox AI', href: '/features#ai', description: 'AI inside the work, not a separate chatbot' },
]

export const SOLUTION_LINKS: MarketingLink[] = [
  { label: 'Brands', href: '/#solutions-brands', description: 'Coordinate campaigns across teams and channels' },
  { label: 'Agencies', href: '/#solutions-agencies', description: 'Run many clients from one workspace' },
  { label: 'Businesses', href: '/#solutions-businesses', description: 'Stay visible without a big team' },
  { label: 'Creators', href: '/#solutions-creators', description: 'Plan, publish and grow your channels' },
]

export const MARKETPLACE_LINKS: MarketingLink[] = [
  { label: 'Marketplace home', href: '/marketplace' },
  { label: 'Become a supplier', href: '/marketplace/sell' },
]

export const RESOURCE_LINKS: MarketingLink[] = [
  { label: 'Blog', href: '/blog', description: 'Guides and ideas for modern marketing teams' },
  { label: 'Help Centre', href: '/help', description: 'Answers and how-tos' },
  { label: 'Changelog', href: '/changelog', description: 'What shipped recently' },
  { label: 'Roadmap', href: '/roadmap', description: 'What we are working on next' },
  { label: 'Status', href: '/status', description: 'Service availability' },
]

export const COMPANY_LINKS: MarketingLink[] = [
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
  { label: 'Careers', href: '/careers' },
  { label: 'Press', href: '/press' },
  { label: 'Affiliates', href: '/affiliates' },
]

export const LEGAL_LINKS: MarketingLink[] = [
  { label: 'Privacy', href: '/legal/privacy' },
  { label: 'Terms', href: '/legal/terms' },
  { label: 'Cookies', href: '/legal/cookie-policy' },
  { label: 'DPA', href: '/legal/dpa' },
  { label: 'Acceptable use', href: '/legal/acceptable-use' },
]

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://caption-fox.vercel.app').replace(/\/$/, '')
