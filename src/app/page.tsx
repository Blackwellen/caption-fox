import type { Metadata } from 'next'
import dynamic from 'next/dynamic'
import { Caveat, Inter, Inter_Tight } from 'next/font/google'
import PublicNav from '@/components/marketing/PublicNav'
import PublicFooter from '@/components/marketing/PublicFooter'
import Hero from '@/components/home/Hero'
import OperatingLayers from '@/components/home/OperatingLayers'
import PlatformGrid from '@/components/home/PlatformGrid'
import { MotionRoot } from '@/components/home/motion'
import type { FaqItem, PricingCard } from '@/components/home/CommercialClose'
import type { IntegrationItem } from '@/components/home/SolutionsProof'
import { PLANS } from '@/lib/plans'
import { AUTH_LINKS, SITE_URL } from '@/lib/marketing-links'
import { PROVIDER_CAPABILITIES } from '@/lib/social/providers'
import { PROVIDER_LABELS, SOCIAL_PROVIDERS } from '@/types/social'

// Client-heavy, below-the-fold interactive demos are split into their own chunks.
const OperatingLoop = dynamic(() => import('@/components/home/OperatingLoop'))
const CampaignCommandCentre = dynamic(() => import('@/components/home/CampaignCommandCentre'))
const FoxAISection = dynamic(() => import('@/components/home/FoxAISection'))
const SolutionsProof = dynamic(() => import('@/components/home/SolutionsProof'))
const CommercialClose = dynamic(() => import('@/components/home/CommercialClose'))

const caveat = Caveat({ subsets: ['latin'], weight: '500', variable: '--font-caveat', display: 'swap', preload: false })
// Homepage-only typography matching the approved designs (Inter body, Inter Tight display).
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
const interTight = Inter_Tight({ subsets: ['latin'], weight: ['600', '700', '800'], variable: '--font-inter-tight', display: 'swap' })

const TITLE = 'Caption Fox | Marketing Operating System for Campaigns, Content & Growth'
const DESCRIPTION = 'Plan campaigns, create content, manage channels, coordinate creators and measure marketing performance with Caption Fox’s connected marketing operating system.'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: '/' },
  robots: { index: true, follow: true },
  openGraph: { type: 'website', url: '/', siteName: 'Caption Fox', title: TITLE, description: DESCRIPTION, locale: 'en_GB', images: [{ url: '/icon-512.png', width: 512, height: 512, alt: 'Caption Fox' }] },
  twitter: { card: 'summary', title: TITLE, description: DESCRIPTION, images: ['/icon-512.png'] },
}

// ── Canonical data → homepage view models (no duplicated pricing / channel config) ──
const CATEGORY: Record<string, string> = { youtube: 'Video', linkedin: 'Professional', pinterest: 'Discovery' }
const integrations: IntegrationItem[] = SOCIAL_PROVIDERS
  .filter((p) => PROVIDER_CAPABILITIES[p]?.connectAccount)
  .map((p) => ({ key: p, label: PROVIDER_LABELS[p], category: CATEGORY[p] ?? 'Social' }))
const channelNames = integrations.map((i) => i.label)
const channelSentence = channelNames.length > 1 ? `${channelNames.slice(0, -1).join(', ')} and ${channelNames.at(-1)}` : channelNames.join('')

const AUDIENCE: Record<string, string> = {
  free: 'For trying Caption Fox with one brand.',
  creator_pro: 'For creators and solo marketers.',
  team: 'For growing brands and marketing teams.',
  agency: 'For agencies and multi-brand operators.',
}
const pricingIds = ['free', 'creator_pro', 'team', 'agency'] as const
const plans: PricingCard[] = pricingIds.map((id) => {
  const p = PLANS[id]
  return {
    id,
    name: p.name,
    audience: AUDIENCE[id],
    monthly: p.monthly ?? 0,
    yearly: p.yearly ?? 0,
    features: p.features.slice(0, 5),
    recommended: id === 'team',
    cta: id === 'agency' ? { label: 'Talk to sales', href: '/contact' } : { label: 'Start free', href: AUTH_LINKS.startFree },
  }
})
const brandLimit = (n: number) => (n === -1 ? 'unlimited brands' : `${n} brand${n === 1 ? '' : 's'}`)

