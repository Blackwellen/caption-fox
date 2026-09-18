import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowRight, BarChart3, BadgeCheck, Brain, Check, MoreHorizontal, Clock3, FileText, Globe, Presentation, Quote, Shield, ShieldCheck, Sparkles, Star, Workflow, Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getStrategyPageContext } from '@/lib/strategy/page-context'
import { getFrameworkDetail, listActivity, listFrameworks, listMessagingAssets } from '@/lib/strategy/data'
import { parseStrategyQuery, type RawParams } from '@/lib/strategy/query'
import { compare, loadSnapshots, refreshSnapshot } from '@/lib/strategy/kpis'
import { audienceFitBands, average, competitorGaps, pct } from '@/lib/strategy/metrics'
import { formatDate, formatRelative, shortName } from '@/lib/strategy/format'
import {
  APPROVAL_STAGE_LABELS, FRAMEWORK_STATUS_LABELS, FRAMEWORK_STATUSES, MARKET_LABELS, MATRIX_SCORES, PROOF_CATEGORY_LABELS, RISK_LABELS, STRATEGY_MARKETS, strategyPath,
  type ApprovalStage, type FrameworkStatus, type MatrixScore, type RiskLevel,
} from '@/lib/strategy/constants'
import StrategyHeader from '@/components/strategy/StrategyHeader'
import KpiStrip, { type KpiItem } from '@/components/strategy/KpiStrip'
import { ClearFilters, MoreFilters, SelectFilter, ViewSwitcher } from '@/components/strategy/FilterBar'
import { Avatar, CARD, FooterLink, HeaderLink, Panel, ScoreRing, TableScroll } from '@/components/strategy/primitives'
import { EmptyState, PanelError } from '@/components/strategy/states'
import { StatusChip } from '@/components/strategy/badges'
import {
  ApprovalControls, FrameworkMenu, MatrixCell, PositioningHeaderActions, ProofVerificationMenu,
} from '@/components/strategy/positioning/PositioningClient'

export const metadata: Metadata = {
  title: 'Positioning · Strategy · Caption Fox',
  description: 'Define, differentiate, and validate how we win in the market.',
}

const VIEWS = ['framework', 'matrix', 'cards', 'table'] as const
const PILLAR_ICON: Record<string, typeof Brain> = { brain: Brain, shield: Shield, workflow: Workflow, chart: BarChart3, globe: Globe, zap: Zap, star: Star }
const PROOF_ICON: Record<string, typeof Brain> = { trust: ShieldCheck, efficiency: Zap, reliability: Clock3, ecosystem: Sparkles, results: BarChart3, other: BadgeCheck }
const CATEGORY_TONE: Record<string, string> = {
  trust: 'bg-indigo-50 text-indigo-600', efficiency: 'bg-indigo-50 text-indigo-600', reliability: 'bg-indigo-50 text-indigo-600',
  ecosystem: 'bg-indigo-50 text-indigo-600', results: 'bg-indigo-50 text-indigo-600', other: 'bg-slate-100 text-slate-600',
}
const IMPACT_TONE: Record<string, string> = { high: 'bg-emerald-100/70 text-emerald-700', medium: 'bg-orange-100/70 text-orange-600', low: 'bg-slate-100 text-slate-500' }
const RISK_TONE: Record<string, string> = { low: 'bg-emerald-100/70 text-emerald-700', medium: 'bg-orange-100/70 text-orange-600', high: 'bg-red-100/70 text-red-600' }
const SCORE_DOT: Record<MatrixScore, string> = { strong: 'bg-emerald-500', moderate: 'bg-amber-400', weak: 'bg-red-500', na: 'bg-slate-300' }

