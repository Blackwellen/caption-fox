import { NextResponse, type NextRequest } from 'next/server'
import { getStrategyActionSession } from '@/lib/strategy/server'
import { canAccessStrategyModule } from '@/lib/strategy/entitlements'
import { STRATEGY_MODULE_META, STRATEGY_MODULES, strategyPath, type StrategyModule } from '@/lib/strategy/constants'
import {
  buildContextBlock, cleanQuestion, extractCitations, MAX_OUTPUT_TOKENS, STRATEGY_AI_MODEL, STRATEGY_AI_SYSTEM_PROMPT,
  strategyAiAvailability, stripUnknownCitations,
} from '@/lib/strategy/ai-rules'
import { loadStrategyAiContext } from '@/lib/strategy/ai-context'
import { azureChat, isAzureAiConfigured } from '@/lib/ai/azure'
import { createServiceClient } from '@/lib/supabase/service'
import { logAudit } from '@/lib/audit'
import { workspaceRouteSegment } from '@/lib/workspace-shared'

const ACTION = 'strategy_assistant'
const BURST_LIMIT = 6
const TIMEOUT_MS = 25_000

function availabilityFor(session: NonNullable<Awaited<ReturnType<typeof getStrategyActionSession>>>) {
  return strategyAiAvailability({
    plan: session.ctx.plan, planStatus: session.ctx.planStatus, flags: session.ctx.flags,
    globallyDisabled: process.env.STRATEGY_AI_DISABLED === 'true' || process.env.AI_DISABLED === 'true',
    configured: isAzureAiConfigured(),
  })
}

/** Usage this period, counting successful calls only. Workspace totals need the service role (RLS shows users their own rows). */
async function usage(session: NonNullable<Awaited<ReturnType<typeof getStrategyActionSession>>>) {
  const now = new Date()
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
  const minuteAgo = new Date(Date.now() - 60_000).toISOString()
  const service = createServiceClient()
  const reader = service ?? session.supabase
  const [burst, daily, monthly] = await Promise.all([
    session.supabase.from('ai_usage_logs').select('id', { count: 'exact', head: true }).eq('user_id', session.userId).eq('action', ACTION).gte('created_at', minuteAgo),
    session.supabase.from('ai_usage_logs').select('id', { count: 'exact', head: true }).eq('user_id', session.userId).eq('action', ACTION).eq('status', 'success').gte('created_at', dayStart),
    reader.from('ai_usage_logs').select('prompt_tokens, completion_tokens').eq('workspace_id', session.ctx.workspaceId).eq('action', ACTION).eq('status', 'success').gte('created_at', monthStart).limit(20_000),
  ])
  const rows = (monthly.data ?? []) as { prompt_tokens: number | null; completion_tokens: number | null }[]
  return {
    burst: burst.count ?? 0,
    userToday: daily.count ?? 0,
    workspaceMonth: rows.length,
    workspaceTokens: rows.reduce((sum, row) => sum + (row.prompt_tokens ?? 0) + (row.completion_tokens ?? 0), 0),
  }
}

async function log(session: NonNullable<Awaited<ReturnType<typeof getStrategyActionSession>>>, module: StrategyModule, status: 'success' | 'failed' | 'blocked', tokens = { prompt: 0, completion: 0 }) {
  const { error } = await session.supabase.from('ai_usage_logs').insert({
    user_id: session.userId, workspace_id: session.ctx.workspaceId, action: ACTION, mode: module, surface: `strategy/${module}`,
    model: STRATEGY_AI_MODEL, status, prompt_tokens: tokens.prompt, completion_tokens: tokens.completion,
  })
  if (error) console.error('[strategy-ai] usage log failed', { code: error.code })
}

/** Remaining allowance for the panel header. */
export async function GET() {
  const session = await getStrategyActionSession()
  if (!session) return NextResponse.json({ error: 'Sign in to use Fox AI.' }, { status: 401 })
  const availability = availabilityFor(session)
  if (!availability.available) return NextResponse.json({ available: false, message: availability.message })
  const used = await usage(session)
  return NextResponse.json({
    available: true,
    remainingToday: Math.max(0, availability.limits.userDaily - used.userToday),
    remainingMonth: Math.max(0, availability.limits.workspaceMonthly - used.workspaceMonth),
  })
}

