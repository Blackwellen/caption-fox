import { getReputationSession, requireReputationAccess } from '@/lib/reputation/server'
import { getCrisis } from '@/lib/reputation/queries'
import { PERMISSIONS } from '@/lib/permissions'
import { ReputationSubNav } from '@/components/reputation/ReputationSubNav'
import { AccessGate } from '@/components/reputation/AccessGate'
import { KpiCard, SeverityBadge, StatusPill, timeAgo } from '@/components/reputation/primitives'
import { EmptyState } from '@/components/ui/EmptyState'
import { NewCrisisIncidentButton } from '@/components/reputation/NewCrisisIncidentButton'
import { CrisisIncidentActions } from '@/components/reputation/CrisisIncidentActions'

export const dynamic = 'force-dynamic'

export default async function CrisisPage() {
  const session = await getReputationSession()
  const access = requireReputationAccess(session, PERMISSIONS.REPUTATION_CRISIS_VIEW)
  if (!access.allowed) return <div className="p-6"><AccessGate message={access.message ?? ''} /></div>

  const data = await getCrisis(session)
  const canManage = session.can(PERMISSIONS.REPUTATION_CRISIS_MANAGE)
  const canEditStatement = session.can(PERMISSIONS.REPUTATION_CRISIS_STATEMENTS_EDIT)
  const canApproveStatement = session.can(PERMISSIONS.REPUTATION_CRISIS_STATEMENTS_APPROVE)

  return (
    <div className="p-4 sm:p-6">
      <ReputationSubNav />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Crisis</h1>
          <p className="mt-0.5 text-sm text-slate-500">Incident response, statements and reputation recovery.</p>
        </div>
        {session.can(PERMISSIONS.REPUTATION_CRISIS_CREATE) && <NewCrisisIncidentButton />}
      </div>

      <section className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Active Incidents" value={String(data.activeIncidents)} />
        <KpiCard label="High Severity" value={String(data.highSeverity)} />
        <KpiCard label="Open Actions" value={String(data.openActions)} />
        <KpiCard label="Statements Pending" value={String(data.pendingStatements)} />
        <KpiCard label="Resolved This Month" value={String(data.resolvedThisMonth)} />
      </section>

      <div className="space-y-4">
        {data.incidents.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6">
            <EmptyState title="No incidents recorded" description="Reputation incidents will appear here as they're detected or logged." />
          </div>
        ) : data.incidents.map((incident: any) => (
          <div key={incident.id} className="rounded-xl border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-slate-900">{incident.title}</p>
                  <SeverityBadge severity={incident.severity} />
                  <StatusPill status={incident.status} />
                </div>
                <p className="mt-0.5 text-xs text-slate-500">{incident.description}</p>
              </div>
              <span className="text-xs text-slate-400">Detected {timeAgo(incident.detected_at)}</span>
            </div>
            <div className="grid grid-cols-1 gap-0 sm:grid-cols-2">
              <div className="border-b border-slate-100 px-5 py-4 sm:border-b-0 sm:border-r">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Timeline</p>
                {(incident.crisis_timeline_events ?? []).length === 0 ? (
                  <p className="text-xs text-slate-400">No timeline events yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {incident.crisis_timeline_events
                      .slice()
                      .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                      .map((e: any) => (
                        <li key={e.id} className="text-xs text-slate-600">
                          <span className="font-medium text-slate-800 capitalize">{e.event_type.replace(/_/g, ' ')}</span> — {e.summary}
                          <span className="ml-1 text-slate-400">({timeAgo(e.created_at)})</span>
                        </li>
                      ))}
                  </ul>
                )}
              </div>
              <div className="px-5 py-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Statement</p>
                {(incident.crisis_statements ?? []).length === 0 ? (
                  <p className="text-xs text-slate-400">No statement drafted yet.</p>
                ) : (
                  incident.crisis_statements
                    .slice()
                    .sort((a: any, b: any) => b.version - a.version)
                    .slice(0, 1)
                    .map((s: any) => (
                      <div key={s.id}>
                        <StatusPill status={s.status} />
                        <p className="mt-2 text-xs text-slate-600">{s.body}</p>
                      </div>
                    ))
                )}
              </div>
            </div>
            <div className="border-t border-slate-100 px-5 py-3">
              <CrisisIncidentActions
                incidentId={incident.id}
                incidentStatus={incident.status}
                latestStatement={(() => {
                  const statements = (incident.crisis_statements ?? []).slice().sort((a: any, b: any) => b.version - a.version)
                  return statements[0] ? { id: statements[0].id, status: statements[0].status } : null
                })()}
                canManage={canManage}
                canEditStatement={canEditStatement}
                canApproveStatement={canApproveStatement}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
