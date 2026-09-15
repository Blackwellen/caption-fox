import { ExternalLink, LayoutGrid, Lightbulb, Table as TableIcon } from 'lucide-react'
import { requireSeoTab } from '@/lib/seo/server'
import {
  getActivity, getBacklinks, getLinkOpportunities, getOutreachLists, getSiteDailyWithCompare, getTopLinkedPages,
} from '@/lib/seo/queries'
import { buildKpis } from '@/lib/seo/kpis'
import { matchPreset, bucketSeries } from '@/lib/seo/range'
import { formatCompact, formatDate, formatDecimal, humanise } from '@/lib/seo/format'
import { availableSeoViews } from '@/lib/seo/entitlements'
import { readEnum, readParam, readNumber } from '@/lib/seo/url-state'
import { Card, CardHeader, EmptyPanel, InfoTip, StatusChip } from '@/components/seo/primitives'
import { KpiStrip } from '@/components/seo/KpiStrip'
import { SeoHeader } from '@/components/seo/SeoHeader'
import { SeoPageChrome } from '@/components/seo/SeoPageChrome'
import { ActivityFeed } from '@/components/seo/ActivityFeed'
import { FilterBar, Pagination, ViewSwitcher } from '@/components/seo/FilterBar'
import { GroupedBars, TrendChart } from '@/components/seo/charts'
import { AddOutreachListWizard } from '@/components/seo/wizards/AddOutreachListWizard'
import { AddToListButton } from '@/components/seo/wizards/AddToListButton'
import { buildExportHref, type SearchParams } from '@/lib/seo/url-state'
import type { SeoBacklink } from '@/lib/seo/types'

export const dynamic = 'force-dynamic'

const VIEWS = [
  { id: 'table', label: 'Table', icon: <TableIcon size={13} /> },
  { id: 'cards', label: 'Cards', icon: <LayoutGrid size={13} /> },
  { id: 'opportunities', label: 'Opportunities', icon: <Lightbulb size={13} /> },
] as const

