import { requireWebModule } from '@/lib/web/server'
import { computeExperimentStats, listExperiments, workspaceMembers } from '@/lib/web/data'
import { parseWebQuery, type RawParams } from '@/lib/web/query'
import { EXPERIMENT_STATUSES } from '@/lib/web/constants'
import WebHeader from '@/components/web/WebHeader'
import KpiStrip from '@/components/web/KpiStrip'
import CampaignFilters from '@/components/campaigns/CampaignFilters'
import ExperimentsTable from '@/components/web/ExperimentsTable'
import { CreateExperimentForm } from '@/components/web/CreateEntityForms'
import { ImportButton, ExportButton, HeaderOverflow } from '@/components/web/ActionButtons'
import { AccessBlocked, LoadError } from '@/components/web/states'
import { WEB_PAGE, Panel, formatCompactNumber, formatSignedPercent } from '@/components/web/primitives'
import type { KpiValue } from '@/lib/web/types'
import Link from 'next/link'
import { Plus } from 'lucide-react'

export const metadata = { title: 'Experiments · Web and Conversion · Caption Fox' }

export default async function WebExperimentsPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const params = await searchParams
  const { supabase, ctx, capabilities, modules, access } = await requireWebModule('experiments')

  if (!access.allowed) {
    return (
      <div className={WEB_PAGE}>
        <WebHeader module="experiments" modules={modules} />
        <AccessBlocked access={access} />
      </div>
    )
  }

  const query = parseWebQuery(params)
  const showCreate = params.new === '1' && capabilities.create

  const [{ rows, total, error }, members] = await Promise.all([
    listExperiments(supabase, ctx.workspaceId, query, { limit: 50 }),
    workspaceMembers(supabase, ctx.workspaceId),
  ])

  const running = rows.filter(e => e.status === 'running')
  const withStats = rows.map(e => ({ row: e, stats: computeExperimentStats(e.control_visitors, e.control_conversions, e.variant_visitors, e.variant_conversions) }))
  const measurable = withStats.filter(w => w.stats.hasEnoughData || w.row.status === 'running' || w.row.status === 'analyzing' || w.row.status === 'completed')
  const avgUplift = measurable.length > 0 ? measurable.reduce((sum, w) => sum + w.stats.upliftPercent, 0) / measurable.length : 0
  const winning = rows.filter(e => e.winner).length
  const highConfidence = withStats.filter(w => w.stats.hasEnoughData && w.stats.confidencePercent >= 95).length
  const needingReview = rows.filter(e => e.status === 'analyzing').length

  const kpis: KpiValue[] = [
    { id: 'active', label: 'Active experiments', value: formatCompactNumber(rows.filter(e => e.status !== 'archived').length), icon: 'experiment', tone: 'blue' },
    { id: 'running', label: 'Experiments running', value: formatCompactNumber(running.length), icon: 'gauge', tone: 'green' },
    { id: 'uplift', label: 'Avg. uplift', value: formatSignedPercent(avgUplift), icon: 'funnel', tone: 'amber' },
    { id: 'winning', label: 'Winning variants', value: formatCompactNumber(winning), icon: 'health', tone: 'green' },
    { id: 'confidence', label: 'Confidence above 95%', value: formatCompactNumber(highConfidence), icon: 'experiment', tone: 'violet' },
    { id: 'review', label: 'Needing review', value: formatCompactNumber(needingReview), icon: 'alert', tone: needingReview > 0 ? 'amber' : 'slate' },
  ]

  return (
    <div className={WEB_PAGE}>
      <WebHeader
        module="experiments" modules={modules}
        actions={
          <>
            {capabilities.create && (
              <Link href="/app/web/experiments?new=1" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-blue-700">
                <Plus size={14} />
                New experiment
              </Link>
            )}
            <ImportButton allowed={capabilities.import} />
            <ExportButton entity="experiments" allowed={capabilities.export} />
            <HeaderOverflow items={[{ label: 'Refresh data' }]} />
          </>
        }
      />

      <KpiStrip items={kpis} className="mb-3" />

      <CampaignFilters
        className="mb-3"
        filters={[
          { key: 'status', label: 'Status', options: EXPERIMENT_STATUSES.map(s => ({ value: s, label: s })) },
          { key: 'owner', label: 'Owner', options: members.map(m => ({ value: m.id, label: m.full_name ?? m.email ?? 'Member' })) },
        ]}
        searchPlaceholder="Search experiments…"
      />

      {showCreate && <CreateExperimentForm />}
      {error && <LoadError message={error} className="mb-3" />}

      <Panel title="All experiments" info={`${total} experiments`} bodyClassName="px-0 pb-0">
        <ExperimentsTable rows={rows} />
      </Panel>
    </div>
  )
}
