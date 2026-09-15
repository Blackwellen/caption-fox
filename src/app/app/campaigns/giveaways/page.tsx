import Link from 'next/link'
import { requireCampaignModule } from '@/lib/campaigns/server'
import {
  giveawayAggregates, giveawayEntriesTrend, listGiveaways,
  recentActivity, workspaceMembers, type SimpleFilters,
} from '@/lib/campaigns/data'
import type { RawParams } from '@/lib/campaigns/query'
import {
  CAMPAIGN_CHANNELS, CAMPAIGN_MODULE_META, CHANNEL_LABELS, HEALTH_BADGE, HEALTH_LABELS,
  PRIZE_FULFILMENT, PRIZE_FULFILMENT_BADGE, PRIZE_FULFILMENT_LABELS,
  type CampaignHealth,
} from '@/lib/campaigns/constants'
import CampaignsHeader from '@/components/campaigns/CampaignsHeader'
import CampaignFilters from '@/components/campaigns/CampaignFilters'
import KpiStrip from '@/components/campaigns/KpiStrip'
import GiveawayCard from '@/components/campaigns/GiveawayCard'
import ActivityFeed from '@/components/campaigns/ActivityFeed'
import Pagination from '@/components/campaigns/Pagination'
import NewGiveawayWizard from '@/components/campaigns/NewGiveawayWizard'
import WinnerReviewQueue, { type WinnerCandidate } from '@/components/campaigns/WinnerReviewQueue'
import ImportButton from '@/components/campaigns/ImportButton'
import ExportButton, { HeaderOverflow } from '@/components/campaigns/ExportButton'
import { AccessBlocked, CampaignsEmpty, LoadError } from '@/components/campaigns/states'
import {
  Avatar, CARD, CARD_SHADOW, Panel, ProgressBar, CAMPAIGN_PAGE,
  formatCompactMoney, formatNumber, formatShortDate,
} from '@/components/campaigns/primitives'
import { Badge } from '@/components/ui/Badge'
import { DonutChart, DonutLegend, TrendChart, type DonutSlice, type TrendSeries } from '@/components/campaigns/charts'
import type { KpiValue } from '@/lib/campaigns/types'
import { cn } from '@/lib/utils'

export const metadata = {
  title: 'Giveaways · Caption Fox',
  description: CAMPAIGN_MODULE_META.giveaways.description,
}

const ENTRY_SERIES: TrendSeries[] = [
  { key: 'entries', label: 'Entries', colour: '#2563eb' },
  { key: 'previous', label: 'Entries (previous period)', colour: '#93c5fd' },
]

const FULFILMENT_COLOURS: Record<string, string> = {
  fulfilled: '#2563eb', pending: '#8b5cf6', in_progress: '#93c5fd', cancelled: '#34d399',
}

function one(params: RawParams, key: string): string {
  const value = params[key]
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? ''
}

