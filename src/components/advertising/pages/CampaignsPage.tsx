import Link from 'next/link'
import type { ReactNode } from 'react'
import {
  AlertTriangle, ArrowRight, BarChart3, CircleDollarSign, Crosshair, Gauge, Info, MousePointerClick,
  Pencil, Plus, Rocket, ShoppingCart, Sparkles, Target, TrendingUp, WalletCards,
} from 'lucide-react'
import type { AdvertisingSession } from '@/lib/advertising/queries/context'
import { comparisonRange, kpi, pageParam, pageSizeParam, resolveRange } from '@/lib/advertising/queries/shared'
import {
  getCampaignInsights, getCampaignKpis, getCampaignOwners, getCampaignsByStatus, getCampaignsPage, getRecentOptimisations,
  PERFORMANCE_TIERS, type CampaignFilters, type CampaignListRow,
} from '@/lib/advertising/queries/campaigns'
import { getBudgetPacing, getRecentAlerts, providerLabel } from '@/lib/advertising/queries/overview'
import {
  formatCurrency, formatDateRange, formatNumber, formatPercent, formatRelativeTime, formatRoas,
} from '@/lib/advertising/metrics'
import { AD_PROVIDER_IDS } from '@/lib/advertising/providers'
import PageHeader, { HeaderActionButton } from '../PageHeader'
import KpiCard from '../KpiCard'
import ProviderLogo from '../ProviderLogo'
import StatusPill, { CAMPAIGN_STATUS, OBJECTIVE_LABELS } from '../StatusPill'
import { Pagination, SearchInput, SortSelect, ViewSwitcher } from '../Controls'
import { DateRangeButton, FiltersPopover, InlineLabelSelect, ChipSelect } from '../MiniControls'
import { EmptyState, InfoDot, Panel } from '../Primitives'
import ExportSplit from '../ExportSplit'
import CampaignTable, { type CampaignTableRow } from '../client/CampaignTable'
import CreateCampaign from '../client/CreateCampaign'

// /{type}/advertising/campaigns — built to design reference (3).
// Header + actions, six KPI cards, the filter/view panel with the campaign
// table (or cards / board), then Campaigns by Status beside Campaign Insights,
// Budget Pacing, Recent Optimizations and Alerts.

type SearchParams = Record<string, string | string[] | undefined>
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? null

const BOARD_LANES = [
  { status: 'draft', label: 'Draft', tone: 'bg-slate-50 border-slate-200', badge: 'bg-slate-200/70 text-slate-600' },
  { status: 'active', label: 'Active', tone: 'bg-emerald-50/60 border-emerald-100', badge: 'bg-emerald-100 text-emerald-700' },
  { status: 'learning', label: 'Learning', tone: 'bg-orange-50/60 border-orange-100', badge: 'bg-orange-100 text-orange-700' },
  { status: 'paused', label: 'Paused', tone: 'bg-slate-50 border-slate-200', badge: 'bg-slate-200/70 text-slate-600' },
  { status: 'completed', label: 'Completed', tone: 'bg-blue-50/60 border-blue-100', badge: 'bg-blue-100 text-blue-700' },
] as const

