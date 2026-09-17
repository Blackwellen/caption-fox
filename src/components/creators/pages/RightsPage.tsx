import Link from 'next/link'
import { requireCreatorModule } from '@/lib/creators/server'
import {
  creatorPickerList, expiringLicences, listRights, recentRightsApprovals, rightsAggregates, rightsConflicts,
  rightsTrend, workspaceCampaigns,
} from '@/lib/creators/data'
import { parseRightsQuery } from '@/lib/creators/query'
import {
  CHANNEL_LABELS, CREATOR_CHANNELS, RIGHTS_CONFLICT_LABELS, RIGHTS_SORTS, RIGHTS_STATUS_LABELS, RIGHTS_STATUSES,
  RIGHTS_TERRITORIES, USAGE_SCOPE_LABELS, effectiveRightsStatus,
  type RightsConflictType, type RightsStatus, type UsageScope,
} from '@/lib/creators/constants'
import { daysLeft } from '@/lib/creators/rules'
import type { RightsRow } from '@/lib/creators/types'
import { cn } from '@/lib/utils'
import AddRightsButton, { SendUsageRequestButton } from '../AddRightsButton'
import RightsRowMenu from '../RightsRowMenu'
import { PlatformIcons } from '../PlatformIcon'
import {
  ExportMenu, Pager, PresetControl, ResetFilters, SelectControl, SettingsMenu, ViewToggle,
} from '../controls'
import {
  Avatar, CARD, Donut, Kpi, KpiGrid, Legend, LineChart, Panel, PanelEmpty, Person, Pill, TD, TH, Thumb,
  type Slice, type Tone,
} from '../design'
import { formatAgo } from '../primitives'
import { CreatorsFrame, kpiDelta, type RawSearchParams } from './shared'

