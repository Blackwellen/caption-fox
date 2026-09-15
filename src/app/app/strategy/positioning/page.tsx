import Link from 'next/link'
import { Download, Plus, Send } from 'lucide-react'
import { requireStrategyModule } from '@/lib/strategy/server'
import {
  getFrameworkDetail, listActivity, listFrameworks, listMessagingAssets, positioningAggregates,
} from '@/lib/strategy/data'
import { parseStrategyQuery, type RawParams } from '@/lib/strategy/query'
import {
  FRAMEWORK_STATUS_BADGE, FRAMEWORK_STATUS_LABELS, MATRIX_SCORE_DOT, MATRIX_SCORE_LABELS,
  PROOF_CATEGORY_LABELS, RISK_BADGE, RISK_LABELS, STRATEGY_MODULE_META, VERIFICATION_BADGE, VERIFICATION_LABELS,
} from '@/lib/strategy/constants'
import StrategyHeader from '@/components/strategy/StrategyHeader'
import ViewSwitcher from '@/components/strategy/ViewSwitcher'
import KpiStrip from '@/components/strategy/KpiStrip'
import FilterBar, { type FilterField } from '@/components/strategy/FilterBar'
import ActivityPanel from '@/components/strategy/ActivityPanel'
import { AccessState, EmptyState } from '@/components/strategy/states'
import {
  Avatar, CARD, CARD_SHADOW, Panel, ScoreRing, STRATEGY_PAGE, formatDayMonth,
} from '@/components/strategy/primitives'
import { cn } from '@/lib/utils'
import type { KpiValue } from '@/lib/strategy/types'

export const metadata = {
  title: 'Positioning · Strategy · Caption Fox',
  description: STRATEGY_MODULE_META.positioning.description,
}

const STATUS_TONE: Record<string, string> = {
  green: 'bg-emerald-50 text-emerald-600', amber: 'bg-amber-50 text-amber-600',
  red: 'bg-red-50 text-red-600', blue: 'bg-blue-50 text-blue-600', slate: 'bg-slate-100 text-slate-500',
}

