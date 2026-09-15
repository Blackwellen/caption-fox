import { requireWebModule } from '@/lib/web/server'
import { listPages, webAggregates, workspaceMembers } from '@/lib/web/data'
import { parseWebQuery, type RawParams } from '@/lib/web/query'
import { PAGE_STATUSES } from '@/lib/web/constants'
import WebHeader from '@/components/web/WebHeader'
import KpiStrip from '@/components/web/KpiStrip'
import CampaignFilters from '@/components/campaigns/CampaignFilters'
import PagesTable from '@/components/web/PagesTable'
import PageCards from '@/components/web/PageCards'
import { CreatePageForm } from '@/components/web/CreateEntityForms'
import { NewPageButton, ImportButton, ExportButton, HeaderOverflow } from '@/components/web/ActionButtons'
import { AccessBlocked, LoadError } from '@/components/web/states'
import { WEB_PAGE, Panel, formatCompactNumber, formatPercentValue } from '@/components/web/primitives'
import type { KpiValue } from '@/lib/web/types'

export const metadata = { title: 'Pages · Web and Conversion · Caption Fox' }

export default async function WebPagesPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const params = await searchParams
  const { supabase, ctx, capabilities, modules, access } = await requireWebModule('pages')

  if (!access.allowed) {
    return (
      <div className={WEB_PAGE}>
        <WebHeader module="pages" modules={modules} />
        <AccessBlocked access={access} />
      </div>
    )
  }

  const query = parseWebQuery(params)
  const showCreate = params.new === '1' && capabilities.create

  const [{ rows, total, error }, aggregates, members] = await Promise.all([
    listPages(supabase, ctx.workspaceId, query, { limit: 50 }),
    webAggregates(supabase, ctx.workspaceId),
    workspaceMembers(supabase, ctx.workspaceId),
  ])

  const published = rows.filter(p => p.status === 'published')
  const totalSessions = rows.reduce((sum, p) => sum + p.sessions, 0)
  const totalConversions = rows.reduce((sum, p) => sum + p.conversions, 0)
  const avgConversionRate = totalSessions > 0 ? (totalConversions / totalSessions) * 100 : 0

  const kpis: KpiValue[] = [
    { id: 'total', label: 'Total pages', value: formatCompactNumber(total), icon: 'pages', tone: 'blue' },
    { id: 'published', label: 'Published', value: formatCompactNumber(published.length), icon: 'forms', tone: 'green' },
    { id: 'rate', label: 'Avg. conversion rate', value: formatPercentValue(avgConversionRate), icon: 'funnel', tone: 'violet' },
    { id: 'visits', label: 'Page visits', value: formatCompactNumber(totalSessions), icon: 'gauge', tone: 'blue' },
    { id: 'leads', label: 'Qualified leads', value: formatCompactNumber(aggregates.qualifiedLeads), icon: 'leads', tone: 'blue' },
    { id: 'attention', label: 'Pages needing attention', value: formatCompactNumber(aggregates.pagesNeedingAttention), icon: 'alert', tone: aggregates.pagesNeedingAttention > 0 ? 'amber' : 'slate' },
  ]

  return (
    <div className={WEB_PAGE}>
      <WebHeader
        module="pages" modules={modules}
        actions={
          <>
            <NewPageButton allowed={capabilities.create} />
            <ImportButton allowed={capabilities.import} />
            <ExportButton entity="pages" allowed={capabilities.export} />
            <HeaderOverflow items={[{ label: 'Refresh data' }]} />
          </>
        }
      />

      <KpiStrip items={kpis} className="mb-3" />

      <CampaignFilters
        className="mb-3"
        filters={[
          { key: 'status', label: 'Status', options: PAGE_STATUSES.map(s => ({ value: s, label: s })) },
          { key: 'owner', label: 'Owner', options: members.map(m => ({ value: m.id, label: m.full_name ?? m.email ?? 'Member' })) },
        ]}
        searchPlaceholder="Search pages…"
        views={['cards', 'table']}
      />

      {showCreate && <CreatePageForm />}
      {error && <LoadError message={error} className="mb-3" />}

      <Panel title="All pages" info={`${total} pages`} bodyClassName={query.view === 'cards' ? undefined : 'px-0 pb-0'}>
        {query.view === 'cards' ? <PageCards rows={rows} /> : <PagesTable rows={rows} />}
      </Panel>
    </div>
  )
}
