import { getReputationSession, requireReputationAccess } from '@/lib/reputation/server'
import { getMediaLists } from '@/lib/reputation/queries'
import { PERMISSIONS } from '@/lib/permissions'
import { ReputationSubNav } from '@/components/reputation/ReputationSubNav'
import { AccessGate } from '@/components/reputation/AccessGate'
import { KpiCard, timeAgo } from '@/components/reputation/primitives'
import { EmptyState } from '@/components/ui/EmptyState'
import { NewMediaContactButton } from '@/components/reputation/NewMediaContactButton'
import { NewMediaListButton } from '@/components/reputation/NewMediaListButton'
import { MediaContactsTable } from '@/components/reputation/MediaContactsTable'

export const dynamic = 'force-dynamic'

export default async function MediaListsPage() {
  const session = await getReputationSession()
  const access = requireReputationAccess(session, PERMISSIONS.REPUTATION_MEDIA_LISTS_VIEW)
  if (!access.allowed) return <div className="p-6"><AccessGate message={access.message ?? ''} /></div>

  const { lists, contacts } = await getMediaLists(session)
  const verified = contacts.filter(c => c.verified).length
  const avgInfluence = contacts.length > 0 ? Math.round(contacts.reduce((sum, c) => sum + Number(c.influence_score ?? 0), 0) / contacts.length) : 0

  return (
    <div className="p-4 sm:p-6">
      <ReputationSubNav />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Media Lists</h1>
          <p className="mt-0.5 text-sm text-slate-500">Journalist lists, contacts, outlets and relationship status.</p>
        </div>
        {session.can(PERMISSIONS.REPUTATION_MEDIA_LISTS_MANAGE) && (
          <div className="flex gap-2">
            <NewMediaListButton />
            <NewMediaContactButton />
          </div>
        )}
      </div>

      <section className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Total Lists" value={String(lists.length)} />
        <KpiCard label="Active Contacts" value={String(contacts.length)} />
        <KpiCard label="Verified Journalists" value={String(verified)} />
        <KpiCard label="Avg. Influence Score" value={String(avgInfluence)} />
        <KpiCard label="Lists Active" value={String(lists.filter(l => l.status === 'active').length)} />
        <KpiCard label="Beats Covered" value={String(new Set(contacts.map(c => c.beat).filter(Boolean)).size)} />
      </section>

      <section className="grid grid-cols-1 gap-5 lg:grid-cols-2 mb-5">
        {lists.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 lg:col-span-2">
            <EmptyState title="No media lists yet" description="Create a media list to group journalists by beat, region or campaign." />
          </div>
        ) : lists.map((list: any) => (
          <div key={list.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-slate-900">{list.name}</p>
                <p className="mt-0.5 text-xs text-slate-500">{list.description}</p>
              </div>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize text-slate-600">{list.status}</span>
            </div>
            <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
              <span>{list.media_list_members?.[0]?.count ?? 0} contacts</span>
              {list.beat && <span>{list.beat}</span>}
              {list.region && <span>{list.region}</span>}
              <span className="ml-auto">Updated {timeAgo(list.updated_at)}</span>
            </div>
          </div>
        ))}
      </section>

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-900">Media CRM</h2></div>
        <MediaContactsTable contacts={contacts as any} canManage={session.can(PERMISSIONS.REPUTATION_MEDIA_CONTACTS_MANAGE)} />
      </div>
    </div>
  )
}
