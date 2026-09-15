import Link from 'next/link'
import { requireCreatorModule } from '@/lib/creators/server'
import {
  creatorPickerList, expiringLicences, listRights, recentActivity,
  recentRightsApprovals, rightsAggregates, rightsConflicts,
  workspaceCampaigns, workspaceMembers, delta,
} from '@/lib/creators/data'
import { parseRightsQuery, hasAnyFilter, type RawParams } from '@/lib/creators/query'
import {
  CHANNEL_LABELS, CREATOR_CHANNELS, RIGHTS_CONFLICT_LABELS, RIGHTS_STATUS_BADGE,
  RIGHTS_STATUS_COLOUR, RIGHTS_STATUS_LABELS, RIGHTS_STATUSES, RIGHTS_TERRITORIES,
  USAGE_SCOPE_LABELS, USAGE_SCOPES, effectiveRightsStatus, daysUntil,
} from '@/lib/creators/constants'
import CreatorsHeader from '@/components/creators/CreatorsHeader'
import KpiStrip from '@/components/creators/KpiStrip'
import FilterBar, { type FilterSpec } from '@/components/creators/FilterBar'
import Pagination from '@/components/creators/Pagination'
import ActivityFeed from '@/components/creators/ActivityFeed'
import { DonutChart, DonutLegend } from '@/components/creators/charts'
import AddRightsButton, { SendUsageRequestButton } from '@/components/creators/AddRightsButton'
import ExportButton, { HeaderOverflow } from '@/components/creators/ExportButton'
import { AccessBlocked, CreatorsEmpty, LoadError, PanelEmpty } from '@/components/creators/states'
import {
  CARD, CARD_SHADOW, CREATORS_PAGE, ChannelChips, CreatorChip, Panel,
  formatNumber, formatPercent, formatShortDate,
} from '@/components/creators/primitives'
import { Badge } from '@/components/ui/Badge'
import type { KpiValue, StatusCount } from '@/lib/creators/types'

export const metadata = { title: 'Rights · Caption Fox' }

