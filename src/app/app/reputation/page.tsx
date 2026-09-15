import Link from 'next/link'
import { AlertTriangle, ArrowRight } from 'lucide-react'
import { getReputationSession, requireReputationAccess } from '@/lib/reputation/server'
import { getOverview } from '@/lib/reputation/queries'
import { PERMISSIONS } from '@/lib/permissions'
import { ReputationSubNav } from '@/components/reputation/ReputationSubNav'
import { AccessGate } from '@/components/reputation/AccessGate'
import { KpiCard, SentimentBadge, formatNumber, timeAgo } from '@/components/reputation/primitives'
import { EmptyState } from '@/components/ui/EmptyState'

export const dynamic = 'force-dynamic'

export default async function ReputationOverviewPage() {
  const session = await getReputationSession()
  const access = requireReputationAccess(session, PERMISSIONS.REPUTATION_VIEW)
  if (!access.allowed) {
    return <div className="p-6"><AccessGate message={access.message ?? ''} /></div>
  }

  const data = await getOverview(session)
  const totalSentiment = Object.values(data.sentimentBreakdown).reduce((a, b) => a + b, 0)

  return (
    <div className="p-4 sm:p-6">
      <ReputationSubNav />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">PR & Reputation Overview</h1>
          <p className="mt-0.5 text-sm text-slate-500">Media relations, earned coverage and reputation health in one place.</p>
        </div>
        {session.can(PERMISSIONS.REPUTATION_PITCHES_CREATE) && (
          <Link href="/app/reputation/pitches?compose=1" className="rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm">
            New Pitch
          </Link>
        )}
      </div>

      <section className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Active Media Campaigns" value={String(data.activeMediaCampaigns)} />
        <KpiCard label="Media Contacts" value={String(data.mediaContacts)} />
        <KpiCard label="Pitches Sent" value={String(data.pitchesSent)} />
        <KpiCard label="Earned Coverage" value={String(data.earnedCoverage)} />
        <KpiCard label="Average Sentiment" value={data.averageSentiment === null ? '—' : data.averageSentiment > 0.15 ? 'Positive' : data.averageSentiment < -0.15 ? 'Negative' : 'Neutral'} />
        <KpiCard label="Open Reputation Risks" value={String(data.openReputationRisks)} />
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-5">
          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="font-semibold text-slate-900">Top Media Contacts</h2>
                <p className="text-xs text-slate-500">Ranked by influence and relationship strength</p>
              </div>
              <Link href="/app/reputation/media-lists" className="text-sm font-medium text-blue-600">View all</Link>
            </div>
            {data.topContacts.length === 0 ? (
              <EmptyState compact title="No media contacts yet" description="Add journalists and media contacts to start building relationships." />
            ) : (
              <div className="divide-y divide-slate-100">
                {data.topContacts.map(c => (
                  <div key={c.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{c.name}</p>
                      <p className="text-xs text-slate-500">{c.outlet ?? 'No outlet'}{c.beat ? ` · ${c.beat}` : ''}</p>
                    </div>
                    <span className="shrink-0 text-xs font-medium capitalize text-slate-500">{c.relationship_stage.replace(/_/g, ' ')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="font-semibold text-slate-900">Recent Earned Coverage</h2>
              <Link href="/app/reputation/coverage" className="text-sm font-medium text-blue-600">View all</Link>
            </div>
            {data.recentCoverage.length === 0 ? (
              <EmptyState compact title="No coverage tracked yet" description="Coverage you track will show up here with sentiment and reach." />
            ) : (
              <div className="divide-y divide-slate-100">
                {data.recentCoverage.map(c => (
                  <a key={c.id} href={c.url ?? '#'} target={c.url ? '_blank' : undefined} rel="noreferrer" className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{c.headline}</p>
                      <p className="text-xs text-slate-500">{c.publication} · {timeAgo(c.published_at)}</p>
                    </div>
                    <SentimentBadge sentiment={c.sentiment} />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-900">Sentiment Breakdown</h2></div>
            <div className="space-y-2 px-5 py-4">
              {(['positive', 'neutral', 'negative', 'mixed'] as const).map(key => {
                const value = data.sentimentBreakdown[key]
                const pct = totalSentiment > 0 ? Math.round((value / totalSentiment) * 100) : 0
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="capitalize text-slate-600">{key}</span>
                      <span className="font-medium text-slate-900">{value} ({pct}%)</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full rounded-full ${key === 'positive' ? 'bg-emerald-500' : key === 'negative' ? 'bg-red-500' : key === 'mixed' ? 'bg-amber-500' : 'bg-slate-400'}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
              {totalSentiment === 0 && <p className="text-xs text-slate-400">No coverage tracked yet.</p>}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-900">Next Actions</h2></div>
            <div className="divide-y divide-slate-100">
              {data.nextActions.length === 0 ? (
                <EmptyState compact title="Nothing to review" description="Approvals, escalations and incidents will show up here." />
              ) : (
                data.nextActions.map(action => (
                  <Link key={action.id} href={action.href} className="flex items-center justify-between gap-2 px-5 py-3 text-sm hover:bg-slate-50">
                    <span className="flex items-center gap-2 text-slate-700"><AlertTriangle size={14} className="text-amber-500" />{action.label}</span>
                    <ArrowRight size={14} className="text-slate-400" />
                  </Link>
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-500">
            {formatNumber(data.mediaContacts)} contacts tracked across your media lists.
          </div>
        </div>
      </section>
    </div>
  )
}
