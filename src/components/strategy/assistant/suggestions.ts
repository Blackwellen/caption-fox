import type { StrategyModule } from '@/lib/strategy/constants'

/**
 * Starter questions per page. Each one can be answered from the records the
 * assistant is given for that page, so none of them invites a made-up answer.
 */
export const STRATEGY_SUGGESTIONS: Record<StrategyModule, string[]> = {
  overview: [
    'What needs my attention this week?',
    'Which objectives are at risk, and why?',
    'Summarise our strategy health in five bullets.',
  ],
  objectives: [
    'Which objectives are off track or at risk?',
    'Which objectives are due soonest?',
    'Which objectives have no linked audience or plan?',
  ],
  audiences: [
    'Which audiences have the highest fit score?',
    'Where is our audience data least complete?',
    'Which regions do our audiences concentrate in?',
  ],
  research: [
    'What are the highest-impact findings we have?',
    'Which research is waiting for review?',
    'What does our research say about sustainability?',
  ],
  positioning: [
    'Which proof points are still unverified?',
    'Where are our competitor gaps?',
    'Where is the approval workflow stuck?',
  ],
  plans: [
    'Which plans are behind schedule?',
    'What are the biggest risks across our plans?',
    'Which milestones are due in the next two weeks?',
  ],
  forecasts: [
    'How do the scenarios compare against target?',
    'Which assumptions carry the most risk?',
    'Are we on track against the revenue target?',
  ],
}
