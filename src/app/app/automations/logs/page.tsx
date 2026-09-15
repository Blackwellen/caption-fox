import { requireAutomationModule } from '@/lib/automations/server'
import { listRuns, runActionLogs, automationPickerList } from '@/lib/automations/data'
import { hasAnyFilter, parseRunLogsQuery, type RawParams } from '@/lib/automations/query'
import { RUN_STATUS_BADGE, RUN_STATUS_LABELS, RUN_STATUSES, TRIGGER_SOURCES, TRIGGER_SOURCE_LABELS } from '@/lib/automations/constants'
import AutomationsHeader from '@/components/automations/AutomationsHeader'
import FilterBar, { type FilterSpec } from '@/components/automations/FilterBar'
import Pagination from '@/components/automations/Pagination'
import { AccessBlocked, AutomationsEmpty, LoadError } from '@/components/automations/states'
import { AUTOMATIONS_PAGE, CARD, CARD_SHADOW, formatDateTime, formatDuration } from '@/components/automations/primitives'
import { Badge } from '@/components/ui/Badge'

export const metadata = { title: 'Automation run history · Caption Fox' }

export default async function AutomationLogsPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const params = await searchParams
  const { supabase, ctx, modules, access } = await requireAutomationModule('logs')

  if (!access.allowed) {
    return (
      <div className={AUTOMATIONS_PAGE}>
        <AutomationsHeader module="logs" modules={modules} />
        <AccessBlocked access={access} />
      </div>
    )
  }

  const query = parseRunLogsQuery(params)
  const workspaceId = ctx.workspaceId

  const [page, automations] = await Promise.all([
    listRuns(supabase, workspaceId, query),
    automationPickerList(supabase, workspaceId),
  ])

  const selectedRunId = query.q ? '' : page.rows[0]?.id ?? ''
  const actionLogs = selectedRunId ? await runActionLogs(supabase, workspaceId, selectedRunId) : []

  const filters: FilterSpec[] = [
    { key: 'status', label: 'Status', allLabel: 'All statuses', options: RUN_STATUSES.map(s => ({ value: s, label: RUN_STATUS_LABELS[s] })) },
    { key: 'source', label: 'Trigger source', allLabel: 'All sources', options: TRIGGER_SOURCES.map(s => ({ value: s, label: TRIGGER_SOURCE_LABELS[s] })) },
    { key: 'automation', label: 'Automation', allLabel: 'All automations', options: automations.map(a => ({ value: a.id, label: a.name })), advanced: true },
  ]

  const filtered = hasAnyFilter(query)

  return (
    <div className={AUTOMATIONS_PAGE}>
      <AutomationsHeader module="logs" modules={modules} />

      <div className="space-y-4">
        <FilterBar searchPlaceholder="Search runs…" filters={filters} values={query} />

        <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
          <div className={`${CARD} ${CARD_SHADOW} overflow-hidden`}>
            {page.error ? (
              <div className="p-4"><LoadError message={page.error} /></div>
            ) : page.rows.length === 0 ? (
              <div className="p-4">
                <AutomationsEmpty
                  icon={filtered ? 'search' : 'automation'}
                  title={filtered ? 'No runs match these filters' : 'No runs yet'}
                  message={filtered ? 'Try widening your filters.' : 'Runs will appear here as your automations fire.'}
                />
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-[13px]">
                    <thead>
                      <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400">
                        <th className="px-4 py-2.5 font-medium">Automation</th>
                        <th className="px-3 py-2.5 font-medium">Trigger source</th>
                        <th className="px-3 py-2.5 font-medium">Status</th>
                        <th className="px-3 py-2.5 font-medium">Started</th>
                        <th className="px-3 py-2.5 font-medium">Duration</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {page.rows.map(run => (
                        <tr key={run.id} className={run.id === selectedRunId ? 'bg-blue-50/50' : ''}>
                          <td className="px-4 py-2.5 font-medium text-slate-900">{run.automation?.name ?? 'Unknown automation'}</td>
                          <td className="px-3 py-2.5 text-slate-500">{TRIGGER_SOURCE_LABELS[run.trigger_source] ?? run.trigger_source}</td>
                          <td className="px-3 py-2.5"><Badge variant={RUN_STATUS_BADGE[run.status as keyof typeof RUN_STATUS_BADGE] ?? 'slate'}>{RUN_STATUS_LABELS[run.status as keyof typeof RUN_STATUS_LABELS] ?? run.status}</Badge></td>
                          <td className="px-3 py-2.5 text-slate-500">{formatDateTime(run.started_at)}</td>
                          <td className="px-3 py-2.5 text-slate-500">{formatDuration(run.started_at, run.finished_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination page={query.page} size={query.size} total={page.total} label="runs" />
              </>
            )}
          </div>

          <div className={`${CARD} ${CARD_SHADOW} flex flex-col overflow-hidden`}>
            <div className="border-b border-slate-100 px-4 py-3"><h2 className="text-[13px] font-semibold text-slate-900">Action log</h2></div>
            <div className="flex-1 p-4">
              {actionLogs.length === 0 ? (
                <p className="py-6 text-center text-[12.5px] text-slate-400">Select a run to see its action-by-action log.</p>
              ) : (
                <ul className="space-y-3">
                  {actionLogs.map(log => (
                    <li key={log.id} className="border-l-2 pl-3" style={{ borderColor: log.status === 'success' ? '#10b981' : log.status === 'failed' ? '#ef4444' : '#94a3b8' }}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[12.5px] font-medium text-slate-800">{log.action_key}</p>
                        <Badge variant={log.status === 'success' ? 'green' : log.status === 'failed' ? 'red' : 'slate'}>{log.status}</Badge>
                      </div>
                      {log.message && <p className="mt-0.5 text-[11.5px] text-slate-500">{log.message}</p>}
                      <p className="mt-0.5 text-[10.5px] text-slate-400">{formatDateTime(log.created_at)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
