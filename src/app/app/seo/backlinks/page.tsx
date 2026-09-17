import Link from 'next/link'
import { AlertTriangle, ExternalLink, Info, LayoutGrid, Lightbulb, Minus, Plus, Table as TableIcon } from 'lucide-react'
import { requireSeoTab } from '@/lib/seo/server'
import {
  getActivity, getBacklinks, getLinkOpportunities, getOutreachLists, getSiteDailyWithCompare, getTopLinkedPages,
} from '@/lib/seo/queries'
import { buildKpis } from '@/lib/seo/kpis'
import { matchPreset, bucketSeries } from '@/lib/seo/range'
import { formatCompact, formatDate, humanise, relativeTime } from '@/lib/seo/format'
import { availableSeoViews } from '@/lib/seo/entitlements'
import { buildExportHref, readEnum, readNumber, readParam, type SearchParams } from '@/lib/seo/url-state'
import { SEO_TOKENS, Card, CardHeader, DemoBadge, EmptyPanel, StatusChip } from '@/components/seo/primitives'
import { KpiStrip } from '@/components/seo/KpiStrip'
import { SeoHeader } from '@/components/seo/SeoHeader'
import { SeoPageChrome } from '@/components/seo/SeoPageChrome'
import { ActivityFeed } from '@/components/seo/ActivityFeed'
import { Pagination, SearchBox, ViewSwitcher } from '@/components/seo/FilterBar'
import { ChartLegend, GroupedBars, TrendChart } from '@/components/seo/charts'
import { PanelSelect } from '@/components/seo/PanelControls'
import { AddOutreachListWizard } from '@/components/seo/wizards/AddOutreachListWizard'
import { AddToListButton } from '@/components/seo/wizards/AddToListButton'
import { DomainLogo } from '@/components/brand/BrandLogo'
import type { SeoActivityItem, SeoBacklink, SeoLinkOpportunity, SeoOutreachList } from '@/lib/seo/types'

export const dynamic = 'force-dynamic'

const VIEWS = [
  { id: 'table', label: 'Table', icon: <TableIcon size={13} /> },
  { id: 'cards', label: 'Cards', icon: <LayoutGrid size={13} /> },
  { id: 'opportunities', label: 'Opportunities', icon: <Lightbulb size={13} /> },
] as const

const PAGE_SIZES = [10, 25, 50]
const PANEL_RANGES = [
  { value: '28d', label: '28D' },
  { value: '3m', label: '3M' },
  { value: '6m', label: '6M' },
  { value: '12m', label: '12M' },
]

const LINK_TYPE_TONE: Record<string, string> = {
  dofollow: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  nofollow: 'bg-violet-50 text-violet-700 ring-violet-100',
  ugc: 'bg-slate-100 text-slate-600 ring-slate-200',
  sponsored: 'bg-amber-50 text-amber-700 ring-amber-100',
}
const LINK_TYPE_LABEL: Record<string, string> = { dofollow: 'DoFollow', nofollow: 'NoFollow', ugc: 'UGC', sponsored: 'Sponsored' }

