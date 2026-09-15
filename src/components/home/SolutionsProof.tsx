'use client'

import { AnimatePresence, m } from 'framer-motion'
import {
  ArrowRight, BarChart3, Bell, Building2, Calendar, Crosshair, FileText, Globe, LayoutGrid, Link2, Lock, MessageSquareText, MoreHorizontal,
  Plus, Search, Send, Share2, Store, User, Users, Zap, ImageIcon, Clock3, TrendingUp,
} from 'lucide-react'
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { ChannelIcon } from './brand-icons'
import { CAMPAIGN_ROWS, CLIENT_ROWS, PEOPLE, PROOF, TEAM } from './demo-data'
import { AnalyticsModule, AutomationSteps, ChannelList, CreatorModule, StudioModule } from './PlatformGrid'
import { Accent, AppSidebar, Avatar, AvatarStack, CONTAINER, Cta, Eyebrow, IconTile, Lead, MediaThumb, Pill, SectionTitle, TextLink } from './primitives'

const EASE = [0.22, 1, 0.36, 1] as const

type Segment = 'brands' | 'agencies' | 'businesses' | 'creators'
const SEGMENTS: { id: Segment; label: string; Icon: typeof Building2 }[] = [
  { id: 'brands', label: 'Brands', Icon: Building2 },
  { id: 'agencies', label: 'Agencies', Icon: Users },
  { id: 'businesses', label: 'Businesses', Icon: Store },
  { id: 'creators', label: 'Creators', Icon: User },
]

const SEGMENT_COPY: Record<Segment, { eyebrow: string; title: string; accent: string; lead: string; caps: { label: string; Icon: typeof Crosshair }[]; cta: { href: string; label: string } }> = {
  brands: {
    eyebrow: 'For brands', title: 'Coordinate campaigns', accent: 'that make an impact.',
    lead: 'Bring strategy, teams, channels and creators together to deliver consistent, high-performing marketing.',
    caps: [{ label: 'Centralise campaigns', Icon: Crosshair }, { label: 'Align teams and creators', Icon: Users }, { label: 'Measure results', Icon: BarChart3 }],
    cta: { href: '/features#campaigns', label: 'Caption Fox for brands' },
  },
  agencies: {
    eyebrow: 'For agencies', title: 'Run every client', accent: 'from one workspace.',
    lead: 'Keep each client’s brands, approvals and reporting separate while your team works from one place.',
    caps: [{ label: 'Separate client brands', Icon: LayoutGrid }, { label: 'Approvals per client', Icon: FileText }, { label: 'Client-ready reports', Icon: BarChart3 }],
    cta: { href: '/features#brands', label: 'Caption Fox for agencies' },
  },
  businesses: {
    eyebrow: 'For businesses', title: 'Stay visible', accent: 'without a big team.',
    lead: 'Plan a month of content in one sitting, answer customers from one inbox and let Fox AI help with the drafts.',
    caps: [{ label: 'Plan ahead', Icon: Calendar }, { label: 'One inbox', Icon: MessageSquareText }, { label: 'AI-assisted drafts', Icon: Zap }],
    cta: { href: '/features#calendar', label: 'Caption Fox for businesses' },
  },
  creators: {
    eyebrow: 'For creators', title: 'Plan, publish and', accent: 'grow your channels.',
    lead: 'Keep ideas, drafts, brand deals and publishing on one calendar — then see what your audience responds to.',
    caps: [{ label: 'Content calendar', Icon: Calendar }, { label: 'Briefs and brand deals', Icon: FileText }, { label: 'Link in bio', Icon: Link2 }],
    cta: { href: '/features#ugc', label: 'Caption Fox for creators' },
  },
}

