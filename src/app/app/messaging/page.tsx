import { ChevronRight, Mail, MessageSquare, Send } from 'lucide-react'
import Link from 'next/link'
import { requireMessagingModule } from '@/lib/messaging/server'
import {
  channelHealth, deliveryAlerts, journeyStatusBreakdown, listAudiences, listJourneys,
  listMessages, messageTypeBreakdown, messagingAggregates, metricSeries, recentActivity,
} from '@/lib/messaging/data'
import { parseMessagingQuery, type RawParams } from '@/lib/messaging/query'
import {
  CHANNEL_CONFIG_BADGE, CHANNEL_CONFIG_LABELS, CHANNEL_LABELS,
  JOURNEY_STATUS_LABELS, MESSAGING_CHANNELS, MESSAGING_MODULE_META,
} from '@/lib/messaging/constants'
import MessagingHeader from '@/components/messaging/MessagingHeader'
import KpiStrip from '@/components/messaging/KpiStrip'
import CampaignFilters from '@/components/campaigns/CampaignFilters'
import ActivityFeed from '@/components/messaging/ActivityFeed'
import NewMessageButton from '@/components/messaging/NewMessageButton'
import NewJourneyButton from '@/components/messaging/NewJourneyButton'
import ImportAudienceButton from '@/components/messaging/ImportAudienceButton'
import ExportButton, { HeaderOverflow } from '@/components/messaging/ExportButton'
import MessagingProgramsTable from '@/components/messaging/MessagingProgramsTable'
import { AccessBlocked, LoadError } from '@/components/messaging/states'
import { Panel, MESSAGING_PAGE, formatCompactNumber, formatPercent } from '@/components/messaging/primitives'
import { Badge } from '@/components/ui/Badge'
import {
  ChartLegend, DonutChart, DonutLegend, TrendChart, type DonutSlice, type TrendSeries,
} from '@/components/campaigns/charts'
import type { KpiValue } from '@/lib/messaging/types'

export const metadata = {
  title: 'Messaging · Caption Fox',
  description: 'Orchestrate lifecycle messaging across channels, track performance, and take action to drive engagement and conversions.',
}

const TREND_SERIES: TrendSeries[] = [
  { key: 'sent', label: 'Sent', colour: '#2563eb' },
  { key: 'delivered', label: 'Delivered', colour: '#7dd3fc' },
  { key: 'opened', label: 'Opened', colour: '#8b5cf6' },
  { key: 'clicked', label: 'Clicked', colour: '#34d399' },
]

const CHANNEL_COLOURS: Record<string, string> = {
  email: '#8b5cf6', sms: '#3b82f6', whatsapp: '#10b981', rcs: '#0ea5e9', push: '#f59e0b',
}

const JOURNEY_STATUS_COLOURS: Record<string, string> = {
  active: '#2563eb', scheduled: '#0ea5e9', draft: '#94a3b8', paused: '#f59e0b', completed: '#34d399', archived: '#cbd5e1',
}

const TYPE_LABELS: Record<string, string> = {
  broadcast: 'Promotional', journey: 'Lifecycle', transactional: 'Transactional', test: 'Test',
}

/** Right rail width matches the approved design's fixed-width panel column. */
const RIGHT_RAIL = 'w-full shrink-0 space-y-3 xl:w-[292px]'

