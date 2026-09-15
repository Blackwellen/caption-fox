import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { requireCreatorModule } from '@/lib/creators/server'
import {
  getSubmission, submissionAssets, submissionIssues, submissionReviews,
} from '@/lib/creators/data'
import {
  ASSET_TYPE_LABELS, ISSUE_CATEGORY_LABELS, SUBMISSION_STATUS_BADGE, SUBMISSION_STATUS_LABELS,
  type SubmissionStatus,
} from '@/lib/creators/constants'
import SubmissionReviewActions from '@/components/creators/SubmissionReviewActions'
import {
  CARD, CARD_SHADOW, CREATORS_PAGE, CreatorChip, Panel, PersonChip,
  formatAgo, formatDateTime, formatDuration, formatNumber, formatPercent,
} from '@/components/creators/primitives'
import { Badge } from '@/components/ui/Badge'
import { AccessBlocked, PanelEmpty } from '@/components/creators/states'

export const dynamic = 'force-dynamic'

export default async function SubmissionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, ctx, capabilities, access } = await requireCreatorModule('submissions')

  if (!access.allowed) return <div className={CREATORS_PAGE}><AccessBlocked access={access} /></div>

  const submission = await getSubmission(supabase, ctx.workspaceId, id)
  if (!submission) notFound()

  const [assets, reviews, issues] = await Promise.all([
    submissionAssets(supabase, ctx.workspaceId, id),
    submissionReviews(supabase, ctx.workspaceId, id),
    submissionIssues(supabase, ctx.workspaceId, id),
  ])

  const primaryAsset = assets.find(a => a.version === submission.version) ?? assets[0]

  return (
    <div className={CREATORS_PAGE}>
      <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-1 text-[11px] text-slate-400">
        <Link href="/app/creators" className="hover:text-slate-700">Creators and UGC</Link>
        <ChevronRight size={11} aria-hidden />
        <Link href="/app/creators/submissions" className="hover:text-slate-700">Submissions</Link>
        <ChevronRight size={11} aria-hidden />
        <span className="font-medium text-slate-600">{submission.title ?? `Submission #${submission.id.slice(0, 6)}`}</span>
      </nav>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-4">
          <div className={`${CARD} ${CARD_SHADOW} overflow-hidden`}>
            <div className="flex aspect-video items-center justify-center bg-slate-900">
              {primaryAsset?.signed_url ? (
                primaryAsset.media_type === 'video'
                  ? <video src={primaryAsset.signed_url} controls className="h-full w-full" />
                  // eslint-disable-next-line @next/next/no-img-element
                  : <img src={primaryAsset.signed_url} alt={primaryAsset.original_name ?? 'Submission asset'} className="h-full w-full object-contain" />
              ) : <p className="text-sm text-slate-400">No preview available for this file type.</p>}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-bold text-slate-900">{submission.title ?? `Submission #${submission.id.slice(0, 6)}`}</h1>
                  <Badge variant={SUBMISSION_STATUS_BADGE[submission.status as SubmissionStatus]}>{SUBMISSION_STATUS_LABELS[submission.status as SubmissionStatus]}</Badge>
                  <span className="text-[12px] text-slate-400">v{submission.version}</span>
                </div>
                <p className="mt-1 text-[12.5px] text-slate-500">
                  {ASSET_TYPE_LABELS[submission.asset_type as keyof typeof ASSET_TYPE_LABELS] ?? submission.asset_type}
                  {submission.duration_seconds ? ` · ${formatDuration(submission.duration_seconds)}` : ''}
                  {' · '}Submitted {formatAgo(submission.submitted_at)}
                </p>
              </div>
              <CreatorChip creator={submission.creator} href={submission.creator ? `/app/creators/creators/${submission.creator.id}` : undefined} />
            </div>
          </div>

          {assets.length > 1 && (
            <Panel title="All Files">
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                {assets.map(asset => (
                  <div key={asset.id} className="aspect-square overflow-hidden rounded-lg bg-slate-100">
                    {asset.signed_url && asset.media_type === 'image' ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={asset.signed_url} alt={asset.original_name ?? ''} className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">{asset.media_type}</span>
                    )}
                  </div>
                ))}
              </div>
            </Panel>
          )}

          <Panel title="Requirement">
            <p className="text-[13px] text-slate-600">{submission.brief ? <Link href={`/app/creators/briefs/${submission.brief.id}`} className="font-medium text-blue-600 hover:underline">{submission.brief.title}</Link> : 'No linked brief.'}</p>
            {submission.notes && <p className="mt-2 text-[13px] text-slate-500">{submission.notes}</p>}
          </Panel>

          <Panel title="Flagged Issues">
            {issues.length === 0 ? <PanelEmpty message="No issues have been flagged on this submission." /> : (
              <ul className="divide-y divide-slate-50">
                {issues.map(issue => (
                  <li key={issue.id} className="flex items-center justify-between py-2.5 text-[13px]">
                    <span className="text-slate-700">
                      {ISSUE_CATEGORY_LABELS[issue.category as keyof typeof ISSUE_CATEGORY_LABELS] ?? issue.category}
                      {issue.source === 'automated' && <span className="ml-1.5 text-[11px] text-slate-400">(automated — needs confirmation)</span>}
                    </span>
                    <Badge variant={issue.status === 'open' ? 'amber' : issue.status === 'confirmed' ? 'red' : 'slate'}>{issue.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Review History">
            {reviews.length === 0 ? <PanelEmpty message="No review activity yet." /> : (
              <ul className="space-y-3">
                {reviews.map(review => (
                  <li key={review.id} className="flex items-start gap-2.5">
                    <PersonChip person={review.reviewer} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12.5px] text-slate-700 capitalize">{review.decision.replace(/_/g, ' ')}{review.note ? ` — ${review.note}` : ''}</span>
                      <span className="text-[11px] text-slate-400">{formatDateTime(review.created_at)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <aside className="space-y-4">
          <Panel title="Review">
            <SubmissionReviewActions
              submissionId={submission.id} status={submission.status}
              canReview={capabilities.review} canApprove={capabilities.approve}
            />
          </Panel>

          <Panel title="Performance">
            <div className="grid grid-cols-2 gap-3 text-[13px]">
              <Stat label="Views" value={formatNumber(submission.views)} />
              <Stat label="Engagement" value={formatPercent(submission.engagement_rate)} />
              <Stat label="Comments" value={formatNumber(submission.comments_count)} />
              <Stat label="Rights status" value={submission.rights_status} />
            </div>
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
      <p className="mt-0.5 text-[14px] font-semibold text-slate-900 capitalize">{value}</p>
    </div>
  )
}
