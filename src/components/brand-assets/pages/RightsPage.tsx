import Link from 'next/link'
import {
  CalendarDays, ChevronLeft, ChevronRight, CircleCheck, Download, FileCheck2, Globe, Lock, PlusCircle,
  RefreshCcw, ShieldCheck, ShieldAlert, Upload, UserCheck, CalendarClock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BrandContext } from '@/lib/brand-assets/context'
import type { RightsPage as RightsPageData } from '@/lib/brand-assets/queries'
import { buildHref, chipsFor, type RawParams, type RightsFilters } from '@/lib/brand-assets/filters'
import { can } from '@/lib/brand-assets/entitlements'
import type { RightsLicenseRow } from '@/types/brand-assets'
import {
  ActionLink, EmptyPanel, KpiStrip, PageHeading, Pagination, Panel, StatusBadge, type KpiSpec,
} from '../ui/primitives'
import { FilterBar, FilterChips, FilterSelect, MoreFiltersButton, SearchField, ViewSwitcher } from '../ui/controls'
import { Avatar } from '../shell/BrandAssetsShell'
import { AssetThumb } from './OverviewPage'
import CoverageMap from '../ui/CoverageMap'
import { LicenseRowActions, UploadAgreementDialog } from '../client/RightsClient'
import { formatCount, formatDaysLeft, formatRelativeShort, formatUkDate, humanise } from '../tokens'