export default async function GiveawaysPage({
  searchParams,
}: { searchParams: Promise<RawParams> }) {
  const params = await searchParams
  const { supabase, ctx, capabilities, modules, access } = await requireCampaignModule('giveaways')

  if (!access.allowed) {
    return (
      <div className={CAMPAIGN_PAGE}>
        <CampaignsHeader module="giveaways" modules={modules} />
        <AccessBlocked access={access} />
      </div>
    )
  }

  const page = Math.max(1, Number.parseInt(one(params, 'page'), 10) || 1)
  const size = [12, 24, 48, 96].includes(Number(one(params, 'size'))) ? Number(one(params, 'size')) : 12
  const view = one(params, 'view') === 'table' ? 'table' : 'cards'

  const filters: SimpleFilters = {
    q: one(params, 'q'), status: one(params, 'status'), owner: one(params, 'owner'),
    channel: one(params, 'channel'), from: one(params, 'from'), to: one(params, 'to'),
    extra: one(params, 'extra'), sort: one(params, 'sort') || 'due_soonest', page, size,
  }

  const to = filters.to || new Date().toISOString().slice(0, 10)
  const from = filters.from || new Date(Date.parse(to) - 29 * 86_400_000).toISOString().slice(0, 10)

  const [aggregates, list, members, activity, trend, candidateRows] = await Promise.all([
    giveawayAggregates(supabase, ctx.workspaceId),
    listGiveaways(supabase, ctx.workspaceId, filters),
    workspaceMembers(supabase, ctx.workspaceId),
    recentActivity(supabase, ctx.workspaceId, { limit: 5, surface: 'giveaways' }),
    giveawayEntriesTrend(supabase, ctx.workspaceId, from, to),
    supabase.from('giveaway_entries')
      .select('id, giveaway_id, participant_handle, participant_email, winner_status, entered_at, giveaways(id, title)')
      .eq('workspace_id', ctx.workspaceId)
      .in('winner_status', ['candidate', 'approved', 'contacted', 'accepted'])
      .order('entered_at', { ascending: true })
      .limit(200),
  ])

  const candidates: WinnerCandidate[] = (candidateRows.data ?? []).map(row => {
    const g = (row as { giveaways?: { id: string; title: string } | { id: string; title: string }[] }).giveaways
    const giveaway = Array.isArray(g) ? g[0] : g
    return {
      id: row.id as string,
      giveawayId: giveaway?.id ?? (row.giveaway_id as string),
      giveawayTitle: giveaway?.title ?? 'Giveaway',
      handle: (row.participant_handle as string | null) ?? null,
      email: (row.participant_email as string | null) ?? null,
      status: row.winner_status as string,
      enteredAt: row.entered_at as string,
    }
  })

  const kpis: KpiValue[] = [
    { id: 'active', label: 'Active giveaways', value: formatNumber(aggregates.active), hint: `${list.total} in this workspace`, icon: 'gift', tone: 'blue' },
    { id: 'entries', label: 'Total entries', value: formatNumber(aggregates.totalEntries), hint: 'Across all giveaways', icon: 'users', tone: 'violet' },
    { id: 'conversion', label: 'Conversion rate', value: `${aggregates.conversionRate.toFixed(2)}%`, hint: 'Unique participants per entry', icon: 'trend', tone: 'green' },
    { id: 'fulfilment', label: 'Prize fulfilment', value: `${aggregates.fulfilmentRate}%`, hint: `${formatCompactMoney(aggregates.prizeValueFulfilled)} of ${formatCompactMoney(aggregates.prizeValueTotal)}`, icon: 'trophy', tone: 'amber' },
    { id: 'approval', label: 'Approval rate', value: `${aggregates.approvalRate}%`, hint: 'Reviewed winners approved', icon: 'check', tone: 'green' },
    { id: 'ending', label: 'Ending soon', value: formatNumber(aggregates.endingSoon), hint: 'Within 7 days', icon: 'clock', tone: 'red' },
  ]

  const fulfilmentSlices: DonutSlice[] = PRIZE_FULFILMENT.map(state => ({
    key: state, label: PRIZE_FULFILMENT_LABELS[state],
    value: aggregates.fulfilment[state] ?? 0, colour: FULFILMENT_COLOURS[state],
  })).filter(slice => slice.value > 0)

  const fulfilmentTotal = fulfilmentSlices.reduce((sum, slice) => sum + slice.value, 0)
  const filtered = Boolean(filters.q || filters.status || filters.owner || filters.channel || filters.extra || filters.from || filters.to)
  const importTargets = list.rows.map(row => ({ id: row.id, name: row.title }))

  return (
    <div className={CAMPAIGN_PAGE}>
      <CampaignsHeader
        module="giveaways" modules={modules}
        actions={
          <>
            {capabilities.manageGiveaways && <NewGiveawayWizard members={members} />}
            {capabilities.manageGiveaways && <ImportButton entity="giveaway-entries" targets={importTargets} />}
            <ExportButton entity="giveaways" allowed={capabilities.export} />
            <HeaderOverflow items={[
              { label: 'Refresh data' },
              { label: 'All campaigns', href: '/app/campaigns/all' },
              { label: 'Competitions', href: '/app/campaigns/competitions' },
            ]} />
          </>
        }
      />

      <KpiStrip items={kpis} className="mb-3" />

      <CampaignFilters
        className="mb-3"
        searchPlaceholder="Search giveaways…"
        views={['cards', 'table']}
        filters={[
          { key: 'status', label: 'Status', options: [
            { value: 'draft', label: 'Draft' }, { value: 'active', label: 'Active' },
            { value: 'ended', label: 'Ended' }, { value: 'cancelled', label: 'Cancelled' },
          ] },
          { key: 'owner', label: 'Owner', options: members.map(m => ({ value: m.id, label: m.full_name ?? m.email ?? 'Member' })) },
          { key: 'extra', label: 'Prize fulfilment', options: PRIZE_FULFILMENT.map(s => ({ value: s, label: PRIZE_FULFILMENT_LABELS[s] })) },
          { key: 'channel', label: 'Channel', options: CAMPAIGN_CHANNELS.map(c => ({ value: c, label: CHANNEL_LABELS[c] })) },
        ]}
      />

      {list.error && <LoadError message={list.error} className="mb-3" />}

      {list.rows.length === 0 ? (
        <CampaignsEmpty
          className="mb-3"
          icon={filtered ? 'search' : 'campaign'}
          title={filtered ? 'No giveaways match your filters' : 'No giveaways yet'}
          message={filtered
            ? 'Try a different status, owner or date range, or clear the filters to see everything.'
            : 'Run your first giveaway to grow reach, collect entries and manage prize fulfilment in one place.'}
          action={!filtered && capabilities.manageGiveaways
            ? <NewGiveawayWizard members={members} />
            : filtered ? <Link href="/app/campaigns/giveaways" className="text-[13px] font-medium text-blue-600 hover:text-blue-700">Clear all filters</Link> : undefined}
        />
      ) : view === 'table' ? (
        <div className={cn(CARD, CARD_SHADOW, 'mb-3 overflow-x-auto')}>
          <GiveawayTable rows={list.rows} />
        </div>
      ) : (
        <div className="mb-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {list.rows.map(giveaway => <GiveawayCard key={giveaway.id} giveaway={giveaway} />)}
        </div>
      )}

      {list.total > size && (
        <div className="mb-3">
          <Pagination page={page} size={size} total={list.total} />
        </div>
      )}

      <div className="mb-3 grid gap-3 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1.1fr)_minmax(0,1.2fr)_minmax(0,1.3fr)]">
        <Panel title="Entries trend" info="Daily entries compared with the previous period">
          <TrendChart
            data={trend.map(point => ({ date: point.date, entries: point.entries, previous: point.previous }))}
            series={ENTRY_SERIES}
            emptyMessage="No entries recorded in this period yet."
          />
        </Panel>

        <Panel title="Prize fulfilment status" info="Giveaways grouped by where their prize fulfilment has reached">
          <div className="flex items-center gap-3">
            <DonutChart
              slices={fulfilmentSlices} total={fulfilmentTotal}
              centreValue={`${aggregates.fulfilmentRate}%`} totalLabel="Fulfilled"
              emptyMessage="No giveaways yet."
            />
            <DonutLegend slices={fulfilmentSlices} total={fulfilmentTotal} />
          </div>
        </Panel>

        <Panel title="Winner review queue" viewAllHref="/app/campaigns/giveaways?extra=pending">
          <WinnerReviewQueue
            candidates={candidates.filter(candidate => candidate.status === 'candidate')}
            canReview={capabilities.reviewWinners}
          />
        </Panel>

        <Panel title="Recent giveaway activity" viewAllHref="/app/campaigns">
          <ActivityFeed items={activity} emptyMessage="No giveaway activity yet." />
        </Panel>
      </div>

      <Panel
        title="Giveaway health" info="Entries, conversion and fulfilment for the giveaways matching your filters"
        bodyClassName="px-0 pb-0"
      >
        <GiveawayTable rows={list.rows.slice(0, 6)} />
      </Panel>
    </div>
  )
}

