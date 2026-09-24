/** Pure helpers for showing Strategy assistant answers (no I/O, unit-tested). */

import { STRATEGY_MODULES, type StrategyModule } from './constants'

export type AnswerPart = { kind: 'text'; value: string } | { kind: 'cite'; ref: string }

/** Splits an answer into plain text and citation tags such as [O3]. */
export function splitCitations(answer: string): AnswerPart[] {
  const parts: AnswerPart[] = []
  let last = 0
  for (const match of answer.matchAll(/\[([A-Z]{1,2}\d{1,3})\]/g)) {
    const index = match.index ?? 0
    if (index > last) parts.push({ kind: 'text', value: answer.slice(last, index) })
    parts.push({ kind: 'cite', ref: match[1] })
    last = index + match[0].length
  }
  if (last < answer.length) parts.push({ kind: 'text', value: answer.slice(last) })
  return parts
}

/** Groups an answer into paragraphs and "- " bullet lines, preserving order. */
export function answerLines(answer: string): { bullet: boolean; text: string }[] {
  return answer.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line =>
    line.startsWith('- ') ? { bullet: true, text: line.slice(2) } : { bullet: false, text: line })
}

/** The Strategy page a path belongs to; anything unrecognised is the Overview. */
export function moduleFromPath(pathname: string): StrategyModule {
  const segments = pathname.split('/').filter(Boolean)
  const next = segments[segments.indexOf('strategy') + 1]
  return (STRATEGY_MODULES as readonly string[]).includes(next ?? '') ? (next as StrategyModule) : 'overview'
}

/** Only same-origin relative links from the server are rendered as links. */
export function safeInternalHref(href: unknown): string | null {
  return typeof href === 'string' && /^\/[A-Za-z0-9\-_/?=&%.]*$/.test(href) && !href.startsWith('//') ? href : null
}
