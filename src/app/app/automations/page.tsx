import Link from 'next/link'
import { requireAutomationModule } from '@/lib/automations/server'
import {
  automationAggregates, delta, listAutomations, listTemplates, recentRuns, listNotifications,
} from '@/lib/automations/data'
import { hasAnyFilter, parseAutomationsQuery, type RawParams } from '@/lib/automations/query'
import {
  AUTOMATION_SORTS, AUTOMATION_STATUS_BADGE, AUTOMATION_STATUS_LABELS, AUTOMATION_STATUSES,
  RISK_LEVEL_BADGE, RUN_STATUS_BADGE, RUN_STATUS_LABELS, TEMPLATE_CATEGORIES, TEMPLATE_CATEGORY_LABELS,
} from '@/lib/automations/constants'
import AutomationsHeader from '@/components/automations/AutomationsHeader'
import KpiStrip from '@/components/automations/KpiStrip'
import FilterBar, { type FilterSpec } from '@/components/automations/FilterBar'
import Pagination from '@/components/automations/Pagination'
import AutomationRowActions from '@/components/automations/AutomationRowActions'
import TemplateInstallButton from '@/components/automations/TemplateInstallButton'
import { AccessBlocked, AutomationsEmpty, LoadError } from '@/components/automations/states'
import {
  AUTOMATIONS_PAGE, CARD, CARD_SHADOW, Panel, PersonChip, formatAgo, formatNumber, formatPercent,
} from '@/components/automations/primitives'
import { Badge } from '@/components/ui/Badge'
import type { KpiValue } from '@/lib/automations/types'

export const metadata = { title: 'Automations · Caption Fox' }

