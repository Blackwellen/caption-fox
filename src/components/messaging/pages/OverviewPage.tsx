import { Bell, CheckCircle2, CircleAlert, FileText, Gauge, Mail, MousePointerClick, RefreshCw, Target, Users, Workflow } from 'lucide-react'
import type { RawParams } from '@/lib/messaging/query'
import { CHANNEL_LABELS, MESSAGING_CHANNELS, type MessagingChannel } from '@/lib/messaging/constants'
import {
  audienceDetails, categoryShare, channelConfigs, channelPerformance, latestDrafts, listJourneySummaries, listPrograms,
  messageStatusCounts, pickCanvasJourney, recentlyChangedAudiences, signMedia, submissionCounts, activityFeed, templatesWhere,
} from '@/lib/messaging/dashboard'
import { channelHealth } from '@/lib/messaging/data'
import { fmtCompact, fmtInt, fmtPct, rate, ratesOf } from '@/lib/messaging/metrics'
import { loadMessagingPage, one, userEmail } from '../design/server'
import { AccessBlocked } from '../states'
import { PageHead, HeadButton, HeadMore, KpiBand, type Kpi } from '../design/PageHead'
import { Card, ChannelIcon, NextActionList, Pill, ViewLink, CornerLink, T, type NextAction } from '../design/kit'
import OverviewComposer from '../design/OverviewComposer'
import ParamSelect from '../design/ParamSelect'
import JourneyCanvas from '../design/JourneyCanvas'
import FilterBar from '../design/FilterBar'
import { BarList, Donut, DonutLegend, Legend, LineChart, type Slice } from '../design/charts'
import { DataTable, EmptyRows } from '../design/Table'
import Pagination from '../design/Pagination'
import { AudienceCell, CATEGORY_LABEL, ChannelMix, LastSent, NameCell, cols } from '../design/programs'
import { ActivityList, AlertList, HealthCaption, HealthList, type AlertRow } from '../design/rail'
import ProgramViews from '../design/ProgramViews'

const MIX_COLORS: Record<MessagingChannel, string> = { email: '#2563eb', sms: '#34d399', whatsapp: '#93c5fd', rcs: '#c4b5fd', push: '#a78bfa' }
const TREND = [
  { key: 'sent', label: 'Sent', color: '#2563eb' }, { key: 'delivered', label: 'Delivered', color: '#16a34a' },
  { key: 'opened', label: 'Opened', color: '#8b5cf6' }, { key: 'clicked', label: 'Clicked', color: '#f97316' },
]

