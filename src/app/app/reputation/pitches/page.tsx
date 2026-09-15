import { getReputationSession, requireReputationAccess } from '@/lib/reputation/server'
import { getPitches } from '@/lib/reputation/queries'
import { PERMISSIONS } from '@/lib/permissions'
import { ReputationSubNav } from '@/components/reputation/ReputationSubNav'
import { AccessGate } from '@/components/reputation/AccessGate'
import { KpiCard, StatusPill, timeAgo } from '@/components/reputation/primitives'
import { EmptyState } from '@/components/ui/EmptyState'
import { NewPitchButton } from '@/components/reputation/NewPitchButton'
import { PitchRowActions } from '@/components/reputation/PitchRowActions'

export const dynamic = 'force-dynamic'

export default async function PitchesPage() {
  const session = await getReputationSession()
  const access = requireReputationAccess(session, PERMISSIONS.REPUTATION_PITCHES_VIEW)
  if (!access.allowed) return <div className="p-6"><AccessGate message={access.message ?? ''} /></div>

  const [data, { data: lists }] = await Promise.all([
    getPitches(session),
    session.supabase.from('media_lists').select('id, name').eq('workspace_id', session.workspaceId).eq('status', 'active').order('name'),
  ])

  const canEdit = session.can(PERMISSIONS.REPUTATION_PITCHES_EDIT)
  const canApprove = session.can(PERMISSIONS.REPUTATION_PITCHES_APPROVE)
  const canSend = session.can(PERMISSIONS.REPUTATION_PITCHES_SEND)

  return (
    <div className="p-4 sm:p-6">
      <ReputationSubNav />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Pitches</h1>
          <p className="mt-0.5 text-sm text-slate-500">Draft, approve, send and track media pitches.</p>
        </div>
        {session.can(PERMISSIONS.REPUTATION_PITCHES_CREATE) && <NewPitchButton lists={lists ?? []} />}
      </div>

      <section className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Draft Pitches" value={String(data.drafts)} />
        <KpiCard label="Sent This Month" value={String(data.sentThisMonth)} />
        <KpiCard label="Approvals Pending" value={String(data.approvalsPending)} />
        <KpiCard label="Placements Won" value={String(data.placements)} />
        <KpiCard label="Total Pitches" value={String(data.pitches.length)} />
        <KpiCard label="Open Rate" value={data.pitches.length ? `${Math.round((data.pitches.reduce((s, p) => s + p.opened, 0) / Math.max(1, data.pitches.reduce((s, p) => s + p.sent, 0))) * 100)}%` : '—'} />
      </section>

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-900">All Pitches</h2></div>
        {data.pitches.length === 0 ? (
          <EmptyState compact title="No pitches yet" description="Create a pitch and target it against one of your media lists." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-2.5">Pitch</th>
                  <th className="px-5 py-2.5">Audience</th>
                  <th className="px-5 py-2.5">Sent</th>
                  <th className="px-5 py-2.5">Opens</th>
                  <th className="px-5 py-2.5">Replies</th>
                  <th className="px-5 py-2.5">Placements</th>
                  <th className="px-5 py-2.5">Status</th>
                  <th className="px-5 py-2.5">Updated</th>
                  <th className="px-5 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.pitches.map(p => (
                  <tr key={p.id}>
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-900">{p.name}</p>
                      <p className="text-xs text-slate-500">{p.subject}</p>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{p.listName ?? '—'}</td>
                    <td className="px-5 py-3 text-slate-600">{p.sent}</td>
                    <td className="px-5 py-3 text-slate-600">{p.opened}</td>
                    <td className="px-5 py-3 text-slate-600">{p.replied}</td>
                    <td className="px-5 py-3 text-slate-600">{p.placed}</td>
                    <td className="px-5 py-3"><StatusPill status={p.status} /></td>
                    <td className="px-5 py-3 text-slate-500">{timeAgo(p.updatedAt)}</td>
                    <td className="px-5 py-3"><PitchRowActions id={p.id} name={p.name} subject={p.subject} body={p.body} status={p.status} canEdit={canEdit} canApprove={canApprove} canSend={canSend} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
