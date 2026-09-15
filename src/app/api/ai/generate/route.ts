import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { enforceAiRateLimit } from '@/lib/ai/rate-limit'
import { azureChat, isAzureAiConfigured } from '@/lib/ai/azure'

export async function POST(req: NextRequest) {
  if (!isAzureAiConfigured()) {
    return NextResponse.json({ error: 'AI is not configured on this environment.' }, { status: 503 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limited = await enforceAiRateLimit(supabase, user.id, { table: 'ai_generations' })
  if (limited) return limited

  const body = await req.json()
  const {
    type, platform, tone, topic, brandVoice, count = 3, workspaceId,
    objective, audience, length, format,
  } = body

  if (!type || !topic) {
    return NextResponse.json({ error: 'type and topic required' }, { status: 400 })
  }

  const prompts: Record<string, string> = {
    // The Studio → AI Generate page's free-text "Your prompt" box is passed as
    // `topic` with type "custom": the user's own words are the prompt.
    custom: `${topic}

Channel: ${platform ?? 'general social media'}
Tone: ${tone ?? 'engaging and professional'}
${objective ? `Objective: ${objective}\n` : ''}${audience ? `Audience: ${audience}\n` : ''}${length ? `Length: ${length}\n` : ''}${format ? `Format: ${format}\n` : ''}${brandVoice ? `Brand voice: ${brandVoice}\n` : ''}
Return ONLY a JSON array of ${count} distinct string variations, no other text.`,

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

  const outcome = await azureChat({
    model: 'gpt-5.4-mini',
    messages: [{ role: 'user', content: prompt }],
    maxOutputTokens: 2048,
  })

  if (!outcome.ok) {
    return NextResponse.json({ error: outcome.reason }, { status: 502 })
  }

  const raw = outcome.result.text

  // Attempt to parse JSON for array types
  let result: string | unknown = raw
  if (['caption', 'hook', 'hashtags', 'ideas', 'custom'].includes(type)) {
    try {
      const jsonMatch = raw.match(/\[[\s\S]*\]/)
      if (jsonMatch) result = JSON.parse(jsonMatch[0])
    } catch {
      result = raw
    }
  }

  const variants = Array.isArray(result) ? result.map(String) : [typeof result === 'string' ? result : JSON.stringify(result)]
  const batchId = variants.length > 1 || type === 'custom' ? crypto.randomUUID() : null

  // Log AI usage — one row per variant so the outputs list, credit meter and
  // regeneration-rate stat all reflect what was actually produced.
  const ids: string[] = []
  try {
    const { data: inserted } = await supabase.from('ai_generations').insert(
      variants.map(text => ({
        user_id: user.id,
        workspace_id: workspaceId ?? null,
        type, platform, tone, topic,
        channel: platform ?? null,
        objective: objective ?? null,
        audience: audience ?? null,
        model: 'gpt-5.4-mini',
        output: text,
        word_count: text.trim().split(/\s+/).filter(Boolean).length,
        batch_id: batchId,
        prompt_tokens: Math.round(outcome.result.promptTokens / variants.length),
        completion_tokens: Math.round(outcome.result.completionTokens / variants.length),
        status: 'draft',
      })),
    ).select('id')
    for (const row of inserted ?? []) ids.push(row.id)
  } catch { /* non-critical logging */ }

  return NextResponse.json({
    result, variants, ids,
    usage: { input_tokens: outcome.result.promptTokens, output_tokens: outcome.result.completionTokens },
  })
}
