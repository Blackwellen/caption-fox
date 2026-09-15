import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Avatar, CARD, CARD_SHADOW, ProgressBar, formatCompactMoney, formatNumber } from './primitives'
import { PlatformChips } from './primitives'
import { PROGRAMME_STATUS_BADGE, PROGRAMME_STATUS_LABELS, type ProgrammeStatus } from '@/lib/partnerships/constants'
import type { ProgrammeRow } from '@/lib/partnerships/types'

const THUMB_TINTS = [
  'from-blue-100 to-blue-200', 'from-violet-100 to-violet-200',
  'from-emerald-100 to-emerald-200', 'from-amber-100 to-amber-200',
  'from-rose-100 to-rose-200', 'from-sky-100 to-sky-200',
]

function tintFor(id: string): string {
  let hash = 0
  for (const char of id) hash = (hash + char.charCodeAt(0)) % THUMB_TINTS.length
  return THUMB_TINTS[hash]
}

export default function ProgrammeCard({ programme, href, platforms }: { programme: ProgrammeRow; href: string; platforms?: string[] }) {
  const status = programme.status as ProgrammeStatus

  return (
    <article className={cn(CARD, CARD_SHADOW, 'group flex flex-col p-3 transition-shadow hover:shadow-md')}>
      <div className="flex gap-2.5">
        {programme.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={programme.cover_url} alt="" className="h-[52px] w-[60px] shrink-0 rounded-lg bg-slate-100 object-cover" />
        ) : (
          <span aria-hidden className={cn('flex h-[52px] w-[60px] shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-[13px] font-bold text-slate-500', tintFor(programme.id))}>
            {programme.name.slice(0, 2).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <Link href={href} className="line-clamp-1 text-[13px] font-semibold text-slate-900 hover:text-blue-600">
            {programme.name}
          </Link>
          <p className="mt-px truncate text-[11px] text-slate-400">{programme.category ?? PROGRAMME_STATUS_LABELS[status]}</p>
          <div className="mt-1.5 flex items-center gap-1.5">
            <Avatar person={programme.owner} size={16} />
            <span className="truncate text-[11px] text-slate-500">
              {programme.owner?.full_name ?? programme.owner?.email ?? 'Unassigned'}
            </span>
          </div>
          <div className="mt-1.5">
            <Badge variant={PROGRAMME_STATUS_BADGE[status] ?? 'slate'} className="text-[10px]">
              {PROGRAMME_STATUS_LABELS[status] ?? programme.status}
            </Badge>
          </div>
        </div>
      </div>

      <dl className="mt-2.5 grid grid-cols-3 gap-2 border-t border-slate-100 pt-2.5 text-center">
        <div className="min-w-0">
          <dd className="truncate text-[13px] font-semibold text-slate-900">{formatNumber(programme.conversions ?? 0)}</dd>
          <dt className="text-[10px] text-slate-400">Conversions</dt>
        </div>
        <div className="min-w-0">
          <dd className="truncate text-[13px] font-semibold text-slate-900">{formatCompactMoney(programme.commission ?? 0, programme.currency)}</dd>
          <dt className="text-[10px] text-slate-400">Commission</dt>
        </div>
        <div className="min-w-0">
          <dd className="truncate text-[13px] font-semibold text-slate-900">{formatCompactMoney(programme.revenue ?? 0, programme.currency)}</dd>
          <dt className="text-[10px] text-slate-400">Revenue</dt>
        </div>
      </dl>

      {programme.current_tier_name && (
        <div className="mt-2.5 flex items-center gap-2">
          <ProgressBar value={programme.tier_progress_pct ?? 0} className="flex-1" label={`${programme.tier_progress_pct ?? 0}% to next tier`} />
          <span className="shrink-0 text-[10px] font-medium text-slate-400">{programme.tier_progress_pct ?? 0}% to next tier</span>
        </div>
      )}

      {platforms && platforms.length > 0 && (
        <div className="mt-2.5 flex items-center gap-2 border-t border-slate-100 pt-2.5">
          <PlatformChips platforms={platforms} max={3} />
          <span className="ml-auto text-[11px] text-slate-400">{formatNumber(programme.partner_count ?? 0)} partners</span>
        </div>
      )}
    </article>
  )
}
