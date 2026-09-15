// Lightweight, static product previews for the auth pages. Purpose-built so
// the public auth bundle never pulls in the app shell. All data here is
// illustrative sample content (announced to assistive tech as such).
import Image from 'next/image'
import {
  Activity, ArrowRight, CalendarDays, ChartColumn, ChevronDown, CircleCheck, ClipboardList, CreditCard, FileText,
  FolderOpen, House, Link2, MessageSquare, Ellipsis, Settings, ShieldCheck, SquarePen, Users, Video, Wallet,
} from 'lucide-react'
import { cn } from '@/lib/utils'

function Frame({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <figure className="cf-rise overflow-hidden rounded-[20px] border border-cf-line-strong/80 bg-white shadow-cf-float" style={{ ['--d' as string]: '200ms' }}>
      <figcaption className="sr-only">{label}</figcaption>
      <div aria-hidden className="flex">{children}</div>
    </figure>
  )
}

function MiniSidebar({ items, active }: { items: { icon: React.ElementType; label: string }[]; active: string }) {
  return (
    <div className="hidden w-[150px] shrink-0 flex-col px-2.5 py-4 md:flex">
      <div className="mb-4 flex items-center gap-2 px-1.5">
        <Image src="/caption fox favicon.png" alt="" width={26} height={26} className="h-[26px] w-[26px] rounded-md" />
        <span className="text-[14px] font-semibold tracking-tight text-cf-blue">Caption Fox</span>
      </div>
      <ul className="space-y-0.5">
        {items.map(({ icon: Icon, label }) => (
          <li key={label} className={cn('flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[11.5px]', label === active ? 'bg-cf-tint-2 font-semibold text-cf-blue' : 'text-cf-body')}>
            <Icon size={14} strokeWidth={1.8} />{label}
          </li>
        ))}
      </ul>
    </div>
  )
}

function Pill({ tone, children }: { tone: 'green' | 'blue' | 'amber' | 'slate' | 'red'; children: React.ReactNode }) {
  const t = {
    green: 'bg-[#E7F8EF] text-[#15803D]',
    blue: 'bg-cf-tint-2 text-cf-blue',
    amber: 'bg-[#FFF4E0] text-[#B45309]',
    slate: 'bg-[#EEF2F7] text-cf-body',
    red: 'bg-[#FDECEC] text-[#C62828]',
  }[tone]
  return <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-[3px] text-[9.5px] font-medium', t)}><CircleCheck size={10} />{children}</span>
}

function Thumb({ tone, icon: Icon }: { tone: string; icon: React.ElementType }) {
  return <span className={cn('flex h-[42px] w-[56px] shrink-0 items-center justify-center rounded-md text-white', tone)}><Icon size={16} /></span>
}

