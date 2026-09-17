import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { requireCreatorModule } from '@/lib/creators/server'
import {
  briefCreators, briefDeliverables, getBrief, listSubmissions, recentActivity,
} from '@/lib/creators/data'
import {
  ASSET_TYPE_LABELS, BRIEF_APPROVAL_BADGE, BRIEF_APPROVAL_LABELS, BRIEF_CREATOR_BADGE,
  BRIEF_CREATOR_LABELS, BRIEF_STATUS_BADGE, BRIEF_STATUS_LABELS, SUBMISSION_STATUS_BADGE,
  SUBMISSION_STATUS_LABELS, type BriefCreatorStatus, type BriefStatus, type SubmissionStatus,
} from '@/lib/creators/constants'
import ActivityFeed from '@/components/creators/ActivityFeed'
import BriefStatusMenu from '@/components/creators/BriefStatusMenu'
import { UploadSubmissionButton } from '@/components/creators/SubmissionUpload'
import {
  CARD, CARD_SHADOW, CREATORS_PAGE, ChannelChips, CreatorChip, Panel, PersonChip,
  formatMoney, formatShortDate,
} from '@/components/creators/primitives'
import { Badge } from '@/components/ui/Badge'
import { AccessBlocked, PanelEmpty } from '@/components/creators/states'

export const dynamic = 'force-dynamic'

export default async function BriefDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, ctx, capabilities, access, basePath } = await requireCreatorModule('briefs')

  if (!access.allowed) return <div className={CREATORS_PAGE}><AccessBlocked access={access} /></div>

  const brief = await getBrief(supabase, ctx.workspaceId, id)
  if (!brief) notFound()

  const [creators, deliverables, submissions, activity] = await Promise.all([
    briefCreators(supabase, ctx.workspaceId, id),
    briefDeliverables(supabase, ctx.workspaceId, id),
    listSubmissions(supabase, ctx.workspaceId, {
      q: '', page: 1, size: 12, from: '', to: '', creator: '', brief: id, assetType: '', status: '',
      reviewer: '', rights: '', issue: '', campaign: '', channel: '', archived: false, sort: 'newest', view: 'gallery',
    }),
    recentActivity(supabase, ctx.workspaceId, 10, { entityId: id }),
  ])

  return (
    <div className={CREATORS_PAGE}>
      <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-1 text-[11px] text-slate-400">
        <Link href={basePath} className="hover:text-slate-700">Creators and UGC</Link>
        <ChevronRight size={11} aria-hidden />
        <Link href={`${basePath}/briefs`} className="hover:text-slate-700">Briefs</Link>
        <ChevronRight size={11} aria-hidden />
        <span className="font-medium text-slate-600">{brief.title}</span>
      </nav>

      <div className={`${CARD} ${CARD_SHADOW} mb-4 p-5`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">{brief.title}</h1>
              {capabilities.editBrief
                ? <BriefStatusMenu id={brief.id} current={brief.status as BriefStatus} compact />
                : <Badge variant={BRIEF_STATUS_BADGE[brief.status as BriefStatus]}>{BRIEF_STATUS_LABELS[brief.status as BriefStatus]}</Badge>}
              <Badge variant={BRIEF_APPROVAL_BADGE[brief.approval_stage as keyof typeof BRIEF_APPROVAL_BADGE]}>{BRIEF_APPROVAL_LABELS[brief.approval_stage as keyof typeof BRIEF_APPROVAL_LABELS] ?? brief.approval_stage}</Badge>
            </div>
            <p className="mt-1 max-w-2xl text-[13px] text-slate-500">{brief.description || 'No description provided.'}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-slate-500">
              {brief.campaign && <Link href={`/${basePath.split('/')[1]}/campaigns/${brief.campaign.id}`} className="hover:text-blue-600">{brief.campaign.name}</Link>}
              <ChannelChips channels={brief.channels} />
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-start gap-3 sm:items-end">
            <PersonChip person={brief.owner} />
            {capabilities.upload && !['draft', 'completed', 'cancelled'].includes(brief.status) && (
              <UploadSubmissionButton
                briefId={brief.id}
                creators={creators.filter(c => c.creator && !['declined', 'cancelled'].includes(c.status)).map(c => ({ id: c.creator_id, name: c.creator!.name }))}
                deliverables={deliverables.map(d => ({ id: d.id, title: d.title, asset_type: d.asset_type }))}
              />
            )}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-5">
          <Stat label="Budget" value={formatMoney(brief.budget, brief.currency ?? 'GBP')} />
          <Stat label="Creators assigned" value={String(brief.creators_assigned)} />
          <Stat label="Deliverables" value={`${brief.deliverables_submitted} / ${brief.deliverables_target || '—'}`} />
          <Stat label="Deadline" value={formatShortDate(brief.deadline)} />
          <Stat label="Priority" value={brief.priority} />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-4">
          <Panel title="Requirements">
            <div className="grid gap-3 sm:grid-cols-2 text-[13px] text-slate-600">
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Do</p>
                <p>{brief.do_instructions || '—'}</p>
              </div>
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Don&apos;t</p>
                <p>{brief.dont_instructions || '—'}</p>
              </div>
            </div>
            {brief.deliverables && <p className="mt-3 border-t border-slate-100 pt-3 text-[13px] text-slate-600">{brief.deliverables}</p>}
          </Panel>

          <Panel title="Deliverables">
            {deliverables.length === 0 ? <PanelEmpty message="No structured deliverables were defined for this brief." /> : (
              <ul className="divide-y divide-slate-50">
                {deliverables.map(deliverable => (
                  <li key={deliverable.id} className="flex items-center justify-between py-2.5 text-[13px]">
                    <span className="text-slate-700">{deliverable.title}</span>
                    <span className="text-slate-400">{ASSET_TYPE_LABELS[deliverable.asset_type as keyof typeof ASSET_TYPE_LABELS] ?? deliverable.asset_type} · x{deliverable.quantity}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Creators" viewAllHref={`${basePath}/creators?status=active`}>
            {creators.length === 0 ? <PanelEmpty message="No creators have been invited to this brief yet." /> : (
              <ul className="divide-y divide-slate-50">
                {creators.map(entry => (
                  <li key={entry.id} className="flex items-center justify-between py-2.5">
                    <CreatorChip creator={entry.creator} href={entry.creator ? `${basePath}/creators/${entry.creator.id}` : undefined} size={26} />
                    <Badge variant={BRIEF_CREATOR_BADGE[entry.status as BriefCreatorStatus] ?? 'slate'}>{BRIEF_CREATOR_LABELS[entry.status as BriefCreatorStatus] ?? entry.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Submissions" viewAllHref={`${basePath}/submissions?brief=${id}`}>
            {submissions.rows.length === 0 ? <PanelEmpty message="No submissions delivered against this brief yet." /> : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {submissions.rows.map(submission => (
                  <Link key={submission.id} href={`${basePath}/submissions/${submission.id}`}>
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
        </div>

        <aside className="space-y-4">
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
      <p className="mt-0.5 text-[15px] font-semibold text-slate-900 capitalize">{value}</p>
    </div>
  )
}
