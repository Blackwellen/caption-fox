'use client'

import { m } from 'framer-motion'
import Link from 'next/link'
import { BarChart3, Calendar, CircleCheck, CreditCard, Headphones, Minus, Plus, PoundSterling, Search, Users } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { AUTH_LINKS } from '@/lib/marketing-links'
import { ChannelIcon } from './brand-icons'
import { Accent, CONTAINER, Cta, Eyebrow, IconTile, Lead, SectionTitle, TextLink } from './primitives'

export interface PricingCard {
  id: string
  name: string
  audience: string
  monthly: number
  yearly: number
  features: string[]
  cta: { label: string; href: string }
  recommended?: boolean
}

export interface FaqItem { q: string; a: string }

/** SECTION 08 — Pricing (from the canonical plan source) + FAQ + final CTA. */
export default function CommercialClose({ plans, faqs }: { plans: PricingCard[]; faqs: FaqItem[] }) {
  return (
    <>
      <Pricing plans={plans} />
      <Faq faqs={faqs} />
      <FinalCta />
    </>
  )
}

function Pricing({ plans }: { plans: PricingCard[] }) {
  const [yearly, setYearly] = useState(false)
  const maxSaving = useMemo(() => Math.max(0, ...plans.filter((p) => p.monthly > 0).map((p) => Math.floor(((p.monthly - p.yearly) / p.monthly) * 100))), [plans])

  return (
    <section id="pricing" aria-labelledby="pricing-title" className="scroll-mt-16 bg-white">
      <div className={cn(CONTAINER, 'pb-14 pt-14 lg:pb-[48px] lg:pt-[36px]')}>
        <Eyebrow className="text-[11.5px] tracking-[0.3em]">Pricing</Eyebrow>
        <SectionTitle id="pricing-title" className="mt-3 text-center">
          Start with what you need.<br /><Accent>Scale when you are ready.</Accent>
        </SectionTitle>
        <Lead className="mx-auto mt-4 max-w-[640px] text-center text-[16px]">
          Plans for individuals, growing teams and agencies. Start free and upgrade as your marketing grows.
        </Lead>

        <div className="mt-6 flex items-center justify-center gap-3">
          <div role="radiogroup" aria-label="Billing period" className="inline-flex rounded-[12px] border border-cf-line bg-cf-surface p-1">
            {[{ v: false, l: 'Monthly' }, { v: true, l: 'Yearly' }].map((o) => (
              <button
                key={o.l}
                type="button"
                role="radio"
                aria-checked={yearly === o.v}
                onClick={() => setYearly(o.v)}
                className={cn('relative min-h-9 min-w-[96px] rounded-[9px] px-5 text-[13.5px] font-medium transition-colors', yearly === o.v ? 'text-white' : 'text-cf-body hover:text-cf-ink')}
              >
                {yearly === o.v && <m.span layoutId="billing-pill" className="absolute inset-0 rounded-[9px] bg-cf-blue" transition={{ duration: 0.25 }} />}
                <span className="relative">{o.l}</span>
              </button>
            ))}
          </div>
          {maxSaving > 0 && <span className="rounded-full bg-[#E7F7EE] px-2.5 py-1 text-[11.5px] font-medium text-[#157A45]">Save up to {maxSaving}% yearly</span>}
        </div>

        <ul className="mx-auto mt-7 grid max-w-[1180px] gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {plans.map((p) => {
            const price = yearly ? p.yearly : p.monthly
            return (
              <li key={p.id} className={cn('relative flex flex-col rounded-[18px] border bg-white p-6 shadow-cf-card', p.recommended ? 'border-cf-blue/60 shadow-[0_0_0_3px_rgba(23,105,255,0.08),0_22px_48px_-24px_rgba(23,105,255,0.35)]' : 'border-cf-line')}>
                {p.recommended && <span className="absolute right-5 top-5 rounded-full bg-cf-blue px-2.5 py-1 text-[11px] font-semibold text-white">Recommended</span>}
                <h3 className="text-[22px] font-bold tracking-[-0.03em] text-cf-ink">{p.name}</h3>
                <p className="mt-1.5 min-h-[40px] max-w-[200px] text-[13.5px] leading-[1.45] text-cf-muted">{p.audience}</p>
                <p className="mt-4 flex items-baseline gap-1.5">
                  <span className="text-[40px] font-bold tracking-[-0.04em] text-cf-ink">£{price}</span>
                  <span className="text-[14px] text-cf-muted">/ month</span>
                </p>
                <p className="min-h-[18px] text-[11.5px] text-cf-subtle">{yearly && p.monthly > 0 ? `Billed annually (£${p.yearly * 12}/year)` : p.monthly === 0 ? 'Free forever' : 'Billed monthly'}</p>
                <ul className="mt-5 flex-1 space-y-2.5">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-[13.5px] text-cf-body">
                      <CircleCheck aria-hidden className="mt-0.5 h-[18px] w-[18px] shrink-0 fill-[#1DB954] text-white" strokeWidth={2.2} />{f}
                    </li>
                  ))}
                </ul>
                <Cta href={p.cta.href} variant={p.recommended ? 'primary' : 'secondary'} className={cn('mt-6 h-[44px] w-full text-[14px]', !p.recommended && 'border-cf-blue/35 text-cf-blue')}>{p.cta.label}</Cta>
              </li>
            )
          })}
        </ul>

        <ul className="mx-auto mt-7 flex max-w-[900px] flex-col items-center justify-center gap-3 text-[13px] text-cf-muted sm:flex-row sm:gap-0 sm:divide-x sm:divide-cf-line">
          {[{ I: CreditCard, t: 'No card required for the Free plan' }, { I: Calendar, t: 'Monthly or yearly billing' }, { I: PoundSterling, t: 'Prices shown in GBP' }].map(({ I, t }) => (
            <li key={t} className="flex items-center gap-2.5 sm:px-6"><I aria-hidden className="h-5 w-5 text-cf-body" strokeWidth={1.6} />{t}</li>
          ))}
        </ul>
        <p className="mt-6 text-center">
          <TextLink href="/pricing" className="text-[14px]">View full pricing and compare plans</TextLink>
          <span className="mx-3 text-cf-line-strong">·</span>
          <TextLink href="/contact" className="text-[14px]">Talk to us about Enterprise</TextLink>
        </p>
      </div>
    </section>
  )
}

