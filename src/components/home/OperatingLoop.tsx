'use client'

import { m, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import { BarChart3, ChevronDown, Crosshair, Building2, MapPin, MessagesSquare, PenLine, Send, UserCheck, User, ArrowRight, CheckCircle2 } from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { AUTH_LINKS } from '@/lib/marketing-links'
import { ChannelIcon } from './brand-icons'
import { LOOP, PEOPLE } from './demo-data'
import { Accent, Avatar, AvatarStack, CONTAINER, Cta, Eyebrow, FoxMark, IconTile, Lead, MediaThumb, Pill, SampleBadge, SectionTitle, toneFor } from './primitives'

const STAGES = [
  { n: '01', title: 'Plan', desc: 'Set your goals, audience and campaign brief.', Icon: Crosshair },
  { n: '02', title: 'Create', desc: 'Produce on-brand content with AI and your team.', Icon: PenLine },
  { n: '03', title: 'Approve', desc: 'Get feedback and keep things moving.', Icon: UserCheck },
  { n: '04', title: 'Launch', desc: 'Publish across all your channels, on schedule.', Icon: Send },
  { n: '05', title: 'Engage', desc: 'Manage conversations and creator activity.', Icon: MessagesSquare },
  { n: '06', title: 'Learn', desc: 'See what’s working and do more of it.', Icon: BarChart3 },
] as const

/** SECTION 02 — Operating loop. Scroll drives only the progress rail and the active stage. */
export default function OperatingLoop() {
  const ref = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.75', 'end 0.55'] })
  const railScale = useTransform(scrollYProgress, [0, 1], [1 / 12, 1])
  const [active, setActive] = useState(0)
  useMotionValueEvent(scrollYProgress, 'change', (v) => setActive(Math.min(5, Math.max(0, Math.floor(v * 6)))))
  const current = reduced ? -1 : active

  return (
    <section id="how-it-works" aria-labelledby="loop-title" className="relative scroll-mt-16 overflow-hidden bg-cf-surface">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(#EDF2FA_1px,transparent_1px),linear-gradient(90deg,#EDF2FA_1px,transparent_1px)] bg-[size:48px_48px] opacity-60 [mask-image:linear-gradient(to_bottom,black,transparent_40%)]" />
      <div className={cn(CONTAINER, 'relative pb-16 pt-12 lg:pb-[42px] lg:pt-[48px]')}>
        <Eyebrow className="tracking-[0.34em]">How Caption Fox works</Eyebrow>
        <SectionTitle id="loop-title" className="mx-auto mt-4 max-w-[900px] text-center">
          From idea to outcome — <Accent>one connected marketing loop.</Accent>
        </SectionTitle>
        <Lead className="mx-auto mt-4 max-w-[680px] text-center">
          Every stage keeps the context from the stage before it, so campaigns, content, conversations and reporting stay connected.
        </Lead>

        <div ref={ref} className="relative mt-10 lg:mt-[34px]">
          {/* Desktop rail */}
          <div className="relative hidden xl:block" aria-hidden>
            <div className="absolute left-[8.33%] right-[8.33%] top-[27px] h-[2px] bg-cf-rail" />
            <m.div
              className="absolute left-[8.33%] right-[8.33%] top-[27px] h-[2px] origin-left bg-cf-blue"
              style={{ scaleX: reduced ? 1 : railScale }}
            />
            <ol className="relative grid grid-cols-6 gap-4">
              {STAGES.map((s, i) => {
                const on = reduced ? i === 0 : i <= current
                const now = i === current || (reduced && i === 0)
                return (
                  <li key={s.n} className="flex flex-col items-center">
                    <span
                      className={cn(
                        'flex h-[56px] w-[56px] items-center justify-center rounded-full border text-[17px] font-medium transition-all duration-300',
                        now ? 'border-cf-blue bg-cf-blue text-white shadow-[0_0_0_6px_rgba(23,105,255,0.14)]' : on ? 'border-cf-blue/50 bg-white text-cf-blue' : 'border-cf-rail bg-white text-cf-ink',
                      )}
                    >
                      {s.n}
                    </span>
                    <span className={cn('mt-2 text-[19px] font-semibold tracking-[-0.02em] transition-colors', now ? 'text-cf-blue' : 'text-cf-ink')}>{s.title}</span>
                  </li>
                )
              })}
            </ol>
          </div>

          {/* Mobile / tablet vertical rail */}
          <div aria-hidden className="absolute bottom-6 left-[21px] top-2 w-[2px] bg-cf-rail md:hidden">
            <m.div className="h-full w-full origin-top bg-cf-blue" style={{ scaleY: reduced ? 1 : railScale }} />
          </div>

          <ol className="relative mt-0 grid grid-cols-1 gap-5 pl-14 md:grid-cols-2 md:gap-4 md:pl-0 lg:grid-cols-3 xl:mt-[28px] xl:grid-cols-6">
            {STAGES.map((s, i) => (
              <li key={s.n} className="relative">
                <span aria-hidden className={cn('absolute -left-14 top-4 flex h-11 w-11 items-center justify-center rounded-full border bg-white text-[14px] font-semibold md:hidden', i <= current || reduced ? 'border-cf-blue text-cf-blue' : 'border-cf-rail text-cf-ink')}>
                  {s.n}
                </span>
                <StageCard stage={s} index={i} active={i === current} />
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-[22px] lg:mt-[34px]">
          <Cta href="/features" className="h-[46px] w-full px-7 sm:w-auto">Explore every feature</Cta>
          <Cta href={AUTH_LINKS.startFree} variant="secondary" className="h-[46px] w-full px-9 sm:w-auto">Start free</Cta>
        </div>
      </div>
    </section>
  )
}

function StageCard({ stage, index, active }: { stage: (typeof STAGES)[number]; index: number; active: boolean }) {
  const Icon = stage.Icon
  return (
    <article
      className={cn(
        'h-full rounded-[18px] border bg-white p-3 shadow-cf-card transition-[border-color,box-shadow,transform] duration-300 ease-cf',
        active ? 'border-cf-blue/35 shadow-cf-float lg:-translate-y-1' : 'border-cf-line',
      )}
    >
      <header className="flex items-start gap-3 px-1 pt-1">
        <IconTile className="h-[46px] w-[46px]"><Icon className="h-[23px] w-[23px]" strokeWidth={1.9} /></IconTile>
        <div className="min-w-0">
          <h3 className="text-[19px] font-semibold leading-tight tracking-[-0.02em] text-cf-ink">{stage.title}</h3>
          <p className="mt-1 text-[12.5px] leading-[1.5] text-cf-muted">{stage.desc}</p>
        </div>
      </header>
      <div aria-hidden className="mt-4 min-h-[372px] rounded-[14px] border border-cf-line p-3 text-cf-body">
        {index === 0 && <PlanPanel active={active} />}
        {index === 1 && <CreatePanel />}
        {index === 2 && <ApprovePanel active={active} />}
        {index === 3 && <LaunchPanel />}
        {index === 4 && <EngagePanel />}
        {index === 5 && <LearnPanel />}
      </div>
    </article>
  )
}

function PanelTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-[13px] font-semibold text-cf-ink">{children}</p>
      {right}
    </div>
  )
}

function PlanPanel({ active }: { active: boolean }) {
  return (
    <div className="flex h-full flex-col">
      <PanelTitle right={<span className="rounded-[6px] bg-[#EAF2FF] px-2 py-0.5 text-[11px] font-medium text-cf-blue">Draft</span>}>Campaign brief</PanelTitle>
      <div className="mt-3 rounded-[10px] border border-cf-line p-2.5">
        <p className="text-[12px] font-medium text-cf-ink">{LOOP.brief.name}</p>
        <p className="mt-1 text-[10.5px] leading-snug text-cf-subtle">{LOOP.brief.detail}</p>
      </div>
      <p className="mt-4 text-[11.5px] font-semibold text-cf-ink">Target audience</p>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        {[{ l: 'Creators', I: User }, { l: 'SMBs', I: Building2 }, { l: 'UK', I: MapPin }].map(({ l, I }) => (
          <span key={l} className="flex flex-col items-center gap-1.5 rounded-[10px] border border-cf-line py-2 text-[10px] text-cf-muted">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-cf-tint"><I className="h-4 w-4 text-cf-blue" strokeWidth={1.8} /></span>
            {l}
          </span>
        ))}
      </div>
      <p className="mt-4 text-[11.5px] font-semibold text-cf-ink">Goal</p>
      <span className="mt-2 flex items-center justify-between rounded-[8px] border border-cf-line px-2.5 py-2 text-[11px] text-cf-body">
        {LOOP.brief.goal}<ChevronDown className="h-3.5 w-3.5 text-cf-subtle" />
      </span>
      <span className={cn('mt-auto flex h-[40px] items-center gap-2 rounded-[10px] px-3 text-[12.5px] font-medium text-white transition-colors duration-300', active ? 'bg-cf-blue' : 'bg-cf-blue/90')}>
        <CheckCircle2 className="h-[18px] w-[18px] fill-white text-cf-blue" strokeWidth={2.4} />Brief ready
      </span>
    </div>
  )
}

function CreatePanel() {
  return (
    <div>
      <PanelTitle>Content studio</PanelTitle>
      <div className="mt-3 flex gap-1">
        {LOOP.studio.formats.map((f) => (
          <span key={f} className={cn('rounded-[6px] px-1.5 py-1 text-[10px]', f === 'Video' ? 'border border-cf-blue bg-[#EAF2FF] font-medium text-cf-blue' : 'bg-cf-surface text-cf-muted')}>{f}</span>
        ))}
      </div>
      <div className="mt-3 overflow-hidden rounded-[10px] border border-cf-line">
        <MediaThumb kind="video" className="h-[104px] w-full rounded-none" />
        <p className="px-2.5 pt-2 text-[11.5px] text-cf-ink">{LOOP.studio.asset}</p>
        <p className="px-2.5 pb-2 text-[10.5px] text-cf-subtle">{LOOP.studio.duration}</p>
      </div>
      <p className="mt-4 text-[11.5px] font-semibold text-cf-ink">Brand kit</p>
      <div className="mt-2 flex items-center gap-2 rounded-[8px] bg-cf-surface px-2 py-1.5">
        <FoxMark size={22} />
        <span className="text-[11.5px] text-cf-ink">{LOOP.studio.kit}</span>
      </div>
      <div className="mt-3 flex gap-2 px-1">
        {['#1769FF', '#5B9BFF', '#B6D1FF', '#C9D1DD'].map((c) => <span key={c} className="h-5 w-5 rounded-full" style={{ background: c }} />)}
      </div>
    </div>
  )
}

function ApprovePanel({ active }: { active: boolean }) {
  return (
    <div>
      <PanelTitle right={<Pill tone="amber" dot={false}>{LOOP.review.pending} pending</Pill>}>Awaiting review</PanelTitle>
      <div className="mt-3 overflow-hidden rounded-[10px] border border-cf-line">
        <MediaThumb kind="review" className="h-[78px] w-full rounded-none" />
        <p className="px-2.5 pt-2 text-[11px] text-cf-ink">{LOOP.review.asset}</p>
        <p className="px-2.5 pb-2 text-[10px] text-cf-subtle">{LOOP.review.version}</p>
      </div>
      <div className="mt-3 flex items-start gap-2">
        <Avatar person={PEOPLE.tom} size={22} />
        <p className="rounded-[8px] bg-cf-surface px-2 py-1.5 text-[10.5px] leading-snug text-cf-body">{LOOP.review.comment}</p>
      </div>
      <div className="mt-4 flex gap-1.5">
        <span className={cn('flex h-8 items-center rounded-[7px] px-2.5 text-[10.5px] font-medium text-white transition-colors duration-300', active ? 'bg-[#1DB954]' : 'bg-[#22A559]')}>Approve</span>
        <span className="flex h-8 items-center rounded-[7px] border border-cf-line px-2 text-[10.5px] text-cf-body">Request changes</span>
      </div>
      <div className="mt-5 flex items-center gap-2">
        <AvatarStack people={[PEOPLE.tom, PEOPLE.james]} size={24} extra="+3" />
        <span className="text-[10.5px] text-cf-muted">{LOOP.review.reviewers} reviewers</span>
      </div>
    </div>
  )
}

function LaunchPanel() {
  return (
    <div>
      <PanelTitle>Publishing queue</PanelTitle>
      <ul className="mt-2 divide-y divide-cf-line">
        {LOOP.queue.map((q) => (
          <li key={q.label} className="flex items-start gap-2.5 py-[9px]">
            <ChannelIcon channel={q.channel} size={22} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-1">
                <span className="text-[11px] font-medium text-cf-ink">{q.label}</span>
                <Pill tone={toneFor(q.state)} className="px-1.5 text-[9px]">{q.state}</Pill>
              </span>
              <span className="mt-0.5 block text-[10px] text-cf-muted">{q.when}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function EngagePanel() {
  return (
    <div>
      <PanelTitle>Unified inbox</PanelTitle>
      <div className="mt-3 flex gap-1">
        {['All', 'Comments', 'DMs', 'Mentions'].map((f) => (
          <span key={f} className={cn('rounded-[6px] px-1.5 py-1 text-[9.5px]', f === 'All' ? 'bg-cf-blue text-white' : 'bg-cf-surface text-cf-muted')}>{f}</span>
        ))}
      </div>
      <ul className="mt-2 space-y-1">
        {LOOP.inbox.map((msg) => (
          <li key={msg.person.name} className="flex gap-2 py-2">
            <Avatar person={msg.person} size={28} />
            <span className="min-w-0 flex-1">
              <span className="flex justify-between text-[11px]"><span className="font-medium text-cf-ink">{msg.person.name}</span><span className="text-[9.5px] text-cf-subtle">{msg.time}</span></span>
              <span className="mt-0.5 block text-[10.5px] leading-snug text-cf-muted">{msg.text}</span>
            </span>
            <span className={cn('mt-5 h-1.5 w-1.5 shrink-0 rounded-full', msg.unread ? 'bg-cf-blue' : 'bg-transparent')} />
          </li>
        ))}
      </ul>
      <span className="mt-3 flex h-8 items-center justify-center gap-1 rounded-[8px] border border-cf-blue/40 text-[10.5px] font-medium text-cf-blue">
        View all conversations <ArrowRight className="h-3 w-3" />
      </span>
    </div>
  )
}

function LearnPanel() {
  const p = LOOP.performance
  const w = 170
  const pts = p.line.map((y, i) => `${(i / (p.line.length - 1)) * w},${y}`).join(' ')
  return (
    <div>
      <PanelTitle right={<SampleBadge className="px-1.5 text-[8.5px]" />}>Campaign performance</PanelTitle>
      <span className="mt-3 flex items-center justify-between rounded-[8px] border border-cf-line px-2.5 py-1.5 text-[10.5px] text-cf-body">Last 30 days<ChevronDown className="h-3.5 w-3.5 text-cf-subtle" /></span>
      <div className="relative mt-3 h-[92px]">
        <div className="absolute inset-x-0 bottom-0 flex h-full items-end gap-[6px] px-1">
          {p.bars.map((b, i) => <span key={i} className="flex-1 rounded-t-[3px] bg-[#D5E5FF]" style={{ height: `${b}%` }} />)}
        </div>
        <svg viewBox={`0 0 ${w} 80`} className="absolute inset-0 h-full w-full overflow-visible" preserveAspectRatio="none">
          <polyline points={pts} fill="none" stroke="#1769FF" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </svg>
        <span className="absolute left-[52%] top-[-4px] rounded-[5px] bg-cf-blue px-1.5 py-0.5 text-[9.5px] font-semibold text-white">{p.callout}</span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-2 gap-y-2.5 border-t border-cf-line pt-3">
        {p.stats.map((s, i) => (
          <div key={s.label}>
            <dd className="flex items-center gap-1 text-[13px] font-semibold text-cf-ink"><span className={cn('h-1.5 w-1.5 rounded-full', i % 2 ? 'bg-[#8B5CF6]' : 'bg-cf-blue')} />{s.value}</dd>
            <dt className="text-[9.5px] text-cf-subtle">{s.label}</dt>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-[11px] font-semibold text-cf-ink">Top sources</p>
      <div className="mt-2 flex items-center gap-2">
        {['instagram', 'tiktok', 'linkedin', 'web', 'email'].map((c) => <ChannelIcon key={c} channel={c} size={16} />)}
      </div>
    </div>
  )
}
