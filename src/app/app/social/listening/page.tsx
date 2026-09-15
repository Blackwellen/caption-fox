import Link from 'next/link'
import { requireSocialSurface } from '@/lib/social/server'
import {
  getListeningAlertRules, getListeningSources, getListeningTotals, getMentions,
  getMentionsByCountry, getSentimentSeries, getShareOfVoice,
} from '@/lib/social/queries'
import { compactNumber, percent, rangeFromDays, signedPct } from '@/lib/social/metrics'
import { AccessGate } from '@/components/social/AccessGate'
import { SocialSubNav } from '@/components/social/SocialSubNav'
import { CreateAlertLauncher } from '@/components/social/CreateAlertLauncher'
import { StarMention } from '@/components/social/MentionActions'
import { ExportButton, ProviderBadge, RangePicker, SentimentPill, TimeAgo, ViewSwitcher } from '@/components/social/primitives'
import { EmptyState } from '@/components/ui/EmptyState'
import { MENTION_SOURCE_LABELS } from '@/types/social'

export const dynamic = 'force-dynamic'

const VIEWS = [
  { id: 'stream', label: 'Stream' },
  { id: 'table', label: 'Table' },
  { id: 'trends', label: 'Trends' },
  { id: 'topics', label: 'Topics' },
  { id: 'geography', label: 'Geography' },
]

