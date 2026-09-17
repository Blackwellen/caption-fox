import Link from 'next/link'
import { requireCampaignModule } from '@/lib/campaigns/server'
import {
  listTemplates, recentActivity, templateAggregates, templateUsageTrend,
  workspaceMembers, type TemplateFilters,
} from '@/lib/campaigns/data'
import type { RawParams } from '@/lib/campaigns/query'
import {
  CAMPAIGN_CHANNELS, CAMPAIGN_MODULE_META, CHANNEL_LABELS, TEMPLATE_STATUSES,
  TEMPLATE_STATUS_BADGE, TEMPLATE_STATUS_LABELS, TEMPLATE_TYPES, TEMPLATE_TYPE_LABELS,
  type TemplateStatus,
} from '@/lib/campaigns/constants'
import { CAMPAIGN_TYPES, CAMPAIGN_TYPE_LABELS } from '@/lib/constants'
import CampaignsHeader from '@/components/campaigns/CampaignsHeader'
import CampaignFilters from '@/components/campaigns/CampaignFilters'
import KpiStrip from '@/components/campaigns/KpiStrip'
import TemplateCard from '@/components/campaigns/TemplateCard'
import TemplateActions from '@/components/campaigns/TemplateActions'
import ActivityFeed from '@/components/campaigns/ActivityFeed'
import Pagination from '@/components/campaigns/Pagination'
import NewTemplateButton from '@/components/campaigns/NewTemplateButton'
import ImportButton from '@/components/campaigns/ImportButton'
import ExportButton, { HeaderOverflow } from '@/components/campaigns/ExportButton'
import { AccessBlocked, CampaignsEmpty, LoadError } from '@/components/campaigns/states'
import {
  Avatar, CARD, CARD_SHADOW, Panel, CAMPAIGN_PAGE, formatNumber, formatShortDate,
} from '@/components/campaigns/primitives'
import { Badge } from '@/components/ui/Badge'
import { ChartLegend, TrendChart, type TrendSeries } from '@/components/campaigns/charts'
import type { KpiValue, PersonLite, TemplateRow } from '@/lib/campaigns/types'
import type { CampaignCapabilities } from '@/lib/campaigns/entitlements'
import { cn } from '@/lib/utils'

export const metadata = {
  title: 'Campaign Templates · Caption Fox',
  description: CAMPAIGN_MODULE_META.templates.description,
}

const USAGE_SERIES: TrendSeries[] = [
  { key: 'uses', label: 'Uses', colour: '#2563eb' },
  { key: 'templates', label: 'Unique templates used', colour: '#8b5cf6' },
]

function one(params: RawParams, key: string): string {
  const value = params[key]
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? ''
}