export default async function OverviewPage({ searchParams }: { searchParams: RawParams }) {
  const s = await loadMessagingPage('overview', searchParams)
  if (!s.access.allowed) return <AccessBlocked access={s.access} />
  const { supabase, ctx, capabilities, channels, period, page, size, people, views } = s
  const ws = ctx.workspaceId

  const [perf, programs, journeys, audiences, configs, health, statusCounts, categories, drafts, alertsTemplates, feed, email] = await Promise.all([
    channelPerformance(supabase, ws, channels, period),
    listPrograms(supabase, ws, {
      channels: one(searchParams, 'channel') ? [one(searchParams, 'channel') as MessagingChannel] : channels, minChannels: 2,
      status: one(searchParams, 'status'), owner: one(searchParams, 'owner'), audience: one(searchParams, 'segment'),
      category: one(searchParams, 'category'), page, size,
    }),
    listJourneySummaries(supabase, ws),
    audienceDetails(supabase, ws),
    channelConfigs(supabase, ws),
    channelHealth(supabase, ws),
    messageStatusCounts(supabase, ws, channels),
    categoryShare(supabase, ws, channels),
    latestDrafts(supabase, ws, channels).then(signMedia),
    templatesWhere(supabase, ws, q => q.not('approval_expires_at', 'is', null).lte('approval_expires_at', new Date(Date.now() + 14 * 86_400_000).toISOString()), 20),
    activityFeed(supabase, ws, ['overview', 'email', 'whatsapp', 'journeys'], 5),
    userEmail(supabase),
  ])
  const submissions = await submissionCounts(supabase, ws, ['email', 'sms', 'whatsapp', 'rcs', 'push'], 'submitted_for_approval', period)

  const now = ratesOf(perf.current)
  const kpis: Kpi[] = [
    { id: 'sent', label: 'Total messages sent', value: fmtCompact(perf.current.sent), icon: <Mail />, tile: 'bg-blue-50 text-blue-600', delta: perf.deltas.sent, unit: '%', compare: period.prevLabel },
    { id: 'delivery', label: 'Delivery rate', value: fmtPct(now.delivery), icon: <CheckCircle2 />, tile: 'bg-emerald-50 text-emerald-600', delta: perf.deltas.delivery, unit: 'pp', compare: period.prevLabel },
    { id: 'open', label: 'Open rate', value: fmtPct(now.open), icon: <Mail />, tile: 'bg-blue-50 text-blue-600', delta: perf.deltas.open, unit: 'pp', compare: period.prevLabel },
    { id: 'click', label: 'Click rate', value: fmtPct(now.click), icon: <MousePointerClick />, tile: 'bg-violet-50 text-violet-600', delta: perf.deltas.click, unit: 'pp', compare: period.prevLabel },
    { id: 'conversion', label: 'Conversion rate', value: fmtPct(now.conversion), icon: <RefreshCw />, tile: 'bg-sky-50 text-sky-600', delta: perf.deltas.conversion, unit: 'pp', compare: period.prevLabel },
    { id: 'review', label: 'Messages needing review', value: String(statusCounts.pending), icon: <CircleAlert />, tile: 'bg-orange-50 text-orange-500', delta: submissions.current - submissions.previous, unit: 'count', inverse: true, compare: period.prevLabel },
  ]

  // Audience panel: the audience chosen in the URL, else the largest reachable segment.
  const selectedAudience = audiences.find(a => a.id === one(searchParams, 'audience')) ?? audiences[0]
  const canvasJourney = pickCanvasJourney(journeys, null, one(searchParams, 'journey'))

  // Journey status breakdown: scheduled = active with a future launch.
  const nowMs = Date.now()
  const js = { active: 0, scheduled: 0, draft: 0, paused: 0 }
  for (const j of journeys) {
    if (j.status === 'active' && j.next_launch_at && Date.parse(j.next_launch_at) > nowMs) js.scheduled++
    else if (j.status === 'active') js.active++
    else if (j.status === 'draft') js.draft++
    else if (j.status === 'paused') js.paused++
  }
  const journeySlices: Slice[] = [
    { key: 'active', label: 'Active', value: js.active, color: '#2563eb' }, { key: 'scheduled', label: 'Scheduled', value: js.scheduled, color: '#60a5fa' },
    { key: 'draft', label: 'Draft', value: js.draft, color: '#c7d2fe' }, { key: 'paused', label: 'Paused', value: js.paused, color: '#94a3b8' },
  ]
  const journeyTotal = journeySlices.reduce((a, b) => a + b.value, 0)
  const mixSlices: Slice[] = MESSAGING_CHANNELS.filter(c => channels.includes(c)).map(c => ({ key: c, label: CHANNEL_LABELS[c], value: perf.byChannel[c].sent, color: MIX_COLORS[c] }))

  // Delivery alerts derived from real programme counters and provider state.
  const alertRows: AlertRow[] = []
  const worstFailure = programs.rows.concat().sort((a, b) => (b.failed_count / Math.max(1, b.sent_count)) - (a.failed_count / Math.max(1, a.sent_count)))[0]
  if (worstFailure && worstFailure.sent_count > 0 && worstFailure.failed_count / worstFailure.sent_count > 0.01) {
    alertRows.push({ id: 'bounce', title: 'High bounce rate', sub: worstFailure.name, value: fmtPct(rate(worstFailure.failed_count, worstFailure.sent_count)), icon: 'shield', iconTone: 'bg-red-50 text-red-500', href: `/app/messaging/messages/${worstFailure.id}?tab=delivery` })
  }
  const worstOptOut = programs.rows.concat().sort((a, b) => (b.opt_out_count / Math.max(1, b.sent_count)) - (a.opt_out_count / Math.max(1, a.sent_count)))[0]
  if (worstOptOut && worstOptOut.opt_out_count > 0) {
    alertRows.push({ id: 'unsub', title: 'Spike in unsubscribes', sub: worstOptOut.name, value: fmtPct(rate(worstOptOut.opt_out_count, worstOptOut.sent_count)), valueTone: 'amber', icon: 'clock', iconTone: 'bg-orange-50 text-orange-500', href: `/app/messaging/messages/${worstOptOut.id}?tab=performance` })
  }
  const waIssues = (configs.whatsapp.config.failed_issues as { label: string; count: number }[] | undefined) ?? []
  if (channels.includes('whatsapp') && waIssues.length) {
    alertRows.push({ id: 'wa', title: 'WhatsApp delivery issues', sub: `${waIssues.length} issue types`, icon: 'whatsapp', iconTone: 'bg-emerald-50 text-emerald-600', href: '/app/messaging/whatsapp', action: 'View' })
  }

  const atRiskJourneys = journeys.filter(j => j.health !== 'good' || j.trigger?.approval === 'pending').length
  const changedAudiences = recentlyChangedAudiences(audiences).length
  const next: NextAction[] = [
    { id: 'approve', label: `Approve ${statusCounts.pending} messages`, sub: 'Awaiting your review', count: statusCounts.pending, href: '/app/messaging/email?status=pending_approval', icon: <Users className="h-3.5 w-3.5 lg:h-[10px] lg:w-[10px]" />, tone: 'bg-blue-50 text-blue-600' },
    { id: 'journeys', label: 'Review in-progress journeys', sub: `${atRiskJourneys} journeys need attention`, count: atRiskJourneys, href: '/app/messaging/journeys?health=at_risk', icon: <Workflow className="h-3.5 w-3.5 lg:h-[10px] lg:w-[10px]" />, tone: 'bg-violet-50 text-violet-600' },
    { id: 'alerts', label: 'Resolve delivery alerts', sub: `${alertRows.length} alerts affecting performance`, count: alertRows.length, href: '/app/messaging/email', icon: <Bell className="h-3.5 w-3.5 lg:h-[10px] lg:w-[10px]" />, tone: 'bg-red-50 text-red-500', countTone: 'bg-red-50 text-red-500' },
    { id: 'templates', label: `Update ${alertsTemplates.length} templates`, sub: 'Templates expiring soon', count: alertsTemplates.length, href: '/app/messaging/templates?status=in_review', icon: <FileText className="h-3.5 w-3.5 lg:h-[10px] lg:w-[10px]" />, tone: 'bg-blue-50 text-blue-600' },
    { id: 'audiences', label: 'Audience size changes', sub: `${changedAudiences} segments updated`, count: changedAudiences, href: '/app/messaging/channels', icon: <Target className="h-3.5 w-3.5 lg:h-[10px] lg:w-[10px]" />, tone: 'bg-emerald-50 text-emerald-600', countTone: 'bg-orange-50 text-orange-500' },
  ].filter(a => (a.count ?? 0) > 0)

  const healthRows = health.filter(h => channels.includes(h.channel)).map(h => ({
    id: h.channel, label: CHANNEL_LABELS[h.channel], icon: <ChannelIcon channel={h.channel} className="lg:h-[10px] lg:w-[10px]" />, status: h.status, href: '/app/messaging/channels',
  }))
  const senders: Partial<Record<MessagingChannel, string[]>> = {
    email: (configs.email.config.from_identities as string[] | undefined) ?? [],
    sms: (configs.sms.config.sender_ids as string[] | undefined) ?? [],
    whatsapp: [String(configs.whatsapp.config.sender ?? 'Acme Store')].filter(Boolean),
    rcs: [String(configs.rcs.config.sender ?? '')].filter(Boolean),
    push: ['Acme App'],
  }

  const reach = selectedAudience?.channel_reach ?? {}
  const eligibility = MESSAGING_CHANNELS.filter(c => channels.includes(c)).map(c => ({ channel: c, eligible: reach[c]?.eligible ?? null }))

  return (
    <div>
      <PageHead crumb="Overview" title="Messaging Overview"
        subtitle="Orchestrate lifecycle messaging across channels, track performance, and take action to drive engagement and conversions."
        actions={<>
          <HeadButton primary icon="plus" label="New message" href={capabilities.create ? '/app/messaging/email/compose' : undefined} disabledReason={capabilities.create ? null : 'Your role cannot create messages.'} />
          <HeadButton primary icon="plus" label="New journey" href={capabilities.manageJourneys ? '/app/messaging/journeys/new' : undefined} disabledReason={capabilities.manageJourneys ? null : 'Your role cannot create journeys.'} />
          <HeadButton icon="upload" label="Import audience" href={capabilities.manageAudience ? '/app/messaging/channels#audiences' : undefined} disabledReason={capabilities.manageAudience ? null : 'Your role cannot manage audiences.'} />
          <HeadButton icon="download" label="Export" download href={capabilities.export ? '/app/messaging/export?entity=messages' : undefined} disabledReason={capabilities.export ? null : 'Your role cannot export data.'} />
          <HeadMore items={[{ label: 'Refresh data', refresh: true }, { label: 'Channels & providers', href: '/app/messaging/channels' }, { label: 'Journeys', href: '/app/messaging/journeys' }, { label: 'Templates', href: '/app/messaging/templates' }]} />
        </>} />

      <KpiBand items={kpis} />

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_236px] xl:gap-[10px]">
        <div className="min-w-0 space-y-3 lg:space-y-[10px]">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[294fr_262fr_372fr] xl:gap-[8px]">
            <Card title="Compose message" className="xl:h-[340px]">
              <OverviewComposer channels={channels} drafts={drafts} senders={senders} userEmail={email}
                audiences={audiences.map(a => ({ id: a.id, name: a.name }))}
                canCreate={capabilities.create} canTest={capabilities.testSend} canSubmit={capabilities.edit} />
            </Card>

            <Card title="Audience" className="xl:h-[340px]" bodyClassName="flex flex-col">
              {selectedAudience ? (
                <>
                  <div className="space-y-2 lg:space-y-[12px]">
                    <AudRow label="Segment"><ParamSelect param="audience" label="Segment" value={selectedAudience.id} options={audiences.map(a => ({ value: a.id, label: a.name }))} className="lg:w-[152px]" /></AudRow>
                    <AudRow label="Size"><span className="text-[13px] font-semibold text-slate-900 lg:text-[10px]">{fmtInt(selectedAudience.contact_count)}</span></AudRow>
                    <AudRow label="Tags"><Chips items={selectedAudience.tags} tone="green" max={2} /></AudRow>
                    <AudRow label="Exclusions"><Chips items={selectedAudience.exclusions} tone="violet" max={2} /></AudRow>
                  </div>
                  <p className={`${T.body} mt-4 lg:mt-[22px]`}>Channel eligibility</p>
                  <ul className="mt-2 grid grid-cols-5 gap-1 text-center lg:mt-[10px]">
                    {eligibility.map(e => (
                      <li key={e.channel} className="flex flex-col items-center">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50/70 lg:h-[26px] lg:w-[26px]">
                          <ChannelIcon channel={e.channel} className={e.channel === 'whatsapp' ? 'text-emerald-600' : e.channel === 'push' ? 'text-violet-600' : 'text-blue-600'} />
                        </span>
                        <span className="mt-1 text-[11px] text-slate-500 lg:mt-[6px] lg:text-[7.5px]">{CHANNEL_LABELS[e.channel]}</span>
                        <span className="mt-0.5 text-[12px] font-semibold text-slate-900 lg:text-[9.5px]">{fmtPct(e.eligible === null ? null : rate(e.eligible, selectedAudience.contact_count))}</span>
                        <span className="text-[11px] text-slate-500 lg:text-[8.5px]">{fmtInt(e.eligible)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto pt-3"><ViewLink href="/app/messaging/channels#audiences" className="ml-0">View audience details</ViewLink></div>
                </>
              ) : <EmptyRows title="No audiences yet" description="Create an audience from any composer to see size, exclusions and channel eligibility here." />}
            </Card>

            <Card title="Journey canvas" className="md:col-span-2 xl:col-span-1 xl:h-[340px]">
              <JourneyCanvas
                nodes={canvasJourney?.canvas.nodes ?? []} edges={canvasJourney?.canvas.edges ?? []} journeyId={canvasJourney?.id ?? null}
                journeys={journeys.filter(j => j.canvas?.nodes?.length).map(j => ({ id: j.id, name: j.name, status: j.status }))}
                height={276} editHref={canvasJourney ? `/app/messaging/journeys/${canvasJourney.id}` : undefined} />
            </Card>
          </div>

          <FilterBar surface="overview" savedViews={views} date={{ label: period.label }} views={['cards', 'list', 'board']}
            filters={[
              { key: 'channel', label: 'Channel', options: channels.map(c => ({ value: c, label: CHANNEL_LABELS[c] })) },
              { key: 'status', label: 'Journey status', options: [{ value: 'sending', label: 'Active' }, { value: 'scheduled', label: 'Scheduled' }, { value: 'paused', label: 'Paused' }, { value: 'draft', label: 'Draft' }] },
              { key: 'category', label: 'Campaign', options: Object.entries(CATEGORY_LABEL).map(([value, label]) => ({ value, label })) },
              { key: 'owner', label: 'Owner', options: people.map(p => ({ value: p.id, label: p.full_name ?? p.email ?? 'Member' })) },
              { key: 'segment', label: 'Audience', options: audiences.map(a => ({ value: a.id, label: a.name })) },
              { key: 'tag', label: 'Tags', options: [...new Set(audiences.flatMap(a => a.tags))].slice(0, 30).map(t => ({ value: t, label: t })) },
            ]} />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[244fr_238fr_210fr_218fr] xl:gap-[8px]">
            <Card title="Performance trend" className="xl:h-[152px]" action={<span className="rounded-[4px] border border-slate-200 px-2 py-0.5 text-[11px] text-slate-600 lg:text-[8px]">Daily</span>}>
              <Legend series={TREND} className="mb-1" />
              <LineChart data={perf.series as unknown as Record<string, number | string>[]} series={TREND} height={96} />
            </Card>
            <Card title="Channel mix" className="xl:h-[152px]">
              <div className="flex items-center gap-3 lg:gap-[12px]">
                <Donut slices={mixSlices} size={92} thickness={13} center={<span className="text-[13px] font-semibold text-slate-900 lg:text-[11px]">{fmtCompact(perf.current.sent)}</span>} sub={<span className="text-[10px] text-slate-500 lg:text-[7.5px]">Total</span>} />
                <DonutLegend slices={mixSlices} className="flex-1" format={(sl, share) => <>{share.toFixed(1)}% <span className="text-slate-400">({fmtCompact(sl.value)})</span></>} />
              </div>
            </Card>
            <Card title="Journey status" className="xl:h-[152px]">
              <div className="flex items-center gap-3">
                <Donut slices={journeySlices} size={92} thickness={13} center={<span className="text-[14px] font-semibold text-slate-900 lg:text-[12px]">{journeyTotal}</span>} sub={<span className="text-[10px] text-slate-500 lg:text-[7.5px]">Total</span>} />
                <DonutLegend slices={journeySlices} className="flex-1" format={(sl, share) => <>{sl.value} <span className="text-slate-400">({Math.round(share)}%)</span></>} />
              </div>
            </Card>
            <Card title="Top message types" className="xl:h-[152px]" action={<CornerLink href="/app/messaging/export?entity=messages">Export</CornerLink>}>
              <div className="pt-2">
                <BarList thick rows={categories.slice(0, 4).map(c => ({ key: c.category, label: CATEGORY_LABEL[c.category] ?? c.category, value: c.share, max: 100, display: `${c.share.toFixed(1)}%` }))} />
              </div>
            </Card>
          </div>

          <Card title="Messaging programs" bodyClassName="px-0 pb-0 lg:px-0 lg:pb-0">
            <ProgramViews rows={programs.rows} view={one(searchParams, 'view')} table={
              <DataTable caption="Messaging programs" rows={programs.rows}
                empty={<EmptyRows title="No cross-channel programs match" description="Clear filters, or create a journey that sends across more than one channel." />}
                columns={[
                  { key: 'name', header: 'Program', cell: r => <NameCell row={r} />, className: 'lg:w-[96px]' },
                  { key: 'mix', header: 'Channel mix', cell: r => <ChannelMix channels={r.channel_mix} /> },
                  { key: 'audience', header: 'Audience', cell: r => <AudienceCell row={r} /> },
                  cols.sent(), cols.rate('delivery', 'Delivery rate'), cols.rate('open', 'Open rate'), cols.rate('click', 'Click rate'),
                  cols.rate('conversion', 'Conversion rate'), cols.status(), cols.owner(),
                  { key: 'last', header: 'Last sent', cell: r => <LastSent row={r} /> }, cols.actions(capabilities.edit),
                ]} />
            } />
            {programs.error && <p role="alert" className="px-3 py-2 text-[12px] text-red-600">Programs could not be loaded. Refresh to try again.</p>}
          </Card>
          <Pagination page={page} size={size} total={programs.total} noun="programs" />
        </div>

        <aside className="min-w-0 space-y-3 lg:space-y-[8px]" aria-label="Messaging insights">
          <Card title="Next actions">
            <NextActionList items={next} />
            <div className="pt-2"><ViewLink href="/app/messaging/email?status=pending_approval">View all tasks</ViewLink></div>
          </Card>
          <Card title="Recent activity">
            <ActivityList items={feed} />
            <div className="pt-2"><ViewLink href="/app/messaging/journeys">View all activity</ViewLink></div>
          </Card>
          <Card title="Delivery alerts" action={<CornerLink href="/app/messaging/email">View all</CornerLink>}>
            <AlertList rows={alertRows} />
          </Card>
          <Card title="Channel health" action={<HealthCaption allOk={healthRows.every(h => h.status === 'connected')} />}>
            <HealthList rows={healthRows} />
            <div className="pt-2"><ViewLink href="/app/messaging/channels">View integration status</ViewLink></div>
          </Card>
        </aside>
      </div>
    </div>
  )
}

function AudRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-[26px] items-center gap-2 lg:min-h-[20px]">
      <span className="w-20 shrink-0 text-[12px] text-slate-500 lg:w-[52px] lg:text-[8.5px]">{label}</span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1 lg:flex-nowrap lg:gap-[5px]">{children}</div>
    </div>
  )
}

export function Chips({ items, tone, max }: { items: string[]; tone: 'green' | 'violet'; max: number }) {
  return (
    <>
      {items.slice(0, max).map(t => <Pill key={t} tone={tone}>{t}</Pill>)}
      {items.length > max && <Pill tone="outline">+{items.length - max}</Pill>}
      {items.length === 0 && <span className="text-[12px] text-slate-400 lg:text-[8.5px]">None</span>}
    </>
  )
}

export { Gauge }
