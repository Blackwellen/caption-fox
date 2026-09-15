import { BarChart3, Calendar, CheckCircle2, CircleCheck, MessageCircle, MoreHorizontal, PenLine, Send, Users, UsersRound } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { AUTH_LINKS } from '@/lib/marketing-links'
import { ChannelIcon } from './brand-icons'
import { HERO_MAP, TEAM } from './demo-data'
import { Avatar, AvatarStack, CheckRow, Cta, FoxMark, IconTile, MediaThumb, Pill, SampleBadge } from './primitives'

const HEADLINE = ['Plan the campaign.', 'Create the work.', 'Run the channels.', 'Measure what happened.']

/** SECTION 01 — Hero / Marketing Operating System. Static HTML; entrance motion is CSS so LCP never waits on hydration. */
export default function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden bg-white">
      <div className="mx-auto grid max-w-[1440px] items-center gap-12 px-4 pb-16 pt-10 sm:px-6 sm:pt-14 lg:px-10 xl:min-h-[738px] xl:grid-cols-[minmax(0,1fr)_792px] xl:items-start xl:gap-0 xl:pb-[46px] xl:pt-[42px] [@media(min-width:1280px)_and_(max-width:1439px)]:grid-cols-[minmax(0,1fr)_665px]">
        <div className="xl:pl-[18px] xl:pt-[80px]">
          <p className="cf-rise text-[12px] font-semibold uppercase tracking-[0.2em] text-cf-blue sm:text-[14px]" style={{ '--d': '0ms' } as CSSProperties}>
            Marketing operating system
          </p>
          <h1 id="hero-title" className="mt-5 text-[38px] font-extrabold leading-[1.1] tracking-[-0.022em] text-cf-ink sm:mt-[26px] sm:text-[52px] xl:text-[clamp(40px,3.25vw,47px)] xl:leading-[1.17]">
            {HEADLINE.map((line, i) => (
              <span key={line} className="cf-rise block" style={{ '--d': `${80 + i * 60}ms` } as CSSProperties}>
                {line}
              </span>
            ))}
            <span className="cf-rise block text-cf-blue" style={{ '--d': `${80 + HEADLINE.length * 60}ms` } as CSSProperties}>
              All in one system.
            </span>
          </h1>
          <p className="cf-rise mt-6 max-w-[500px] text-[17px] leading-[1.6] text-cf-body/85 sm:mt-8 sm:text-[19px]" style={{ '--d': '420ms' } as CSSProperties}>
            Caption Fox connects campaign planning, content, channels, creators, audiences and measurement in one marketing operating system.
          </p>
          <div className="cf-rise mt-8 flex flex-col gap-3 sm:mt-10 sm:flex-row sm:gap-[19px]" style={{ '--d': '500ms' } as CSSProperties}>
            <Cta href={AUTH_LINKS.startFree} size="lg" className="sm:w-[209px]">Start free</Cta>
            <Cta href="#how-it-works" size="lg" variant="secondary" className="sm:w-[232px]">See how it works</Cta>
          </div>
        </div>

        <MarketingOSMap />
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────────────────────── */

function MapCard({
  className, style, title, subtitle, icon, iconTone, children, corner,
}: {
  className?: string
  style?: CSSProperties
  title: string
  subtitle: string
  icon: ReactNode
  iconTone: 'blue' | 'violet' | 'green' | 'pink'
  children: ReactNode
  corner?: ReactNode
}) {
  return (
    <div className={cn('cf-pop absolute rounded-[16px] border border-cf-line bg-white p-[13px] shadow-cf-card', className)} style={style}>
      <div className="flex items-start gap-3">
        <IconTile tone={iconTone} className="h-[46px] w-[46px]">{icon}</IconTile>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-[16.5px] font-semibold leading-tight tracking-[-0.02em] text-cf-ink">{title}</p>
          <p className="mt-1 whitespace-nowrap text-[12px] tracking-[-0.005em] text-cf-muted">{subtitle}</p>
        </div>
        {corner ?? <MoreHorizontal aria-hidden className="h-4 w-4 text-cf-subtle" />}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  )
}

