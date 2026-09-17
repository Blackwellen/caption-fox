import { NextResponse, type NextRequest } from 'next/server'
import { getStudioSession } from '@/lib/studio/server'
import { canAccessStudioModule } from '@/lib/studio/entitlements'
import { enforceAiRateLimit } from '@/lib/ai/rate-limit'
import { azureChat, isAzureAiConfigured } from '@/lib/ai/azure'
import {
  MAX_OUTPUT_TOKENS, buildAssistPrompt, buildGeneratePrompt, cleanAssistOutput, parseAiRequest, parseVariants,
} from '@/lib/studio/ai'
import { logActivity, logAudit } from '@/lib/studio/action-helpers'
import { SUPPORT_REFERENCE } from '@/lib/studio/constants'

/**
 * Studio AI generation and the composer's AI Assist.
 *
 * Unlike the legacy /api/ai/generate route, the workspace comes from the
 * server-resolved session — never from the request body — and each call is
 * checked for the plan gate, the Studio AI permission, the monthly AI credit
 * allowance and the burst rate limit before the provider is called. A failed
 * provider call writes nothing, so it never consumes credits.
 */
export async function POST(req: NextRequest) {
  const session = await getStudioSession()
  const { supabase, ctx, userId, capabilities, limits } = session

  const access = canAccessStudioModule(ctx, 'ai-generate')
  if (!access.allowed) {
    return NextResponse.json({ error: access.message, code: access.upgrade ? 'upgrade_required' : 'forbidden' }, { status: 403 })
  }
  if (!capabilities.generateAi) {
    return NextResponse.json({ error: 'Your role does not allow AI generation.', code: 'forbidden' }, { status: 403 })
  }

  let body: unknown = null
  try { body = await req.json() } catch { /* handled by the parser */ }
  const parsed = parseAiRequest(body)
  if (!parsed.ok) {
    return NextResponse.json({ error: 'Please check the highlighted settings.', fieldErrors: parsed.errors, code: 'invalid' }, { status: 400 })
  }
  const request = parsed.value
  const cost = request.mode === 'generate' ? request.count : 1

  // Monthly AI credits: one credit per generated output, counted workspace-wide.
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)
  const { count: usedCount } = await supabase.from('ai_generations').select('id', { count: 'exact', head: true })
    .eq('workspace_id', ctx.workspaceId).gte('created_at', monthStart.toISOString())
  const used = usedCount ?? 0
  if (limits.aiMonthly >= 0 && used + cost > limits.aiMonthly) {
    return NextResponse.json({
      error: `This workspace has ${Math.max(0, limits.aiMonthly - used).toLocaleString('en-GB')} AI credits left this month and this request needs ${cost}. Upgrade your plan or reduce the number of results.`,
      code: 'credits_exhausted',
    }, { status: 402 })
  }

  const limited = await enforceAiRateLimit(supabase, userId, { table: 'ai_generations', monthlyCap: limits.aiMonthly })
  if (limited) return limited

  if (!isAzureAiConfigured()) {
    return NextResponse.json({ error: 'AI generation is not available right now. Nothing was charged.', code: 'provider_unavailable' }, { status: 503 })
  }

  let brandVoice: string | null = null
  if (request.mode === 'generate' && request.useBrandVoice && capabilities.useBrandVoice) {
    let voiceQuery = supabase.from('brand_voice_profiles').select('tones, style_rules, do_not_use').eq('workspace_id', ctx.workspaceId)
    if (request.brandId) voiceQuery = voiceQuery.eq('brand_id', request.brandId)
    const { data } = await voiceQuery.order('updated_at', { ascending: false }).limit(1).maybeSingle()
    if (data) {
      brandVoice = [
        data.tones?.length ? `Tones: ${data.tones.join(', ')}.` : '',
        data.style_rules ?? '',
        data.do_not_use?.length ? `Never use: ${data.do_not_use.join(', ')}.` : '',
      ].filter(Boolean).join(' ').slice(0, 600) || null
    }
  }

  const prompt = request.mode === 'generate' ? buildGeneratePrompt(request, brandVoice) : buildAssistPrompt(request)
  const model = request.mode === 'generate' ? request.model : 'gpt-5.4-nano'
  const outcome = await azureChat({
    model, system: prompt.system, messages: [{ role: 'user', content: prompt.user }],
    maxOutputTokens: MAX_OUTPUT_TOKENS[request.mode],
  })

  if (!outcome.ok) {
    // Provider detail stays in server logs; the client gets a safe reference.
    console.error('[studio:ai] provider failure:', outcome.reason.slice(0, 200))
    return NextResponse.json({
      error: `The AI provider did not respond. Nothing was charged, so you can try again. Reference ${SUPPORT_REFERENCE}-AI.`,
      code: 'provider_error',
    }, { status: 502 })
  }

  const variants = request.mode === 'generate'
    ? parseVariants(outcome.result.text, request.count)
    : [cleanAssistOutput(outcome.result.text)].filter(Boolean)
  if (variants.length === 0) {
    return NextResponse.json({ error: 'The AI returned an empty response. Nothing was charged.', code: 'empty' }, { status: 502 })
  }

  const batchId = crypto.randomUUID()
  const { data: rows, error } = await supabase.from('ai_generations').insert(variants.map(text => ({
    workspace_id: ctx.workspaceId,
    user_id: userId,
    type: request.mode === 'generate' ? 'custom' : `assist_${request.action}`,
    mode: request.mode,
    action: request.mode === 'assist' ? request.action : null,
    prompt: request.mode === 'generate' ? request.prompt : null,
    topic: request.mode === 'generate' ? request.prompt.slice(0, 80) : `AI Assist: ${request.action}`,
    output: text,
    channel: request.channel,
    platform: request.channel,
    tone: request.mode === 'generate' ? request.tone : null,
    objective: request.mode === 'generate' ? request.objective : null,
    audience: request.mode === 'generate' ? request.audience : null,
    model,
    word_count: text.split(/\s+/).filter(Boolean).length,
    batch_id: batchId,
    status: 'draft',
    prompt_tokens: Math.round(outcome.result.promptTokens / variants.length),
    completion_tokens: Math.round(outcome.result.completionTokens / variants.length),
  }))).select('id, output, created_at, word_count, model, channel, status, batch_id')

  if (error) {
    console.error('[studio:ai] usage insert failed:', error.message)
    return NextResponse.json({ error: `The content was generated but could not be saved. Reference ${SUPPORT_REFERENCE}-AI.`, code: 'save_failed' }, { status: 500 })
  }

  if (request.mode === 'generate') {
    await logActivity(supabase, ctx.workspaceId, userId, {
      entityType: 'ai', action: 'generated',
      summary: `generated ${variants.length} AI output${variants.length === 1 ? '' : 's'}`,
      link: `${session.base}/ai-generate`,
    })
  }
  await logAudit(supabase, ctx.workspaceId, userId, {
    action: `studio.ai.${request.mode}`, resourceType: 'ai_generation',
    metadata: {
      model, outputs: variants.length,
      prompt_tokens: outcome.result.promptTokens, completion_tokens: outcome.result.completionTokens,
    },
  })

  return NextResponse.json({
    outputs: rows ?? [],
    batchId,
    credits: { used: used + variants.length, limit: limits.aiMonthly },
  })
}