export default async function MessagingOverviewPage({
  searchParams,
}: { searchParams: Promise<RawParams> }) {
  const params = await searchParams
  const { supabase, ctx, capabilities, modules, channels, access } = await requireMessagingModule('overview')

  if (!access.allowed) {
    return (
      <div className={MESSAGING_PAGE}>
        <MessagingHeader module="overview" modules={modules} />
        <AccessBlocked access={access} />
      </div>
    )
  }

  const query = parseMessagingQuery(params)
  const to = query.to || new Date().toISOString().slice(0, 10)
  const from = query.from || new Date(Date.parse(to) - 29 * 86_400_000).toISOString().slice(0, 10)

  const [
    aggregates, series, programs, activity, workspaceMembersRes, health,
    audiences, journeys, journeyStatuses, messageTypes, alerts,
  ] = await Promise.all([
    messagingAggregates(supabase, ctx.workspaceId, { channels }),
    metricSeries(supabase, ctx.workspaceId, from, to, { channels }),
    listMessages(supabase, ctx.workspaceId, query, { channels, limit: 12 }),
    recentActivity(supabase, ctx.workspaceId, { limit: 5 }),
    supabase.from('workspace_members').select('user_id, profiles(id, full_name, email, avatar_url)').eq('workspace_id', ctx.workspaceId),
    channelHealth(supabase, ctx.workspaceId),
    listAudiences(supabase, ctx.workspaceId),
    listJourneys(supabase, ctx.workspaceId, { limit: 1 }),
    journeyStatusBreakdown(supabase, ctx.workspaceId),
    messageTypeBreakdown(supabase, ctx.workspaceId, { channels }),
    deliveryAlerts(supabase, ctx.workspaceId),
  ])

  const members = (workspaceMembersRes.data ?? [])
    .map(row => { const p = row.profiles; return Array.isArray(p) ? p[0] : p })
    .filter((p): p is { id: string; full_name: string | null; email: string | null; avatar_url: string | null } => Boolean(p?.id))

  const deliveryRate = formatPercent(aggregates.totalDelivered, aggregates.totalSent, 1)
  const openRate = formatPercent(aggregates.totalOpened, aggregates.totalDelivered, 1)
  const clickRate = formatPercent(aggregates.totalClicked, aggregates.totalDelivered, 1)
  const conversionRate = formatPercent(aggregates.totalConverted, aggregates.totalDelivered, 1)

  const kpis: KpiValue[] = [
    {
      id: 'sent', label: 'Total messages sent', value: new Intl.NumberFormat('en-GB', { notation: 'compact' }).format(aggregates.totalSent),
      hint: `${aggregates.totalPrograms} programs`, icon: 'mail', tone: 'blue',
    },
    { id: 'delivery', label: 'Delivery rate', value: deliveryRate, icon: 'check', tone: 'green' },
    { id: 'open', label: 'Open / read rate', value: openRate, icon: 'gauge', tone: 'blue' },
    { id: 'click', label: 'Click rate', value: clickRate, icon: 'click', tone: 'violet' },
    { id: 'conversion', label: 'Conversion rate', value: conversionRate, icon: 'trend', tone: 'green' },
    {
      id: 'review', label: 'Messages needing review', value: String(aggregates.pendingApproval),
      hint: aggregates.pendingApproval > 0 ? 'Awaiting approval' : 'All clear', icon: 'alert',
      tone: aggregates.pendingApproval > 0 ? 'amber' : 'slate',
    },
  ]

  const channelSlices: DonutSlice[] = MESSAGING_CHANNELS
    .filter(channel => channels.includes(channel))
    .map(channel => ({
      key: channel, label: CHANNEL_LABELS[channel],
      value: aggregates.byChannel[channel] ?? 0, colour: CHANNEL_COLOURS[channel],
    }))

  const journeySlices: DonutSlice[] = journeyStatuses.map(row => ({
    key: row.status, label: JOURNEY_STATUS_LABELS[row.status as keyof typeof JOURNEY_STATUS_LABELS] ?? row.status,
    value: row.count, colour: JOURNEY_STATUS_COLOURS[row.status] ?? '#94a3b8',
  }))
  const totalJourneys = journeySlices.reduce((sum, s) => sum + s.value, 0)

  const trendData = series.points.map(point => ({
    date: point.metric_date, sent: point.sent, delivered: point.delivered, opened: point.opened, clicked: point.clicked,
  }))

  const nextActions = [
    {
      id: 'approve', label: 'Approve messages', sub: 'Awaiting your review',
      count: aggregates.pendingApproval, href: '/app/messaging/email?status=pending_approval', tone: 'bg-blue-50 text-blue-600',
    },
    {
      id: 'active', label: 'Active programs', sub: 'Currently sending or scheduled',
      count: aggregates.activePrograms, href: '/app/messaging/email', tone: 'bg-emerald-50 text-emerald-600',
    },
    {
      id: 'optouts', label: 'Opt-outs to review', sub: 'Across all channels this period',
      count: aggregates.totalOptOuts, href: '/app/messaging/sms', tone: 'bg-amber-50 text-amber-600',
    },
  ].filter(action => action.count > 0)

  const totalChannelSent = channelSlices.reduce((sum, slice) => sum + slice.value, 0)
  const latestJourney = journeys.rows[0]
  const topAudience = audiences[0]

  return (
    <div className={MESSAGING_PAGE}>
      <MessagingHeader
        module="overview" modules={modules}
        actions={
          <>
            <NewMessageButton channels={channels} />
            <NewJourneyButton />
            <ImportAudienceButton allowed={capabilities.import} />
            <ExportButton entity="messages" allowed={capabilities.export} />
            <HeaderOverflow items={[
              { label: 'Refresh data' },
              { label: 'Email', href: '/app/messaging/email' },
              { label: 'Journeys', href: '/app/messaging/journeys' },
              { label: 'Templates', href: '/app/messaging/templates' },
            ]} />
          </>
        }
      />

      <KpiStrip items={kpis} className="mb-3" />

      {/* Two-column shell: main content + a fixed-width right rail, matching the approved design's proportions. */}
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,1.2fr)]">
            <Panel title="Compose message">
              <div className="mb-3 flex flex-wrap gap-1.5">
                {channels.map(channel => (
                  <Link
                    key={channel} href={`${MESSAGING_MODULE_META[channel].href}/compose`}
                    className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 px-2 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                  >
                    {CHANNEL_LABELS[channel]}
                  </Link>
                ))}
              </div>
              <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-200 px-3 py-8 text-center">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-600"><Mail size={16} /></span>
                <p className="text-[12px] text-slate-500">Pick a channel above to open the composer with a real draft, audience picker and send pipeline.</p>
              </div>
            </Panel>

            <Panel title="Audience" viewAllHref="/app/messaging/channels" viewAllLabel="Manage">
              {topAudience ? (
                <div className="space-y-2 text-[12px]">
                  <p className="font-medium text-slate-900">{topAudience.name}</p>
                  <p className="text-slate-500">{formatCompactNumber(topAudience.contact_count)} contacts</p>
                  {topAudience.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {topAudience.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-400"><MessageSquare size={16} /></span>
                  <p className="text-[12px] text-slate-400">No audiences yet. Create one from any compose screen.</p>
                </div>
              )}
            </Panel>

            <Panel title="Journey" viewAllHref="/app/messaging/journeys" viewAllLabel="View all">
              {latestJourney ? (
                <div className="space-y-2 text-[12px]">
                  <div className="flex items-center justify-between">
                    <Link href={`/app/messaging/journeys/${latestJourney.id}`} className="font-medium text-slate-900 hover:text-blue-600">{latestJourney.name}</Link>
                    <Badge variant={latestJourney.status === 'active' ? 'green' : 'slate'}>
                      {JOURNEY_STATUS_LABELS[latestJourney.status as keyof typeof JOURNEY_STATUS_LABELS] ?? latestJourney.status}
                    </Badge>
                  </div>
                  <p className="text-slate-500">{formatCompactNumber(latestJourney.contacts_in_flow)} contacts in flow</p>
                  <p className="text-slate-500">{latestJourney.canvas.nodes.length} steps</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-400"><Send size={16} /></span>
                  <p className="text-[12px] text-slate-400">No journeys yet.</p>
                  <NewJourneyButton />
                </div>
              )}
            </Panel>
          </div>

          <CampaignFilters
            filters={[
              { key: 'channel', label: 'Channel', options: MESSAGING_CHANNELS.filter(c => channels.includes(c)).map(c => ({ value: c, label: CHANNEL_LABELS[c] })) },
              { key: 'owner', label: 'Owner', options: members.map(m => ({ value: m.id, label: m.full_name ?? m.email ?? 'Member' })) },
              { key: 'status', label: 'Status', options: [
                { value: 'draft', label: 'Draft' }, { value: 'pending_approval', label: 'Pending approval' },
                { value: 'scheduled', label: 'Scheduled' }, { value: 'sending', label: 'Sending' },
                { value: 'sent', label: 'Sent' }, { value: 'paused', label: 'Paused' },
              ], advanced: true },
            ]}
          />

          {programs.error && <LoadError message={programs.error} />}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Panel title="Performance trend" bodyClassName="px-3 pb-3">
              <ChartLegend series={TREND_SERIES} className="mb-1" />
              <TrendChart data={trendData} series={TREND_SERIES} height={150} />
            </Panel>

            <Panel title="Channel mix" bodyClassName="px-3 pb-3">
              <div className="flex flex-col items-center gap-2">
                <DonutChart slices={channelSlices} total={totalChannelSent} totalLabel="Total" size={120} emptyMessage="No sends yet." />
                <DonutLegend slices={channelSlices} total={totalChannelSent} className="w-full" />
              </div>
            </Panel>

            <Panel title="Journey status" bodyClassName="px-3 pb-3">
              <div className="flex flex-col items-center gap-2">
                <DonutChart slices={journeySlices} total={totalJourneys} totalLabel="Total" size={120} emptyMessage="No journeys yet." />
                <DonutLegend slices={journeySlices} total={totalJourneys} className="w-full" />
              </div>
            </Panel>

            <Panel title="Top message types" bodyClassName="px-3 pb-3">
              {messageTypes.length === 0 ? (
                <p className="py-6 text-center text-[12px] text-slate-400">No messages yet.</p>
              ) : (
                <ul className="space-y-2.5">
                  {messageTypes.slice(0, 4).map(item => (
                    <li key={item.type}>
                      <div className="mb-1 flex items-center justify-between text-[11px]">
                        <span className="text-slate-600">{TYPE_LABELS[item.type] ?? item.type}</span>
                        <span className="font-medium text-slate-900">{item.percent}%</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-blue-500" style={{ width: `${item.percent}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          <Panel
            title="Messaging programs" info="Delivery and engagement for programs matching your filters"
            bodyClassName="px-0 pb-0"
          >
            <MessagingProgramsTable
              rows={programs.rows} bare canEdit={capabilities.edit} canApprove={capabilities.approve}
              emptyMessage="Create your first message to start tracking delivery, engagement and conversions here."
            />
          </Panel>
        </div>

        <div className={RIGHT_RAIL}>
          <Panel title="Next actions" viewAllHref="/app/messaging/email" viewAllLabel="View all tasks">
            {nextActions.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-slate-400">Nothing needs your attention right now.</p>
            ) : (
              <ul className="space-y-1">
                {nextActions.map(action => (
                  <li key={action.id}>
                    <Link href={action.href} className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-slate-50">
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold ${action.tone}`}>
                        {action.count}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12px] font-medium text-slate-900">{action.label}</span>
                        <span className="block truncate text-[11px] text-slate-400">{action.sub}</span>
                      </span>
                      <ChevronRight size={13} className="shrink-0 text-slate-300" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Recent activity" viewAllHref="/app/messaging/email">
            <ActivityFeed items={activity} />
          </Panel>

          <Panel title="Delivery alerts" viewAllHref="/app/messaging/email" viewAllLabel="View all">
            {alerts.length === 0 ? (
              <p className="py-4 text-center text-[12px] text-slate-400">No alerts right now.</p>
            ) : (
              <ul className="space-y-2">
                {alerts.map(alert => (
                  <li key={alert.id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-medium text-slate-900">{alert.label}</p>
                      <p className="truncate text-[11px] text-slate-400">{alert.sub}</p>
                    </div>
                    <span className={`shrink-0 text-[12px] font-semibold ${alert.severity === 'red' ? 'text-red-500' : 'text-amber-500'}`}>{alert.value}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Channel health" viewAllHref="/app/messaging/channels" viewAllLabel="Manage">
            <ul className="space-y-2">
              {health.map(row => (
                <li key={row.channel} className="flex items-center justify-between">
                  <span className="text-[12px] font-medium text-slate-700">{CHANNEL_LABELS[row.channel]}</span>
                  <Badge variant={CHANNEL_CONFIG_BADGE[row.status as keyof typeof CHANNEL_CONFIG_BADGE] ?? 'slate'}>
                    {CHANNEL_CONFIG_LABELS[row.status as keyof typeof CHANNEL_CONFIG_LABELS] ?? row.status}
                  </Badge>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  )
}
