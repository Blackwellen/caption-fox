'use client'

import { m, useMotionValueEvent, useReducedMotion, useScroll } from 'framer-motion'
import {
  ArrowLeft, ArrowRight, BarChart3, Bell, Calendar, CheckCircle2, ChevronLeft, ChevronRight, CircleCheck, CirclePlay, Crosshair,
  Flag, Folder, Globe, Lightbulb, MessageSquareText, MoreHorizontal, Package, RotateCw, Search, Send, Share2, User, Users,
} from 'lucide-react'
import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { ChannelIcon } from './brand-icons'
import { COMMAND, PEOPLE, TEAM } from './demo-data'
import { ConnectorPath } from './ConnectorPath'
import { InView } from './motion'
import { Accent, AppSidebar, AvatarStack, CONTAINER, Cta, Eyebrow, IconTile, Lead, MediaThumb, Pill, SampleBadge, SectionTitle, toneFor } from './primitives'

const TABS = ['Overview', 'Brief', 'Audience', 'Content', 'Calendar', 'Budget', 'Approvals', 'Results'] as const
type TabName = (typeof TABS)[number]
/** Only four meaningful states advance with scroll; every tab stays directly clickable. */
const STORY: TabName[] = ['Overview', 'Content', 'Approvals', 'Results']
type Relation = 'brand' | 'strategy' | 'creators' | 'publishing' | 'approvals' | 'performance'
const RELATION_FOR: Record<TabName, Relation | null> = {
  Overview: null, Brief: 'strategy', Audience: 'strategy', Content: 'brand', Calendar: 'publishing', Budget: 'performance', Approvals: 'approvals', Results: 'performance',
}

/** SECTION 05 — Campaign command centre (one of two scroll-linked narrative sections). */
export default function CampaignCommandCentre() {
  const storyRef = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const [tab, setTab] = useState<TabName>('Overview')
  const [sticky, setSticky] = useState(false)
  const { scrollYProgress } = useScroll({ target: storyRef, offset: ['start start', 'end end'] })
  const lastStage = useRef(0)

  useEffect(() => {
    const check = () => setSticky(!reduced && window.innerWidth >= 1280 && window.innerHeight >= 780)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [reduced])

  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    if (!sticky) return
    const stage = Math.min(STORY.length - 1, Math.floor(v * STORY.length))
    if (stage !== lastStage.current) {
      lastStage.current = stage
      setTab(STORY[stage])
    }
  })

  const highlight = RELATION_FOR[tab]

  return (
    <section aria-labelledby="command-title" className="bg-white">
      <div className={cn(CONTAINER, 'pt-14 lg:pt-[38px]')}>
        <Eyebrow className="tracking-[0.34em]">Campaign operations</Eyebrow>
        <SectionTitle id="command-title" className="mt-3 text-center">
          From brief to result, <Accent>without losing the thread.</Accent>
        </SectionTitle>
        <Lead className="mx-auto mt-4 max-w-[640px] text-center">
          A Caption Fox campaign connects planning, content, people, approvals, channels, budgets and reporting around one piece of work.
        </Lead>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
          <Cta href="/features#campaigns" className="h-[46px] px-[22px]">Explore campaign management</Cta>
          <Cta href="#product-proof" variant="secondary" arrow={false} className="h-[46px] px-[22px]">
            <CirclePlay aria-hidden className="h-5 w-5 text-cf-blue" strokeWidth={1.8} />See it in action
          </Cta>
        </div>
      </div>

      <div ref={storyRef} style={sticky ? { height: 'calc(100vh + 150vh)' } : undefined} className="relative">
        <div className={cn(sticky && 'sticky top-[64px] flex h-[calc(100vh-64px)] items-center')}>
          <div className={cn(CONTAINER, 'w-full pb-16 pt-8 xl:pb-10 xl:pt-4')}>
            <InView className="relative mx-auto xl:h-[666px] xl:w-[1365px] [@media(min-width:1280px)_and_(max-width:1439px)]:[zoom:0.875]">
              <Connectors />
              <Relations highlight={highlight} />
              <div className="relative xl:absolute xl:left-[292px] xl:top-[101px] xl:w-[783px]">
                <CampaignWorkspace tab={tab} onTab={setTab} />
              </div>
              <p aria-hidden className="pointer-events-none absolute left-[1064px] top-[578px] hidden rotate-[-6deg] font-[family-name:var(--font-caveat)] text-[26px] leading-[1.15] text-cf-blue/80 xl:block">
                Everything<br />connected to<br />the campaign.
              </p>
            </InView>
          </div>
        </div>
      </div>
    </section>
  )
}

