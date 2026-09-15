import { requireWebModule } from '@/lib/web/server'
import { listForms, workspaceMembers } from '@/lib/web/data'
import { parseWebQuery, type RawParams } from '@/lib/web/query'
import { FORM_STATUSES } from '@/lib/web/constants'
import WebHeader from '@/components/web/WebHeader'
import KpiStrip from '@/components/web/KpiStrip'
import CampaignFilters from '@/components/campaigns/CampaignFilters'
import FormsTable from '@/components/web/FormsTable'
import { CreateFormForm } from '@/components/web/CreateEntityForms'
import { NewFormButton, ImportButton, ExportButton, HeaderOverflow } from '@/components/web/ActionButtons'
import { AccessBlocked, LoadError } from '@/components/web/states'
import { WEB_PAGE, Panel, formatCompactNumber, formatPercentValue } from '@/components/web/primitives'
import type { KpiValue } from '@/lib/web/types'

export const metadata = { title: 'Forms · Web and Conversion · Caption Fox' }

export default async function WebFormsPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const params = await searchParams
  const { supabase, ctx, capabilities, modules, access } = await requireWebModule('forms')

  if (!access.allowed) {
    return (
      <div className={WEB_PAGE}>
        <WebHeader module="forms" modules={modules} />
        <AccessBlocked access={access} />
      </div>
    )
  }

  const query = parseWebQuery(params)
  const showCreate = params.new === '1' && capabilities.create

  const [{ rows, total, error }, members] = await Promise.all([
    listForms(supabase, ctx.workspaceId, query, { limit: 50 }),
    workspaceMembers(supabase, ctx.workspaceId),
  ])

  const active = rows.filter(f => f.status === 'published')
  const totalSubmissions = rows.reduce((sum, f) => sum + f.submissions_count, 0)
  const totalCompleted = rows.reduce((sum, f) => sum + f.completed_count, 0)
  const completionRate = totalSubmissions > 0 ? (totalCompleted / totalSubmissions) * 100 : 0
  const avgTimeSeconds = rows.length > 0 ? Math.round(rows.reduce((sum, f) => sum + f.avg_completion_seconds, 0) / rows.length) : 0

  const kpis: KpiValue[] = [
    { id: 'active', label: 'Active forms', value: formatCompactNumber(active.length), icon: 'forms', tone: 'blue' },
    { id: 'submissions', label: 'Total submissions', value: formatCompactNumber(totalSubmissions), icon: 'leads', tone: 'violet' },
    { id: 'completion', label: 'Completion rate', value: formatPercentValue(completionRate), icon: 'funnel', tone: 'green' },
    { id: 'time', label: 'Avg. submit time', value: `${Math.floor(avgTimeSeconds / 60)}m ${avgTimeSeconds % 60}s`, icon: 'gauge', tone: 'blue' },
  ]

  return (
    <div className={WEB_PAGE}>
      <WebHeader
        module="forms" modules={modules}
        actions={
          <>
            <NewFormButton allowed={capabilities.create} />
            <ImportButton allowed={capabilities.import} />
            <ExportButton entity="forms" allowed={capabilities.export} />
            <HeaderOverflow items={[{ label: 'Refresh data' }]} />
          </>
        }
      />

      <KpiStrip items={kpis} className="mb-3" />

      <CampaignFilters
        className="mb-3"
        filters={[
          { key: 'status', label: 'Status', options: FORM_STATUSES.map(s => ({ value: s, label: s })) },
          { key: 'owner', label: 'Owner', options: members.map(m => ({ value: m.id, label: m.full_name ?? m.email ?? 'Member' })) },
        ]}
        searchPlaceholder="Search forms…"
      />

      {showCreate && <CreateFormForm />}
      {error && <LoadError message={error} className="mb-3" />}

      <Panel title="All forms" info={`${total} forms`} bodyClassName="px-0 pb-0">
        <FormsTable rows={rows} />
      </Panel>
    </div>
  )
}