export default async function SocialListeningPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams
  const session = await requireSocialSurface('listening')
  if (!session.access.allowed) return <div className="p-6"><AccessGate access={session.access} /></div>

  const days = Math.min(90, Math.max(7, Number(params.days ?? 7)))
  const range = rangeFromDays(days)
  const view = (VIEWS.some(item => item.id === params.view) ? params.view : 'stream') as 'stream' | 'table' | 'trends' | 'topics' | 'geography'
  const tab = (['all', 'unread', 'favourites', 'high_priority'].includes(params.tab) ? params.tab : 'all') as 'all' | 'unread' | 'favourites' | 'high_priority'

  const [totals, { rows: mentions, total }, sentimentSeries, sources, alertRules, geography, shareOfVoice] = await Promise.all([
    getListeningTotals(session, range),
    getMentions(session, range, { tab, search: params.q, source: params.source, sentiment: params.sentiment, pageSize: 20 }),
    getSentimentSeries(session, range),
    getListeningSources(session),
    getListeningAlertRules(session),
    getMentionsByCountry(session, range),
    getShareOfVoice(session, range, 'Caption Fox'),
  ])

  const sourceMissing = sources.length === 0

  return (
    <div className="p-4 sm:p-6">
      <SocialSubNav visible={session.surfaces} />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Social Listening</h1>
          <p className="mt-0.5 text-sm text-slate-500">Monitor conversations, keywords, and trends to understand what people are saying about your brand.</p>
        </div>
        <div className="flex items-center gap-2">
          <RangePicker days={days} />
          <ExportButton dataset="listening" days={days} />
          {session.can('social.listening.create_alert') && <CreateAlertLauncher />}
        </div>
      </div>

      {sourceMissing && (
        <div className="mb-5 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          No listening sources are configured yet. Mentions shown here come only from your connected channels — connect a listening source in Connections for broader coverage.
        </div>
      )}

      <div className="mb-5"><ViewSwitcher views={VIEWS} active={view} /></div>

      <section className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Total Mentions</p>
          <p className="mt-1.5 text-xl font-bold text-slate-900">{compactNumber(totals.total)}</p>
          {totals.changePct !== null && <p className="mt-0.5 text-xs text-slate-500">{signedPct(totals.changePct)}</p>}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Brand Sentiment</p>
          <p className="mt-1.5 text-xl font-bold text-slate-900">{percent(totals.sentiment.positivePct, 0)} positive</p>
          <p className="mt-0.5 text-xs text-slate-500">{totals.sentiment.negative} negative</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Trending Topics</p>
          <p className="mt-1.5 text-xl font-bold text-slate-900">{totals.topics.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Influencer Mentions</p>
          <p className="mt-1.5 text-xl font-bold text-slate-900">{totals.influencerMentions}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Share of Voice</p>
          <p className="mt-1.5 text-xl font-bold text-slate-900">{shareOfVoice.rows[0] ? percent(shareOfVoice.rows[0].share, 0) : '—'}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Active Alerts</p>
          <p className="mt-1.5 text-xl font-bold text-slate-900">{alertRules.filter(rule => rule.is_active).length}</p>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.7fr_1fr]">
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="font-semibold text-slate-900">Mentions Stream</h2>
            <span className="text-xs text-slate-500">{total} mentions</span>
          </div>
          {mentions.length === 0 ? (
            <EmptyState compact title="No mentions in this range" description="Mentions from connected channels and listening sources will appear here." />
          ) : (
            <div className="divide-y divide-slate-100">
              {mentions.map(mention => (
                <div key={mention.id} className="flex items-start gap-3 px-5 py-3.5">
                  <ProviderBadge provider={mention.platform as never} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-slate-900">{mention.author_name ?? mention.author_handle ?? 'Unknown'}</p>
                      {mention.is_influencer && <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-700">Influencer</span>}
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500" title={MENTION_SOURCE_LABELS[mention.source_type as never]}>
                        {MENTION_SOURCE_LABELS[mention.source_type as never] ?? mention.source_type}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-sm text-slate-600">{mention.content}</p>
                    <div className="mt-1.5 flex items-center gap-3 text-xs text-slate-400">
                      <SentimentPill sentiment={mention.sentiment} />
                      {mention.reach_estimate !== null && <span>{compactNumber(mention.reach_estimate)} reach</span>}
                      <TimeAgo iso={mention.mentioned_at} />
                    </div>
                  </div>
                  <StarMention mentionId={mention.id} starred={mention.is_starred} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-5">
          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-900">Sentiment Over Time</h2></div>
            <div className="p-5">
              <div className="flex items-end gap-1">
                {sentimentSeries.map(day => {
                  const total = day.positive + day.neutral + day.negative || 1
                  return (
                    <div key={day.date} className="flex h-16 flex-1 flex-col-reverse overflow-hidden rounded" title={day.date}>
                      <div className="bg-red-400" style={{ height: `${(day.negative / total) * 100}%` }} />
                      <div className="bg-slate-300" style={{ height: `${(day.neutral / total) * 100}%` }} />
                      <div className="bg-emerald-400" style={{ height: `${(day.positive / total) * 100}%` }} />
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-900">Sources / Channels</h2></div>
            {sources.length === 0 ? (
              <EmptyState compact title="No sources configured" description="Connected channels feed listening automatically." />
            ) : (
              <div className="divide-y divide-slate-100">
                {sources.map(source => (
                  <div key={source.id} className="flex items-center justify-between px-5 py-2.5 text-sm">
                    <span className="text-slate-700">{source.label}</span>
                    <span className="text-xs text-slate-500">{source.mention_count} · {source.share_pct?.toFixed(1) ?? '0'}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-900">Mentions by Region</h2></div>
            {geography.buckets.length === 0 ? (
              <EmptyState compact title="No location data" description="Sources that report location will appear here." />
            ) : (
              <div className="divide-y divide-slate-100">
                {geography.buckets.slice(0, 6).map(bucket => (
                  <div key={bucket.code} className="flex items-center justify-between px-5 py-2.5 text-sm">
                    <span className="text-slate-700">{bucket.code === 'UNKNOWN' ? 'Unknown location' : bucket.code}</span>
                    <span className="text-xs text-slate-500">{bucket.count} · {percent(bucket.share, 0)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-900">Listening Alerts</h2></div>
            {alertRules.length === 0 ? (
              <EmptyState compact title="No alerts yet" description="Create an alert to be notified of spikes and trends." />
            ) : (
              <div className="divide-y divide-slate-100">
                {alertRules.map(rule => (
                  <div key={rule.id} className="flex items-center justify-between px-5 py-2.5 text-sm">
                    <span className="text-slate-700">{rule.name}</span>
                    <span className="text-xs text-slate-500">{rule.is_active ? 'Active' : 'Paused'} · {rule.frequency}</span>
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
