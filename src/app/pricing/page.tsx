'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  Check, X, Zap, Sparkles, BarChart2, Megaphone,
  ChevronDown, ChevronUp, ArrowRight, Shield, Users, Crown,
} from 'lucide-react'

/* ─── Types ──────────────────────────────────────────────── */
type FeatureValue = boolean | string | null

interface Plan {
  id: string
  name: string
  monthlyPrice: number | null
  yearlyPrice: number | null
  tagline: string
  cta: string
  ctaHref: string
  popular: boolean
  newBadge?: boolean
  features: string[]
  notIncluded: string[]
}

/* ─── Plan data ──────────────────────────────────────────── */
const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    monthlyPrice: 0,
    yearlyPrice: 0,
    tagline: 'Perfect for solo creators just getting started.',
    cta: 'Get started free',
    ctaHref: '/auth/signup?plan=free',
    popular: false,
    features: [
      '1 brand',
      '3 posts/month',
      'Basic calendar view',
      'Fox AI (5 generations/mo)',
      '1 team member',
    ],
    notIncluded: ['Analytics', 'Campaigns', 'UGC tools'],
  },
  {
    id: 'starter',
    name: 'Starter',
    monthlyPrice: 29,
    yearlyPrice: 23,
    tagline: 'For growing creators and solo marketers.',
    cta: 'Get Started',
    ctaHref: '/auth/signup?plan=starter',
    popular: false,
    features: [
      '2 brands',
      '30 posts/month',
      'Calendar (month/week/list)',
      'Fox AI (50 generations/mo)',
      'Basic analytics',
      '2 team members',
      'Email support',
    ],
    notIncluded: ['Approval workflows', 'Social Listening', 'Campaigns'],
  },
  {
    id: 'pro',
    name: 'Pro',
    monthlyPrice: 59,
    yearlyPrice: 47,
    tagline: 'For brands running campaigns and needing real depth.',
    cta: 'Get Started',
    ctaHref: '/auth/signup?plan=pro',
    popular: true,
    features: [
      '5 brands',
      'Unlimited posts',
      'Fox AI — unlimited',
      'AI image generation',
      'Full analytics (9 tabs)',
      'Campaigns (all 12 types)',
      'Giveaways & Competitions',
      'UGC workflows',
      'Approval workflows',
      'Hashtag Manager',
      'Up to 5 team members',
      'Link-in-Bio pages (1 page)',
    ],
    notIncluded: ['Social Listening', 'Competitor Analysis', 'Scheduled Reports'],
  },
  {
    id: 'team',
    name: 'Team',
    monthlyPrice: 99,
    yearlyPrice: 79,
    tagline: 'For teams needing collaboration and advanced insights.',
    cta: 'Get Started',
    ctaHref: '/auth/signup?plan=team',
    popular: false,
    features: [
      'Everything in Pro',
      '10 brands',
      'Social Listening (100 keywords)',
      'Competitor Analysis (5 competitors)',
      'Scheduled Email Reports',
      'Role-based permissions',
      'Custom approval workflows',
      'Link-in-Bio (5 pages)',
      'Up to 20 team members',
      'Priority support',
      'API access (coming soon)',
    ],
    notIncluded: [],
  },
  {
    id: 'agency',
    name: 'Agency',
    monthlyPrice: 199,
    yearlyPrice: 159,
    tagline: 'For agencies managing multiple clients at scale.',
    cta: 'Get Started',
    ctaHref: '/auth/signup?plan=agency',
    popular: false,
    newBadge: true,
    features: [
      'Everything in Team',
      'Unlimited brands',
      'Social Listening (500 keywords)',
      'Competitor Analysis (unlimited)',
      'White-label ready',
      'Unlimited team members',
      'Unlimited Link-in-Bio pages',
      'Bulk CSV import',
      'Dedicated onboarding',
      'API access',
      'Client reporting dashboard',
      'SLA: 99.9% uptime',
    ],
    notIncluded: [],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    monthlyPrice: null,
    yearlyPrice: null,
    tagline: 'Custom pricing for enterprise and regulated organisations.',
    cta: 'Contact Sales',
    ctaHref: '/contact',
    popular: false,
    features: [
      'Everything in Agency',
      'SSO (SAML/OIDC)',
      'Custom SLA',
      'Dedicated account manager',
      'Custom integrations',
      'Advanced compliance reporting',
      'Custom contract',
      'On-premise option',
    ],
    notIncluded: [],
  },
]