function Connectors() {
  const paths = [
    'M224 160 C 262 160, 258 210, 292 210',
    'M221 420 C 262 420, 256 300, 292 300',
    'M505 40 C 450 40, 445 60, 445 101',
    'M1144 200 C 1104 200, 1110 240, 1075 240',
    'M1144 420 C 1104 420, 1110 330, 1075 330',
    'M682 575 L 682 532',
  ]
  const dots: [number, number][] = [[224, 160], [292, 210], [221, 420], [292, 300], [505, 40], [445, 101], [1144, 200], [1075, 240], [1144, 420], [1075, 330], [682, 575], [682, 532]]
  return (
    <svg aria-hidden className="pointer-events-none absolute inset-0 hidden h-full w-full overflow-visible xl:block" viewBox="0 0 1365 666" fill="none">
      {paths.map((d, i) => (
        <ConnectorPath key={d} d={d} delay={200 + i * 90} dashed opacity={0.7} />
      ))}
      {dots.map(([cx, cy]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="4" fill="#1769FF" />)}
    </svg>
  )
}

function RelationCard({ id, on, style, title, icon, children, link }: { id: Relation; on: boolean; style: CSSProperties; title: string; icon: ReactNode; children: ReactNode; link?: string }) {
  return (
    <div
      data-relation={id}
      className={cn(
        'cf-reveal min-w-0 rounded-[16px] border bg-white p-4 shadow-cf-card transition-[border-color,box-shadow] duration-300 xl:absolute xl:w-[var(--w)] xl:min-h-[var(--mh)]',
        on ? 'border-cf-blue/60 shadow-[0_0_0_4px_rgba(23,105,255,0.10),0_22px_48px_-22px_rgba(23,105,255,0.35)]' : 'border-cf-line',
      )}
      style={style}
    >
      <p className="flex items-center gap-2.5 whitespace-nowrap text-[14px] font-semibold tracking-[-0.01em] text-cf-ink">
        <IconTile className="h-[38px] w-[38px] rounded-[10px]">{icon}</IconTile>
        {title}
      </p>
      <div className="mt-3">{children}</div>
      {link && <p className="mt-3 flex items-center gap-1.5 text-[12px] font-medium text-cf-blue">{link}<ArrowRight className="h-3.5 w-3.5" /></p>}
    </div>
  )
}

/** Desktop canvas geometry. Width/height go through CSS vars so they only apply at xl; below xl the cards flow in a grid. */
const box = (left: number, top: number, width: number, minHeight: number, d: number) =>
  ({ left, top, '--w': `${width}px`, '--mh': `${minHeight}px`, '--d': `${d}ms` }) as CSSProperties

function Relations({ highlight }: { highlight: Relation | null }) {
  return (
    <div aria-hidden className="order-2 mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:mt-0 xl:block">
      <div
        data-relation="creators"
        className={cn(
          'cf-reveal flex min-w-0 flex-wrap items-center gap-3 rounded-[16px] border bg-white px-4 py-3 shadow-cf-card transition-[border-color,box-shadow] duration-300 xl:absolute xl:w-[var(--w)] xl:min-h-[var(--mh)] xl:flex-nowrap',
          highlight === 'creators' ? 'border-cf-blue/60' : 'border-cf-line',
        )}
        style={box(505, 0, 354, 78, 120)}
      >
        <IconTile className="h-[44px] w-[44px] rounded-[11px]"><Users className="h-5 w-5" strokeWidth={1.9} /></IconTile>
        <span className="shrink-0">
          <span className="block whitespace-nowrap text-[14px] font-semibold text-cf-ink">Creators &amp; team</span>
          <span className="mt-1 block"><AvatarStack people={TEAM} size={26} extra="+3" /></span>
        </span>
        <span className="ml-1 text-[11px] leading-snug text-cf-muted">Assign creators, collaborators and stakeholders.</span>
        <ChevronRight className="h-4 w-4 shrink-0 text-cf-subtle" />
      </div>
      <RelationCard id="brand" on={highlight === 'brand'} title="Brand & assets" icon={<Folder className="h-5 w-5" strokeWidth={1.9} />} style={box(0, 58, 224, 205, 160)} link="View assets">
        <div className="grid grid-cols-3 gap-2">
          <MediaThumb kind="brand-sneaker" className="h-[58px]" />
          <MediaThumb kind="abstract" className="h-[58px]" />
          <span className="flex h-[58px] items-center justify-center rounded-[8px] bg-cf-surface text-[22px] font-medium text-cf-ink">Aa</span>
        </div>
        <p className="mt-3 text-[11.5px] leading-snug text-cf-muted">Keep your brand, assets and guidelines in context.</p>
      </RelationCard>
      <RelationCard id="strategy" on={highlight === 'strategy'} title="Strategy & audience" icon={<Crosshair className="h-5 w-5" strokeWidth={1.9} />} style={box(0, 310, 221, 258, 200)} link="View strategy">
        <ul className="divide-y divide-cf-line rounded-[10px] border border-cf-line">
          {COMMAND.strategy.map((s, i) => {
            const I = [Flag, User, Lightbulb, MessageSquareText][i]
            return <li key={s} className="flex items-center gap-2.5 px-2.5 py-2 text-[12px] text-cf-body"><I className="h-4 w-4 text-cf-blue" strokeWidth={1.8} />{s}</li>
          })}
        </ul>
      </RelationCard>
      <RelationCard id="publishing" on={highlight === 'publishing'} title="Publishing schedule" icon={<Send className="h-5 w-5" strokeWidth={1.9} />} style={box(1144, 40, 221, 246, 240)} link="View calendar">
        <ul className="space-y-2.5">
          {COMMAND.publishing.map((p) => (
            <li key={p.label} className="flex items-center gap-2.5 text-[11.5px] text-cf-body"><ChannelIcon channel={p.channel} size={20} /><span className="flex-1">{p.label}</span><Pill tone={p.tone} className="text-[10px]">{p.state}</Pill></li>
          ))}
        </ul>
      </RelationCard>
      <RelationCard id="approvals" on={highlight === 'approvals'} title="Approvals" icon={<CircleCheck className="h-5 w-5" strokeWidth={1.9} />} style={box(1144, 326, 221, 211, 280)} link="View approvals">
        <ul className="space-y-3">
          {COMMAND.approvals.map((a, i) => (
            <li key={a.title} className="flex items-center gap-2.5">
              <MediaThumb kind={i ? 'shoe-dark' : 'sneakers'} className="h-[34px] w-[38px] shrink-0" />
              <span className="min-w-0 flex-1 text-[11px]"><span className="block font-medium text-cf-ink">{a.title}</span><span className="text-cf-muted">{a.detail}</span></span>
              <Pill tone={a.tone} className="text-[10px]">{a.state}</Pill>
            </li>
          ))}
        </ul>
      </RelationCard>
      <RelationCard id="performance" on={highlight === 'performance'} title="Performance & budget" icon={<BarChart3 className="h-5 w-5" strokeWidth={2} />} style={box(498, 575, 368, 91, 320)}>
        <span className="flex flex-wrap items-end justify-between gap-3 xl:-mt-6 xl:flex-nowrap xl:pl-[54px]">
          <span><span className="flex items-center gap-2 text-[16px] font-semibold text-[#157A45]"><span className="h-2.5 w-2.5 rounded-full bg-[#1DB954]" />On track</span><span className="text-[11px] text-cf-muted">Spend vs. plan</span></span>
          <span className="flex h-[36px] items-end gap-1">{[30, 45, 38, 60, 72, 58, 90].map((h, i) => <span key={i} className="w-[7px] rounded-t-[2px] bg-[#A8C8FF]" style={{ height: `${h}%` }} />)}</span>
          <span className="flex items-center gap-1 text-[12px] font-medium text-cf-blue">View results<ArrowRight className="h-3.5 w-3.5" /></span>
        </span>
      </RelationCard>
    </div>
  )
}

function CampaignWorkspace({ tab, onTab }: { tab: TabName; onTab: (t: TabName) => void }) {
  const baseId = useId()
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = TABS.indexOf(tab)
    let next = i
    if (e.key === 'ArrowRight') next = (i + 1) % TABS.length
    else if (e.key === 'ArrowLeft') next = (i - 1 + TABS.length) % TABS.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = TABS.length - 1
    else return
    e.preventDefault()
    onTab(TABS[next])
    tabRefs.current[next]?.focus()
  }

  return (
    <div className="cf-reveal overflow-hidden rounded-[18px] border border-cf-line-strong bg-white shadow-[0_2px_6px_rgba(10,22,48,0.04),0_30px_60px_-30px_rgba(23,105,255,0.35)]">
      <div className="flex xl:min-h-[431px]">
        <AppSidebar active="campaigns" className="hidden md:flex" />
        <div className="min-w-0 flex-1">
          <div aria-hidden className="flex items-center justify-between border-b border-cf-line px-4 py-2 text-cf-subtle">
            <span className="flex gap-3"><ChevronLeft className="h-4 w-4" /><ChevronRight className="h-4 w-4" /><RotateCw className="h-3.5 w-3.5" /></span>
            <span className="flex items-center gap-3"><Search className="h-3.5 w-3.5" /><Bell className="h-3.5 w-3.5" /><Globe className="h-3.5 w-3.5" /><AvatarStack people={[PEOPLE.priya]} size={22} /></span>
          </div>
          <div className="px-4 pt-2.5 sm:px-5">
            <p aria-hidden className="flex items-center gap-1.5 text-[10.5px] text-cf-muted"><ArrowLeft className="h-3 w-3" />Campaigns</p>
            <div className="mt-1.5 flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="flex flex-wrap items-center gap-2 text-[18px] font-semibold tracking-[-0.02em] text-cf-ink">{COMMAND.name}<Pill tone="green">Active</Pill></h3>
                <p className="mt-0.5 text-[11.5px] text-cf-muted">{COMMAND.summary}</p>
              </div>
              <span aria-hidden className="flex items-center gap-2">
                <span className="flex h-7 items-center gap-1 rounded-[7px] border border-cf-line px-2.5 text-[10.5px] text-cf-body"><Share2 className="h-3 w-3" />Share</span>
                <span className="flex h-7 items-center gap-1 rounded-[7px] bg-cf-blue px-2.5 text-[10.5px] font-medium text-white">Next action<ArrowRight className="h-3 w-3" /></span>
                <MoreHorizontal className="h-4 w-4 text-cf-subtle" />
              </span>
            </div>
            <div aria-hidden className="mt-2.5 flex flex-wrap items-center gap-2 text-[10px] text-cf-body">
              <span className="flex items-center gap-1 rounded-[7px] border border-cf-line px-2 py-1"><Calendar className="h-3 w-3" />{COMMAND.dates}</span>
              <AvatarStack people={TEAM} size={22} extra="+3" />
              {COMMAND.chips.map((c) => <span key={c} className="flex items-center gap-1 rounded-[7px] border border-cf-line px-2 py-1"><Package className="h-3 w-3" />{c}</span>)}
            </div>

            <div role="tablist" aria-label="Campaign workspace views" onKeyDown={onKey} className="cf-hide-scrollbar mt-3 flex gap-1 overflow-x-auto border-b border-cf-line">
              {TABS.map((t, i) => {
                const selected = t === tab
                return (
                  <button
                    key={t}
                    ref={(el) => { tabRefs.current[i] = el }}
                    id={`${baseId}-tab-${i}`}
                    role="tab"
                    type="button"
                    aria-selected={selected}
                    aria-controls={`${baseId}-panel`}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => onTab(t)}
                    className={cn('relative min-h-9 shrink-0 px-2.5 pb-2 pt-1 text-[11.5px] transition-colors', selected ? 'font-medium text-cf-blue' : 'text-cf-muted hover:text-cf-ink')}
                  >
                    {t}
                    {selected && <m.span layoutId="cmd-tab-underline" className="absolute inset-x-1 bottom-[-1px] h-[2px] rounded-full bg-cf-blue" transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }} />}
                  </button>
                )
              })}
            </div>
          </div>
          <div id={`${baseId}-panel`} role="tabpanel" aria-labelledby={`${baseId}-tab-${TABS.indexOf(tab)}`} className="px-4 py-3 sm:px-5">
            <m.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28 }}>
              <TabPanel tab={tab} />
            </m.div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Box({ title, right, children, className }: { title: string; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-[12px] border border-cf-line p-3', className)}>
      <p className="flex items-center justify-between text-[11.5px] font-semibold text-cf-ink">{title}{right}</p>
      <div className="mt-2.5">{children}</div>
    </div>
  )
}