export function WorkspacePreview() {
  return (
    <Frame label="Illustrative preview of a Caption Fox workspace home screen with sample content">
      <MiniSidebar
        active="Home"
        items={[
          { icon: House, label: 'Home' }, { icon: CircleCheck, label: 'Campaigns' }, { icon: SquarePen, label: 'Content' },
          { icon: Users, label: 'Audience' }, { icon: ChartColumn, label: 'Analytics' }, { icon: Settings, label: 'Settings' },
        ]}
      />
      <div className="m-2.5 ml-0 min-w-0 flex-1 rounded-[14px] border border-cf-line bg-white p-4 max-md:ml-2.5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cf-tint-2 text-cf-blue"><CalendarDays size={14} /></span>
            <div>
              <p className="text-[14px] font-semibold text-cf-ink">Good morning!</p>
              <p className="text-[10px] text-cf-muted">Here&apos;s what&apos;s happening with your marketing.</p>
            </div>
          </div>
          <span className="flex items-center gap-1.5 rounded-md bg-cf-blue px-4 py-1.5 text-[11px] font-medium text-white">Create <ChevronDown size={11} /></span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            { icon: CalendarDays, title: 'Campaigns', sub: 'Q2 Brand Campaign', pill: <Pill tone="green">Active</Pill>, tone: 'bg-cf-tint-2 text-cf-blue' },
            { icon: CircleCheck, title: 'Content', sub: '12 pieces', pill: <Pill tone="blue">In progress</Pill>, tone: 'bg-cf-violet-soft text-[#5B3DF5]' },
            { icon: ChartColumn, title: 'Performance', sub: 'View insights', pill: <Pill tone="green">Ready</Pill>, tone: 'bg-[#E7F8EF] text-[#16A34A]' },
          ].map(c => (
            <div key={c.title} className="rounded-lg border border-cf-line p-2.5">
              <div className="flex items-start gap-2">
                <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-md', c.tone)}><c.icon size={13} /></span>
                <div className="min-w-0"><p className="text-[11px] font-semibold text-cf-ink">{c.title}</p><p className="truncate text-[9.5px] text-cf-muted">{c.sub}</p></div>
              </div>
              <div className="mt-2 pl-9">{c.pill}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between"><p className="text-[12px] font-semibold text-cf-ink">Upcoming</p><span className="flex items-center gap-1 text-[10px] font-medium text-cf-blue">View all <ArrowRight size={10} /></span></div>
        <div className="mt-1.5 divide-y divide-cf-line rounded-lg border border-cf-line">
          {[
            { title: 'Summer Drop Video', meta: 'Video · Mon, 11 Nov', pill: <Pill tone="green">Scheduled</Pill>, thumb: <Thumb tone="bg-gradient-to-br from-[#9CC3F5] to-[#1769FF]" icon={Video} /> },
            { title: 'Brand Story Posts', meta: 'Social · Tue, 12 Nov', pill: <Pill tone="slate">Draft</Pill>, thumb: <Thumb tone="bg-gradient-to-br from-[#C9B8FF] to-[#7357FF]" icon={FileText} /> },
          ].map(r => (
            <div key={r.title} className="flex items-center gap-3 px-2 py-1.5">
              {r.thumb}
              <div className="min-w-0 flex-1"><p className="truncate text-[11px] font-semibold text-cf-ink">{r.title}</p><p className="text-[9.5px] text-cf-muted">{r.meta}</p></div>
              {r.pill}<Ellipsis size={13} className="text-cf-muted" />
            </div>
          ))}
        </div>
      </div>
    </Frame>
  )
}

export function AffiliateDashboardPreview() {
  return (
    <Frame label="Illustrative preview of the Caption Fox affiliate dashboard with sample figures">
      <MiniSidebar
        active="Dashboard"
        items={[{ icon: House, label: 'Dashboard' }, { icon: Users, label: 'Referrals' }, { icon: CreditCard, label: 'Payouts' }, { icon: FolderOpen, label: 'Resources' }, { icon: Settings, label: 'Settings' }]}
      />
      <div className="m-2.5 ml-0 min-w-0 flex-1 rounded-[14px] border border-cf-line bg-white p-4 max-md:ml-2.5">
        <div className="flex items-start justify-between">
          <div><p className="text-[14px] font-semibold text-cf-ink">Affiliate Dashboard</p><p className="text-[10px] text-cf-muted">Here&apos;s your affiliate performance at a glance.</p></div>
          <span className="flex items-center gap-1.5 rounded-md border border-cf-line px-2.5 py-1.5 text-[10px] font-medium text-cf-ink"><CalendarDays size={11} className="text-cf-blue" /> Sample data</span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            { icon: Link2, value: '248', label: 'Referral clicks', delta: '12%', tone: 'bg-cf-tint-2 text-cf-blue', pill: 'green' as const },
            { icon: Users, value: '36', label: 'Approved signups', delta: '28%', tone: 'bg-cf-violet-soft text-[#5B3DF5]', pill: 'green' as const },
            { icon: Wallet, value: '£540', label: 'Pending payout', delta: 'Pending', tone: 'bg-[#E7F8EF] text-[#16A34A]', pill: 'amber' as const },
          ].map(k => (
            <div key={k.label} className="flex gap-2 rounded-lg border border-cf-line p-2.5">
              <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-md', k.tone)}><k.icon size={13} /></span>
              <div className="min-w-0"><p className="text-[15px] font-bold leading-none text-cf-ink">{k.value}</p><p className="mt-0.5 text-[9.5px] text-cf-muted">{k.label}</p><div className="mt-1"><Pill tone={k.pill}>{k.delta}</Pill></div></div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between"><p className="text-[12px] font-semibold text-cf-ink">Recent referrals</p><span className="flex items-center gap-1 text-[10px] font-medium text-cf-blue">View all <ArrowRight size={10} /></span></div>
        <table className="mt-1.5 w-full text-left text-[9.5px]">
          <thead className="text-cf-muted"><tr><th className="py-1 font-medium">User</th><th className="font-medium">Sign-up date</th><th className="font-medium">Plan</th><th className="font-medium">Status</th></tr></thead>
          <tbody className="divide-y divide-cf-line text-cf-body">
            {[['JS', 'jordan@company.com', '12 Nov 2026', 'Pro', 'Approved'], ['MK', 'morgan@startup.co', '10 Nov 2026', 'Pro', 'Approved'], ['AT', 'alex@creatorhub.com', '8 Nov 2026', 'Basic', 'Pending']].map(r => (
              <tr key={r[1]}>
                <td className="py-1.5"><span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#EEF2F7] text-[8px] font-semibold">{r[0]}</span>{r[1]}</td>
                <td>{r[2]}</td><td>{r[3]}</td><td><Pill tone={r[4] === 'Approved' ? 'green' : 'amber'}>{r[4]}</Pill></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Frame>
  )
}

export function AffiliateOverviewPreview() {
  return (
    <Frame label="Illustrative preview of the affiliate overview with sample figures">
      <MiniSidebar active="Overview" items={[{ icon: House, label: 'Overview' }, { icon: Users, label: 'Referrals' }, { icon: CreditCard, label: 'Payouts' }, { icon: FolderOpen, label: 'Resources' }]} />
      <div className="m-2.5 ml-0 min-w-0 flex-1 rounded-[14px] border border-cf-line bg-white p-4 max-md:ml-2.5">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cf-tint-2 text-cf-blue"><ChartColumn size={15} /></span>
            <div><p className="text-[14px] font-semibold text-cf-ink">Affiliate overview</p><p className="text-[10px] text-cf-muted">Your impact at a glance.</p></div>
          </div>
          <span className="flex items-center gap-1.5 rounded-md bg-cf-tint-2 px-2.5 py-1.5 text-[10px] font-medium text-cf-blue">Sample data</span>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {[['Clicks', '1,248', '12%'], ['Sign-ups', '86', '24%'], ['Conversions', '28', '33%'], ['Est. earnings', '£840', '28%']].map(([l, v, d]) => (
            <div key={l} className="rounded-lg border border-cf-line p-2"><p className="text-[9.5px] text-cf-muted">{l}</p><p className="text-[15px] font-bold text-cf-ink">{v}</p><p className="text-[9.5px] font-medium text-[#15803D]">↑ {d}</p></div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between"><p className="text-[12px] font-semibold text-cf-ink">Recent referrals</p><span className="flex items-center gap-1 text-[10px] font-medium text-cf-blue">View all <ArrowRight size={10} /></span></div>
        <div className="mt-1.5 divide-y divide-cf-line rounded-lg border border-cf-line">
          {[['AS', 'Acme Studio', 'Team plan · 2 days ago', 'Paid', '£120', 'bg-[#111827]'], ['CB', 'Creative Bloom', 'Creator plan · 4 days ago', 'Pending', '£60', 'bg-[#8B7CF6]']].map(r => (
            <div key={r[1]} className="flex items-center gap-2.5 px-2 py-1.5">
              <span className={cn('flex h-7 w-7 items-center justify-center rounded-full text-[9px] font-semibold text-white', r[5])}>{r[0]}</span>
              <div className="min-w-0 flex-1"><p className="text-[11px] font-semibold text-cf-ink">{r[1]}</p><p className="text-[9.5px] text-cf-muted">{r[2]}</p></div>
              <Pill tone={r[3] === 'Paid' ? 'green' : 'blue'}>{r[3]}</Pill><span className="w-10 text-right text-[11px] font-semibold text-cf-ink">{r[4]}</span>
            </div>
          ))}
        </div>
      </div>
    </Frame>
  )
}

export function AdminConsolePreview() {
  return (
    <Frame label="Illustrative preview of the admin console with sample activity — not live platform data">
      <MiniSidebar
        active="Admin"
        items={[{ icon: House, label: 'Admin' }, { icon: FolderOpen, label: 'Workspaces' }, { icon: ClipboardList, label: 'Moderation' }, { icon: MessageSquare, label: 'Support' }, { icon: Activity, label: 'System Health' }, { icon: Settings, label: 'Settings' }]}
      />
      <div className="m-2.5 ml-0 min-w-0 flex-1 rounded-[14px] border border-cf-line bg-white p-4 max-md:ml-2.5">
        <div className="flex items-start justify-between">
          <div><p className="text-[14px] font-semibold text-cf-ink">Admin Console</p><p className="text-[10px] text-cf-muted">Overview of platform activity and requests.</p></div>
          <span className="flex items-center gap-1.5 rounded-md border border-cf-line px-2.5 py-1.5 text-[10px] font-medium text-cf-ink">Sample view</span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="flex gap-2 rounded-lg border border-cf-line p-2.5"><span className="flex h-7 w-7 items-center justify-center rounded-md bg-cf-tint-2 text-cf-blue"><CalendarDays size={13} /></span><div><p className="text-[10px] font-semibold text-cf-ink">Workspaces</p><p className="text-[13px] font-bold text-cf-ink">12</p><p className="text-[9px] text-cf-muted">2 pending requests</p></div></div>
          <div className="flex gap-2 rounded-lg border border-cf-line p-2.5"><span className="flex h-7 w-7 items-center justify-center rounded-md bg-cf-violet-soft text-[#5B3DF5]"><MessageSquare size={13} /></span><div><p className="text-[10px] font-semibold text-cf-ink">Support Queue</p><p className="text-[13px] font-bold text-cf-ink">8</p><p className="text-[9px] text-[#C62828]">3 high priority</p></div></div>
          <div className="flex gap-2 rounded-lg border border-cf-line p-2.5"><span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#E7F8EF] text-[#16A34A]"><ChartColumn size={13} /></span><div><p className="text-[10px] font-semibold text-cf-ink">System Status</p><p className="mt-1 text-[9px] text-cf-muted">● All systems operational</p></div></div>
        </div>
        <div className="mt-3 flex items-center justify-between"><p className="text-[12px] font-semibold text-cf-ink">Recent activity</p><span className="flex items-center gap-1 text-[10px] font-medium text-cf-blue">View all <ArrowRight size={10} /></span></div>
        <div className="mt-1.5 divide-y divide-cf-line rounded-lg border border-cf-line">
          {[
            { icon: Users, t: 'New workspace request', s: 'Acme Marketing', p: <Pill tone="amber">Pending</Pill>, a: '2h ago' },
            { icon: CalendarDays, t: 'Content flagged for review', s: 'Summer Drop Video', p: <Pill tone="blue">In review</Pill>, a: '4h ago' },
            { icon: ShieldCheck, t: 'Support ticket', s: 'Login issue — user cannot access workspace', p: <Pill tone="slate">Open</Pill>, a: '6h ago' },
          ].map(r => (
            <div key={r.t} className="flex items-center gap-2.5 px-2 py-1.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cf-tint-2 text-cf-blue"><r.icon size={12} /></span>
              <div className="min-w-0 flex-1"><p className="truncate text-[10.5px] font-semibold text-cf-ink">{r.t}</p><p className="truncate text-[9.5px] text-cf-muted">{r.s}</p></div>
              {r.p}<span className="w-10 text-right text-[9.5px] text-cf-muted">{r.a}</span>
            </div>
          ))}
        </div>
      </div>
    </Frame>
  )
}
