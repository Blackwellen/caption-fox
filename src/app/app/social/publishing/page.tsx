import Link from 'next/link'
import { requireSocialSurface } from '@/lib/social/server'
import {
  getApprovalQueue, getChannelPublishingSummary, getChannels, getPostsInRange,
  getPublishingAlerts, getPublishingQueue, getSocialActivity,
} from '@/lib/social/queries'
import { rangeFromDays } from '@/lib/social/metrics'
import { AccessGate } from '@/components/social/AccessGate'
import { SocialSubNav } from '@/components/social/SocialSubNav'
import { ComposerLauncher } from '@/components/social/ComposerLauncher'
import { ApprovalActions, PostRowMenu } from '@/components/social/PublishingActions'
import {
  ExportButton, HealthBadge, ProviderBadge, ProviderLabel, RangePicker,
  StatusPill, TimeAgo, ViewSwitcher,
} from '@/components/social/primitives'
import { EmptyState } from '@/components/ui/EmptyState'
import { PROVIDER_LABELS } from '@/types/social'

export const dynamic = 'force-dynamic'

const VIEWS = [
  { id: 'calendar', label: 'Calendar' },
  { id: 'queue', label: 'Queue' },
  { id: 'list', label: 'List' },
  { id: 'board', label: 'Board' },
]

const BOARD_COLUMNS = ['draft', 'pending_approval', 'approved', 'scheduled', 'publishing', 'published', 'failed'] as const