/* ─── Full comparison table data ─────────────────────────── */
interface ComparisonRow {
  label: string
  values: (FeatureValue)[]
}

interface ComparisonCategory {
  category: string
  rows: ComparisonRow[]
}

const COMPARISON: ComparisonCategory[] = [
  {
    category: 'Content & Scheduling',
    rows: [
      { label: 'Posts/month', values: ['3', '30', 'Unlimited', 'Unlimited', 'Unlimited', 'Unlimited'] },
      { label: 'Brands', values: ['1', '2', '5', '10', 'Unlimited', 'Unlimited'] },
      { label: 'Calendar views', values: ['Basic', 'Month/Week/List', 'Month/Week/List', 'Month/Week/List', 'Month/Week/List', 'Month/Week/List'] },
      { label: 'Bulk import (CSV)', values: [false, false, false, false, true, true] },
      { label: 'Content recycling', values: [false, false, true, true, true, true] },
    ],
  },
  {
    category: 'Fox AI',
    rows: [
      { label: 'AI generations/mo', values: ['5', '50', 'Unlimited', 'Unlimited', 'Unlimited', 'Unlimited'] },
      { label: 'AI image generation', values: [false, false, true, true, true, true] },
      { label: 'Caption styles', values: ['1', '3', 'All', 'All', 'All', 'All'] },
      { label: 'Hooks & scripts', values: [false, false, true, true, true, true] },
      { label: 'UGC briefs', values: [false, false, true, true, true, true] },
      { label: 'Reply drafts', values: [false, false, true, true, true, true] },
    ],
  },
  {
    category: 'Campaigns',
    rows: [
      { label: 'Campaign types', values: [false, false, '12', '12', '12', '12'] },
      { label: 'Giveaways', values: [false, false, true, true, true, true] },
      { label: 'Competitions', values: [false, false, true, true, true, true] },
      { label: 'UGC workflow', values: [false, false, true, true, true, true] },
      { label: 'Influencer campaigns', values: [false, false, true, true, true, true] },
    ],
  },
  {
    category: 'Analytics',
    rows: [
      { label: 'Analytics depth', values: [false, 'Basic', '9 tabs', '9 tabs', '9 tabs', '9 tabs'] },
      { label: 'Export reports', values: [false, false, true, true, true, true] },
      { label: 'Competitor analysis', values: [false, false, false, '5 competitors', 'Unlimited', 'Unlimited'] },
      { label: 'Scheduled email reports', values: [false, false, false, true, true, true] },
      { label: 'Social listening', values: [false, false, false, '100 keywords', '500 keywords', 'Unlimited'] },
    ],
  },
  {
    category: 'Team',
    rows: [
      { label: 'Team members', values: ['1', '2', '5', '20', 'Unlimited', 'Unlimited'] },
      { label: 'Role-based permissions', values: [false, false, false, true, true, true] },
      { label: 'Approval workflows', values: [false, false, true, true, true, true] },
      { label: 'Custom workflows', values: [false, false, false, true, true, true] },
    ],
  },
  {
    category: 'Social Tools',
    rows: [
      { label: 'Hashtag Manager', values: [false, false, true, true, true, true] },
      { label: 'Link-in-Bio pages', values: [false, false, '1', '5', 'Unlimited', 'Unlimited'] },
      { label: 'Inbox (comments/DMs)', values: [false, false, true, true, true, true] },
    ],
  },
  {
    category: 'Support & Security',
    rows: [
      { label: 'Support', values: ['Community', 'Email', 'Email', 'Priority', 'Dedicated onboarding', 'Dedicated AM'] },
      { label: 'Audit log', values: [false, false, false, true, true, true] },
      { label: 'SSO (SAML/OIDC)', values: [false, false, false, false, false, true] },
      { label: 'API access', values: [false, false, false, 'Coming soon', true, true] },
      { label: 'White-label', values: [false, false, false, false, true, true] },
      { label: 'SLA', values: [false, false, false, false, '99.9%', 'Custom'] },
    ],
  },
]