export default async function AutomationsPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const params = await searchParams
  const { supabase, ctx, capabilities, modules, access } = await requireAutomationModule('overview')

  if (!access.allowed) {
    return (
      <div className={AUTOMATIONS_PAGE}>
        <AutomationsHeader module="overview" modules={modules} />
        <AccessBlocked access={access} />
      </div>
    )
  }

  const query = parseAutomationsQuery(params)
  const workspaceId = ctx.workspaceId

  const [aggregates, page, templates, runs, notifications] = await Promise.all([
    automationAggregates(supabase, workspaceId),
    listAutomations(supabase, workspaceId, query),
    listTemplates(supabase),
    recentRuns(supabase, workspaceId, 8),
    listNotifications(supabase, workspaceId, 6),
  ])

  const activeDelta = delta(aggregates.active, aggregates.previousActive)
  const runsDelta = delta(aggregates.runsToday, aggregates.previousRunsToday)
  const successDelta = aggregates.successRate - aggregates.previousSuccessRate

  const kpis: KpiValue[] = [
    { id: 'total', label: 'Total automations', value: formatNumber(aggregates.total), hint: `${capabilities.activeLimit} active allowed on your plan`, icon: 'layers', tone: 'blue' },
    { id: 'active', label: 'Active', value: formatNumber(aggregates.active), hint: `${activeDelta.pct >= 0 ? '+' : ''}${activeDelta.pct.toFixed(1)}% vs last 30 days`, trend: activeDelta.trend, icon: 'zap', tone: 'green', spark: aggregates.runsSeries },
    { id: 'runs', label: 'Runs today', value: formatNumber(aggregates.runsToday), hint: `${runsDelta.pct >= 0 ? '+' : ''}${runsDelta.pct.toFixed(1)}% vs yesterday`, trend: runsDelta.trend, icon: 'trend', tone: 'blue' },
    { id: 'success', label: 'Success rate', value: formatPercent(aggregates.successRate), hint: `${successDelta >= 0 ? '+' : ''}${successDelta.toFixed(1)}pp vs last 30 days`, trend: successDelta >= 0 ? 'up' : 'down', icon: 'checks', tone: 'green' },
    { id: 'failed', label: 'Failed runs', value: formatNumber(aggregates.failedRuns), hint: aggregates.failedRuns > 0 ? 'Review in run history' : 'All clear', icon: 'failed', tone: aggregates.failedRuns > 0 ? 'red' : 'slate', href: '/app/automations/logs?status=failed' },
    { id: 'notifications', label: 'Unread notifications', value: formatNumber(aggregates.pendingNotifications), hint: 'From automation runs', icon: 'bell', tone: aggregates.pendingNotifications > 0 ? 'amber' : 'slate' },
  ]

  const filters: FilterSpec[] = [
    { key: 'status', label: 'Status', allLabel: 'All statuses', options: AUTOMATION_STATUSES.map(s => ({ value: s, label: AUTOMATION_STATUS_LABELS[s] })) },
    { key: 'sort', label: 'Sort', allLabel: 'Sort: Recently updated', options: AUTOMATION_SORTS.map(s => ({ value: s.id, label: s.label })), advanced: true },
  ]

  const filtered = hasAnyFilter(query)
  const installedKeys = new Set<string>()
  const { data: installed } = await supabase.from('automations').select('source_template_key').eq('workspace_id', workspaceId)
  for (const row of installed ?? []) if (row.source_template_key) installedKeys.add(row.source_template_key as string)

  const templatesByCategory = TEMPLATE_CATEGORIES.map(category => ({
    category, label: TEMPLATE_CATEGORY_LABELS[category],
    items: templates.filter(t => t.category === category && (!query.category || query.category === category)),
  })).filter(group => group.items.length > 0)

  return (
    <div className={AUTOMATIONS_PAGE}>
      <AutomationsHeader
        module="overview" modules={modules}
        actions={capabilities.create && (
          <span className="text-[12px] text-slate-400">Choose a recipe below to install a draft automation</span>
        )}
      />

      <div className="space-y-4">
        <KpiStrip items={kpis} />

        <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
          <div className="space-y-4">
            <Panel title="Recipe library" info="Every recipe installs as a draft — nothing runs until you activate it.">
              {templatesByCategory.length === 0 ? (
                <AutomationsEmpty title="No recipes match this filter" message="Clear the category filter to see the full library." icon="search" />
              ) : (
                <div className="space-y-4">
                  {templatesByCategory.map(group => (
                    <div key={group.category}>
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{group.label}</p>
                      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                        {group.items.map(template => (
                          <div key={template.key} className={`${CARD} flex flex-col gap-2 p-3`}>
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-[12.5px] font-semibold text-slate-900">{template.name}</p>
                              <Badge variant={RISK_LEVEL_BADGE[template.risk_level] ?? 'slate'}>{template.risk_level}</Badge>
                            </div>
                            <p className="flex-1 text-[11.5px] text-slate-500">{template.description}</p>
                            <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                              <span className="text-[10.5px] text-slate-400">Trigger: {template.trigger_key}</span>
                              {capabilities.create && (
                                installedKeys.has(template.key)
                                  ? <span className="text-[11px] font-medium text-emerald-600">Installed</span>
                                  : <TemplateInstallButton templateKey={template.key} />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <FilterBar searchPlaceholder="Search automations…" filters={filters} values={query} />

            {page.error ? (
              <LoadError message={page.error} />
            ) : page.rows.length === 0 ? (
              <AutomationsEmpty
                icon={filtered ? 'search' : 'automation'}
                title={filtered ? 'No automations match these filters' : 'No automations yet'}
                message={filtered ? 'Try widening your filters.' : 'Install a recipe above to create your first automation.'}
              />
            ) : (
              <div className={`${CARD} ${CARD_SHADOW} overflow-hidden`}>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[820px] text-left text-[13px]">
                    <thead>
                      <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400">
                        <th className="px-4 py-2.5 font-medium">Automation</th>
                        <th className="px-3 py-2.5 font-medium">Trigger</th>
                        <th className="px-3 py-2.5 font-medium">Status</th>
                        <th className="px-3 py-2.5 font-medium">Runs</th>
                        <th className="px-3 py-2.5 font-medium">Success rate</th>
                        <th className="px-3 py-2.5 font-medium">Last run</th>
                        <th className="px-4 py-2.5 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {page.rows.map(automation => {
                        const successRate = automation.run_count > 0 ? (automation.success_count / automation.run_count) * 100 : null
                        return (
                          <tr key={automation.id} className="hover:bg-slate-50/60">
                            <td className="px-4 py-2.5">
                              <p className="font-medium text-slate-900">{automation.name}</p>
                              {automation.is_demo && <span className="text-[10.5px] text-slate-400">Demo</span>}
                            </td>
                            <td className="px-3 py-2.5 text-slate-500">{automation.trigger_key}</td>
                            <td className="px-3 py-2.5"><Badge variant={AUTOMATION_STATUS_BADGE[automation.status as keyof typeof AUTOMATION_STATUS_BADGE] ?? 'slate'}>{AUTOMATION_STATUS_LABELS[automation.status as keyof typeof AUTOMATION_STATUS_LABELS] ?? automation.status}</Badge></td>
                            <td className="px-3 py-2.5 text-slate-700">{formatNumber(automation.run_count)}</td>
                            <td className="px-3 py-2.5 text-slate-700">{successRate === null ? '—' : formatPercent(successRate, 0)}</td>
                            <td className="px-3 py-2.5 text-slate-500">{automation.last_run_at ? formatAgo(automation.last_run_at) : 'Never run'}</td>
                            <td className="px-4 py-2.5 text-right">
                              <AutomationRowActions
                                id={automation.id} status={automation.status}
                                canActivate={capabilities.activate} canRemove={capabilities.remove} canRunManually={capabilities.runManually}
                              />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <Pagination page={query.page} size={query.size} total={page.total} label="automations" />
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <Panel title="Recent runs" viewAllHref="/app/automations/logs">
              {runs.length === 0 ? (
                <p className="py-4 text-center text-[12.5px] text-slate-400">No runs yet.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {runs.map(run => (
                    <li key={run.id} className="py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-[12.5px] font-medium text-slate-800">{run.automation?.name ?? 'Unknown automation'}</p>
                        <Badge variant={RUN_STATUS_BADGE[run.status as keyof typeof RUN_STATUS_BADGE] ?? 'slate'}>{RUN_STATUS_LABELS[run.status as keyof typeof RUN_STATUS_LABELS] ?? run.status}</Badge>
                      </div>
                      <p className="text-[11px] text-slate-400">{run.trigger_source} · {formatAgo(run.started_at)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Notifications">
              {notifications.length === 0 ? (
                <p className="py-4 text-center text-[12.5px] text-slate-400">No automation notifications yet.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {notifications.map(n => (
                    <li key={n.id} className="py-2.5">
                      <p className="text-[12.5px] font-medium text-slate-800">{n.title}</p>
                      <p className="text-[11.5px] text-slate-500">{n.message}</p>
                      <p className="mt-0.5 text-[10.5px] text-slate-400">{formatAgo(n.created_at)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Plan limits">
              <dl className="space-y-2 text-[12.5px]">
                <div className="flex items-center justify-between"><dt className="text-slate-500">Active automations</dt><dd className="font-medium text-slate-900">{aggregates.active} / {capabilities.activeLimit}</dd></div>
              </dl>
              {aggregates.active >= capabilities.activeLimit && (
                <p className="mt-2 text-[11.5px] text-amber-600">You've reached your plan's active automation limit. <Link href="/app/settings/billing" className="underline">Upgrade</Link> to activate more.</p>
              )}
            </Panel>
          </aside>
        </div>
      </div>
    </div>
  )
}
