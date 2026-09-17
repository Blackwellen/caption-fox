'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { setNextActionDone } from '@/lib/strategy/actions/common'
import { STRATEGY_MODULE_META, strategyPath, type StrategyModule } from '@/lib/strategy/constants'
import { formatDayMonth } from '@/lib/strategy/format'
import type { NextActionRow } from '@/lib/strategy/types'
import { useStrategyAction } from '../client/use-action'

const MODULE_TONE: Record<string, string> = {
  positioning: 'bg-violet-50 text-violet-600', plans: 'bg-violet-50 text-violet-600',
  research: 'bg-slate-100 text-slate-600', forecasts: 'bg-slate-100 text-slate-600',
  objectives: 'bg-sg-blue-soft text-sg-blue', audiences: 'bg-teal-50 text-teal-700',
}
const PRIORITY_TONE: Record<string, string> = {
  urgent: 'bg-red-50 text-red-600', high: 'bg-red-50 text-red-500', medium: 'bg-amber-50 text-amber-600', low: 'bg-slate-100 text-slate-500',
}

/** Checking an action completes it; a failed save rolls the tick back. */
export default function NextActions({ kind, rows, canEdit }: { kind: string; rows: NextActionRow[]; canEdit: boolean }) {
  const { run } = useStrategyAction()
  const [done, setDone] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState<string | null>(null)

  async function toggle(row: NextActionRow) {
    if (busy) return
    const next = !done[row.id]
    setDone(state => ({ ...state, [row.id]: next }))
    setBusy(row.id)
    const result = await run(() => setNextActionDone(row.id, next), { success: next ? 'Action completed.' : 'Action reopened.' })
    if (!result.ok) setDone(state => ({ ...state, [row.id]: !next }))
    setBusy(null)
  }

  return (
    <ul className="divide-y divide-sg-line-soft">
      {rows.map(row => {
        const checked = Boolean(done[row.id])
        const area = row.module as StrategyModule
        return (
          <li key={row.id} className="flex min-h-12 items-center gap-2.5 py-1.5 lg:min-h-[39px] lg:gap-[11px] lg:py-0">
            <button type="button" role="checkbox" aria-checked={checked} disabled={!canEdit || busy === row.id}
              aria-label={`Mark "${row.title}" as ${checked ? 'open' : 'done'}`}
              title={canEdit ? undefined : 'Your role cannot complete actions'}
              onClick={() => toggle(row)}
              className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors lg:h-[14px] lg:w-[14px]',
                checked ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 bg-white hover:border-sg-blue',
                !canEdit && 'cursor-not-allowed opacity-60')}>
              {checked && <Check aria-hidden className="h-3 w-3 lg:h-2.5 lg:w-2.5" strokeWidth={3} />}
            </button>
            <Link href={strategyPath(kind, STRATEGY_MODULE_META[area] ? area : 'overview')}
              className={cn('min-w-0 truncate text-[13px] text-sg-body hover:text-sg-ink hover:underline lg:text-[10px]', checked && 'text-slate-400 line-through')}>
              {row.title}
            </Link>
            <span className={cn('hidden h-[18px] shrink-0 items-center rounded px-1.5 text-[11px] sm:inline-flex lg:h-[15px] lg:text-[8.5px]', MODULE_TONE[row.module] ?? MODULE_TONE.research)}>
              {STRATEGY_MODULE_META[area]?.label ?? row.module}
            </span>
            <span className={cn('inline-flex h-[18px] shrink-0 items-center rounded px-1.5 text-[11px] capitalize lg:h-[15px] lg:text-[8.5px]', PRIORITY_TONE[row.priority])}>
              {row.priority}
            </span>
            <time dateTime={row.due_date ?? undefined} className="ml-auto shrink-0 pl-2 text-[12px] text-sg-muted lg:text-[9.5px]">
              {formatDayMonth(row.due_date)}
            </time>
          </li>
        )
      })}
    </ul>
  )
}
