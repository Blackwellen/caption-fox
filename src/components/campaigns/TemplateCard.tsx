import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import TemplateActions from './TemplateActions'
import { Avatar, CARD, CARD_SHADOW, formatShortDate } from './primitives'
import {
  TEMPLATE_STATUS_BADGE, TEMPLATE_STATUS_LABELS, type TemplateStatus,
} from '@/lib/campaigns/constants'
import type { PersonLite, TemplateRow } from '@/lib/campaigns/types'
import type { CampaignCapabilities } from '@/lib/campaigns/entitlements'

const TINTS = [
  'from-blue-100 to-indigo-100', 'from-emerald-100 to-teal-100',
  'from-rose-100 to-pink-100', 'from-amber-100 to-orange-100',
  'from-violet-100 to-purple-100',
]

function tintFor(id: string): string {
  let hash = 0
  for (const char of id) hash = (hash + char.charCodeAt(0)) % TINTS.length
  return TINTS[hash]
}

export default function TemplateCard({
  template, capabilities, members, featured,
}: {
  template: TemplateRow
  capabilities: CampaignCapabilities
  members: PersonLite[]
  featured?: boolean
}) {
  const status = template.status as TemplateStatus

  return (
    <article className={cn(CARD, CARD_SHADOW, 'relative flex flex-col p-3 transition-shadow hover:shadow-md')}>
      {(featured || template.is_favourite) && (
        <span
          className="absolute -left-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] text-white ring-2 ring-white"
          title={template.is_favourite ? 'Favourite template' : 'Most used template'}
        >
          <span aria-hidden>&#9733;</span>
          <span className="sr-only">{template.is_favourite ? 'Favourite' : 'Most used'}</span>
        </span>
      )}

      <div className="flex gap-2.5">
        {template.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={template.cover_url} alt="" className="h-[52px] w-[60px] shrink-0 rounded-lg object-cover" />
        ) : (
          <span
            aria-hidden
            className={cn('flex h-[52px] w-[60px] shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-[13px] font-bold text-slate-500', tintFor(template.id))}
          >
            {template.name.slice(0, 2).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-1 text-[13px] font-semibold text-slate-900">{template.name}</h3>
          <p className="mt-px truncate text-[11px] capitalize text-slate-400">
            {template.category.replace(/_/g, ' ')}
          </p>
          <div className="mt-1.5 flex items-center gap-1.5">
            <Avatar person={template.owner} size={16} />
            <span className="truncate text-[11px] text-slate-500">
              {template.owner?.full_name ?? template.owner?.email ?? 'Unassigned'}
            </span>
          </div>
          <div className="mt-1.5">
            <Badge variant={TEMPLATE_STATUS_BADGE[status] ?? 'slate'} className="text-[10px]">
              {TEMPLATE_STATUS_LABELS[status] ?? template.status}
            </Badge>
          </div>
        </div>
      </div>

      <dl className="mt-2.5 flex gap-5 border-t border-slate-100 pt-2.5">
        <div>
          <dt className="text-[10px] text-slate-400">Used</dt>
          <dd className="text-[12px] font-semibold text-slate-900">
            {template.usage_count} time{template.usage_count === 1 ? '' : 's'}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] text-slate-400">Workflows</dt>
          <dd className="text-[12px] font-semibold text-slate-900">{template.linked_workflows}</dd>
        </div>
      </dl>

      <div className="mt-2.5 flex items-center gap-1 border-t border-slate-100 pt-2.5">
        <span className="truncate text-[11px] text-slate-400">
          Updated {formatShortDate(template.updated_at)}
        </span>
        <span className="ml-auto shrink-0">
          <TemplateActions template={template} capabilities={capabilities} members={members} />
        </span>
      </div>
    </article>
  )
}
