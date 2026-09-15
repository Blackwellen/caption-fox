import { getReputationSession, requireReputationAccess } from '@/lib/reputation/server'
import { getCoverage } from '@/lib/reputation/queries'
import { PERMISSIONS } from '@/lib/permissions'
import { ReputationSubNav } from '@/components/reputation/ReputationSubNav'
import { AccessGate } from '@/components/reputation/AccessGate'
import { KpiCard, formatNumber } from '@/components/reputation/primitives'
import { EmptyState } from '@/components/ui/EmptyState'
import { NewCoverageButton } from '@/components/reputation/NewCoverageButton'
import { CoverageTable } from '@/components/reputation/CoverageTable'
import { ImportCoverageButton } from '@/components/reputation/ImportCoverageButton'
import { AiCoverageSummary } from '@/components/reputation/AiCoverageSummary'

export const dynamic = 'force-dynamic'

export default async function CoveragePage() {
  const session = await getReputationSession()
  const access = requireReputationAccess(session, PERMISSIONS.REPUTATION_COVERAGE_VIEW)
  if (!access.allowed) return <div className="p-6"><AccessGate message={access.message ?? ''} /></div>

  const data = await getCoverage(session)

  return (
    <div className="p-4 sm:p-6">
      <ReputationSubNav />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Coverage</h1>
          <p className="mt-0.5 text-sm text-slate-500">Earned media, mentions, sentiment and reach.</p>
        </div>
        {session.can(PERMISSIONS.REPUTATION_COVERAGE_MANAGE) && (
          <div className="flex gap-2">
            {session.can(PERMISSIONS.REPUTATION_COVERAGE_IMPORT) && <ImportCoverageButton />}
            <NewCoverageButton />
          </div>
        )}
      </div>

      <section className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Total Mentions" value={String(data.totalMentions)} />
        <KpiCard label="Estimated Reach" value={formatNumber(data.estimatedReach)} />
        <KpiCard label="Positive Sentiment" value={`${data.positivePct}%`} />
        <KpiCard label="Backlinks Earned" value={String(data.backlinks)} />
      </section>

      <div className="mb-5"><AiCoverageSummary /></div>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.5fr_1fr] mb-5">
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-900">Coverage</h2></div>
          <CoverageTable mentions={data.mentions as any} />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-900">Top Publications</h2></div>
          {data.topPublications.length === 0 ? (
            <EmptyState compact title="No publications yet" description="Publications will rank here as coverage comes in." />
          ) : (
            <div className="divide-y divide-slate-100">
              {data.topPublications.map(p => (
                <div key={p.publication} className="flex items-center justify-between px-5 py-3 text-sm">
                  <span className="text-slate-800">{p.publication}</span>
                  <span className="font-medium text-slate-500">{p.count} mention{p.count === 1 ? '' : 's'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
