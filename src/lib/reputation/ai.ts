import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { azureChat, isAzureAiConfigured, type AzureModel } from '@/lib/ai/azure'

// Cost control: small nano-model calls, tight windows, hard caps. These are
// deliberately conservative — PR & Reputation AI actions are short drafting
// aids (suggest an angle, draft a response), never long-form generation, so
// the token ceiling stays low on every call regardless of caller input.
const BURST_WINDOW_MS = 60_000
const BURST_LIMIT = 8
const SIX_HOUR_WINDOW_MS = 6 * 60 * 60_000
const SIX_HOUR_LIMIT = 15
const MONTHLY_LIMIT = 150

export interface AiOutcome {
  ok: boolean
  text?: string
  error?: string
}

async function checkRateLimit(supabase: SupabaseClient, workspaceId: string, userId: string): Promise<string | null> {
  const nowIso = new Date().toISOString()

  const { count: burstCount } = await supabase
    .from('reputation_ai_usage').select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId).eq('user_id', userId)
    .gte('created_at', new Date(Date.now() - BURST_WINDOW_MS).toISOString())
  if ((burstCount ?? 0) >= BURST_LIMIT) return 'Too many AI requests in a short time. Please wait a moment and try again.'

  const { count: windowCount } = await supabase
    .from('reputation_ai_usage').select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId).eq('user_id', userId)
    .gte('created_at', new Date(Date.now() - SIX_HOUR_WINDOW_MS).toISOString())
  if ((windowCount ?? 0) >= SIX_HOUR_LIMIT) return `You've reached the 6-hour AI limit (${SIX_HOUR_LIMIT} requests) for PR & Reputation. Try again later.`

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
  const { count: monthCount } = await supabase
    .from('reputation_ai_usage').select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId).eq('user_id', userId).gte('created_at', monthStart)
  if ((monthCount ?? 0) >= MONTHLY_LIMIT) return 'Monthly AI limit reached for PR & Reputation. Upgrade your plan for a higher limit.'

  void nowIso
  return null
}

async function logUsage(
  supabase: SupabaseClient, workspaceId: string, userId: string,
  entry: { action: string; model: AzureModel; promptTokens: number; completionTokens: number; totalTokens: number; entityType?: string; entityId?: string },
) {
  await supabase.from('reputation_ai_usage').insert({
    workspace_id: workspaceId, user_id: userId, action: entry.action, model: entry.model,
    prompt_tokens: entry.promptTokens, completion_tokens: entry.completionTokens, total_tokens: entry.totalTokens,
    entity_type: entry.entityType ?? null, entity_id: entry.entityId ?? null,
  })
}

/**
 * Runs a rate-limited, usage-logged Azure OpenAI chat call for a Reputation
 * AI action. Grounding is entirely the caller's responsibility — pass only
 * data the current user is permitted to see in `messages`.
 */
export async function runReputationAi(
  supabase: SupabaseClient, workspaceId: string, userId: string,
  opts: { action: string; system: string; prompt: string; maxOutputTokens?: number; entityType?: string; entityId?: string },
): Promise<AiOutcome> {
  if (!isAzureAiConfigured()) return { ok: false, error: 'AI is not configured on this environment.' }

  const limitError = await checkRateLimit(supabase, workspaceId, userId)
  if (limitError) return { ok: false, error: limitError }

  const model: AzureModel = 'gpt-5.4-nano'
  const outcome = await azureChat({
    model, system: opts.system, messages: [{ role: 'user', content: opts.prompt }],
    maxOutputTokens: opts.maxOutputTokens ?? 350,
  })

  if (!outcome.ok) return { ok: false, error: outcome.reason }

  await logUsage(supabase, workspaceId, userId, {
    action: opts.action, model, promptTokens: outcome.result.promptTokens,
    completionTokens: outcome.result.completionTokens, totalTokens: outcome.result.totalTokens,
    entityType: opts.entityType, entityId: opts.entityId,
  })

  return { ok: true, text: outcome.result.text }
}
