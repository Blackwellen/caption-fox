import { cn } from '@/lib/utils'

// Status / type chips shared by every Strategy table, card and board so one
// status never renders in two different colours on two tabs.

const CHIP = 'inline-flex h-5 shrink-0 items-center whitespace-nowrap rounded px-1.5 text-[11px] font-medium leading-none lg:h-[18px] lg:px-[6px] lg:text-[9px]'

const STATUS_TONE: Record<string, string> = {
  on_track: 'bg-emerald-100/70 text-emerald-700',
  at_risk: 'bg-orange-100/70 text-orange-600',
  off_track: 'bg-red-100/70 text-red-600',
  blocked: 'bg-red-100/70 text-red-600',
  completed: 'bg-sg-blue-soft text-sg-blue',
  approved: 'bg-emerald-100/70 text-emerald-700',
  active: 'bg-emerald-100/70 text-emerald-700',
  in_review: 'bg-amber-100/70 text-amber-700',
  needs_revision: 'bg-orange-100/70 text-orange-600',
  changes_requested: 'bg-orange-100/70 text-orange-600',
  paused: 'bg-amber-100/70 text-amber-700',
  draft: 'bg-slate-100 text-slate-500',
  not_started: 'bg-slate-100 text-slate-500',
  archived: 'bg-slate-100 text-slate-400',
}

export function StatusChip({ status, label, className }: { status: string; label?: string; className?: string }) {
  const text = label ?? status.replace(/_/g, ' ').replace(/^./, char => char.toUpperCase())
  return <span className={cn(CHIP, STATUS_TONE[status] ?? STATUS_TONE.draft, className)}>{text}</span>
}

const TYPE_TONE: Record<string, string> = {
  awareness: 'bg-sg-blue-soft text-sg-blue',
  growth: 'bg-violet-50 text-violet-600',
  engagement: 'bg-sg-blue-soft text-sg-blue',
  revenue: 'bg-violet-50 text-violet-600',
  retention: 'bg-pink-50 text-pink-500',
  efficiency: 'bg-violet-50 text-violet-600',
}

export function TypeChip({ type, label, className }: { type: string; label: string; className?: string }) {
  return <span className={cn(CHIP, TYPE_TONE[type] ?? 'bg-slate-100 text-slate-600', className)}>{label}</span>
}

const LEVEL_TONE: Record<string, string> = {
  high: 'bg-emerald-100/70 text-emerald-700',
  medium: 'bg-amber-100/70 text-amber-700',
  low: 'bg-red-100/70 text-red-600',
}

/** Confidence / impact level chip. `invert` for risk (high = red). */
export function LevelChip({ level, invert, className }: { level: 'high' | 'medium' | 'low'; invert?: boolean; className?: string }) {
  const tone = invert ? { high: LEVEL_TONE.low, medium: LEVEL_TONE.medium, low: LEVEL_TONE.high }[level] : LEVEL_TONE[level]
  return <span className={cn(CHIP, tone, className)}>{level[0].toUpperCase() + level.slice(1)}</span>
}

export function levelFromScore(score: number): 'high' | 'medium' | 'low' {
  return score >= 75 ? 'high' : score >= 50 ? 'medium' : 'low'
}

export const STATUS_BAR: Record<string, string> = {
  on_track: 'bg-emerald-500', at_risk: 'bg-orange-400', off_track: 'bg-red-500', blocked: 'bg-red-500',
  completed: 'bg-sg-blue', not_started: 'bg-slate-300', draft: 'bg-slate-300', archived: 'bg-slate-300',
}

export const STATUS_HEX: Record<string, string> = {
  on_track: '#22c55e', at_risk: '#f59e0b', off_track: '#ef4444', completed: '#8b5cf6',
  not_started: '#cbd5e1', draft: '#e2e8f0', blocked: '#ef4444',
}
