import { cn } from '@/lib/utils'
import { PLATFORM_TINT } from '@/lib/partnerships/constants'

export { Panel, Avatar, OwnerChip, ProgressBar, CARD, CARD_SHADOW, formatMoney, formatCompactMoney, formatNumber, formatShortDate, formatDayMonth } from '@/components/campaigns/primitives'

export const PARTNERSHIPS_PAGE = 'px-6 py-5 lg:px-8'

export function PlatformChips({ platforms, max = 3, className }: { platforms?: string[] | null; max?: number; className?: string }) {
  const list = platforms ?? []
  if (list.length === 0) return null
  const shown = list.slice(0, max)
  const extra = list.length - shown.length

  return (
    <span className={cn('flex items-center gap-1', className)}>
      {shown.map(platform => (
        <span
          key={platform} title={platform}
          className={cn(
            'inline-flex h-5 min-w-5 items-center justify-center rounded px-1 text-[9px] font-bold uppercase ring-1',
            PLATFORM_TINT[platform] ?? 'bg-slate-100 text-slate-600 ring-slate-200',
          )}
        >
          <span className="sr-only">{platform}</span>
          <span aria-hidden>{platform.slice(0, 2)}</span>
        </span>
      ))}
      {extra > 0 && <span className="text-[10px] font-medium text-slate-400">+{extra}</span>}
    </span>
  )
}

export function TierBadge({ name }: { name?: string | null }) {
  if (!name) return <span className="text-slate-300">—</span>
  const tone = /platinum/i.test(name) ? 'bg-slate-800 text-white'
    : /gold/i.test(name) ? 'bg-amber-100 text-amber-800'
    : /silver/i.test(name) ? 'bg-slate-200 text-slate-700'
    : /bronze/i.test(name) ? 'bg-orange-100 text-orange-800'
    : 'bg-blue-50 text-blue-700'
  return <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold', tone)}>{name}</span>
}
