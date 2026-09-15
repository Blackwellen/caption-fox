import { getReputationSession, requireReputationAccess } from '@/lib/reputation/server'
import { getPressRoom } from '@/lib/reputation/queries'
import { PERMISSIONS } from '@/lib/permissions'
import { ReputationSubNav } from '@/components/reputation/ReputationSubNav'
import { AccessGate } from '@/components/reputation/AccessGate'
import { KpiCard, StatusPill, timeAgo } from '@/components/reputation/primitives'
import { EmptyState } from '@/components/ui/EmptyState'
import { NewPressReleaseButton } from '@/components/reputation/NewPressReleaseButton'
import { PressReleaseRowActions } from '@/components/reputation/PressReleaseRowActions'

export const dynamic = 'force-dynamic'

export default async function PressRoomPage() {
  const session = await getReputationSession()
  const access = requireReputationAccess(session, PERMISSIONS.REPUTATION_PRESS_ROOM_VIEW)
  if (!access.allowed) return <div className="p-6"><AccessGate message={access.message ?? ''} /></div>

  const data = await getPressRoom(session)
  const canManage = session.can(PERMISSIONS.REPUTATION_PRESS_ROOM_MANAGE)
  const canPublish = session.can(PERMISSIONS.REPUTATION_PRESS_ROOM_PUBLISH)

  return (
    <div className="p-4 sm:p-6">
      <ReputationSubNav />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Press Room</h1>
          <p className="mt-0.5 text-sm text-slate-500">Public newsroom, press releases and media kit assets.</p>
        </div>
        {canManage && <NewPressReleaseButton />}
      </div>

      <section className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Press Releases Live" value={String(data.live)} />
        <KpiCard label="Assets Available" value={String(data.assets.length)} />
        <KpiCard label="Total Downloads" value={String(data.totalDownloads)} />
        <KpiCard label="Pending Approvals" value={String(data.pendingApprovals)} />
        <KpiCard label="Total Releases" value={String(data.releases.length)} />
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-900">Press Releases</h2></div>
          {data.releases.length === 0 ? (
            <EmptyState compact title="No press releases yet" description="Draft your first press release to populate the newsroom." />
          ) : (
            <div className="divide-y divide-slate-100">
              {data.releases.map(r => (
                <div key={r.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{r.title}</p>
                    <p className="text-xs text-slate-500">{r.category ?? 'Uncategorised'} · {r.publish_date ? new Date(r.publish_date).toLocaleDateString('en-GB') : 'Unscheduled'} · {r.downloads} downloads</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusPill status={r.status} />
                    {canManage && <PressReleaseRowActions id={r.id} title={r.title} subtitle={r.subtitle} body={r.body} category={r.category} status={r.status} canPublish={canPublish} />}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-900">Media Kit Assets</h2></div>
          {data.assets.length === 0 ? (
            <EmptyState compact title="No assets uploaded" description="Upload logos, headshots and product images for the media kit." />
          ) : (
            <div className="divide-y divide-slate-100">
              {data.assets.map((a: any) => (
                <div key={a.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{a.name}</p>
                    <p className="text-xs capitalize text-slate-500">{a.asset_type} · {a.downloads} downloads</p>
                  </div>
                  <span className="shrink-0 text-xs text-slate-400">{timeAgo(a.updated_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
