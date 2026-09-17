import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronRight, Mail, MapPin } from 'lucide-react'
import { requireCreatorModule } from '@/lib/creators/server'
import {
  getCreator, listBriefs, listCreatorLists, listPayments, listRights, listRightsRequests,
  listSubmissions, recentActivity,
} from '@/lib/creators/data'
import {
  AVAILABILITY_LABELS, CREATOR_TIER_BADGE, CREATOR_TIER_LABELS, RELATIONSHIP_BADGE,
  RELATIONSHIP_LABELS, RIGHTS_STATUS_BADGE, RIGHTS_STATUS_LABELS, SUBMISSION_STATUS_BADGE,
  SUBMISSION_STATUS_LABELS, PAYMENT_STATUS_BADGE, PAYMENT_STATUS_LABELS, BRIEF_STATUS_BADGE,
  BRIEF_STATUS_LABELS, effectiveRightsStatus, type RelationshipStatus,
  type BriefStatus, type PaymentStatus, type SubmissionStatus,
} from '@/lib/creators/constants'
import ActivityFeed from '@/components/creators/ActivityFeed'
import {
  Avatar, CARD, CARD_SHADOW, CREATORS_PAGE, ChannelChips, NicheChip, Panel,
  formatCompactMoney, formatMoney, formatNumber, formatPercent,
} from '@/components/creators/primitives'
import { Badge } from '@/components/ui/Badge'
import { AccessBlocked, PanelEmpty } from '@/components/creators/states'
import CreatorRowActions from '@/components/creators/CreatorRowActions'
import { UsageRequestActions } from '@/components/creators/ReviewTools'

export const dynamic = 'force-dynamic'

