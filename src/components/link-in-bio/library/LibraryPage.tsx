import { BarChart3, CheckCircle2, Copy, FileText, Layers3, ListChecks, Plus, Repeat, TrendingUp, TriangleAlert, WandSparkles } from 'lucide-react'
import { loadLibrary, param, type Params } from '@/lib/link-in-bio/server/collections'
import { loadSavedViews } from '@/lib/link-in-bio/server/views'
import { linkDenialMessage } from '@/lib/link-in-bio/entitlements'
import type { LinksSession } from '@/lib/link-in-bio/server/context'
import { ExportButton, ImportLinksButton, LinksTabs, Menu } from '../client'
import { FilterSelect, MoreFilters, PaginationBar, SavedViewsSelect, SearchBox, SortSelect, ViewToggle } from '../controls'
import { ActivityRail, GovernanceRail, QuickActionsRail } from '../rail'
import { ErrorNote, formatKpi, KpiCell, KpiStrip, LinkButton, PageHeading } from '../ui'
import LibraryResults from './LibraryResults'

export default async function LibraryPage({ session, searchParams }: { session: LinksSession; searchParams: Params }) {
  const [data, views] = await Promise.all([loadLibrary(session, searchParams), loadSavedViews(session, 'library')])
  const base = session.basePath
  const caps = session.capabilities
  const view = param(searchParams, 'view') === 'table' ? 'table' : 'cards'

  return (
    <div>
      <PageHeading
        crumbs={[{ label: session.workspace.name, href: `/${session.workspaceType}` }, { label: 'Link in Bio', href: base }, { label: 'Link Library' }]}
        title="Link Library"
        subtitle="Manage published link pages, reusable links, and lightweight conversion pages."
        actions={
          <>
            <LinkButton href={`${base}/new`} variant="primary" disabledReason={linkDenialMessage(session.context, 'pages.create')}><Plus size={15} aria-hidden /> New link page</LinkButton>
            <LinkButton href={`${base}/reusable-links/new`} disabledReason={linkDenialMessage(session.context, 'reusable.manage')}><Plus size={15} aria-hidden /> New reusable link</LinkButton>
            <ImportLinksButton workspaceType={session.workspaceType} disabledReason={linkDenialMessage(session.context, 'reusable.manage')} />
            <ExportButton workspaceType={session.workspaceType} kind="library" disabledReason={linkDenialMessage(session.context, 'export')} />
            <Menu label="More library actions" items={[
              { label: 'New conversion page', href: `${base}/conversion-pages/new`, disabledReason: linkDenialMessage(session.context, 'conversion.create') },
              { label: 'Reusable links', href: `${base}/library?type=reusable_link` },
              { label: 'Archived items', href: `${base}/library?status=archived` },
            ]} />
          </>
        }
      >
        <div className="mt-3.5"><LinksTabs basePath={base} /></div>
      </PageHeading>

      <KpiStrip>
        <KpiCell label="Total link pages" value={formatKpi(data.kpis.total, 'integer')} kpi={data.kpis.total} icon={<FileText />} tone="purple" href={`${base}/library`} />
        <KpiCell label="Published" value={formatKpi(data.kpis.published, 'integer')} kpi={data.kpis.published} icon={<CheckCircle2 />} tone="green" href={`${base}/library?status=published`} />
        <KpiCell label="Conversion pages" value={formatKpi(data.kpis.conversion, 'integer')} kpi={data.kpis.conversion} icon={<Layers3 />} tone="blue" href={`${base}/library?type=conversion_page`} />
        <KpiCell label="Avg CTR" value={formatKpi(data.kpis.avgCtr, 'percent')} kpi={data.kpis.avgCtr} icon={<TrendingUp />} tone="green" href={`${base}/analytics`} />
        <KpiCell label="Total clicks" value={formatKpi(data.kpis.clicks, 'compact')} kpi={data.kpis.clicks} icon={<BarChart3 />} tone="blue" href={`${base}/analytics`} />
        <KpiCell label="Needs review" value={formatKpi(data.kpis.review, 'integer')} kpi={data.kpis.review} icon={<TriangleAlert />} tone="orange" inverse href={`${base}/library?status=in_review`} />
      </KpiStrip>

      {data.error && <div className="mt-3"><ErrorNote /></div>}

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_232px]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <SearchBox placeholder="Search link pages..." className="w-full sm:w-[200px]" />
            <FilterSelect paramKey="type" label="Type" className="w-[calc(50%-5px)] sm:w-[106px]" options={[{ value: 'link_page', label: 'Link page' }, { value: 'conversion_page', label: 'Conversion page' }, { value: 'reusable_link', label: 'Reusable link' }]} />
            <FilterSelect paramKey="owner" label="Owner" className="w-[calc(50%-5px)] sm:w-[106px]" options={data.owners.map(o => ({ value: o.id, label: o.name }))} />
            <FilterSelect paramKey="status" label="Status" className="w-[calc(50%-5px)] sm:w-[106px]" options={[{ value: 'published', label: 'Published' }, { value: 'draft', label: 'Draft' }, { value: 'in_review', label: 'Review' }, { value: 'scheduled', label: 'Scheduled' }, { value: 'unpublished', label: 'Unpublished' }, { value: 'active', label: 'Active (links)' }, { value: 'paused', label: 'Paused (links)' }, { value: 'archived', label: 'Archived' }]} />
            <FilterSelect paramKey="theme" label="Theme" className="w-[calc(50%-5px)] sm:w-[106px]" options={data.themes.map(t => ({ value: t.id, label: t.name }))} />
            <FilterSelect paramKey="updated" label="Updated" allLabel="Updated: Any time" icon="calendar" className="w-full sm:w-[160px]" options={[{ value: '24h', label: 'Last 24 hours' }, { value: '7d', label: 'Last 7 days' }, { value: '30d', label: 'Last 30 days' }, { value: '90d', label: 'Last 90 days' }]} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2.5">
            <SavedViewsSelect scope="library" views={views} workspaceType={session.workspaceType} className="w-[128px]" />
            <SortSelect defaultValue="updated" className="w-[172px]" options={[{ value: 'updated', label: 'Recent update' }, { value: 'clicks', label: 'Most clicks' }, { value: 'ctr', label: 'Highest CTR' }, { value: 'name', label: 'Name' }]} />
            <MoreFilters count={data.activeFilters}>
              <FilterSelect paramKey="governance" label="Governance" allLabel="Governance: Any" className="w-full" options={[{ value: 'broken', label: 'Has broken links' }, { value: 'utm', label: 'Missing UTM' }]} />
            </MoreFilters>
            <div className="ml-auto"><ViewToggle /></div>
          </div>

          <div className="mt-4">
            <LibraryResults
              rows={data.rows} view={view} workspaceType={session.workspaceType} basePath={base} hasFilters={data.activeFilters > 0}
              caps={{ edit: caps['pages.edit'], archive: caps['pages.archive'], publish: caps['pages.publish'], create: caps['pages.create'], reusable: caps['reusable.manage'] }}
            />
          </div>
          {data.total > 0 && <PaginationBar className="mt-5" page={data.page} pageSize={data.pageSize} total={data.total} />}
        </div>

        <aside className="space-y-3.5" aria-label="Library insights">
          <ActivityRail items={data.activity} viewAllHref={base} />
          <QuickActionsRail items={[
            { label: 'Create from template', href: `${base}/new`, icon: <WandSparkles /> },
            { label: 'Duplicate link page', href: `${base}/library?view=table`, icon: <Copy /> },
            { label: 'Bulk update links', href: `${base}/library?view=table&type=link_page`, icon: <ListChecks /> },
            { label: 'Manage redirects', href: `${base}/library?type=reusable_link`, icon: <Repeat /> },
            { label: 'Link performance report', href: `${base}/analytics`, icon: <BarChart3 /> },
          ]} />
          <GovernanceRail alerts={data.alerts} viewAllHref={`${base}/library?status=in_review`} />
        </aside>
      </div>
    </div>
  )
}
