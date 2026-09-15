import {
  ArrowDown, BadgeCheck, BarChart3, Bell, Calendar, ChevronDown, ChevronRight, CircleCheck, Filter, LayoutGrid, LayoutTemplate,
  Image as ImageIcon, MoreVertical, PenLine, Plus, Send, Shapes, Sparkles, Type, Users, Wand2, Zap, Palette,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { ChannelIcon } from './brand-icons'
import { PEOPLE, PLATFORM, TEAM } from './demo-data'
import { InView } from './motion'
import { Accent, AppSidebar, Avatar, AvatarStack, CONTAINER, Eyebrow, FoxMark, IconTile, Lead, MediaThumb, Pill, SampleBadge, SectionTitle, TextLink } from './primitives'

/** SECTION 04 — One connected platform. Six structurally distinct product modules in an editorial grid. */
export default function PlatformGrid() {
  return (
    <section aria-labelledby="platform-title" className="bg-cf-surface">
      <div className={cn(CONTAINER, 'pb-16 pt-14 lg:pb-[40px] lg:pt-[30px]')}>
        <Eyebrow className="tracking-[0.3em]">One connected platform</Eyebrow>
        <SectionTitle id="platform-title" className="mt-3 text-center">
          Everything <Accent>around the</Accent> campaign.
        </SectionTitle>
        <Lead className="mx-auto mt-4 max-w-[720px] text-center">
          Use the parts you need while strategy, content, people, channels and measurement stay connected to the same operating context.
        </Lead>

        <InView className="mt-8 grid gap-5 lg:grid-cols-2 xl:grid-cols-[581fr_384fr_365fr]">
          <Tile className="lg:col-span-2 xl:col-span-1" title="Campaigns" desc="Plan, manage and track every campaign from one place." cta={{ href: '/features#campaigns', label: 'Explore campaign management' }} icon={<LayoutGrid className="h-6 w-6" strokeWidth={1.9} />}>
            <CampaignModule />
          </Tile>
          <Tile title="Studio" desc="Create on-brand content with AI and publish it anywhere." cta={{ href: '/features#ai', label: 'Explore content studio' }} icon={<PenLine className="h-6 w-6" strokeWidth={1.9} />} d={80}>
            <StudioModule />
          </Tile>
          <Tile title="Channels" desc="Publish everywhere and keep every channel connected." cta={{ href: '/features#calendar', label: 'Explore channels' }} icon={<Send className="h-6 w-6" strokeWidth={1.9} />} d={160}>
            <ChannelList />
          </Tile>
        </InView>
        <InView className="mt-5 grid gap-5 lg:grid-cols-2 xl:grid-cols-[478fr_518fr_330fr]">
          <Tile title="Creators & UGC" desc="Work with creators, manage briefs and turn great content into results." cta={{ href: '/features#ugc', label: 'Explore creators' }} icon={<Users className="h-6 w-6" strokeWidth={1.9} />}>
            <CreatorModule />
          </Tile>
          <Tile title="Analytics" desc="See what’s working across every channel and make smarter decisions." cta={{ href: '/features#analytics', label: 'Explore analytics' }} icon={<BarChart3 className="h-6 w-6" strokeWidth={2} />} d={80}>
            <AnalyticsModule />
          </Tile>
          <Tile className="lg:col-span-2 xl:col-span-1" title="Automations" desc="Save time with workflows that run in the background." cta={{ href: '/features', label: 'Explore all features' }} icon={<Zap className="h-6 w-6" strokeWidth={1.9} />} d={160}>
            <AutomationSteps />
          </Tile>
        </InView>
      </div>
    </section>
  )
}

function Tile({ title, desc, cta, icon, children, className, d = 0 }: { title: string; desc: string; cta: { href: string; label: string }; icon: ReactNode; children: ReactNode; className?: string; d?: number }) {
  return (
    <article
      className={cn('cf-reveal group flex flex-col rounded-[20px] border border-cf-line bg-white p-4 shadow-cf-card transition-[border-color,box-shadow,transform] duration-300 ease-cf hover:-translate-y-[3px] hover:border-cf-line-strong hover:shadow-cf-float sm:p-[18px]', className)}
      style={{ '--d': `${d}ms` } as React.CSSProperties}
    >
      <header className="flex items-start gap-4">
        <IconTile className="h-[46px] w-[46px]">{icon}</IconTile>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h3 className="text-[19px] font-semibold tracking-[-0.025em] text-cf-ink">{title}</h3>
            <TextLink href={cta.href} className="text-[13px]">{cta.label}</TextLink>
          </div>
          <p className="mt-1.5 text-[13px] leading-[1.5] text-cf-muted">{desc}</p>
        </div>
      </header>
      <div aria-hidden className="mt-4 flex-1">{children}</div>
    </article>
  )
}

function CampaignModule() {
  const c = PLATFORM.campaign
  return (
    <div className="overflow-hidden rounded-[14px] border border-cf-line bg-cf-surface">
      <div className="flex items-center justify-between border-b border-cf-line bg-white px-3 py-2">
        <span className="flex items-center gap-2"><FoxMark size={22} /><span className="text-[13.5px] font-semibold text-cf-ink">Caption Fox</span></span>
        <AvatarStack people={[PEOPLE.sophie, PEOPLE.priya]} size={22} extra="+2" />
      </div>
      <div className="flex">
        <AppSidebar active="campaigns" scale="sm" className="hidden border-r-cf-line sm:flex [&>div:first-child]:hidden" />
        <div className="min-w-0 flex-1 bg-white p-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="flex items-center gap-2 text-[13px] font-semibold text-cf-ink">{c.name}<Pill tone="green">Active</Pill></p>
              <p className="text-[10px] text-cf-muted">{c.type}</p>
            </div>
            <span className="flex items-center gap-1 rounded-[7px] border border-cf-line px-2 py-1 text-[9.5px] text-cf-body">Last 30 days<ChevronDown className="h-3 w-3" /></span>
          </div>
          <div className="mt-2.5 flex gap-4 border-b border-cf-line text-[10px] text-cf-muted">
            {['Overview', 'Content', 'Channels', 'Performance'].map((t) => <span key={t} className={cn('pb-1.5', t === 'Overview' && 'border-b-2 border-cf-blue font-medium text-cf-blue')}>{t}</span>)}
          </div>
          <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Content" value={c.content} sub="Published" bar={c.contentPct} barTone="bg-[#1DB954]" />
            <Stat label="Channels" value={c.channels} sub="Connected" bar={c.channelPct} barTone="bg-cf-blue" />
            <div className="rounded-[9px] border border-cf-line p-2">
              <p className="text-[9px] text-cf-muted">Next milestone</p>
              <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-cf-ink"><Calendar className="h-3 w-3 text-cf-blue" />{c.milestone}</p>
              <p className="mt-1 text-[9.5px] text-cf-body">{c.milestoneDate}</p>
            </div>
            <div className="rounded-[9px] border border-cf-line p-2">
              <p className="text-[9px] text-cf-muted">Status</p>
              <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-[#157A45]"><span className="h-1.5 w-1.5 rounded-full bg-[#1DB954]" />On track</p>
              <p className="mt-1 text-[8.5px] leading-tight text-cf-subtle">Everything running as planned.</p>
            </div>
          </div>
          <p className="mt-3 flex justify-between text-[10.5px] font-semibold text-cf-ink">Recent content<span className="font-medium text-cf-blue">View all →</span></p>
          <div className="mt-2 grid grid-cols-5 gap-1.5">
            <MediaThumb kind="product" className="h-[52px]" />
            <MediaThumb kind="portrait" className="h-[52px]" />
            <MediaThumb kind="text" label="Good Things Move People" className="h-[52px] text-[9px]" />
            <MediaThumb kind="mountain" className="h-[52px]" />
            <span className="flex h-[52px] flex-col items-center justify-center rounded-[8px] border border-cf-line text-[8.5px] text-cf-muted"><Plus className="h-3.5 w-3.5" />Add content</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, sub, bar, barTone }: { label: string; value: string; sub: string; bar: number; barTone: string }) {
  return (
    <div className="rounded-[9px] border border-cf-line p-2">
      <p className="text-[9px] text-cf-muted">{label}</p>
      <p className="mt-1 text-[13px] font-semibold text-cf-ink">{value}</p>
      <p className="text-[9px] text-cf-muted">{sub}</p>
      <span className="mt-1.5 block h-1 rounded-full bg-cf-line"><span className={cn('block h-full rounded-full', barTone)} style={{ width: `${bar}%` }} /></span>
    </div>
  )
}

export function StudioModule() {
  return (
    <div className="flex h-full gap-2 overflow-hidden rounded-[14px] border border-cf-line bg-cf-surface p-2">
      <ul className="hidden w-[56px] flex-col gap-2.5 sm:flex">
        {[{ l: 'Templates', I: LayoutTemplate, on: true }, { l: 'Brand kit', I: Palette }, { l: 'AI tools', I: Wand2 }, { l: 'Media', I: ImageIcon }, { l: 'Text', I: Type }, { l: 'Elements', I: Shapes }].map(({ l, I, on }) => (
          <li key={l} className={cn('flex flex-col items-center gap-1 rounded-[8px] py-1.5 text-[8.5px]', on ? 'bg-white text-cf-blue shadow-sm' : 'text-cf-muted')}>
            <I className="h-3.5 w-3.5" strokeWidth={1.8} />{l}
          </li>
        ))}
      </ul>
      <div className="min-w-0 flex-1">
        <div className="flex gap-3 text-[10px] text-cf-muted">
          {['Instagram', 'TikTok', 'LinkedIn', 'YouTube'].map((t) => <span key={t} className={cn('rounded-[6px] px-2 py-1', t === 'Instagram' && 'bg-white font-medium text-cf-blue shadow-sm')}>{t}</span>)}
        </div>
        <div className="mt-2 flex gap-2">
          <div className="relative h-[248px] w-[168px] flex-none overflow-hidden rounded-[8px] bg-[#7FB0F5]">
            <MediaThumb kind="studio" sizes="340px" imgClassName="object-left-top" className="absolute inset-x-0 top-0 h-[228px] rounded-none" />
            <span className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-[#8EBBF7] to-transparent" />
            <span className="absolute bottom-2 left-2 flex items-center gap-1.5 text-[9px] font-semibold text-white">
              <FoxMark size={14} className="rounded-[4px]" />Caption Fox
            </span>
          </div>
          <div className="min-w-[104px] flex-1 space-y-2">
            <div className="rounded-[8px] bg-white p-2 text-[9px] leading-snug text-cf-body shadow-sm">
              <p className="flex justify-between font-medium text-cf-ink">Post copy<Sparkles className="h-3 w-3 text-cf-violet" /></p>
              <p className="mt-1.5">Built for bigger journeys.</p>
              <p className="mt-1">New collection now live.</p>
              <p className="mt-2 text-[8px] text-cf-subtle">56/300</p>
            </div>
            <div className="rounded-[8px] bg-white p-2 shadow-sm">
              <p className="flex justify-between text-[9px] font-medium text-cf-ink">AI suggestions<Sparkles className="h-3 w-3 text-cf-violet" /></p>
              {['Shorter', 'More engaging', 'Add hashtags'].map((s) => <p key={s} className="mt-1.5 rounded-[5px] bg-cf-surface px-1.5 py-1 text-[8.5px] text-cf-body">{s}</p>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function ChannelList() {
  return (
    <ul className="divide-y divide-transparent">
      {PLATFORM.channels.map((ch) => (
        <li key={ch.label} className="flex items-center gap-3 py-[9px]">
          <span className="flex h-[36px] w-[36px] items-center justify-center rounded-[9px] bg-cf-surface"><ChannelIcon channel={ch.channel} size={24} /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[12px] font-medium text-cf-ink">{ch.label}</span>
            <span className="flex items-center gap-1.5 text-[10.5px] text-cf-muted">Connected<span className="h-1.5 w-1.5 rounded-full bg-[#1DB954]" /></span>
          </span>
          <Pill tone={ch.tone} className="min-w-[76px] justify-center">{ch.state}</Pill>
          <ChevronRight className="h-4 w-4 text-cf-subtle" />
        </li>
      ))}
    </ul>
  )
}

export function CreatorModule() {
  const c = PLATFORM.creator
  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_1.1fr]">
      <div className="rounded-[14px] border border-cf-line p-3.5">
        <div className="flex items-center gap-3">
          <MediaThumb kind="creator" className="h-[60px] w-[60px] rounded-full" />
          <div>
            <p className="flex items-center gap-1 text-[14px] font-semibold text-cf-ink">{c.name}<BadgeCheck className="h-4 w-4 fill-cf-blue text-white" /></p>
            <p className="text-[11.5px] text-cf-muted">{c.niche}</p>
            <p className="text-[11.5px] text-cf-muted">{c.followers}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {c.tags.map((t) => <span key={t} className="rounded-full border border-cf-line px-2.5 py-1 text-[11px] text-cf-body">{t}</span>)}
        </div>
        <span className="mt-4 flex h-[34px] items-center justify-center rounded-[9px] bg-cf-blue text-[12px] font-medium text-white">Send brief</span>
      </div>
      <div className="rounded-[14px] border border-cf-line p-3.5">
        <p className="text-[12.5px] font-semibold text-cf-ink">Latest submission</p>
        <div className="mt-3 flex items-start gap-3">
          <MediaThumb kind="submission" className="h-[86px] w-[86px]" />
          <Pill tone="amber" className="mt-3">In review</Pill>
        </div>
        <p className="mt-3 flex items-center justify-between text-[12px] font-medium text-cf-ink">{c.submission}<MoreVertical className="h-3.5 w-3.5 text-cf-subtle" /></p>
        <p className="text-[10.5px] text-cf-muted">{c.submissionMeta}</p>
      </div>
    </div>
  )
}

export function AnalyticsModule() {
  const a = PLATFORM.analytics
  const W = 440
  const H = 120
  const max = 50
  const path = (pts: number[]) => pts.map((v, i) => `${i === 0 ? 'M' : 'L'}${(i / (pts.length - 1)) * W},${H - (v / max) * H}`).join(' ')
  return (
    <div>
      <div className="flex flex-wrap items-start gap-2">
        {a.kpis.map((k) => (
          <div key={k.label} className="min-w-[96px] flex-1 border-r border-cf-line pr-2 last:border-r-0">
            <p className="text-[10.5px] text-cf-muted">{k.label}</p>
            <p className="text-[18px] font-semibold tracking-[-0.02em] text-cf-ink">{k.value}</p>
            <p className="text-[10px] font-medium text-[#157A45]">↑ {k.delta}</p>
          </div>
        ))}
        <span className="flex items-center gap-1 rounded-[7px] border border-cf-line px-2 py-1 text-[10px] text-cf-body">Last 30 days<ChevronDown className="h-3 w-3" /></span>
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-[9.5px] text-cf-muted">
        {a.series.map((s) => <span key={s.key} className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />{s.key}</span>)}
        <SampleBadge className="ml-auto" />
      </div>
      <div className="relative mt-2">
        <svg viewBox={`-28 -6 ${W + 36} ${H + 26}`} className="h-auto w-full" role="presentation">
          {[0, 20, 40, 60].map((v, i) => (
            <g key={v}>
              <line x1="0" x2={W} y1={H - (i / 3) * H} y2={H - (i / 3) * H} stroke="#EDF1F7" />
              <text x="-8" y={H - (i / 3) * H + 3} textAnchor="end" fontSize="9" fill="#647389">{v ? `${v}K` : '0'}</text>
            </g>
          ))}
          {a.series.map((s) => <path key={s.key} d={path(s.points)} fill="none" stroke={s.color} strokeWidth="1.8" />)}
          <line x1={W * (7 / 9)} x2={W * (7 / 9)} y1="0" y2={H} stroke="#C9D6EA" strokeDasharray="3 3" />
          {a.xLabels.map((l, i) => <text key={l} x={(i / (a.xLabels.length - 1)) * W} y={H + 16} fontSize="9" fill="#647389" textAnchor="middle">{l}</text>)}
        </svg>
        <div className="absolute right-0 top-0 w-[128px] rounded-[9px] border border-cf-line bg-white p-2 text-[9.5px] shadow-cf-card">
          <p className="mb-1 text-cf-ink">{a.tooltipDate}</p>
          {a.series.map((s) => (
            <p key={s.key} className="flex justify-between leading-[1.7]"><span className="flex items-center gap-1 text-cf-body"><span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />{s.key}</span><span className="text-cf-ink">{s.points[7]}K</span></p>
          ))}
        </div>
      </div>
    </div>
  )
}

export function AutomationSteps() {
  const icons = [Calendar, Filter, Send, Bell]
  return (
    <div className="flex h-full flex-col">
      <ol className="space-y-0">
        {PLATFORM.automation.map((s, i) => {
          const I = icons[i]
          return (
            <li key={s.kind}>
              <div className="flex items-center gap-3 rounded-[12px] px-2 py-1.5">
                <IconTile className="h-[40px] w-[40px] rounded-[10px]"><I className="h-5 w-5" strokeWidth={1.9} /></IconTile>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12px] font-medium text-cf-ink">{s.kind}</span>
                  <span className="block text-[10.5px] text-cf-muted">{s.detail}</span>
                </span>
                <CircleCheck className="h-[18px] w-[18px] text-[#1DB954]" strokeWidth={2} />
              </div>
              {i < PLATFORM.automation.length - 1 && <ArrowDown className="ml-[26px] h-3.5 w-3.5 text-cf-blue" />}
            </li>
          )
        })}
      </ol>
      <span className="mt-4 flex items-center justify-between rounded-[12px] border border-[#BFE8CF] bg-[#EFFAF3] px-4 py-3 text-[12.5px] font-medium text-[#157A45]">
        <span className="flex items-center gap-2"><CircleCheck className="h-5 w-5 fill-[#1DB954] text-white" />Workflow active</span>
        <MoreVertical className="h-4 w-4" />
      </span>
    </div>
  )
}

export { Avatar, TEAM }