function GiveawayTable({ rows }: { rows: Awaited<ReturnType<typeof listGiveaways>>['rows'] }) {
  if (rows.length === 0) {
    return <p className="px-4 py-10 text-center text-sm text-slate-500">No giveaways match the current filters.</p>
  }

  return (
    <table className="w-full min-w-[900px] border-collapse text-left">
      <caption className="sr-only">Giveaway records for the current workspace and filters</caption>
      <thead>
        <tr className="border-b border-slate-200 bg-slate-50/60 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          <th scope="col" className="px-3 py-2">Giveaway</th>
          <th scope="col" className="px-3 py-2">Prize</th>
          <th scope="col" className="px-3 py-2">Owner</th>
          <th scope="col" className="px-3 py-2">Status</th>
          <th scope="col" className="px-3 py-2">Fulfilment</th>
          <th scope="col" className="px-3 py-2">Progress</th>
          <th scope="col" className="px-3 py-2 text-right">Entries</th>
          <th scope="col" className="px-3 py-2 text-right">Conversion</th>
          <th scope="col" className="px-3 py-2">Due date</th>
          <th scope="col" className="px-3 py-2">Health</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map(row => (
          <tr key={row.id} className="text-[13px] text-slate-600 transition-colors hover:bg-slate-50/70">
            <td className="px-3 py-2.5">
              <Link href={`/app/campaigns/giveaways/${row.id}`} className="font-medium text-slate-900 hover:text-blue-600">
                {row.title}
              </Link>
            </td>
            <td className="max-w-48 truncate px-3 py-2.5">{row.prize_title}</td>
            <td className="px-3 py-2.5">
              <span className="flex items-center gap-1.5">
                <Avatar person={row.owner} size={18} />
                <span className="truncate">{row.owner?.full_name ?? row.owner?.email ?? 'Unassigned'}</span>
              </span>
            </td>
            <td className="px-3 py-2.5"><Badge status={row.status}>{row.status}</Badge></td>
            <td className="px-3 py-2.5">
              <Badge variant={PRIZE_FULFILMENT_BADGE[row.prize_fulfilment] ?? 'slate'}>
                {PRIZE_FULFILMENT_LABELS[row.prize_fulfilment] ?? row.prize_fulfilment}
              </Badge>
            </td>
            <td className="px-3 py-2.5">
              <span className="flex min-w-[110px] items-center gap-2">
                <span className="w-8 shrink-0 text-xs font-medium text-slate-700">{row.progress}%</span>
                <ProgressBar value={row.progress} health={row.health} className="w-16" label={`${row.title} progress`} />
              </span>
            </td>
            <td className="px-3 py-2.5 text-right tabular-nums">{formatNumber(row.total_entries)}</td>
            <td className="px-3 py-2.5 text-right tabular-nums">{(row.conversion_rate ?? 0).toFixed(2)}%</td>
            <td className="whitespace-nowrap px-3 py-2.5">{formatShortDate(row.end_date)}</td>
            <td className="px-3 py-2.5">
              <Badge variant={HEALTH_BADGE[row.health as CampaignHealth] ?? 'slate'}>
                {HEALTH_LABELS[row.health as CampaignHealth] ?? row.health}
              </Badge>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
