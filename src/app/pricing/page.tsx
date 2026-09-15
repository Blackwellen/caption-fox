'use client'

import { Fragment, useState } from 'react'
import Link from 'next/link'
import { Check, X, Zap, Sparkles, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react'
import PublicNav from '@/components/marketing/PublicNav'
import PublicFooter from '@/components/marketing/PublicFooter'
import { PLANS as PLAN_CONFIG, PLAN_ORDER, type PlanId } from '@/lib/plans'

/* ─── Types ──────────────────────────────────────────────── */
type FeatureValue = boolean | string

interface PlanCard {
  id: PlanId
  name: string
  monthlyPrice: number | null
  yearlyPrice: number | null
  tagline: string
  cta: string
  ctaHref: string
  recommended: boolean
  features: string[]
}

/* ─── Plan data — derived from the canonical config in lib/plans.ts ─── */
const PLAN_META: Record<PlanId, { tagline: string; cta: string; ctaHref: string; recommended?: boolean }> = {
  free: { tagline: 'For trying Caption Fox with one brand.', cta: 'Get started free', ctaHref: '/signup?plan=free' },
  creator_pro: { tagline: 'For creators and solo marketers.', cta: 'Get started', ctaHref: '/signup?plan=creator_pro' },
  team: { tagline: 'For growing brands and marketing teams.', cta: 'Get started', ctaHref: '/signup?plan=team', recommended: true },
  agency: { tagline: 'For agencies and multi-brand operators.', cta: 'Get started', ctaHref: '/signup?plan=agency' },
  enterprise: { tagline: 'Custom pricing for enterprise and regulated organisations.', cta: 'Contact sales', ctaHref: '/contact' },
}

const PLANS: PlanCard[] = PLAN_ORDER.map((id, i) => {
  const p = PLAN_CONFIG[id]
  const previous = i > 0 ? PLAN_CONFIG[PLAN_ORDER[i - 1]] : null
  return {
    id,
    name: p.name,
    monthlyPrice: p.monthly,
    yearlyPrice: p.yearly,
    ...PLAN_META[id],
    recommended: !!PLAN_META[id].recommended,
    features: previous ? [`Everything in ${previous.name}`, ...p.features] : p.features,
  }
})

const MAX_YEARLY_SAVING = Math.max(
  0,
  ...PLANS.filter((p) => p.monthlyPrice && p.yearlyPrice).map((p) => Math.floor(((p.monthlyPrice! - p.yearlyPrice!) / p.monthlyPrice!) * 100)),
)

const limit = (n: number) => (n === -1 ? 'Unlimited' : n.toLocaleString('en-GB'))

/** A feature is included on a tier if that tier or any lower tier lists it (tiers are cumulative). */
const includes = (tierIndex: number, token: string) =>
  PLAN_ORDER.slice(0, tierIndex + 1).some((id) => PLAN_CONFIG[id].features.some((f) => f.toLowerCase().includes(token.toLowerCase())))

/* ─── Full comparison table data ─────────────────────────── */
interface ComparisonCategory {
  category: string
  rows: { label: string; values: FeatureValue[] }[]
}

const featureRow = (label: string, token: string) => ({ label, values: PLAN_ORDER.map((_, i) => includes(i, token)) })

const COMPARISON: ComparisonCategory[] = [
  {
    category: 'Usage limits',
    rows: [
      { label: 'Brands', values: PLAN_ORDER.map((id) => limit(PLAN_CONFIG[id].limits.brands)) },
      { label: 'Team members', values: PLAN_ORDER.map((id) => limit(PLAN_CONFIG[id].limits.seats)) },
      { label: 'Scheduled posts / month', values: PLAN_ORDER.map((id) => limit(PLAN_CONFIG[id].limits.scheduledPostsMonthly)) },
      { label: 'Fox AI requests / month', values: PLAN_ORDER.map((id) => limit(PLAN_CONFIG[id].limits.aiMonthly)) },
    ],
  },
  {
    category: 'Planning & publishing',
    rows: [featureRow('Calendar', 'Calendar'), featureRow('Link in bio', 'Link in bio')],
  },
  {
    category: 'Campaigns & collaboration',
    rows: [featureRow('Approvals', 'Approvals'), featureRow('Campaigns', 'Campaigns'), featureRow('UGC', 'UGC'), featureRow('Reports', 'Reports')],
  },
  {
    category: 'Insight & agency',
    rows: [featureRow('Social listening', 'Social listening'), featureRow('Competitor analysis', 'Competitor analysis'), featureRow('White-label', 'White-label')],
  },
  {
    category: 'Enterprise',
    rows: [featureRow('SSO / SAML', 'SSO'), featureRow('SCIM', 'SCIM'), featureRow('DPA', 'DPA'), featureRow('Audit export', 'Audit export'), featureRow('SLA', 'SLA'), featureRow('Dedicated support', 'Dedicated support')],
  },
]

/* ─── FAQ data — numbers come from the canonical plan config ─── */
const brands = (id: PlanId) => {
  const n = PLAN_CONFIG[id].limits.brands
  return n === -1 ? 'unlimited brands' : `${n} brand${n === 1 ? '' : 's'}`
}

const FAQS = [
  {
    q: 'Is there a free plan?',
    a: `Yes. The Free plan costs £0 and includes ${brands('free')}, ${PLAN_CONFIG.free.limits.scheduledPostsMonthly} scheduled posts a month and ${PLAN_CONFIG.free.limits.aiMonthly} Fox AI requests a month. No credit card is needed to start.`,
  },
  {
    q: 'How much does yearly billing save?',
    a: `Yearly billing is charged per month at a lower rate — for example Creator Pro is £${PLAN_CONFIG.creator_pro.monthly}/month monthly or £${PLAN_CONFIG.creator_pro.yearly}/month billed annually. That is up to ${MAX_YEARLY_SAVING}% off across paid plans.`,
  },
  {
    q: 'How many brands can I manage?',
    a: `Free includes ${brands('free')}, Creator Pro ${brands('creator_pro')}, Team ${brands('team')}, and Agency and Enterprise include ${brands('agency')}.`,
  },
  {
    q: 'Is Fox AI included in every plan?',
    a: `Yes. Monthly Fox AI allowances are ${limit(PLAN_CONFIG.free.limits.aiMonthly)} on Free, ${limit(PLAN_CONFIG.creator_pro.limits.aiMonthly)} on Creator Pro, ${limit(PLAN_CONFIG.team.limits.aiMonthly)} on Team and fair use on Agency. Enterprise allowances are agreed as part of the contract.`,
  },
  {
    q: 'What happens when I reach my post limit?',
    a: `The Free plan includes ${PLAN_CONFIG.free.limits.scheduledPostsMonthly} scheduled posts a month. You can keep drafting after that; scheduling more needs a paid plan, all of which include unlimited scheduled posts.`,
  },
  {
    q: 'How many team members are included?',
    a: `Free and Creator Pro include ${limit(PLAN_CONFIG.creator_pro.limits.seats)} seat, Team includes ${limit(PLAN_CONFIG.team.limits.seats)} seats, and Agency includes ${limit(PLAN_CONFIG.agency.limits.seats).toLowerCase()} seats.`,
  },
  {
    q: 'What is the Agency white-label option?',
    a: 'White-label lets you present client-facing work under your own agency branding instead of Caption Fox branding.',
  },
  {
    q: 'What does Enterprise add?',
    a: `Enterprise adds ${PLAN_CONFIG.enterprise.features.join(', ')}. Pricing is agreed with our team — get in touch through the contact page.`,
  },
]

/* ─── Helper: render feature value ──────────────────────── */
function CellValue({ val, highlight }: { val: FeatureValue; highlight?: boolean }) {
  if (val === true) return <Check size={16} className="text-emerald-500 mx-auto" aria-label="Included" />
  if (val === false) return <X size={16} className="text-slate-300 mx-auto" aria-label="Not included" />
  return <span className={`text-xs font-medium ${highlight ? 'text-blue-700' : 'text-slate-700'}`}>{val}</span>
}

/* ─── Main page ──────────────────────────────────────────── */
export default function PricingPage() {
  const [yearly, setYearly] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  function getPrice(plan: PlanCard) {
    if (plan.monthlyPrice === null) return null
    if (plan.monthlyPrice === 0) return 0
    return yearly ? plan.yearlyPrice : plan.monthlyPrice
  }

  function getSavings(plan: PlanCard) {
    if (!plan.monthlyPrice || !plan.yearlyPrice) return 0
    return (plan.monthlyPrice - plan.yearlyPrice) * 12
  }

  return (
    <div className="min-h-screen bg-white">
      <PublicNav />

      <main id="main-content">
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
              From solo creators to agencies — start free and upgrade as your marketing grows.
            </p>
            {/* Toggle */}
            <div role="radiogroup" aria-label="Billing period" className="inline-flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-xl p-1">
              <button
                type="button"
                role="radio"
                aria-checked={!yearly}
                onClick={() => setYearly(false)}
                className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${!yearly ? 'bg-white text-slate-900 shadow' : 'text-slate-400 hover:text-white'}`}
              >
                Monthly
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={yearly}
                onClick={() => setYearly(true)}
                className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${yearly ? 'bg-white text-slate-900 shadow' : 'text-slate-400 hover:text-white'}`}
              >
                Yearly
                {MAX_YEARLY_SAVING > 0 && <span className="px-2 py-0.5 bg-emerald-600 text-white text-xs font-bold rounded-full">Save up to {MAX_YEARLY_SAVING}%</span>}
              </button>
            </div>
          </div>
        </section>

        {/* ── Section 2: Pricing Cards ─────────────────────── */}
        <section className="bg-slate-50 pt-12 pb-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
              {PLANS.map((plan) => {
                const price = getPrice(plan)
                const savings = getSavings(plan)

                return (
                  <div
                    key={plan.id}
                    className={`relative rounded-2xl flex flex-col transition-all ${
                      plan.recommended
                        ? 'border-2 border-blue-600 bg-white shadow-xl shadow-blue-100'
                        : 'border border-slate-200 bg-white hover:border-slate-300 hover:shadow-md'
                    }`}
                  >
                    {plan.recommended && (
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                        <span className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-full shadow whitespace-nowrap">
                          <Zap size={11} fill="currentColor" /> Recommended
                        </span>
                      </div>
                    )}

                    <div className="p-7 flex flex-col flex-1">
                      <div className="mb-4">
                        <h2 className="text-lg font-bold text-slate-900 mb-1">{plan.name}</h2>
                        <p className="text-sm text-slate-500">{plan.tagline}</p>
                      </div>

                      <div className="mb-6">
                        {price === null ? (
                          <div>
                            <p className="text-4xl font-extrabold text-slate-900">Custom</p>
                            <p className="text-sm text-slate-500 mt-1">Tailored to your needs</p>
                          </div>
                        ) : price === 0 ? (
                          <div>
                            <p className="text-4xl font-extrabold text-slate-900">£0</p>
                            <p className="text-sm text-slate-500 mt-1">Free forever, no credit card needed</p>
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
                                {savings > 0 && <span className="ml-2 text-emerald-700 font-semibold">Save £{savings}/year</span>}
                              </p>
                            ) : (
                              plan.yearlyPrice !== null && <p className="text-sm text-slate-500 mt-1">£{plan.yearlyPrice}/mo billed annually</p>
                            )}
                          </div>
                        )}
                      </div>

                      <Link
                        href={plan.ctaHref}
                        className={`block text-center py-3 rounded-xl text-sm font-bold transition-colors mb-7 ${
                          plan.recommended
                            ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
                            : plan.id === 'enterprise'
                              ? 'bg-slate-900 hover:bg-slate-800 text-white'
                              : 'border-2 border-slate-200 hover:border-blue-300 hover:bg-blue-50 text-slate-800'
                        }`}
                      >
                        {plan.cta}
                      </Link>

                      <ul className="space-y-2.5 flex-1">
                        {plan.features.map((f) => (
                          <li key={f} className="flex items-start gap-2.5 text-sm text-slate-700">
                            <Check size={15} className="text-emerald-500 shrink-0 mt-0.5" aria-hidden />
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
              Prices in GBP. The Free plan needs no credit card.
            </p>
          </div>
        </section>

        {/* ── Section 3: Full Feature Comparison Table ─────── */}
        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">Full feature comparison</h2>
              <p className="text-slate-600 text-lg">See exactly what&apos;s included in every plan.</p>
            </div>
            <div className="border border-slate-200 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[820px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th scope="col" className="text-left px-6 py-4 font-semibold text-slate-600 w-52">Feature</th>
                      {PLANS.map((p) => (
                        <th key={p.id} scope="col" className={`text-center px-3 py-4 font-bold ${p.recommended ? 'bg-blue-50 text-blue-700' : 'text-slate-700'}`}>
                          {p.name}
                          <div className="text-xs font-normal text-slate-500 mt-0.5">
                            {p.monthlyPrice === null ? 'Custom' : `£${yearly ? p.yearlyPrice : p.monthlyPrice}/mo`}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {COMPARISON.map((cat) => (
                      <Fragment key={cat.category}>
                        <tr className="bg-slate-50 border-t border-b border-slate-200">
                          <th scope="colgroup" colSpan={PLANS.length + 1} className="text-left px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            {cat.category}
                          </th>
                        </tr>
                        {cat.rows.map((row, ri) => (
                          <tr key={row.label} className={`border-b border-slate-100 ${ri % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                            <th scope="row" className="text-left px-6 py-3.5 text-slate-700 font-medium">{row.label}</th>
                            {row.values.map((val, vi) => (
                              <td key={vi} className={`text-center px-3 py-3.5 ${PLANS[vi]?.recommended ? 'bg-blue-50/40' : ''}`}>
                                <CellValue val={val} highlight={PLANS[vi]?.recommended} />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* ── Section 4: FAQ ───────────────────────────────── */}
        <section className="py-20 bg-slate-50">
          <div className="max-w-2xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">Frequently asked questions</h2>
              <p className="text-slate-600">Everything you need to know about Caption Fox pricing.</p>
            </div>
            <div className="space-y-3">
              {FAQS.map((faq, i) => (
                <div key={faq.q} className="border border-slate-200 bg-white rounded-xl overflow-hidden">
                  <button
                    type="button"
                    aria-expanded={openFaq === i}
                    aria-controls={`pricing-faq-${i}`}
                    className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-slate-50 transition-colors"
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  >
                    <span className="font-medium text-slate-800 text-sm pr-4">{faq.q}</span>
                    {openFaq === i ? <ChevronUp size={16} className="text-slate-400 flex-shrink-0" aria-hidden /> : <ChevronDown size={16} className="text-slate-400 flex-shrink-0" aria-hidden />}
                  </button>
                  {openFaq === i && (
                    <div id={`pricing-faq-${i}`} className="px-6 pb-5 pt-1 text-sm text-slate-600 leading-relaxed border-t border-slate-100">
                      {faq.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Section 5: CTA Strip ─────────────────────────── */}
        <section className="py-20" style={{ backgroundColor: '#0C1A2E' }}>
          <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center mx-auto mb-6">
              <Sparkles size={24} className="text-blue-400" aria-hidden />
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">Ready to run better campaigns?</h2>
            <p className="text-slate-400 text-lg mb-10">Plan, create, launch and measure with one connected marketing operating system.</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/signup" className="inline-flex items-center gap-2 bg-white text-slate-900 font-bold px-8 py-4 rounded-xl hover:bg-slate-100 transition-colors text-base">
                Start free <ArrowRight size={18} aria-hidden />
              </Link>
              <Link href="/contact" className="inline-flex items-center gap-2 text-white font-semibold px-8 py-4 rounded-xl border-2 border-white/20 hover:border-white/40 hover:bg-white/5 transition-colors text-base">
                Contact sales
              </Link>
            </div>
            <p className="mt-5 text-xs text-slate-400">No credit card required for the Free plan</p>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  )
}
