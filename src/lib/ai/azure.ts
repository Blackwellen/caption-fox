import 'server-only'

// Canonical Azure OpenAI (Azure AI Foundry) chat client. Plain fetch — no SDK
// dependency, mirroring the Resend email provider pattern
// (src/lib/messaging/providers/email.ts). Every caller in the product should
// go through this one client so the deployment name, token caps and cost
// controls live in exactly one place.
//
// Auth: AZURE_OPENAI_ENDPOINT + AZURE_OPENAI_API_KEY + AZURE_OPENAI_API_VERSION.
// GPT-5.x deployments on this resource require `max_completion_tokens`, not
// the legacy `max_tokens` parameter — this client always sends the former.

export type AzureModel = 'gpt-5.4-nano' | 'gpt-5.4-mini'

export interface AzureChatMessage { role: 'system' | 'user' | 'assistant'; content: string }

export interface AzureChatResult {
  text: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export type AzureChatOutcome =
  | { ok: true; result: AzureChatResult }
  | { ok: false; reason: string }

export function isAzureAiConfigured(): boolean {
  return Boolean(process.env.AZURE_OPENAI_ENDPOINT && process.env.AZURE_OPENAI_API_KEY)
}

/**
 * A single, non-streaming chat completion call. `maxOutputTokens` should stay
 * small for cost control — every caller in this product should ask for the
 * shortest useful output, not "as much as the model wants to write".
 */
export async function azureChat(opts: {
  model?: AzureModel
  system?: string
  messages: AzureChatMessage[]
  maxOutputTokens?: number
}): Promise<AzureChatOutcome> {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT
  const apiKey = process.env.AZURE_OPENAI_API_KEY
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION ?? '2024-10-21'
  if (!endpoint || !apiKey) return { ok: false, reason: 'Azure OpenAI is not configured on this environment.' }

  const model = opts.model ?? 'gpt-5.4-nano'
  const messages: AzureChatMessage[] = opts.system ? [{ role: 'system', content: opts.system }, ...opts.messages] : opts.messages

  try {
    const res = await fetch(`${endpoint}/openai/deployments/${model}/chat/completions?api-version=${apiVersion}`, {
      method: 'POST',
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, max_completion_tokens: opts.maxOutputTokens ?? 400 }),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return { ok: false, reason: `Azure OpenAI rejected the request (${res.status}): ${body.slice(0, 300)}` }
    }

    const data = await res.json() as {
      choices?: { message?: { content?: string } }[]
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
    }
    const text = data.choices?.[0]?.message?.content?.trim()
    if (!text) return { ok: false, reason: 'Azure OpenAI returned an empty response.' }

    return {
      ok: true,
      result: {
        text,
        promptTokens: data.usage?.prompt_tokens ?? 0,
        completionTokens: data.usage?.completion_tokens ?? 0,
        totalTokens: data.usage?.total_tokens ?? 0,
      },
    }
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : 'Unknown Azure OpenAI error.' }
  }
}