export default async function SeoBacklinksPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const session = await requireSeoTab('backlinks', params)
  const { site, ctx, range, blocked, capabilities } = session

  if (blocked || !site) {
    return <SeoPageChrome tab="backlinks" tabs={session.tabs} blocked={blocked ?? 'workspace-type'}>{!blocked && <EmptyPanel title="No SEO site connected yet" description="Connect a domain to start monitoring backlinks." />}</SeoPageChrome>
  }

  const scope = { supabase: session.supabase, workspaceId: ctx.workspaceId, siteId: site.id }
  const views = availableSeoViews(ctx, VIEWS.map(v => v.id))
  const requestedView = readEnum(params, 'view', VIEWS.map(v => v.id), 'table')!
  const view = views.includes(requestedView) ? requestedView : (views[0] as typeof requestedView)

  const filters = {
    q: readParam(params, 'q'),
    status: readParam(params, 'status'),
    linkType: readParam(params, 'linkType'),
    sort: readParam(params, 'sort') ?? 'authority.desc',
    page: readNumber(params, 'page') ?? 1,
    pageSize: view === 'cards' ? 9 : 10,
  }

  const [{ current, previous }, list, opportunities, outreachLists, topPages, activity] = await Promise.all([
    getSiteDailyWithCompare(scope, range),
    view === 'opportunities' ? Promise.resolve(null) : getBacklinks(scope, filters),
    getLinkOpportunities(scope, 6),
    getOutreachLists(scope),
    getTopLinkedPages(scope),
    getActivity(scope, 'backlinks', 5),
  ])

  const kpis = buildKpis('backlinks', current, previous, 'ahrefs')

  const trendRows = current.map(row => ({ date: row.date, authority_score: row.authority_score }))
  const flowRows = bucketSeries(current, 'weekly').map(bucket => ({
    date: bucket[bucket.length - 1].date,
    new_links: bucket.reduce((s, r) => s + r.new_links, 0),
    lost_links: -bucket.reduce((s, r) => s + r.lost_links, 0),
  }))

  const queryString = new URLSearchParams(Object.entries(params).flatMap(([k, v]) => v ? [[k, Array.isArray(v) ? v[0] : v] as [string, string]] : [])).toString()

  return (
    <SeoPageChrome tab="backlinks" tabs={session.tabs} blocked={null} query={queryString}>
      <SeoHeader
        title="Backlinks"
        subtitle="Monitor referring domains, link quality, and discover new authority opportunities."
        pathname="/app/seo/backlinks"
        activePreset={matchPreset(range)}
        exportHref={capabilities.exportBacklinks ? buildExportHref('backlinks', params) : undefined}
        primarySlot={capabilities.createOutreachList ? <AddOutreachListWizard /> : undefined}
      />

      <div className="mb-5"><KpiStrip kpis={kpis} compareLabel={range.compareLabel} /></div>

      <div className="mb-5 grid gap-5 xl:grid-cols-[1.7fr_1fr]">
        <Card>
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <ViewSwitcher pathname="/app/seo/backlinks" params={params} views={VIEWS.filter(v => views.includes(v.id))} active={view} />
          </div>
          {view === 'opportunities'
            ? <OutreachOpportunities opportunities={opportunities} lists={outreachLists} canManage={capabilities.createOutreachList} />
            : (
              <>
                <FilterBar
                  pathname="/app/seo/backlinks"
                  params={params}
                  searchPlaceholder="Search backlinks..."
                  resultCount={list?.total}
                  resultNoun="backlinks"
                  selects={[
                    { key: 'status', placeholder: 'All Status', options: ['active', 'new', 'lost', 'redirected', 'broken', 'toxic'].map(v => ({ value: v, label: humanise(v) })) },
                    { key: 'linkType', placeholder: 'Link Type', options: ['dofollow', 'nofollow', 'ugc', 'sponsored'].map(v => ({ value: v, label: humanise(v) })) },
                  ]}
                />
                {view === 'cards' ? <BacklinkCards rows={list!.rows} /> : <BacklinkTable rows={list!.rows} />}
                <Pagination pathname="/app/seo/backlinks" params={params} page={list!.page} pageCount={list!.pageCount} total={list!.total} pageSize={list!.pageSize} />
              </>
            )}
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Authority Score Trend" help="Caption Fox internal authority score, not Moz Domain Authority or Ahrefs Domain Rating." />
            <div className="p-5"><TrendChart data={trendRows} series={[{ key: 'authority_score', label: 'Authority Score', colour: '#2563EB' }]} height={180} /></div>
          </Card>
          <Card>
            <CardHeader title="New vs Lost Links" />
            <div className="p-5"><GroupedBars data={flowRows} series={[{ key: 'new_links', label: 'New Links', colour: '#10B981' }, { key: 'lost_links', label: 'Lost Links', colour: '#EF4444' }]} height={180} /></div>
          </Card>
          <Card>
            <CardHeader title="Top Linked Pages" />
            {topPages.length === 0
              ? <EmptyPanel title="No linked pages yet" description="Pages receiving the most backlinks will appear here." />
              : (
                <ul className="divide-y divide-slate-100">
                  {topPages.map(page => (
                    <li key={page.page} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                      <span className="min-w-0 truncate text-slate-700">{page.page}</span>
                      <span className="shrink-0 font-medium text-slate-800">{formatCompact(page.backlinks)}</span>
                    </li>
                  ))}
                </ul>
              )}
          </Card>
        </div>
      </div>

      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Alerts" />
          <AlertsFromActivity activity={activity} />
        </Card>
        <Card>
          <CardHeader title="Top Link Opportunities" help="Match score = round(0.6 × relevance + 0.4 × authority)." />
          {opportunities.length === 0
            ? <EmptyPanel title="No link opportunities yet" description="Prospects with a strong topical and authority match will appear here." />
            : (
              <ul className="divide-y divide-slate-100">
                {opportunities.slice(0, 5).map(opp => (
                  <li key={opp.id} className="flex items-center gap-3 px-5 py-2.5">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">{opp.domain}</span>
                    <span className="w-10 shrink-0 text-right text-xs text-slate-500">{opp.authority}</span>
                    <span className="w-12 shrink-0 text-right text-xs font-semibold text-blue-600">{opp.match_score}%</span>
                    {capabilities.createOutreachList && <AddToListButton opportunityId={opp.id} lists={outreachLists} />}
                  </li>
                ))}
              </ul>
            )}
        </Card>
      </div>

      <ActivityFeed title="Recent Activity" items={activity} />
    </SeoPageChrome>
  )
}

