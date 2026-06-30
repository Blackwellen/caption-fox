import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { enforceAiRateLimit } from '@/lib/ai/rate-limit'
import { isAiConfigured } from '@/lib/env'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function POST(req: NextRequest) {
  if (!isAiConfigured()) {
    return NextResponse.json({ error: 'AI is not configured on this environment.' }, { status: 503 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limited = await enforceAiRateLimit(supabase, user.id, { table: 'ai_generations' })
  if (limited) return limited

  const { prompt, style, platform, aspect_ratio, workspace_id } = await req.json()
  if (!prompt) return NextResponse.json({ error: 'Prompt required' }, { status: 400 })

  try {
    // Use Claude to generate a detailed Stable Diffusion / DALL-E prompt
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 500,
      system: `You are an expert AI art director specialising in social media content.
Generate detailed, highly specific image generation prompts optimised for ${platform ?? 'social media'}.
Style preference: ${style ?? 'modern, clean, professional'}.
Aspect ratio: ${aspect_ratio ?? '1:1 square'}.
Return ONLY the optimised image generation prompt. No explanations.`,
      messages: [{ role: 'user', content: `Create an image generation prompt for: ${prompt}` }],
    })

    const optimizedPrompt = msg.content[0].type === 'text' ? msg.content[0].text : prompt

    // If Stability AI key exists, call it
    let imageUrl: string | null = null
    const stabilityKey = process.env.STABILITY_API_KEY
    if (stabilityKey) {
      const width = aspect_ratio === '16:9' ? 1024 : aspect_ratio === '9:16' ? 576 : 1024
      const height = aspect_ratio === '16:9' ? 576 : aspect_ratio === '9:16' ? 1024 : 1024
      const resp = await fetch(
        'https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${stabilityKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text_prompts: [{ text: optimizedPrompt, weight: 1 }],
            cfg_scale: 7,
            width,
            height,
            steps: 30,
            samples: 1,
          }),
        },
      )
      if (resp.ok) {
        const data = await resp.json()
        imageUrl = `data:image/png;base64,${data.artifacts[0].base64}`
      }
    }

    // Log to ai_generations
    await supabase.from('ai_generations').insert({
      workspace_id: workspace_id ?? null,
      user_id: user.id,
      type: 'image',
      topic: prompt,
      output: JSON.stringify({ optimized_prompt: optimizedPrompt, image_url: imageUrl }),
      prompt_tokens: msg.usage.input_tokens,
      completion_tokens: msg.usage.output_tokens,
      status: 'draft',
    })

    return NextResponse.json({ optimized_prompt: optimizedPrompt, image_url: imageUrl, prompt })
  } catch (err) {
    console.error('Image generation error:', err)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