const faqs: FaqItem[] = [
  { q: 'What is a marketing operating system?', a: 'A marketing operating system connects planning, content creation, approvals, publishing, conversations and reporting in one place. Caption Fox keeps your campaigns, assets, channels, people and results linked, so work moves from idea to outcome without losing context.' },
  { q: 'What can Caption Fox replace?', a: 'Many teams juggle separate tools for content calendars, scheduling, approvals, creator briefs, social inboxes and reporting. Caption Fox brings these into one workspace. Whether it replaces a specific tool depends on the features you rely on — the Features page lists what is included today.' },
  { q: 'Can I manage more than one brand or client?', a: `Yes. Free includes ${brandLimit(PLANS.free.limits.brands)}, Creator Pro ${brandLimit(PLANS.creator_pro.limits.brands)}, Team ${brandLimit(PLANS.team.limits.brands)} and Agency ${brandLimit(PLANS.agency.limits.brands)}.` },
  { q: 'Which channels can Caption Fox connect to?', a: `You can connect ${channelSentence} accounts. What you can do on each channel (scheduling, replies, insights) depends on what that platform’s API supports.` },
  { q: 'How does Fox AI use workspace data?', a: `Fox AI is available to signed-in users and works from the context you give it. It drafts and suggests — it does not publish content, send replies or delete records on its own. Usage is metered per plan (for example, ${PLANS.free.limits.aiMonthly} AI requests a month on Free).` },
  { q: 'Can agencies manage multiple clients?', a: `Yes. The Agency plan includes ${brandLimit(PLANS.agency.limits.brands)} and unlimited seats, so each client can have its own brand space with separate content, approvals and reporting.` },
  { q: 'Can I use only part of Caption Fox?', a: 'Yes. Start with the part you need — for example the calendar and publishing — and add campaigns, creators, the inbox or analytics when you are ready. Everything stays connected as you grow.' },
  { q: 'How is my data protected?', a: 'Workspace data is separated using database row-level security, and connected social account credentials are stored encrypted. Our Data Processing Agreement and Privacy Policy explain how we handle personal data.' },
]

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'Organization', '@id': `${SITE_URL}/#organization`, name: 'Caption Fox', url: SITE_URL, logo: `${SITE_URL}/icon-512.png` },
    { '@type': 'WebSite', '@id': `${SITE_URL}/#website`, url: SITE_URL, name: 'Caption Fox', publisher: { '@id': `${SITE_URL}/#organization` }, inLanguage: 'en-GB' },
    {
      '@type': 'SoftwareApplication',
      name: 'Caption Fox',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      url: SITE_URL,
      description: DESCRIPTION,
      publisher: { '@id': `${SITE_URL}/#organization` },
      offers: { '@type': 'Offer', name: PLANS.free.name, price: '0', priceCurrency: 'GBP' },
    },
  ],
}

export default function HomePage() {
  return (
    <div className={`${caveat.variable} ${inter.variable} ${interTight.variable} cf-home`}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <noscript><style>{'.cf-reveal{opacity:1!important;transform:none!important}.cf-draw-wait{stroke-dashoffset:0!important}'}</style></noscript>
      <MotionRoot>
        <PublicNav />
        <main id="main-content" tabIndex={-1} className="outline-none">
          <Hero />
          <OperatingLoop />
          <OperatingLayers />
          <PlatformGrid />
          <CampaignCommandCentre />
          <FoxAISection />
          <SolutionsProof integrations={integrations} />
          <CommercialClose plans={plans} faqs={faqs} />
        </main>
        <PublicFooter showCta={false} />
      </MotionRoot>
    </div>
  )
}
