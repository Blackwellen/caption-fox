import { requireWebModule } from '@/lib/web/server'
import { listFunnels, workspaceMembers } from '@/lib/web/data'
import { parseWebQuery, type RawParams } from '@/lib/web/query'
import { FUNNEL_STATUSES } from '@/lib/web/constants'
import WebHeader from '@/components/web/WebHeader'
import KpiStrip from '@/components/web/KpiStrip'
import CampaignFilters from '@/components/campaigns/CampaignFilters'
import FunnelsTable from '@/components/web/FunnelsTable'
import { CreateFunnelForm } from '@/components/web/CreateEntityForms'
import { NewFunnelButton, ImportButton, ExportButton, HeaderOverflow } from '@/components/web/ActionButtons'
import { AccessBlocked, LoadError } from '@/components/web/states'
import { WEB_PAGE, Panel, formatCompactNumber, formatPercentValue } from '@/components/web/primitives'
import type { KpiValue } from '@/lib/web/types'

export const metadata = { title: 'Funnels · Web and Conversion · Caption Fox' }

export default async function WebFunnelsPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const params = await searchParams
  const { supabase, ctx, capabilities, modules, access } = await requireWebModule('funnels')

  if (!access.allowed) {
    return (
      <div className={WEB_PAGE}>
        <WebHeader module="funnels" modules={modules} />
        <AccessBlocked access={access} />
      </div>
    )
  }

  const query = parseWebQuery(params)
  const showCreate = params.new === '1' && capabilities.create

  const [{ rows, total, error }, members] = await Promise.all([
    listFunnels(supabase, ctx.workspaceId, query, { limit: 50 }),
    workspaceMembers(supabase, ctx.workspaceId),
  ])

  const active = rows.filter(f => f.status === 'active' || f.status === 'at_risk')
  const atRisk = rows.filter(f => f.status === 'at_risk')
  const totalEntries = active.reduce((sum, f) => sum + f.entries, 0)
  const totalConversions = active.reduce((sum, f) => sum + f.conversions, 0)
  const conversionRate = totalEntries > 0 ? (totalConversions / totalEntries) * 100 : 0

  const kpis: KpiValue[] = [
    { id: 'active', label: 'Active funnels', value: formatCompactNumber(active.length), icon: 'funnel', tone: 'blue' },
    { id: 'rate', label: 'Funnel conversion rate', value: formatPercentValue(conversionRate), icon: 'funnel', tone: 'green' },
    { id: 'entries', label: 'Entries', value: formatCompactNumber(totalEntries), icon: 'leads', tone: 'violet' },
    { id: 'conversions', label: 'Completed conversions', value: formatCompactNumber(totalConversions), icon: 'health', tone: 'green' },
    { id: 'risk', label: 'Funnels at risk', value: formatCompactNumber(atRisk.length), icon: 'alert', tone: atRisk.length > 0 ? 'red' : 'slate' },
  ]

  return (
    <div className={WEB_PAGE}>
      <WebHeader
        module="funnels" modules={modules}
        actions={
          <>
            <NewFunnelButton allowed={capabilities.create} />
            <ImportButton allowed={capabilities.import} />
            <ExportButton entity="funnels" allowed={capabilities.export} />
            <HeaderOverflow items={[{ label: 'Refresh data' }]} />
          </>
        }
      />

      <KpiStrip items={kpis} className="mb-3" />

      <CampaignFilters
        className="mb-3"
        filters={[
          { key: 'status', label: 'Status', options: FUNNEL_STATUSES.map(s => ({ value: s, label: s.replace('_', ' ') })) },
          { key: 'owner', label: 'Owner', options: members.map(m => ({ value: m.id, label: m.full_name ?? m.email ?? 'Member' })) },
        ]}
        searchPlaceholder="Search funnels…"
      />

      {showCreate && <CreateFunnelForm />}
      {error && <LoadError message={error} className="mb-3" />}

      <Panel title="All funnels" info={`${total} funnels`} bodyClassName="px-0 pb-0">
        <FunnelsTable rows={rows} />
      </Panel>
    </div>
  )
}
