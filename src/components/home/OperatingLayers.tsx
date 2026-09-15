import { BarChart3, Calendar, ChevronRight, CircleCheck, Clock3, Crosshair, FileText, ImageIcon, MessageSquareText, Settings, ShieldCheck, TrendingUp, Users, UsersRound } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { ChannelIcon } from './brand-icons'
import { LAYERS, TEAM } from './demo-data'
import { ConnectorPath } from './ConnectorPath'
import { InView } from './motion'
import { Accent, AvatarStack, CONTAINER, Cta, Eyebrow, FoxMark, IconTile, Lead, MediaThumb, Pill, SampleBadge, SectionTitle } from './primitives'

/** SECTION 03 — Two operating layers. Operations connectors draw inward; growth connectors draw outward. */
export default function OperatingLayers() {
  return (
    <section aria-labelledby="layers-title" className="bg-white">
      <div className={cn(CONTAINER, 'pb-16 pt-14 lg:pb-[52px] lg:pt-[40px]')}>
        <Eyebrow className="tracking-[0.26em]">One platform, two operating layers</Eyebrow>
        <SectionTitle id="layers-title" className="mt-4 text-center">
          Run the work. <Accent>Build the growth around it.</Accent>
        </SectionTitle>
        <Lead className="mx-auto mt-4 max-w-[720px] text-center">
          Caption Fox connects the operating work behind marketing with the channels, audiences and measurement that turn that work into market activity.
        </Lead>

        <div className="mt-8 grid gap-5 xl:grid-cols-2">
          <OpsPanel />
          <GrowthPanel />
        </div>
      </div>
    </section>
  )
}

function PanelShell({ children, className, label }: { children: ReactNode; className?: string; label: string }) {
  return (
    <InView as="article" aria-label={label} className={cn('rounded-[22px] border border-cf-line bg-gradient-to-b from-[#F7FAFF] to-white p-5 sm:p-6', className)}>
      {children}
    </InView>
  )
}

function PanelHeader({ icon, eyebrow, title, lead, cta }: { icon: ReactNode; eyebrow: string; title: ReactNode; lead: string; cta: ReactNode }) {
  return (
    <>
      <div className="flex items-center gap-4">
        <IconTile className="h-[46px] w-[46px]">{icon}</IconTile>
        <p className="text-[12.5px] font-semibold uppercase tracking-[0.2em] text-cf-blue">{eyebrow}</p>
      </div>
      <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-[26px] font-bold leading-[1.12] tracking-[-0.02em] text-cf-ink sm:text-[30px]">{title}</h3>
          <p className="mt-2 max-w-[380px] text-[15px] leading-[1.5] text-cf-muted">{lead}</p>
        </div>
        <div className="shrink-0 sm:pt-0">{cta}</div>
      </div>
    </>
  )
}

