import Link from 'next/link'
import { requireCampaignModule } from '@/lib/campaigns/server'
import {
  campaignAggregates, contentCounts, listCampaigns, onTrackRate,
  recentActivity, workspaceMembers,
} from '@/lib/campaigns/data'
import { parseCampaignQuery, hasAnyFilter, type RawParams } from '@/lib/campaigns/query'
import {
  APPROVAL_LABELS, APPROVAL_STATUSES, CAMPAIGN_CHANNELS, CAMPAIGN_MODULE_META,
  CAMPAIGN_SORTS, CHANNEL_LABELS, LIFECYCLE_LABELS, PRIORITIES, PRIORITY_LABELS,
  type ApprovalStatus, type LifecycleStage,
} from '@/lib/campaigns/constants'
import { CAMPAIGN_TYPES, CAMPAIGN_TYPE_LABELS } from '@/lib/constants'
import CampaignsHeader from '@/components/campaigns/CampaignsHeader'
import CampaignFilters from '@/components/campaigns/CampaignFilters'
import KpiStrip from '@/components/campaigns/KpiStrip'
import CampaignCard from '@/components/campaigns/CampaignCard'
import CampaignTable from '@/components/campaigns/CampaignTable'
import ActivityFeed from '@/components/campaigns/ActivityFeed'
import Pagination from '@/components/campaigns/Pagination'
import SortSelect from '@/components/campaigns/SortSelect'
import NewCampaignButton from '@/components/campaigns/NewCampaignButton'
import ImportButton from '@/components/campaigns/ImportButton'
import ExportButton, { HeaderOverflow } from '@/components/campaigns/ExportButton'
import { AccessBlocked, CampaignsEmpty, LoadError } from '@/components/campaigns/states'
import { Panel, CAMPAIGN_PAGE, formatCompactMoney, formatNumber } from '@/components/campaigns/primitives'
import type { KpiValue } from '@/lib/campaigns/types'

export const metadata = {
  title: 'All Campaigns · Caption Fox',
  description: CAMPAIGN_MODULE_META.all.description,
}