function Faq({ faqs }: { faqs: FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(0)
  const [query, setQuery] = useState('')
  const baseId = useId()
  const q = query.trim().toLowerCase()
  const visible = faqs.map((f, i) => ({ ...f, i })).filter((f) => !q || f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q))
  const half = Math.ceil(visible.length / 2)
  const cols = [visible.slice(0, half), visible.slice(half)]

  return (
    <section aria-labelledby="faq-title" className="bg-cf-tint-2/70">
      <div className={cn(CONTAINER, 'py-14 lg:py-[46px]')}>
        <div className="mx-auto max-w-[1310px]">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <Eyebrow align="left" className="text-[11.5px] tracking-[0.3em]">Frequently asked questions</Eyebrow>
              <SectionTitle id="faq-title" className="mt-3">Everything you <Accent>need to know.</Accent></SectionTitle>
              <p className="mt-2 text-[15.5px] text-cf-muted">Clear answers to common questions about Caption Fox, pricing, channels and data.</p>
            </div>
            <label className="relative block w-full md:w-[380px]">
              <span className="sr-only">Search questions</span>
              <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-cf-muted" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search questions…"
                className="h-12 w-full rounded-full border border-cf-line bg-white pl-11 pr-4 text-[14px] text-cf-ink placeholder:text-cf-subtle focus:border-cf-blue/50 focus:outline-none focus-visible:outline-2 focus-visible:outline-cf-blue"
              />
            </label>
          </div>

          {visible.length === 0 ? (
            <p className="mt-8 rounded-[14px] border border-cf-line bg-white p-6 text-[14px] text-cf-muted">No questions match “{query}”. Try another word, or <Link href="/contact" className="font-medium text-cf-blue underline-offset-2 hover:underline">ask our team</Link>.</p>
          ) : (
            <div className="mt-7 grid gap-3 lg:grid-cols-2 lg:gap-5">
              {cols.map((col, ci) => (
                <ul key={ci} className="space-y-3">
                  {col.map((f) => {
                    const isOpen = open === f.i
                    return (
                      <li key={f.q} className="rounded-[14px] border border-cf-line bg-white shadow-[0_1px_2px_rgba(10,22,48,0.03)]">
                        <h3>
                          <button
                            type="button"
                            id={`${baseId}-q-${f.i}`}
                            aria-expanded={isOpen}
                            aria-controls={`${baseId}-a-${f.i}`}
                            onClick={() => setOpen(isOpen ? null : f.i)}
                            className="flex min-h-[52px] w-full items-center justify-between gap-4 px-5 py-3 text-left text-[15px] font-medium text-cf-ink"
                          >
                            {f.q}
                            {isOpen ? <Minus aria-hidden className="h-4 w-4 shrink-0 text-cf-ink" /> : <Plus aria-hidden className="h-4 w-4 shrink-0 text-cf-ink" />}
                          </button>
                        </h3>
                        <m.div
                          id={`${baseId}-a-${f.i}`}
                          role="region"
                          aria-labelledby={`${baseId}-q-${f.i}`}
                          initial={false}
                          animate={{ height: isOpen ? 'auto' : 0, opacity: isOpen ? 1 : 0 }}
                          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                          className="overflow-hidden"
                          hidden={!isOpen}
                        >
                          <p className="px-5 pb-4 text-[13.5px] leading-[1.6] text-cf-muted">{f.a}</p>
                        </m.div>
                      </li>
                    )
                  })}
                </ul>
              ))}
            </div>
          )}

          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-end sm:gap-10">
            <p className="flex items-center gap-3 text-[13.5px] text-cf-ink"><Headphones aria-hidden className="h-6 w-6 text-cf-blue" strokeWidth={1.7} /><span>Still have questions?<span className="block text-[12.5px] text-cf-muted">Our team is here to help.</span></span></p>
            <Cta href="/contact" variant="secondary" className="h-[44px] border-cf-blue/35 px-10 text-[14px] text-cf-blue">Contact support</Cta>
          </div>
        </div>
      </div>
    </section>
  )
}