export default async function PositioningPage({
  params, searchParams,
}: { params: Promise<{ workspaceType: string }>; searchParams: Promise<RawParams> }) {
  const [{ workspaceType: kind }, search] = await Promise.all([params, searchParams])
  const page = await getStrategyPageContext(kind, 'positioning')
  const { supabase, capabilities: can, userId } = page
  const workspaceId = page.workspace.id
  const q = parseStrategyQuery(search, { views: [...VIEWS], defaultView: 'framework' })
  const view = q.view as typeof VIEWS[number]
  const selectedParam = q.framework
  q.framework = ''
  const now = new Date()

  const [list, allFrameworks, assets, allAssets, proofRows, approvalsPending, audiences, research, snapshots, activity] = await Promise.all([
    listFrameworks(supabase, workspaceId, q),
    supabase.from('strategy_positioning_frameworks').select('id, name, is_primary, consistency_score, status').eq('workspace_id', workspaceId).is('archived_at', null).order('is_primary', { ascending: false }).order('name'),
    listMessagingAssets(supabase, workspaceId, 4),
    supabase.from('strategy_messaging_assets').select('status').eq('workspace_id', workspaceId),
    supabase.from('strategy_proof_points').select('verification').eq('workspace_id', workspaceId),
    supabase.from('strategy_approvals').select('id, stage').eq('workspace_id', workspaceId).eq('status', 'pending').neq('stage', 'approved'),
    supabase.from('strategy_audiences').select('id, name, fit_score, audience_size').eq('workspace_id', workspaceId).is('archived_at', null).order('name'),
    supabase.from('strategy_research_items').select('id, title').eq('workspace_id', workspaceId).is('archived_at', null).eq('status', 'approved').order('updated_at', { ascending: false }).limit(60),
    loadSnapshots(supabase, workspaceId, now),
    listActivity(supabase, workspaceId, { limit: 4, surface: 'positioning' }),
  ])

  const frameworkOptions = ((allFrameworks.data ?? []) as { id: string; name: string; is_primary: boolean; consistency_score: number; status: string }[])
  const selected = list.rows.find(row => row.id === selectedParam) ?? list.rows.find(row => row.is_primary) ?? list.rows[0] ?? null
  const [detail, fitLinks] = selected
    ? await Promise.all([
      getFrameworkDetail(supabase, workspaceId, selected.id),
      supabase.from('strategy_links').select('target_id').eq('workspace_id', workspaceId).eq('source_type', 'framework').eq('source_id', selected.id).eq('target_type', 'audience'),
    ])
    : [null, { data: [] }]
  const currentApproval = detail?.approvals.find(row => row.status === 'pending') ?? null
  const { count: approvalComments } = currentApproval
    ? await supabase.from('strategy_comments').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('entity_type', 'approval').eq('entity_id', currentApproval.id)
    : { count: 0 }

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const assetRows = (allAssets.data ?? []) as { status: string }[]
  const approvedAssets = assetRows.filter(row => row.status === 'approved').length
  const proofs = (proofRows.data ?? []) as { verification: string }[]
  const proofCoverage = pct(proofs.filter(row => row.verification === 'verified').length, proofs.length)
  const gaps = detail ? competitorGaps(detail.competitors, detail.scores) : 0
  const consistency = frameworkOptions.length ? Math.round(average(frameworkOptions.map(row => row.consistency_score))) : 0
  const pendingApprovals = (approvalsPending.data ?? []).length
  const metrics = { frameworks_active: frameworkOptions.length, proof_coverage: proofCoverage, positioning_consistency: consistency, positioning_pending: pendingApprovals }
  await refreshSnapshot(supabase, workspaceId, snapshots.current, metrics, now)
  const d = (key: keyof typeof metrics, value: number, unit = '') => {
    const change = compare(value, snapshots.lastMonth, key)
    return change ? { value: change.value, unit, comparison: 'vs last month' } : null
  }
  const kpis: KpiItem[] = [
    { id: 'frameworks', label: 'Active frameworks', value: frameworkOptions.length, icon: 'sparkles', tone: 'blue', delta: d('frameworks_active', frameworkOptions.length) },
    { id: 'messages', label: 'Approved messages', icon: 'check', tone: 'green', value: <>{approvedAssets}<span className="font-normal text-slate-500"> / {assetRows.length}</span></>,
      bar: { pct: pct(approvedAssets, assetRows.length), label: <><span className="font-semibold text-emerald-600">{pct(approvedAssets, assetRows.length)}% approved</span></> } },
    { id: 'proof', label: 'Proof coverage', value: `${proofCoverage}%`, icon: 'shield', tone: 'violet', delta: d('proof_coverage', proofCoverage, 'pp') },
    { id: 'gaps', label: 'Competitor gaps', value: gaps, icon: 'target', tone: 'orange', note: gaps ? 'High-priority gaps' : 'No open gaps' },
    { id: 'consistency', label: 'Consistency score', icon: 'award', tone: 'blue', value: <>{consistency}<span className="font-normal text-slate-500"> / 100</span></>,
      note: consistency >= 80 ? 'Strong alignment' : consistency >= 60 ? 'Moderate alignment' : 'Needs alignment', noteTone: consistency >= 80 ? 'green' : consistency >= 60 ? 'amber' : 'red' },
    { id: 'pending', label: 'Pending approvals', value: pendingApprovals, icon: 'clock', tone: 'amber', note: pendingApprovals ? 'Needs review' : 'All clear' },
  ]

  const audienceRows = (audiences.data ?? []) as { id: string; name: string; fit_score: number; audience_size: number }[]
  const linkedIds = new Set(((fitLinks.data ?? []) as { target_id: string }[]).map(row => row.target_id))
  const fit = audienceFitBands(audienceRows.filter(row => linkedIds.has(row.id)))
  const pathname = strategyPath(kind, 'positioning')
  const menuCan = { create: can.createFramework, edit: can.editFramework, approve: can.approveFramework, export: can.export }
  const audienceOptions = audienceRows.map(row => ({ id: row.id, name: row.name }))
  const filtered = Boolean(q.status || q.audience || q.market || q.owner || q.archived)
  const header = (
    <StrategyHeader kind={kind} module="positioning" modules={page.modules}
      actions={<PositioningHeaderActions frameworks={frameworkOptions.map(row => ({ id: row.id, name: row.name }))} primaryId={selected?.id ?? null}
        audiences={audienceOptions} people={page.people} research={((research.data ?? []) as { id: string; title: string }[]).map(row => ({ id: row.id, name: row.title }))} can={menuCan} />} />
  )

  const filters = (
    <div className="mt-4 flex flex-col gap-2 lg:mt-[14px] xl:flex-row xl:items-center xl:gap-[10px]">
      <div className="grid grid-cols-1 gap-2 min-[480px]:grid-cols-2 lg:flex lg:flex-1 lg:flex-wrap lg:items-center lg:gap-[10px]">
        <SelectFilter param="framework" labelText="Framework" allLabel="All frameworks" icon="layers" className="lg:w-[150px]"
          options={frameworkOptions.map(row => ({ value: row.id, label: row.name }))} />
        <SelectFilter param="audience" labelText="Audience" allLabel="All audiences" icon="user" className="lg:w-[152px]" options={audienceOptions.map(row => ({ value: row.id, label: row.name }))} />
        <SelectFilter param="market" labelText="Market" allLabel="All markets" icon="globe" className="lg:w-[132px]"
          options={STRATEGY_MARKETS.map(value => ({ value, label: MARKET_LABELS[value] }))} />
        <SelectFilter param="status" prefix="Status" labelText="Status" allLabel="All" className="lg:w-[104px]"
          options={FRAMEWORK_STATUSES.filter(value => value !== 'archived').map(value => ({ value, label: FRAMEWORK_STATUS_LABELS[value] }))} />
        <MoreFilters fields={[
          { param: 'owner', label: 'Owner', options: page.people.map(person => ({ value: person.id, label: person.full_name ?? person.email ?? 'Member' })) },
          { param: 'archived', label: 'Archive', options: [{ value: '1', label: 'Archived only' }] },
        ]} />
        <ClearFilters keys={['framework', 'audience', 'market', 'status', 'owner', 'archived']} />
      </div>
      <ViewSwitcher current={view} defaultView="framework"
        views={[{ id: 'framework', label: 'Framework' }, { id: 'matrix', label: 'Matrix' }, { id: 'cards', label: 'Cards' }, { id: 'table', label: 'Table' }]} />
    </div>
  )

  if (!selected || !detail) {
    return (
      <>
        {header}
        <KpiStrip items={kpis} />
        {filters}
        <div className={cn(CARD, 'mt-3')}>
          <EmptyState filtered={filtered} title={filtered ? 'No frameworks match' : 'No positioning framework yet'}
            description={filtered ? 'Clear filters to see every framework.' : can.createFramework ? 'Create a framework to define your category promise, pillars and proof.' : 'Frameworks appear here once created.'} />
        </div>
      </>
    )
  }

  const matrix = (full: boolean) => {
    const scoreOf = (competitorId: string, attributeId: string) => (detail.scores.find(row => row.competitor_id === competitorId && row.attribute_id === attributeId)?.score ?? 'na') as MatrixScore
    return (
      <TableScroll label="Competitive differentiation matrix">
        <table className={cn('w-full border-collapse', full ? 'min-w-[720px]' : 'min-w-[340px]')}>
          <caption className="sr-only">Competitive differentiation matrix for {selected.name}</caption>
          <thead>
            <tr>
              <th scope="col" className="w-[26%]"><span className="sr-only">Attribute</span></th>
              {detail.competitors.map(competitor => (
                <th key={competitor.id} scope="col" className={cn('px-1 pb-1 text-center text-[11px] font-normal text-sg-body lg:text-[8.5px]', competitor.is_self && 'rounded-t-md border-x border-t border-[#b9cbfd] bg-sg-blue-soft font-medium text-sg-blue')}>
                  {competitor.name}{competitor.is_self && <span className="block">(Us)</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {detail.attributes.map((attribute, rowIndex) => (
              <tr key={attribute.id} className="h-10 shadow-[inset_0_-1px_0_var(--color-sg-line-soft)] last:shadow-none lg:h-[22px]">
                <th scope="row" className="whitespace-nowrap pr-2 text-left text-[12px] font-medium text-sg-ink lg:text-[8.5px]">{attribute.name}</th>
                {detail.competitors.map(competitor => (
                  <td key={competitor.id} className={cn('text-center', competitor.is_self && cn('border-x border-[#b9cbfd] bg-sg-blue-soft/70', rowIndex === detail.attributes.length - 1 && 'rounded-b-md border-b'))}>
                    <MatrixCell competitorId={competitor.id} attributeId={attribute.id} score={scoreOf(competitor.id, attribute.id)} canEdit={can.editFramework} label={`${competitor.name}, ${attribute.name}`} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 flex flex-wrap gap-4 text-[11px] text-sg-body lg:mt-[7px] lg:gap-[22px] lg:pl-[8px] lg:text-[8.5px]" aria-hidden>
          {MATRIX_SCORES.map(score => <span key={score} className="inline-flex items-center gap-1.5"><i className={cn('h-2 w-2 rounded-full', SCORE_DOT[score])} />{({ strong: 'Strong', moderate: 'Moderate', weak: 'Weak', na: 'N/A' })[score]}</span>)}
        </p>
      </TableScroll>
    )
  }

  const assetsTable = (
    <TableScroll label="Key messaging assets">
      <table className="w-full min-w-[640px] border-collapse">
        <caption className="sr-only">Key messaging assets</caption>
        <thead><tr className="text-left text-[11px] text-sg-muted lg:text-[8.5px]">{['Asset', 'Type', 'Audience', 'Framework', 'Status', 'Last updated'].map(label => <th key={label} scope="col" className="py-1.5 pr-3 font-normal">{label}</th>)}<th scope="col"><span className="sr-only">Open</span></th></tr></thead>
        <tbody>
          {assets.map(asset => (
            <tr key={asset.id} className="h-11 text-[12.5px] text-sg-body lg:h-[27px] lg:text-[9px]">
              <td className="pr-3"><span className="flex items-center gap-2 font-medium text-sg-ink">{asset.asset_type === 'presentation' ? <Presentation aria-hidden className="h-4 w-4 shrink-0 text-orange-500 lg:h-3.5 lg:w-3.5" /> : <FileText aria-hidden className="h-4 w-4 shrink-0 text-red-500 lg:h-3.5 lg:w-3.5" />}{asset.name}</span></td>
              <td className="pr-3">{({ document: 'Document', presentation: 'Presentation', one_pager: 'Document', sheet: 'Sheet', other: 'Other' } as Record<string, string>)[asset.asset_type]}</td>
              <td className="pr-3">{asset.audience?.name ?? '—'}</td>
              <td className="pr-3">{asset.framework?.name ?? '—'}</td>
              <td className="pr-3"><StatusChip status={asset.status} label={asset.status === 'in_review' ? 'In review' : undefined} /></td>
              <td className="whitespace-nowrap pr-3">{formatDate(asset.updated_at)}</td>
              <td className="text-right text-slate-500"><MoreHorizontal aria-hidden className="ml-auto h-4 w-4 lg:h-3.5 lg:w-3.5" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableScroll>
  )

  let body: React.ReactNode
  if (view === 'matrix') {
    body = <Panel className="mt-3" title={`Competitive differentiation matrix · ${selected.name}`} subtitle={can.editFramework ? 'Select a dot to change its score. Changes are saved and logged.' : undefined}>{matrix(true)}</Panel>
  } else if (view === 'cards' || view === 'table') {
    body = view === 'cards' ? (
      <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {list.rows.map(row => (
          <li key={row.id} className={cn(CARD, 'p-4')}>
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <h3 className="flex items-center gap-2 text-[14px] font-semibold text-sg-ink">{row.name}{row.is_primary && <span className="rounded bg-sg-blue-soft px-1.5 text-[11px] font-medium text-sg-blue">Primary</span>}</h3>
                <p className="mt-1 line-clamp-2 text-[12.5px] text-sg-muted">{row.category_promise ?? 'No category promise yet.'}</p>
              </div>
              <FrameworkMenu framework={row} audiences={audienceOptions} can={menuCan} />
            </div>
            <div className="mt-3 flex items-center gap-2 text-[12px] text-sg-body">
              <StatusChip status={row.status} label={FRAMEWORK_STATUS_LABELS[row.status as FrameworkStatus]} />
              <span>v{row.version}</span><span className="ml-auto">Consistency {row.consistency_score}</span>
            </div>
            <Link href={`${pathname}?framework=${row.id}`} className="mt-3 inline-block text-[12.5px] font-medium text-sg-blue hover:underline">Open framework →</Link>
          </li>
        ))}
      </ul>
    ) : (
      <Panel className="mt-3" title="Frameworks" subtitle={`${list.total} frameworks`}>
        <TableScroll label="Frameworks">
          <table className="w-full min-w-[760px] border-collapse text-[12.5px] text-sg-body lg:text-[10px]">
            <caption className="sr-only">Frameworks</caption>
            <thead><tr className="text-left text-sg-muted">{['Framework', 'Status', 'Version', 'Target audience', 'Consistency', 'Owner', 'Updated'].map(label => <th key={label} scope="col" className="py-2 pr-3 font-normal">{label}</th>)}<th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {list.rows.map(row => (
                <tr key={row.id} className="h-12 border-t border-sg-line-soft lg:h-9">
                  <td className="pr-3"><Link href={`${pathname}?framework=${row.id}`} className="font-medium text-sg-ink hover:underline">{row.name}</Link>{row.is_primary && <span className="ml-2 rounded bg-sg-blue-soft px-1.5 text-[10px] text-sg-blue">Primary</span>}</td>
                  <td className="pr-3"><StatusChip status={row.status} label={FRAMEWORK_STATUS_LABELS[row.status as FrameworkStatus]} /></td>
                  <td className="pr-3">v{row.version}</td>
                  <td className="pr-3">{row.audience?.name ?? '—'}</td>
                  <td className="pr-3 tabular-nums">{row.consistency_score}</td>
                  <td className="pr-3"><span className="flex items-center gap-1.5"><Avatar person={row.owner} size={18} />{shortName(row.owner?.full_name)}</span></td>
                  <td className="whitespace-nowrap pr-3">{formatRelative(row.updated_at)}</td>
                  <td className="text-right"><FrameworkMenu framework={row} audiences={audienceOptions} can={menuCan} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      </Panel>
    )
  } else {
    body = (
      <>
        <div className="mt-3 grid grid-cols-1 gap-3 lg:mt-[12px] xl:grid-cols-[466fr_386fr_328fr] xl:gap-[13px]">
          <Panel title={<>Value Proposition Framework {selected.is_primary && <span className="ml-1 rounded bg-sg-blue-soft px-1.5 py-0.5 text-[11px] font-medium text-sg-blue lg:text-[9px]">Primary</span>}</>}
            action={<FrameworkMenu framework={selected} audiences={audienceOptions} can={menuCan} />}
            footer={(
              <div className="flex items-center justify-between text-[11px] text-sg-muted lg:text-[8.5px]">
                <span>Last updated {formatDate(selected.updated_at)} by {selected.owner?.full_name ?? 'a teammate'}</span>
                <Link href={`${pathname}?view=table`} className="font-medium text-sg-blue hover:underline lg:text-[9px]">Edit framework →</Link>
              </div>
            )}>
            <h3 className="mb-2 text-[12.5px] font-semibold text-sg-ink lg:mb-[2px] lg:text-[10px]">Message House</h3>
            <div className="space-y-2 lg:space-y-[6px]">
              <div className="relative flex min-h-[64px] flex-col items-center justify-end px-10 pb-2 text-center lg:min-h-[50px] lg:pb-[5px]" style={{ clipPath: 'polygon(50% 0, 100% 72%, 100% 100%, 0 100%, 0 72%)', background: 'linear-gradient(180deg,#eef3ff,#dbe5fe)' }}>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600 lg:text-[7.5px]">Category Promise</p>
                <p className="max-w-[300px] text-[12.5px] font-semibold leading-snug text-sg-ink lg:max-w-[250px] lg:text-[10px]">{selected.category_promise ?? '—'}</p>
              </div>
              <div className="rounded-md bg-emerald-50 px-3 py-2 lg:py-[8px]">
                <p className="text-center text-[10px] font-semibold uppercase tracking-wide text-slate-600 lg:text-[7.5px]">Supporting Pillars</p>
                <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {detail.pillars.map(pillar => {
                    const Icon = PILLAR_ICON[pillar.icon ?? ''] ?? Sparkles
                    return <li key={pillar.id} className="flex items-center gap-2 text-[11.5px] font-medium leading-tight text-sg-ink lg:text-[8.5px]" title={pillar.description ?? undefined}><Icon aria-hidden className="h-5 w-5 shrink-0 text-emerald-600 lg:h-4 lg:w-4" />{pillar.name}</li>
                  })}
                </ul>
              </div>
              <div className="rounded-md bg-violet-50 px-3 py-2 text-center lg:py-[6px]">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600 lg:text-[7.5px]">Proof Points</p>
                <p className="text-[12px] text-sg-ink lg:text-[9.5px]">{detail.proofPoints.filter(point => point.verification === 'verified').map(point => point.label.replace(/ Certification$/, '')).slice(0, 4).join(' • ') || 'No verified proof points yet'}</p>
              </div>
              <div className="rounded-md bg-orange-50 px-3 py-2 text-center lg:py-[6px]">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600 lg:text-[7.5px]">Foundation</p>
                <p className="text-[12px] font-medium text-sg-ink lg:text-[9.5px]">{selected.foundation ?? '—'}</p>
              </div>
            </div>
          </Panel>

          <Panel title="Competitive Differentiation Matrix" info="How we and named competitors score on the attributes buyers weigh most." bodyClassName="lg:pb-0!" footerClassName="lg:pb-[8px]!" footer={<div className="flex justify-end lg:leading-none"><HeaderLink href={`${pathname}?view=matrix&framework=${selected.id}`}>View full matrix</HeaderLink></div>}>
            {detail.competitors.length && detail.attributes.length ? matrix(false) : <EmptyState compact title="No competitors mapped yet" />}
          </Panel>

          <div className="space-y-3 xl:space-y-[9px]">
            <Panel title="Positioning Statement" bodyClassName="lg:pb-[7px]!" action={<FrameworkMenu framework={selected} audiences={audienceOptions} can={menuCan} />}
              footer={<div className="flex items-center justify-between text-[11px] text-sg-muted lg:text-[8.5px]"><span>Last updated {formatDate(selected.updated_at)}</span>{can.editFramework && <Link href={`${pathname}?view=table`} className="inline-flex min-h-9 items-center gap-1 font-medium text-sg-blue hover:underline lg:min-h-0 lg:text-[9px]">Edit <ArrowRight aria-hidden className="h-3 w-3" /></Link>}</div>}>
              <blockquote className="flex gap-2">
                <Quote aria-hidden className="h-5 w-5 shrink-0 rotate-180 fill-slate-300 text-slate-300 lg:h-4 lg:w-4" />
                <p className="text-[15px] leading-snug text-sg-ink lg:text-[12px]">{selected.positioning_statement ?? 'No positioning statement yet.'}</p>
              </blockquote>
              <p className="mt-3 text-[11px] text-sg-muted lg:mt-[12px] lg:text-[8.5px]">Target audience</p>
              {selected.audience ? <Link href={`${strategyPath(kind, 'audiences')}?q=${encodeURIComponent(selected.audience.name)}`} className="text-[12.5px] font-medium text-sg-blue hover:underline lg:text-[9px]">{selected.audience.name}</Link> : <p className="text-[12px] text-sg-muted">Not set</p>}
            </Panel>
            <Panel title="Audience–Message Fit" headerClassName="lg:pt-[5px]!" bodyClassName="lg:pt-[4px]! lg:pb-0!">
              {linkedIds.size ? (
                <div className="flex items-start gap-5 lg:gap-[20px]">
                  <ScoreRing value={fit.strongFit} size={80} stroke={11} colour="#22c55e" track="#e6e9ee" label={`${fit.strongFit}% strong fit`} textClassName="text-[15px] lg:text-[13px]">
                    <>{fit.strongFit}%<span className="mt-0.5 block text-[9px] font-normal text-sg-muted lg:text-[7.5px]">Strong fit</span></>
                  </ScoreRing>
                  <div className="min-w-0 flex-1 lg:pt-[7px]">
                  <ul className="space-y-1.5 text-[11.5px] text-sg-body lg:space-y-[4px] lg:text-[8.5px] lg:leading-[11px]">
                    {([['Highly aligned', fit.high, '#22c55e'], ['Aligned', fit.aligned, '#94a3b8'], ['Neutral', fit.neutral, '#f59e0b'], ['Low alignment', fit.low, '#ef4444']] as const).map(([label, value, colour]) => (
                      <li key={label} className="flex items-center gap-2"><i aria-hidden className="h-2 w-2 rounded-full" style={{ background: colour }} /><span className="flex-1">{label}</span><span className="tabular-nums">{value}%</span></li>
                    ))}
                  </ul>
                  <HeaderLink href={strategyPath(kind, 'audiences')}>View audience insights</HeaderLink>
                  </div>
                </div>
              ) : <EmptyState compact title="No audiences linked" description="Link audiences to this framework to score message fit." />}
            </Panel>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 lg:mt-[12px] xl:grid-cols-[441fr_336fr_403fr] xl:gap-[13px]">
          <Panel title="Proof Points & Evidence" headerClassName="lg:pt-[7px]!" action={<HeaderLink href={`${pathname}?view=table`}>View all</HeaderLink>}>
            {detail.proofPoints.length ? (
              <ul className="space-y-1.5 lg:space-y-[4px]">
                {detail.proofPoints.map(point => {
                  const Icon = PROOF_ICON[point.category] ?? BadgeCheck
                  return (
                    <li key={point.id} className="grid min-h-10 grid-cols-[auto_1fr_auto] items-center gap-x-2 text-[12px] text-sg-body sm:grid-cols-[auto_1fr_80px_90px_70px] lg:min-h-[19px] lg:text-[9px]">
                      <Icon aria-hidden className="h-4 w-4 text-sg-blue lg:h-3 lg:w-3" />
                      <span className="truncate text-sg-ink">{point.label}</span>
                      <span className={cn('hidden w-fit rounded px-1.5 py-px text-[11px] font-medium sm:inline lg:text-[8px]', CATEGORY_TONE[point.category])}>{PROOF_CATEGORY_LABELS[point.category]}</span>
                      <span className={cn('hidden w-fit rounded px-1.5 py-px text-[11px] font-medium sm:inline lg:text-[8px]', IMPACT_TONE[point.impact])}>{point.impact[0].toUpperCase() + point.impact.slice(1)} impact</span>
                      <span className="text-right"><ProofVerificationMenu id={point.id} label={point.label} verification={point.verification} canApprove={can.approveFramework} /></span>
                    </li>
                  )
                })}
              </ul>
            ) : <EmptyState compact title="No proof points yet" />}
          </Panel>
          <Panel title="Claims Risk Assessment" headerClassName="lg:pt-[7px]!" bodyClassName="lg:pb-[4px]!" footerClassName="lg:pb-[6px]!" info="Substantiation risk for each public claim before it is used in market." action={<HeaderLink href={`${pathname}?view=table`}>View all</HeaderLink>}
            footer={<FooterLink href={strategyPath(kind, 'research')}>Review risk guidelines</FooterLink>}>
            {detail.claims.length ? (
              <ul className="space-y-1 lg:space-y-0">
                {detail.claims.map(claim => (
                  <li key={claim.id} className="flex min-h-10 items-center justify-between gap-2 text-[12px] text-sg-ink lg:min-h-[19.5px] lg:text-[9px]" title={claim.rationale ?? undefined}>
                    <span className="truncate">{claim.claim}</span>
                    <span className={cn('shrink-0 rounded px-1.5 py-px text-[11px] font-medium lg:text-[8px]', RISK_TONE[claim.risk_level])}>{RISK_LABELS[claim.risk_level as RiskLevel]}</span>
                  </li>
                ))}
              </ul>
            ) : <EmptyState compact title="No claims assessed yet" />}
          </Panel>
          <Panel title="Approval Workflow" headerClassName="lg:pt-[7px]!" bodyClassName="lg:pb-[10px]!" info="Each stage must be approved in order by its assigned approver." action={<HeaderLink href={`${pathname}?view=table`}>View workflow</HeaderLink>}>
            {detail.approvals.length ? (
              <>
                <ol className="flex items-start justify-between" aria-label="Approval stages">
                  {detail.approvals.map((stage, index) => {
                    const done = stage.status === 'approved'
                    const current = stage.id === currentApproval?.id
                    return (
                      <li key={stage.id} className="relative flex flex-1 flex-col items-center text-center" aria-current={current ? 'step' : undefined}>
                        {index > 0 && <span aria-hidden className={cn('absolute right-1/2 top-2.5 h-px w-full', done || current ? 'bg-emerald-400' : 'bg-slate-200')} />}
                        <span className={cn('relative z-10 flex h-5 w-5 items-center justify-center rounded-full text-white',
                          done ? 'bg-emerald-500' : current ? 'bg-orange-400' : 'border border-slate-300 bg-white text-slate-400')}>
                          {done ? <Check aria-hidden className="h-3 w-3" strokeWidth={3} /> : current ? <Clock3 aria-hidden className="h-3 w-3" /> : <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />}
                        </span>
                        <span className={cn('mt-1 text-[11px] lg:text-[8.5px]', current ? 'font-semibold text-sg-ink' : 'text-sg-body')}>{APPROVAL_STAGE_LABELS[stage.stage as ApprovalStage]}</span>
                        <span className="text-[10px] text-sg-muted lg:text-[7.5px]">{done ? 'Completed' : current ? 'In progress' : 'Pending'}</span>
                        <span className="text-[10px] text-sg-muted lg:text-[7.5px]">{done && stage.decided_at ? formatDate(stage.decided_at).replace(/ \d{4}$/, '') : current && stage.due_date ? `Due ${formatDate(stage.due_date).replace(/ \d{4}$/, '')}` : ''}</span>
                      </li>
                    )
                  })}
                </ol>
                {currentApproval ? (
                  <div className="mt-3 flex flex-wrap items-end justify-between gap-3 lg:mt-[14px]">
                    <div>
                      <p className="text-[11px] text-sg-muted lg:text-[8px]">Current approver</p>
                      <p className="mt-1 flex items-center gap-2"><Avatar person={currentApproval.approver} size={22} />
                        <span><span className="block text-[12px] font-medium text-sg-ink lg:text-[9px]">{shortName(currentApproval.approver?.full_name)}</span><span className="block text-[10.5px] text-sg-muted lg:text-[8px]">{APPROVAL_STAGE_LABELS[currentApproval.stage as ApprovalStage]}</span></span>
                      </p>
                    </div>
                    <div className="text-center"><p className="text-[11px] text-sg-muted lg:text-[8px]">Comments</p><span className="mt-1 inline-flex h-5 min-w-5 items-center justify-center rounded border border-sg-line px-1 text-[11px] lg:text-[8.5px]">{approvalComments ?? 0}</span></div>
                    <ApprovalControls approvalId={currentApproval.id} isCurrentApprover={currentApproval.approver_id === userId}
                      canApprove={can.approveFramework} canRemind={can.editFramework} />
                  </div>
                ) : <p className="mt-3 text-[12px] text-emerald-600 lg:text-[9.5px]">All stages approved.</p>}
              </>
            ) : <EmptyState compact title="Not submitted yet" description="Use “Submit for approval” to start review." />}
          </Panel>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 lg:mt-[12px] xl:grid-cols-[748fr_446fr] xl:gap-[13px]">
          <Panel title="Key Messaging Assets" headerClassName="lg:pt-[7px]!" action={<HeaderLink href={`${pathname}?view=table`}>View all assets</HeaderLink>}>
            {assets.length ? assetsTable : <EmptyState compact title="No messaging assets yet" />}
          </Panel>
          <Panel title="Recent Activity & Approvals" headerClassName="lg:pt-[7px]!" action={<HeaderLink href={strategyPath(kind)}>View all</HeaderLink>} footer={<FooterLink href={strategyPath(kind)}>See all activity</FooterLink>}>
            {activity.length ? (
              <ul className="space-y-2.5 lg:space-y-[10px]">
                {activity.map(row => (
                  <li key={row.id} className="flex items-center gap-2 text-[12px] lg:text-[9px]">
                    <Avatar person={row.actor} size={18} />
                    <p className="min-w-0 flex-1 truncate text-sg-muted"><span className="font-semibold text-sg-ink">{shortName(row.actor?.full_name)}</span> {row.action} <span className="text-sg-body">{row.summary}</span></p>
                    <time dateTime={row.created_at} className="shrink-0 text-sg-subtle">{formatRelative(row.created_at)}</time>
                  </li>
                ))}
              </ul>
            ) : <EmptyState compact title="No positioning activity yet" />}
          </Panel>
        </div>
      </>
    )
  }

  return (
    <>
      {header}
      {list.error && <div className="mb-3"><PanelError message="Frameworks could not load. Refresh to try again." /></div>}
      <KpiStrip items={kpis} />
      {filters}
      {body}
    </>
  )
}
