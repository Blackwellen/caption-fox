import { FileText, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import CampaignActionsMenu from './CampaignActionsMenu'
import {
  Avatar, CARD, CARD_SHADOW, ChannelChips, ProgressBar,
  formatMoney, formatShortDate,
} from './primitives'
import { CAMPAIGN_TYPE_LABELS } from '@/lib/constants'
import {
  LIFECYCLE_BADGE, LIFECYCLE_LABELS, type LifecycleStage,
} from '@/lib/campaigns/constants'
import type { CampaignRow } from '@/lib/campaigns/types'
import type { CampaignCapabilities } from '@/lib/campaigns/entitlements'
import { CampaignLink } from './links'

/** Placeholder tint for campaigns with no cover image yet. */
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

export function CampaignThumb({
  campaign, className,
}: { campaign: Pick<CampaignRow, 'id' | 'name' | 'thumbnail_url'>; className?: string }) {
  if (campaign.thumbnail_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={campaign.thumbnail_url} alt=""
        className={cn('shrink-0 rounded-lg bg-slate-100 object-cover', className)}
      />
    )
  }
  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-[13px] lg:text-[10px] font-bold text-white/90',
        tintFor(campaign.id), className,
      )}
    >
      <span className="text-slate-500">{campaign.name.slice(0, 2).toUpperCase()}</span>
    </span>
  )
}

export default function CampaignCard({
  campaign, capabilities, featured, contentCount,
}: {
  campaign: CampaignRow
  capabilities: CampaignCapabilities
  featured?: boolean
  contentCount?: number
}) {
  const stage = campaign.lifecycle_stage as LifecycleStage
  const budget = Number(campaign.budget ?? 0)
  const spend = Number(campaign.actual_spend ?? 0)
  const spendPercent = budget > 0 ? Math.min(999, Math.round((spend / budget) * 100)) : 0

  return (
    <article className={cn(CARD, CARD_SHADOW, 'group relative flex flex-col p-3 lg:p-2.5 transition-shadow hover:shadow-md')}>
      {featured && (
        <span
          className="absolute -left-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white ring-2 ring-white"
          title="Featured campaign"
        >
          <Star size={11} fill="currentColor" />
          <span className="sr-only">Featured</span>
        </span>
      )}

      <div className="flex gap-2.5 lg:gap-2">
        <CampaignThumb campaign={campaign} className="h-[52px] w-[60px] lg:h-[42px] lg:w-[46px]" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-1">
            <CampaignLink
              to={`/${campaign.id}`}
              className="line-clamp-1 flex-1 text-[13px] lg:text-[10px] font-semibold text-slate-900 hover:text-blue-600"
            >
              {campaign.name}
            </CampaignLink>
            <CampaignActionsMenu
              campaignId={campaign.id} name={campaign.name} stage={campaign.lifecycle_stage}
              archived={Boolean(campaign.archived_at)} capabilities={capabilities}
            />
          </div>
          <p className="mt-px truncate text-[11px] lg:text-[8.5px] text-slate-400">
            {CAMPAIGN_TYPE_LABELS[campaign.campaign_type] ?? campaign.campaign_type}
          </p>
          <div className="mt-1.5 flex items-center gap-1.5">
            <Avatar person={campaign.owner} size={16} />
            <span className="truncate text-[11px] lg:text-[8.5px] text-slate-500">
              {campaign.owner?.full_name ?? campaign.owner?.email ?? 'Unassigned'}
            </span>
          </div>
          <div className="mt-1.5">
            <Badge variant={LIFECYCLE_BADGE[stage] ?? 'slate'} className="text-[10px] lg:text-[8px]">
              {LIFECYCLE_LABELS[stage] ?? campaign.lifecycle_stage}
            </Badge>
          </div>
        </div>
      </div>

      <div className="mt-2.5 flex items-center gap-2">
        <span className="w-9 shrink-0 text-[11px] lg:text-[8.5px] font-semibold text-slate-700" title="Delivery progress">
          {campaign.progress}%
          <span className="sr-only"> delivery progress</span>
        </span>
        <ProgressBar
          value={campaign.progress} health={campaign.health}
          label={`${campaign.name} progress ${campaign.progress}%`}
        />
        <span
          className="w-9 shrink-0 text-right text-[11px] lg:text-[8.5px] font-medium text-slate-400"
          title={`Budget used: ${spendPercent}%`}
        >
          {budget > 0 ? `${spendPercent}%` : '—'}
          <span className="sr-only"> of budget used</span>
        </span>
      </div>

      <dl className="mt-2.5 grid grid-cols-2 gap-2 border-t border-slate-100 pt-2.5">
        <div className="min-w-0">
          <dd className="truncate text-[13px] lg:text-[10px] font-semibold text-slate-900">
            {budget > 0 ? formatMoney(budget, campaign.currency ?? 'GBP') : '—'}
          </dd>
          <dt className="text-[10px] lg:text-[8px] text-slate-400">Budget</dt>
        </div>
        <div className="min-w-0 text-right">
          <dd className="truncate text-[13px] lg:text-[10px] font-semibold text-slate-900">
            {formatShortDate(campaign.end_date)}
          </dd>
          <dt className="text-[10px] lg:text-[8px] text-slate-400">Due date</dt>
        </div>
      </dl>

      <div className="mt-2.5 flex items-center gap-2 border-t border-slate-100 pt-2.5">
        <ChannelChips channels={campaign.channels} max={3} />
        {contentCount !== undefined && (
          <span className="ml-auto inline-flex items-center gap-1 text-[11px] lg:text-[8.5px] text-slate-400" title="Linked content items">
            <FileText size={11} />
            {contentCount}
            <span className="sr-only"> linked content items</span>
          </span>
        )}
      </div>
    </article>
  )
}
