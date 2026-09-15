import Link from 'next/link'
import { FileCheck2, Gavel, TrendingUp } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import {
  Avatar, CARD, CARD_SHADOW, ChannelChips, ProgressBar, formatNumber, formatShortDate,
} from './primitives'
import {
  HEALTH_BADGE, HEALTH_LABELS, JUDGING_STAGE_LABELS,
  type CampaignHealth, type JudgingStage,
} from '@/lib/campaigns/constants'
import { COMPETITION_TYPE_LABELS } from '@/lib/constants'
import type { CompetitionRow } from '@/lib/campaigns/types'

const COVER_TINTS = [
  'from-slate-200 via-slate-100 to-slate-200',
  'from-amber-100 via-orange-50 to-amber-200',
  'from-emerald-100 via-teal-50 to-emerald-200',
  'from-indigo-100 via-violet-50 to-indigo-200',
]

function tintFor(id: string): string {
  let hash = 0
  for (const char of id) hash = (hash + char.charCodeAt(0)) % COVER_TINTS.length
  return COVER_TINTS[hash]
}

export default function CompetitionCard({
  competition, featured,
}: { competition: CompetitionRow; featured?: boolean }) {
  const health = competition.health as CampaignHealth
  const stage = competition.judging_stage as JudgingStage

  return (
    <article className={cn(CARD, CARD_SHADOW, 'group flex flex-col overflow-hidden transition-shadow hover:shadow-md')}>
      <div className="relative">
        {competition.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={competition.cover_url} alt="" className="h-[112px] w-full object-cover" />
        ) : (
          <div className={cn('flex h-[112px] w-full items-center justify-center bg-gradient-to-br px-4 text-center', tintFor(competition.id))}>
            <span className="text-[13px] font-semibold uppercase tracking-wide text-slate-500">
              {COMPETITION_TYPE_LABELS[competition.competition_type] ?? competition.competition_type}
            </span>
          </div>
        )}
        {featured && (
          <span className="absolute left-2.5 top-2.5 rounded bg-blue-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
            Featured
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-3">
        <Link
          href={`/app/campaigns/competitions/${competition.id}`}
          className="line-clamp-1 text-[13px] font-semibold text-slate-900 hover:text-blue-600"
        >
          {competition.title}
        </Link>

        <div className="mt-1.5 flex items-center gap-1.5">
          <Avatar person={competition.owner} size={16} />
          <span className="truncate text-[11px] text-slate-500">
            {competition.owner?.full_name ?? competition.owner?.email ?? 'Unassigned'}
          </span>
        </div>

        <dl className="mt-2.5 grid grid-cols-3 gap-2">
          <div className="min-w-0">
            <dd className="flex items-center gap-1 text-[13px] font-bold text-slate-900">
              <FileCheck2 size={11} className="shrink-0 text-blue-500" />
              {formatNumber(competition.submission_count)}
            </dd>
            <dt className="mt-0.5 truncate text-[10px] text-slate-400">Submissions</dt>
          </div>
          <div className="min-w-0">
            <dd className="flex items-center gap-1 truncate text-[12px] font-semibold text-amber-600">
              <Gavel size={11} className="shrink-0" />
              {JUDGING_STAGE_LABELS[stage] ?? competition.judging_stage}
            </dd>
            <dt className="mt-0.5 truncate text-[10px] text-slate-400">Judging stage</dt>
          </div>
          <div className="min-w-0">
            <dd className="flex items-center gap-1 text-[13px] font-bold text-emerald-600">
              <TrendingUp size={11} className="shrink-0" />
              {Number(competition.engagement_rate ?? 0).toFixed(1)}%
            </dd>
            <dt className="mt-0.5 truncate text-[10px] text-slate-400">Engagement</dt>
          </div>
        </dl>

        <div className="mt-2.5 flex items-center gap-2">
          <span className="shrink-0 whitespace-nowrap text-[11px] text-slate-500">
            Due: {formatShortDate(competition.end_date)}
          </span>
          <span className="ml-auto">
            <Badge variant={HEALTH_BADGE[health] ?? 'slate'}>
              {HEALTH_LABELS[health] ?? competition.health}
            </Badge>
          </span>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <ProgressBar value={competition.progress} health={competition.health} label={`${competition.title} progress`} />
          <span className="w-8 shrink-0 text-right text-[11px] font-semibold text-slate-700">{competition.progress}%</span>
        </div>

        <div className="mt-2.5 border-t border-slate-100 pt-2.5">
          <ChannelChips channels={competition.channels} max={4} />
        </div>
      </div>
    </article>
  )
}