const wholePounds = (value: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(value)
const pacingColour = (pct: number) => pct >= 85 ? 'bg-red-500' : pct >= 75 ? 'bg-orange-400' : 'bg-emerald-500'
const initials = (name: string | null) => name ? name.split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase() : '—'

function PanelTitle({ title, hint, href, label = 'View all' }: { title: string; hint?: string; href?: string; label?: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h2 className="flex min-w-0 items-center gap-1.5 text-[13.5px] font-semibold text-slate-900"><span className="truncate">{title}</span>{hint && <InfoDot label={hint} />}</h2>
      {href && <Link href={href} className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-[11.5px] font-medium text-blue-600 hover:underline">{label} <ArrowRight size={12} aria-hidden /></Link>}
    </div>
  )
}

function BoardCard({ row, base }: { row: CampaignListRow; base: string }) {
  return (
    <Link href={`${base}/campaigns/${row.id}`} title={row.name} className="block rounded-lg border border-slate-200/80 bg-white p-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-slate-300">
      <p className="flex items-center gap-1.5 text-[11px] font-medium leading-4 text-slate-800"><ProviderLogo provider={row.provider} size={12} decorative /><span className="truncate">{row.name}</span></p>
      <p className="mt-0.5 truncate text-[10px] text-slate-500">
        {row.status === 'draft' ? `Created ${new Date(row.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : `${formatCurrency(row.spend)} spend`}
      </p>
      <div className="mt-2 flex items-center justify-between">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[8.5px] font-semibold text-slate-600" title={row.ownerName ?? undefined} aria-hidden>{initials(row.ownerName)}</span>
        <span className="rounded border border-slate-200 px-1.5 py-0.5 text-[10.5px] text-slate-600">
          {row.status === 'draft' ? (row.budget !== null ? wholePounds(row.budget) : '—') : `ROAS ${formatRoas(row.roas)}`}
        </span>
      </div>
    </Link>
  )
}

function Board({ buckets, base, perLane, canCreate }: { buckets: Record<string, CampaignListRow[]>; base: string; perLane?: number; canCreate: boolean }) {
  return (
    <div className="overflow-x-auto">
      {/* The compact (per-lane) summary fits its narrower panel; the full board keeps roomier lanes. */}
      <div className={`grid grid-cols-5 ${perLane ? 'min-w-[600px] gap-2' : 'min-w-[760px] gap-2.5'}`}>
        {BOARD_LANES.map(lane => {
          const items = buckets[lane.status] ?? []
          return (
            <section key={lane.status} className={`flex flex-col rounded-xl border p-2 ${lane.tone}`} aria-label={`${lane.label} campaigns`}>
              <header className="mb-2 flex items-center justify-between px-1">
                <h3 className="text-[12px] font-semibold text-slate-700">{lane.label}</h3>
                <span className={`rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold ${lane.badge}`}>{items.length}</span>
              </header>
              <div className="space-y-2">
                {(perLane ? items.slice(0, perLane) : items).map(row => <BoardCard key={row.id} row={row} base={base} />)}
                {items.length === 0 && <p className="rounded-lg border border-dashed border-slate-200 bg-white/60 px-2 py-4 text-center text-[11px] text-slate-400">No campaigns</p>}
                {perLane && items.length > perLane && (
                  <Link href={`?view=board`} className="block text-center text-[11px] font-medium text-blue-600 hover:underline">+{items.length - perLane} more</Link>
                )}
              </div>
              {lane.status === 'draft' && canCreate && (
                <Link href="?create=1" className="mt-auto flex items-center justify-center gap-1 pt-3 text-[11.5px] font-medium text-slate-500 hover:text-blue-700">
                  <Plus size={12} aria-hidden /> Add Campaign
                </Link>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}

export default async function CampaignsPage({
  session, searchParams, nav,
}: { session: AdvertisingSession; searchParams: SearchParams; nav?: ReactNode }) {
  const range = resolveRange({ preset: first(searchParams.range) })
  const compare = comparisonRange(range, first(searchParams.compare))
  const base = session.basePath
  const workspaceId = session.workspace.id
  const view = ['cards', 'board'].includes(first(searchParams.view) ?? '') ? first(searchParams.view)! : 'table'

  const filters: CampaignFilters = {
    q: first(searchParams.q), platform: first(searchParams.platform), objective: first(searchParams.objective),
    status: first(searchParams.status), owner: first(searchParams.owner), performance: first(searchParams.performance),
    sort: first(searchParams.sort), page: pageParam(searchParams), pageSize: pageSizeParam(searchParams, 8),
  }
  const boardFilters = { q: filters.q, platform: filters.platform, objective: filters.objective, owner: filters.owner, performance: filters.performance }

  const [list, boardBuckets, kpis, insights, pacing, optimisations, alerts, owners, accountRows] = await Promise.all([
    view === 'board' ? Promise.resolve({ rows: [] as CampaignListRow[], total: 0 }) : getCampaignsPage(session.supabase, workspaceId, range, filters),
    getCampaignsByStatus(session.supabase, workspaceId, range, boardFilters),
    getCampaignKpis(session.supabase, workspaceId, range, compare, filters.platform ? [filters.platform] : []),
    getCampaignInsights(session.supabase, workspaceId, range, compare),
    getBudgetPacing(session.supabase, workspaceId, range, 5),
    getRecentOptimisations(session.supabase, workspaceId, 3),
    getRecentAlerts(session.supabase, workspaceId, 3),
    getCampaignOwners(session.supabase, workspaceId),
    session.supabase.from('ad_accounts').select('id, name, provider').eq('workspace_id', workspaceId).order('name'),
  ])

  const canCreate = session.capabilities['campaigns.create']
  const canBulkEdit = session.capabilities['campaigns.bulk_edit']
  const canPause = session.capabilities['campaigns.pause']
  const canExport = session.capabilities['campaigns.export']
  const rangeLabel = formatDateRange(new Date(`${range.since}T00:00:00Z`), new Date(`${range.until}T00:00:00Z`))
  const compareLabel = formatDateRange(new Date(`${compare.since}T00:00:00Z`), new Date(`${compare.until}T00:00:00Z`))
  const activeFilterCount = [filters.q, filters.platform, filters.objective, filters.status, filters.owner, filters.performance].filter(Boolean).length
  const exportHref = `/api/advertising/export?workspaceType=${session.workspaceType}&range=${first(searchParams.range) ?? 'last_30'}${filters.platform ? `&platform=${filters.platform}` : ''}`

  const cards = [
    { value: kpi({ id: 'spend', label: 'Total Spend', format: 'currency', current: kpis.current.spend, previous: kpis.previous.spend, spark: kpis.series.spend, tooltip: 'Spend across campaigns in the selected range.' }), icon: <CircleDollarSign />, accent: '#2563EB' },
    { value: kpi({ id: 'active', label: 'Active Campaigns', format: 'integer', current: kpis.activeCount, previous: kpis.previousActiveCount, spark: kpis.series.active, tooltip: 'Campaigns currently live or learning.' }), icon: <Rocket />, accent: '#7C3AED' },
    { value: kpi({ id: 'roas', label: 'ROAS (All)', format: 'roas', current: kpis.current.roas, previous: kpis.previous.roas, spark: kpis.series.roas, tooltip: 'Attributed revenue divided by spend.' }), icon: <TrendingUp />, accent: '#7C3AED' },
    { value: kpi({ id: 'ctr', label: 'CTR (All)', format: 'percent', current: kpis.current.ctr, previous: kpis.previous.ctr, spark: kpis.series.ctr, tooltip: 'Clicks divided by impressions.' }), icon: <MousePointerClick />, accent: '#0D9488' },
    { value: kpi({ id: 'conversions', label: 'Conversions', format: 'integer', current: kpis.current.conversions, previous: kpis.previous.conversions, spark: kpis.series.conversions, tooltip: 'Attributed conversions.' }), icon: <ShoppingCart />, accent: '#EA580C' },
    { value: kpi({ id: 'util', label: 'Budget Utilisation', format: 'percent', current: kpis.budgetUtilisation, previous: kpis.previousBudgetUtilisation, spark: kpis.series.utilisation, tooltip: 'Spend on budgeted campaigns divided by their total budget.' }), icon: <WalletCards />, accent: '#2563EB' },
  ]

  const tableRows: CampaignTableRow[] = list.rows.map(row => ({
    id: row.id, name: row.name, provider: row.provider, objective: row.objective, status: row.status,
    spend: formatCurrency(row.spend), budget: row.budget !== null ? wholePounds(row.budget) : '—',
    roas: formatRoas(row.roas), ctr: formatPercent(row.ctr), conversions: formatNumber(row.conversions), ownerName: row.ownerName,
  }))

  const viewSwitcher = (
    <ViewSwitcher defaultView="table" views={[
      { value: 'table', label: 'Table', icon: 'table' },
      { value: 'cards', label: 'Cards', icon: 'cards' },
      { value: 'board', label: 'Board', icon: 'board' },
    ]} />
  )
  const sortSelect = (
    <SortSelect defaultValue="updated_desc" className="w-44" options={[
      { value: 'updated_desc', label: 'Last updated' }, { value: 'spend_desc', label: 'Spend high–low' },
      { value: 'roas_desc', label: 'ROAS high–low' }, { value: 'conversions_desc', label: 'Conversions' },
      { value: 'budget_desc', label: 'Budget high–low' }, { value: 'name_asc', label: 'Name A–Z' },
    ]} />
  )
  const pager = <Pagination page={filters.page} pageSize={filters.pageSize} total={list.total} itemLabel="campaigns" />
  const noResults = <div className="px-4 pb-4"><EmptyState title="No campaigns match these filters" description="Clear a filter, widen the date range, or create a campaign." /></div>

  const insightIcon: Record<string, ReactNode> = {
    top: <Sparkles size={15} className="text-blue-500" />, platform: <Target size={15} className="text-emerald-500" />,
    objective: <Crosshair size={15} className="text-orange-500" />, growth: <BarChart3 size={15} className="text-slate-500" />,
  }

  return (
    <div>
      <PageHeader
        title="Advertising Campaigns" hint="Search, filter and manage campaigns across every connected platform."
        subtitle="Manage, optimize, and analyze your advertising campaigns across all platforms."
        nav={nav}
      >
        <CreateCampaign
          workspaceId={workspaceId} workspaceType={session.workspaceType} basePath={base}
          accounts={(accountRows.data ?? []).map(row => ({ id: row.id as string, name: row.name as string, providerName: providerLabel(row.provider as string) }))}
          disabledReason={canCreate ? null : 'No connected platform supports creating campaigns, or your role cannot create them.'}
        />
        <HeaderActionButton action={{ key: 'bulk', label: 'Bulk Edit', icon: <Pencil size={14} />, href: '?bulk=1', disabledReason: canBulkEdit ? null : 'Your role cannot bulk edit campaigns.' }} />
        {canExport && <ExportSplit href={exportHref} primary="campaigns" />}
      </PageHeader>

      <section className="mb-2 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6" aria-label="Campaign metrics">
        {cards.map(card => <KpiCard key={card.value.id} kpi={card.value} icon={card.icon} accent={card.accent} comparisonLabel={compareLabel} />)}
      </section>

      <Panel padded={false} className="mb-2">
        <div className="flex flex-wrap items-center gap-2 px-4 pb-3 pt-4">
          <SearchInput placeholder="Search campaigns..." className="w-full sm:w-[170px]" ariaLabel="Search campaigns by name" />
          <InlineLabelSelect paramKey="platform" label="Platform" options={AD_PROVIDER_IDS.map(id => ({ value: id, label: providerLabel(id) }))} className="w-[116px]" />
          <InlineLabelSelect paramKey="objective" label="Objective" options={Object.entries(OBJECTIVE_LABELS).map(([value, label]) => ({ value, label }))} className="w-[122px]" />
          <InlineLabelSelect paramKey="status" label="Status" options={Object.entries(CAMPAIGN_STATUS).map(([value, entry]) => ({ value, label: entry.label }))} className="w-[104px]" />
          <InlineLabelSelect paramKey="owner" label="Owner" options={owners.map(owner => ({ value: owner.id, label: owner.name }))} className="w-[112px]" />
          <DateRangeButton label={rangeLabel} className="min-w-[160px]" />
          <InlineLabelSelect paramKey="performance" label="Performance" options={PERFORMANCE_TIERS.map(tier => ({ value: tier.value, label: tier.label }))} className="w-[130px]" />
          <div className="ml-auto">
            <FiltersPopover activeCount={activeFilterCount}>
              <p className="text-[11.5px] text-slate-500">{activeFilterCount === 0 ? 'No filters applied.' : `${activeFilterCount} filter${activeFilterCount === 1 ? '' : 's'} applied.`}</p>
              <label className="block text-[11.5px] font-medium text-slate-500">Compare to</label>
              <ChipSelect paramKey="compare" label="Compare to" allLabel="Previous period" options={[{ value: 'year', label: 'Same period last year' }]} className="w-full [&>span]:w-full [&>span]:justify-between" />
            </FiltersPopover>
          </div>
        </div>

        {view === 'table' ? (
          tableRows.length === 0 ? (<><div className="flex items-center justify-between gap-2 px-4 pb-3">{viewSwitcher}{sortSelect}</div>{noResults}</>) : (
            <CampaignTable
              rows={tableRows} basePath={base} workspaceId={workspaceId} workspaceType={session.workspaceType}
              canPause={canPause} canBulkEdit={canBulkEdit} toolbarLeft={viewSwitcher} toolbarRight={sortSelect} footer={pager}
            />
          )
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-3">{viewSwitcher}{view === 'cards' && sortSelect}</div>
            {view === 'board' ? (
              <div className="px-4 pb-4"><Board buckets={boardBuckets} base={base} canCreate={canCreate} /></div>
            ) : list.rows.length === 0 ? noResults : (
              <>
                <div className="grid gap-3 px-4 pb-2 sm:grid-cols-2 xl:grid-cols-4">
                  {list.rows.map(row => (
                    <Link key={row.id} href={`${base}/campaigns/${row.id}`} className="rounded-xl border border-slate-200 bg-white p-3.5 hover:border-slate-300 hover:shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <p className="flex min-w-0 items-center gap-2 text-[13px] font-semibold text-slate-900"><ProviderLogo provider={row.provider} size={16} decorative /><span className="truncate">{row.name}</span></p>
                        <StatusPill status={row.status} map={CAMPAIGN_STATUS} dot={false} className="rounded-md px-2 text-[10.5px]" />
                      </div>
                      <p className="mt-1 text-[11.5px] text-slate-500">{OBJECTIVE_LABELS[row.objective] ?? row.objective} · {row.ownerName ?? 'Unassigned'}</p>
                      <div className="mt-3 grid grid-cols-2 gap-y-2 text-[11.5px]">
                        <div><p className="text-slate-400">Spend</p><p className="font-semibold tabular-nums text-slate-800">{formatCurrency(row.spend)}</p></div>
                        <div><p className="text-slate-400">Budget</p><p className="font-semibold tabular-nums text-slate-800">{row.budget !== null ? wholePounds(row.budget) : '—'}</p></div>
                        <div><p className="text-slate-400">ROAS</p><p className="font-semibold tabular-nums text-slate-800">{formatRoas(row.roas)}</p></div>
                        <div><p className="text-slate-400">CTR</p><p className="font-semibold tabular-nums text-slate-800">{formatPercent(row.ctr)}</p></div>
                      </div>
                      {row.budgetUtilisationPct !== null && (
                        <div className="mt-3">
                          <div className="flex justify-between text-[10.5px] text-slate-500"><span>Budget used</span><span>{Math.round(row.budgetUtilisationPct)}%</span></div>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${pacingColour(row.budgetUtilisationPct)}`} style={{ width: `${Math.min(100, row.budgetUtilisationPct)}%` }} /></div>
                        </div>
                      )}
                    </Link>
                  ))}
                </div>
                {pager}
              </>
            )}
          </>
        )}
      </Panel>

      <div className="grid gap-2 xl:grid-cols-[minmax(0,1.75fr)_minmax(0,0.62fr)_minmax(0,0.78fr)]">
        <Panel className="xl:row-span-2">
          <PanelTitle title="Campaigns by Status" hint="Every campaign grouped by lifecycle stage." />
          <div className="mt-3"><Board buckets={boardBuckets} base={base} perLane={2} canCreate={canCreate} /></div>
          <Link href="?view=board" className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-blue-600 hover:underline">View all campaigns in board view <ArrowRight size={12} aria-hidden /></Link>
        </Panel>

        <Panel>
          <PanelTitle title="Campaign Insights" href={`${base}/reports`} label="View full report" />
          {insights.length === 0 ? <EmptyState compact title="Not enough data yet" description="Insights appear once live campaigns have spend." className="mt-3" /> : (
            <ul className="mt-3 space-y-3">
              {insights.map(insight => {
                const body = (
                  <>
                    <span className="mt-0.5 shrink-0" aria-hidden>{insightIcon[insight.key] ?? <Info size={15} />}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[10.5px] text-slate-500">{insight.label}</span>
                      <span className="block truncate text-[12.5px] font-medium text-slate-800">{insight.value}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-[12.5px] font-semibold text-emerald-600">{insight.metric}</span>
                      {insight.sub && <span className="block text-[10px] text-slate-400">{insight.sub}</span>}
                    </span>
                  </>
                )
                return <li key={insight.key}>{insight.href ? <Link href={`${base}/${insight.href}`} className="-mx-1.5 flex gap-2.5 rounded-md px-1.5 py-0.5 hover:bg-slate-50">{body}</Link> : <div className="flex gap-2.5">{body}</div>}</li>
              })}
            </ul>
          )}
        </Panel>

        <Panel>
          <PanelTitle title="Budget Pacing" href={`${base}/campaigns?sort=budget_desc`} />
          {pacing.length === 0 ? <EmptyState compact title="No active budgets" description="Budgeted live campaigns show pacing here." className="mt-3" /> : (
            <ul className="mt-3 space-y-2.5">
              {pacing.map(row => (
                <li key={row.id}>
                  <Link href={`${base}/campaigns/${row.id}`} className="grid grid-cols-[minmax(0,1fr)_minmax(0,108px)_30px] items-center gap-2 text-[11px] hover:text-blue-700">
                    <span className="truncate text-slate-700">{row.name}</span>
                    <span className="min-w-0">
                      <span className="block truncate tabular-nums text-slate-600">{wholePounds(row.spend)} / {wholePounds(row.budget)}</span>
                      <span className="mt-1 block h-1 overflow-hidden rounded-full bg-slate-100"><span className={`block h-full rounded-full ${pacingColour(row.pct)}`} style={{ width: `${Math.min(100, row.pct)}%` }} /></span>
                    </span>
                    <span className="text-right tabular-nums text-slate-700">{Math.round(row.pct)}%</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel>
          <PanelTitle title="Recent Optimizations" href={base} />
          {optimisations.length === 0 ? <EmptyState compact title="No changes yet" description="Budget, status and creative changes appear here." className="mt-3" /> : (
            <ul className="mt-3 space-y-3">
              {optimisations.map(entry => (
                <li key={entry.id}>
                  <Link href={entry.entityId ? `${base}/campaigns/${entry.entityId}` : base} className="-mx-1.5 flex gap-2.5 rounded-md px-1.5 py-0.5 hover:bg-slate-50">
                    <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white ${entry.eventType.includes('paused') ? 'bg-red-500' : entry.eventType.includes('budget') ? 'bg-blue-600' : 'bg-slate-500'}`} aria-hidden>
                      {entry.eventType.includes('paused') ? <AlertTriangle size={11} /> : <Gauge size={11} />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[11.5px] text-slate-700">{entry.summary}</span>
                      <span className="block text-[10.5px] text-slate-400">{new Date(entry.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}{entry.actor ? ` · ${entry.actor}` : ''}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel>
          <PanelTitle title="Alerts" href={`${base}/accounts?tab=attention`} />
          {alerts.length === 0 ? <EmptyState compact title="No open alerts" description="Budget, sync and creative alerts appear here." className="mt-3" /> : (
            <ul className="mt-3 space-y-3">
              {alerts.map(alert => (
                <li key={alert.id} className="flex gap-2.5">
                  <AlertTriangle size={15} className={`mt-0.5 shrink-0 ${alert.severity === 'critical' ? 'text-red-500' : alert.severity === 'warning' ? 'text-amber-500' : 'text-blue-500'}`} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-medium text-slate-800">{alert.title}</p>
                    {alert.detail && <p className="mt-0.5 line-clamp-2 text-[10.5px] text-slate-500">{alert.detail}</p>}
                  </div>
                  <span className="shrink-0 text-[10.5px] text-slate-400">{formatRelativeTime(alert.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  )
}