export default async function SocialPublishingPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams
  const session = await requireSocialSurface('publishing')
  if (!session.access.allowed) {
    return <div className="p-6"><AccessGate access={session.access} /></div>
  }

  const days = Math.min(90, Math.max(7, Number(params.days ?? 7)))
  const range = rangeFromDays(days)
  const view = (['calendar', 'queue', 'list', 'board'].includes(params.view) ? params.view : 'calendar') as 'calendar' | 'queue' | 'list' | 'board'

  const channels = await getChannels(session)
  const [summary, posts, queue, approvals, activity, alerts] = await Promise.all([
    getChannelPublishingSummary(session, range, channels),
    getPostsInRange(session, rangeFromDays(90), { limit: 300 }),
    getPublishingQueue(session),
    session.can('social.publishing.approve') ? getApprovalQueue(session) : Promise.resolve([]),
    getSocialActivity(session, { limit: 6, entityTypes: ['content_post'] }),
    getPublishingAlerts(session),
  ])

  const byChannel = new Map(channels.map(channel => [channel.id, channel]))
  const upcomingByDay = new Map<string, typeof posts>()
  for (const post of posts) {
    if (!post.scheduled_at) continue
    const day = post.scheduled_at.slice(0, 10)
    upcomingByDay.set(day, [...(upcomingByDay.get(day) ?? []), post])
  }
  const upcomingDays = [...upcomingByDay.keys()].sort().slice(0, 10)

  return (
    <div className="p-4 sm:p-6">
      <SocialSubNav visible={session.surfaces} />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Social Publishing</h1>
          <p className="mt-0.5 text-sm text-slate-500">Schedule, approve, and publish content across all channels.</p>
        </div>
        <div className="flex items-center gap-2">
          <RangePicker days={days} />
          <ExportButton dataset="posts" days={days} />
          {session.can('social.publishing.create') && <ComposerLauncher channels={channels} />}
        </div>
      </div>

      <div className="mb-5"><ViewSwitcher views={VIEWS} active={view} /></div>

      {channels.length > 0 && (
        <section className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {summary.map(row => (
            <div key={row.channel.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <ProviderLabel provider={row.channel.platform} />
                <HealthBadge health={row.channel.health} />
              </div>
              <div className="mt-3 flex items-center gap-4 text-sm">
                <div><p className="text-lg font-bold text-slate-900">{row.scheduled}</p><p className="text-xs text-slate-500">Scheduled</p></div>
                <div><p className="text-lg font-bold text-slate-900">{row.drafts}</p><p className="text-xs text-slate-500">Drafts</p></div>
                <div><p className="text-lg font-bold text-slate-900">{row.needsApproval}</p><p className="text-xs text-slate-500">Needs Approval</p></div>
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-5">
          {view === 'calendar' && (
            <div className="rounded-xl border border-slate-200 bg-white">
              <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-900">Upcoming Schedule</h2></div>
              {upcomingDays.length === 0 ? (
                <EmptyState compact title="Nothing scheduled" description="Posts you schedule will appear grouped by day." />
              ) : (
                <div className="divide-y divide-slate-100">
                  {upcomingDays.map(day => (
                    <div key={day} className="px-5 py-4">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {new Date(`${day}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                      </p>
                      <div className="space-y-2">
                        {(upcomingByDay.get(day) ?? []).map(post => (
                          <div key={post.id} className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2">
                            <span className="w-14 shrink-0 text-xs text-slate-500">{new Date(post.scheduled_at!).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                            <div className="flex shrink-0 -space-x-1">
                              {(post.platforms ?? []).slice(0, 3).map(platform => <ProviderBadge key={platform} provider={platform as never} size={20} />)}
                            </div>
                            <p className="min-w-0 flex-1 truncate text-sm text-slate-800">{post.title ?? post.caption?.slice(0, 60) ?? 'Untitled post'}</p>
                            <StatusPill status={post.status} />
                            <PostRowMenu postId={post.id} status={post.status} />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {view === 'queue' && (
            <div className="rounded-xl border border-slate-200 bg-white">
              <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-900">Publishing Queue</h2><p className="text-xs text-slate-500">{queue.length} deliveries</p></div>
              {queue.length === 0 ? (
                <EmptyState compact title="Queue is empty" description="Scheduled deliveries per channel will appear here." />
              ) : (
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                    <th className="px-5 py-2 font-medium">Channel</th>
                    <th className="px-3 py-2 font-medium">Scheduled</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Attempts</th>
                    <th className="px-5 py-2 font-medium">Error</th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {queue.slice(0, 50).map(row => {
                      const channel = byChannel.get(row.channel_id)
                      return (
                        <tr key={row.id}>
                          <td className="px-5 py-2.5">{channel ? <ProviderLabel provider={channel.platform} /> : row.channel_id}</td>
                          <td className="px-3 py-2.5 text-slate-600">{new Date(row.scheduled_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                          <td className="px-3 py-2.5"><StatusPill status={row.status} /></td>
                          <td className="px-3 py-2.5 text-slate-600">{row.attempt_count}/{row.max_attempts}</td>
                          <td className="px-5 py-2.5 max-w-xs truncate text-xs text-red-600">{row.error_message ?? ''}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {view === 'list' && (
            <div className="rounded-xl border border-slate-200 bg-white">
              <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-900">All Posts</h2></div>
              {posts.length === 0 ? (
                <EmptyState compact title="No posts yet" description="Create your first post to see it here." />
              ) : (
                <div className="divide-y divide-slate-100">
                  {posts.map(post => (
                    <div key={post.id} className="flex items-center gap-3 px-5 py-3">
                      <div className="flex shrink-0 -space-x-1">
                        {(post.platforms ?? []).slice(0, 3).map(platform => <ProviderBadge key={platform} provider={platform as never} size={22} />)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900">{post.title ?? post.caption?.slice(0, 60) ?? 'Untitled post'}</p>
                        <p className="text-xs text-slate-500">{post.scheduled_at ? new Date(post.scheduled_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'No time set'}</p>
                      </div>
                      <StatusPill status={post.status} />
                      <PostRowMenu postId={post.id} status={post.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {view === 'board' && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {BOARD_COLUMNS.map(column => {
                const items = posts.filter(post => post.status === column)
                return (
                  <div key={column} className="rounded-xl border border-slate-200 bg-slate-50">
                    <div className="border-b border-slate-200 px-3 py-2.5"><StatusPill status={column} /> <span className="ml-1 text-xs text-slate-400">{items.length}</span></div>
                    <div className="max-h-96 space-y-2 overflow-y-auto p-2.5">
                      {items.slice(0, 20).map(post => (
                        <div key={post.id} className="rounded-lg border border-slate-200 bg-white p-2.5 text-xs">
                          <p className="truncate font-medium text-slate-800">{post.title ?? post.caption?.slice(0, 40) ?? 'Untitled'}</p>
                          <div className="mt-1 flex -space-x-1">
                            {(post.platforms ?? []).slice(0, 3).map(platform => <ProviderBadge key={platform} provider={platform as never} size={16} />)}
                          </div>
                        </div>
                      ))}
                      {items.length === 0 && <p className="px-1 py-3 text-center text-xs text-slate-400">Empty</p>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="space-y-5">
          {session.can('social.publishing.approve') && (
            <div className="rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <h2 className="font-semibold text-slate-900">Approval Queue</h2>
                <span className="text-xs text-slate-500">{approvals.length}</span>
              </div>
              {approvals.length === 0 ? (
                <EmptyState compact title="Nothing pending" description="Posts submitted for review will appear here." />
              ) : (
                <div className="divide-y divide-slate-100">
                  {approvals.map(post => (
                    <div key={post.id} className="px-5 py-3">
                      <p className="truncate text-sm font-medium text-slate-900">{post.title ?? post.caption?.slice(0, 50) ?? 'Untitled post'}</p>
                      <p className="mt-0.5 text-xs text-slate-500">Requested by {post.requester?.full_name ?? 'a teammate'}</p>
                      <div className="mt-2"><ApprovalActions postId={post.id} /></div>
                    </div>
                  ))}
                </div>
              )}
              {approvals.length > 0 && <div className="border-t border-slate-100 px-5 py-3"><Link href="/app/social/publishing?view=list" className="text-sm font-medium text-blue-600">Go to Approvals</Link></div>}
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-900">Publishing Alerts</h2></div>
            {alerts.length === 0 ? (
              <EmptyState compact title="No alerts" description="Failures, rate limits and token issues appear here." />
            ) : (
              <div className="divide-y divide-slate-100">
                {alerts.map(alert => (
                  <div key={alert.id} className="px-5 py-3">
                    <p className="text-sm font-medium text-slate-900">{alert.title}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{alert.detail}</p>
                    {alert.href && <Link href={alert.href} className="mt-1 inline-block text-xs font-medium text-blue-600">{alert.actionLabel ?? 'View'}</Link>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-900">Workflow Activity</h2></div>
            {activity.length === 0 ? (
              <EmptyState compact title="No recent activity" description="Publishing events will show here." />
            ) : (
              <div className="divide-y divide-slate-100">
                {activity.map(entry => (
                  <div key={entry.id} className="px-5 py-3">
                    <p className="text-sm text-slate-700">{entry.summary}</p>
                    <p className="mt-0.5 text-xs text-slate-400"><TimeAgo iso={entry.created_at} /></p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
