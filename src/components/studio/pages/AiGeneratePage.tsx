import Link from 'next/link'
import {
  ArrowRight, Bookmark, BookmarkCheck, CheckCircle2, FileText, Gauge, LayoutTemplate, RefreshCw, Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { requireStudioModule } from '@/lib/studio/server'
import { aiCounts, listAiOutputs, listPreviewAccounts, listPrompts } from '@/lib/studio/data'
import { parseStudioQuery, type RawParams } from '@/lib/studio/query'
import { signStudioMedia } from '@/lib/studio/sign'
import { STUDIO_AI_MODELS } from '@/lib/studio/ai'
import AiGenerateWorkspace, { type HistoryItem } from '../ai/AiGenerateWorkspace'
import AiOutputRowActions from '../ai/AiOutputRowActions'
import StudioPageHeader from '../StudioPageHeader'
import { AccessBlocked } from '../states'
import { ChannelIcons } from '../records'
import { Pager } from '../controls'
import { Card, EmptyBlock, ErrorBlock, KpiTile, Pill, S_TD, S_TH, type Tone } from '../ui'

const STATUS: Record<string, { label: string; tone: Tone }> = {
  used: { label: 'Accepted', tone: 'green' }, draft: { label: 'Draft', tone: 'blue' }, discarded: { label: 'Discarded', tone: 'slate' },
}

export default async function AiGeneratePage({ searchParams }: { searchParams: RawParams }) {
  const { supabase, ctx, userId, capabilities, modules, access, base, limits } = await requireStudioModule('ai-generate')
  if (!access.allowed) {
    return (
      <>
        <StudioPageHeader layout="bar" base={base} modules={modules} title="AI Generate" />
        <AccessBlocked access={access} />
      </>
    )
  }

  const q = parseStudioQuery(searchParams, { views: ['table'], defaultView: 'table', defaultSize: 3 })
  const showAll = searchParams.all === '1'
  const batch = typeof searchParams.batch === 'string' && /^[0-9a-f-]{36}$/i.test(searchParams.batch) ? searchParams.batch : ''

  const [counts, recent, mine, prompts, rawAccounts, brandRows] = await Promise.all([
    aiCounts(supabase, ctx.workspaceId, limits.aiMonthly),
    listAiOutputs(supabase, ctx.workspaceId, { ...q, size: showAll ? 20 : 3, page: showAll ? q.page : 1 }, { types: ['custom'] }),
    listAiOutputs(supabase, ctx.workspaceId, { ...q, q: '', status: '', channel: '', page: 1, size: 40 }, { types: ['custom'], userId }),
    listPrompts(supabase, ctx.workspaceId, 50),
    listPreviewAccounts(supabase, ctx.workspaceId),
    supabase.from('brands').select('id, name, logo_url').eq('workspace_id', ctx.workspaceId).order('created_at').limit(20),
  ])

  // The outputs panel reopens the requested batch, else the user's latest batch.
  const latestBatch = batch || mine.rows[0]?.batch_id || ''
  const batchRows = latestBatch
    ? (await listAiOutputs(supabase, ctx.workspaceId, { ...q, q: '', status: '', channel: '', page: 1, size: 4 }, { batchId: latestBatch, types: ['custom'] })).rows
    : []

  const seen = new Set<string>()
  const history: HistoryItem[] = []
  for (const row of mine.rows) {
    const key = row.batch_id ?? row.id
    if (seen.has(key)) continue
    seen.add(key)
    history.push({
      id: row.id, batchId: row.batch_id, topic: row.topic || (row.prompt ?? 'Untitled prompt').slice(0, 60), prompt: row.prompt ?? '',
      channel: row.channel, tone: row.tone, objective: row.objective, audience: row.audience, created_at: row.created_at,
    })
  }

  const signed = await signStudioMedia(ctx.workspaceId, { accounts: rawAccounts, brands: brandRows.data ?? [] })
  // Server render time anchors relative dates for this request.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now()
  const reset = new Date()
  reset.setMonth(reset.getMonth() + 1, 1)
  const resetsOn = reset.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  const modelLabel = (id: string | null) => STUDIO_AI_MODELS.find(m => m.id === id)?.label ?? id ?? '—'
  const usedPct = counts.creditsLimit > 0 ? Math.round((counts.creditsUsed / counts.creditsLimit) * 100) : 0

  const kpis = counts.error ? <Card className="mt-3"><ErrorBlock message={counts.error} /></Card> : (
    <ul className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:mt-[12px] lg:gap-[10px] xl:grid-cols-6">
      <li key="kpi-1"><KpiTile labelFirst icon={<Sparkles size={13} />} tone="blue" label="AI Generations Today" value={counts.generationsToday} trend={{ current: counts.generationsToday, previous: counts.generationsYesterday }} suffix="vs yesterday" className="lg:h-[78px] lg:items-start lg:pt-[14px]" /></li>
      <li key="kpi-2"><KpiTile labelFirst icon={<Bookmark size={13} />} tone="green" label="Saved Outputs" value={counts.savedOutputs} trend={{ current: counts.savedToday, previous: counts.savedYesterday }} suffix="vs yesterday" className="lg:h-[78px] lg:items-start lg:pt-[14px]" /></li>
      <li key="kpi-3"><KpiTile labelFirst icon={<RefreshCw size={13} />} tone="violet" label="Regeneration Rate" value={`${counts.regenerationRate}%`} trend={{ current: counts.regenerationRate, previous: counts.regenerationRateYesterday }} invert suffix="vs yesterday" className="lg:h-[78px] lg:items-start lg:pt-[14px]" /></li>
      <li key="kpi-4"><KpiTile labelFirst icon={<LayoutTemplate size={13} />} tone="green" label="Prompt Templates" value={counts.promptTemplates} trend={{ current: counts.promptTemplates, previous: counts.promptTemplates - counts.promptsCreatedToday }} suffix="vs yesterday" className="lg:h-[78px] lg:items-start lg:pt-[14px]" /></li>
      <li key="kpi-5"><KpiTile labelFirst icon={<Gauge size={13} />} tone="blue" label="Credit Usage" value={counts.creditsUsed} valueSuffix={counts.creditsLimit >= 0 ? `/ ${counts.creditsLimit.toLocaleString('en-GB')}` : undefined} note={counts.creditsLimit >= 0 ? `${usedPct}% used` : 'No monthly limit'} className="lg:h-[78px] lg:items-start lg:pt-[14px]" /></li>
      <li key="kpi-6"><KpiTile labelFirst icon={<CheckCircle2 size={13} />} tone="amber" label="Content Accepted" value={`${counts.acceptedRate}%`} trend={{ current: counts.acceptedRate, previous: counts.acceptedRateYesterday }} suffix="vs yesterday" className="lg:h-[78px] lg:items-start lg:pt-[14px]" /></li>
    </ul>
  )

  const recentOutputs = (
    <Card className="mt-3 overflow-hidden lg:mt-[12px]" aria-labelledby="ai-recent-title">
      <h2 id="ai-recent-title" className="px-3.5 pb-2 pt-3 text-[14px] font-semibold text-slate-900 lg:px-[11px] lg:pb-[6px] lg:pt-[8px] lg:text-[11px]">Recent AI Outputs</h2>
      {recent.error ? <ErrorBlock message={recent.error} /> : recent.rows.length === 0 ? (
        <EmptyBlock title="No AI outputs yet" message="Outputs you generate are listed here with their model, length and status." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse">
            <caption className="sr-only">Recent AI outputs</caption>
            <thead>
              <tr className="border-y border-[#eef0f4]">
                <th scope="col" className={cn(S_TH, 'w-8 pl-3.5 lg:h-[18px] lg:pl-[11px]')}><span className="sr-only">Row</span></th>
                <th scope="col" className={cn(S_TH, 'lg:h-[18px] lg:w-[225px] lg:text-[7.5px]')}>Title</th>
                <th scope="col" className={cn(S_TH, 'lg:h-[18px] lg:w-[125px] lg:text-[7.5px]')}>Channel</th>
                <th scope="col" className={cn(S_TH, 'lg:h-[18px] lg:w-[137px] lg:text-[7.5px]')}>Model</th>
                <th scope="col" className={cn(S_TH, 'lg:h-[18px] lg:w-[74px] lg:text-[7.5px]')}>Words</th>
                <th scope="col" className={cn(S_TH, 'lg:h-[18px] lg:w-[176px] lg:text-[7.5px]')}>Created</th>
                <th scope="col" className={cn(S_TH, 'lg:h-[18px] lg:w-[118px] lg:text-[7.5px]')}>Status</th>
                <th scope="col" className={cn(S_TH, 'lg:h-[18px] lg:text-[7.5px]')}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {recent.rows.map(row => {
                const status = row.bookmarked && row.status === 'draft' ? { label: 'Saved', tone: 'slate' as Tone } : STATUS[row.status] ?? STATUS.draft!
                const created = new Date(row.created_at)
                return (
                  <tr key={row.id} className="border-b border-[#f0f2f5] last:border-0 hover:bg-slate-50/60">
                    <td className={cn(S_TD, 'h-11 pl-3.5 lg:h-[28px] lg:pl-[11px]')}><FileText size={12} className="text-slate-400" aria-hidden /></td>
                    <td className={cn(S_TD, 'lg:text-[9.5px]')}>
                      <Link href={`${base}/ai-generate?batch=${row.batch_id ?? ''}`} className="inline-flex max-w-full items-center gap-2 text-slate-800 hover:text-[#1a5cff]">
                        <span className="truncate">{row.topic || (row.prompt ?? 'Untitled').slice(0, 60)}</span>
                        {row.bookmarked ? <BookmarkCheck size={11} className="shrink-0 text-[#1a5cff]" aria-label="Saved" /> : <Bookmark size={11} className="shrink-0 text-slate-300" aria-hidden />}
                      </Link>
                    </td>
                    <td className={S_TD}><ChannelIcons channels={[row.channel ?? row.platform ?? ''].filter(Boolean)} size={12} /></td>
                    <td className={cn(S_TD, 'lg:text-[9.5px]')}>{modelLabel(row.model)}</td>
                    <td className={cn(S_TD, 'tabular-nums lg:text-[9.5px]')}>{row.word_count ?? '—'}</td>
                    <td className={cn(S_TD, 'whitespace-nowrap lg:text-[9.5px]')}>
                      {created.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} · {created.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true })}
                    </td>
                    <td className={S_TD}><Pill tone={status.tone} className="lg:min-w-[62px] lg:justify-center lg:rounded-full">{status.label === 'Accepted' && <CheckCircle2 size={9} aria-hidden />}{status.label}</Pill></td>
                    <td className={S_TD}>
                      <AiOutputRowActions id={row.id} base={base} batchId={row.batch_id} output={row.output ?? ''} bookmarked={row.bookmarked} canCompose={capabilities.createContent} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {recent.rows.length > 0 && (showAll ? (
        <Pager page={q.page} size={20} total={recent.total} noun="outputs" className="border-t border-[#eef0f4] px-3.5 py-2.5" />
      ) : recent.total > 3 && (
        <div className="flex justify-end px-3.5 py-2 lg:h-[26px] lg:items-center lg:px-[20px] lg:py-0">
          <Link href={`${base}/ai-generate?all=1`} className="inline-flex items-center gap-1 text-[12px] font-medium text-[#1a5cff] hover:underline lg:text-[9.5px]">View all outputs <ArrowRight size={11} /></Link>
        </div>
      ))}
    </Card>
  )

  return (
    <>
      <StudioPageHeader layout="bar" base={base} modules={modules} title="AI Generate" className="lg:mb-[14px]" ownHeading />
      <AiGenerateWorkspace
        key={latestBatch || 'none'}
        base={base} now={now} history={history} prompts={prompts.rows}
        initialOutputs={batchRows} initialPrompt={batchRows[0]?.prompt ?? ''}
        brands={(signed.brands as { id: string; name: string; logo_url: string | null }[]).map(b => ({ id: b.id, name: b.name, logo: b.logo_url }))}
        accounts={signed.accounts}
        credits={{ used: counts.creditsUsed, limit: counts.creditsLimit, resetsOn }}
        capabilities={{ generate: capabilities.generateAi, managePrompts: capabilities.managePrompts, brandVoice: capabilities.useBrandVoice, compose: capabilities.createContent }}
        kpis={kpis} recentOutputs={recentOutputs}
      />
    </>
  )
}
