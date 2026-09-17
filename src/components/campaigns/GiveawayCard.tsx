import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import {
  Avatar, CARD, CARD_SHADOW, ChannelChips, ProgressBar, formatNumber, formatShortDate,
} from './primitives'
import { HEALTH_BADGE, HEALTH_LABELS, type CampaignHealth } from '@/lib/campaigns/constants'
import type { GiveawayRow } from '@/lib/campaigns/types'
import { CampaignLink } from './links'

const COVER_TINTS = [
  'from-emerald-100 via-emerald-50 to-teal-100',
  'from-violet-100 via-indigo-50 to-blue-100',
  'from-rose-100 via-pink-50 to-red-100',
  'from-sky-100 via-cyan-50 to-blue-100',
  'from-amber-100 via-orange-50 to-yellow-100',
]

function tintFor(id: string): string {
  let hash = 0
  for (const char of id) hash = (hash + char.charCodeAt(0)) % COVER_TINTS.length
  return COVER_TINTS[hash]
}

const STATUS_BADGE: Record<string, 'green' | 'blue' | 'amber' | 'slate' | 'red'> = {
  active: 'green', draft: 'slate', ended: 'blue', cancelled: 'red', archived: 'slate',
}

export default function GiveawayCard({ giveaway }: { giveaway: GiveawayRow }) {
  const health = giveaway.health as CampaignHealth

  return (
    <article className={cn(CARD, CARD_SHADOW, 'group flex flex-col overflow-hidden transition-shadow hover:shadow-md')}>
      <div className="relative">
        {giveaway.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={giveaway.cover_url} alt="" className="h-[116px] w-full object-cover" />
        ) : (
          <div className={cn('flex h-[116px] w-full items-center justify-center bg-gradient-to-br px-4 text-center', tintFor(giveaway.id))}>
            <span className="line-clamp-2 text-[15px] font-bold uppercase tracking-wide text-slate-600/80">
              {giveaway.prize_title}
            </span>
          </div>
        )}
        <span className="absolute left-2.5 top-2.5">
          <Badge variant={HEALTH_BADGE[health] ?? 'slate'} className="bg-white/90 backdrop-blur">
            {HEALTH_LABELS[health] ?? giveaway.health}
          </Badge>
        </span>
      </div>

      <div className="flex flex-1 flex-col p-3">
        <CampaignLink
          to={`/giveaways/${giveaway.id}`}
          className="line-clamp-1 text-[13px] lg:text-[10px] font-semibold text-slate-900 hover:text-blue-600"
        >
          {giveaway.title}
        </CampaignLink>
        <p className="mt-px line-clamp-1 text-[11px] lg:text-[8.5px] text-slate-400">{giveaway.prize_title}</p>

        <div className="mt-1.5 flex items-center gap-1.5">
          <Avatar person={giveaway.owner} size={16} />
          <span className="truncate text-[11px] lg:text-[8.5px] text-slate-500">
            {giveaway.owner?.full_name ?? giveaway.owner?.email ?? 'Unassigned'}
          </span>
        </div>

        <dl className="mt-2.5 flex items-end gap-4">
          <div>
            <dd className="text-[15px] font-bold leading-none text-slate-900">{formatNumber(giveaway.total_entries)}</dd>
            <dt className="mt-0.5 text-[10px] lg:text-[8px] text-slate-400">Entries</dt>
          </div>
          <div>
            <dd className="text-[15px] font-bold leading-none text-slate-900">{(giveaway.conversion_rate ?? 0).toFixed(2)}%</dd>
            <dt className="mt-0.5 text-[10px] lg:text-[8px] text-slate-400">Conversion</dt>
          </div>
          <span className="ml-auto">
            <Badge status={giveaway.status} variant={STATUS_BADGE[giveaway.status]}>
              {giveaway.status.charAt(0).toUpperCase() + giveaway.status.slice(1)}
            </Badge>
          </span>
        </dl>

        <div className="mt-2.5 flex items-center gap-2">
          <span className="shrink-0 whitespace-nowrap text-[11px] lg:text-[8.5px] text-slate-500">
            Due: {formatShortDate(giveaway.end_date)}
          </span>
          <ProgressBar value={giveaway.progress} health={giveaway.health} label={`${giveaway.title} progress`} />
          <span className="w-8 shrink-0 text-right text-[11px] lg:text-[8.5px] font-semibold text-slate-700">{giveaway.progress}%</span>
        </div>

        <div className="mt-2.5 border-t border-slate-100 pt-2.5">
          <ChannelChips channels={giveaway.channels?.length ? giveaway.channels : giveaway.platform ? [giveaway.platform] : []} max={4} />
        </div>
      </div>
    </article>
  )
}