/**
 * Read-only, grounded Strategy assistant. Answers only from records the caller
 * can already open (their RLS client, their entitled modules, active
 * workspace), cites them, never writes records and never stores the prompt or
 * answer. Capped per user/day, per workspace/month and by monthly tokens.
 */
export async function POST(request: NextRequest) {
  const session = await getStrategyActionSession()
  if (!session) return NextResponse.json({ error: 'Your session has expired. Sign in again.' }, { status: 401 })

  let body: { question?: unknown; module?: unknown }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }) }
  const module = (STRATEGY_MODULES as readonly string[]).includes(String(body.module)) ? body.module as StrategyModule : null
  if (!module) return NextResponse.json({ error: 'Unknown Strategy area.' }, { status: 400 })
  if (!canAccessStrategyModule(session.ctx, module).allowed) return NextResponse.json({ error: 'This area is not available for your workspace.' }, { status: 404 })
  const question = cleanQuestion(body.question)
  if (!question) return NextResponse.json({ error: 'Ask a question between 3 and 600 characters.' }, { status: 400 })

  const availability = availabilityFor(session)
  if (!availability.available) {
    return NextResponse.json({ error: availability.message, upgrade: availability.reason === 'plan' }, { status: availability.reason === 'plan' ? 402 : 403 })
  }
  const { limits } = availability
  const used = await usage(session)
  if (used.burst >= BURST_LIMIT) {
    await log(session, module, 'blocked')
    return NextResponse.json({ error: 'You are asking very quickly. Wait a minute and try again.' }, { status: 429, headers: { 'Retry-After': '60' } })
  }
  if (used.userToday >= limits.userDaily) {
    return NextResponse.json({ error: `You have used today's ${limits.userDaily} Fox AI questions for Strategy. It resets at midnight UTC.` }, { status: 429 })
  }
  if (used.workspaceMonth >= limits.workspaceMonthly || used.workspaceTokens >= limits.workspaceMonthlyTokens) {
    return NextResponse.json({ error: 'This workspace has used its Fox AI allowance for Strategy this month.', upgrade: true }, { status: 429 })
  }

  const records = await loadStrategyAiContext(session.supabase, session.ctx, module)
  const { text: data, used: supplied } = buildContextBlock(records)
  if (!supplied.length) {
    return NextResponse.json({ answer: 'There is no Strategy data in this workspace yet, so there is nothing to answer from. Add objectives, audiences, research or plans first.', citations: [] })
  }

  const outcome = await Promise.race([
    azureChat({
      model: STRATEGY_AI_MODEL,
      system: STRATEGY_AI_SYSTEM_PROMPT,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      messages: [{ role: 'user', content: `Current page: ${STRATEGY_MODULE_META[module].title}\n\nDATA (untrusted records):\n<<<\n${data}>>>\n\nQuestion: ${question}` }],
    }),
    new Promise<{ ok: false; reason: string }>(resolve => setTimeout(() => resolve({ ok: false, reason: 'timeout' }), TIMEOUT_MS)),
  ])

  if (!outcome.ok) {
    console.error('[strategy-ai] provider failure', { module, timeout: outcome.reason === 'timeout' })
    await log(session, module, 'failed')
    return NextResponse.json({ error: 'Fox AI could not answer right now. Nothing was charged against your allowance — try again shortly.' }, { status: 502 })
  }

  const answer = stripUnknownCitations(outcome.result.text, supplied).slice(0, 2400)
  const citations = extractCitations(answer, supplied).map(record => ({
    ref: record.ref, label: record.label, module: record.module,
    href: `${strategyPath(workspaceRouteSegment(session.ctx.workspaceType) ?? 'brand', record.module)}?focus=${record.id}`,
  }))
  await log(session, module, 'success', { prompt: outcome.result.promptTokens, completion: outcome.result.completionTokens })
  await logAudit(session.supabase, session.userId, {
    workspaceId: session.ctx.workspaceId, action: 'strategy.ai.asked', entityType: 'strategy_ai', entityId: null,
    metadata: { surface: module, model: STRATEGY_AI_MODEL, records_supplied: supplied.length, citations: citations.length, tokens: outcome.result.totalTokens },
  })

  return NextResponse.json({
    answer, citations,
    remainingToday: Math.max(0, limits.userDaily - used.userToday - 1),
  })
}
