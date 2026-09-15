import Link from 'next/link'
import { AlertTriangle, Calendar as CalendarIcon, CheckCircle2, MessageSquare, TrendingDown, TrendingUp } from 'lucide-react'
import { requireSocialSurface } from '@/lib/social/server'
import {
  getChannelBreakdown, getChannels, getEngagementFeed, getPeriodTotals,
  getPublishingAlerts, getRecentPublishedPosts, getSocialActivity, getUpcomingPosts,
} from '@/lib/social/queries'
import { rangeFromDays } from '@/lib/social/metrics'
import { AccessGate } from '@/components/social/AccessGate'
import { SocialSubNav } from '@/components/social/SocialSubNav'
import {
  ExportButton, HealthBadge, KpiCard, ProviderBadge, RangePicker, StatusPill, TimeAgo, metricKpi, rateKpi,
} from '@/components/social/primitives'
import { EmptyState } from '@/components/ui/EmptyState'
import { PROVIDER_LABELS } from '@/types/social'

export const dynamic = 'force-dynamic'

export default async function SocialOverviewPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams
  const session = await requireSocialSurface('overview')
  if (!session.access.allowed) {
    return (
      <div className="p-6">
        <AccessGate access={session.access} />
      </div>
    )
  }

  const days = Math.min(90, Math.max(7, Number(params.days ?? 7)))
  const range = rangeFromDays(days)

  const channels = await getChannels(session)
  const [
    totals, breakdown, recentPosts, upcomingPosts, feed, activity, alerts,
  ] = await Promise.all([
    getPeriodTotals(session, range),
    getChannelBreakdown(session, range, channels),
    getRecentPublishedPosts(session, 5),
    getUpcomingPosts(session, 5),
    getEngagementFeed(session, 'all', undefined, 6),
    getSocialActivity(session, { limit: 5 }),
    getPublishingAlerts(session),
  ])

  const kpis = [
    metricKpi({ key: 'reach', label: 'Total Reach', value: totals.current.reach, previous: totals.previous.reach || null, changePct: totals.previous.reach ? ((totals.current.reach - totals.previous.reach) / totals.previous.reach) * 100 : null, series: totals.series.map(p => p.reach) }),
    metricKpi({ key: 'engagements', label: 'Engagements', value: totals.current.engagements, previous: totals.previous.engagements || null, changePct: totals.previous.engagements ? ((totals.current.engagements - totals.previous.engagements) / totals.previous.engagements) * 100 : null, series: totals.series.map(p => p.engagements) }),
    rateKpi({ key: 'rate', label: 'Engagement Rate', value: totals.current.engagementRate, changePp: totals.current.engagementRate !== null && totals.previous.engagementRate !== null ? (totals.current.engagementRate - totals.previous.engagementRate) * 100 : null }),
    metricKpi({ key: 'impressions', label: 'Impressions', value: totals.current.impressions, previous: totals.previous.impressions || null, changePct: totals.previous.impressions ? ((totals.current.impressions - totals.previous.impressions) / totals.previous.impressions) * 100 : null }),
    metricKpi({ key: 'clicks', label: 'Profile Clicks', value: totals.current.profileClicks, previous: totals.previous.profileClicks || null, changePct: totals.previous.profileClicks ? ((totals.current.profileClicks - totals.previous.profileClicks) / totals.previous.profileClicks) * 100 : null }),
    metricKpi({ key: 'followers', label: 'New Followers', value: totals.current.followerChange, previous: totals.previous.followerChange || null, changePct: totals.previous.followerChange ? ((totals.current.followerChange - totals.previous.followerChange) / totals.previous.followerChange) * 100 : null }),
  ]

  return (
    <div className="p-4 sm:p-6">
      <SocialSubNav visible={session.surfaces} />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Social Overview</h1>
          <p className="mt-0.5 text-sm text-slate-500">Monitor organic performance across channels, engage with your audience, and take action.</p>
        </div>
        <div className="flex items-center gap-2">
          <RangePicker days={days} />
          <ExportButton dataset="analytics" days={days} />
          {session.can('social.publishing.create') && (
            <Link href="/app/social/publishing?compose=1" className="rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm">
              Create Post
            </Link>
          )}
        </div>
      </div>

      {totals.current.empty && channels.length === 0 && (
        <div className="mb-5 rounded-xl border border-dashed border-slate-300 bg-white p-6">
          <EmptyState
            title="Connect a channel to see real performance"
            description="Overview populates from your connected social channels — reach, engagements and content performance all come from synced data."
            action={{ label: 'Connect a channel', onClick: () => {} }}
          />
          <div className="mt-2 text-center">
            <Link href="/app/social/connections" className="text-sm font-medium text-blue-600">Go to Connections →</Link>
          </div>
        </div>
      )}

      <section className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {kpis.map(kpi => <KpiCard key={kpi.key} data={kpi} />)}
      </section>

      {channels.length > 0 && (
        <section className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {breakdown.map(row => (
            <div key={row.channel.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ProviderBadge provider={row.channel.platform} />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{PROVIDER_LABELS[row.channel.platform]}</p>
                    <p className="text-xs text-slate-400">@{row.channel.handle ?? row.channel.account_name}</p>
                  </div>
                </div>
                <HealthBadge health={row.channel.health} />
              </div>
              {row.noData ? (
                <p className="mt-3 text-xs text-slate-400">No synced data in this range yet.</p>
              ) : (
                <div className="mt-3 flex items-center justify-between text-sm">
                  <div>
                    <p className="text-xs text-slate-500">Reach</p>
                    <p className="font-semibold text-slate-900">{row.reach.toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Eng. Rate</p>
                    <p className="font-semibold text-slate-900">{row.engagementRate === null ? '—' : `${(row.engagementRate * 100).toFixed(2)}%`}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-5">
          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="font-semibold text-slate-900">Recent Posts</h2>
                <p className="text-xs text-slate-500">Latest published content across every channel</p>
              </div>
              <Link href="/app/social/publishing?view=list" className="text-sm font-medium text-blue-600">View all posts</Link>
            </div>
            {recentPosts.length === 0 ? (
              <EmptyState compact title="No published posts yet" description="Posts you publish will show real reach and engagement here." />
            ) : (
              <div className="divide-y divide-slate-100">
                {recentPosts.map(({ post, reach, engagementRate }) => (
                  <div key={post.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">{post.title ?? post.caption?.slice(0, 60) ?? 'Untitled post'}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {(post.platforms ?? []).join(', ')} · {post.published_at ? new Date(post.published_at).toLocaleDateString('en-GB') : '—'}
                      </p>
                    </div>
                    <div className="shrink-0 text-right text-xs">
                      <p className="font-semibold text-slate-900">{reach.toLocaleString()} reach</p>
                      <p className="text-slate-500">{engagementRate === null ? 'No metrics yet' : `${(engagementRate * 100).toFixed(2)}% eng.`}</p>
                    </div>
                    <StatusPill status={post.status} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <CalendarIcon size={16} className="text-slate-400" />
                <h2 className="font-semibold text-slate-900">Upcoming Posts</h2>
              </div>
              <Link href="/app/social/publishing?view=calendar" className="text-sm font-medium text-blue-600">View calendar</Link>
            </div>
            {upcomingPosts.length === 0 ? (
              <EmptyState compact title="Nothing scheduled" description="Scheduled and approved posts will appear here." />
            ) : (
              <div className="divide-y divide-slate-100">
                {upcomingPosts.map(post => (
                  <div key={post.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">{post.title ?? post.caption?.slice(0, 50) ?? 'Untitled post'}</p>
                      <p className="text-xs text-slate-500">{post.scheduled_at ? new Date(post.scheduled_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'No time set'}</p>
                    </div>
                    <StatusPill status={post.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <MessageSquare size={16} className="text-slate-400" />
                <h2 className="font-semibold text-slate-900">Engagement Feed</h2>
              </div>
              <Link href="/app/social/engagement" className="text-sm font-medium text-blue-600">Open</Link>
            </div>
            {feed.length === 0 ? (
              <EmptyState compact title="No recent activity" description="Comments, DMs and mentions will show up here as they arrive." />
            ) : (
              <div className="divide-y divide-slate-100">
                {feed.map(item => (
                  <div key={item.id} className="flex items-start gap-2.5 px-5 py-3">
                    {item.platform && <ProviderBadge provider={item.platform as never} size={22} />}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900">{item.sender_name ?? item.sender_handle ?? 'Someone'}</p>
                      <p className="truncate text-xs text-slate-500">{item.content ?? item.type}</p>
                    </div>
                    <TimeAgo iso={item.created_at} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="font-semibold text-slate-900">Activity & Alerts</h2>
            </div>
            <div className="divide-y divide-slate-100">
              {alerts.map(alert => (
                <div key={alert.id} className="flex items-start gap-2.5 px-5 py-3">
                  <AlertTriangle size={14} className={alert.severity === 'error' ? 'mt-0.5 text-red-500' : alert.severity === 'warning' ? 'mt-0.5 text-amber-500' : 'mt-0.5 text-blue-500'} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900">{alert.title}</p>
                    <p className="text-xs text-slate-500">{alert.detail}</p>
                  </div>
                  {alert.href && <Link href={alert.href} className="shrink-0 text-xs font-medium text-blue-600">View</Link>}
                </div>
              ))}
              {activity.map(entry => (
                <div key={entry.id} className="flex items-start gap-2.5 px-5 py-3">
                  <CheckCircle2 size={14} className="mt-0.5 text-emerald-500" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-700">{entry.summary}</p>
                    <p className="text-xs text-slate-400"><TimeAgo iso={entry.created_at} /></p>
                  </div>
                </div>
              ))}
              {alerts.length === 0 && activity.length === 0 && (
                <EmptyState compact title="Nothing to review" description="Approvals, spikes and reminders will show up here." />
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