export default async function SeoBacklinksPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const session = await requireSeoTab('backlinks', params)
  const { site, ctx, range, blocked, capabilities } = session

  if (blocked || !site) {
    return (
      <SeoPageChrome tab="backlinks" tabs={session.tabs} blocked={blocked ?? 'workspace-type'}>
        {!blocked && <EmptyPanel title="No SEO site connected yet" description="Connect a domain to start monitoring backlinks." />}
      </SeoPageChrome>
    )
  }

  const scope = { supabase: session.supabase, workspaceId: ctx.workspaceId, siteId: site.id }
  const views = availableSeoViews(ctx, VIEWS.map(v => v.id))
  const requestedView = readEnum(params, 'view', VIEWS.map(v => v.id), 'table')!
  const view = views.includes(requestedView) ? requestedView : (views[0] as typeof requestedView)
  const requestedSize = readNumber(params, 'size') ?? 10
  const pageSize = PAGE_SIZES.includes(requestedSize) ? requestedSize : 10

  const filters = {
    q: readParam(params, 'q'),
    status: readParam(params, 'status'),
    linkType: readParam(params, 'linkType'),
    sort: readParam(params, 'sort') ?? 'authority.desc',
    page: readNumber(params, 'page') ?? 1,
    pageSize: view === 'cards' ? 9 : pageSize,
  }

  const [{ current, previous }, list, opportunities, outreachLists, topPages, activity] = await Promise.all([
    getSiteDailyWithCompare(scope, range),
    view === 'opportunities' ? Promise.resolve(null) : getBacklinks(scope, filters),
    getLinkOpportunities(scope, 6),
    getOutreachLists(scope),
    getTopLinkedPages(scope),
    getActivity(scope, 'backlinks', 8),
  ])

  const kpis = buildKpis('backlinks', current, previous, 'ahrefs')
  const trendRows = current.map(row => ({ date: row.date, authority_score: row.authority_score }))
  const flowRows = bucketSeries(current, 'weekly').map(bucket => ({
    date: bucket[bucket.length - 1].date,
    new_links: bucket.reduce((sum, r) => sum + (r.new_links ?? 0), 0),
    lost_links: bucket.reduce((sum, r) => sum + (r.lost_links ?? 0), 0),
  }))
  const alerts = activity.filter(a => a.severity !== 'success').slice(0, 3)
  const recent = activity.slice(0, 5)

  const queryString = new URLSearchParams(
    Object.entries(params).flatMap(([k, v]) => (v ? [[k, Array.isArray(v) ? v[0] : v] as [string, string]] : [])),
  ).toString()

  return (
    <SeoPageChrome tab="backlinks" tabs={session.tabs} blocked={null} query={queryString}>
      <SeoHeader
        title="Backlinks"
        subtitle="Monitor referring domains, link quality, and discover new authority opportunities."
        pathname="/app/seo/backlinks"
        activePreset={matchPreset(range)}
        rangeLabel={range.label}
        params={params}
        filters={[
          { key: 'status', placeholder: 'Status', options: ['active', 'new', 'lost', 'redirected', 'broken', 'toxic'].map(v => ({ value: v, label: humanise(v) })) },
          { key: 'linkType', placeholder: 'Link type', options: Object.entries(LINK_TYPE_LABEL).map(([value, label]) => ({ value, label })) },
          { key: 'sort', placeholder: 'Sort by', options: [{ value: 'authority.desc', label: 'Authority: High to low' }, { value: 'first_seen.desc', label: 'First seen: Newest' }, { value: 'traffic.desc', label: 'Traffic value: High to low' }] },
        ]}
        badge={site.is_demo ? <span title={`Seeded demonstration data for ${site.domain}.`}><DemoBadge /></span> : undefined}
        exportHref={capabilities.exportBacklinks ? buildExportHref('backlinks', params) : undefined}
        primarySlot={capabilities.createOutreachList
          ? (
            <AddOutreachListWizard
              menu={[
                { label: 'Browse link opportunities', description: 'Prospects ranked by relevance and authority.', href: '/app/seo/backlinks?view=opportunities' },
                { label: 'Review lost links', description: 'Links that recently stopped pointing at you.', href: '/app/seo/backlinks?status=lost' },
              ]}
            />
          )
          : undefined}
      />

      <div className="mb-3"><KpiStrip kpis={kpis} compareLabel={range.compareLabel} /></div>

      <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_408px]">
        <div className="flex min-w-0 flex-col gap-3">
          <Card className="min-w-0 overflow-hidden">
            <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-2">
              <ViewSwitcher pathname="/app/seo/backlinks" params={params} views={VIEWS.filter(v => views.includes(v.id))} active={view} />
              {list && <p className="whitespace-nowrap text-[12.5px] text-slate-600">{list.total.toLocaleString('en-GB')} backlinks</p>}
              {view !== 'opportunities' && (
                <>
                  <SearchBox pathname="/app/seo/backlinks" params={params} placeholder="Search backlinks..." className="max-w-none flex-1" />
                </>
              )}
            </div>

            {view === 'opportunities'
              ? <OpportunityTable opportunities={opportunities} lists={outreachLists} canManage={capabilities.createOutreachList} />
              : (
                <>
                  {view === 'cards' ? <BacklinkCards rows={list!.rows} /> : <BacklinkTable rows={list!.rows} />}
                  <Pagination
                    pathname="/app/seo/backlinks"
                    params={params}
                    page={list!.page}
                    pageCount={list!.pageCount}
                    total={list!.total}
                    pageSize={list!.pageSize}
                    noun="backlinks"
                    pageSizeOptions={view === 'table' ? PAGE_SIZES : undefined}
                  />
                </>
              )}
          </Card>

          <div className="grid min-w-0 gap-3 lg:grid-cols-[320px_minmax(0,1fr)]">
            <Card className="min-w-0">
              <CardHeader title="Alerts" action={<Link href="/app/seo/backlinks?status=toxic" className="text-xs font-medium text-blue-600 hover:text-blue-700">View all</Link>} />
              <AlertList alerts={alerts} />
            </Card>

            <Card className="min-w-0">
              <CardHeader
                title="Top Link Opportunities"
                help="Match score = round(0.6 × relevance + 0.4 × authority)."
                action={<Link href="/app/seo/backlinks?view=opportunities" className="text-xs font-medium text-blue-600 hover:text-blue-700">View all</Link>}
              />
              <OpportunityTable opportunities={opportunities.slice(0, 5)} lists={outreachLists} canManage={capabilities.createOutreachList} compact />
            </Card>
          </div>
        </div>

        {/* ── Right rail ──────────────────────────────────────────────── */}
        <div className="flex min-w-0 flex-col gap-3">
          <Card className="min-w-0">
            <CardHeader
              title="Authority Score Trend"
              help="Caption Fox internal authority score — not Moz Domain Authority or Ahrefs Domain Rating."
              action={<PanelSelect pathname="/app/seo/backlinks" params={params} paramKey="range" label="Authority trend range" placeholder={PANEL_RANGES.find(r => r.value === matchPreset(range))?.label ?? 'Custom'} options={PANEL_RANGES} />}
            />
            <div className="px-3 pb-2 pt-2">
              <TrendChart data={trendRows} series={[{ key: 'authority_score', label: 'Authority Score', colour: '#2563EB' }]} height={124} />
            </div>
          </Card>

          <Card className="min-w-0">
            <CardHeader
              title="New vs Lost Links"
              help="Links first seen and links lost per week, as reported by the connected backlink source."
              action={<PanelSelect pathname="/app/seo/backlinks" params={params} paramKey="range" label="New vs lost range" placeholder={PANEL_RANGES.find(r => r.value === matchPreset(range))?.label ?? 'Custom'} options={PANEL_RANGES} />}
            />
            <div className="px-3 pb-2 pt-2">
              <div className="mb-1"><ChartLegend series={[{ label: 'New Links', colour: '#10B981' }, { label: 'Lost Links', colour: '#EF4444' }]} /></div>
              <GroupedBars data={flowRows} series={[{ key: 'new_links', label: 'New Links', colour: '#10B981' }, { key: 'lost_links', label: 'Lost Links', colour: '#EF4444' }]} height={112} />
            </div>
          </Card>

          <Card className="min-w-0">
            <CardHeader title="Top Linked Pages" help="Your pages receiving the most backlinks, with their estimated traffic value." action={<Link href="/app/seo/backlinks?sort=traffic.desc" className="text-xs font-medium text-blue-600 hover:text-blue-700">View all</Link>} />
            {topPages.length === 0
              ? <EmptyPanel title="No linked pages yet" description="Pages receiving the most backlinks will appear here." />
              : (
                <table className="w-full table-fixed text-[12px]">
                  <thead>
                    <tr className={SEO_TOKENS.tableHead}>
                      <th scope="col" className="w-[56%] px-4 py-1.5 text-left">Page</th>
                      <th scope="col" className="w-[22%] px-1 py-1.5 text-right">Backlinks</th>
                      <th scope="col" className="w-[22%] px-4 py-1.5 text-right">Traffic Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topPages.map(page => (
                      <tr key={page.page} className="h-7">
                        <td className="truncate px-4 py-1 text-slate-700">{page.page}</td>
                        <td className="px-1 py-1 text-right text-slate-700">{Number(page.backlinks).toLocaleString('en-GB')}</td>
                        <td className="px-4 py-1 text-right text-slate-700">{formatCompact(page.traffic_value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
          </Card>

          <ActivityFeed title="Recent Activity" items={recent} layout="list" viewAllHref="/app/seo" />
        </div>
      </div>
    </SeoPageChrome>
  )
}

function BacklinkTable({ rows }: { rows: SeoBacklink[] }) {
  if (rows.length === 0) {
    return <EmptyPanel title="No backlinks match these filters" description="Try clearing filters or wait for the next source sync." />
  }
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full min-w-[680px] table-fixed text-[11.5px]">
        <colgroup>
          <col className="w-[22%]" /><col className="w-[17%]" /><col className="w-[12%]" /><col className="w-[9%]" />
          <col className="w-[10%]" /><col className="w-[8%]" /><col className="w-[12%]" /><col className="w-[10%]" />
        </colgroup>
        <thead>
          <tr className={SEO_TOKENS.tableHead}>
            <th scope="col" className="px-4 py-2 text-left">Referring Domain</th>
            <th scope="col" className="px-2 py-2 text-left">Linked Page</th>
            <th scope="col" className="px-2 py-2 text-left">Anchor Text</th>
            <th scope="col" className="px-2 py-2 text-center">Authority</th>
            <th scope="col" className="px-2 py-2 text-center">Link Type</th>
            <th scope="col" className="px-2 py-2 text-center">Status</th>
            <th scope="col" className="px-2 py-2 text-left">First Seen</th>
            <th scope="col" className="px-3 py-2 text-right">Traffic</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(link => (
            <tr key={link.id} className="h-9 border-b border-slate-100 last:border-0">
              <td className="px-4 py-1.5">
                <span className="flex min-w-0 items-center gap-2">
                  <DomainLogo size={16} domain={link.referring_domain} />
                  <span className="truncate font-medium text-slate-800">{link.referring_domain}</span>
                  <a href={`https://${link.referring_domain}`} target="_blank" rel="noopener noreferrer" aria-label={`Open ${link.referring_domain}`} className="shrink-0 text-blue-500 hover:text-blue-700">
                    <ExternalLink size={11} aria-hidden />
                  </a>
                </span>
              </td>
              <td className="px-2 py-1.5">
                <a href={link.source_url} target="_blank" rel="noopener noreferrer" className="block truncate text-blue-600 hover:underline">{link.source_url.replace(/^https?:\/\/(www\.)?/, '')}</a>
              </td>
              <td className="truncate px-2 py-1.5 text-slate-600">{link.anchor_text ?? '—'}</td>
              <td className="px-2 py-1.5 text-center">
                {link.authority != null
                  ? <span className="inline-flex min-w-7 justify-center rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700" title={link.authority_metric}>{link.authority}</span>
                  : <span className="text-slate-400">—</span>}
              </td>
              <td className="px-2 py-1.5 text-center">
                <span className={`inline-flex rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${LINK_TYPE_TONE[link.link_type] ?? LINK_TYPE_TONE.ugc}`}>{LINK_TYPE_LABEL[link.link_type] ?? humanise(link.link_type)}</span>
              </td>
              <td className="px-2 py-1.5 text-center"><StatusChip status={link.status} /></td>
              <td className="truncate px-2 py-1.5 text-slate-500">{link.first_seen ? formatDate(link.first_seen) : '—'}</td>
              <td className="px-3 py-1.5 text-right text-slate-700">{formatCompact(link.traffic_value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function BacklinkCards({ rows }: { rows: SeoBacklink[] }) {
  if (rows.length === 0) {
    return <EmptyPanel title="No backlinks match these filters" description="Try clearing filters or wait for the next source sync." />
  }
  return (
    <div className="grid gap-2.5 p-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map(link => (
        <div key={link.id} className="rounded-lg border border-slate-200 p-3">
          <div className="mb-1.5 flex items-center gap-2">
            <DomainLogo size={16} domain={link.referring_domain} />
            <p className="min-w-0 flex-1 truncate text-[13px] font-semibold text-slate-800">{link.referring_domain}</p>
            <StatusChip status={link.status} />
          </div>
          <a href={link.source_url} target="_blank" rel="noopener noreferrer" className="mb-1 block truncate text-[11.5px] text-blue-600 hover:underline">{link.source_url}</a>
          <p className="mb-2 truncate text-[11.5px] text-slate-500">{link.anchor_text ?? 'No anchor text'}</p>
          <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
            <div><p className="font-semibold text-slate-800">{link.authority ?? '—'}</p><p className="text-slate-400">Authority</p></div>
            <div><p className="font-semibold text-slate-800">{LINK_TYPE_LABEL[link.link_type] ?? humanise(link.link_type)}</p><p className="text-slate-400">Type</p></div>
            <div><p className="font-semibold text-slate-800">{formatCompact(link.traffic_value)}</p><p className="text-slate-400">Traffic</p></div>
          </div>
        </div>
      ))}
    </div>
  )
}

function OpportunityTable({
  opportunities, lists, canManage, compact = false,
}: { opportunities: SeoLinkOpportunity[]; lists: SeoOutreachList[]; canManage: boolean; compact?: boolean }) {
  if (opportunities.length === 0) {
    return <EmptyPanel title="No link opportunities yet" description="Prospects with a strong topical and authority match will appear here." />
  }
  return (
    <div className="relative overflow-x-auto">
      <table className={`w-full table-fixed text-[11.5px] ${compact ? '' : 'min-w-[640px]'}`}>
        <colgroup>
          <col className="w-[37%]" /><col className="w-[10%]" /><col className="w-[19%]" /><col className="w-[11%]" /><col className="w-[23%]" />
        </colgroup>
        <thead>
          <tr className={SEO_TOKENS.tableHead}>
            <th scope="col" className="px-4 py-1.5 text-left">Domain</th>
            <th scope="col" className="px-1 py-1.5 text-center">Auth.</th>
            <th scope="col" className="px-2 py-1.5 text-left">Relevance</th>
            <th scope="col" className="px-1 py-1.5 text-right">Match</th>
            <th scope="col" className="px-3 py-1.5 text-center">Action</th>
          </tr>
        </thead>
        <tbody>
          {opportunities.map(opp => (
            <tr key={opp.id} className="h-9" title={opp.match_reason ?? undefined}>
              <td className="px-4 py-1">
                <span className="flex min-w-0 items-center gap-2">
                  <DomainLogo size={16} domain={opp.domain} />
                  <span className="truncate text-slate-800">{opp.domain}</span>
                </span>
              </td>
              <td className="px-1 py-1 text-center text-slate-700">{opp.authority ?? '—'}</td>
              <td className="px-2 py-1">
                <span className="block h-1.5 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`Relevance ${opp.relevance ?? 0}%`}>
                  <span className="block h-full rounded-full bg-blue-600" style={{ width: `${opp.relevance ?? 0}%` }} />
                </span>
              </td>
              <td className="px-1 py-1 text-right text-slate-700">{opp.match_score != null ? `${opp.match_score}%` : '—'}</td>
              <td className="px-2 py-1 text-center">
                {canManage
                  ? <AddToListButton opportunityId={opp.id} lists={lists} />
                  : <StatusChip status={opp.status} />}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const ALERT_ICON = {
  critical: { icon: AlertTriangle, tone: 'bg-rose-50 text-rose-600' },
  warning: { icon: AlertTriangle, tone: 'bg-amber-50 text-amber-600' },
  info: { icon: Info, tone: 'bg-blue-50 text-blue-600' },
  success: { icon: Plus, tone: 'bg-emerald-50 text-emerald-600' },
} as const

function AlertList({ alerts }: { alerts: SeoActivityItem[] }) {
  if (alerts.length === 0) {
    return <EmptyPanel title="No alerts" description="Toxic-link detections and significant link loss will appear here." />
  }
  return (
    <ul className="divide-y divide-slate-100">
      {alerts.map(alert => {
        const meta = ALERT_ICON[alert.severity] ?? ALERT_ICON.info
        const Icon = alert.action === 'lost' ? Minus : meta.icon
        const body = (
          <div className="flex items-start gap-3">
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${meta.tone}`}><Icon size={17} aria-hidden /></span>
            <div className="min-w-0">
              <p className="text-[12.5px] font-medium text-slate-800">{alert.summary}</p>
              {alert.detail && <p className="truncate text-[11px] text-slate-500">{alert.detail}</p>}
              <p className="text-[10.5px] text-slate-400">{relativeTime(alert.created_at)}</p>
            </div>
          </div>
        )
        return (
          <li key={alert.id} className="px-4 py-2">
            {alert.link ? <Link href={alert.link} className="-m-1 block rounded-lg p-1 hover:bg-slate-50">{body}</Link> : body}
          </li>
        )
      })}
    </ul>
  )
}