function BacklinkTable({ rows }: { rows: SeoBacklink[] }) {
  if (rows.length === 0) return <EmptyPanel title="No backlinks match these filters" description="Try clearing filters or wait for the next source sync." />
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-sm">
        <thead>
          <tr className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <th className="px-5 py-2 text-left">Referring Domain</th>
            <th className="px-3 py-2 text-left">Linked Page</th>
            <th className="px-3 py-2 text-left">Anchor Text</th>
            <th className="px-3 py-2 text-left">Authority</th>
            <th className="px-3 py-2 text-left">Link Type</th>
            <th className="px-3 py-2 text-left">Status</th>
            <th className="px-3 py-2 text-left">First Seen</th>
            <th className="px-3 py-2 text-left">Traffic Value</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(link => (
            <tr key={link.id} className="h-12 border-b border-slate-100 last:border-0">
              <td className="px-5 py-2.5 font-medium text-slate-800">{link.referring_domain}</td>
              <td className="max-w-[220px] truncate px-3 py-2.5"><a href={link.source_url} className="inline-flex items-center gap-1 text-blue-600 hover:underline">{link.linked_page}<ExternalLink size={11} /></a></td>
              <td className="max-w-[160px] truncate px-3 py-2.5 text-slate-600">{link.anchor_text ?? '—'}</td>
              <td className="px-3 py-2.5 text-slate-600">{link.authority ?? '—'}</td>
              <td className="px-3 py-2.5"><StatusChip status={link.link_type} /></td>
              <td className="px-3 py-2.5"><StatusChip status={link.status} /></td>
              <td className="px-3 py-2.5 text-slate-500">{link.first_seen ? formatDate(link.first_seen) : '—'}</td>
              <td className="px-3 py-2.5 text-slate-600">{formatCompact(link.traffic_value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function BacklinkCards({ rows }: { rows: SeoBacklink[] }) {
  if (rows.length === 0) return <EmptyPanel title="No backlinks match these filters" description="Try clearing filters or wait for the next source sync." />
  return (
    <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map(link => (
        <div key={link.id} className="rounded-lg border border-slate-200 p-3.5">
          <div className="mb-2 flex items-start justify-between gap-2">
            <p className="min-w-0 truncate text-sm font-semibold text-slate-800">{link.referring_domain}</p>
            <StatusChip status={link.status} />
          </div>
          <p className="mb-2 truncate text-xs text-slate-500">{link.anchor_text ?? 'No anchor text'}</p>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div><p className="font-semibold text-slate-800">{link.authority ?? '—'}</p><p className="text-slate-400">Authority</p></div>
            <div><StatusChip status={link.link_type} /><p className="mt-0.5 text-slate-400">Type</p></div>
            <div><p className="font-semibold text-slate-800">{formatCompact(link.traffic_value)}</p><p className="text-slate-400">Traffic</p></div>
          </div>
        </div>
      ))}
    </div>
  )
}

function OutreachOpportunities({
  opportunities, lists, canManage,
}: {
  opportunities: { id: string; domain: string; authority: number | null; relevance: number | null; match_score: number | null; existing_relationship: boolean; status: string }[]
  lists: { id: string; name: string; itemCount?: number }[]
  canManage: boolean
}) {
  return (
    <div className="p-5">
      {lists.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {lists.map(l => (
            <span key={l.id} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{l.name} · {l.itemCount ?? 0}</span>
          ))}
        </div>
      )}
      {opportunities.length === 0
        ? <EmptyPanel title="No link opportunities yet" description="Prospects with a strong topical and authority match will appear here." />
        : (
          <ul className="divide-y divide-slate-100">
            {opportunities.map(opp => (
              <li key={opp.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{opp.domain}</p>
                  <p className="text-xs text-slate-500">Authority {opp.authority} · Relevance {opp.relevance}%</p>
                </div>
                <span className="shrink-0 text-sm font-semibold text-blue-600">{opp.match_score}%</span>
                <StatusChip status={opp.status} />
                {canManage && <AddToListButton opportunityId={opp.id} lists={lists} />}
              </li>
            ))}
          </ul>
        )}
    </div>
  )
}

function AlertsFromActivity({ activity }: { activity: { id: string; summary: string; detail: string | null; severity: string; created_at: string }[] }) {
  const alerts = activity.filter(a => a.severity === 'warning' || a.severity === 'critical')
  if (alerts.length === 0) return <EmptyPanel title="No alerts" description="Toxic-link detections and significant link loss will appear here." />
  return (
    <ul className="divide-y divide-slate-100">
      {alerts.map(alert => (
        <li key={alert.id} className="flex items-center gap-3 px-5 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-800">{alert.summary}</p>
            {alert.detail && <p className="text-xs text-slate-500">{alert.detail}</p>}
          </div>
          <StatusChip status={alert.severity === 'critical' ? 'toxic' : 'declining'} label={alert.severity === 'critical' ? 'Critical' : 'Warning'} />
        </li>
      ))}
    </ul>
  )
}