/* ─── FAQ data ───────────────────────────────────────────── */
const FAQS = [
  {
    q: 'Can I switch plans anytime?',
    a: 'Yes. You can upgrade or downgrade at any time from your account settings. Upgrades take effect immediately with pro-rated billing. Downgrades take effect at your next billing cycle.',
  },
  {
    q: 'What counts as a "post"?',
    a: 'A post is any piece of content scheduled or published through Caption Fox — including single-image posts, carousels, reels, stories, videos and threads. Each published item counts as one post.',
  },
  {
    q: 'Is Fox AI included in all plans?',
    a: 'Yes, Fox AI is included on every plan. Free users get 5 generations per month. Starter gets 50. Pro and above get unlimited generations including AI image generation, hooks, scripts, UGC briefs and reply drafts.',
  },
  {
    q: 'How does the free trial work?',
    a: 'All paid plans come with a 14-day free trial. No credit card is required to start. Your data is preserved if you decide to upgrade or downgrade after the trial period ends.',
  },
  {
    q: 'Do you offer discounts for nonprofits?',
    a: 'Yes. We offer 30% off all paid plans for registered nonprofits and educational institutions. Contact support@captionfox.com with proof of your nonprofit status to apply.',
  },
  {
    q: 'What happens when I reach my post limit?',
    a: 'When you hit your monthly post limit, you can still draft content but scheduling will be paused until you upgrade or your limit resets at the start of your next billing cycle. We\'ll send you an email warning at 80% usage.',
  },
  {
    q: 'Can I have multiple brands on one account?',
    a: 'Yes. Each brand lives in its own workspace within your account. Free supports 1 brand, Starter 2, Pro 5, Team 10, and Agency/Enterprise support unlimited brands. All workspaces are billed under one subscription.',
  },
  {
    q: 'What is the Agency white-label option?',
    a: 'White-label allows you to remove Caption Fox branding from client-facing reports, link-in-bio pages and the sharing portal. You can add your own agency logo and brand colours for a fully branded client experience.',
  },
  {
    q: 'Is there a setup fee?',
    a: 'No setup fees, ever. Agency plan includes a dedicated onboarding session at no extra cost. Enterprise plans may include a custom onboarding package as part of the contract.',
  },
  {
    q: 'How does billing work for teams?',
    a: 'Caption Fox is billed per workspace, not per seat. You pay for your plan tier and all team members within the seat allowance are included. Adding members beyond your plan limit will prompt an upgrade to the next tier.',
  },
]

/* ─── Helper: render feature value ──────────────────────── */
function CellValue({ val, highlight }: { val: FeatureValue; highlight?: boolean }) {
  if (val === true) return <Check size={16} className="text-emerald-500 mx-auto" />
  if (val === false) return <X size={16} className="text-slate-300 mx-auto" />
  return <span className={`text-xs font-medium ${highlight ? 'text-blue-700' : 'text-slate-700'}`}>{val}</span>
}

/* ─── Nav ────────────────────────────────────────────────── */
function PublicNav() {
  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/caption-fox-logo-transparent.png"
              alt="Caption Fox"
              width={140}
              height={32}
              className="h-8 w-auto"
              priority
            />
          </Link>
          <nav className="hidden md:flex items-center gap-8">
            <Link href="/features" className="text-sm text-slate-600 hover:text-slate-900 font-medium transition-colors">Features</Link>
            <Link href="/marketplace" className="text-sm text-slate-600 hover:text-slate-900 font-medium transition-colors">Marketplace</Link>
            <Link href="/pricing" className="text-sm text-blue-600 font-semibold">Pricing</Link>
            <Link href="#use-cases" className="text-sm text-slate-600 hover:text-slate-900 font-medium transition-colors">Use Cases</Link>
          </nav>
          <div className="hidden md:flex items-center gap-3">
            <Link href="/auth/login" className="text-sm font-medium text-slate-600 hover:text-slate-900 px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors">
              Sign in
            </Link>
            <Link href="/auth/signup" className="text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors shadow-sm">
              Start free
            </Link>
          </div>
        </div>
      </div>
    </header>
  )
}