export default async function CampaignTemplatesPage({
  searchParams,
}: { searchParams: Promise<RawParams> }) {
  const params = await searchParams
  const { supabase, base, ctx, capabilities, modules, access } = await requireCampaignModule('templates')

  if (!access.allowed) {
    return (
      <div className={CAMPAIGN_PAGE}>
        <CampaignsHeader module="templates" modules={modules} base={base} />
        <AccessBlocked access={access} />
      </div>
    )
  }

  const page = Math.max(1, Number.parseInt(one(params, 'page'), 10) || 1)
  const size = [12, 24, 48, 96].includes(Number(one(params, 'size'))) ? Number(one(params, 'size')) : 12
  const view = one(params, 'view') === 'table' ? 'table' : 'cards'

  const filters: TemplateFilters = {
    q: one(params, 'q'), category: one(params, 'category'), owner: one(params, 'owner'),
    templateType: one(params, 'templateType'), status: one(params, 'status'),
    channel: one(params, 'channel'), archived: one(params, 'archived') === '1',
    sort: one(params, 'sort') || 'updated', page, size,
  }

  const to = one(params, 'to') || new Date().toISOString().slice(0, 10)
  const from = one(params, 'from') || new Date(Date.parse(to) - 29 * 86_400_000).toISOString().slice(0, 10)

  const [aggregates, list, members, activity, usage, approvalQueue] = await Promise.all([
    templateAggregates(supabase, ctx.workspaceId),
    listTemplates(supabase, ctx.workspaceId, filters),
    workspaceMembers(supabase, ctx.workspaceId),
    recentActivity(supabase, ctx.workspaceId, { limit: 5, surface: 'templates' }),
    templateUsageTrend(supabase, ctx.workspaceId, from, to),
    listTemplates(supabase, ctx.workspaceId, {
      ...filters, status: 'in_review', q: '', category: '', owner: '',
      templateType: '', channel: '', page: 1, size: 5,
    }),
  ])

  const mostReused = [...list.rows].sort((a, b) => b.usage_count - a.usage_count).slice(0, 5)

  const kpis: KpiValue[] = [
    { id: 'total', label: 'Total templates', value: formatNumber(aggregates.total), hint: 'Excluding archived', icon: 'layers', tone: 'violet' },
    { id: 'most', label: 'Most used template', value: aggregates.mostUsed?.name ?? '—', hint: aggregates.mostUsed ? `Used ${aggregates.mostUsed.usage_count} times` : 'No usage yet', icon: 'star', tone: 'amber' },
    { id: 'published', label: 'Published templates', value: formatNumber(aggregates.published), hint: aggregates.total ? `${Math.round((aggregates.published / aggregates.total) * 100)}% of total` : '0% of total', icon: 'check', tone: 'green' },
    { id: 'draft', label: 'Draft templates', value: formatNumber(aggregates.draft), hint: aggregates.total ? `${Math.round((aggregates.draft / aggregates.total) * 100)}% of total` : '0% of total', icon: 'file', tone: 'blue' },
    { id: 'reuse', label: 'Avg reuse rate', value: `${aggregates.avgReuse}x`, hint: `${aggregates.totalUses} campaigns created`, icon: 'trend', tone: 'green' },
    { id: 'recent', label: 'Recently updated', value: formatNumber(aggregates.recentlyUpdated), hint: 'In the last 7 days', icon: 'clock', tone: 'amber' },
  ]

  const filtered = Boolean(filters.q || filters.category || filters.owner || filters.templateType || filters.status || filters.channel || filters.archived)

  return (
    <div className={CAMPAIGN_PAGE}>
      <CampaignsHeader
        module="templates" modules={modules} base={base}
        actions={
          <>
            {capabilities.manageTemplates && <NewTemplateButton members={members} />}
            {capabilities.manageTemplates && <ImportButton entity="templates" />}
            <ExportButton entity="templates" allowed={capabilities.export} />
            <HeaderOverflow items={[
              { label: 'Refresh data' },
              { label: 'All campaigns', href: `${base}/all` },
              { label: 'Campaigns overview', href: `${base}` },
            ]} />
          </>
        }
      />

      <KpiStrip items={kpis} className="mb-3 lg:mb-[18px]" />

      <CampaignFilters
        className="mb-3 lg:mb-[15px]"
        searchPlaceholder="Search templates…"
        views={['cards', 'table']}
        showDateRange={false}
        filters={[
          { key: 'category', label: 'All categories', options: CAMPAIGN_TYPES.map(t => ({ value: t, label: CAMPAIGN_TYPE_LABELS[t] })) },
          { key: 'owner', label: 'All owners', options: members.map(m => ({ value: m.id, label: m.full_name ?? m.email ?? 'Member' })) },
          { key: 'templateType', label: 'Template type', options: TEMPLATE_TYPES.map(t => ({ value: t, label: TEMPLATE_TYPE_LABELS[t] })) },
          { key: 'status', label: 'Status', options: TEMPLATE_STATUSES.map(s => ({ value: s, label: TEMPLATE_STATUS_LABELS[s] })) },
          { key: 'channel', label: 'Channel', advanced: true, options: CAMPAIGN_CHANNELS.map(c => ({ value: c, label: CHANNEL_LABELS[c] })) },
        ]}
      />

      {list.error && <LoadError message={list.error} className="mb-3" />}

      {list.rows.length === 0 ? (
        <CampaignsEmpty
          className="mb-3"
          icon={filtered ? 'search' : 'campaign'}
          title={filtered ? 'No templates match your filters' : 'No campaign templates yet'}
          message={filtered
            ? 'Try a different category, owner or status, or clear the filters to see everything.'
            : 'Create a template once and reuse its structure, channels and budget for every similar campaign.'}
          action={!filtered && capabilities.manageTemplates
            ? <NewTemplateButton members={members} />
            : filtered ? <Link href={`${base}/templates`} className="text-[13px] font-medium text-blue-600 hover:text-blue-700">Clear all filters</Link> : undefined}
        />
      ) : view === 'table' ? (
        <div className={cn(CARD, CARD_SHADOW, 'mb-3 overflow-x-auto')}>
          <TemplateTable rows={list.rows} capabilities={capabilities} members={members} />
        </div>
      ) : (
        <div className="mb-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          {list.rows.map(template => (
            <TemplateCard
              key={template.id} template={template} capabilities={capabilities} members={members}
              featured={aggregates.mostUsed?.id === template.id}
            />
          ))}
        </div>
      )}

      {list.total > size && (
        <div className="mb-3">
          <Pagination page={page} size={size} total={list.total} />
        </div>
      )}

      <div className="mb-3 grid gap-3 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_minmax(0,1.2fr)]">
        <Panel title="Template usage trend" info="Campaigns created from a template each day">
          <ChartLegend series={USAGE_SERIES} className="mb-1" />
          <TrendChart
            data={usage.map(point => ({ date: point.date, uses: point.uses, templates: point.templates }))}
            series={USAGE_SERIES}
            emptyMessage="No campaigns have been created from a template in this period."
          />
        </Panel>

        <Panel title="Most reused templates" viewAllHref={`${base}/templates?sort=used_desc`}>
          {mostReused.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-slate-400">No template usage yet.</p>
          ) : (
            <ol className="space-y-1.5">
              {mostReused.map((template, index) => (
                <li key={template.id} className="flex items-center gap-2">
                  <span className="w-3 shrink-0 text-[11px] font-semibold text-slate-400">{index + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-medium text-slate-900">{template.name}</span>
                    <span className="block truncate text-[11px] capitalize text-slate-400">{template.category.replace(/_/g, ' ')}</span>
                  </span>
                  <span className="shrink-0 text-[11px] font-medium text-slate-600">
                    {template.usage_count} use{template.usage_count === 1 ? '' : 's'}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Panel>

        <Panel title="Approval queue" viewAllHref={`${base}/templates?status=in_review`}>
          {approvalQueue.rows.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-slate-400">Nothing is waiting for review.</p>
          ) : (
            <ul className="space-y-1.5">
              {approvalQueue.rows.map(template => (
                <li key={template.id} className="flex items-center gap-2">
                  <Avatar person={template.owner} size={24} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-medium text-slate-900">{template.name}</span>
                    <span className="block truncate text-[11px] text-slate-400">
                      Requested by {template.owner?.full_name ?? template.owner?.email ?? 'a team member'}
                    </span>
                  </span>
                  <TemplateActions template={template} capabilities={capabilities} members={members} />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Recent template activity" viewAllHref={`${base}`}>
          <ActivityFeed items={activity} emptyMessage="No template activity yet." />
        </Panel>
      </div>

      <Panel
        title="All templates" info="Every template matching your filters, with usage and approval status"
        bodyClassName="px-0 pb-0"
      >
        <TemplateTable rows={list.rows.slice(0, 6)} capabilities={capabilities} members={members} />
      </Panel>
    </div>
  )
}

function TemplateTable({
  rows, capabilities, members,
}: { rows: TemplateRow[]; capabilities: CampaignCapabilities; members: PersonLite[] }) {
  if (rows.length === 0) {
    return <p className="px-4 py-10 text-center text-sm text-slate-500">No templates match the current filters.</p>
  }

  return (
    <table className="w-full min-w-[900px] border-collapse text-left">
      <caption className="sr-only">Campaign templates for the current workspace and filters</caption>
      <thead>
        <tr className="border-b border-slate-200 bg-slate-50/60 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          <th scope="col" className="px-3 py-2">Template name</th>
          <th scope="col" className="px-3 py-2">Category</th>
          <th scope="col" className="px-3 py-2">Type</th>
          <th scope="col" className="px-3 py-2">Owner</th>
          <th scope="col" className="px-3 py-2">Status</th>
          <th scope="col" className="px-3 py-2 text-right">Used</th>
          <th scope="col" className="px-3 py-2 text-right">Linked workflows</th>
          <th scope="col" className="px-3 py-2">Last updated</th>
          <th scope="col" className="w-24 px-3 py-2"><span className="sr-only">Actions</span></th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map(row => (
          <tr key={row.id} className="text-[13px] text-slate-600 transition-colors hover:bg-slate-50/70">
            <td className="px-3 py-2.5 font-medium text-slate-900">{row.name}</td>
            <td className="px-3 py-2.5">
              <Badge variant="blue" className="capitalize">{row.category.replace(/_/g, ' ')}</Badge>
            </td>
            <td className="px-3 py-2.5">{TEMPLATE_TYPE_LABELS[row.template_type] ?? row.template_type}</td>
            <td className="px-3 py-2.5">
              <span className="flex items-center gap-1.5">
                <Avatar person={row.owner} size={18} />
                <span className="truncate">{row.owner?.full_name ?? row.owner?.email ?? 'Unassigned'}</span>
              </span>
            </td>
            <td className="px-3 py-2.5">
              <Badge variant={TEMPLATE_STATUS_BADGE[row.status as TemplateStatus] ?? 'slate'}>
                {TEMPLATE_STATUS_LABELS[row.status as TemplateStatus] ?? row.status}
              </Badge>
            </td>
            <td className="px-3 py-2.5 text-right tabular-nums">{row.usage_count} times</td>
            <td className="px-3 py-2.5 text-right tabular-nums">{row.linked_workflows}</td>
            <td className="whitespace-nowrap px-3 py-2.5">{formatShortDate(row.updated_at)}</td>
            <td className="px-3 py-2.5">
              <TemplateActions template={row} capabilities={capabilities} members={members} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
