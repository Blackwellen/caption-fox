import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { SITE_URL } from '@/lib/marketing-links'

// The pricing page is a client component, so its metadata lives here.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { absolute: 'Pricing | Caption Fox' },
  description: 'Caption Fox plans for creators, growing teams and agencies. Start free, then upgrade to Creator Pro, Team or Agency — prices in GBP.',
  alternates: { canonical: '/pricing' },
  openGraph: { type: 'website', url: '/pricing', siteName: 'Caption Fox', title: 'Pricing | Caption Fox', locale: 'en_GB' },
}

export default function PricingLayout({ children }: { children: ReactNode }) {
  return children
}
