import Link from 'next/link'
import { requireCampaignModule } from '@/lib/campaigns/server'
import {
  competitionAggregates, listCompetitions, recentActivity,
  submissionsTrend, workspaceMembers, type SimpleFilters,
} from '@/lib/campaigns/data'
import type { RawParams } from '@/lib/campaigns/query'
import {
  CAMPAIGN_MODULE_META, JUDGING_STAGES, JUDGING_STAGE_LABELS,
  SUBMISSION_STATUSES, SUBMISSION_STATUS_LABELS,
} from '@/lib/campaigns/constants'
import { COMPETITION_TYPES, COMPETITION_TYPE_LABELS } from '@/lib/constants'
import CampaignsHeader from '@/components/campaigns/CampaignsHeader'
import CampaignFilters from '@/components/campaigns/CampaignFilters'
import KpiStrip from '@/components/campaigns/KpiStrip'
import CompetitionCard from '@/components/campaigns/CompetitionCard'
import JudgingStageSelect from '@/components/campaigns/JudgingStageSelect'
import ActivityFeed from '@/components/campaigns/ActivityFeed'
import Pagination from '@/components/campaigns/Pagination'
import NewCompetitionWizard from '@/components/campaigns/NewCompetitionWizard'
import ImportButton from '@/components/campaigns/ImportButton'
import ExportButton, { HeaderOverflow } from '@/components/campaigns/ExportButton'
import { AccessBlocked, CampaignsEmpty, LoadError } from '@/components/campaigns/states'
import {
  Avatar, CARD, CARD_SHADOW, Panel, ProgressBar, CAMPAIGN_PAGE,
  formatNumber, formatShortDate,
} from '@/components/campaigns/primitives'
import { Badge } from '@/components/ui/Badge'
import { DonutChart, DonutLegend, TrendChart, type DonutSlice, type TrendSeries } from '@/components/campaigns/charts'
import type { CompetitionRow, KpiValue } from '@/lib/campaigns/types'
import { cn } from '@/lib/utils'

export const metadata = {
  title: 'Competitions · Caption Fox',
  description: CAMPAIGN_MODULE_META.competitions.description,
}

const SUBMISSION_SERIES: TrendSeries[] = [
  { key: 'submissions', label: 'Submissions', colour: '#2563eb' },
  { key: 'participants', label: 'Unique participants', colour: '#8b5cf6' },
]

const JUDGING_COLOURS: Record<string, string> = {
  pending: '#fbbf24', in_progress: '#2563eb', review: '#f59e0b',
  shortlist: '#8b5cf6', final_review: '#38bdf8', completed: '#34d399',
  rejected: '#f87171', disqualified: '#cbd5e1',
}

function one(params: RawParams, key: string): string {
  const value = params[key]
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? ''
}