const pos = (left: number, top: number, width: number, height: number, fx: string, fy: string, d: number): CSSProperties =>
  ({ left, top, width, height, '--fx': fx, '--fy': fy, '--d': `${d}ms` }) as CSSProperties

/** Fixed 792×646 canvas, zoomed at narrower desktop widths; a stacked version renders below 768px. */
function MarketingOSMap() {
  const { plan, create, approve, launch, engage, measure } = HERO_MAP
  return (
    <div role="img" aria-label="Illustration: the Caption Fox Marketing OS connects Plan, Create, Approve, Launch, Engage and Measure around one workflow. Values shown are sample data." className="relative mx-auto w-full max-w-[792px]">
      {/* Desktop / tablet canvas */}
      <div aria-hidden className="relative hidden h-[646px] w-[792px] md:block [@media(min-width:768px)_and_(max-width:1023px)]:[zoom:0.9] [@media(min-width:1280px)_and_(max-width:1439px)]:[zoom:0.84]">
        <div className="pointer-events-none absolute left-[110px] top-[40px] h-[560px] w-[600px] rounded-full bg-[radial-gradient(closest-side,#E6F0FF_0%,rgba(239,245,255,0.6)_55%,rgba(255,255,255,0)_100%)]" />

        <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 792 646" fill="none">
          {[
            ['M340 110 C 378 110, 376 160, 376 220', 520],
            ['M470 108 C 418 108, 404 160, 404 220', 560],
            ['M262 294 C 282 294, 280 318, 296 318', 600],
            ['M484 320 C 510 320, 516 294, 540 294', 640],
            ['M268 430 C 268 392, 286 380, 300 368', 680],
            ['M392 411 C 392 478, 420 520, 460 520', 720],
            ['M468 400 C 484 404, 494 420, 505 436', 760],
          ].map(([d, delay]) => (
            <path key={d as string} d={d as string} pathLength={1} stroke="#1769FF" strokeOpacity=".55" strokeWidth="1.6" className="cf-draw" style={{ '--d': `${delay}ms` } as CSSProperties} />
          ))}
          {[[340, 110], [376, 206], [470, 108], [262, 294], [540, 294], [484, 320], [268, 430], [392, 424], [460, 520], [505, 436]].map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="4.5" fill="#fff" stroke="#1769FF" strokeWidth="1.8" className="cf-pop" style={{ '--d': '900ms' } as CSSProperties} />
          ))}
        </svg>

        {/* Core */}
        <div className="cf-pop absolute left-[296px] top-[220px] flex h-[191px] w-[188px] flex-col items-center justify-center rounded-[18px] border-[1.5px] border-[#8DB6FF] bg-white shadow-cf-float" style={{ '--d': '160ms' } as CSSProperties}>
          <FoxMark size={80} className="rounded-[18px]" />
          <p className="mt-2 text-[23px] font-bold tracking-[-0.03em] text-cf-blue">Caption Fox</p>
          <p className="text-[14px] text-cf-muted">Marketing OS</p>
          <p className="mt-2 flex items-center gap-2 text-[13px] text-cf-body">
            <span className="h-2.5 w-2.5 rounded-full bg-[#1DB954]" />
            Connected workflow
          </p>
        </div>

        <MapCard title="Plan" subtitle="Turn ideas into campaigns" icon={<Calendar className="h-6 w-6" strokeWidth={1.8} />} iconTone="blue" style={pos(68, 0, 265, 181, '-14px', '-14px', 260)}>
          <div className="flex items-center justify-between rounded-[10px] border border-cf-line px-2.5 py-2">
            <span className="whitespace-nowrap text-[12px] font-semibold tracking-[-0.01em] text-cf-ink">{plan.campaign}</span>
            <Pill tone="green" dot={false} className="gap-1 px-1.5 text-[10.5px]"><CircleCheck className="h-3 w-3" strokeWidth={2.4} />{plan.state}</Pill>
          </div>
          <div className="mt-2 flex items-center gap-2.5">
            <AvatarStack people={TEAM} size={26} />
            <div className="flex flex-1 items-center gap-2 rounded-[10px] bg-cf-tint px-2.5 py-1.5">
              <UsersRound className="h-4 w-4 text-cf-blue" strokeWidth={2} />
              <span className="text-[11px] leading-tight text-cf-muted">{plan.audience}<br />{plan.audienceDetail}</span>
            </div>
          </div>
        </MapCard>

        <MapCard title="Create" subtitle="Produce on-brand content" icon={<PenLine className="h-6 w-6" strokeWidth={1.8} />} iconTone="violet" style={pos(478, 0, 289, 194, '14px', '-14px', 300)}>
          <div className="flex gap-2">
            <div className="flex flex-1 gap-2 rounded-[10px] border border-cf-line p-1.5">
              <MediaThumb kind="hero-sneaker" className="h-[76px] w-[72px]" />
              <div className="min-w-0 pt-0.5">
                <p className="text-[12px] font-semibold text-cf-ink">{create.title}</p>
                <p className="text-[11px] text-cf-subtle">{create.meta}</p>
                <Pill tone="amber" dot={false} className="mt-2.5 px-1.5 text-[10.5px]">{create.state}</Pill>
              </div>
            </div>
            <div className="flex w-[50px] flex-col gap-1">
              <MediaThumb kind="hero-mountain" className="h-[31px] w-full rounded-[6px]" />
              <MediaThumb kind="hero-portrait" className="h-[31px] w-full rounded-[6px]" />
              <span className="flex h-[22px] items-center justify-center rounded-[6px] bg-[#EEEAFE] text-[11px] font-medium text-[#5236D6]">{create.extra}</span>
            </div>
          </div>
        </MapCard>

        <MapCard title="Measure" subtitle="Turn performance into insight" icon={<BarChart3 className="h-6 w-6" strokeWidth={2} />} iconTone="green" style={pos(2, 226, 250, 183, '-16px', '0px', 340)}>
          <SampleBadge className="absolute -bottom-2.5 right-3 px-1.5 text-[8.5px]" />
          <div className="flex rounded-[10px] border border-cf-line">
            <div className="flex w-[104px] items-end gap-[5px] border-r border-cf-line px-2.5 pb-2.5 pt-3">
              {measure.bars.map((h, i) => (
                <span key={i} className="flex-1 rounded-t-[3px] bg-gradient-to-t from-[#5B9BFF] to-[#8FBCFF]" style={{ height: `${h * 0.62}px` }} />
              ))}
            </div>
            <div className="flex-1 px-2 py-1.5">
              <p className="flex items-center gap-1 text-[11px] font-medium text-[#157A45]">
                <CheckCircle2 className="h-3.5 w-3.5 fill-[#1DB954] text-white" strokeWidth={2.4} />Report ready
              </p>
              <dl className="mt-1.5 space-y-[3px] text-[10.5px]">
                {measure.metrics.map((m) => (
                  <div key={m.label} className="flex justify-between">
                    <dt className="text-cf-muted">{m.label}</dt>
                    <dd className="font-medium text-[#157A45]">↑ {m.delta}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </MapCard>

        <MapCard title="Approve" subtitle="Keep work moving" icon={<CheckCircle2 className="h-6 w-6" strokeWidth={1.8} />} iconTone="violet" style={pos(548, 235, 243, 176, '16px', '0px', 380)}>
          <div className="flex rounded-[10px] border border-cf-line">
            <div className="flex-1 space-y-[7px] px-2 py-2 text-[11px] text-cf-body">
              {approve.rows.map((r) => <CheckRow key={r.label} done={r.done}>{r.label}</CheckRow>)}
            </div>
            <div className="flex w-[74px] flex-col items-center justify-center gap-1.5 border-l border-cf-line">
              <Avatar person={TEAM[2]} size={30} />
              <span className="rounded-[6px] bg-[#EAF2FF] px-1.5 py-1 text-[10.5px] font-semibold text-cf-blue-deep">{approve.state}</span>
            </div>
          </div>
        </MapCard>

        <MapCard title="Engage" subtitle="Build community and convert" icon={<Users className="h-6 w-6" strokeWidth={1.8} />} iconTone="pink" style={pos(68, 441, 269, 205, '-14px', '14px', 420)}>
          <ul className="divide-y divide-cf-line rounded-[10px] border border-cf-line">
            {engage.rows.map((r) => (
              <li key={r.handle} className="flex items-start gap-2 px-2 py-1.5">
                <Avatar person={r.person} size={26} />
                <span className="min-w-0 flex-1 text-[11px] leading-tight">
                  <span className="block font-semibold text-cf-ink">{r.handle}</span>
                  <span className="text-cf-muted">{r.text}</span>
                </span>
                <span className="text-[10px] text-cf-subtle">{r.time}</span>
              </li>
            ))}
            <li className="flex items-center gap-2 px-2 py-1.5 text-[11px] text-cf-body">
              <MessageCircle className="h-4 w-4 fill-cf-blue text-cf-blue" />
              {engage.summary}
            </li>
          </ul>
        </MapCard>

        <MapCard title="Launch" subtitle="Publish everywhere" icon={<Send className="h-6 w-6" strokeWidth={1.8} />} iconTone="blue" style={pos(469, 446, 284, 200, '14px', '14px', 460)}>
          <ul className="divide-y divide-cf-line rounded-[10px] border border-cf-line">
            {launch.rows.map((r, i) => (
              <li key={r.label} className="flex items-center gap-2.5 px-2 py-[7px]">
                <ChannelIcon channel={['instagram', 'email', 'web'][i]} size={19} />
                <span className="flex-1 text-[12px] text-cf-body">{r.label}</span>
                <Pill tone="green" className="text-[10px]">{r.state}</Pill>
                <MoreHorizontal className="h-3.5 w-3.5 text-cf-subtle" />
              </li>
            ))}
          </ul>
        </MapCard>
      </div>

      {/* Mobile: simplified stacked map */}
      <div aria-hidden className="md:hidden">
        <div className="cf-pop mx-auto flex w-[220px] flex-col items-center rounded-[18px] border-[1.5px] border-[#8DB6FF] bg-white px-4 py-5 shadow-cf-float">
          <FoxMark size={60} />
          <p className="mt-2 text-[20px] font-bold tracking-[-0.03em] text-cf-blue">Caption Fox</p>
          <p className="text-[13px] text-cf-muted">Marketing OS</p>
          <p className="mt-1.5 flex items-center gap-2 text-[12px] text-cf-body"><span className="h-2 w-2 rounded-full bg-[#1DB954]" />Connected workflow</p>
        </div>
        <div className="mx-auto h-5 w-px bg-cf-blue/40" />
        <ul className="grid grid-cols-2 gap-2.5">
          {[
            { t: 'Plan', s: plan.state, i: <Calendar className="h-5 w-5" />, tone: 'blue' as const },
            { t: 'Create', s: create.state, i: <PenLine className="h-5 w-5" />, tone: 'violet' as const },
            { t: 'Approve', s: approve.state, i: <CheckCircle2 className="h-5 w-5" />, tone: 'violet' as const },
            { t: 'Launch', s: '3 channels scheduled', i: <Send className="h-5 w-5" />, tone: 'blue' as const },
            { t: 'Engage', s: engage.summary, i: <Users className="h-5 w-5" />, tone: 'pink' as const },
            { t: 'Measure', s: 'Report ready', i: <BarChart3 className="h-5 w-5" />, tone: 'green' as const },
          ].map((c, i) => (
            <li key={c.t} className="cf-pop flex items-center gap-2.5 rounded-[14px] border border-cf-line bg-white p-2.5 shadow-cf-card" style={{ '--d': `${200 + i * 60}ms` } as CSSProperties}>
              <IconTile tone={c.tone} className="h-10 w-10">{c.i}</IconTile>
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold text-cf-ink">{c.t}</span>
                <span className="block truncate text-[11.5px] text-cf-muted">{c.s}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
