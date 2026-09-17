import Link from 'next/link'
import { CheckCircle2, Clock3, FileText, Layers3, Palette, Plus, TrendingUp, TriangleAlert, CircleAlert, Sparkles, Archive, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { relative } from '@/lib/link-in-bio/format'
import { linkDenialMessage } from '@/lib/link-in-bio/entitlements'
import { loadThemes, param, type Params } from '@/lib/link-in-bio/server/collections'
import { loadSavedViews } from '@/lib/link-in-bio/server/views'
import type { LinksSession } from '@/lib/link-in-bio/server/context'
import { ExportButton, LinksTabs, Menu } from '../client'
import { FilterSelect, MoreFilters, PaginationBar, SavedViewsSelect, SearchBox, SortSelect, ViewToggle } from '../controls'
import { formatKpi, KpiCell, KpiStrip, LinkButton, PageHeading, Panel, PanelTitle, StatusBadge, TextLink } from '../ui'
import ThemeResults from './ThemeResults'
import { ThemeSwatch } from './ThemeVisuals'

const REC_TONE = { danger: 'bg-red-50 text-red-500', info: 'bg-blue-50 text-blue-600', success: 'bg-emerald-50 text-emerald-600', purple: 'bg-violet-50 text-violet-600' }
const REC_ICON = { danger: TriangleAlert, info: CircleAlert, success: Archive, purple: AlertTriangle }

export default async function ThemesPage({ session, searchParams }: { session: LinksSession; searchParams: Params }) {
  const [data, views] = await Promise.all([loadThemes(session, searchParams), loadSavedViews(session, 'themes')])
  const base = session.basePath
  const view = param(searchParams, 'view') === 'table' ? 'table' : 'cards'

  return (
    <div>
      <PageHeading
        crumbs={[{ label: session.workspace.name, href: `/${session.workspaceType}` }, { label: 'Link in Bio', href: base }, { label: 'Themes' }]}
        title="Themes"
        subtitle="Manage reusable visual themes for link pages and conversion pages."
        actions={
          <>
            <LinkButton href={`${base}/themes/new`} variant="primary" disabledReason={linkDenialMessage(session.context, 'themes.manage')}><Plus size={15} aria-hidden /> Create theme</LinkButton>
            <LinkButton href={`${base}/themes/new?start=clone`} disabledReason={linkDenialMessage(session.context, 'themes.manage')}><Sparkles size={14} aria-hidden /> Import theme</LinkButton>
            <ExportButton workspaceType={session.workspaceType} kind="themes" disabledReason={linkDenialMessage(session.context, 'export')} />
            <Menu label="More theme actions" items={[
              { label: 'Themes awaiting review', href: `${base}/themes?status=review` },
              { label: 'Archived themes', href: `${base}/themes?status=archived` },
              { label: 'Unused themes', href: `${base}/themes?usage=unused` },
            ]} />
          </>
        }
      >
        <div className="mt-3.5"><LinksTabs basePath={base} /></div>
      </PageHeading>

      <KpiStrip>
        <KpiCell label="Total themes" value={formatKpi(data.kpis.total, 'integer')} kpi={data.kpis.total} icon={<FileText />} tone="purple" href={`${base}/themes`} />
        <KpiCell label="Active" value={formatKpi(data.kpis.active, 'integer')} kpi={data.kpis.active} icon={<CheckCircle2 />} tone="green" href={`${base}/themes?status=active`} />
        <KpiCell label="Pages using themes" value={formatKpi(data.kpis.pagesUsing, 'integer')} kpi={data.kpis.pagesUsing} icon={<Layers3 />} tone="blue" href={`${base}/library`} />
        <KpiCell label="Avg CTR uplift" value={formatKpi(data.kpis.uplift, 'signed')} kpi={data.kpis.uplift} icon={<TrendingUp />} tone="green" href={`${base}/themes?sort=uplift`} />
        <KpiCell label="Needs review" value={formatKpi(data.kpis.review, 'integer')} kpi={data.kpis.review} icon={<TriangleAlert />} tone="orange" inverse href={`${base}/themes?status=review`} />
        <KpiCell label="Updated this week" value={formatKpi(data.kpis.updatedWeek, 'integer')} kpi={data.kpis.updatedWeek} icon={<Clock3 />} tone="blue" href={`${base}/themes?updated=7d`} />
      </KpiStrip>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_240px]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <SearchBox placeholder="Search themes..." className="w-full sm:w-[200px]" />
            <FilterSelect paramKey="category" label="Category" className="w-[calc(50%-5px)] sm:w-[106px]" options={data.categories.map(c => ({ value: c, label: c }))} />
            <FilterSelect paramKey="owner" label="Owner" className="w-[calc(50%-5px)] sm:w-[106px]" options={data.owners.map(o => ({ value: o.id, label: o.name }))} />
            <FilterSelect paramKey="status" label="Status" className="w-[calc(50%-5px)] sm:w-[106px]" options={[{ value: 'active', label: 'Active' }, { value: 'draft', label: 'Draft' }, { value: 'review', label: 'Needs review' }, { value: 'archived', label: 'Archived' }]} />
            <FilterSelect paramKey="usage" label="Usage" className="w-[calc(50%-5px)] sm:w-[106px]" options={[{ value: 'used', label: 'In use' }, { value: 'unused', label: 'Not used' }]} />
            <FilterSelect paramKey="updated" label="Updated" allLabel="Updated: Any time" icon="calendar" className="w-full sm:w-[160px]" options={[{ value: '24h', label: 'Last 24 hours' }, { value: '7d', label: 'Last 7 days' }, { value: '30d', label: 'Last 30 days' }, { value: '90d', label: 'Last 90 days' }]} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2.5">
            <SavedViewsSelect scope="themes" views={views} workspaceType={session.workspaceType} className="w-[128px]" />
            <SortSelect defaultValue="updated" className="w-[172px]" options={[{ value: 'updated', label: 'Recent update' }, { value: 'usage', label: 'Most used' }, { value: 'uplift', label: 'CTR uplift' }, { value: 'name', label: 'Name' }]} />
            <MoreFilters count={data.activeFilters}>
              <p className="text-[11.5px] text-slate-500">Combine the filters above; Clear all resets every filter and search.</p>
            </MoreFilters>
            <div className="ml-auto"><ViewToggle /></div>
          </div>
          <div className="mt-4">
            <ThemeResults rows={data.rows} view={view} basePath={base} workspaceType={session.workspaceType} hasFilters={data.activeFilters > 0}
              caps={{ manage: session.capabilities['themes.manage'], publish: session.capabilities['themes.publish'] }} />
          </div>
          {data.total > 0 && <PaginationBar className="mt-5" page={data.page} pageSize={data.pageSize} total={data.total} />}
        </div>

        <aside className="space-y-3.5" aria-label="Theme insights">
          <Panel className="p-4">
            <PanelTitle title="Approval queue" action={<TextLink href={`${base}/themes?status=review`}>View all</TextLink>} />
            {data.approvalQueue.length === 0 ? <p className="mt-3 text-[12px] text-slate-500">Nothing waiting for approval.</p> : (
              <ul className="mt-3.5 space-y-3">
                {data.approvalQueue.map(theme => (
                  <li key={theme.id}>
                    <Link href={`${base}/themes/${theme.id}/editor`} className="flex items-center gap-2.5 rounded-md hover:bg-slate-50">
                      <ThemeSwatch tokens={theme.tokens} size={26} />
                      <span className="min-w-0 flex-1 text-[10.5px] leading-snug">
                        <span className="block truncate font-medium text-slate-900">{theme.name}</span>
                        <span className="block truncate text-slate-500">Updated by {theme.owner?.name ?? 'System'}</span>
                      </span>
                      <StatusBadge status="review" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel className="p-4">
            <PanelTitle title="Recent theme activity" action={<TextLink href={base}>View all</TextLink>} />
            {data.activity.length === 0 ? <p className="mt-3 text-[12px] text-slate-500">No theme activity yet.</p> : (
              <ul className="mt-3.5 space-y-3">
                {data.activity.map(item => {
                  const tokens = item.entityId ? data.swatches[item.entityId] : undefined
                  return (
                    <li key={item.id} className="flex items-center gap-2.5">
                      {tokens ? <ThemeSwatch tokens={tokens} size={26} /> : <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-400"><Palette size={13} aria-hidden /></span>}
                      <span className="min-w-0 flex-1 text-[10.5px] leading-snug">
                        {item.href ? <Link href={item.href} className="block truncate font-medium text-slate-900 hover:text-[#1a5cff]">{item.entityName}</Link> : <span className="block truncate font-medium text-slate-900">{item.entityName}</span>}
                        <span className="block truncate text-slate-500">by {item.actor?.name ?? 'System'}</span>
                      </span>
                      <time dateTime={item.createdAt} className="shrink-0 text-[10px] text-slate-500">{relative(item.createdAt)}</time>
                    </li>
                  )
                })}
              </ul>
            )}
          </Panel>

          <Panel className="p-4">
            <PanelTitle title="Recommended actions" />
            {data.recommendations.length === 0 ? <p className="mt-3 text-[12px] text-slate-500">No recommendations right now.</p> : (
              <ul className="mt-3.5 space-y-3">
                {data.recommendations.map(rec => {
                  const Icon = REC_ICON[rec.tone]
                  return (
                    <li key={rec.id}>
                      <Link href={rec.href} className="flex items-start gap-2.5 rounded-md hover:bg-slate-50">
                        <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full', REC_TONE[rec.tone])} aria-hidden><Icon size={13} /></span>
                        <span className="min-w-0 text-[10.5px] leading-snug"><span className="block font-medium text-slate-900">{rec.title}</span><span className="block text-slate-500">{rec.detail}</span></span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </Panel>
        </aside>
      </div>
    </div>
  )
}