/* ─── Main page ──────────────────────────────────────────── */
export default function PricingPage() {
  const [yearly, setYearly] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  function getPrice(plan: Plan) {
    if (plan.monthlyPrice === null) return null
    if (plan.monthlyPrice === 0) return 0
    return yearly ? plan.yearlyPrice : plan.monthlyPrice
  }

  function getSavings(plan: Plan) {
    if (!plan.monthlyPrice || !plan.yearlyPrice) return 0
    return (plan.monthlyPrice - plan.yearlyPrice) * 12
  }

  return (
    <div className="min-h-screen bg-white">
      <PublicNav />

      {/* ── Section 1: Hero ──────────────────────────────── */}
      <section className="py-20 sm:py-28 text-center" style={{ backgroundColor: '#0C1A2E' }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <span className="inline-flex items-center gap-2 bg-blue-500/20 border border-blue-500/30 text-blue-300 text-xs font-semibold px-4 py-1.5 rounded-full mb-6">
            <Sparkles size={12} />
            Transparent pricing. No surprises.
          </span>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-tight mb-5">
            Plans that scale with you
          </h1>
          <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-10">
            From solo creators to enterprise agencies — Caption Fox grows with your team.
          </p>
          {/* Toggle */}
          <div className="inline-flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-xl p-1">
            <button
              onClick={() => setYearly(false)}
              className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${!yearly ? 'bg-white text-slate-900 shadow' : 'text-slate-400 hover:text-white'}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setYearly(true)}
              className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${yearly ? 'bg-white text-slate-900 shadow' : 'text-slate-400 hover:text-white'}`}
            >
              Yearly
              <span className="px-2 py-0.5 bg-emerald-500 text-white text-xs font-bold rounded-full">Save 20%</span>
            </button>
          </div>
        </div>
      </section>

      {/* ── Section 2: Pricing Cards ─────────────────────── */}
      <section className="bg-slate-50 pt-12 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {PLANS.map((plan) => {
              const price = getPrice(plan)
              const savings = getSavings(plan)

              return (
                <div
                  key={plan.id}
                  className={`relative rounded-2xl flex flex-col transition-all ${
                    plan.popular
                      ? 'border-2 border-blue-600 bg-white shadow-xl shadow-blue-100'
                      : plan.newBadge
                      ? 'border-2 bg-white shadow-lg'
                      : 'border border-slate-200 bg-white hover:border-slate-300 hover:shadow-md'
                  }`}
                  style={
                    plan.newBadge
                      ? { borderImage: 'linear-gradient(135deg, #2563eb, #7c3aed) 1' }
                      : undefined
                  }
                >
                  {/* Agency gradient border overlay */}
                  {plan.newBadge && (
                    <div
                      className="absolute inset-0 rounded-2xl pointer-events-none"
                      style={{
                        background: 'linear-gradient(135deg, #2563eb20, #7c3aed20)',
                        border: '2px solid transparent',
                        backgroundClip: 'padding-box',
                      }}
                    />
                  )}

                  {/* Popular ribbon */}
                  {plan.popular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                      <span className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-full shadow">
                        <Zap size={11} fill="currentColor" /> Most Popular
                      </span>
                    </div>
                  )}

                  {/* New badge */}
                  {plan.newBadge && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                      <span className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-xs font-bold rounded-full shadow">
                        <Crown size={11} /> New
                      </span>
                    </div>
                  )}

                  <div className="p-7 flex flex-col flex-1">
                    {/* Plan name */}
                    <div className="mb-4">
                      <h3 className="text-lg font-bold text-slate-900 mb-1">{plan.name}</h3>
                      <p className="text-sm text-slate-500">{plan.tagline}</p>
                    </div>

                    {/* Price */}
                    <div className="mb-6">
                      {price === null ? (
                        <div>
                          <p className="text-4xl font-extrabold text-slate-900">Custom</p>
                          <p className="text-sm text-slate-500 mt-1">Tailored to your needs</p>
                        </div>
                      ) : price === 0 ? (
                        <div>
                          <p className="text-4xl font-extrabold text-slate-900">Free</p>
                          <p className="text-sm text-slate-500 mt-1">Forever, no credit card needed</p>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-end gap-1">
                            <p className="text-4xl font-extrabold text-slate-900">£{price}</p>
                            <span className="text-slate-500 text-base mb-1">/mo</span>
                          </div>
                          {yearly ? (
                            <p className="text-sm text-slate-500 mt-1">
                              Billed annually
                              {savings > 0 && (
                                <span className="ml-2 text-emerald-600 font-semibold">Save £{savings}/year</span>
                              )}
                            </p>
                          ) : (
                            plan.yearlyPrice !== null && plan.yearlyPrice !== undefined && (
                              <p className="text-sm text-slate-400 mt-1">£{plan.yearlyPrice}/mo billed annually</p>
                            )
                          )}
                        </div>
                      )}
                    </div>

                    {/* CTA */}
                    <Link
                      href={plan.ctaHref}
                      className={`block text-center py-3 rounded-xl text-sm font-bold transition-colors mb-7 ${
                        plan.popular
                          ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
                          : plan.id === 'enterprise'
                          ? 'bg-slate-900 hover:bg-slate-800 text-white'
                          : 'border-2 border-slate-200 hover:border-blue-300 hover:bg-blue-50 text-slate-800'
                      }`}
                    >
                      {plan.cta}
                    </Link>

                    {/* Features */}
                    <ul className="space-y-2.5 flex-1">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-start gap-2.5 text-sm text-slate-700">
                          <Check size={15} className="text-emerald-500 shrink-0 mt-0.5" />
                          {f}
                        </li>
                      ))}
                      {plan.notIncluded.map((f) => (
                        <li key={f} className="flex items-start gap-2.5 text-sm text-slate-400">
                          <X size={15} className="text-slate-300 shrink-0 mt-0.5" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )
            })}
          </div>

          <p className="text-center text-sm text-slate-500 mt-8">
            All paid plans include a 14-day free trial. No credit card required.
          </p>
        </div>
      </section>

      {/* ── Section 3: Full Feature Comparison Table ─────── */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">Full feature comparison</h2>
            <p className="text-slate-600 text-lg">See exactly what's included in every plan.</p>
          </div>
          <div className="border border-slate-200 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[900px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left px-6 py-4 font-semibold text-slate-600 w-52">Feature</th>
                    {PLANS.map((p) => (
                      <th
                        key={p.id}
                        className={`text-center px-3 py-4 font-bold ${
                          p.popular ? 'bg-blue-50 text-blue-700' : 'text-slate-700'
                        }`}
                      >
                        {p.name}
                        {p.popular && (
                          <div className="text-xs font-normal text-blue-500 mt-0.5">Most Popular</div>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map((cat) => (
                    <>
                      <tr key={cat.category} className="bg-slate-50 border-t border-b border-slate-200">
                        <td colSpan={7} className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                          {cat.category}
                        </td>
                      </tr>
                      {cat.rows.map((row, ri) => (
                        <tr
                          key={row.label}
                          className={`border-b border-slate-100 ${ri % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}
                        >
                          <td className="px-6 py-3.5 text-slate-700 font-medium">{row.label}</td>
                          {row.values.map((val, vi) => (
                            <td
                              key={vi}
                              className={`text-center px-3 py-3.5 ${PLANS[vi]?.popular ? 'bg-blue-50/40' : ''}`}
                            >
                              <CellValue val={val} highlight={PLANS[vi]?.popular} />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 4: Competitor Comparison ─────────────── */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">Why brands switch to Caption Fox</h2>
            <p className="text-slate-500 text-base max-w-2xl mx-auto">
              Sprout Social charges £79–299/mo for features available in Caption Fox at £59/mo.
            </p>
          </div>
          <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[680px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left px-6 py-4 font-semibold text-slate-600 w-60">Feature</th>
                    <th className="text-center px-4 py-4 font-bold text-blue-700 bg-blue-50">Caption Fox</th>
                    <th className="text-center px-4 py-4 font-semibold text-slate-600">Buffer</th>
                    <th className="text-center px-4 py-4 font-semibold text-slate-600">Later</th>
                    <th className="text-center px-4 py-4 font-semibold text-slate-600">Sprout Social</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    {
                      feature: 'Campaign Management (12 types)',
                      cf: '✓ Pro', buffer: false, later: false, sprout: false,
                    },
                    {
                      feature: 'Integrated Giveaways',
                      cf: '✓ Pro', buffer: false, later: false, sprout: false,
                    },
                    {
                      feature: 'End-to-end UGC',
                      cf: '✓ Pro', buffer: false, later: false, sprout: 'Add-on',
                    },
                    {
                      feature: 'Fox AI (captions, hooks, scripts)',
                      cf: '✓ All', buffer: 'Basic', later: false, sprout: 'Add-on',
                    },
                    {
                      feature: 'Social Listening',
                      cf: '✓ Team', buffer: false, later: false, sprout: '£299/mo',
                    },
                    {
                      feature: 'Competitor Analysis',
                      cf: '✓ Team', buffer: false, later: 'Growth only', sprout: '£299/mo',
                    },
                    {
                      feature: 'Starting price',
                      cf: 'From £29', buffer: 'From £5', later: 'From £20', sprout: 'From £79',
                    },
                  ].map((row, i) => (
                    <tr key={row.feature} className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                      <td className="px-6 py-3.5 text-slate-700 font-medium">{row.feature}</td>
                      <td className="text-center px-4 py-3.5 bg-blue-50/40">
                        {typeof row.cf === 'string' ? (
                          <span className="text-blue-700 font-semibold text-xs">{row.cf}</span>
                        ) : (
                          <Check size={16} className="text-emerald-500 mx-auto" />
                        )}
                      </td>
                      {[row.buffer, row.later, row.sprout].map((val, vi) => (
                        <td key={vi} className="text-center px-4 py-3.5">
                          {val === false ? (
                            <X size={16} className="text-slate-300 mx-auto" />
                          ) : (
                            <span className="text-slate-600 text-xs font-medium">{val as string}</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 5: FAQ ───────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">Frequently asked questions</h2>
            <p className="text-slate-600">Everything you need to know about Caption Fox pricing.</p>
          </div>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <div key={faq.q} className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-slate-50 transition-colors"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span className="font-medium text-slate-800 text-sm pr-4">{faq.q}</span>
                  {openFaq === i ? (
                    <ChevronUp size={16} className="text-slate-400 flex-shrink-0" />
                  ) : (
                    <ChevronDown size={16} className="text-slate-400 flex-shrink-0" />
                  )}
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-5 pt-1 text-sm text-slate-600 leading-relaxed border-t border-slate-100">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 6: CTA Strip ─────────────────────────── */}
      <section className="py-20" style={{ backgroundColor: '#0C1A2E' }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center mx-auto mb-6">
            <Sparkles size={24} className="text-blue-400" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
            Ready to run better campaigns?
          </h2>
          <p className="text-slate-400 text-lg mb-10">
            Join the brands and agencies growing faster with Caption Fox.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/auth/signup"
              className="inline-flex items-center gap-2 bg-white text-slate-900 font-bold px-8 py-4 rounded-xl hover:bg-slate-100 transition-colors text-base"
            >
              Start Free <ArrowRight size={18} />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 text-white font-semibold px-8 py-4 rounded-xl border-2 border-white/20 hover:border-white/40 hover:bg-white/5 transition-colors text-base"
            >
              Contact Sales
            </Link>
          </div>
          <p className="mt-5 text-xs text-slate-500">No credit card required · 14-day free trial · Cancel anytime</p>
        </div>
      </section>
    </div>
  )
}
