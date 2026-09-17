// Content quality scoring. Pure and dependency-free, so the Compose panel can
// score live as the user types with exactly the logic the server stores.

import { captionLimitFor } from './constants'

export interface QualityCheck { pass: boolean; label: string; detail: string }

/**
 * Derives the content-quality score from the record itself. Every point is
 * traceable to a check the user can see and act on — nothing here is random,
 * and the same function feeds both the Compose panel and the stored score.
 */
export function scoreContent(input: {
  caption: string
  platforms: string[]
  hashtags: string[]
  ctaLabel?: string | null
  assetCount: number
}): { score: number; checks: Record<string, QualityCheck> } {
  const words = input.caption.trim().split(/\s+/).filter(Boolean).length
  const sentences = input.caption.split(/[.!?]+/).filter(s => s.trim().length > 0).length || 1
  const wordsPerSentence = words / sentences
  const limit = captionLimitFor(input.platforms)

  const checks: Record<string, QualityCheck> = {
    length: {
      pass: input.caption.length > 40 && input.caption.length <= limit,
      label: 'Length',
      detail: input.caption.length > limit
        ? `Over the ${limit}-character channel limit`
        : input.caption.length <= 40 ? 'Too short to land a message' : 'Optimal',
    },
    readability: {
      pass: words > 0 && wordsPerSentence <= 22,
      label: 'Readability',
      detail: words === 0 ? 'Nothing written yet'
        : wordsPerSentence <= 22 ? 'Great' : 'Sentences are long — try breaking them up',
    },
    engagement: {
      pass: /[?!]|\bhow\b|\bwhy\b|\bwhat\b/i.test(input.caption),
      label: 'Engagement',
      detail: /[?!]/.test(input.caption) ? 'Excellent' : 'Add a question or hook',
    },
    cta: {
      pass: Boolean(input.ctaLabel?.trim()),
      label: 'Has CTA',
      detail: input.ctaLabel?.trim() ? 'Yes' : 'No call to action set',
    },
    hashtags: {
      pass: input.hashtags.length >= 3 && input.hashtags.length <= 15,
      label: 'Hashtags',
      detail: input.hashtags.length === 0 ? 'None added'
        : input.hashtags.length > 15 ? 'Too many for most channels' : 'Balanced',
    },
    media: {
      pass: input.assetCount > 0,
      label: 'Media',
      detail: input.assetCount > 0 ? `${input.assetCount} attached` : 'No media attached',
    },
  }

  const passed = Object.values(checks).filter(c => c.pass).length
  return { score: Math.round((passed / Object.keys(checks).length) * 100), checks }
}

