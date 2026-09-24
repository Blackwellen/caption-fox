/**
 * The Strategy assistant is one dialog mounted once in the Strategy layout.
 * Every page's "More actions" menu opens it through this event, so the page
 * headers stay pixel-identical to the approved designs (no extra button).
 */
export const STRATEGY_ASSISTANT_EVENT = 'strategy:assistant:open'

export function openStrategyAssistant(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(STRATEGY_ASSISTANT_EVENT))
}