type Explorer = 'Campaigns' | 'Studio' | 'Social' | 'Creators' | 'Analytics' | 'Automations'
const EXPLORER: { id: Explorer; Icon: typeof LayoutGrid }[] = [
  { id: 'Campaigns', Icon: LayoutGrid }, { id: 'Studio', Icon: ImageIcon }, { id: 'Social', Icon: Send },
  { id: 'Creators', Icon: Users }, { id: 'Analytics', Icon: BarChart3 }, { id: 'Automations', Icon: Zap },
]
const NOTES: Record<Explorer, [string, string][]> = {
  Campaigns: [['All your campaign details in one place', 'Keep strategy, content, people and channels connected.'], ['Track progress towards launch', 'See what’s done, what’s next and keep everyone aligned.'], ['Collaborate in context', 'Share, comment and get approvals without leaving the campaign.'], ['See results as they come in', 'Measure performance across every channel.']],
  Studio: [['Create for every channel', 'Switch formats and previews per network.'], ['Stay on brand', 'Brand kit colours, fonts and voice built in.'], ['AI suggestions inline', 'Shorten, rework or add hashtags in one click.'], ['Hand off for review', 'Send drafts straight into approvals.']],
  Social: [['Every channel, one view', 'See connection status and queued posts together.'], ['Know what’s publishing', 'Scheduled, queued, ready and live states at a glance.'], ['Fix issues fast', 'Spot disconnected accounts before they block a launch.'], ['Plan around the calendar', 'Queue content where it fits the campaign.']],
  Creators: [['Brief creators clearly', 'Send briefs with deliverables and deadlines.'], ['Review submissions', 'Approve or request changes on each asset.'], ['Keep creator records', 'Niches, audiences and past work in one profile.'], ['Reuse great content', 'Approved UGC flows into campaigns.']],
  Analytics: [['Cross-channel reporting', 'Compare channels on one chart.'], ['Spot what’s working', 'Hover any day to see the channel split.'], ['Share with stakeholders', 'Build reports from the same data.'], ['Tie results to campaigns', 'Performance stays linked to the work.']],
  Automations: [['Trigger on real events', 'Start workflows when content is approved.'], ['Add conditions', 'Only run when the rules match.'], ['Review before it runs', 'Automations install as review-first drafts.'], ['See every run', 'Know when a workflow is active.']],
}

export interface IntegrationItem { key: string; label: string; category: string }

/** SECTION 07 — Solutions (user-controlled tabs) + real product proof explorer + integrations. */
export default function SolutionsProof({ integrations }: { integrations: IntegrationItem[] }) {
  return (
    <section aria-labelledby="solutions-title" className="relative bg-gradient-to-b from-cf-surface to-white">
      <SolutionSelector />
      <ProductExplorer integrations={integrations} />
    </section>
  )
}