export default async function CompetitionsPage({
  searchParams,
}: { searchParams: Promise<RawParams> }) {
  const params = await searchParams
  const { supabase, base, ctx, capabilities, modules, access } = await requireCampaignModule('competitions')

  if (!access.allowed) {
    return (
      <div className={CAMPAIGN_PAGE}>
        <CampaignsHeader module="competitions" modules={modules} base={base} />
        <AccessBlocked access={access} />
      </div>
    )
  }

  const page = Math.max(1, Number.parseInt(one(params, 'page'), 10) || 1)
  const size = [12, 24, 48, 96].includes(Number(one(params, 'size'))) ? Number(one(params, 'size')) : 12
  const view = one(params, 'view') === 'table' ? 'table' : 'cards'

  const filters: SimpleFilters = {
    q: one(params, 'q'), status: one(params, 'status'), owner: one(params, 'owner'),
    // For competitions the "channel" slot carries the competition category.
    channel: one(params, 'channel'), from: one(params, 'from'), to: one(params, 'to'),
    extra: one(params, 'extra'), sort: one(params, 'sort') || 'due_soonest', page, size,
  }

  const to = filters.to || new Date().toISOString().slice(0, 10)
  const from = filters.from || new Date(Date.parse(to) - 29 * 86_400_000).toISOString().slice(0, 10)

  const [aggregates, list, members, activity, trend] = await Promise.all([
    competitionAggregates(supabase, ctx.workspaceId),
    listCompetitions(supabase, ctx.workspaceId, filters),
    workspaceMembers(supabase, ctx.workspaceId),
    recentActivity(supabase, ctx.workspaceId, { limit: 5, surface: 'competitions' }),
    submissionsTrend(supabase, ctx.workspaceId, from, to),
  ])

  const kpis: KpiValue[] = [
    { id: 'active', label: 'Active competitions', value: formatNumber(aggregates.active), hint: `${list.total} in this workspace`, icon: 'trophy', tone: 'blue' },
    { id: 'submissions', label: 'Total submissions', value: formatNumber(aggregates.totalSubmissions), hint: 'Across all competitions', icon: 'file', tone: 'violet' },
    { id: 'backlog', label: 'Judging backlog', value: formatNumber(aggregates.judgingBacklog), hint: 'Awaiting a judging decision', icon: 'clock', tone: 'amber' },
    { id: 'conversion', label: 'Conversion rate', value: `${aggregates.conversionRate.toFixed(1)}%`, hint: 'Submissions per vote', icon: 'pie', tone: 'violet' },
    { id: 'approval', label: 'Approval rate', value: `${aggregates.approvalRate}%`, hint: 'Of judged submissions', icon: 'check', tone: 'green' },
    { id: 'closing', label: 'Closing soon', value: formatNumber(aggregates.closingSoon), hint: 'Due within 7 days', icon: 'calendarClock', tone: 'red' },
  ]

  const judgingSlices: DonutSlice[] = SUBMISSION_STATUSES
    .map(status => ({
      key: status, label: SUBMISSION_STATUS_LABELS[status] ?? status,
      value: aggregates.judgingDistribution[status] ?? 0, colour: JUDGING_COLOURS[status] ?? '#cbd5e1',
    }))
    .filter(slice => slice.value > 0)

  const filtered = Boolean(filters.q || filters.status || filters.owner || filters.channel || filters.extra || filters.from || filters.to)
  const importTargets = list.rows.map(row => ({ id: row.id, name: row.title }))

  return (
    <div className={CAMPAIGN_PAGE}>
      <CampaignsHeader
        module="competitions" modules={modules} base={base}
        actions={
          <>
            {capabilities.manageCompetitions && <NewCompetitionWizard members={members} />}
            {capabilities.manageCompetitions && <ImportButton entity="competition-submissions" targets={importTargets} />}
            <ExportButton entity="competitions" allowed={capabilities.export} />
            <HeaderOverflow items={[
              { label: 'Refresh data' },
              { label: 'All campaigns', href: `${base}/all` },
              { label: 'Giveaways', href: `${base}/giveaways` },
            ]} />
          </>
        }
      />

      <KpiStrip items={kpis} className="mb-3 lg:mb-[18px]" />

      <CampaignFilters
        className="mb-3 lg:mb-[15px]"
        searchPlaceholder="Search competitions…"
        views={['cards', 'table']}
        filters={[
          { key: 'status', label: 'Status', options: [
            { value: 'draft', label: 'Draft' }, { value: 'open', label: 'Open' },
            { value: 'judging', label: 'Judging' }, { value: 'completed', label: 'Completed' },
            { value: 'cancelled', label: 'Cancelled' },
          ] },
          { key: 'owner', label: 'Owner', options: members.map(m => ({ value: m.id, label: m.full_name ?? m.email ?? 'Member' })) },
          { key: 'channel', label: 'Competition type', options: COMPETITION_TYPES.map(t => ({ value: t, label: COMPETITION_TYPE_LABELS[t] })) },
          { key: 'extra', label: 'Judging stage', options: JUDGING_STAGES.map(s => ({ value: s, label: JUDGING_STAGE_LABELS[s] })) },
        ]}
      />

      {list.error && <LoadError message={list.error} className="mb-3" />}

      {list.rows.length === 0 ? (
        <CampaignsEmpty
          className="mb-3"
          icon={filtered ? 'search' : 'campaign'}
          title={filtered ? 'No competitions match your filters' : 'No competitions yet'}
          message={filtered
            ? 'Try a different status, category or judging stage, or clear the filters to see everything.'
            : 'Launch a competition to collect submissions, run judging and pick winners with a full audit trail.'}
          action={!filtered && capabilities.manageCompetitions
            ? <NewCompetitionWizard members={members} />
            : filtered ? <Link href={`${base}/competitions`} className="text-[13px] font-medium text-blue-600 hover:text-blue-700">Clear all filters</Link> : undefined}
        />
      ) : view === 'table' ? (
        <div className={cn(CARD, CARD_SHADOW, 'mb-3 overflow-x-auto')}>
          <CompetitionTable rows={list.rows} canJudge={capabilities.judge} base={base} />
        </div>
      ) : (
        <div className="mb-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {list.rows.map((competition, index) => (
            <CompetitionCard
              key={competition.id} competition={competition}
              featured={page === 1 && index === 0}
            />
          ))}
        </div>
      )}

      {list.total > size && (
        <div className="mb-3">
          <Pagination page={page} size={size} total={list.total} />
        </div>
      )}

      <div className="mb-3 grid gap-3 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1.1fr)_minmax(0,1.2fr)_minmax(0,1.3fr)]">
        <Panel title="Submissions trend" info="Daily submissions and unique participants">
          <TrendChart
            data={trend.map(point => ({ date: point.date, submissions: point.submissions, participants: point.participants }))}
            series={SUBMISSION_SERIES}
            emptyMessage="No submissions recorded in this period yet."
          />
        </Panel>

        <Panel title="Judging status distribution" info="Every submission grouped by where judging has reached">
          <div className="flex items-center gap-3">
            <DonutChart
              slices={judgingSlices} total={aggregates.totalSubmissions} totalLabel="Total"
              emptyMessage="No submissions yet."
            />
            <DonutLegend slices={judgingSlices} total={aggregates.totalSubmissions} />
          </div>
        </Panel>

        <Panel title="Top performing competitions" viewAllHref={`${base}/competitions?sort=submissions_desc`} viewAllLabel="View all competitions">
          {aggregates.topPerformers.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-slate-400">No engagement data yet.</p>
          ) : (
            <ol className="space-y-1.5">
              {aggregates.topPerformers.map((entry, index) => (
                <li key={entry.id} className="flex items-center gap-2">
                  <span className="w-3 shrink-0 text-[11px] font-semibold text-slate-400">{index + 1}</span>
                  <Link
                    href={`${base}/competitions/${entry.id}`}
                    className="min-w-0 flex-1 truncate text-[12px] text-slate-700 hover:text-blue-600"
                  >
                    {entry.title}
                  </Link>
                  <span className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-slate-100">
                    <span
                      className="block h-full rounded-full bg-emerald-500"
                      style={{ width: `${Math.min(100, entry.rate * 5)}%` }}
                    />
                  </span>
                  <span className="w-10 shrink-0 text-right text-[11px] font-medium text-slate-900">
                    {entry.rate.toFixed(1)}%
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Panel>

        <Panel title="Recent activity" viewAllHref={`${base}`}>
          <ActivityFeed items={activity} emptyMessage="No competition activity yet." />
        </Panel>
      </div>

      <Panel
        title="Competition health" info="Submissions, judging backlog and engagement for the competitions matching your filters"
        bodyClassName="px-0 pb-0"
      >
        <CompetitionTable rows={list.rows.slice(0, 6)} canJudge={capabilities.judge} base={base} />
      </Panel>
    </div>
  )
}

function CompetitionTable({ rows, canJudge, base }: { rows: CompetitionRow[]; canJudge: boolean; base: string }) {
  if (rows.length === 0) {
    return <p className="px-4 py-10 text-center text-sm text-slate-500">No competitions match the current filters.</p>
  }

  return (
    <table className="w-full min-w-[900px] border-collapse text-left">
      <caption className="sr-only">Competition records for the current workspace and filters</caption>
      <thead>
        <tr className="border-b border-slate-200 bg-slate-50/60 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          <th scope="col" className="px-3 py-2">Competition</th>
          <th scope="col" className="px-3 py-2">Type</th>
          <th scope="col" className="px-3 py-2">Owner</th>
          <th scope="col" className="px-3 py-2">Judging stage</th>
          <th scope="col" className="px-3 py-2 text-right">Submissions</th>
          <th scope="col" className="px-3 py-2 text-right">Engagement</th>
          <th scope="col" className="px-3 py-2">Due date</th>
          <th scope="col" className="px-3 py-2">Status</th>
          <th scope="col" className="px-3 py-2">Progress</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map(row => (
          <tr key={row.id} className="text-[13px] text-slate-600 transition-colors hover:bg-slate-50/70">
            <td className="px-3 py-2.5">
              <Link href={`${base}/competitions/${row.id}`} className="font-medium text-slate-900 hover:text-blue-600">
                {row.title}
              </Link>
            </td>
            <td className="px-3 py-2.5">{COMPETITION_TYPE_LABELS[row.competition_type] ?? row.competition_type}</td>
            <td className="px-3 py-2.5">
              <span className="flex items-center gap-1.5">
                <Avatar person={row.owner} size={18} />
                <span className="truncate">{row.owner?.full_name ?? row.owner?.email ?? 'Unassigned'}</span>
              </span>
            </td>
            <td className="px-3 py-2.5">
              <JudgingStageSelect competitionId={row.id} stage={row.judging_stage} canJudge={canJudge} />
            </td>
            <td className="px-3 py-2.5 text-right tabular-nums">{formatNumber(row.submission_count)}</td>
            <td className="px-3 py-2.5 text-right tabular-nums">{Number(row.engagement_rate ?? 0).toFixed(1)}%</td>
            <td className="whitespace-nowrap px-3 py-2.5">{formatShortDate(row.end_date)}</td>
            <td className="px-3 py-2.5"><Badge status={row.status}>{row.status}</Badge></td>
            <td className="px-3 py-2.5">
              <span className="flex min-w-[110px] items-center gap-2">
                <ProgressBar value={row.progress} health={row.health} className="w-16" label={`${row.title} progress`} />
                <span className="w-8 shrink-0 text-xs font-medium text-slate-700">{row.progress}%</span>
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