const STATUS_COLOUR: Record<string, string> = {
  active: '#10B981', expiring_soon: '#F59E0B', expired: '#EF4444', renewal_pending: '#8B5CF6', pending: '#8B5CF6',
  restricted: '#3B82F6', suspended: '#F43F5E', draft: '#94A3B8', cancelled: '#CBD5E1',
}

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
  const workspaceType = ctx.basePath.slice(1)
  const perms = { renew: can(e, 'brand.rights.renew'), restrict: can(e, 'brand.rights.restrict'), edit: can(e, 'brand.rights.edit') }
  const exportQs = new URLSearchParams(Object.entries(params).flatMap(([key, v]) => (typeof v === 'string' && !['view', 'page', 'anchor'].includes(key) ? [[key, v]] : [])))

  const kpis: KpiSpec[] = [
    { key: 'active', label: 'Active Licenses', value: formatCount(k.activeLicenses), icon: ShieldCheck, tone: 'blue',
      delta: k.activeDelta, deltaSuffix: 'this month', riseIsGood: true, href: buildHref(pathname, {}, { status: 'active' }), tooltip: 'Licences currently in force' },
    { key: 'expiring', label: 'Expiring Soon', value: formatCount(k.expiringSoon), icon: CalendarDays, tone: 'amber',
      delta: k.expiringIn30, deltaSuffix: 'in 30 days', riseIsGood: false, href: buildHref(pathname, {}, { status: 'expiring_soon' }), tooltip: 'Licences expiring within 90 days' },
    { key: 'restricted', label: 'Restricted Assets', value: formatCount(k.restrictedAssets), icon: Lock, tone: 'amber',
      delta: k.restrictedAttention, deltaSuffix: 'require attention', riseIsGood: false, href: `${base}/assets?rights=restricted`, tooltip: 'Assets whose rights are restricted or expired' },
    { key: 'regions', label: 'Regions Covered', value: formatCount(k.regionsCovered), icon: Globe, tone: 'purple',
      delta: k.regionsNew, deltaSuffix: 'new this month', riseIsGood: true, href: null, tooltip: 'Distinct countries covered by live licences' },
    { key: 'renewals', label: 'Pending Renewals', value: formatCount(k.pendingRenewals), icon: RefreshCcw, tone: 'amber',
      delta: k.renewalsNeedAction, deltaSuffix: 'need action', riseIsGood: false, href: buildHref(pathname, {}, { view: 'calendar' }), tooltip: 'Renewal tasks still open' },
    { key: 'compliance', label: 'Compliance Score', value: `${k.complianceScore}%`, icon: CircleCheck, tone: 'emerald',
      delta: null, deltaSuffix: '', riseIsGood: true, href: null, ring: k.complianceScore, tooltip: 'Share of licences with no open conflict' },
  ]

  const chips = chipsFor(
    {
      q: filters.q,
      territory: filters.territory ? data.territories.find(t => t.code === filters.territory)?.name : null,
      channel: filters.channel ? data.channels.find(c => c.code === filters.channel)?.name : null,
      status: filters.status ? humanise(filters.status) : null,
      owner: filters.ownerId ? data.owners.find(o => o.id === filters.ownerId)?.full_name : null,
      product: filters.productId ? data.products.find(p => p.id === filters.productId)?.name : null,
      licenseType: filters.licenseType ? humanise(filters.licenseType) : null,
    },
    { q: 'Search', territory: 'Territory', channel: 'Channel', status: 'Status', owner: 'Owner', product: 'Product', licenseType: 'Type' },
  )
  const filtered = chips.length > 0

  return (
    <>
      <PageHeading
        title="Rights"
        subtitle="Manage rights governance, license visibility, expirations, and compliant asset usage."
        actions={
          <>
            <ActionLink href={`${pathname}/new`} icon={PlusCircle}
              disabled={!can(e, 'brand.rights.create')} title={can(e, 'brand.rights.create') ? undefined : 'Your role does not permit adding licences'}>
              Add License
            </ActionLink>
            <ActionLink href={buildHref(pathname, params, { uploadAgreement: 1 })} icon={Upload} tone="primary"
              disabled={!perms.edit} title={perms.edit ? undefined : 'Your role does not permit uploading agreements'}>
              Upload Agreement
            </ActionLink>
            <ExportLink href={`${pathname}/export${exportQs.toString() ? `?${exportQs}` : ''}`} allowed={can(e, 'brand.rights.export')} />
          </>
        }
      />

      <KpiStrip items={kpis} />

      <div className="flex flex-col gap-2 xl:flex-row xl:items-stretch">
        <FilterBar className="mb-3.5 flex-1">
          <SearchField pathname={pathname} params={params} placeholder="Search rights, assets, licenses..." defaultValue={filters.q} className="w-full sm:w-[180px]" />
          <FilterSelect stacked pathname={pathname} params={params} name="territory" label="Territory" allLabel="All Territories"
            value={filters.territory} options={data.territories.map(t => ({ value: t.code, label: t.name }))} className="w-[104px]" />
          <FilterSelect stacked pathname={pathname} params={params} name="channel" label="Channel" allLabel="All Channels"
            value={filters.channel} options={data.channels.map(c => ({ value: c.code, label: c.name }))} className="w-[104px]" />
          <FilterSelect stacked pathname={pathname} params={params} name="status" label="Status" allLabel="All Statuses" value={filters.status} options={[
            { value: 'active', label: 'Active' }, { value: 'expiring_soon', label: 'Expiring Soon' }, { value: 'expired', label: 'Expired' },
            { value: 'renewal_pending', label: 'Renewal Pending' }, { value: 'restricted', label: 'Restricted' }, { value: 'suspended', label: 'Suspended' }, { value: 'draft', label: 'Draft' },
          ]} className="w-[104px]" />
          <FilterSelect stacked pathname={pathname} params={params} name="owner" label="Owner" allLabel="All Owners"
            value={filters.ownerId} options={data.owners.map(o => ({ value: o.id, label: o.full_name ?? 'Unnamed member' }))} className="w-[104px]" />
          <FilterSelect stacked pathname={pathname} params={params} name="product" label="Product" allLabel="All Products"
            value={filters.productId} options={data.products.map(p => ({ value: p.id, label: p.name }))} className="w-[104px]" />
          <MoreFiltersButton pathname={pathname} params={params} activeCount={filters.licenseType ? 1 : 0} />
        </FilterBar>
        <div className="mb-3.5 flex items-center rounded-xl border border-slate-200 bg-white p-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <ViewSwitcher solid pathname={pathname} params={params} active={filters.view}
            views={[{ value: 'table', label: 'Table' }, { value: 'calendar', label: 'Calendar' }, { value: 'cards', label: 'Cards' }]} />
        </div>
      </div>

      {params.filters && (
        <div className="-mt-1.5 mb-3.5 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
          <FilterSelect pathname={pathname} params={params} name="licenseType" label="License type" allLabel="All license types" value={filters.licenseType}
            options={['exclusive', 'standard', 'non_exclusive', 'campaign', 'royalty_free', 'design', 'trademark', 'video', 'image', 'music'].map(v => ({ value: v, label: humanise(v) }))} className="w-[170px]" />
        </div>
      )}

      <FilterChips pathname={pathname} params={params} chips={chips} />

      <div className="grid gap-3.5 xl:grid-cols-[minmax(0,1fr)_236px]">
        <div className="min-w-0">
          {data.licenses.length === 0 && filters.view !== 'calendar' ? (
            <Panel>
              <EmptyPanel icon={ShieldCheck}
                title={filtered ? 'No licences match those filters' : 'No licences recorded'}
                body={filtered ? 'Try a different search term or clear the filters to see everything.' : 'Record a licence to track territories, channels, expiry and compliant usage.'}
                action={filtered ? 'Clear filters' : (can(e, 'brand.rights.create') ? 'Add License' : undefined)}
                actionHref={filtered ? pathname : `${pathname}/new`} />
            </Panel>
          ) : filters.view === 'calendar' ? (
            <RightsCalendar data={data} pathname={pathname} params={params} />
          ) : filters.view === 'cards' ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {data.licenses.map(l => <LicenseCard key={l.id} l={l} base={base} workspaceType={workspaceType} perms={perms} />)}
            </div>
          ) : (
            <Panel>
              <div className="flex items-center gap-2 px-3.5 pb-2 pt-3.5">
                <h2 className="text-[13.5px] font-semibold tracking-tight text-slate-900 lg:text-[11px]">Rights &amp; Licensing</h2>
                <span className="rounded-full bg-slate-100 px-2 py-px text-[10px] font-medium text-slate-500">{formatCount(data.total)}</span>
              </div>
              <RightsTable licenses={data.licenses} base={base} workspaceType={workspaceType} perms={perms} />
              <Pagination page={filters.page} pageSize={filters.pageSize} total={data.total} hrefFor={patch => buildHref(pathname, params, patch)} />
            </Panel>
          )}
          {filters.view !== 'table' && data.total > filters.pageSize && filters.view !== 'calendar' && (
            <Panel className="mt-3"><Pagination page={filters.page} pageSize={filters.pageSize} total={data.total} hrefFor={patch => buildHref(pathname, params, patch)} /></Panel>
          )}
        </div>

        <div className="space-y-3.5">
          <Panel dense>
            <div className="flex items-baseline justify-between px-3.5 pb-2 pt-3">
              <h2 className="min-w-0 truncate whitespace-nowrap text-[13.5px] font-semibold tracking-tight text-slate-900 lg:text-[11px]">Expiring Licenses <span className="text-[9px] font-normal text-slate-400">(Next 90 Days)</span></h2>
              <Link href={buildHref(pathname, {}, { status: 'expiring_soon' })} className="shrink-0 whitespace-nowrap text-[11px] font-medium text-blue-600 lg:text-[9.5px]">View all</Link>
            </div>
            {data.expiring.length === 0 ? <EmptyPanel title="Nothing expiring" body="Licences expiring in the next 90 days appear here." /> : (
              <ul className="px-1.5 pb-2">
                {data.expiring.map(l => {
                  const d = formatDaysLeft(l.days_remaining)
                  return (
                    <li key={l.id}>
                      <Link href={`${pathname}/${l.id}`} className="flex items-center gap-2 rounded-lg px-1.5 py-1.5 lg:py-2 hover:bg-slate-50">
                        <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', (l.days_remaining ?? 99) <= 30 ? 'bg-rose-500' : 'bg-amber-500')} aria-hidden="true" />
                        <span className="h-7 w-7 shrink-0 overflow-hidden rounded-md bg-slate-100"><AssetThumb name={l.name} kind={l.asset?.asset_kind ?? 'image'} url={l.asset?.thumbnail_path ?? null} /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[10px] font-semibold text-slate-800">{l.name}</span>
                          <span className="block text-[9px] text-slate-400">{formatUkDate(l.expires_on)}</span>
                        </span>
                        <span className={cn('shrink-0 text-[9px] font-medium', d.tone)}>{d.label}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </Panel>

          <Panel title="High-Risk Assets" action="View all" actionHref={`${base}/assets?rights=restricted`} dense>
            {data.highRisk.length === 0 ? <EmptyPanel title="No high-risk assets" body="Detected rights conflicts appear here." /> : (
              <ul className="px-1.5 pb-2">
                {data.highRisk.map(h => (
                  <li key={h.id}>
                    <Link href={h.license_id ? `${pathname}/${h.license_id}` : h.asset_id ? `${base}/assets/${h.asset_id}?tab=rights` : pathname}
                      className="flex items-center gap-2 rounded-lg px-1.5 py-1.5 lg:py-2 hover:bg-slate-50">
                      <span className="h-7 w-7 shrink-0 overflow-hidden rounded-md bg-slate-100"><AssetThumb name={h.label} kind={h.asset_kind} url={h.thumbnail_path} /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[10px] font-semibold text-slate-800">{h.label}</span>
                        <span className="block truncate text-[9px] text-slate-400">{h.detail}</span>
                      </span>
                      <StatusBadge status={h.severity} label={humanise(h.severity)} size="xs" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      {/* ---------------- Bottom row (full width) ---------------- */}
      <div className="mt-3.5 grid gap-3.5 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr]">
        <Panel title="Rights Coverage by Region" action="View report" actionHref={buildHref(pathname, {}, { view: 'table', sort: 'expiry_asc' })} dense>
          <div className="px-3.5 pb-3">
            {Object.keys(data.isoCoverage).length === 0 && data.worldwide === 0
              ? <p className="py-6 text-center text-[10.5px] text-slate-500">Assign territories to live licences to see coverage.</p>
              : <CoverageMap iso={data.isoCoverage} worldwide={data.worldwide} />}
          </div>
        </Panel>

        <UpcomingRenewals data={data} pathname={pathname} params={params} />

        <Panel title="Status Summary" dense>
          <div className="flex items-center gap-3 px-3.5 pb-2">
            <StatusDonut rows={data.statusSummary} total={data.statusSummary.reduce((n, s) => n + s.count, 0)} />
            <ul className="min-w-0 flex-1 space-y-1.5">
              {data.statusSummary.map(s => (
                <li key={s.status}>
                  <Link href={buildHref(pathname, {}, { status: s.status })} className="flex items-center gap-1.5 text-[9.5px] hover:underline">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: STATUS_COLOUR[s.status] ?? '#94A3B8' }} aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate text-slate-600">{humanise(s.status)}</span>
                    <span className="shrink-0 tabular-nums text-slate-700">{s.count} ({s.percent}%)</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <Link href={buildHref(pathname, {}, { view: 'table', sort: 'status' })} className="block px-3.5 pb-3 text-[10px] font-medium text-blue-600 hover:underline">View full breakdown</Link>
        </Panel>

        <Panel title="Activity Feed" action="View all" actionHref={`${base}/activity?type=license`} dense>
          {data.activity.length === 0 ? <EmptyPanel title="No rights activity" body="Licence changes appear here." /> : (
            <ul className="px-1.5 pb-2">
              {data.activity.map(a => (
                <li key={a.id}>
                  <Link href={a.href ?? pathname} className="flex gap-2 rounded-lg px-2 py-1 hover:bg-slate-50">
                    <ActivityGlyph action={a.action} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[10px] font-semibold text-slate-800">{a.summary}</span>
                      <span className="block truncate text-[9px] text-slate-400">{typeof a.metadata?.detail === 'string' ? a.metadata.detail : a.actor?.full_name ?? 'System'}</span>
                    </span>
                    <span className="shrink-0 pt-0.5 text-[9px] text-slate-400">{formatRelativeShort(a.created_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <UploadAgreementDialog workspaceType={workspaceType} licences={data.licenses.map(l => ({ id: l.id, name: l.name }))} />
    </>
  )
}

// ---------------------------------------------------------------------------

type Perms = { renew: boolean; restrict: boolean; edit: boolean }

function ExportLink({ href, allowed }: { href: string; allowed: boolean }) {
  const cls = 'inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 lg:px-5 lg:text-[11px]'
  if (!allowed) return <span className={cn(cls, 'pointer-events-none opacity-50')} aria-disabled="true" title="Your role does not permit exporting the rights register"><Download size={16} />Export Rights</span>
  // A plain link: the route streams a CSV attachment, so the browser downloads it.
  return <a href={href} className={cls} download><Download size={16} />Export Rights</a>
}

function RightsTable({ licenses, base, workspaceType, perms }: { licenses: RightsLicenseRow[]; base: string; workspaceType: string; perms: Perms }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] text-left">
        <thead>
          <tr className="border-y border-slate-100 bg-slate-50/60 text-[9.5px] font-medium text-slate-500">
            {['Asset', 'License Type', 'Territory', 'Channel', 'Start Date', 'Expiry', 'Owner', 'Usage Scope', 'Status', 'Actions'].map(h => (
              <th key={h} className={cn('whitespace-nowrap px-1.5 py-1.5 font-medium', h === 'Actions' && 'text-right')}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {licenses.map(l => {
            const d = formatDaysLeft(l.days_remaining)
            return (
              <tr key={l.id} className="hover:bg-slate-50/70">
                <td className="px-1.5 py-1.5 lg:py-2">
                  <Link href={`${base}/rights/${l.id}`} className="flex min-w-0 items-center gap-2">
                    <span className="h-8 w-8 shrink-0 overflow-hidden rounded-md bg-slate-100 lg:h-9 lg:w-9"><AssetThumb name={l.name} kind={l.asset?.asset_kind ?? 'image'} url={l.asset?.thumbnail_path ?? null} /></span>
                    <span className="min-w-0">
                      <span className="block max-w-[112px] truncate text-[10.5px] font-semibold text-slate-800 lg:text-[8.5px]">{l.product?.name ?? l.name}</span>
                      <span className="block max-w-[112px] truncate text-[9.5px] text-slate-400 lg:text-[7.5px]">{l.product?.sku ?? l.reference ?? '—'}</span>
                    </span>
                  </Link>
                </td>
                <td className="max-w-[96px] truncate px-1.5 py-1.5 lg:py-2 text-[10px] text-slate-600 lg:text-[8px]">{humanise(l.license_type)} License</td>
                <td className="max-w-[84px] truncate px-1.5 py-1.5 lg:py-2 text-[10px] text-slate-600 lg:text-[8px]">{l.territories.map(t => t.name).join(', ') || '—'}</td>
                <td className="max-w-[84px] truncate px-1.5 py-1.5 lg:py-2 text-[10px] text-slate-600 lg:text-[8px]">{l.channels.map(c => c.name).join(', ') || '—'}</td>
                <td className="whitespace-nowrap px-1.5 py-1.5 lg:py-2 text-[10px] text-slate-600 lg:text-[8px]">{formatUkDate(l.starts_on)}</td>
                <td className="whitespace-nowrap px-1.5 py-1.5 lg:py-2">
                  <span className="block text-[10px] text-slate-700 lg:text-[8px]">{formatUkDate(l.expires_on)}</span>
                  <span className={cn('block text-[9.5px] font-medium lg:text-[7.5px]', d.tone)}>{d.label}</span>
                </td>
                <td className="px-1.5 py-1.5 lg:py-2">
                  <span className="flex items-center gap-1.5">
                    <Avatar name={l.owner?.full_name ?? '—'} src={l.owner?.avatar_url} size={20} />
                    <span className="max-w-[80px] truncate text-[10px] text-slate-600 lg:text-[8px]">{l.owner?.full_name ?? '—'}</span>
                  </span>
                </td>
                <td className="max-w-[84px] truncate px-1.5 py-1.5 lg:py-2 text-[10px] text-slate-600 lg:text-[8px]">{l.usage_scope ?? '—'}</td>
                <td className="px-1.5 py-1.5 lg:py-2"><StatusBadge status={l.status} size="xs" /></td>
                <td className="px-1.5 py-1.5 lg:py-2">
                  <LicenseRowActions workspaceType={workspaceType} licenseId={l.id} name={l.name} status={l.status} expiresOn={l.expires_on}
                    href={`${base}/rights/${l.id}`} canRenew={perms.renew} canRestrict={perms.restrict} canEdit={perms.edit} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function LicenseCard({ l, base, workspaceType, perms }: { l: RightsLicenseRow; base: string; workspaceType: string; perms: Perms }) {
  const d = formatDaysLeft(l.days_remaining)
  return (
    <article className="flex flex-col rounded-xl border border-slate-200 bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="mb-2.5 flex items-start gap-2.5">
        <span className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-slate-100"><AssetThumb name={l.name} kind={l.asset?.asset_kind ?? 'image'} url={l.asset?.thumbnail_path ?? null} /></span>
        <span className="min-w-0 flex-1">
          <Link href={`${base}/rights/${l.id}`} className="block truncate text-[12.5px] font-semibold text-slate-900 hover:text-blue-600">{l.name}</Link>
          <span className="block truncate text-[10.5px] text-slate-400">{humanise(l.license_type)} · {l.reference ?? '—'}</span>
        </span>
        <StatusBadge status={l.status} size="xs" />
      </div>
      <dl className="mb-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10.5px]">
        <div><dt className="text-slate-400">Territory</dt><dd className="truncate font-medium text-slate-700">{l.territories.map(t => t.name).join(', ') || '—'}</dd></div>
        <div><dt className="text-slate-400">Channel</dt><dd className="truncate font-medium text-slate-700">{l.channels.map(c => c.name).join(', ') || '—'}</dd></div>
        <div><dt className="text-slate-400">Start</dt><dd className="font-medium text-slate-700">{formatUkDate(l.starts_on)}</dd></div>
        <div><dt className="text-slate-400">Expiry</dt><dd className="font-medium text-slate-700">{formatUkDate(l.expires_on)}</dd></div>
      </dl>
      <div className="mt-auto flex items-center gap-2 border-t border-slate-100 pt-2.5">
        <Avatar name={l.owner?.full_name ?? '—'} src={l.owner?.avatar_url} size={22} />
        <span className="min-w-0 flex-1 truncate text-[10.5px] text-slate-600">{l.owner?.full_name ?? '—'}</span>
        <span className={cn('shrink-0 text-[10.5px] font-semibold', d.tone)}>{d.label}</span>
        {l.risk_level && <StatusBadge status={l.risk_level} label={`${humanise(l.risk_level)} risk`} size="xs" />}
        <LicenseRowActions workspaceType={workspaceType} licenseId={l.id} name={l.name} status={l.status} expiresOn={l.expires_on}
          href={`${base}/rights/${l.id}`} canRenew={perms.renew} canRestrict={perms.restrict} canEdit={perms.edit} />
      </div>
    </article>
  )
}

const DAY = 86_400_000
const shortDate = (d: Date) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(d)
const iso = (d: Date) => d.toISOString().slice(0, 10)

function UpcomingRenewals({ data, pathname, params }: { data: RightsPageData; pathname: string; params: RawParams }) {
  const start = new Date(`${data.weekStart}T00:00:00Z`)
  const days = Array.from({ length: 7 }, (_, i) => new Date(start.getTime() + i * DAY))
  const today = iso(new Date())
  const tone = ['border-blue-200 bg-blue-50 text-blue-800', 'border-rose-200 bg-rose-50 text-rose-700', 'border-emerald-200 bg-emerald-50 text-emerald-700']
  return (
    <Panel dense>
      <div className="px-3.5 pb-1.5 pt-3"><h2 className="text-[13.5px] font-semibold tracking-tight text-slate-900 lg:text-[11px]">Upcoming Renewals</h2></div>
      <div className="flex items-center justify-between px-3.5 pb-2">
        <span className="text-[11px] font-medium text-slate-700">{shortDate(days[0])} – {shortDate(days[6])} {days[6].getUTCFullYear()}</span>
        <span className="flex items-center gap-1">
          <Link href={buildHref(pathname, params, { anchor: null })} className="rounded-md border border-slate-200 px-2 py-0.5 text-[9.5px] text-slate-600 hover:bg-slate-50">Today</Link>
          <Link href={buildHref(pathname, params, { anchor: iso(new Date(start.getTime() - 7 * DAY)) })} aria-label="Previous week" className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50"><ChevronLeft size={11} /></Link>
          <Link href={buildHref(pathname, params, { anchor: iso(new Date(start.getTime() + 7 * DAY)) })} aria-label="Next week" className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50"><ChevronRight size={11} /></Link>
        </span>
      </div>
      <div className="mx-3.5 grid grid-cols-7 overflow-hidden rounded-md border border-slate-100 text-center">
        {days.map(d => (
          <span key={iso(d)} className={cn('py-1 text-[8.5px]', iso(d) === today ? 'bg-blue-600 font-semibold text-white' : 'text-slate-500')}>
            {new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', timeZone: 'UTC' }).format(d)}
          </span>
        ))}
      </div>
      <ul className="space-y-1.5 px-3.5 py-2">
        {data.renewals.length === 0 ? <li className="py-3 text-center text-[10px] text-slate-500">No renewals due from this week.</li> : data.renewals.map((r, i) => (
          <li key={r.id}>
            <Link href={`${pathname}/${r.license_id}`} className={cn('flex items-center justify-between gap-2 rounded-md border px-1.5 py-1.5 lg:py-2 text-[9.5px] hover:brightness-95', tone[i % tone.length])}>
              <span className="truncate font-medium">{r.name}</span>
              <span className="shrink-0 opacity-80">Due {formatUkDate(r.due_on)}</span>
            </Link>
          </li>
        ))}
      </ul>
      <Link href={buildHref(pathname, params, { view: 'calendar' })} className="block px-3.5 pb-3 text-[10px] font-medium text-blue-600 hover:underline">View calendar</Link>
    </Panel>
  )
}

function StatusDonut({ rows, total }: { rows: { status: string; count: number }[]; total: number }) {
  const r = 44, c = 2 * Math.PI * r
  let offset = 0
  return (
    <div className="relative shrink-0">
      <svg width="116" height="116" viewBox="0 0 116 116" className="-rotate-90" role="img"
        aria-label={`${total} licences: ${rows.map(s => `${humanise(s.status)} ${s.count}`).join(', ')}`}>
        <circle cx="58" cy="58" r={r} fill="none" stroke="#E2E8F0" strokeWidth="17" />
        {rows.map(s => {
          const len = total ? (s.count / total) * c : 0
          const el = <circle key={s.status} cx="58" cy="58" r={r} fill="none" stroke={STATUS_COLOUR[s.status] ?? '#94A3B8'} strokeWidth="17"
            strokeDasharray={`${len} ${c}`} strokeDashoffset={-offset} />
          offset += len
          return el
        })}
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[10px] text-slate-500">Total</span>
        <span className="text-[19px] font-bold leading-none text-slate-900">{formatCount(total)}</span>
      </span>
    </div>
  )
}

function ActivityGlyph({ action }: { action: string }) {
  const m: Record<string, [React.ComponentType<{ size?: number }>, string]> = {
    renewed: [RefreshCcw, 'bg-blue-50 text-blue-600'], uploaded: [FileCheck2, 'bg-emerald-50 text-emerald-600'],
    restricted: [Lock, 'bg-rose-50 text-rose-600'], suspended: [ShieldAlert, 'bg-rose-50 text-rose-600'],
    created: [PlusCircle, 'bg-violet-50 text-violet-600'], exported: [Download, 'bg-slate-100 text-slate-500'],
    assigned: [UserCheck, 'bg-indigo-50 text-indigo-600'],
  }
  const [Icon, wash] = m[action] ?? [CalendarClock, 'bg-rose-50 text-rose-600']
  return <span className={cn('mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full', wash)} aria-hidden="true"><Icon size={12} /></span>
}

/** Month calendar of starts, renewals and expiries, with an accessible agenda below. */
function RightsCalendar({ data, pathname, params }: { data: RightsPageData; pathname: string; params: RawParams }) {
  const anchor = typeof params.anchor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(params.anchor) ? new Date(`${params.anchor}T00:00:00Z`) : new Date()
  const first = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1))
  const lead = (first.getUTCDay() + 6) % 7
  const daysInMonth = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0)).getUTCDate()
  const cells = Array.from({ length: Math.ceil((lead + daysInMonth) / 7) * 7 }, (_, i) => i - lead + 1)
  const byDay = new Map<number, RightsPageData['calendar']>()
  for (const ev of data.calendar) {
    const day = Number(ev.date.slice(8, 10))
    byDay.set(day, [...(byDay.get(day) ?? []), ev])
  }
  const month = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(first)
  const prev = iso(new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() - 1, 1)))
  const next = iso(new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 1)))
  const today = new Date()
  const KIND = { start: 'border-emerald-200 bg-emerald-50 text-emerald-800', renewal: 'border-violet-200 bg-violet-50 text-violet-800', expiry: 'border-amber-200 bg-amber-50 text-amber-800' }
  return (
    <Panel>
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 pb-2 pt-3.5">
        <h2 className="text-[13.5px] font-semibold tracking-tight text-slate-900 lg:text-[11px]">Renewal Calendar · {month}</h2>
        <span className="flex items-center gap-1">
          <Link href={buildHref(pathname, params, { anchor: null })} className="rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50">Today</Link>
          <Link href={buildHref(pathname, params, { anchor: prev })} aria-label="Previous month" className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50"><ChevronLeft size={14} /></Link>
          <Link href={buildHref(pathname, params, { anchor: next })} aria-label="Next month" className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50"><ChevronRight size={14} /></Link>
        </span>
      </div>
      <div className="hidden grid-cols-7 border-y border-slate-100 bg-slate-50/60 text-center text-[10px] font-medium text-slate-500 sm:grid">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <span key={d} className="py-1.5">{d}</span>)}
      </div>
      <div className="hidden grid-cols-7 gap-px bg-slate-100 sm:grid" aria-hidden="true">
        {cells.map((d, i) => {
          const isToday = d === today.getUTCDate() && first.getUTCMonth() === today.getUTCMonth() && first.getUTCFullYear() === today.getUTCFullYear()
          return (
            <div key={i} className={cn('min-h-[86px] bg-white p-1.5', (d < 1 || d > daysInMonth) && 'bg-slate-50/70')}>
              {d >= 1 && d <= daysInMonth && <>
                <span className={cn('mb-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px]', isToday ? 'bg-blue-600 font-semibold text-white' : 'text-slate-500')}>{d}</span>
                <ul className="space-y-0.5">
                  {(byDay.get(d) ?? []).slice(0, 3).map(ev => (
                    <li key={`${ev.id}-${ev.kind}`}>
                      <Link href={`${pathname}/${ev.id}`} className={cn('block truncate rounded border px-1 py-0.5 text-[9px] font-medium', KIND[ev.kind])}>
                        {ev.kind === 'expiry' ? 'Expires' : ev.kind === 'renewal' ? 'Renew' : 'Starts'}: {ev.name}
                      </Link>
                    </li>
                  ))}
                  {(byDay.get(d)?.length ?? 0) > 3 && <li className="text-[9px] text-slate-400">+{(byDay.get(d)!.length) - 3} more</li>}
                </ul>
              </>}
            </div>
          )
        })}
      </div>
      <div className="px-3.5 py-3">
        <h3 className="mb-1.5 text-[11px] font-semibold text-slate-500">Agenda — {month}</h3>
        {data.calendar.length === 0 ? <p className="text-[12px] text-slate-500">No licence starts, renewals or expiries this month.</p> : (
          <ul className="divide-y divide-slate-100">
            {data.calendar.map(ev => (
              <li key={`${ev.id}-${ev.kind}-agenda`} className="flex items-center gap-2 py-1.5">
                <span className="w-24 shrink-0 text-[11px] text-slate-500">{formatUkDate(ev.date)}</span>
                <span className={cn('shrink-0 rounded border px-1.5 py-px text-[9.5px] font-medium', KIND[ev.kind])}>{ev.kind === 'expiry' ? 'Expiry' : ev.kind === 'renewal' ? 'Renewal due' : 'Start'}</span>
                <Link href={`${pathname}/${ev.id}`} className="min-w-0 flex-1 truncate text-[12px] font-medium text-slate-700 hover:text-blue-600">{ev.name}</Link>
                <StatusBadge status={ev.status} size="xs" />
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  )
}