export default async function PositioningPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const params = await searchParams
  const { supabase, ctx, capabilities, modules, access } = await requireStrategyModule('positioning')

  if (!access.allowed) {
    return (
      <div className={STRATEGY_PAGE}>
        <StrategyHeader module="positioning" modules={modules} />
        <AccessState access={access} />
      </div>
    )
  }

  const query = parseStrategyQuery(params, { views: ['framework', 'matrix', 'cards', 'table'], defaultView: 'framework' })

  const [frameworksPage, aggregates, assets, activity] = await Promise.all([
    listFrameworks(supabase, ctx.workspaceId, query),
    positioningAggregates(supabase, ctx.workspaceId),
    listMessagingAssets(supabase, ctx.workspaceId, 8),
    listActivity(supabase, ctx.workspaceId, { entityTypes: ['framework', 'proof_point', 'claim', 'competitor', 'approval'], limit: 5 }),
  ])

  const frameworks = frameworksPage.rows
  const primary = frameworks.find(f => f.is_primary) ?? frameworks[0]
  const detail = primary ? await getFrameworkDetail(supabase, ctx.workspaceId, primary.id) : null

  const kpis: KpiValue[] = [
    { id: 'active', label: 'Active frameworks', value: String(aggregates.activeFrameworks), tone: 'blue', icon: 'sparkles' },
    { id: 'approved', label: 'Approved messages', value: `${aggregates.approvedAssets} / ${aggregates.totalAssets}`, tone: 'green', icon: 'check',
      hint: aggregates.totalAssets ? `${Math.round((aggregates.approvedAssets / aggregates.totalAssets) * 100)}% approved` : undefined },
    { id: 'coverage', label: 'Proof coverage', value: `${aggregates.proofCoverage}%`, tone: 'violet', icon: 'shield' },
    { id: 'gaps', label: 'Competitor gaps', value: String(aggregates.competitorGaps), tone: 'amber', icon: 'target' },
    { id: 'consistency', label: 'Consistency score', value: `${aggregates.consistency} / 100`, tone: 'blue', icon: 'gauge' },
    { id: 'pending', label: 'Pending approvals', value: String(aggregates.pendingApprovals), tone: 'amber', icon: 'clock' },
  ]

  const filterFields: FilterField[] = [
    { key: 'status', label: 'Status', options: [
      { value: 'draft', label: 'Draft' }, { value: 'in_review', label: 'In review' },
      { value: 'approved', label: 'Approved' }, { value: 'changes_requested', label: 'Changes requested' },
    ] },
  ]

  return (
    <div className={STRATEGY_PAGE}>
      <StrategyHeader
        module="positioning" modules={modules}
        actions={(
          <>
            {capabilities.createFramework && (
              <Link href="/app/strategy/positioning?new=1" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-[13px] font-medium text-white hover:bg-blue-700">
                <Plus size={15} /> New framework
              </Link>
            )}
            {capabilities.editFramework && primary && (
              <button className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-[13px] font-medium text-slate-700 hover:bg-slate-50">
                <Plus size={15} /> Add proof point
              </button>
            )}
            {capabilities.editFramework && primary?.status === 'draft' && (
              <button className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-[13px] font-medium text-slate-700 hover:bg-slate-50">
                <Send size={15} /> Submit for approval
              </button>
            )}
            {capabilities.export && (
              <Link href="/app/strategy/positioning?export=1" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-[13px] font-medium text-slate-700 hover:bg-slate-50">
                <Download size={15} /> Export
              </Link>
            )}
          </>
        )}
      />

      <div className="mb-4"><KpiStrip items={kpis} /></div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <FilterBar query={query} fields={filterFields} />
        <ViewSwitcher views={['framework', 'matrix', 'cards', 'table']} active={query.view} />
      </div>

      {frameworks.length === 0
        ? (
          <EmptyState
            title="No positioning framework yet"
            message="Create your first positioning framework to define how you win in the market."
            action={capabilities.createFramework && (
              <Link href="/app/strategy/positioning?new=1" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-[13px] font-medium text-white hover:bg-blue-700">
                <Plus size={15} /> New framework
              </Link>
            )}
          />
        )
        : query.view === 'cards'
        ? <FrameworkCards frameworks={frameworks} />
        : query.view === 'table'
        ? <FrameworkTable frameworks={frameworks} />
        : query.view === 'matrix' && detail
        ? <MatrixView competitors={detail.competitors} attributes={detail.attributes} scores={detail.scores} />
        : primary && detail
        ? <FrameworkView framework={primary} detail={detail} />
        : null}

      {primary && detail && query.view !== 'matrix' && (
        <div className="mt-4 grid gap-4 xl:grid-cols-3">
          <Panel title="Key messaging assets" viewAllHref="/app/strategy/positioning?view=table" viewAllLabel="View all assets" className="xl:col-span-2" bodyClassName="px-0 pb-0">
            {assets.length === 0
              ? <EmptyState compact title="No messaging assets" message="Assets linked to this framework will appear here." className="px-4 pb-4" />
              : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[12px]">
                    <thead>
                      <tr className="border-t border-slate-100 text-[11px] text-slate-400">
                        <th className="px-4 py-2.5 font-medium">Asset</th>
                        <th className="px-2 py-2.5 font-medium">Type</th>
                        <th className="px-2 py-2.5 font-medium">Audience</th>
                        <th className="px-2 py-2.5 font-medium">Status</th>
                        <th className="px-4 py-2.5 font-medium">Last updated</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {assets.map(asset => (
                        <tr key={asset.id} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 font-medium text-slate-800">{asset.name}</td>
                          <td className="px-2 py-2.5 text-slate-500 capitalize">{asset.asset_type.replace('_', ' ')}</td>
                          <td className="px-2 py-2.5 text-slate-500">{asset.audience?.name ?? '—'}</td>
                          <td className="px-2 py-2.5">
                            <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', STATUS_TONE[FRAMEWORK_STATUS_BADGE[asset.status as keyof typeof FRAMEWORK_STATUS_BADGE] ?? 'slate'])}>
                              {FRAMEWORK_STATUS_LABELS[asset.status as keyof typeof FRAMEWORK_STATUS_LABELS] ?? asset.status}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-slate-400">{formatDayMonth(asset.updated_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
          </Panel>

          <ActivityPanel title="Recent Activity & Approvals" rows={activity} viewAllHref="/app/strategy/positioning?view=table" />
        </div>
      )}
    </div>
  )
}

type FrameworkRowT = Awaited<ReturnType<typeof listFrameworks>>['rows'][number]
type FrameworkDetail = Awaited<ReturnType<typeof getFrameworkDetail>>

function FrameworkView({ framework, detail }: { framework: FrameworkRowT; detail: FrameworkDetail }) {
  const highRiskClaims = detail.claims.filter(c => c.risk_level === 'high').length
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <Panel title="Value Proposition Framework" action={framework.is_primary && (
        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600">Primary</span>
      )}>
        <div className="rounded-xl bg-slate-50 p-4 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Category promise</p>
          <p className="mt-1 text-[13px] font-semibold text-slate-900">{framework.category_promise || 'No category promise set yet.'}</p>
        </div>

        {detail.pillars.length > 0 && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            {detail.pillars.map(pillar => (
              <div key={pillar.id} className="rounded-lg bg-emerald-50/60 p-2.5">
                <p className="text-[11px] font-semibold text-slate-800">{pillar.name}</p>
                {pillar.description && <p className="mt-0.5 text-[10px] text-slate-500">{pillar.description}</p>}
              </div>
            ))}
          </div>
        )}

        {detail.proofPoints.length > 0 && (
          <div className="mt-3 rounded-lg bg-purple-50/60 p-2.5 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Proof points</p>
            <p className="mt-0.5 text-[11px] font-medium text-slate-700">
              {detail.proofPoints.slice(0, 3).map(p => p.label).join(' · ')}
            </p>
          </div>
        )}

        {framework.foundation && (
          <div className="mt-3 rounded-lg bg-amber-50/60 p-2.5 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Foundation</p>
            <p className="mt-0.5 text-[11px] font-medium text-slate-700">{framework.foundation}</p>
          </div>
        )}

        <p className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
          <span>Last updated {formatDayMonth(framework.updated_at)} by {framework.owner?.full_name ?? 'Unknown'}</span>
        </p>
      </Panel>

      <Panel title="Positioning Statement">
        <blockquote className="text-[13px] italic leading-relaxed text-slate-700">
          &ldquo;{framework.positioning_statement || 'No positioning statement written yet.'}&rdquo;
        </blockquote>
        {framework.audience && (
          <p className="mt-3 text-[11px] text-slate-500">
            Target audience <br />
            <Link href="/app/strategy/audiences" className="font-medium text-blue-600 hover:text-blue-700">{framework.audience.name}</Link>
          </p>
        )}

        <div className="mt-4 border-t border-slate-100 pt-3">
          <p className="mb-2 text-[12px] font-semibold text-slate-800">Audience–Message Fit</p>
          <div className="flex items-center gap-3">
            <ScoreRing value={framework.consistency_score} colour="#10b981" size={54} />
            <ul className="flex-1 space-y-1 text-[11px] text-slate-500">
              <li className="flex items-center justify-between"><span>Highly aligned</span><span className="font-medium text-slate-700">{Math.round(framework.consistency_score * 0.5)}%</span></li>
              <li className="flex items-center justify-between"><span>Aligned</span><span className="font-medium text-slate-700">{Math.round(framework.consistency_score * 0.4)}%</span></li>
              <li className="flex items-center justify-between"><span>Low alignment</span><span className="font-medium text-slate-700">{Math.max(0, 100 - framework.consistency_score)}%</span></li>
            </ul>
          </div>
        </div>
      </Panel>

      <div className="space-y-4">
        <Panel title="Proof Points & Evidence" viewAllHref="/app/strategy/positioning?view=table" viewAllLabel="View all">
          {detail.proofPoints.length === 0
            ? <EmptyState compact title="No proof points" message="Add proof points to support this framework." />
            : (
              <ul className="space-y-2">
                {detail.proofPoints.slice(0, 4).map(point => (
                  <li key={point.id} className="flex items-center justify-between gap-2 text-[11px]">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-700">{point.label}</p>
                      <span className="text-slate-400">{PROOF_CATEGORY_LABELS[point.category] ?? point.category}</span>
                    </div>
                    <span className={cn('shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium', STATUS_TONE[VERIFICATION_BADGE[point.verification] ?? 'slate'])}>
                      {VERIFICATION_LABELS[point.verification] ?? point.verification}
                    </span>
                  </li>
                ))}
              </ul>
            )}
        </Panel>

        <Panel title="Claims Risk Assessment" viewAllHref="/app/strategy/positioning?view=table" viewAllLabel="Review risk guidelines">
          {detail.claims.length === 0
            ? <EmptyState compact title="No claims recorded" message={highRiskClaims > 0 ? '' : 'Claims and their risk level will appear here.'} />
            : (
              <ul className="space-y-2">
                {detail.claims.slice(0, 4).map(claim => (
                  <li key={claim.id} className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="min-w-0 truncate text-slate-700">{claim.claim}</span>
                    <span className={cn('shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium', STATUS_TONE[RISK_BADGE[claim.risk_level as keyof typeof RISK_BADGE] ?? 'slate'])}>
                      {RISK_LABELS[claim.risk_level as keyof typeof RISK_LABELS] ?? claim.risk_level}
                    </span>
                  </li>
                ))}
              </ul>
            )}
        </Panel>
      </div>
    </div>
  )
}

function FrameworkCards({ frameworks }: { frameworks: FrameworkRowT[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {frameworks.map(framework => (
        <div key={framework.id} className={cn(CARD, CARD_SHADOW, 'p-4')}>
          <div className="mb-2 flex items-start justify-between gap-2">
            <h3 className="text-[13px] font-semibold text-slate-900">{framework.name}</h3>
            {framework.is_primary && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600">Primary</span>}
          </div>
          <p className="line-clamp-2 text-[12px] text-slate-500">{framework.category_promise}</p>
          <div className="mt-3 flex items-center justify-between text-[11px]">
            <span className={cn('rounded-full px-2 py-0.5 font-medium', STATUS_TONE[FRAMEWORK_STATUS_BADGE[framework.status as keyof typeof FRAMEWORK_STATUS_BADGE] ?? 'slate'])}>
              {FRAMEWORK_STATUS_LABELS[framework.status as keyof typeof FRAMEWORK_STATUS_LABELS] ?? framework.status}
            </span>
            <Avatar person={framework.owner} size={20} />
          </div>
        </div>
      ))}
    </div>
  )
}

function FrameworkTable({ frameworks }: { frameworks: FrameworkRowT[] }) {
  return (
    <Panel bodyClassName="px-0 pb-0">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[12px]">
          <thead>
            <tr className="border-t border-slate-100 text-[11px] text-slate-400">
              <th className="px-4 py-2.5 font-medium">Framework</th>
              <th className="px-2 py-2.5 font-medium">Owner</th>
              <th className="px-2 py-2.5 font-medium">Status</th>
              <th className="px-2 py-2.5 font-medium">Version</th>
              <th className="px-2 py-2.5 font-medium">Consistency</th>
              <th className="px-4 py-2.5 font-medium">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {frameworks.map(framework => (
              <tr key={framework.id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5 font-medium text-slate-800">{framework.name}</td>
                <td className="px-2 py-2.5"><Avatar person={framework.owner} size={20} /></td>
                <td className="px-2 py-2.5 text-slate-500">{FRAMEWORK_STATUS_LABELS[framework.status as keyof typeof FRAMEWORK_STATUS_LABELS] ?? framework.status}</td>
                <td className="px-2 py-2.5 text-slate-500">v{framework.version}</td>
                <td className="px-2 py-2.5 text-slate-500">{framework.consistency_score}%</td>
                <td className="px-4 py-2.5 text-slate-400">{formatDayMonth(framework.updated_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

function MatrixView({
  competitors, attributes, scores,
}: {
  competitors: FrameworkDetail['competitors']
  attributes: FrameworkDetail['attributes']
  scores: FrameworkDetail['scores']
}) {
  if (attributes.length === 0 || competitors.length === 0) {
    return <EmptyState title="No competitive matrix yet" message="Add competitors and attributes to build the differentiation matrix." />
  }
  const scoreFor = (competitorId: string, attributeId: string) =>
    scores.find(s => s.competitor_id === competitorId && s.attribute_id === attributeId)?.score ?? 'na'

  return (
    <Panel title="Competitive Differentiation Matrix" bodyClassName="px-0 pb-0">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[12px]">
          <thead>
            <tr className="border-t border-slate-100 text-[11px] text-slate-500">
              <th className="px-4 py-2.5 font-medium">Attribute</th>
              {competitors.map(competitor => (
                <th key={competitor.id} className={cn('px-3 py-2.5 text-center font-medium', competitor.is_self && 'text-blue-600')}>
                  {competitor.name}{competitor.is_self ? ' (Us)' : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {attributes.map(attribute => (
              <tr key={attribute.id}>
                <td className="px-4 py-2.5 font-medium text-slate-700">{attribute.name}</td>
                {competitors.map(competitor => {
                  const score = scoreFor(competitor.id, attribute.id)
                  return (
                    <td key={competitor.id} className="px-3 py-2.5 text-center">
                      <span
                        className={cn('inline-block h-2.5 w-2.5 rounded-full', MATRIX_SCORE_DOT[score as keyof typeof MATRIX_SCORE_DOT])}
                        title={MATRIX_SCORE_LABELS[score as keyof typeof MATRIX_SCORE_LABELS]}
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 px-4 py-3 text-[11px] text-slate-500">
        {Object.entries(MATRIX_SCORE_LABELS).map(([key, label]) => (
          <span key={key} className="flex items-center gap-1.5">
            <span className={cn('h-2 w-2 rounded-full', MATRIX_SCORE_DOT[key as keyof typeof MATRIX_SCORE_DOT])} />
            {label}
          </span>
        ))}
      </div>
    </Panel>
  )
}
