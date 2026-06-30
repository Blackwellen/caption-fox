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

  const limited = await enforceAiRateLimit(supabase, user.id, { table: 'ai_generations' })
  if (limited) return limited

  const body = await req.json()
  const { type, platform, tone, topic, brandVoice, count = 3, workspaceId } = body

  if (!type || !topic) {
    return NextResponse.json({ error: 'type and topic required' }, { status: 400 })
  }

  const prompts: Record<string, string> = {
    caption: `Generate ${count} ${platform ?? 'social media'} captions about: "${topic}"
Tone: ${tone ?? 'engaging and professional'}
Brand voice: ${brandVoice ?? 'professional, friendly'}
Format: Return ONLY a JSON array of strings, no other text. Each caption should include emojis and 3-5 relevant hashtags at the end.
Lengths: appropriate for ${platform ?? 'Instagram'}.`,

    hook: `Generate ${count} scroll-stopping hooks (opening lines) for a ${platform ?? 'social media'} post about: "${topic}"
Tone: ${tone ?? 'engaging'}
Format: Return ONLY a JSON array of strings, no other text. Each hook should be under 15 words and immediately attention-grabbing.`,

    script: `Write a ${platform ?? 'TikTok/Reels'} video script about: "${topic}"
Tone: ${tone ?? 'engaging and direct'}
Brand voice: ${brandVoice ?? 'professional, friendly'}
Format: Return a single string with the script formatted as:
[HOOK - 0:00-0:05]
(content)
[MAIN POINT - 0:05-0:45]
(content)
[CTA - 0:45-0:60]
(content)`,

    hashtags: `Generate 20 relevant hashtags for a ${platform ?? 'Instagram'} post about: "${topic}"
Mix of: 5 high-volume (1M+ posts), 10 medium-volume (100K-1M), 5 niche/branded
Format: Return ONLY a JSON array of strings (include the # symbol), no other text.`,

    ideas: `Generate ${count} creative content ideas for "${topic}" targeting ${platform ?? 'social media'}
Tone: ${tone ?? 'varied'}
Format: Return ONLY a JSON array of objects with this shape: {"title": "...", "format": "Reel|Post|Story|Carousel", "hook": "...", "description": "..."}`,

    ugc_brief: `Write a UGC (user-generated content) brief for creators about: "${topic}"
Platform: ${platform ?? 'Instagram/TikTok'}
Include: objective, key messages, do's and don'ts, deliverables, tone guidelines.
Format: Return a clear, structured brief in markdown.`,
  }

  const prompt = prompts[type]
  if (!prompt) return NextResponse.json({ error: `Unknown generation type: ${type}` }, { status: 400 })

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = message.content[0].type === 'text' ? message.content[0].text : ''

  // Attempt to parse JSON for array types
  let result: string | unknown = raw
  if (['caption', 'hook', 'hashtags', 'ideas'].includes(type)) {
    try {
      const jsonMatch = raw.match(/\[[\s\S]*\]/)
      if (jsonMatch) result = JSON.parse(jsonMatch[0])
    } catch {
      result = raw
    }
  }

  // Log AI usage
  try {
    await supabase.from('ai_generations').insert({
      user_id: user.id,
      workspace_id: workspaceId ?? null,
      type,
      platform,
      tone,
      topic,
      output: typeof result === 'string' ? result : JSON.stringify(result),
      prompt_tokens: message.usage.input_tokens,
      completion_tokens: message.usage.output_tokens,
      status: 'draft',
    })
  } catch { /* non-critical logging */ }

  return NextResponse.json({ result, usage: message.usage })
}