export default async function CreatorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, ctx, capabilities, modules, access, basePath } = await requireCreatorModule('creators')

  if (!access.allowed) {
    return <div className={CREATORS_PAGE}><AccessBlocked access={access} /></div>
  }

  const creator = await getCreator(supabase, ctx.workspaceId, id)
  if (!creator) notFound()

  const [briefs, submissions, rights, payments, activity, lists, usageRequests] = await Promise.all([
    listBriefs(supabase, ctx.workspaceId, {
      q: '', page: 1, size: 5, from: '', to: '', campaign: '', channel: '', owner: '', status: '',
      approval: '', creator: id, rights: '', due: '', budgetMin: null, budgetMax: null, archived: false, sort: 'recent', view: 'table',
    }),
    listSubmissions(supabase, ctx.workspaceId, {
      q: '', page: 1, size: 6, from: '', to: '', creator: id, brief: '', assetType: '', status: '',
      reviewer: '', rights: '', issue: '', campaign: '', channel: '', archived: false, sort: 'newest', view: 'gallery',
    }),
    listRights(supabase, ctx.workspaceId, {
      q: '', page: 1, size: 5, from: '', to: '', territory: '', channel: '', campaign: '', creator: id,
      status: '', scope: '', owner: '', expiry: '', archived: false, sort: 'expiry_soonest', view: 'table',
    }),
    modules.includes('payments') && capabilities.viewPayments
      ? listPayments(supabase, ctx.workspaceId, {
        q: '', page: 1, size: 5, from: '', to: '', creator: id, campaign: '', brief: '', status: '',
        method: '', approver: '', currency: '', invoice: '', tax: '', batch: '', sort: 'submitted_newest', view: 'table',
      })
      : Promise.resolve({ rows: [], total: 0, error: null }),
    recentActivity(supabase, ctx.workspaceId, 10, { entityId: id }),
    listCreatorLists(supabase, ctx.workspaceId),
    modules.includes('rights') ? listRightsRequests(supabase, ctx.workspaceId, 10, id) : Promise.resolve([]),
  ])

  const relationship = creator.relationship_status as RelationshipStatus

  return (
    <div className={CREATORS_PAGE}>
      <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-1 text-[11px] text-slate-400">
        <Link href={basePath} className="hover:text-slate-700">Creators and UGC</Link>
        <ChevronRight size={11} aria-hidden />
        <Link href={`${basePath}/creators`} className="hover:text-slate-700">Creators</Link>
        <ChevronRight size={11} aria-hidden />
        <span className="font-medium text-slate-600">{creator.name}</span>
      </nav>

      <div className={`${CARD} ${CARD_SHADOW} mb-4 p-5`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <Avatar name={creator.name} src={creator.avatar_url} size={64} />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900">{creator.name}</h1>
                <Badge variant={CREATOR_TIER_BADGE[creator.creator_tier as keyof typeof CREATOR_TIER_BADGE] ?? 'slate'}>{CREATOR_TIER_LABELS[creator.creator_tier as keyof typeof CREATOR_TIER_LABELS] ?? creator.creator_tier}</Badge>
                <Badge variant={RELATIONSHIP_BADGE[relationship] ?? 'slate'}>{RELATIONSHIP_LABELS[relationship] ?? creator.relationship_status}</Badge>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-slate-500">
                {creator.handle && <span>@{creator.handle}</span>}
                {creator.email && <span className="flex items-center gap-1"><Mail size={12} />{creator.email}</span>}
                {creator.region && <span className="flex items-center gap-1"><MapPin size={12} />{creator.region}</span>}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <NicheChip niche={creator.niche} />
                <ChannelChips channels={creator.platforms} />
              </div>
            </div>
          </div>
          <CreatorRowActions creator={creator} lists={lists} canManage={capabilities.manageCreators} canManageLists={capabilities.manageLists} />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-5">
          <Stat label="Audience" value={formatNumber(creator.audience_size)} />
          <Stat label="Engagement" value={formatPercent(creator.engagement_rate)} />
          <Stat label="Avg. rate" value={creator.avg_rate ? formatCompactMoney(creator.avg_rate, creator.currency ?? 'GBP') : '—'} />
          <Stat label="Availability" value={AVAILABILITY_LABELS[creator.availability as keyof typeof AVAILABILITY_LABELS] ?? creator.availability} />
          <Stat label="Total earnings" value={formatCompactMoney(creator.total_earnings)} />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-4">
          {creator.bio && (
            <Panel title="About">
              <p className="text-[13px] leading-relaxed text-slate-600">{creator.bio}</p>
            </Panel>
          )}

          <Panel title="Briefs" viewAllHref={`${basePath}/briefs?creator=${id}`}>
            {briefs.rows.length === 0 ? <PanelEmpty message="This creator has not been assigned to any briefs yet." /> : (
              <ul className="divide-y divide-slate-50">
                {briefs.rows.map(brief => (
                  <li key={brief.id} className="flex items-center justify-between py-2.5">
                    <Link href={`${basePath}/briefs/${brief.id}`} className="min-w-0 truncate text-[13px] font-medium text-slate-800 hover:text-blue-600">{brief.title}</Link>
                    <Badge variant={BRIEF_STATUS_BADGE[brief.status as BriefStatus]}>{BRIEF_STATUS_LABELS[brief.status as BriefStatus]}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Submissions" viewAllHref={`${basePath}/submissions?creator=${id}`}>
            {submissions.rows.length === 0 ? <PanelEmpty message="No submissions from this creator yet." /> : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {submissions.rows.map(submission => (
                  <Link key={submission.id} href={`${basePath}/submissions/${submission.id}`} className="group">
                    <div className="aspect-square overflow-hidden rounded-lg bg-slate-100">
                      {submission.thumbnail_url
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={submission.thumbnail_url} alt="" className="h-full w-full object-cover" />
                        : <span className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">No preview</span>}
                    </div>
                    <Badge variant={SUBMISSION_STATUS_BADGE[submission.status as SubmissionStatus]} className="mt-1">{SUBMISSION_STATUS_LABELS[submission.status as SubmissionStatus]}</Badge>
                  </Link>
                ))}
              </div>
            )}
          </Panel>

          {modules.includes('rights') && (
            <Panel title="Usage Rights" viewAllHref={`${basePath}/rights?creator=${id}`}>
              {rights.rows.length === 0 ? <PanelEmpty message="No rights records for this creator yet." /> : (
                <ul className="divide-y divide-slate-50">
                  {rights.rows.map(right => {
                    const status = effectiveRightsStatus(right.status, right.expiry_date)
                    return (
                      <li key={right.id} className="flex items-center justify-between py-2.5">
                        <Link href={`${basePath}/rights/${right.id}`} className="min-w-0 truncate text-[13px] font-medium text-slate-800 hover:text-blue-600">{right.asset_label}</Link>
                        <Badge variant={RIGHTS_STATUS_BADGE[status]}>{RIGHTS_STATUS_LABELS[status]}</Badge>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Panel>
          )}

          {modules.includes('rights') && (
            <Panel title="Usage Requests">
              {usageRequests.length === 0 ? <PanelEmpty message="No usage-rights requests sent to this creator yet." /> : (
                <ul className="divide-y divide-slate-50">
                  {usageRequests.map(request => (
                    <li key={request.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <span className="min-w-0 text-[12.5px] text-slate-600">
                        <span className="block font-medium text-slate-800">
                          {(request.requested_channels ?? []).join(', ') || 'Any channel'} ? {(request.requested_territories ?? []).join(', ') || 'Any territory'}
                          {request.requested_duration_days ? ` ? ${request.requested_duration_days} days` : ''}
                        </span>
                        Proposed {request.proposed_fee !== null ? formatMoney(request.proposed_fee, request.currency) : 'no fee'}
                        {request.counter_fee !== null && <> ? countered {formatMoney(request.counter_fee, request.currency)}</>}
                        <span className="ml-2 capitalize text-slate-400">{request.status}</span>
                      </span>
                      {capabilities.manageRights && <UsageRequestActions id={request.id} status={request.status} currency={request.currency} />}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}

          {modules.includes('payments') && capabilities.viewPayments && (
            <Panel title="Payments" viewAllHref={`${basePath}/payments?creator=${id}`}>
              {payments.rows.length === 0 ? <PanelEmpty message="No payments recorded for this creator yet." /> : (
                <ul className="divide-y divide-slate-50">
                  {payments.rows.map(payment => (
                    <li key={payment.id} className="flex items-center justify-between py-2.5">
                      <Link href={`${basePath}/payments/${payment.id}`} className="text-[13px] font-medium text-slate-800 hover:text-blue-600">{formatMoney(payment.amount, payment.currency)}</Link>
                      <Badge variant={PAYMENT_STATUS_BADGE[payment.status as PaymentStatus]}>{PAYMENT_STATUS_LABELS[payment.status as PaymentStatus]}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}
        </div>

        <aside className="space-y-4">
          <Panel title="Notes">
            <p className="text-[13px] text-slate-500">{creator.notes || 'No internal notes recorded yet.'}</p>
          </Panel>
          <Panel title="Activity">
            <ActivityFeed basePath={basePath} items={activity} />
          </Panel>
        </aside>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium text-slate-400">{label}</p>
      <p className="mt-0.5 text-[15px] font-semibold text-slate-900">{value}</p>
    </div>
  )
}
