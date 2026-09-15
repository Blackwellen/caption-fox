import { requireStudioModule } from '@/lib/studio/server'
import { aiCounts, listAiOutputs, listPrompts } from '@/lib/studio/data'
import { parseStudioQuery, type RawParams } from '@/lib/studio/query'
import StudioHeader from '@/components/studio/StudioHeader'
import KpiStrip from '@/components/studio/KpiStrip'
import { AccessBlocked, LoadError } from '@/components/studio/states'
import { STUDIO_PAGE } from '@/components/studio/primitives'
import AiGenerateWorkspace from './AiGenerateWorkspace'
import type { KpiValue } from '@/lib/studio/types'

export const metadata = { title: 'AI Generate · Studio · Caption Fox' }

export default async function AiGeneratePage({
  searchParams,
}: { searchParams: Promise<RawParams> }) {
  const params = await searchParams
  const { supabase, ctx, capabilities, limits, modules, access } = await requireStudioModule('ai-generate')

  if (!access.allowed) {
    return (
      <div className={STUDIO_PAGE}>
        <StudioHeader module="ai-generate" modules={modules} />
        <AccessBlocked access={access} />
      </div>
    )
  }

  const q = parseStudioQuery(params, { views: ['cards', 'table'], defaultView: 'cards' })

  const [counts, outputs, prompts] = await Promise.all([
    aiCounts(supabase, ctx.workspaceId, limits.aiMonthly),
    listAiOutputs(supabase, ctx.workspaceId, q, { limit: 20, paginate: false }),
    listPrompts(supabase, ctx.workspaceId),
  ])

  const kpis: KpiValue[] = [
    { id: 'today', label: 'AI generations today', value: String(counts.generationsToday), tone: 'blue', icon: 'sparkles', trend: counts.generationsToday >= counts.generationsYesterday ? 'up' : 'down', hint: `${counts.generationsYesterday} yesterday` },
    { id: 'saved', label: 'Saved outputs', value: String(counts.savedOutputs), tone: 'violet', icon: 'bookmark' },
    { id: 'regen', label: 'Regeneration rate', value: `${counts.regenerationRate}%`, tone: 'amber', icon: 'trend' },
    { id: 'prompts', label: 'Prompt templates', value: String(counts.promptTemplates), tone: 'slate', icon: 'file' },
    {
      id: 'credits', label: 'Credit usage',
      value: counts.creditsLimit < 0 ? String(counts.creditsUsed) : `${counts.creditsUsed} / ${counts.creditsLimit}`,
      tone: 'blue', icon: 'wand',
    },
    { id: 'accepted', label: 'Content accepted', value: `${counts.acceptedRate}%`, tone: 'green', icon: 'check' },
  ]

  return (
    <div className={STUDIO_PAGE}>
      <StudioHeader module="ai-generate" modules={modules} />

      {counts.error ? <LoadError message={counts.error} className="mb-4" /> : <KpiStrip items={kpis} className="mb-4" />}

      <AiGenerateWorkspace
        workspaceId={ctx.workspaceId}
        capabilities={capabilities}
        outputs={outputs.rows}
        prompts={prompts.rows}
        credits={{ used: counts.creditsUsed, limit: counts.creditsLimit }}
      />
    </div>
  )
}
