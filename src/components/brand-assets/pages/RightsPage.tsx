import Link from 'next/link'
import {
  AlertTriangle, CircleCheck, Download, Eye, Globe, Lock, MoreVertical, Plus,
  RefreshCcw, ShieldCheck, Upload,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BrandContext } from '@/lib/brand-assets/context'
import type { RightsPage as RightsPageData } from '@/lib/brand-assets/queries'
import { buildHref, chipsFor, type RawParams, type RightsFilters } from '@/lib/brand-assets/filters'
import { can } from '@/lib/brand-assets/entitlements'
import {
  ActionLink, EmptyPanel, KpiStrip, PageHeading, Pagination, Panel, ProgressRing,
  StatusBadge, type KpiSpec,
} from '../ui/primitives'
import {
  FilterBar, FilterChips, FilterSelect, MoreFiltersButton, SearchField, SortSelect, ViewSwitcher,
} from '../ui/controls'
import { Avatar } from '../shell/BrandAssetsShell'
import { AssetThumb } from './OverviewPage'
import { formatCount, formatDaysLeft, formatRelativeShort, formatUkDate, humanise } from '../tokens'
import type { RightsLicenseRow } from '@/types/brand-assets'

export default function RightsPage({
  ctx, data, filters, params,
}: {
  ctx: BrandContext
  data: RightsPageData
  filters: RightsFilters
  params: RawParams
}) {
  const base = `${ctx.basePath}/brand`
  const pathname = `${base}/rights`
  const e = ctx.entitlements
  const k = data.kpis

  const kpis: KpiSpec[] = [
    { key: 'active', label: 'Active Licenses', value: formatCount(k.activeLicenses), icon: ShieldCheck, tone: 'blue',
      delta: null, deltaSuffix: '', riseIsGood: true, href: buildHref(pathname, params, { status: 'active' }),
      tooltip: 'Licences currently in force' },
    { key: 'expiring', label: 'Expiring Soon', value: formatCount(k.expiringSoon), icon: AlertTriangle, tone: 'amber',
      delta: null, deltaSuffix: '', riseIsGood: false, href: buildHref(pathname, params, { status: 'expiring_soon' }),
      tooltip: 'Licences expiring within 30 days' },
    { key: 'restricted', label: 'Restricted Assets', value: formatCount(k.restrictedAssets), icon: Lock, tone: 'red',
      delta: null, deltaSuffix: '', riseIsGood: false, href: `${base}/assets?rights=restricted`,
      tooltip: 'Assets flagged as restricted' },
    { key: 'regions', label: 'Regions Covered', value: formatCount(k.regionsCovered), icon: Globe, tone: 'indigo',
      delta: null, deltaSuffix: '', riseIsGood: true, href: null, tooltip: 'Distinct countries covered by licences' },
    { key: 'renewals', label: 'Pending Renewals', value: formatCount(k.pendingRenewals), icon: RefreshCcw, tone: 'purple',
      delta: null, deltaSuffix: '', riseIsGood: false, href: buildHref(pathname, params, { status: 'renewal_pending' }),
      tooltip: 'Renewals awaiting action' },
    { key: 'compliance', label: 'Compliance Score', value: `${k.complianceScore}%`, icon: CircleCheck, tone: 'emerald',
      delta: null, deltaSuffix: '', riseIsGood: true, href: null, ring: k.complianceScore,
      tooltip: 'Share of licences with no open conflict' },
  ]

  const chips = chipsFor(
    { q: filters.q, territory: filters.territory, channel: filters.channel, status: filters.status, licenseType: filters.licenseType },
    { q: 'Search', territory: 'Territory', channel: 'Channel', status: 'Status', licenseType: 'Type' },
  )

  return (
    <>
      <PageHeading
        title="Rights"
        subtitle="Manage rights governance, license visibility, expirations, and compliant asset usage."
        actions={
          <>
            <ActionLink href={buildHref(pathname, params, { create: 1 })} icon={Plus}
              disabled={!can(e, 'brand.rights.create')}
              title={can(e, 'brand.rights.create') ? undefined : 'Your role does not permit adding licences'}>
              Add License
            </ActionLink>
            <ActionLink href={buildHref(pathname, params, { uploadAgreement: 1 })} icon={Upload} tone="primary"
              disabled={!can(e, 'brand.rights.edit')}
              title={can(e, 'brand.rights.edit') ? undefined : 'Your role does not permit uploading agreements'}>
              Upload Agreement
            </ActionLink>
            <ActionLink href={buildHref(pathname, params, { export: 'csv' })} icon={Download}
              disabled={!can(e, 'brand.rights.export')}
              title={can(e, 'brand.rights.export') ? undefined : 'Your role does not permit exporting the rights register'}>
              Export Rights
            </ActionLink>
          </>
        }
      />

      <KpiStrip items={kpis} />

      <FilterBar>
        <SearchField pathname={pathname} params={params} placeholder="Search rights, assets, licenses…"
          defaultValue={filters.q} className="w-full max-w-[260px]" />
        <FilterSelect pathname={pathname} params={params} name="territory" label="Territory" allLabel="All Territories"
          value={filters.territory} options={data.territories.map(t => ({ value: t.code, label: t.name }))} />
        <FilterSelect pathname={pathname} params={params} name="channel" label="Channel" allLabel="All Channels"
          value={filters.channel} options={data.channels.map(c => ({ value: c.code, label: c.name }))} />
        <FilterSelect pathname={pathname} params={params} name="status" label="Status" allLabel="All Statuses"
          value={filters.status} options={[
            { value: 'active', label: 'Active' }, { value: 'expiring_soon', label: 'Expiring Soon' },
            { value: 'expired', label: 'Expired' }, { value: 'renewal_pending', label: 'Renewal Pending' },
            { value: 'restricted', label: 'Restricted' }, { value: 'draft', label: 'Draft' },
          ]} />
        <FilterSelect pathname={pathname} params={params} name="licenseType" label="Type" allLabel="All Types"
          value={filters.licenseType} options={[
            'exclusive', 'standard', 'non_exclusive', 'campaign', 'royalty_free', 'design', 'trademark', 'video', 'image',
          ].map(v => ({ value: v, label: humanise(v) }))} />
        <MoreFiltersButton pathname={pathname} params={params} activeCount={chips.length} />
        <div className="ml-auto flex items-center gap-2">
          <SortSelect pathname={pathname} params={params} value={filters.sort} options={[
            { value: 'expiry_asc', label: 'Expiry soonest' }, { value: 'expiry_desc', label: 'Expiry latest' },
            { value: 'name_asc', label: 'Name A–Z' }, { value: 'created_desc', label: 'Newest' },
          ]} />
          <ViewSwitcher pathname={pathname} params={params} active={filters.view}
            views={[{ value: 'table', label: 'Table' }, { value: 'calendar', label: 'Calendar' }, { value: 'cards', label: 'Cards' }]} />
        </div>
      </FilterBar>

      <FilterChips pathname={pathname} params={params} chips={chips} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_288px]">
        <div className="min-w-0 space-y-4">
          {data.licenses.length === 0 ? (
            <Panel>
              <EmptyPanel
                icon={ShieldCheck}
                title={chips.length ? 'No licences match those filters' : 'No licences recorded'}
                body={chips.length
                  ? 'Try a different search term or clear the filters to see everything.'
                  : 'Record a licence to track territories, channels, expiry and compliant usage.'}
                action={chips.length ? 'Clear filters' : (can(e, 'brand.rights.create') ? 'Add License' : undefined)}
                actionHref={chips.length ? pathname : buildHref(pathname, params, { create: 1 })}
              />
            </Panel>
          ) : filters.view === 'calendar' ? (
            <RightsCalendar data={data} base={base} />
          ) : filters.view === 'cards' ? (
            <RightsCards licenses={data.licenses} base={base} />
          ) : (
            <Panel title="Rights & Licensing" count={data.total}>
              <RightsTable licenses={data.licenses} base={base} />
              <Pagination page={filters.page} pageSize={filters.pageSize} total={data.total}
                hrefFor={patch => buildHref(pathname, params, patch)} />
            </Panel>
          )}

          <div className="grid gap-4 lg:grid-cols-3">
            <Panel title="Rights Coverage by Region" action="View report" actionHref={pathname} dense>
              {data.coverage.length === 0
                ? <EmptyPanel title="No territory data" body="Assign territories to licences to see coverage." />
                : (
                  <div className="px-4 py-3">
                    {/* Accessible table rather than a decorative map: the same data,
                        readable by screen readers and correct at every width. */}
                    <ul className="space-y-2">
                      {data.coverage.map(c => (
                        <li key={c.region}>
                          <div className="mb-0.5 flex items-baseline justify-between text-[11px]">
                            <span className="truncate font-medium text-slate-700">{c.region}</span>
                            <span className="shrink-0 tabular-nums text-slate-500">{c.count}</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                            <div className={cn('h-full rounded-full',
                              c.level === 'full' ? 'bg-blue-600'
                                : c.level === 'partial' ? 'bg-blue-400'
                                  : c.level === 'limited' ? 'bg-blue-200' : 'bg-slate-200')}
                              style={{ width: `${Math.min(100, (c.count / Math.max(1, data.coverage[0].count)) * 100)}%` }} />
                          </div>
                        </li>
                      ))}
                    </ul>
                    <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t border-slate-100 pt-2 text-[10px] text-slate-500">
                      <li className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-blue-600" />Fully covered (35+)</li>
                      <li className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-blue-400" />Partially (10–34)</li>
                      <li className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-blue-200" />Limited (1–9)</li>
                      <li className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-slate-200" />Not covered</li>
                    </ul>
                  </div>
                )}
            </Panel>

            <Panel title="Upcoming Renewals" action="View calendar" actionHref={buildHref(pathname, params, { view: 'calendar' })} dense>
              {data.renewals.length === 0
                ? <EmptyPanel title="No renewals due" body="Renewal tasks appear here as licences approach expiry." />
                : (
                  <ul className="divide-y divide-slate-50">
                    {data.renewals.map(r => (
                      <li key={r.id} className="flex items-center gap-2 px-4 py-2.5">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12px] font-medium text-slate-800">{r.name}</span>
                          <span className="block text-[10px] text-slate-400">Due {formatUkDate(r.due_on)}</span>
                        </span>
                        <StatusBadge status={r.status} />
                      </li>
                    ))}
                  </ul>
                )}
            </Panel>

            <Panel title="Status Summary" action="View full breakdown" actionHref={pathname} dense>
              <div className="px-4 py-3">
                <div className="flex items-center gap-4">
                  <div className="relative shrink-0">
                    <ProgressRing value={100} size={78} stroke={11} className="stroke-emerald-500" />
                    <span className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-[9px] text-slate-400">Total</span>
                      <span className="text-base font-bold leading-none text-slate-900">{formatCount(data.total)}</span>
                    </span>
                  </div>
                  <ul className="min-w-0 flex-1 space-y-1">
                    {data.statusSummary.map(s => (
                      <li key={s.status} className="flex items-center gap-1.5 text-[11px]">
                        <span className={cn('h-2 w-2 shrink-0 rounded-full',
                          s.status === 'active' ? 'bg-emerald-500'
                            : s.status === 'expiring_soon' ? 'bg-amber-500'
                              : s.status === 'expired' ? 'bg-rose-500'
                                : s.status === 'renewal_pending' ? 'bg-purple-500' : 'bg-slate-400')} />
                        <span className="min-w-0 flex-1 truncate text-slate-600">{humanise(s.status)}</span>
                        <span className="shrink-0 tabular-nums text-slate-700">{s.count} ({s.percent}%)</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Panel>
          </div>
        </div>

        {/* Right rail */}
        <div className="space-y-4">
          <Panel title="Expiring Licenses" action="View all" actionHref={buildHref(pathname, params, { status: 'expiring_soon' })} dense>
            {data.expiring.length === 0
              ? <EmptyPanel title="Nothing expiring" body="Licences expiring in the next 90 days appear here." />
              : (
                <ul className="divide-y divide-slate-50">
                  {data.expiring.map(l => {
                    const d = formatDaysLeft(l.days_remaining)
                    return (
                      <li key={l.id}>
                        <Link href={`${pathname}?license=${l.id}`} className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-slate-50">
                          <span className="h-8 w-8 shrink-0 overflow-hidden rounded border border-slate-200">
                            <AssetThumb name={l.name} kind={l.asset?.asset_kind ?? 'image'} url={l.asset?.thumbnail_path ?? null} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[12px] font-medium text-slate-800">{l.name}</span>
                            <span className="block text-[10px] text-slate-400">{formatUkDate(l.expires_on)}</span>
                          </span>
                          <span className={cn('shrink-0 text-[10px] font-semibold', d.tone)}>{d.label}</span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
          </Panel>

          <Panel title="High-Risk Assets" action="View all" actionHref={`${base}/assets?rights=restricted`} dense>
            {data.highRisk.length === 0
              ? <EmptyPanel title="No high-risk assets" body="Detected rights conflicts appear here." />
              : (
                <ul className="divide-y divide-slate-50">
                  {data.highRisk.map(h => (
                    <li key={h.id} className="flex items-center gap-2.5 px-4 py-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-rose-50">
                        <AlertTriangle size={14} className="text-rose-600" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12px] font-medium text-slate-800">{h.label}</span>
                        <span className="block truncate text-[10px] text-slate-400">{h.detail}</span>
                      </span>
                      <StatusBadge status={h.severity} />
                    </li>
                  ))}
                </ul>
              )}
          </Panel>

          <Panel title="Activity Feed" action="View all" actionHref={pathname} dense>
            {data.activity.length === 0
              ? <EmptyPanel title="No rights activity" body="Licence changes appear here." />
              : (
                <ul className="divide-y divide-slate-50">
                  {data.activity.map(a => (
                    <li key={a.id} className="flex gap-2.5 px-4 py-2.5">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded bg-slate-100">
                        <ShieldCheck size={12} className="text-slate-500" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12px] font-medium text-slate-800">{a.summary}</span>
                        <span className="block truncate text-[10px] text-slate-400">{a.actor?.full_name ?? 'System'}</span>
                      </span>
                      <span className="shrink-0 text-[10px] text-slate-400">{formatRelativeShort(a.created_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
          </Panel>
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------

function RightsTable({ licenses, base }: { licenses: RightsLicenseRow[]; base: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1080px] text-left">
        <thead>
          <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            <th className="px-5 py-2.5">Asset</th>
            <th className="px-3 py-2.5">License Type</th>
            <th className="px-3 py-2.5">Territory</th>
            <th className="px-3 py-2.5">Channel</th>
            <th className="px-3 py-2.5">Start Date</th>
            <th className="px-3 py-2.5">Expiry</th>
            <th className="px-3 py-2.5">Owner</th>
            <th className="px-3 py-2.5">Usage Scope</th>
            <th className="px-3 py-2.5">Status</th>
            <th className="px-3 py-2.5 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {licenses.map(l => {
            const d = formatDaysLeft(l.days_remaining)
            return (
              <tr key={l.id} className="hover:bg-slate-50">
                <td className="px-5 py-2.5">
                  <Link href={`${base}/rights?license=${l.id}`} className="flex min-w-0 items-center gap-2">
                    <span className="h-8 w-8 shrink-0 overflow-hidden rounded border border-slate-200">
                      <AssetThumb name={l.name} kind={l.asset?.asset_kind ?? 'image'} url={l.asset?.thumbnail_path ?? null} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium text-slate-800">{l.name}</span>
                      <span className="block truncate text-[10px] text-slate-400">{l.reference ?? '—'}</span>
                    </span>
                  </Link>
                </td>
                <td className="px-3 py-2.5 text-[12px] text-slate-600">{humanise(l.license_type)}</td>
                <td className="px-3 py-2.5 text-[12px] text-slate-600">{l.territories[0]?.name ?? '—'}</td>
                <td className="px-3 py-2.5 text-[12px] text-slate-600">{l.channels.slice(0, 2).map(c => c.name).join(', ') || '—'}</td>
                <td className="px-3 py-2.5 text-[12px] text-slate-600">{formatUkDate(l.starts_on)}</td>
                <td className="px-3 py-2.5">
                  <span className="block text-[12px] text-slate-700">{formatUkDate(l.expires_on)}</span>
                  <span className={cn('block text-[10px] font-medium', d.tone)}>{d.label}</span>
                </td>
                <td className="px-3 py-2.5">
                  <span className="flex items-center gap-1.5">
                    <Avatar name={l.owner?.full_name ?? '—'} src={l.owner?.avatar_url} size={20} />
                    <span className="truncate text-[12px] text-slate-600">{l.owner?.full_name ?? '—'}</span>
                  </span>
                </td>
                <td className="px-3 py-2.5 text-[12px] text-slate-600">{l.usage_scope ?? '—'}</td>
                <td className="px-3 py-2.5"><StatusBadge status={l.status} /></td>
                <td className="px-3 py-2.5">
                  <span className="flex items-center justify-end gap-1 text-slate-400">
                    <Link href={`${base}/rights?license=${l.id}`} className="rounded p-1 hover:bg-slate-100 hover:text-slate-600" aria-label={`View ${l.name}`}>
                      <Eye size={14} />
                    </Link>
                    <span className="rounded p-1"><MoreVertical size={14} /></span>
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function RightsCards({ licenses, base }: { licenses: RightsLicenseRow[]; base: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {licenses.map(l => {
        const d = formatDaysLeft(l.days_remaining)
        return (
          <article key={l.id} className="flex flex-col rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-2.5 flex items-start gap-2.5">
              <span className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-slate-200">
                <AssetThumb name={l.name} kind={l.asset?.asset_kind ?? 'image'} url={l.asset?.thumbnail_path ?? null} />
              </span>
              <span className="min-w-0 flex-1">
                <Link href={`${base}/rights?license=${l.id}`} className="block truncate text-[14px] font-semibold text-slate-900 hover:text-blue-600">
                  {l.name}
                </Link>
                <span className="block truncate text-[11px] text-slate-400">{humanise(l.license_type)} · {l.reference ?? '—'}</span>
              </span>
              <StatusBadge status={l.status} />
            </div>
            <dl className="mb-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
              <div><dt className="text-slate-400">Territory</dt><dd className="truncate font-medium text-slate-700">{l.territories[0]?.name ?? '—'}</dd></div>
              <div><dt className="text-slate-400">Channel</dt><dd className="truncate font-medium text-slate-700">{l.channels[0]?.name ?? '—'}</dd></div>
              <div><dt className="text-slate-400">Start</dt><dd className="font-medium text-slate-700">{formatUkDate(l.starts_on)}</dd></div>
              <div><dt className="text-slate-400">Expiry</dt><dd className="font-medium text-slate-700">{formatUkDate(l.expires_on)}</dd></div>
            </dl>
            <div className="mt-auto flex items-center gap-2 border-t border-slate-100 pt-2.5">
              <Avatar name={l.owner?.full_name ?? '—'} src={l.owner?.avatar_url} size={22} />
              <span className="min-w-0 flex-1 truncate text-[11px] text-slate-600">{l.owner?.full_name ?? '—'}</span>
              <span className={cn('shrink-0 text-[11px] font-semibold', d.tone)}>{d.label}</span>
              {l.risk_level && <StatusBadge status={l.risk_level} label={`${humanise(l.risk_level)} risk`} />}
            </div>
          </article>
        )
      })}
    </div>
  )
}

/**
 * Renewal calendar. Groups licences by expiry date across a 7-day window
 * anchored on today, and always renders an accessible list alongside.
 */
function RightsCalendar({ data, base }: { data: RightsPageData; base: string }) {
  const anchor = new Date()
  anchor.setHours(0, 0, 0, 0)
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(anchor)
    d.setDate(d.getDate() + i)
    return d
  })

  const byDay = new Map<string, RightsLicenseRow[]>()
  for (const l of data.licenses) {
    if (!l.expires_on) continue
    const key = l.expires_on.slice(0, 10)
    byDay.set(key, [...(byDay.get(key) ?? []), l])
  }

  return (
    <Panel title="Renewal Calendar" count={data.total}>
      <div className="grid grid-cols-7 gap-px border-y border-slate-100 bg-slate-100">
        {days.map(d => {
          const key = d.toISOString().slice(0, 10)
          const isToday = key === anchor.toISOString().slice(0, 10)
          return (
            <div key={key} className="min-h-[112px] bg-white p-2">
              <p className={cn('mb-1.5 text-center text-[11px] font-semibold',
                isToday ? 'rounded bg-blue-600 py-0.5 text-white' : 'text-slate-500')}>
                {new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', timeZone: 'Europe/London' }).format(d)}
              </p>
              <ul className="space-y-1">
                {(byDay.get(key) ?? []).map(l => (
                  <li key={l.id}>
                    <Link href={`${base}/rights?license=${l.id}`}
                      className="block truncate rounded border border-amber-200 bg-amber-50 px-1.5 py-1 text-[10px] font-medium text-amber-800 hover:bg-amber-100">
                      {l.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
      {/* Accessible equivalent — the calendar grid alone is not screen-reader friendly. */}
      <div className="px-5 py-3">
        <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">All expiries in range</h3>
        {data.licenses.filter(l => l.expires_on).length === 0
          ? <p className="text-[12px] text-slate-500">No licences expire in this period.</p>
          : (
            <ul className="divide-y divide-slate-50">
              {data.licenses.filter(l => l.expires_on).slice(0, 10).map(l => {
                const d = formatDaysLeft(l.days_remaining)
                return (
                  <li key={l.id} className="flex items-center gap-2 py-1.5">
                    <Link href={`${base}/rights?license=${l.id}`} className="min-w-0 flex-1 truncate text-[12px] font-medium text-slate-700 hover:text-blue-600">
                      {l.name}
                    </Link>
                    <span className="shrink-0 text-[11px] text-slate-500">{formatUkDate(l.expires_on)}</span>
                    <span className={cn('w-24 shrink-0 text-right text-[11px] font-medium', d.tone)}>{d.label}</span>
                  </li>
                )
              })}
            </ul>
          )}
      </div>
    </Panel>
  )
}