function NodeCard({
  title, desc, icon, children, className, style, chevron = true,
}: {
  title: string
  desc: string
  icon: ReactNode
  children?: ReactNode
  className?: string
  style?: CSSProperties
  chevron?: boolean
}) {
  return (
    <div className={cn('cf-reveal rounded-[14px] border border-cf-line bg-white p-3 shadow-cf-card xl:absolute xl:w-[var(--w)] xl:min-h-[var(--mh)]', className)} style={style}>
      <div className="flex items-start gap-3">
        <IconTile className="h-[38px] w-[38px] rounded-[10px]">{icon}</IconTile>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold text-cf-ink">{title}</p>
          <p className="mt-0.5 text-[11px] leading-[1.45] text-cf-muted">{desc}</p>
        </div>
        {chevron && <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-cf-subtle" />}
      </div>
      {children && <div className="mt-2.5">{children}</div>}
    </div>
  )
}

/** Desktop canvas geometry. Width/height go through CSS vars so they only apply at xl (see XL_BOX); below xl the cards flow in a grid. */
const at = (left: number, top: number, width: number, minHeight: number, d = 0) =>
  ({ left, top, '--w': `${width}px`, '--mh': `${minHeight}px`, '--d': `${d}ms` }) as CSSProperties

function Dots({ points }: { points: [number, number][] }) {
  return (
    <>
      {points.map(([cx, cy]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="3.6" fill="#1769FF" />)}
    </>
  )
}

function OpsPanel() {
  return (
    <PanelShell label="Marketing operations">
      <PanelHeader
        icon={<Settings className="h-6 w-6" strokeWidth={1.9} />}
        eyebrow="Marketing operations"
        title={<>Turn strategy into<br className="hidden sm:block" /> on-brand content.</>}
        lead="Plan, organise and produce the work that powers your marketing, all in one place."
        cta={<Cta href="/features#campaigns" className="h-[46px] px-[22px] text-[14.5px]">Explore marketing operations</Cta>}
      />

      <div aria-hidden className="relative mt-4 grid gap-3 sm:grid-cols-2 xl:block xl:h-[380px]">
        <svg className="pointer-events-none absolute inset-0 hidden h-full w-full overflow-visible xl:block" viewBox="0 0 613 380" fill="none">
          {/* Inward: each path starts at the outer card and ends at the core. */}
          {['M307 97 L307 130', 'M183 160 C 210 160, 205 180, 233 180', 'M433 160 C 406 160, 410 180, 381 180', 'M232 330 C 290 330, 307 300, 307 249', 'M384 270 C 380 262, 376 256, 360 249'].map((d, i) => (
            <ConnectorPath key={d} d={d} delay={250 + i * 90} dashed opacity={0.7} />
          ))}
          <Dots points={[[307, 105], [183, 160], [233, 180], [433, 160], [381, 180], [232, 330], [307, 249], [384, 270]]} />
        </svg>

        <div className="cf-reveal flex flex-col items-center justify-center rounded-[16px] border-[1.5px] border-[#A9C8FF] bg-white py-4 shadow-cf-float sm:col-span-2 xl:absolute xl:w-[var(--w)] xl:min-h-[var(--mh)]" style={at(233, 130, 148, 119, 80)}>
          <FoxMark size={44} />
          <p className="mt-1.5 text-[16px] font-semibold tracking-[-0.02em] text-cf-ink">Caption Fox</p>
          <p className="text-[11px] text-cf-muted">Marketing Operations</p>
        </div>

        <NodeCard title="Strategy" desc="Define goals, audience and positioning" icon={<Crosshair className="h-5 w-5" strokeWidth={2} />} style={at(200, 0, 215, 97, 120)}>
          <Pill tone="green" className="ml-[50px]">Strategy ready</Pill>
        </NodeCard>
        <NodeCard title="Campaigns" desc="Plan and manage campaigns" icon={<FileText className="h-5 w-5" strokeWidth={1.9} />} style={at(0, 100, 183, 121, 160)}>
          <span className="flex items-center gap-2"><MediaThumb kind="product" className="h-6 w-7 rounded-[5px]" /><span className="text-[10.5px] font-medium text-cf-ink">Summer Launch</span><Pill tone="green" dot={false} className="text-[9.5px]">Active</Pill></span>
        </NodeCard>
        <NodeCard title="Calendar" desc="Plan, schedule and collaborate" icon={<Calendar className="h-5 w-5" strokeWidth={1.9} />} style={at(433, 100, 184, 121, 200)}>
          <span className="flex items-center gap-1.5 rounded-[8px] bg-cf-surface px-2 py-1.5 text-[10.5px] text-cf-body"><Calendar className="h-3.5 w-3.5 text-cf-blue" />12 posts this week</span>
        </NodeCard>
        <NodeCard title="Studio" desc="Create content with AI and your team" icon={<ImageIcon className="h-5 w-5" strokeWidth={1.9} />} style={at(8, 250, 224, 125, 240)}>
          <span className="flex items-center gap-2 pl-1">
            <MediaThumb kind="brand-sneaker" className="h-[44px] w-[70px]" />
            <MediaThumb kind="man" className="h-[44px] w-[44px]" />
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-cf-surface text-[10.5px] text-cf-muted">+3</span>
          </span>
        </NodeCard>
        <NodeCard title="Brand & Approvals" desc="Keep everything on brand" icon={<ShieldCheck className="h-5 w-5" strokeWidth={1.9} />} style={at(384, 250, 224, 125, 280)}>
          <span className="flex items-center justify-between pl-1"><AvatarStack people={TEAM} size={24} extra="+2" /><Pill tone="amber">2 pending</Pill></span>
        </NodeCard>
      </div>

      <div className="mt-6 border-t border-cf-line pt-5">
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-cf-line">
          {LAYERS.opsStatus.map((s, i) => {
            const Icon = [CircleCheck, Clock3, Calendar][i]
            return (
              <li key={s.label} className="flex items-center gap-3 sm:px-4 sm:first:pl-0">
                <IconTile tone={s.tone === 'green' ? 'green' : s.tone === 'amber' ? 'amber' : 'blue'} className="h-[46px] w-[46px] rounded-full"><Icon className="h-6 w-6" strokeWidth={1.9} /></IconTile>
                <div>
                  <p className="text-[21px] font-semibold leading-none text-cf-ink">{s.value}</p>
                  <p className="mt-1 text-[12.5px] text-cf-body">{s.label}<span className="block text-[11px] text-cf-subtle">{s.detail}</span></p>
                </div>
              </li>
            )
          })}
        </ul>
        <p className="mt-3 text-right"><SampleBadge /></p>
      </div>
    </PanelShell>
  )
}

function ChannelNode({ channel, title, desc, state, tone, style, icon }: { channel?: string; title: string; desc: string; state: string; tone: 'green' | 'blue' | 'slate'; style: CSSProperties; icon?: ReactNode }) {
  return (
    <div className="cf-reveal rounded-[14px] border border-cf-line bg-white p-3 shadow-cf-card xl:absolute xl:w-[var(--w)] xl:min-h-[var(--mh)]" style={style}>
      <div className="flex items-start gap-2.5">
        <span className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-[10px] bg-cf-surface">{icon ?? <ChannelIcon channel={channel!} size={22} />}</span>
        <span className="min-w-0">
          <span className="block text-[13px] font-semibold text-cf-ink">{title}</span>
          <span className="block text-[10.5px] text-cf-muted">{desc}</span>
        </span>
      </div>
      <Pill tone={tone} className="ml-[46px] mt-2">{state}</Pill>
    </div>
  )
}

function GrowthPanel() {
  const left = [
    { channel: 'instagram', title: 'Social', desc: 'Posts, Reels, Stories', state: 'Scheduled', tone: 'green' as const, s: at(0, 0, 169, 95, 140) },
    { channel: 'email', title: 'Email', desc: 'Newsletters, campaigns', state: 'Ready', tone: 'blue' as const, s: at(0, 118, 176, 95, 180) },
    { channel: 'ads', title: 'Advertising', desc: 'Paid campaigns', state: 'Draft', tone: 'slate' as const, s: at(0, 237, 169, 95, 220) },
  ]
  const right = [
    { title: 'Messaging', desc: 'DMs, auto-replies', state: 'Active', tone: 'green' as const, s: at(445, 0, 167, 95, 160), icon: <MessageSquareText className="h-5 w-5 text-cf-blue" strokeWidth={1.9} /> },
    { title: 'Web & Conversion', desc: 'Landing pages, forms', state: 'Live', tone: 'green' as const, s: at(439, 118, 173, 95, 200), icon: <ChannelIcon channel="web" size={20} /> },
    { title: 'Audiences', desc: 'Segments, targeting', state: 'Synced', tone: 'blue' as const, s: at(445, 237, 167, 95, 240), icon: <UsersRound className="h-5 w-5 text-cf-blue" strokeWidth={1.9} /> },
  ]
  return (
    <PanelShell label="Distribution and growth">
      <PanelHeader
        icon={<BarChart3 className="h-6 w-6" strokeWidth={2} />}
        eyebrow="Distribution & growth"
        title={<>Get your content<br className="hidden sm:block" /> in front of the right audience.</>}
        lead="Publish across channels, engage your audience and measure what works."
        cta={<Cta href="/features#calendar" variant="secondary" className="h-[46px] border-cf-blue/35 px-[22px] text-[14.5px] text-cf-blue">Explore channels &amp; growth</Cta>}
      />

      <div aria-hidden className="relative mt-6 grid gap-3 sm:grid-cols-2 xl:block xl:h-[332px]">
        <svg className="pointer-events-none absolute inset-0 hidden h-full w-full overflow-visible xl:block" viewBox="0 0 612 332" fill="none">
          {/* Outward: each path starts at the central content object. */}
          {['M227 130 C 200 130, 196 47, 176 47', 'M227 165 L 183 165', 'M227 200 C 200 200, 196 284, 176 284', 'M380 130 C 408 130, 412 47, 438 47', 'M380 165 L 432 165', 'M380 200 C 408 200, 412 284, 438 284'].map((d, i) => (
            <ConnectorPath key={d} d={d} delay={250 + i * 80} opacity={0.55} />
          ))}
          <Dots points={[[227, 130], [227, 165], [227, 200], [380, 130], [380, 165], [380, 200], [176, 47], [183, 165], [176, 284], [438, 47], [432, 165], [438, 284]]} />
        </svg>

        <div className="cf-reveal overflow-hidden rounded-[14px] border border-cf-line bg-white shadow-cf-float sm:col-span-2 xl:absolute xl:w-[var(--w)] xl:min-h-[var(--mh)]" style={at(227, 75, 153, 176, 60)}>
          <MediaThumb kind="launch" className="h-[82px] w-full rounded-none" />
          <div className="px-3 pb-3 pt-2">
            <p className="text-[12.5px] font-semibold text-cf-ink">Summer Launch</p>
            <p className="text-[10.5px] text-cf-muted">Multi-channel campaign</p>
            <Pill tone="green" className="mt-2">Ready to publish</Pill>
          </div>
        </div>

        {left.map((n) => <ChannelNode key={n.title} channel={n.channel} title={n.title} desc={n.desc} state={n.state} tone={n.tone} style={n.s} />)}
        {right.map((n) => <ChannelNode key={n.title} title={n.title} desc={n.desc} state={n.state} tone={n.tone} style={n.s} icon={n.icon} />)}
      </div>

      <div aria-hidden className="mt-7 grid gap-5 sm:grid-cols-[1fr_1.03fr]">
        <div className="cf-reveal rounded-[14px] border border-cf-line bg-white p-4 shadow-cf-card">
          <p className="flex items-center gap-3 text-[13.5px] font-semibold text-cf-ink"><IconTile className="h-[36px] w-[36px] rounded-[10px]"><Users className="h-5 w-5" /></IconTile>Audience segments</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {LAYERS.segments.map((s) => <span key={s} className="rounded-full bg-cf-surface px-3 py-1.5 text-[11px] text-cf-body">{s}</span>)}
            <span className="rounded-full bg-cf-surface px-2.5 py-1.5 text-[11px] text-cf-muted">+2</span>
          </div>
        </div>
        <div className="cf-reveal rounded-[14px] border border-cf-line bg-white p-4 shadow-cf-card">
          <p className="flex items-center gap-3 text-[13.5px] font-semibold text-cf-ink"><BarChart3 className="h-6 w-6 text-cf-blue" />Performance overview<SampleBadge className="ml-auto" /></p>
          <div className="mt-2 flex items-end gap-4">
            <div className="flex h-[48px] flex-1 items-end gap-[7px]">
              {LAYERS.performanceBars.map((b, i) => <span key={i} className="flex-1 rounded-t-[3px] bg-gradient-to-t from-[#5B9BFF] to-[#A5C8FF]" style={{ height: `${b}%` }} />)}
            </div>
            <p className="text-[11px] leading-tight text-cf-muted"><span className="flex items-center gap-1 text-[15px] font-semibold text-cf-blue"><TrendingUp className="h-4 w-4" />{LAYERS.performanceDelta}</span>Engagement<br />this month</p>
          </div>
        </div>
      </div>
    </PanelShell>
  )
}
