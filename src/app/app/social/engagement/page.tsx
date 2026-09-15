import Link from 'next/link'
import { requireSocialSurface } from '@/lib/social/server'
import {
  getConversation, getConversations, getEngagementTotals, getFlaggedConversations,
  getResponseAnalytics, getTeamWorkload, getWorkspaceMembers,
} from '@/lib/social/queries'
import { formatDuration, percent, rangeFromDays, signedPct } from '@/lib/social/metrics'
import { AccessGate } from '@/components/social/AccessGate'
import { SocialSubNav } from '@/components/social/SocialSubNav'
import { ConversationPanel } from '@/components/social/ConversationPanel'
import { KpiCard, ProviderBadge, RangePicker, SentimentPill, TimeAgo, ViewSwitcher } from '@/components/social/primitives'
import { EmptyState } from '@/components/ui/EmptyState'

export const dynamic = 'force-dynamic'

const VIEWS = [
  { id: 'feed', label: 'Feed' },
  { id: 'inbox', label: 'Inbox' },
  { id: 'threads', label: 'Threads' },
  { id: 'assigned', label: 'Assigned' },
  { id: 'all', label: 'All' },
  { id: 'flagged', label: 'Flagged' },
]

export default async function SocialEngagementPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams
  const session = await requireSocialSurface('engagement')
  if (!session.access.allowed) return <div className="p-6"><AccessGate access={session.access} /></div>

  const days = Math.min(90, Math.max(7, Number(params.days ?? 7)))
  const range = rangeFromDays(days)
  const view = (VIEWS.some(item => item.id === params.view) ? params.view : 'feed') as 'feed' | 'inbox' | 'threads' | 'assigned' | 'all' | 'flagged'

  const [totals, { rows: conversations, total }, analytics, workload, flagged, members] = await Promise.all([
    getEngagementTotals(session, range),
    getConversations(session, range, { view, channelId: params.channel, sentiment: params.sentiment, search: params.q, pageSize: 20 }),
    getResponseAnalytics(session, range),
    getTeamWorkload(session),
    getFlaggedConversations(session, 5),
    getWorkspaceMembers(session),
  ])

  const selectedId = params.conversation
  const detail = selectedId ? await getConversation(session, selectedId) : null

  const kpis = [
    { key: 'unread', label: 'Unread Messages', value: totals.unread.toString(), change: totals.previous.unread ? signedPct(((totals.unread - totals.previous.unread) / totals.previous.unread) * 100) : null },
    { key: 'mentions', label: 'Mentions', value: totals.mentions.toString(), change: totals.previous.mentions ? signedPct(((totals.mentions - totals.previous.mentions) / totals.previous.mentions) * 100) : null },
    { key: 'response', label: 'Avg. Response Time', value: formatDuration(totals.averageResponseMinutes), change: null },
    { key: 'resolved', label: 'Resolved Conversations', value: totals.resolved.toString(), change: totals.previous.resolved ? signedPct(((totals.resolved - totals.previous.resolved) / totals.previous.resolved) * 100) : null },
    { key: 'sentiment', label: 'Overall Sentiment', value: totals.sentimentLabel, change: null },
    { key: 'sla', label: 'Engagement SLA', value: percent(totals.slaMetPct, 0), change: null },
  ]

  return (
    <div className="p-4 sm:p-6">
      <SocialSubNav visible={session.surfaces} />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Social Engagement</h1>
          <p className="mt-0.5 text-sm text-slate-500">Manage comments, DMs, mentions, and audience responses in one place.</p>
        </div>
        <RangePicker days={days} />
      </div>

      <div className="mb-5"><ViewSwitcher views={VIEWS} active={view} /></div>

      <section className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {kpis.map(kpi => (
          <div key={kpi.key} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium text-slate-500">{kpi.label}</p>
            <p className="mt-1.5 text-xl font-bold text-slate-900">{kpi.value}</p>
            {kpi.change && <p className="mt-0.5 text-xs text-slate-500">{kpi.change}</p>}
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_1.3fr_1fr]">
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900">Conversations</h2>
            <span className="text-xs text-slate-500">{total}</span>
          </div>
          {conversations.length === 0 ? (
            <EmptyState compact title="No conversations" description="Comments, DMs and mentions will appear here." />
          ) : (
            <div className="max-h-[70vh] divide-y divide-slate-100 overflow-y-auto">
              {conversations.map(row => (
                <Link
                  key={row.id}
                  href={`/app/social/engagement?${new URLSearchParams({ ...params, conversation: row.id }).toString()}`}
                  className={`block px-4 py-3 hover:bg-slate-50 ${selectedId === row.id ? 'bg-blue-50' : ''}`}
                >
                  <div className="flex items-start gap-2.5">
                    {row.platform && <ProviderBadge provider={row.platform as never} size={24} />}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium text-slate-900">{row.sender_name ?? row.sender_handle ?? 'Unknown'}</p>
                        <TimeAgo iso={row.created_at} />
                      </div>
                      <p className="mt-0.5 truncate text-xs text-slate-500">{row.content}</p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <SentimentPill sentiment={row.sentiment} />
                        {!row.is_read && <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white">
          {detail ? (
            <ConversationPanel conversation={detail.conversation} messages={detail.messages} members={members} />
          ) : (
            <EmptyState title="Select a conversation" description="Choose a conversation from the list to view and reply." />
          )}
        </div>

        <div className="space-y-5">
          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-4 py-3"><h2 className="text-sm font-semibold text-slate-900">Response Analytics</h2></div>
            <div className="p-4">
              <div className="flex items-end gap-1">
                {analytics.map(day => (
                  <div key={day.date} className="flex-1" title={`${day.date}: ${day.conversations} conversations`}>
                    <div className="w-full rounded-t bg-blue-500" style={{ height: `${Math.max(4, day.conversations * 4)}px` }} />
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-500">{analytics.reduce((sum, day) => sum + day.conversations, 0)} conversations, {analytics.reduce((sum, day) => sum + day.responses, 0)} responses</p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-4 py-3"><h2 className="text-sm font-semibold text-slate-900">Team Workload</h2></div>
            {workload.length === 0 ? (
              <EmptyState compact title="No assignments yet" description="Assigned conversations will show workload here." />
            ) : (
              <div className="divide-y divide-slate-100">
                {workload.map(row => (
                  <div key={row.userId} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span className="text-slate-700">{row.name}</span>
                    <span className="text-xs text-slate-500">{row.assigned} · {row.slaPct === null ? '—' : percent(row.slaPct, 0)} SLA</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-4 py-3"><h2 className="text-sm font-semibold text-slate-900">Flagged Conversations</h2></div>
            {flagged.length === 0 ? (
              <EmptyState compact title="Nothing flagged" description="Escalated conversations appear here." />
            ) : (
              <div className="divide-y divide-slate-100">
                {flagged.map(row => (
                  <div key={row.id} className="px-4 py-2.5">
                    <p className="text-sm font-medium text-slate-800">{row.sender_handle ?? row.sender_name}</p>
                    <p className="text-xs text-slate-500">{row.flag_reason ?? 'Flagged for review'}</p>
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