function SolutionSelector() {
  const [seg, setSeg] = useState<Segment>('brands')
  const baseId = useId()
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  const syncHash = useCallback(() => {
    const match = window.location.hash.match(/^#solutions-(brands|agencies|businesses|creators)$/)
    if (match) setSeg(match[1] as Segment)
  }, [])
  useEffect(() => {
    // Read the initial hash after first paint (keeps SSR markup = default tab), then follow changes.
    const raf = requestAnimationFrame(syncHash)
    window.addEventListener('hashchange', syncHash)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('hashchange', syncHash)
    }
  }, [syncHash])

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = SEGMENTS.findIndex((s) => s.id === seg)
    const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!delta) return
    e.preventDefault()
    const next = (i + delta + SEGMENTS.length) % SEGMENTS.length
    setSeg(SEGMENTS[next].id)
    refs.current[next]?.focus()
  }

  const copy = SEGMENT_COPY[seg]
  return (
    <div id="solutions" className={cn(CONTAINER, 'relative scroll-mt-16 pt-12 lg:pt-[22px]')}>
      {SEGMENTS.map((s) => <span key={s.id} id={`solutions-${s.id}`} aria-hidden className="absolute top-0 scroll-mt-16" />)}
      <Eyebrow className="tracking-[0.3em]">Built for the way you operate</Eyebrow>
      <SectionTitle id="solutions-title" className="mt-2 text-center">
        One platform. <Accent>Different ways to work.</Accent>
      </SectionTitle>
      <Lead className="mx-auto mt-2 max-w-[620px] text-center text-[16px]">
        Caption Fox adapts the operating model around the people running the work — without turning each use case into a different product.
      </Lead>

      <div className="mx-auto mt-5 max-w-[1132px]">
        <div role="tablist" aria-label="Solutions" onKeyDown={onKey} className="cf-hide-scrollbar mx-auto flex w-full max-w-[652px] gap-1 overflow-x-auto rounded-[16px] border border-cf-line bg-white/80 p-1 shadow-cf-card">
          {SEGMENTS.map((s, i) => {
            const on = s.id === seg
            return (
              <button
                key={s.id}
                ref={(el) => { refs.current[i] = el }}
                id={`${baseId}-seg-${s.id}`}
                type="button"
                role="tab"
                aria-selected={on}
                aria-controls={`${baseId}-seg-panel`}
                tabIndex={on ? 0 : -1}
                onClick={() => setSeg(s.id)}
                className={cn('relative flex min-h-11 min-w-[128px] flex-1 items-center justify-center gap-2.5 rounded-[12px] px-4 text-[14.5px] font-medium transition-colors', on ? 'text-white' : 'text-cf-body hover:text-cf-ink')}
              >
                {on && <m.span layoutId="seg-pill" className="absolute inset-0 rounded-[12px] bg-cf-blue shadow-cf-button" transition={{ duration: 0.32, ease: EASE }} />}
                <s.Icon aria-hidden className="relative h-5 w-5" strokeWidth={1.8} />
                <span className="relative">{s.label}</span>
              </button>
            )
          })}
        </div>

        <div id={`${baseId}-seg-panel`} role="tabpanel" aria-labelledby={`${baseId}-seg-${seg}`} className="mt-3 overflow-hidden rounded-[22px] border border-cf-line bg-white shadow-cf-card">
          <AnimatePresence mode="wait" initial={false}>
            <m.div key={seg} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.28, ease: EASE }} className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[360px_minmax(0,1fr)] lg:gap-6 lg:py-6 lg:pl-8 lg:pr-3">
              <div className="lg:pt-1">
                <Eyebrow align="left" className="text-[11px] tracking-[0.26em]">{copy.eyebrow}</Eyebrow>
                <h3 className="mt-3 text-[28px] font-bold leading-[1.1] tracking-[-0.02em] text-cf-ink sm:text-[31px]">{copy.title}<br /><Accent>{copy.accent}</Accent></h3>
                <p className="mt-3 text-[14.5px] leading-[1.5] text-cf-muted">{copy.lead}</p>
                <ul className="mt-5 grid grid-cols-3 gap-2">
                  {copy.caps.map(({ label, Icon }) => (
                    <li key={label} className="flex items-center gap-2 text-[11.5px] leading-tight text-cf-body">
                      <Icon aria-hidden className="h-7 w-7 shrink-0 text-cf-blue" strokeWidth={1.7} />{label}
                    </li>
                  ))}
                </ul>
                <Cta href={copy.cta.href} className="mt-7 h-[42px] px-7 text-[14px]">{copy.cta.label}</Cta>
              </div>
              <div aria-hidden className="min-w-0"><SegmentFrame seg={seg} /></div>
            </m.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