const STATUS_TONE: Record<string, Tone> = {
  draft: 'slate', requested: 'blue', pending_approval: 'violet', active: 'green', expired: 'red',
  restricted: 'amber', revoked: 'slate', renewal_pending: 'blue', rejected: 'red',
}
const SCOPE_TONE: Record<string, Tone> = { exclusive: 'violet', single_use: 'orange', limited: 'blue', perpetual: 'green' }
const fmtDate = (value: string | null) => value
  ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`)) : '—'
const shortRef = (id: string | null | undefined) => (id ? `S-${id.replace(/-/g, '').slice(0, 4).toUpperCase()}` : null)

export default async function RightsPage({ searchParams }: { searchParams: RawSearchParams }) {
  const { access, ...session } = await requireCreatorModule('rights')
  const { supabase, ctx, capabilities, basePath } = session
  const query = parseRightsQuery(searchParams)
  if (!access.allowed) return <CreatorsFrame session={session} module="rights" access={access}>{null}</CreatorsFrame>

  const [page, calendar, aggregates, expiring, approvals, conflicts, creators, campaigns] = await Promise.all([
    listRights(supabase, ctx.workspaceId, { ...query, size: query.view === 'calendar' ? query.size : Math.min(query.size, query.view === 'cards' ? 12 : query.size) }),
    query.view === 'calendar' ? listRights(supabase, ctx.workspaceId, query, { all: true, limit: 500 }) : Promise.resolve(null),
    rightsAggregates(supabase, ctx.workspaceId),
    expiringLicences(supabase, ctx.workspaceId, 5),
    recentRightsApprovals(supabase, ctx.workspaceId, 3),
    rightsConflicts(supabase, ctx.workspaceId),
    creatorPickerList(supabase, ctx.workspaceId),
    workspaceCampaigns(supabase, ctx.workspaceId),
  ])

  const complianceDiff = aggregates.complianceRate - aggregates.previous.complianceRate
  const kpis: Kpi[] = [
    { id: 'active', label: 'Active Rights', value: aggregates.byStatus.active.toLocaleString('en-GB'), tone: 'blue', icon: 'users', spark: aggregates.createdSeries, href: `${basePath}/rights?status=active`, ...kpiDelta(aggregates.byStatus.active, aggregates.previous.active) },
    { id: 'expiring', label: 'Expiring Soon', value: String(aggregates.expiringSoon), tone: 'orange', icon: 'calendar', spark: aggregates.expiredSeries, href: `${basePath}/rights?expiry=30&status=active`, ...kpiDelta(aggregates.expiringSoon, aggregates.previous.expiringSoon) },
    { id: 'pending', label: 'Pending Approvals', value: String(aggregates.pendingApprovals), tone: 'violet', icon: 'money', spark: aggregates.createdSeries, href: `${basePath}/rights?status=pending_approval`, ...kpiDelta(aggregates.pendingApprovals, aggregates.previous.pending) },
    { id: 'restricted', label: 'Restricted Assets', value: String(aggregates.restricted), tone: 'red', icon: 'shieldAlert', spark: aggregates.expiredSeries, href: `${basePath}/rights?status=restricted`, ...kpiDelta(aggregates.restricted, aggregates.previous.restricted) },
    { id: 'renewals', label: 'Renewals This Month', value: String(aggregates.renewalsThisMonth), tone: 'blue', icon: 'target', spark: aggregates.createdSeries, delta: 'Licences expiring before month end', trend: 'flat', href: `${basePath}/rights?expiry=30` },
    { id: 'compliance', label: 'Compliance Rate', value: `${aggregates.complianceRate.toFixed(1)}%`, tone: 'green', icon: 'shield', spark: aggregates.createdSeries, delta: `${Math.abs(complianceDiff).toFixed(1)}pp vs last 30 days`, trend: complianceDiff > 0 ? 'up' : complianceDiff < 0 ? 'down' : 'flat', tooltip: 'Assets covered by an active licence as a share of all delivered assets, pending and restricted licences.' },
  ]

  const statusSlices: Slice[] = ([
    ['active', '#22c55e'], ['expired', '#f16063'], ['pending_approval', '#a855f7'], ['restricted', '#f59e0b'], ['revoked', '#94a3b8'],
  ] as [RightsStatus, string][]).map(([key, colour]) => ({ key, label: RIGHTS_STATUS_LABELS[key], value: aggregates.byStatus[key], colour, href: `${basePath}/rights?status=${key}` }))
  const statusTotal = statusSlices.reduce((a, s) => a + s.value, 0)
  const coverage: Slice[] = [
    { key: 'full', label: 'Fully Licensed', value: aggregates.fullyLicensed, colour: '#22c55e' },
    { key: 'limited', label: 'Limited License', value: aggregates.limitedLicence, colour: '#3b82f6' },
    { key: 'pending', label: 'Pending Approval', value: aggregates.pendingApprovals, colour: '#a855f7', href: `${basePath}/rights?status=pending_approval` },
    { key: 'restricted', label: 'Restricted', value: aggregates.restricted, colour: '#f16063', href: `${basePath}/rights?status=restricted` },
    { key: 'unlicensed', label: 'Unlicensed', value: aggregates.unlicensedAssets, colour: '#94a3b8', href: `${basePath}/submissions?rights=none` },
  ]
  const coverageTotal = coverage.reduce((a, s) => a + s.value, 0)
  const hasFilters = Boolean(query.territory || query.channel || query.campaign || query.creator || query.status || query.expiry || query.scope || query.q)

  return (
    <CreatorsFrame
      session={session} module="rights" access={access}
      actions={(
        <>
          {capabilities.manageRights && <AddRightsButton creators={creators} />}
          {capabilities.manageRights && <SendUsageRequestButton creators={creators} />}
          <ExportMenu entity="rights" allowed={capabilities.export} />
        </>
      )}
    >
      <KpiGrid items={kpis} />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-[14px] xl:grid-cols-[858fr_273fr]">
        <div className="flex min-w-0 flex-col gap-[14px]">
          <div className={cn(CARD, 'grid grid-cols-2 gap-x-[14px] gap-y-3 px-[12px] py-[10px] sm:grid-cols-3 lg:grid-cols-[repeat(6,minmax(0,1fr))_auto] lg:items-end')}>
            <BareSelect k="territory" label="Territory" options={RIGHTS_TERRITORIES.map(t => ({ value: t, label: t }))} />
            <BareSelect k="channel" label="Channel" options={CREATOR_CHANNELS.map(c => ({ value: c, label: CHANNEL_LABELS[c] }))} />
            <BareSelect k="campaign" label="Campaign" options={campaigns.map(c => ({ value: c.id, label: c.name }))} />
            <BareSelect k="creator" label="Creator" options={creators.map(c => ({ value: c.id, label: c.name }))} />
            <BareSelect k="status" label="Rights Status" options={RIGHTS_STATUSES.map(s => ({ value: s, label: RIGHTS_STATUS_LABELS[s] }))} />
            <div className="[&_select]:border-transparent [&_select]:bg-transparent [&_select]:pl-[26px] [&_select]:hover:border-transparent">
              <PresetControl labelled icon spec={{ key: 'expiry', label: 'Expiry Range', all: 'Any expiry', options: [{ value: '30', label: 'Next 30 days' }, { value: '60', label: 'Next 60 days' }, { value: '90', label: 'Next 90 days' }, { value: 'expired', label: 'Already expired' }] }} />
            </div>
            <div className="pb-[9px] pl-2"><ResetFilters /></div>
          </div>

          {query.view === 'calendar' ? <RightsCalendar rows={calendar?.rows ?? []} basePath={basePath} />
            : query.view === 'cards' ? (
              page.rows.length === 0 ? <div className={CARD}><PanelEmpty className="min-h-[240px]">{hasFilters ? 'No rights records match these filters.' : 'No rights records yet.'}</PanelEmpty></div> : (
                <>
                  <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {page.rows.map(row => <RightsCard key={row.id} row={row} basePath={basePath} />)}
                  </ul>
                  <Pager compact page={query.page} size={Math.min(query.size, 12)} total={page.total} noun="rights" sizes={[12]} />
                </>
              )
            ) : (
              <section className={cn(CARD, 'min-w-0')} aria-label="Rights register">
                {page.error ? <PanelEmpty className="text-red-600">We could not load rights ({page.error}). Reference CF-CREATORS.</PanelEmpty>
                  : page.rows.length === 0 ? <PanelEmpty className="min-h-[240px]">{hasFilters ? 'No rights records match these filters.' : 'No rights records yet. Add one when a creator grants usage for approved content.'}</PanelEmpty> : (
                    <div className="relative overflow-x-auto">
                      <table className="w-full min-w-[700px] [&_td]:px-[5px] [&_th]:px-[5px]">
                        <caption className="sr-only">Usage rights</caption>
                        <thead className="border-b border-[#eef0f4]">
                          <tr className="h-[32px]">
                            {['Asset / Submission', 'Creator', 'Usage Scope', 'Territory', 'Channel', 'Start Date', 'Expiry Date', 'Status', 'Owner'].map(h => <th key={h} scope="col" className={cn(TH, 'text-[9.5px]', h === 'Asset / Submission' && '!pl-[12px]')}>{h}</th>)}
                            <th scope="col" className={TH}><span className="sr-only">Actions</span></th>
                          </tr>
                        </thead>
                        <tbody>
                          {page.rows.map(row => {
                            const status = effectiveRightsStatus(row.status, row.expiry_date)
                            const left = daysLeft(row.expiry_date)
                            return (
                              <tr key={row.id} className="h-[50.5px] border-b border-[#f1f3f6] last:border-0 hover:bg-[#fafbfd]">
                                <td className={cn(TD, '!pl-[12px]')}>
                                  <Link href={`${basePath}/rights/${row.id}`} className="flex items-center gap-[9px] hover:opacity-85">
                                    <Thumb src={row.submission?.thumbnail_url} alt="" className="h-[32px] w-[36px] shrink-0 rounded-[5px]" />
                                    <span className="leading-tight">
                                      <span className="block max-w-[98px] truncate text-[9.5px] font-medium text-[#101828]">{row.asset_label}</span>
                                      <span className="block text-[8.5px] text-[#8a94a6]">{row.submission_id ? `Submission #${shortRef(row.submission_id)}` : 'No linked submission'}</span>
                                    </span>
                                  </Link>
                                </td>
                                <td className={TD}><Person name={row.creator?.name ?? 'Unknown'} handle={row.creator?.handle} src={row.creator?.avatar_url} size={22} className="max-w-[112px] [&_span]:text-[9px]" /></td>
                                <td className={TD}><Pill tone={SCOPE_TONE[row.usage_scope] ?? 'blue'}>{USAGE_SCOPE_LABELS[row.usage_scope as UsageScope] ?? row.usage_scope}</Pill></td>
                                <td className={cn(TD, 'max-w-[80px] truncate text-[9.5px]')}>{row.territories?.length ? row.territories.join(', ') : <span className="text-[#dc2626]">Missing</span>}</td>
                                <td className={TD}><PlatformIcons platforms={row.channels} size={14} max={3} className="gap-[6px]" /></td>
                                <td className={cn(TD, 'text-[9.5px]')}>{fmtDate(row.start_date)}</td>
                                <td className={cn(TD, 'text-[9.5px] leading-tight')}>
                                  {row.expiry_date ? fmtDate(row.expiry_date) : 'No expiry'}
                                  {left !== null && <span className={cn('block text-[8.5px]', left < 0 ? 'text-[#dc2626]' : left <= 30 ? 'text-[#ea580c]' : 'text-[#ea580c]')}>{left < 0 ? 'Expired' : `${left} days left`}</span>}
                                </td>
                                <td className={TD}><Pill tone={STATUS_TONE[status] ?? 'slate'}>{RIGHTS_STATUS_LABELS[status]}</Pill></td>
                                <td className={TD}><span className="flex max-w-[78px] items-center gap-[5px] text-[9.5px]"><Avatar name={row.owner?.full_name} src={row.owner?.avatar_url} size={20} /><span className="truncate">{row.owner?.full_name ?? 'Unassigned'}</span></span></td>
                                <td className={cn(TD, 'text-right')}>
                                  <RightsRowMenu id={row.id} status={status} href={`${basePath}/rights/${row.id}`} canManage={capabilities.manageRights} canApprove={capabilities.approveRights} expiryDate={row.expiry_date} />
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                <Pager compact className="border-t border-[#eef0f4] px-[12px] py-[10px]" page={query.page} size={query.size} total={page.total} noun="rights" />
              </section>
            )}

          <div className="grid grid-cols-[minmax(0,1fr)] gap-[14px] md:grid-cols-[352fr_492fr]">
            <Panel title="Rights Status Distribution" titleClassName="text-[12px]" href={`${basePath}/rights?view=table`} hrefLabel="View full report">
              {statusTotal === 0 ? <PanelEmpty>No rights records yet.</PanelEmpty> : (
                <div className="flex items-center gap-[18px] pt-[6px]">
                  <Donut slices={statusSlices} total={statusTotal} caption="Total Rights" size={136} thickness={22} />
                  <Legend slices={statusSlices} total={statusTotal} className="flex-1 space-y-[13px]" />
                </div>
              )}
            </Panel>
            <Panel title="Rights Activity Trend" titleClassName="text-[12px]" href="/app/analytics" hrefLabel="View analytics">
              <LineChart data={rightsTrend(aggregates)} height={140} series={[
                { key: 'created', label: 'Created', colour: '#3b82f6', area: true },
                { key: 'expired', label: 'Expired', colour: '#3b82f6', dashed: true },
              ]} />
            </Panel>
          </div>
        </div>

        <aside className="flex min-w-0 flex-col gap-[14px]" aria-label="Rights insights">
          <div className="flex items-center gap-[10px]">
            <ViewToggle size="sm" className="flex-1 justify-between" active={query.view} views={[{ id: 'table', label: 'Table', icon: 'table' }, { id: 'cards', label: 'Cards', icon: 'cards' }, { id: 'calendar', label: 'Calendar', icon: 'calendar' }]} />
            <SettingsMenu defaultSort="expiry_soonest" sorts={RIGHTS_SORTS.map(s => ({ value: s.id, label: s.label }))} extra={[
              { key: 'scope', label: 'Usage scope', all: 'Any scope', options: Object.entries(USAGE_SCOPE_LABELS).map(([value, label]) => ({ value, label })) },
            ]} />
          </div>

          <Panel title="Expiring Licenses" titleClassName="text-[12px]" href={`${basePath}/rights?expiry=90&sort=expiry_soonest`}>
            {expiring.length === 0 ? <PanelEmpty>No licences expiring soon.</PanelEmpty> : (
              <ul className="space-y-[9px]">
                {expiring.map(row => {
                  const left = daysLeft(row.expiry_date) ?? 0
                  return (
                    <li key={row.id}>
                      <Link href={`${basePath}/rights/${row.id}`} className="flex items-center gap-[9px] rounded hover:bg-[#fafbfd]">
                        <Thumb src={row.submission?.thumbnail_url} alt="" className="h-[30px] w-[36px] shrink-0 rounded-[5px]" />
                        <span className="min-w-0 flex-1 leading-tight">
                          <span className="block truncate text-[9.5px] font-medium text-[#101828]">{row.asset_label}</span>
                          <span className="block text-[8.5px] text-[#8a94a6]">{fmtDate(row.expiry_date)}</span>
                        </span>
                        <span className={cn('shrink-0 text-[9px]', left <= 14 ? 'text-[#dc2626]' : 'text-[#ea580c]')}>{left} days left</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
            <Link href={`${basePath}/rights?expiry=90&sort=expiry_soonest`} className="mt-[11px] flex h-[26px] items-center justify-center rounded-md border border-[#e4e7ec] text-[9.5px] font-medium text-[#1d6bf3] hover:bg-[#f5f8ff]">View all expiring ({aggregates.expiringSoon})</Link>
          </Panel>

          <Panel title="Rights Coverage" titleClassName="text-[12px]" href={null}>
            {coverageTotal === 0 ? <PanelEmpty>Coverage appears once content and licences exist.</PanelEmpty> : (
              <div className="flex items-center gap-[10px]">
                <Donut slices={coverage} total={coverageTotal} caption="Compliant" valueLabel={`${aggregates.complianceRate.toFixed(1)}%`} size={88} thickness={13} />
                <Legend slices={coverage} total={coverageTotal} className="min-w-0 flex-1 space-y-[7px] [&_li]:text-[8px]" />
              </div>
            )}
            <Link href={`${basePath}/submissions?rights=none`} className="mt-[10px] flex h-[26px] items-center justify-center rounded-md border border-[#e4e7ec] text-[9.5px] font-medium text-[#1d6bf3] hover:bg-[#f5f8ff]">View coverage report</Link>
          </Panel>

          <Panel title="Recent Approvals" titleClassName="text-[12px]" href={`${basePath}/rights?status=active&sort=start_newest`}>
            {approvals.length === 0 ? <PanelEmpty>No approved licences yet.</PanelEmpty> : (
              <ul className="space-y-[11px]">
                {approvals.map(row => (
                  <li key={row.id}>
                    <Link href={`${basePath}/rights/${row.id}`} className="flex items-start gap-[8px] rounded hover:bg-[#fafbfd]">
                      <Avatar name={row.creator?.name} src={row.creator?.avatar_url} size={20} />
                      <span className="min-w-0 flex-1 leading-tight">
                        <span className="block truncate text-[9px] font-medium text-[#101828]">{row.creator?.name} • {row.asset_label}</span>
                        <span className="block truncate text-[8.5px] text-[#8a94a6]">{USAGE_SCOPE_LABELS[row.usage_scope as UsageScope]} License • {row.territories?.join(', ') || 'No territory'}</span>
                        <span className="block text-[8px] text-[#98a2b3]">{formatAgo(row.updated_at)}</span>
                      </span>
                      <Pill tone="green" className="mt-[6px]">Approved</Pill>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Compliance Alerts" titleClassName="text-[12px]" href={`${basePath}/rights?status=expired`} className="flex-1">
            {conflicts.length === 0 ? <PanelEmpty>No compliance conflicts detected.</PanelEmpty> : (
              <ul className="space-y-[8px]">
                {conflicts.slice(0, 4).map(conflict => (
                  <li key={conflict.type}>
                    <Link href={`${basePath}/rights/${conflict.sampleIds[0]}`} className="flex items-center gap-[7px] text-[9px] text-[#344054] hover:underline"
                      title={`${conflict.count} record(s). Opens the first affected record.`}>
                      <span className={cn('h-[7px] w-[7px] shrink-0 rounded-full border-[1.5px]', conflict.severity === 'high' ? 'border-[#f97316]' : conflict.severity === 'medium' ? 'border-[#f59e0b]' : 'border-[#3b82f6]')} aria-hidden />
                      <span className="min-w-0 flex-1 truncate">{conflict.count} {RIGHTS_CONFLICT_LABELS[conflict.type as RightsConflictType]?.toLowerCase() ?? conflict.type}</span>
                      <span className={cn('shrink-0 capitalize', conflict.severity === 'high' ? 'text-[#dc2626]' : conflict.severity === 'medium' ? 'text-[#d97706]' : 'text-[#2563eb]')}>{conflict.severity}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </aside>
      </div>
    </CreatorsFrame>
  )
}

/** Borderless labelled select, matching the Rights filter strip. */
function BareSelect({ k, label, options }: { k: string; label: string; options: { value: string; label: string }[] }) {
  return (
    <div className="border-r border-[#f1f3f6] pr-[10px] [&_select]:border-transparent [&_select]:bg-transparent [&_select]:pl-0 [&_select]:hover:border-transparent">
      <SelectControl labelled spec={{ key: k, label, all: 'All', options }} />
    </div>
  )
}

function RightsCard({ row, basePath }: { row: RightsRow; basePath: string }) {
  const status = effectiveRightsStatus(row.status, row.expiry_date)
  const left = daysLeft(row.expiry_date)
  return (
    <li className={cn(CARD, 'overflow-hidden')}>
      <Link href={`${basePath}/rights/${row.id}`} className="block hover:bg-[#fafbfd]">
        <Thumb src={row.submission?.thumbnail_url} alt="" className="aspect-[16/7] w-full" />
        <span className="block p-[12px]">
          <span className="flex items-center justify-between gap-2">
            <span className="truncate text-[11px] font-semibold text-[#101828]">{row.asset_label}</span>
            <Pill tone={STATUS_TONE[status] ?? 'slate'}>{RIGHTS_STATUS_LABELS[status]}</Pill>
          </span>
          <span className="mt-[6px] flex items-center gap-[6px] text-[10px] text-[#475467]"><Avatar name={row.creator?.name} src={row.creator?.avatar_url} size={18} />{row.creator?.name}</span>
          <span className="mt-[8px] flex flex-wrap items-center gap-2 text-[9.5px] text-[#475467]">
            <Pill tone={SCOPE_TONE[row.usage_scope] ?? 'blue'}>{USAGE_SCOPE_LABELS[row.usage_scope as UsageScope]}</Pill>
            <PlatformIcons platforms={row.channels} size={13} />
          </span>
          <span className="mt-[8px] block text-[9.5px] text-[#475467]">{row.territories?.join(', ') || 'No territory'} · {fmtDate(row.start_date)} → {row.expiry_date ? fmtDate(row.expiry_date) : 'No expiry'}</span>
          {left !== null && <span className={cn('mt-[4px] block text-[9.5px] font-medium', left < 0 ? 'text-[#dc2626]' : left <= 30 ? 'text-[#ea580c]' : 'text-[#16a34a]')}>{left < 0 ? `Expired ${Math.abs(left)} days ago` : `${left} days remaining`}</span>}
        </span>
      </Link>
    </li>
  )
}

/** Month calendar of licence starts and expiries, with an accessible list alternative. */
function RightsCalendar({ rows, basePath }: { rows: RightsRow[]; basePath: string }) {
  const today = new Date()
  const months = [0, 1, 2].map(offset => new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + offset, 1)))
  const events = rows.flatMap(row => [
    row.start_date ? { date: row.start_date, row, kind: 'Starts' as const } : null,
    row.expiry_date ? { date: row.expiry_date, row, kind: 'Expires' as const } : null,
  ]).filter((e): e is { date: string; row: RightsRow; kind: 'Starts' | 'Expires' } => e !== null)

  return (
    <section className={cn(CARD, 'min-w-0 p-[14px]')} aria-label="Rights calendar">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {months.map(month => {
          const first = (month.getUTCDay() + 6) % 7
          const daysInMonth = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).getUTCDate()
          const key = month.toISOString().slice(0, 7)
          return (
            <div key={key} aria-hidden>
              <h3 className="mb-2 text-[11.5px] font-semibold text-[#101828]">{new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(month)}</h3>
              <div className="grid grid-cols-7 gap-[2px] text-center text-[8.5px] text-[#8a94a6]">
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i}>{d}</span>)}
                {Array.from({ length: first }).map((_, i) => <span key={`b${i}`} />)}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const date = `${key}-${String(i + 1).padStart(2, '0')}`
                  const dayEvents = events.filter(e => e.date === date)
                  return (
                    <span key={date} className={cn('flex h-[34px] flex-col items-center rounded border border-[#f1f3f6] pt-[2px] text-[9px] text-[#344054]', date === today.toISOString().slice(0, 10) && 'border-[#1d6bf3]')}>
                      {i + 1}
                      <span className="mt-[2px] flex gap-[2px]">
                        {dayEvents.slice(0, 3).map((e, j) => <span key={j} className={cn('h-[5px] w-[5px] rounded-full', e.kind === 'Expires' ? 'bg-[#ef4444]' : 'bg-[#22c55e]')} />)}
                      </span>
                    </span>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
      <h3 className="mb-2 mt-4 text-[11.5px] font-semibold text-[#101828]">Upcoming licence dates</h3>
      <ul className="max-h-[260px] divide-y divide-[#f1f3f6] overflow-y-auto text-[10.5px]">
        {events.filter(e => e.date >= today.toISOString().slice(0, 10)).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 40).map((e, i) => (
          <li key={i}>
            <Link href={`${basePath}/rights/${e.row.id}`} className="flex items-center gap-3 py-[6px] hover:bg-[#fafbfd]">
              <span className="w-[86px] text-[#475467]">{fmtDate(e.date)}</span>
              <span className={cn('w-[52px] font-medium', e.kind === 'Expires' ? 'text-[#dc2626]' : 'text-[#16a34a]')}>{e.kind}</span>
              <span className="min-w-0 flex-1 truncate text-[#101828]">{e.row.asset_label}</span>
              <span className="text-[#8a94a6]">{e.row.creator?.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