export default async function AllCampaignsPage({
  searchParams,
}: { searchParams: Promise<RawParams> }) {
  const params = await searchParams
  const { supabase, base, ctx, userId, capabilities, modules, access } = await requireCampaignModule('all')

  if (!access.allowed) {
    return (
      <div className={CAMPAIGN_PAGE}>
        <CampaignsHeader module="all" modules={modules} base={base} />
        <AccessBlocked access={access} />
      </div>
    )
  }

  const query = parseCampaignQuery(params, { views: ['cards', 'table'], defaultView: 'cards' })

  const [aggregates, page, members, activity, mine, dueThisWeek] = await Promise.all([
    campaignAggregates(supabase, ctx.workspaceId),
    listCampaigns(supabase, ctx.workspaceId, query, { paginate: true }),
    workspaceMembers(supabase, ctx.workspaceId),
    recentActivity(supabase, ctx.workspaceId, { limit: 6 }),
    supabase.from('campaigns').select('id', { count: 'exact', head: true })
      .eq('workspace_id', ctx.workspaceId).eq('owner_id', userId).is('archived_at', null),
    supabase.from('campaigns').select('id', { count: 'exact', head: true })
      .eq('workspace_id', ctx.workspaceId).is('archived_at', null)
      .gte('end_date', new Date().toISOString().slice(0, 10))
      .lte('end_date', new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10)),
  ])

  const counts = await contentCounts(supabase, ctx.workspaceId, page.rows.map(row => row.id))

  const kpis: KpiValue[] = [
    { id: 'total', label: 'Total campaigns', value: formatNumber(aggregates.total), hint: 'Excluding archived', icon: 'campaigns', tone: 'blue' },
    { id: 'month', label: 'Active this month', value: formatNumber(aggregates.activeThisMonth), hint: 'Running in the current month', icon: 'check', tone: 'green' },
    { id: 'ontrack', label: 'On track', value: formatNumber(aggregates.byHealth.on_track ?? 0), hint: `${onTrackRate(aggregates)}% of all campaigns`, icon: 'check', tone: 'blue' },
    { id: 'overdue', label: 'Overdue', value: formatNumber(aggregates.overdue), hint: 'Past their end date', icon: 'clock', tone: 'amber' },
    { id: 'budget', label: 'Budget at risk', value: formatNumber(aggregates.budgetAtRisk), hint: `${formatCompactMoney(aggregates.totalSpend)} spent to date`, icon: 'alert', tone: 'red' },
    { id: 'approvals', label: 'Pending approvals', value: formatNumber(aggregates.pendingApprovals), hint: 'Awaiting a decision', icon: 'file', tone: 'violet' },
  ]

  const filtered = hasAnyFilter(query)
  const start = page.total === 0 ? 0 : (query.page - 1) * query.size + 1
  const end = Math.min(query.page * query.size, page.total)

  const workload = [
    { id: 'mine', label: 'My campaigns', value: mine.count ?? 0, href: `${base}/all?owner=${userId}` },
    { id: 'due', label: 'Due this week', value: dueThisWeek.count ?? 0, href: `${base}/all?sort=due_soonest` },
    { id: 'review', label: 'Awaiting review', value: aggregates.pendingApprovals, href: `${base}/all?approval=pending` },
    { id: 'risk', label: 'At risk / overdue', value: (aggregates.byHealth.at_risk ?? 0) + aggregates.overdue, href: `${base}/all?health=at_risk` },
  ]

  return (
    <div className={CAMPAIGN_PAGE}>
      <CampaignsHeader
        module="all" modules={modules} base={base}
        actions={
          <>
            {capabilities.create && <NewCampaignButton members={members} />}
            {capabilities.import && <ImportButton entity="campaigns" />}
            <ExportButton entity="campaigns" allowed={capabilities.export} />
            <HeaderOverflow items={[
              { label: 'Refresh data' },
              { label: 'Campaigns overview', href: `${base}` },
              { label: 'Campaign board', href: `${base}/board` },
              { label: 'Campaign timeline', href: `${base}/timeline` },
            ]} />
          </>
        }
      />

      <KpiStrip items={kpis} className="mb-3 lg:mb-[18px]" />

      <CampaignFilters
        className="mb-3 lg:mb-[15px]"
        searchPlaceholder="Search campaigns by name, owner, ID, or tags…"
        views={['cards', 'table']}
        filters={[
          { key: 'type', label: 'Campaign type', options: CAMPAIGN_TYPES.map(t => ({ value: t, label: CAMPAIGN_TYPE_LABELS[t] })) },
          { key: 'owner', label: 'Owner', options: members.map(m => ({ value: m.id, label: m.full_name ?? m.email ?? 'Member' })) },
          { key: 'channel', label: 'Channel', options: CAMPAIGN_CHANNELS.map(c => ({ value: c, label: CHANNEL_LABELS[c] })) },
          { key: 'stage', label: 'Status', options: (Object.keys(LIFECYCLE_LABELS) as LifecycleStage[]).map(s => ({ value: s, label: LIFECYCLE_LABELS[s] })) },
          { key: 'priority', label: 'Priority', options: PRIORITIES.map(p => ({ value: p, label: PRIORITY_LABELS[p] })) },
          { key: 'health', label: 'Health', advanced: true, options: [
            { value: 'on_track', label: 'On track' }, { value: 'at_risk', label: 'At risk' },
            { value: 'overdue', label: 'Overdue' }, { value: 'blocked', label: 'Blocked' },
          ] },
          { key: 'approval', label: 'Approval state', advanced: true, options: (APPROVAL_STATUSES as readonly ApprovalStatus[]).map(a => ({ value: a, label: APPROVAL_LABELS[a] })) },
        ]}
      />

      {page.error && <LoadError message={page.error} className="mb-3" />}

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <p className="text-[13px] text-slate-500" aria-live="polite">
          {page.total === 0
            ? 'No campaigns to show'
            : `Showing ${start}–${end} of ${formatNumber(page.total)} campaign${page.total === 1 ? '' : 's'}`}
        </p>
        <SortSelect className="ml-auto" options={CAMPAIGN_SORTS} />
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,8.69fr)_minmax(0,3.34fr)]">
        <div className="min-w-0">
          {page.rows.length === 0 ? (
            <CampaignsEmpty
              icon={filtered ? 'search' : 'campaign'}
              title={filtered ? 'No campaigns match your filters' : 'No campaigns yet'}
              message={filtered
                ? 'Try widening the date range, clearing a filter, or searching for a different term.'
                : 'Create your first campaign to plan work, track budget and measure results in one place.'}
              action={!filtered && capabilities.create ? <NewCampaignButton members={members} /> : (
                filtered ? <Link href={`${base}/all`} className="text-[13px] font-medium text-blue-600 hover:text-blue-700">Clear all filters</Link> : undefined
              )}
            />
          ) : query.view === 'table' ? (
            <CampaignTable
              campaigns={page.rows} capabilities={capabilities} members={members} selectable
              columns={['campaign', 'type', 'owner', 'stage', 'status', 'priority', 'progress', 'budget', 'spend', 'engagements', 'due', 'health']}
            />
          ) : (
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {page.rows.map((campaign, index) => (
                <CampaignCard
                  key={campaign.id} campaign={campaign} capabilities={capabilities}
                  featured={query.page === 1 && index === 0}
                  contentCount={counts[campaign.id] ?? 0}
                />
              ))}
            </div>
          )}

          {page.total > query.size && (
            <div className="mt-3">
              <Pagination page={query.page} size={query.size} total={page.total} />
            </div>
          )}
        </div>

        <div className="min-w-0 space-y-3">
          <Panel title="Recent campaign activity" viewAllHref={`${base}`}>
            <ActivityFeed items={activity} />
          </Panel>

          <Panel title="Workload overview" viewAllHref={`${base}/all?owner=${userId}`}>
            <ul className="grid grid-cols-2 gap-2">
              {workload.map(item => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="block rounded-lg border border-slate-200 px-2.5 py-2 transition-colors hover:border-blue-200 hover:bg-blue-50/40"
                  >
                    <span className="block truncate text-[11px] text-slate-500">{item.label}</span>
                    <span className="mt-0.5 block text-lg font-bold leading-none text-slate-900">{item.value}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>

      <Panel
        className="mt-3" title="Campaigns summary"
        info="The same records as above, with budget, spend and engagement columns"
        viewAllHref={`${base}/all?view=table`} viewAllLabel="View full table"
        bodyClassName="px-0 pb-0"
      >
        <CampaignTable
          campaigns={page.rows.slice(0, 6)} capabilities={capabilities} compact bare
          columns={['campaign', 'type', 'owner', 'status', 'priority', 'progress', 'budget', 'spend', 'engagements', 'due', 'health']}
          emptyMessage="No campaigns match the current filters."
        />
      </Panel>
    </div>
  )
}