function FinalCta() {
  const left = [{ I: BarChart3, c: 'left-[9%] top-[22%]' }, { I: Users, c: 'left-[3%] top-[48%]' }, { I: Calendar, c: 'left-[9.5%] top-[72%]' }]
  const right = [{ ch: 'instagram', c: 'right-[6%] top-[20%]' }, { ch: 'tiktok', c: 'right-[12%] top-[44%]' }, { ch: 'linkedin', c: 'right-[3.5%] top-[46%]' }, { ch: 'email', c: 'right-[9.5%] top-[72%]' }]
  return (
    <section aria-labelledby="final-cta-title" className="bg-white">
      <div className={cn(CONTAINER, 'py-12 lg:pb-16 lg:pt-[40px]')}>
        <div className="relative mx-auto max-w-[1336px] overflow-hidden rounded-[24px] border border-cf-line bg-gradient-to-br from-cf-tint via-[#F7FAFF] to-cf-tint-2 px-5 py-14 text-center sm:px-10 lg:py-[64px]">
          <svg aria-hidden className="pointer-events-none absolute inset-0 hidden h-full w-full lg:block" preserveAspectRatio="none" viewBox="0 0 1000 300" fill="none">
            <path d="M160 -10 C 260 90, 260 220, 150 320" stroke="#C9DAF5" strokeWidth="1" />
            <path d="M840 -10 C 740 90, 740 220, 850 320" stroke="#C9DAF5" strokeWidth="1" />
            <path d="M40 60 C 140 120, 150 230, 60 320" stroke="#DCE7F8" strokeWidth="1" />
            <path d="M960 60 C 860 120, 850 230, 940 320" stroke="#DCE7F8" strokeWidth="1" />
          </svg>
          {left.map(({ I, c }) => (
            <span key={c} aria-hidden className={cn('absolute hidden h-[58px] w-[58px] items-center justify-center rounded-[16px] bg-white shadow-cf-float lg:flex', c)}><I className="h-7 w-7 text-cf-blue" strokeWidth={1.8} /></span>
          ))}
          {right.map(({ ch, c }) => (
            <span key={c} aria-hidden className={cn('absolute hidden h-[58px] w-[58px] items-center justify-center rounded-[16px] bg-white shadow-cf-float lg:flex', c)}><ChannelIcon channel={ch} size={30} /></span>
          ))}
          <div className="relative">
            <Eyebrow className="text-[11.5px] tracking-[0.3em]">Start with Caption Fox</Eyebrow>
            <SectionTitle id="final-cta-title" className="mx-auto mt-4 max-w-[760px] text-center">
              Your marketing work already connects.<br /><Accent>Now your software can too.</Accent>
            </SectionTitle>
            <Lead className="mx-auto mt-4 max-w-[560px] text-center text-[16px]">Plan, create, launch and measure with one connected marketing operating system.</Lead>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-5">
              <Cta href={AUTH_LINKS.startFree} className="h-[50px] w-full px-10 sm:w-auto">Start free</Cta>
              <Cta href="/features" variant="secondary" className="h-[50px] w-full border-cf-blue/35 px-8 text-cf-blue sm:w-auto">Explore the platform</Cta>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export { IconTile }
