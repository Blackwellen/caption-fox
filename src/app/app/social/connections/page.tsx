import { requireSocialSurface } from '@/lib/social/server'
import {
  getChannels, getConnectionIssues, getHealthByChannel, getSyncRuns, getWebhookEvents,
} from '@/lib/social/queries'
import { AccessGate } from '@/components/social/AccessGate'
import { SocialSubNav } from '@/components/social/SocialSubNav'
import { ConnectChannelButton, DisconnectButton, ResolveIssueButton, SyncNowButton } from '@/components/social/ConnectionActions'
import { ConnectStatusBanner } from '@/components/social/ConnectStatusBanner'
import { HealthBadge, ProviderBadge, TimeAgo } from '@/components/social/primitives'
import { EmptyState } from '@/components/ui/EmptyState'
import { CHANNEL_LIMITS } from '@/lib/social/entitlements'
import { PROVIDER_LABELS } from '@/types/social'

export const dynamic = 'force-dynamic'

export default async function SocialConnectionsPage() {
  const session = await requireSocialSurface('connections')
  if (!session.access.allowed) return <div className="p-6"><AccessGate access={session.access} /></div>

  const channels = await getChannels(session, true)
  const [issues, syncRuns, webhookEvents, health] = await Promise.all([
    getConnectionIssues(session),
    getSyncRuns(session, 15),
    getWebhookEvents(session, 12),
    getHealthByChannel(session, { from: new Date(Date.now() - 7 * 86400000), to: new Date() }, channels),
  ])

  const active = channels.filter(channel => channel.is_active)
  const healthy = active.filter(channel => channel.health === 'healthy').length
  const errors = active.filter(channel => ['error', 'expired'].includes(channel.health)).length
  const expiring = active.filter(channel => channel.token_status === 'expiring' || channel.token_status === 'expired').length
  const limit = CHANNEL_LIMITS[session.ctx.plan ?? 'starter']

  return (
    <div className="p-4 sm:p-6">
      <SocialSubNav visible={session.surfaces} />

      <ConnectStatusBanner />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Social Connections</h1>
          <p className="mt-0.5 text-sm text-slate-500">Manage connected sources, sync health, permissions, and account mappings.</p>
        </div>
        {session.can('social.connections.connect') && <ConnectChannelButton />}
      </div>

      <section className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-medium text-slate-500">Connected Channels</p><p className="mt-1.5 text-xl font-bold text-slate-900">{active.length}{limit !== null ? ` / ${limit}` : ''}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-medium text-slate-500">Healthy Connections</p><p className="mt-1.5 text-xl font-bold text-emerald-600">{healthy}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-medium text-slate-500">Sync Errors</p><p className="mt-1.5 text-xl font-bold text-red-600">{errors}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-medium text-slate-500">Expiring Tokens</p><p className="mt-1.5 text-xl font-bold text-amber-600">{expiring}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-medium text-slate-500">Open Issues</p><p className="mt-1.5 text-xl font-bold text-slate-900">{issues.length}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-medium text-slate-500">Recent Syncs</p><p className="mt-1.5 text-xl font-bold text-slate-900">{syncRuns.length}</p></div>
      </section>

      {active.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6">
          <EmptyState title="No channels connected" description="Connect Instagram, TikTok, Facebook, LinkedIn, YouTube, X, Pinterest or Threads to start publishing and syncing real data." />
        </div>
      ) : (
        <section className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {active.map(channel => {
            const missing = channel.required_scopes.filter(scope => !channel.granted_scopes.includes(scope))
            return (
              <div key={channel.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ProviderBadge provider={channel.platform} />
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{PROVIDER_LABELS[channel.platform]}</p>
                      <p className="text-xs text-slate-400">@{channel.handle ?? channel.account_name}</p>
                    </div>
                  </div>
                  <HealthBadge health={channel.health} />
                </div>
                <div className="mt-3 text-xs text-slate-500">
                  Scopes {channel.granted_scopes.length} of {channel.required_scopes.length}
                  {missing.length > 0 && <span className="ml-1 text-amber-600">({missing.length} missing)</span>}
                </div>
                <div className="mt-1 text-xs text-slate-500">Last sync: <TimeAgo iso={channel.last_successful_sync_at ?? channel.last_sync_at} /></div>
                <div className="mt-1 text-xs capitalize text-slate-500">Permissions: {channel.permission_mode.replace('_', ' ')}</div>
                <div className="mt-3 flex gap-2">
                  {session.can('social.connections.sync') && <SyncNowButton channelId={channel.id} />}
                  {session.can('social.connections.disconnect') && <DisconnectButton channelId={channel.id} accountName={channel.account_name} />}
                </div>
              </div>
            )
          })}
        </section>
      )}

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-900">Health by Channel</h2></div>
          {health.length === 0 ? (
            <EmptyState compact title="No sync history yet" description="Success rate per channel will appear here." />
          ) : (
            <div className="space-y-3 p-5">
              {health.map(row => (
                <div key={row.channel.id}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-slate-600">{PROVIDER_LABELS[row.channel.platform]}</span>
                    <span className="text-slate-500">{row.successPct === null ? 'No syncs' : `${Math.round(row.successPct * 100)}%`}</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-100">
                    <div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${(row.successPct ?? 0) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-900">Sync History</h2></div>
          {syncRuns.length === 0 ? (
            <EmptyState compact title="No syncs yet" description="Sync runs will appear here as channels are connected." />
          ) : (
            <div className="divide-y divide-slate-100">
              {syncRuns.map(run => (
                <div key={run.id} className="flex items-center justify-between px-5 py-2.5 text-sm">
                  <span className="capitalize text-slate-700">{run.kind} · {run.status}</span>
                  <TimeAgo iso={run.started_at} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-900">Issues & Alerts</h2></div>
          {issues.length === 0 ? (
            <EmptyState compact title="No open issues" description="Token, permission and sync problems will appear here." />
          ) : (
            <div className="divide-y divide-slate-100">
              {issues.map(issue => (
                <div key={issue.id} className="px-5 py-3">
                  <p className="text-sm font-medium text-slate-800">{issue.message}</p>
                  {issue.hint && <p className="mt-0.5 text-xs text-slate-500">{issue.hint}</p>}
                  <div className="mt-2">
                    {session.can('social.connections.edit') && <ResolveIssueButton issueId={issue.id} />}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="mt-5 rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-900">Webhook / Activity Log</h2></div>
        {webhookEvents.length === 0 ? (
          <EmptyState compact title="No webhook events yet" description="Realtime provider events will be logged here." />
        ) : (
          <div className="divide-y divide-slate-100">
            {webhookEvents.map(event => (
              <div key={event.id} className="flex items-center justify-between px-5 py-2.5 text-sm">
                <span className="text-slate-700">{event.summary ?? event.event_type} · {event.provider}</span>
                <TimeAgo iso={event.received_at} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
