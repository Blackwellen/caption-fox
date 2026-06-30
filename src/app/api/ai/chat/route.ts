import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { enforceAiRateLimit } from '@/lib/ai/rate-limit'
import { isAiConfigured } from '@/lib/env'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  if (!isAiConfigured()) {
    return NextResponse.json({ error: 'AI is not configured on this environment.' }, { status: 503 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limited = await enforceAiRateLimit(supabase, user.id, { table: 'ai_usage_logs' })
  if (limited) return limited

  const body = await req.json()
  const { messages, mode = 'copilot', workspaceId } = body

  if (!messages || !Array.isArray(messages)) {
    return NextResponse.json({ error: 'messages array required' }, { status: 400 })
  }

  const systemPrompts: Record<string, string> = {
    copilot: `You are Fox AI, the intelligent assistant built into Caption Fox — a social media content operating system. You help brands, creators, and teams plan, create, and optimise their social media content.

Your capabilities: brainstorm content ideas, analyse performance data, answer questions about the user's workspace, suggest campaign strategies, and help with copywriting.

CRITICAL RULES — you must never:
- Publish content directly to social platforms (you can draft and suggest, user must approve)
- Approve your own generated content
- Delete any records
- Change billing or subscription details
- Disconnect social accounts
- Send public replies without explicit user confirmation

Always be creative, concise, and on-brand. When suggesting content, ask about tone and platform if not specified.`,

    create: `You are Fox AI in Create mode. Your job is to generate outstanding social media content: captions, hooks, scripts, hashtags, and content ideas.

Always ask: what platform, what tone, and what's the goal? Generate multiple variations. Keep captions punchy — most users need Instagram/TikTok-first content.

Never publish directly. Always return content as suggestions for the user to review.`,

    inbox: `You are Fox AI in Inbox mode. You help manage and draft responses to social media comments, DMs, and mentions.

Draft professional, on-brand replies. Flag anything that looks like a crisis, complaint escalation, or legal risk.

CRITICAL: You never send replies. You draft them for human review and approval. Always remind the user that replies require their review.`,

    tasks: `You are Fox AI in Tasks mode. You help manage campaign tasks, deadlines, and team assignments within Caption Fox.

Help prioritise work, identify blockers, and suggest task breakdowns. Never modify or delete task records directly.`,

    alerts: `You are Fox AI in Alerts mode. You summarise and explain alerts from connected social channels, analytics anomalies, and campaign performance issues.

Be concise — lead with the most critical alert, then explain what it means and what action to take.`,
  }

  const systemPrompt = systemPrompts[mode] ?? systemPrompts.copilot

  const formattedMessages = messages.map((m: { role: string; content: string }) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: systemPrompt,
    messages: formattedMessages,
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''

  // Log AI usage
  try {
    await supabase.from('ai_usage_logs').insert({
      user_id: user.id,
      workspace_id: workspaceId ?? null,
      mode,
      prompt_tokens: response.usage.input_tokens,
      completion_tokens: response.usage.output_tokens,
      action: 'chat',
    })
  } catch { /* non-critical logging */ }

  return NextResponse.json({ text, usage: response.usage })
}
