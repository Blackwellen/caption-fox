import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { requireCreatorModule } from '@/lib/creators/server'
import { getRights, recentActivity } from '@/lib/creators/data'
import {
  RIGHTS_STATUS_BADGE, RIGHTS_STATUS_LABELS, USAGE_SCOPE_LABELS,
  effectiveRightsStatus, daysUntil,
} from '@/lib/creators/constants'
import RightsStatusMenu from '@/components/creators/RightsStatusMenu'
import ActivityFeed from '@/components/creators/ActivityFeed'
import {
  CARD, CARD_SHADOW, CREATORS_PAGE, ChannelChips, CreatorChip, Panel, PersonChip,
  formatShortDate,
} from '@/components/creators/primitives'
import { Badge } from '@/components/ui/Badge'
import { AccessBlocked } from '@/components/creators/states'

export const dynamic = 'force-dynamic'

export default async function RightsDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, ctx, capabilities, access } = await requireCreatorModule('rights')

  if (!access.allowed) return <div className={CREATORS_PAGE}><AccessBlocked access={access} /></div>

  const rights = await getRights(supabase, ctx.workspaceId, id)
  if (!rights) notFound()

  const activity = await recentActivity(supabase, ctx.workspaceId, 10, { entityId: id })
  const status = effectiveRightsStatus(rights.status, rights.expiry_date)
  const remaining = daysUntil(rights.expiry_date)

  return (
    <div className={CREATORS_PAGE}>
      <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-1 text-[11px] text-slate-400">
        <Link href="/app/creators" className="hover:text-slate-700">Creators and UGC</Link>
        <ChevronRight size={11} aria-hidden />
        <Link href="/app/creators/rights" className="hover:text-slate-700">Rights</Link>
        <ChevronRight size={11} aria-hidden />
        <span className="font-medium text-slate-600">{rights.asset_label}</span>
      </nav>

      <div className={`${CARD} ${CARD_SHADOW} mb-4 p-5`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">{rights.asset_label}</h1>
              {capabilities.approveRights
                ? <RightsStatusMenu id={rights.id} current={status} />
                : <Badge variant={RIGHTS_STATUS_BADGE[status]}>{RIGHTS_STATUS_LABELS[status]}</Badge>}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="blue">{USAGE_SCOPE_LABELS[rights.usage_scope as keyof typeof USAGE_SCOPE_LABELS] ?? rights.usage_scope}</Badge>
              <ChannelChips channels={rights.channels} />
            </div>
          </div>
          <CreatorChip creator={rights.creator} href={rights.creator ? `/app/creators/creators/${rights.creator.id}` : undefined} />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-5">
          <Stat label="Territories" value={(rights.territories ?? []).join(', ') || '—'} />
          <Stat label="Start date" value={formatShortDate(rights.start_date)} />
          <Stat label="Expiry date" value={formatShortDate(rights.expiry_date)} />
          <Stat label="Days remaining" value={remaining !== null ? String(remaining) : '—'} />
          <Stat label="Agreement" value={rights.agreement_signed ? 'Signed' : rights.agreement_url ? 'Unsigned' : 'Missing'} />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-4">
          <Panel title="Permissions">
            <ul className="grid grid-cols-2 gap-2 text-[13px] text-slate-600 sm:grid-cols-4">
              <li>Exclusive: <b>{rights.exclusivity ? 'Yes' : 'No'}</b></li>
              <li>Modification: <b>{rights.modification_allowed ? 'Yes' : 'No'}</b></li>
              <li>Paid amplification: <b>{rights.paid_amplification ? 'Yes' : 'No'}</b></li>
              <li>Handle usage: <b>{rights.handle_usage ? 'Yes' : 'No'}</b></li>
            </ul>
          </Panel>
          {rights.notes && (
            <Panel title="Notes">
              <p className="text-[13px] text-slate-600">{rights.notes}</p>
            </Panel>
          )}
          {rights.submission && (
            <Panel title="Linked Submission">
              <Link href={`/app/creators/submissions/${rights.submission.id}`} className="text-[13px] font-medium text-blue-600 hover:underline">
                {rights.submission.title ?? 'View submission'}
              </Link>
            </Panel>
          )}
        </div>

        <aside className="space-y-4">
          <Panel title="Owner"><PersonChip person={rights.owner} /></Panel>
          <Panel title="Activity"><ActivityFeed items={activity} /></Panel>
        </aside>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium text-slate-400">{label}</p>
      <p className="mt-0.5 text-[14px] font-semibold text-slate-900">{value}</p>
    </div>
  )
}
