import { getReputationSession, requireReputationAccess } from '@/lib/reputation/server'
import { getReviews } from '@/lib/reputation/queries'
import { PERMISSIONS } from '@/lib/permissions'
import { ReputationSubNav } from '@/components/reputation/ReputationSubNav'
import { AccessGate } from '@/components/reputation/AccessGate'
import { KpiCard } from '@/components/reputation/primitives'
import { ReviewsList } from '@/components/reputation/ReviewsList'

export const dynamic = 'force-dynamic'

export default async function ReviewsPage() {
  const session = await getReputationSession()
  const access = requireReputationAccess(session, PERMISSIONS.REPUTATION_REVIEWS_VIEW)
  if (!access.allowed) return <div className="p-6"><AccessGate message={access.message ?? ''} /></div>

  const data = await getReviews(session)
  const canRespond = session.can(PERMISSIONS.REPUTATION_REVIEWS_RESPOND)
  const canEscalate = session.can(PERMISSIONS.REPUTATION_REVIEWS_ESCALATE)

  return (
    <div className="p-4 sm:p-6">
      <ReputationSubNav />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Reviews</h1>
          <p className="mt-0.5 text-sm text-slate-500">Customer reviews, sentiment, responses and escalations.</p>
        </div>
      </div>

      <section className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Total Reviews" value={String(data.total)} />
        <KpiCard label="Average Rating" value={data.total ? data.averageRating.toFixed(1) : '—'} />
        <KpiCard label="Response Rate" value={`${data.responseRate}%`} />
        <KpiCard label="Unresolved Reviews" value={String(data.unresolved)} />
        <KpiCard label="Positive Sentiment" value={`${data.positivePct}%`} />
        <KpiCard label="Escalations" value={String(data.escalations)} />
      </section>

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-900">Review Inbox</h2></div>
        <ReviewsList reviews={data.reviews as any} canRespond={canRespond} canEscalate={canEscalate} />
      </div>
    </div>
  )
}