function StepIcon({ state }: { state: string }) {
  if (state === 'Completed') return <CheckCircle2 className="h-4 w-4 fill-[#1DB954] text-white" strokeWidth={2.4} />
  if (state === 'In progress') return <CheckCircle2 className="h-4 w-4 fill-cf-blue text-white" strokeWidth={2.4} />
  if (state === 'Pending') return <CheckCircle2 className="h-4 w-4 fill-[#F59E0B] text-white" strokeWidth={2.4} />
  return <CheckCircle2 className="h-4 w-4 fill-[#C5CFDD] text-white" strokeWidth={2.4} />
}

function TabPanel({ tab }: { tab: TabName }) {
  const pct = Math.round((COMMAND.progress.done / COMMAND.progress.total) * 100)
  switch (tab) {
    case 'Overview':
      return (
        <div className="grid gap-3 md:grid-cols-[1.35fr_0.85fr_1fr]">
          <Box title="Campaign progress" right={<span className="text-[9.5px] font-normal text-cf-muted">{COMMAND.progress.done} / {COMMAND.progress.total} tasks complete</span>}>
            <span className="block h-2 rounded-full bg-cf-line"><span className="block h-full rounded-full bg-cf-blue" style={{ width: `${pct}%` }} /></span>
            <ul className="mt-2 space-y-[5px]">
              {COMMAND.steps.map((s) => (
                <li key={s.label} className="flex items-center gap-2 text-[10.5px] text-cf-body"><StepIcon state={s.state} /><span className="flex-1">{s.label}</span><Pill tone={toneFor(s.state)} dot={false} className="text-[9px]">{s.state}</Pill></li>
              ))}
            </ul>
          </Box>
          <Box title="Next up">
            <MediaThumb kind="nextup" className="h-[70px] w-full" />
            <p className="mt-2 text-[11px] font-semibold text-cf-ink">{COMMAND.nextUp.title}</p>
            <p className="text-[10px] text-cf-muted">{COMMAND.nextUp.detail}</p>
            <div className="mt-2 flex items-center justify-between"><AvatarStack people={[PEOPLE.sophie, PEOPLE.james]} size={20} extra="+2" /></div>
            <p className="mt-1.5 flex items-center gap-1 text-[9.5px] text-cf-muted"><Calendar className="h-3 w-3" />{COMMAND.nextUp.due}</p>
            <span aria-hidden className="mt-2 flex h-7 items-center justify-center gap-1 rounded-[7px] bg-cf-blue text-[10.5px] font-medium text-white">Review<ArrowRight className="h-3 w-3" /></span>
          </Box>
          <Box title="Campaign at a glance">
            <dl className="space-y-[7px] text-[10.5px]">
              {COMMAND.glance.slice(0, 1).map((g) => <div key={g.label} className="flex justify-between"><dt className="text-cf-muted">{g.label}</dt><dd><Pill tone={g.tone} dot={false} className="text-[9.5px]">{g.value}</Pill></dd></div>)}
              <div className="flex justify-between"><dt className="text-cf-muted">Channels</dt><dd className="flex gap-1">{['instagram', 'tiktok', 'linkedin', 'email'].map((c) => <ChannelIcon key={c} channel={c} size={14} />)}</dd></div>
              {COMMAND.glance.slice(1).map((g) => <div key={g.label} className="flex justify-between"><dt className="text-cf-muted">{g.label}</dt><dd>{g.tone === 'slate' ? <span className="text-cf-body">{g.value}</span> : <Pill tone={g.tone} dot={false} className="text-[9.5px]">{g.value}</Pill>}</dd></div>)}
            </dl>
            <p className="mt-3 flex items-center gap-1 text-[10.5px] font-medium text-cf-blue">View full campaign details<ArrowRight className="h-3 w-3" /></p>
          </Box>
        </div>
      )
    case 'Brief':
      return (
        <div className="grid gap-3 md:grid-cols-2">
          <Box title="Objective"><p className="text-[11px] leading-relaxed text-cf-body">Launch the summer collection and build awareness with new audiences across social, email and web.</p></Box>
          <Box title="Key messages"><ul className="space-y-1.5 text-[11px] text-cf-body">{['Designed for what’s next', 'Built for creators and teams', 'Available now'].map((k) => <li key={k} className="flex gap-2"><CircleCheck className="h-3.5 w-3.5 text-[#1DB954]" />{k}</li>)}</ul></Box>
          <Box title="Deliverables" className="md:col-span-2"><div className="flex flex-wrap gap-2">{['Hero video', 'Carousel', '3 creator videos', 'Launch email', 'Landing page'].map((d) => <span key={d} className="rounded-full bg-cf-surface px-2.5 py-1 text-[10.5px] text-cf-body">{d}</span>)}</div></Box>
        </div>
      )
    case 'Audience':
      return (
        <Box title="Audience segments">
          <ul className="divide-y divide-cf-line">{COMMAND.audience.map((a) => <li key={a.name} className="flex items-center justify-between py-2 text-[11px] text-cf-body"><span className="flex items-center gap-2"><Users className="h-4 w-4 text-cf-blue" />{a.name}</span><Pill tone="blue" dot={false} className="text-[9.5px]">{a.size}</Pill></li>)}</ul>
        </Box>
      )
    case 'Content':
      return (
        <Box title="Campaign content" right={<span className="text-[10px] font-medium text-cf-blue">4 items</span>}>
          <ul className="divide-y divide-cf-line">{COMMAND.content.map((c, i) => <li key={c.title} className="flex items-center gap-3 py-2 text-[11px]"><MediaThumb kind={(['product', 'portrait', 'text', 'abstract'] as const)[i]} className="h-8 w-10 shrink-0 text-[6px]" /><span className="flex-1"><span className="block font-medium text-cf-ink">{c.title}</span><span className="text-cf-muted">{c.type}</span></span><Pill tone={c.tone} className="text-[9.5px]">{c.state}</Pill></li>)}</ul>
        </Box>
      )
    case 'Calendar':
      return (
        <div className="grid grid-cols-5 gap-2">
          {COMMAND.calendar.map((d) => (
            <div key={d.day} className="min-h-[150px] rounded-[10px] border border-cf-line p-2">
              <p className="text-[10px] text-cf-muted">{d.day} <span className="font-semibold text-cf-ink">{d.date}</span></p>
              <div className="mt-2 space-y-1.5">{d.items.map((it) => <p key={it} className="rounded-[6px] bg-[#EAF2FF] px-1.5 py-1 text-[9.5px] text-cf-blue">{it}</p>)}</div>
            </div>
          ))}
        </div>
      )
    case 'Budget':
      return (
        <Box title="Budget split" right={<SampleBadge />}>
          <ul className="space-y-3">{COMMAND.budget.map((b) => <li key={b.label} className="text-[11px]"><p className="flex justify-between text-cf-body"><span>{b.label}</span><span className="text-cf-muted">{b.spent}% of {b.planned}% planned</span></p><span className="mt-1 block h-2 rounded-full bg-cf-line"><span className="block h-full rounded-full bg-cf-blue" style={{ width: `${(b.spent / b.planned) * 100}%` }} /></span></li>)}</ul>
        </Box>
      )
    case 'Approvals':
      return (
        <Box title="Approval queue">
          <ul className="divide-y divide-cf-line">{[...COMMAND.approvals, { title: 'Creator video 2', detail: 'Brand review', state: 'Approved', tone: 'green' as const }].map((a, i) => <li key={a.title} className="flex items-center gap-3 py-2 text-[11px]"><MediaThumb kind={(['product', 'mountain', 'portrait'] as const)[i]} className="h-8 w-10 shrink-0" /><span className="flex-1"><span className="block font-medium text-cf-ink">{a.title}</span><span className="text-cf-muted">{a.detail}</span></span><Pill tone={a.tone} className="text-[9.5px]">{a.state}</Pill></li>)}</ul>
        </Box>
      )
    case 'Results':
      return (
        <Box title="Results" right={<SampleBadge />}>
          <div className="flex h-[150px] items-end gap-3 px-2">{COMMAND.results.bars.map((b, i) => <m.span key={i} initial={{ height: 0 }} animate={{ height: `${b}%` }} transition={{ duration: 0.5, delay: i * 0.04 }} className="flex-1 rounded-t-[4px] bg-gradient-to-t from-cf-blue to-[#8FBCFF]" />)}</div>
          <p className="mt-2 flex gap-4 text-[10px] text-cf-muted">{COMMAND.results.labels.map((l) => <span key={l}>{l}</span>)}</p>
        </Box>
      )
  }
}