export default async function RightsPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const params = await searchParams
  const { supabase, ctx, capabilities, modules, access } = await requireCreatorModule('rights')

  if (!access.allowed) {
    return (
      <div className={CREATORS_PAGE}>
        <CreatorsHeader module="rights" modules={modules} />
        <AccessBlocked access={access} />
      </div>
    )
  }

  const query = parseRightsQuery(params)

  const [aggregates, page, expiring, approvals, conflicts, activity, campaigns, members, creators] = await Promise.all([
    rightsAggregates(supabase, ctx.workspaceId),
    listRights(supabase, ctx.workspaceId, query),
    expiringLicences(supabase, ctx.workspaceId, 5),
    recentRightsApprovals(supabase, ctx.workspaceId, 4),
    rightsConflicts(supabase, ctx.workspaceId),
    recentActivity(supabase, ctx.workspaceId, 6, { entityType: 'rights' }),
    workspaceCampaigns(supabase, ctx.workspaceId),
    workspaceMembers(supabase, ctx.workspaceId),
    creatorPickerList(supabase, ctx.workspaceId),
  ])

  const activeDelta = delta(aggregates.byStatus.active, aggregates.previous.active)
  const expiringDelta = delta(aggregates.expiringSoon, aggregates.previous.expiringSoon)
  const pendingDelta = delta(aggregates.pendingApprovals, aggregates.previous.pending)
  const restrictedDelta = delta(aggregates.restricted, aggregates.previous.restricted)
  const renewalsDelta = delta(aggregates.renewalsThisMonth, aggregates.previous.renewals)
  const complianceDelta = delta(aggregates.complianceRate, aggregates.previous.complianceRate)

  const kpis: KpiValue[] = [
    { id: 'active', label: 'Active Rights', value: formatNumber(aggregates.byStatus.active), hint: `${activeDelta.pct >= 0 ? '+' : ''}${activeDelta.pct.toFixed(1)}% vs last 30 days`, trend: activeDelta.trend, icon: 'shieldCheck', tone: 'green' },
    { id: 'expiring', label: 'Expiring Soon', value: formatNumber(aggregates.expiringSoon), hint: `${expiringDelta.pct >= 0 ? '+' : ''}${expiringDelta.pct.toFixed(1)}% vs last 30 days`, trend: expiringDelta.trend, icon: 'calendar', tone: 'amber' },
    { id: 'pending', label: 'Pending Approvals', value: formatNumber(aggregates.pendingApprovals), hint: `${pendingDelta.pct >= 0 ? '+' : ''}${pendingDelta.pct.toFixed(1)}% vs last 30 days`, trend: pendingDelta.trend, icon: 'clock', tone: 'violet' },
    { id: 'restricted', label: 'Restricted Assets', value: formatNumber(aggregates.restricted), hint: `${restrictedDelta.pct >= 0 ? '+' : ''}${restrictedDelta.pct.toFixed(1)}% vs last 30 days`, trend: restrictedDelta.trend, icon: 'shieldAlert', tone: 'red' },
    { id: 'renewals', label: 'Renewals This Month', value: formatNumber(aggregates.renewalsThisMonth), hint: `${renewalsDelta.pct >= 0 ? '+' : ''}${renewalsDelta.pct.toFixed(1)}% vs last 30 days`, trend: renewalsDelta.trend, icon: 'refresh', tone: 'blue' },
    { id: 'compliance', label: 'Compliance Rate', value: formatPercent(aggregates.complianceRate, 1), hint: `${complianceDelta.pct >= 0 ? '+' : ''}${complianceDelta.pct.toFixed(1)}pp vs last 30 days`, trend: complianceDelta.trend, icon: 'badge', tone: 'green' },
  ]

  const filters: FilterSpec[] = [
    { key: 'territory', label: 'Territory', allLabel: 'All', options: RIGHTS_TERRITORIES.map(t => ({ value: t, label: t })) },
    { key: 'channel', label: 'Channel', allLabel: 'All', options: CREATOR_CHANNELS.map(c => ({ value: c, label: CHANNEL_LABELS[c] })) },
    { key: 'campaign', label: 'Campaign', allLabel: 'All', options: campaigns.map(c => ({ value: c.id, label: c.name })) },
    { key: 'creator', label: 'Creator', allLabel: 'All', options: creators.map(c => ({ value: c.id, label: c.name })) },
    { key: 'status', label: 'Rights Status', allLabel: 'All', options: RIGHTS_STATUSES.map(s => ({ value: s, label: RIGHTS_STATUS_LABELS[s] })) },
    { key: 'expiry', label: 'Expiry Range', allLabel: 'Next 90 days', options: [{ value: '30', label: 'Next 30 days' }, { value: '60', label: 'Next 60 days' }, { value: '90', label: 'Next 90 days' }, { value: 'expired', label: 'Already expired' }] },
    { key: 'scope', label: 'Usage Scope', allLabel: 'All', options: USAGE_SCOPES.map(s => ({ value: s, label: USAGE_SCOPE_LABELS[s] })), advanced: true },
    { key: 'owner', label: 'Owner', allLabel: 'All', options: members.map(m => ({ value: m.id, label: m.full_name ?? m.email ?? 'Unknown' })), advanced: true },
  ]

  const filtered = hasAnyFilter(query)
  const statusSlices: StatusCount[] = RIGHTS_STATUSES
    .filter(status => aggregates.byStatus[status] > 0)
    .map(status => ({ key: status, label: RIGHTS_STATUS_LABELS[status], value: aggregates.byStatus[status], colour: RIGHTS_STATUS_COLOUR[status] }))

  const coverageSlices: StatusCount[] = [
    { key: 'full', label: 'Fully Licensed', value: aggregates.fullyLicensed, colour: '#10b981' },
    { key: 'limited', label: 'Limited License', value: aggregates.limitedLicence, colour: '#3b82f6' },
    { key: 'pending', label: 'Pending Approval', value: aggregates.byStatus.pending_approval, colour: '#8b5cf6' },
    { key: 'restricted', label: 'Restricted', value: aggregates.restricted, colour: '#f59e0b' },
    { key: 'unlicensed', label: 'Unlicensed', value: aggregates.unlicensedAssets, colour: '#94a3b8' },
  ]
  const coverageTotal = coverageSlices.reduce((sum, slice) => sum + slice.value, 0)

  return (
    <div className={CREATORS_PAGE}>
      <CreatorsHeader
        module="rights" modules={modules}
        actions={(
          <>
            {capabilities.manageRights && <AddRightsButton creators={creators} />}
            {capabilities.manageRights && <SendUsageRequestButton creators={creators} />}
            <ExportButton entity="rights" allowed={capabilities.export} />
            <HeaderOverflow items={[{ label: 'Refresh data', onSelect: 'refresh' }]} />
          </>
        )}
      />

      <div className="space-y-4">
        <KpiStrip items={kpis} />

        {conflicts.length > 0 && (
          <div className={`${CARD} border-amber-200 bg-amber-50/50 px-4 py-3`}>
            <p className="mb-1.5 text-[12.5px] font-semibold text-amber-800">Compliance alerts</p>
            <ul className="flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-amber-700">
              {conflicts.slice(0, 5).map(conflict => (
                <li key={conflict.type}>{RIGHTS_CONFLICT_LABELS[conflict.type as keyof typeof RIGHTS_CONFLICT_LABELS] ?? conflict.type} · <b>{conflict.count}</b></li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
          <div className="space-y-3">
            <FilterBar
              searchPlaceholder="Search rights by asset or notes…" filters={filters}
              views={['table', 'cards', 'calendar']} activeView={query.view} values={query}
            />

            {page.error ? (
              <LoadError message={page.error} />
            ) : page.rows.length === 0 ? (
              <CreatorsEmpty
                icon={filtered ? 'search' : 'creators'}
                title={filtered ? 'No rights records match these filters' : 'No rights recorded yet'}
                message={filtered ? 'Try widening your filters or clearing the search term.' : 'Add a rights record once a creator grants usage of their content.'}
                action={!filtered && capabilities.manageRights ? <AddRightsButton creators={creators} /> : undefined}
              />
            ) : query.view === 'cards' ? (
              <RightsCards rows={page.rows} />
            ) : query.view === 'calendar' ? (
              <RightsCalendar rows={page.rows} />
            ) : (
              <RightsTable rows={page.rows} />
            )}

            {page.rows.length > 0 && (
              <div className={`${CARD} ${CARD_SHADOW}`}>
                <Pagination page={query.page} size={query.size} total={page.total} label="rights" />
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Panel title="Rights Status Distribution" viewAllHref="/app/analytics">
                <div className="flex items-center gap-4">
                  <DonutChart slices={statusSlices} total={aggregates.total} caption="Total Rights" size={140} thickness={18} />
                  <DonutLegend slices={statusSlices} total={aggregates.total} className="flex-1" />
                </div>
              </Panel>
              <Panel title="Recent Activity" viewAllHref="/app/creators">
                <ActivityFeed items={activity} emptyMessage="Rights created, approved, expired or revoked in this workspace will appear here." />
              </Panel>
            </div>
          </div>

          <aside className="space-y-4">
            <Panel title="Expiring Licences" viewAllHref="/app/creators/rights?expiry=90">
              {expiring.length === 0 ? <PanelEmpty message="No licences expiring in the next window." /> : (
                <ul className="space-y-2.5">
                  {expiring.map(right => {
                    const remaining = daysUntil(right.expiry_date)
                    return (
                      <li key={right.id}>
                        <Link href={`/app/creators/rights/${right.id}`} className="flex items-center justify-between rounded-lg px-1 py-1 text-[12.5px] hover:bg-slate-50">
                          <span className="min-w-0 truncate text-slate-700">{right.asset_label}</span>
                          <span className="shrink-0 font-medium text-amber-600">{remaining !== null ? `${remaining} days left` : formatShortDate(right.expiry_date)}</span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Panel>

            <Panel title="Rights Coverage" viewAllHref="/app/creators/rights">
              <div className="flex items-center gap-4">
                <DonutChart slices={coverageSlices} total={coverageTotal} caption="Compliant" size={140} thickness={18} />
                <DonutLegend slices={coverageSlices} total={coverageTotal} className="flex-1" />
              </div>
            </Panel>

            <Panel title="Recent Approvals" viewAllHref="/app/creators/rights?status=active">
              {approvals.length === 0 ? <PanelEmpty message="Approved rights will appear here." /> : (
                <ul className="space-y-2.5">
                  {approvals.map(right => (
                    <li key={right.id}>
                      <Link href={`/app/creators/rights/${right.id}`} className="block rounded-lg px-1 py-1 hover:bg-slate-50">
                        <p className="truncate text-[12.5px] font-medium text-slate-800">{right.creator?.name} — {right.asset_label}</p>
                        <p className="text-[11px] text-slate-400">{USAGE_SCOPE_LABELS[right.usage_scope as keyof typeof USAGE_SCOPE_LABELS] ?? right.usage_scope} · {(right.territories ?? []).join(', ') || 'No territories set'}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            {conflicts.length > 0 && (
              <Panel title="Compliance Alerts" viewAllHref="/app/creators/rights">
                <ul className="space-y-2">
                  {conflicts.slice(0, 6).map(conflict => (
                    <li key={conflict.type} className="flex items-center justify-between text-[12.5px]">
                      <span className="truncate text-slate-600">{RIGHTS_CONFLICT_LABELS[conflict.type as keyof typeof RIGHTS_CONFLICT_LABELS] ?? conflict.type}</span>
                      <Badge variant={conflict.severity === 'high' ? 'red' : conflict.severity === 'medium' ? 'amber' : 'slate'}>{conflict.severity}</Badge>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
          </aside>
        </div>
      </div>
    </div>
  )
}

function RightsTable({ rows }: { rows: Awaited<ReturnType<typeof listRights>>['rows'] }) {
  return (
    <div className={`${CARD} ${CARD_SHADOW} overflow-hidden`}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400">
              <th className="px-4 py-2.5 font-medium">Asset / Submission</th>
              <th className="px-3 py-2.5 font-medium">Creator</th>
              <th className="px-3 py-2.5 font-medium">Usage Scope</th>
              <th className="px-3 py-2.5 font-medium">Territory</th>
              <th className="px-3 py-2.5 font-medium">Channel</th>
              <th className="px-3 py-2.5 font-medium">Start</th>
              <th className="px-3 py-2.5 font-medium">Expiry</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {rows.map(right => {
              const status = effectiveRightsStatus(right.status, right.expiry_date)
              return (
                <tr key={right.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-2.5">
                    <Link href={`/app/creators/rights/${right.id}`} className="font-medium text-slate-800 hover:text-blue-600">{right.asset_label}</Link>
                  </td>
                  <td className="px-3 py-2.5"><CreatorChip creator={right.creator} size={22} /></td>
                  <td className="px-3 py-2.5"><Badge variant="blue">{USAGE_SCOPE_LABELS[right.usage_scope as keyof typeof USAGE_SCOPE_LABELS] ?? right.usage_scope}</Badge></td>
                  <td className="px-3 py-2.5 text-slate-500">{(right.territories ?? []).slice(0, 2).join(', ') || '—'}</td>
                  <td className="px-3 py-2.5"><ChannelChips channels={right.channels} max={2} /></td>
                  <td className="px-3 py-2.5 text-slate-500">{formatShortDate(right.start_date)}</td>
                  <td className="px-3 py-2.5 text-slate-500">{formatShortDate(right.expiry_date)}</td>
                  <td className="px-3 py-2.5"><Badge variant={RIGHTS_STATUS_BADGE[status]}>{RIGHTS_STATUS_LABELS[status]}</Badge></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function RightsCards({ rows }: { rows: Awaited<ReturnType<typeof listRights>>['rows'] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map(right => {
        const status = effectiveRightsStatus(right.status, right.expiry_date)
        const remaining = daysUntil(right.expiry_date)
        return (
          <Link key={right.id} href={`/app/creators/rights/${right.id}`} className={`${CARD} ${CARD_SHADOW} flex flex-col gap-2.5 p-4 hover:border-slate-300`}>
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 truncate text-sm font-semibold text-slate-900">{right.asset_label}</p>
              <Badge variant={RIGHTS_STATUS_BADGE[status]}>{RIGHTS_STATUS_LABELS[status]}</Badge>
            </div>
            <CreatorChip creator={right.creator} size={24} />
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="blue">{USAGE_SCOPE_LABELS[right.usage_scope as keyof typeof USAGE_SCOPE_LABELS] ?? right.usage_scope}</Badge>
              <ChannelChips channels={right.channels} max={3} />
            </div>
            <p className="text-[12px] text-slate-500">{(right.territories ?? []).join(', ') || 'No territories set'}</p>
            <p className="mt-auto border-t border-slate-100 pt-2 text-[11.5px] text-slate-400">
              {formatShortDate(right.start_date)} → {formatShortDate(right.expiry_date)}
              {remaining !== null && remaining >= 0 && remaining <= 30 && <span className="ml-2 font-medium text-amber-600">{remaining}d left</span>}
            </p>
          </Link>
        )
      })}
    </div>
  )
}

function RightsCalendar({ rows }: { rows: Awaited<ReturnType<typeof listRights>>['rows'] }) {
  const withDates = rows.filter(row => row.expiry_date).sort((a, b) => (a.expiry_date ?? '').localeCompare(b.expiry_date ?? ''))
  if (withDates.length === 0) return <CreatorsEmpty title="No dated rights" message="Rights need an expiry date to appear on the calendar." />

  const byMonth = new Map<string, typeof withDates>()
  for (const row of withDates) {
    const key = (row.expiry_date ?? '').slice(0, 7)
    byMonth.set(key, [...(byMonth.get(key) ?? []), row])
  }

  return (
    <div className={`${CARD} ${CARD_SHADOW} divide-y divide-slate-100`}>
      {[...byMonth.entries()].map(([month, items]) => (
        <div key={month} className="p-4">
          <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-slate-400">
            {new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(new Date(`${month}-01`))}
          </p>
          <ul className="space-y-1.5">
            {items.map(right => (
              <li key={right.id}>
                <Link href={`/app/creators/rights/${right.id}`} className="flex items-center justify-between rounded-lg px-1 py-1 text-[12.5px] hover:bg-slate-50">
                  <span className="truncate text-slate-700">{right.asset_label} — {right.creator?.name}</span>
                  <span className="shrink-0 text-slate-400">{formatShortDate(right.expiry_date)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