function Frame({ active, children, title, action }: { active: Parameters<typeof AppSidebar>[0]['active']; children: ReactNode; title: string; action: string }) {
  return (
    <div className="overflow-hidden rounded-[14px] border border-cf-line bg-white shadow-cf-float">
      <div className="flex">
        <AppSidebar active={active} scale="sm" className="hidden sm:flex" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 border-b border-cf-line px-3 py-2">
            <span className="flex h-6 flex-1 items-center gap-1.5 rounded-[7px] bg-cf-surface px-2 text-[9px] text-cf-subtle"><Search className="h-3 w-3" />Search campaigns, content, creators…</span>
            <Bell className="h-3.5 w-3.5 text-cf-subtle" />
            <Avatar person={PEOPLE.priya} size={20} />
            <span className="flex h-6 items-center gap-1 rounded-[6px] bg-cf-blue px-2 text-[9.5px] font-medium text-white"><Plus className="h-3 w-3" />Create</span>
          </div>
          <div className="p-3">
            <div className="flex items-start justify-between">
              <div><p className="text-[14px] font-semibold text-cf-ink">{title}</p></div>
              <span className="flex h-6 items-center gap-1 rounded-[6px] bg-cf-blue px-2 text-[9px] font-medium text-white"><Plus className="h-3 w-3" />{action}</span>
            </div>
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

function SegmentFrame({ seg }: { seg: Segment }) {
  if (seg === 'brands') {
    return (
      <Frame active="campaigns" title="Campaigns" action="New campaign">
        <p className="text-[9.5px] text-cf-muted">Plan, create, collaborate and track all your marketing campaigns.</p>
        <div className="mt-2 flex gap-4 border-b border-cf-line text-[9.5px] text-cf-muted">{['All campaigns', 'Active', 'Planning', 'In review', 'Completed'].map((t) => <span key={t} className={cn('pb-1.5', t === 'All campaigns' && 'border-b-2 border-cf-blue font-medium text-cf-blue')}>{t}</span>)}</div>
        <ul className="mt-2 space-y-1.5">
          {CAMPAIGN_ROWS.map((r) => (
            <li key={r.name} className="grid grid-cols-[auto_1.5fr_0.8fr_0.7fr_1fr_1fr_auto] items-center gap-2 rounded-[9px] border border-cf-line px-2 py-1.5">
              <MediaThumb kind={r.thumb} className="h-[34px] w-[50px]" />
              <span className="min-w-0 text-[10px]"><span className="block font-semibold text-cf-ink">{r.name}</span><span className="rounded-[4px] bg-[#EAF2FF] px-1 text-[8px] text-cf-blue-deep">{r.type}</span><span className="block text-[8.5px] text-cf-muted">{r.dates}</span></span>
              <Pill tone={r.tone} className="justify-self-start text-[8.5px]">{r.state}</Pill>
              <AvatarStack people={TEAM.slice(0, 2)} size={18} extra="+3" />
              <span className="flex gap-1">{r.channels.map((c) => <ChannelIcon key={c} channel={c} size={13} />)}</span>
              <span className="flex items-center gap-1.5"><span className="h-1 flex-1 rounded-full bg-cf-line"><span className="block h-full rounded-full bg-cf-blue" style={{ width: `${r.progress}%` }} /></span><span className="text-[8.5px] text-cf-muted">{r.progress}%</span></span>
              <MoreHorizontal className="h-3.5 w-3.5 text-cf-subtle" />
            </li>
          ))}
        </ul>
      </Frame>
    )
  }
  if (seg === 'agencies') {
    return (
      <Frame active="home" title="Clients" action="Add client">
        <p className="text-[9.5px] text-cf-muted">Every client workspace, with live campaigns and approvals waiting.</p>
        <ul className="mt-3 space-y-1.5">
          {CLIENT_ROWS.map((c) => (
            <li key={c.name} className="grid grid-cols-[auto_1.6fr_1fr_1fr_1fr] items-center gap-3 rounded-[9px] border border-cf-line px-2.5 py-2 text-[10px]">
              <span className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[11px] font-bold text-white" style={{ background: `hsl(${c.hue} 60% 50%)` }}>{c.name[0]}</span>
              <span className="font-semibold text-cf-ink">{c.name}<span className="block text-[8.5px] font-normal text-cf-muted">{c.brands} brand{c.brands > 1 ? 's' : ''}</span></span>
              <span className="text-cf-body">{c.live} live campaigns</span>
              <Pill tone={c.approvals ? 'amber' : 'green'} className="justify-self-start text-[8.5px]">{c.approvals ? `${c.approvals} to approve` : 'All approved'}</Pill>
              <span className="flex items-center gap-1 text-cf-blue">Open workspace<ArrowRight className="h-3 w-3" /></span>
            </li>
          ))}
        </ul>
      </Frame>
    )
  }
  if (seg === 'businesses') {
    const days = [{ d: 'Mon', p: [['instagram', 'New menu drop']] }, { d: 'Tue', p: [['email', 'Weekly offers']] }, { d: 'Wed', p: [['instagram', 'Behind the scenes'], ['facebook', 'Event reminder']] }, { d: 'Thu', p: [] }, { d: 'Fri', p: [['tiktok', 'Weekend teaser']] }]
    return (
      <Frame active="calendar" title="This week" action="New post">
        <div className="mt-2 grid grid-cols-5 gap-1.5">
          {days.map((day) => (
            <div key={day.d} className="min-h-[150px] rounded-[9px] border border-cf-line p-1.5">
              <p className="text-[9px] font-medium text-cf-muted">{day.d}</p>
              <div className="mt-1.5 space-y-1.5">
                {day.p.map(([ch, t]) => <p key={t} className="flex items-center gap-1 rounded-[6px] bg-cf-tint px-1.5 py-1 text-[8.5px] text-cf-ink"><ChannelIcon channel={ch} size={11} />{t}</p>)}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 flex items-center gap-1.5 rounded-[8px] bg-cf-surface px-2 py-1.5 text-[9.5px] text-cf-body"><MessageSquareText className="h-3.5 w-3.5 text-cf-blue" />3 customer messages waiting in the inbox</p>
      </Frame>
    )
  }
  const cols = [{ t: 'Ideas', items: ['Morning routine reel', 'Q&A carousel'] }, { t: 'Drafting', items: ['Brand deal: trainers', 'Travel vlog cut'] }, { t: 'Scheduled', items: ['Weekend reel', 'Newsletter'] }]
  return (
    <Frame active="content" title="Content pipeline" action="New idea">
      <div className="mt-2 grid grid-cols-3 gap-2">
        {cols.map((c) => (
          <div key={c.t} className="rounded-[9px] bg-cf-surface p-1.5">
            <p className="flex justify-between px-0.5 text-[9.5px] font-medium text-cf-ink">{c.t}<span className="text-cf-muted">{c.items.length}</span></p>
            {c.items.map((it, i) => (
              <div key={it} className="mt-1.5 rounded-[8px] bg-white p-1.5 shadow-sm">
                <MediaThumb kind={i ? 'portrait' : 'mountain'} className="h-[46px] w-full" />
                <p className="mt-1 text-[9px] text-cf-ink">{it}</p>
              </div>
            ))}
          </div>
        ))}
      </div>
    </Frame>
  )
}

/* ─────────────────────────────── Product explorer ─────────────────────────────── */

function ProductExplorer({ integrations }: { integrations: IntegrationItem[] }) {
  const [tab, setTab] = useState<Explorer>('Campaigns')
  const baseId = useId()
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = EXPLORER.findIndex((x) => x.id === tab)
    const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!delta) return
    e.preventDefault()
    const next = (i + delta + EXPLORER.length) % EXPLORER.length
    setTab(EXPLORER[next].id)
    refs.current[next]?.focus()
  }
  const notes = NOTES[tab]

  return (
    <div id="product-proof" className="mt-8 scroll-mt-16 bg-gradient-to-b from-cf-tint/70 to-white pb-14 pt-6">
      <div className={CONTAINER}>
        <div className="mx-auto max-w-[1210px]">
          <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start">
            <div>
              <Eyebrow align="left" className="text-[11.5px] tracking-[0.3em]">Real product proof</Eyebrow>
              <h2 className="mt-3 text-[32px] font-bold leading-[1.08] tracking-[-0.02em] text-cf-ink sm:text-[34px]">See the system <Accent>working.</Accent></h2>
              <p className="mt-3 text-[15px] leading-[1.5] text-cf-muted">Explore the workflows your team would actually use inside Caption Fox.</p>
            </div>
            <div role="tablist" aria-label="Product explorer" onKeyDown={onKey} className="cf-hide-scrollbar flex gap-1 overflow-x-auto rounded-[16px] border border-cf-line bg-white p-1 shadow-cf-card lg:mt-0">
              {EXPLORER.map((x, i) => {
                const on = x.id === tab
                return (
                  <button
                    key={x.id}
                    ref={(el) => { refs.current[i] = el }}
                    id={`${baseId}-ex-${i}`}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    aria-controls={`${baseId}-ex-panel`}
                    tabIndex={on ? 0 : -1}
                    onClick={() => setTab(x.id)}
                    className={cn('relative flex min-h-11 shrink-0 flex-1 items-center justify-center gap-2 rounded-[12px] px-3.5 text-[13.5px] font-medium transition-colors', on ? 'text-white' : 'text-cf-body hover:text-cf-ink')}
                  >
                    {on && <m.span layoutId="explorer-pill" className="absolute inset-0 rounded-[12px] bg-cf-blue shadow-cf-button" transition={{ duration: 0.3, ease: EASE }} />}
                    <x.Icon aria-hidden className="relative h-[18px] w-[18px]" strokeWidth={1.8} />
                    <span className="relative">{x.id}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div id={`${baseId}-ex-panel`} role="tabpanel" aria-labelledby={`${baseId}-ex-${EXPLORER.findIndex((x) => x.id === tab)}`} className="relative mt-2 grid gap-4 lg:grid-cols-[164px_minmax(0,1fr)_152px] lg:items-center lg:gap-10">
            <ul className="order-2 grid gap-4 sm:grid-cols-2 lg:order-1 lg:grid-cols-1 lg:gap-6 lg:pt-10">
              {notes.slice(0, 2).map(([t, d], i) => <Note key={t} title={t} detail={d} icon={i ? <TrendingUp className="h-4 w-4" /> : <FileText className="h-4 w-4" />} side="left" />)}
            </ul>
            <AnimatePresence mode="wait" initial={false}>
              <m.div aria-hidden key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.26, ease: EASE }} className="order-1 min-w-0 lg:order-2">
                <ExplorerFrame tab={tab} />
              </m.div>
            </AnimatePresence>
            <ul className="order-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-1 lg:gap-8">
              {notes.slice(2).map(([t, d], i) => <Note key={t} title={t} detail={d} icon={i ? <Clock3 className="h-4 w-4" /> : <FileText className="h-4 w-4" />} side="right" />)}
            </ul>
          </div>

          <IntegrationStrip integrations={integrations} />
        </div>
      </div>
    </div>
  )
}

function Note({ title, detail, icon, side }: { title: string; detail: string; icon: ReactNode; side: 'left' | 'right' }) {
  return (
    <li className="relative rounded-[14px] border border-cf-line bg-white p-3.5 shadow-cf-card">
      <p className="flex items-start gap-2.5 text-[12.5px] font-semibold leading-snug text-cf-ink"><IconTile className="h-8 w-8 rounded-[8px]">{icon}</IconTile>{title}</p>
      <p className="mt-2 pl-[42px] text-[11px] leading-[1.5] text-cf-muted">{detail}</p>
      <span aria-hidden className={cn('absolute top-1/2 hidden h-3 w-3 -translate-y-1/2 rounded-full border-2 border-cf-blue bg-white lg:block', side === 'left' ? '-right-[26px]' : '-left-[26px]')} />
      <span aria-hidden className={cn('absolute top-1/2 hidden h-px w-[20px] bg-cf-blue/50 lg:block', side === 'left' ? '-right-[20px]' : '-left-[20px]')} />
    </li>
  )
}

function ExplorerFrame({ tab }: { tab: Explorer }) {
  return (
    <div className="overflow-hidden rounded-[14px] border border-cf-line-strong bg-white shadow-cf-float">
      <div className="flex min-h-[320px]">
        <AppSidebar active={tab === 'Campaigns' ? 'campaigns' : tab === 'Studio' ? 'content' : tab === 'Social' ? 'calendar' : tab === 'Creators' ? 'creators' : tab === 'Analytics' ? 'analytics' : 'automations'} scale="sm" className="hidden sm:flex" />
        <div className="min-w-0 flex-1 p-3">
          {tab === 'Campaigns' && <CampaignDetail />}
          {tab === 'Studio' && <><FrameHead title="Content studio" crumb="Summer Collection" /><StudioModule /></>}
          {tab === 'Social' && <><FrameHead title="Channels" crumb="Social" /><ChannelList /></>}
          {tab === 'Creators' && <><FrameHead title="Creators" crumb="Summer Collection" /><CreatorModule /></>}
          {tab === 'Analytics' && <><FrameHead title="Cross-channel report" crumb="Analytics" /><AnalyticsModule /></>}
          {tab === 'Automations' && <><FrameHead title="Approved content → schedule" crumb="Automations" /><div className="max-w-[360px]"><AutomationSteps /></div></>}
        </div>
      </div>
    </div>
  )
}

function FrameHead({ title, crumb }: { title: string; crumb: string }) {
  return (
    <div className="mb-3">
      <p className="text-[9px] text-cf-muted">{crumb}</p>
      <p className="text-[14px] font-semibold text-cf-ink">{title}</p>
    </div>
  )
}

function CampaignDetail() {
  return (
    <div>
      <p className="text-[9px] text-cf-muted">Campaigns › Summer Collection</p>
      <div className="mt-1 flex items-start justify-between">
        <div>
          <p className="flex items-center gap-2 text-[15px] font-semibold text-cf-ink">Summer Collection<Pill tone="green" className="text-[8.5px]">Active</Pill></p>
          <p className="flex items-center gap-1.5 text-[9px] text-cf-muted">Product launch · 1 Mar – 30 Apr · Owner <AvatarStack people={TEAM.slice(0, 2)} size={16} extra="+2" /></p>
        </div>
        <span className="flex items-center gap-1.5"><span className="flex h-6 items-center gap-1 rounded-[6px] border border-cf-line px-2 text-[9px]"><Share2 className="h-3 w-3" />Share</span><span className="flex h-6 items-center rounded-[6px] bg-cf-blue px-2.5 text-[9px] font-medium text-white">Edit</span><MoreHorizontal className="h-3.5 w-3.5 text-cf-subtle" /></span>
      </div>
      <div className="mt-2 flex gap-4 border-b border-cf-line text-[9px] text-cf-muted">{['Overview', 'Brief', 'Audience', 'Content', 'Calendar', 'Budget', 'Approvals', 'Results'].map((t) => <span key={t} className={cn('pb-1.5', t === 'Overview' && 'border-b-2 border-cf-blue font-medium text-cf-blue')}>{t}</span>)}</div>
      <div className="mt-2.5 grid gap-2 md:grid-cols-[0.9fr_1.1fr_1fr]">
        <div className="rounded-[9px] border border-cf-line p-2">
          <p className="text-[9.5px] font-semibold text-cf-ink">Campaign overview</p>
          <MediaThumb kind="proof" className="mt-1.5 h-[92px] w-full" />
        </div>
        <div className="rounded-[9px] border border-cf-line p-2">
          <p className="text-[9.5px] font-semibold text-cf-ink">Key details</p>
          <dl className="mt-1.5 space-y-1.5 text-[8.5px]">{PROOF.keyDetails.map((k) => <div key={k.label} className="grid grid-cols-[62px_1fr] gap-1"><dt className="text-cf-muted">{k.label}</dt><dd className="text-cf-body">{k.value}</dd></div>)}</dl>
        </div>
        <div className="rounded-[9px] border border-cf-line p-2">
          <p className="text-[9.5px] font-semibold text-cf-ink">Recent activity</p>
          <ul className="mt-1.5 space-y-1.5">{PROOF.activity.map((a) => <li key={a.text} className="flex items-center gap-1.5 text-[8.5px] text-cf-body"><Avatar person={a.person} size={16} /><span className="flex-1">{a.text}</span><span className="text-cf-subtle">{a.time}</span></li>)}</ul>
        </div>
      </div>
      <div className="mt-2 rounded-[9px] border border-cf-line p-2">
        <p className="text-[9.5px] font-semibold text-cf-ink">Progress</p>
        <p className="mt-1 flex items-center gap-3 text-[9px] text-cf-muted"><span className="text-[12px] font-semibold text-cf-ink">{PROOF.progress.pct}%</span>{PROOF.progress.done} of {PROOF.progress.total} tasks complete<span className="h-1.5 flex-1 rounded-full bg-cf-line"><span className="block h-full rounded-full bg-cf-blue" style={{ width: `${PROOF.progress.pct}%` }} /></span></p>
      </div>
    </div>
  )
}

function IntegrationStrip({ integrations }: { integrations: IntegrationItem[] }) {
  return (
    <div className="mt-6">
      <div className="flex flex-col gap-4 rounded-[18px] border border-cf-line bg-white p-4 shadow-cf-card lg:flex-row lg:items-center">
        <h3 className="shrink-0 text-[14px] font-semibold text-cf-ink lg:w-[190px] lg:pl-2">Work with the tools you already use</h3>
        <ul className="cf-hide-scrollbar flex flex-1 gap-2 overflow-x-auto pb-1 lg:pb-0">
          {integrations.map((it) => (
            <li key={it.key} className="flex min-w-[112px] shrink-0 items-center gap-2 rounded-[12px] border border-cf-line px-2.5 py-2">
              <ChannelIcon channel={it.key} size={24} />
              <span className="text-[11px] leading-tight text-cf-ink">{it.label}<span className="block text-[9.5px] text-cf-muted">{it.category}</span><span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-[#E7F7EE] px-1.5 text-[8.5px] font-medium text-[#157A45]"><span className="h-1 w-1 rounded-full bg-[#1DB954]" />Available</span></span>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-3 flex flex-col gap-2 px-1 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 text-[12px] text-cf-muted"><Lock aria-hidden className="h-3.5 w-3.5" />Workspace data is separated with row-level security, and connected social account credentials are encrypted.</p>
        <TextLink href="/legal/dpa" className="text-[12.5px]">Read our data processing terms</TextLink>
      </div>
    </div>
  )
}

export { Globe }
