import Link from 'next/link'
import type { ReactNode } from 'react'
import { AlertTriangle, ArrowUpRight, BadgeCheck, CheckCircle2, CircleDashed, Clock, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PERMISSIONS } from '@/lib/permissions'
import type { SocialSession } from '@/lib/social/server'
import type { SearchParams } from '@/lib/social/url-state'
import { parseId } from '@/lib/social/url-state'
import { getChannelDetail, getMentionDetail, getPostDetail, type ActivityItem } from '@/lib/social/detail-queries'
import { getConversation, getReplyTemplates, getWorkspaceMembers } from '@/lib/social/queries'
import { compactNumber } from '@/lib/social/metrics'
import { PageTrail } from '@/components/ui/Breadcrumbs'
import {
  Ago, Avatar, Badge, Card, CardTitle, EmptyNote, fmtCount, fmtDateTime, fmtRate, HEALTH, LineChart, PostStatusBadge,
  PROVIDER_NAMES, ProviderIcon, SENTIMENT, type Tone,
} from '../kit'
import {
  ConnectionActions, ConversationActions, MentionActions, PostActions, ResolveIssueButton,
} from '../detail/DetailActions'

// Detail routes for Social records: /{type}/social/posts/:id,
// /conversations/:id, /connections/:id and /listening/mentions/:id.
//
// No design reference exists for these pages, so they reuse the Overview
// primitives (cards, badges, type scale) to sit in the same visual system.
// Each record is loaded with the session's workspace filter on top of RLS, so
// a malformed id, another workspace's id or a deleted record all resolve to the
// same not-found state and never reveal that the record exists.

type DetailProps = { session: SocialSession; searchParams: SearchParams; id: string }

function NotFound({ session, label, back }: { session: SocialSession; label: string; back: { href: string; label: string } }) {
  return (
    <div className="space-y-4">
      <PageTrail back={back} crumbs={[{ label: 'Social', href: session.basePath }, { label }]} />
      <div className="mx-auto max-w-lg py-8">
        <EmptyNote
          title={`${label} not found`}
          description="It may have been deleted, or it belongs to a workspace you are not signed in to. Check the link or return to the list."
          action={<Link href={back.href} className="text-[13px] font-medium text-blue-600 hover:underline">{back.label}</Link>}
        />
      </div>
    </div>
  )
}

function DetailHeader({ session, back, crumbs, title, subtitle, icon, badges, actions }: {
  session: SocialSession
  back: { href: string; label: string }
  crumbs: { label: string; href?: string }[]
  title: string
  subtitle: ReactNode
  icon?: ReactNode
  badges?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="mb-4 space-y-3">
      <PageTrail back={back} crumbs={[{ label: 'Social', href: session.basePath }, ...crumbs]} compact />
      <header className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          {icon}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-[22px] font-bold tracking-[-0.02em] text-slate-900">{title}</h1>
              {badges}
            </div>
            <p className="mt-1 text-[13px] text-slate-500">{subtitle}</p>
          </div>
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </header>
    </div>
  )
}

function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5" title={hint}>
      <dt className="text-[11.5px] font-medium text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-[17px] font-semibold tabular-nums text-slate-900">{value}</dd>
    </div>
  )
}

function Meta({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="divide-y divide-slate-100 text-[13px]">
      {items.map(([label, value]) => (
        <div key={label} className="flex items-start justify-between gap-4 py-2">
          <dt className="shrink-0 text-slate-500">{label}</dt>
          <dd className="min-w-0 text-right font-medium text-slate-800">{value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  )
}

function ActivityList({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) return <EmptyNote title="No activity yet" description="Changes to this record are logged here with who made them and when." />
  return (
    <ol className="space-y-3">
      {items.map(item => (
        <li key={item.id} className="flex gap-2.5">
          <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', item.severity === 'error' ? 'bg-red-500' : item.severity === 'warning' ? 'bg-amber-500' : item.severity === 'success' ? 'bg-emerald-500' : 'bg-blue-500')} aria-hidden />
          <div className="min-w-0 text-[13px]">
            <p className="text-slate-800"><span className="font-medium">{item.actor?.full_name ?? (item.actor_kind === 'system' ? 'Caption Fox' : 'A teammate')}</span> {item.summary}</p>
            {item.detail && <p className="text-[12px] text-slate-500">{item.detail}</p>}
            <time dateTime={item.created_at} className="text-[11.5px] text-slate-400">{fmtDateTime(item.created_at)} UTC</time>
          </div>
        </li>
      ))}
    </ol>
  )
}

const DELIVERY: Record<string, { label: string; tone: Tone; icon: ReactNode }> = {
  sent: { label: 'Published', tone: 'green', icon: <CheckCircle2 size={14} className="text-emerald-600" aria-hidden /> },
  queued: { label: 'Queued', tone: 'blue', icon: <Clock size={14} className="text-blue-600" aria-hidden /> },
  processing: { label: 'Publishing', tone: 'blue', icon: <CircleDashed size={14} className="text-blue-600" aria-hidden /> },
  failed: { label: 'Failed', tone: 'red', icon: <XCircle size={14} className="text-red-600" aria-hidden /> },
  skipped: { label: 'Awaiting approval', tone: 'amber', icon: <Clock size={14} className="text-amber-600" aria-hidden /> },
  cancelled: { label: 'Cancelled', tone: 'slate', icon: <XCircle size={14} className="text-slate-400" aria-hidden /> },
}

// ── Post ─────────────────────────────────────────────────────────────────────

export async function PostDetailPage({ session, id }: DetailProps) {
  const back = { href: `${session.basePath}/publishing`, label: 'Publishing' }
  const postId = parseId(id)
  const detail = postId ? await getPostDetail(session, postId) : null
  if (!detail) return <NotFound session={session} label="Post" back={back} />

  const { post, deliveries, metrics, activity, campaign, owner } = detail
  const totals = metrics.reduce((sum, row) => ({
    reach: sum.reach + (row.reach ?? 0), impressions: sum.impressions + (row.impressions ?? 0),
    engagements: sum.engagements + (row.likes ?? 0) + (row.comments ?? 0) + (row.shares ?? 0) + (row.saves ?? 0),
    clicks: sum.clicks + (row.clicks ?? 0),
  }), { reach: 0, impressions: 0, engagements: 0, clicks: 0 })
  const platform = post.platforms?.[0] ?? 'instagram'

  return (
    <>
      <DetailHeader
        session={session} back={back}
        crumbs={[{ label: 'Publishing', href: back.href }, { label: post.title ?? 'Untitled post' }]}
        title={post.title ?? 'Untitled post'}
        icon={<ProviderIcon provider={platform} size={36} />}
        badges={<PostStatusBadge status={post.status} />}
        subtitle={post.published_at ? `Published ${fmtDateTime(post.published_at)} UTC` : post.scheduled_at ? `Scheduled for ${fmtDateTime(post.scheduled_at)} UTC` : 'Not scheduled'}
        actions={(
          <PostActions
            postId={post.id} status={post.status} basePath={session.basePath}
            hasFailures={deliveries.some(row => row.status === 'failed' && row.attempt_count < row.max_attempts)}
            can={{
              edit: session.can(PERMISSIONS.SOCIAL_PUBLISHING_EDIT), approve: session.can(PERMISSIONS.SOCIAL_PUBLISHING_APPROVE),
              publish: session.can(PERMISSIONS.SOCIAL_PUBLISHING_PUBLISH), cancel: session.can(PERMISSIONS.SOCIAL_PUBLISHING_CANCEL),
              create: session.can(PERMISSIONS.SOCIAL_PUBLISHING_CREATE),
            }}
          />
        )}
      />

      {post.failure_summary && (
        <p role="alert" className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[13px] text-red-700">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden /> {post.failure_summary}
        </p>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4">
          <Card className="p-4">
            <CardTitle title="Content" />
            <div className="mt-3 flex flex-col gap-4 sm:flex-row">
              {post.thumbnail_url && (
                // eslint-disable-next-line @next/next/no-img-element -- storage-backed post media
                <img src={post.thumbnail_url} alt="" className="h-40 w-40 shrink-0 rounded-lg object-cover" />
              )}
              <p className="min-w-0 whitespace-pre-wrap text-[14px] leading-relaxed text-slate-700">{post.caption || 'No caption yet.'}</p>
            </div>
            {!!post.hashtags?.length && (
              <p className="mt-3 flex flex-wrap gap-1.5">{post.hashtags.map(tag => <Badge key={tag} tone="blue">{tag}</Badge>)}</p>
            )}
          </Card>

          <Card className="p-4">
            <CardTitle title="Performance" hint="Totals from synced post insights. Engagements are likes, comments, shares and saves." />
            {metrics.length === 0 ? (
              <EmptyNote className="mt-3" title="No insights yet" description="Metrics appear after the post publishes and the next channel sync completes." />
            ) : (
              <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat label="Reach" value={fmtCount(totals.reach)} />
                <Stat label="Impressions" value={fmtCount(totals.impressions)} />
                <Stat label="Engagements" value={fmtCount(totals.engagements)} />
                <Stat label="Eng. rate" value={fmtRate(totals.reach ? totals.engagements / totals.reach : null)} hint="Engagements ÷ reach" />
              </dl>
            )}
          </Card>

          <Card className="p-4">
            <CardTitle title="Channel deliveries" count={deliveries.length} hint="Each channel is delivered and retried independently." />
            {deliveries.length === 0 ? (
              <EmptyNote className="mt-3" title="Nothing queued" description="Deliveries are created when the post is scheduled or published." />
            ) : (
              <ul className="mt-2 divide-y divide-slate-100">
                {deliveries.map(row => {
                  const style = DELIVERY[row.status] ?? { label: row.status, tone: 'slate' as Tone, icon: null }
                  return (
                    <li key={row.id} className="flex flex-wrap items-center gap-3 py-2.5 text-[13px]">
                      {row.channel && <ProviderIcon provider={row.channel.platform} size={20} />}
                      <span className="min-w-0 flex-1">
                        <Link href={`${session.basePath}/connections/${row.channel_id}`} className="font-medium text-slate-800 hover:underline">{row.channel?.handle ?? row.channel?.account_name ?? 'Channel'}</Link>
                        {row.error_message && <span className="block text-[12px] text-red-600">{row.error_message}</span>}
                      </span>
                      <span className="text-[12px] text-slate-500">Attempt {row.attempt_count} of {row.max_attempts}</span>
                      <Badge tone={style.tone}>{style.label}</Badge>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-4">
            <CardTitle title="Details" />
            <Meta items={[
              ['Channels', <span key="c" className="inline-flex gap-1">{(post.platforms ?? []).map(item => <ProviderIcon key={item} provider={item} size={16} />)}</span>],
              ['Format', post.post_type],
              ['Owner', owner?.full_name ?? '—'],
              ['Campaign', campaign ? <Link key="k" href={`/${session.kind}/campaigns/${campaign.id}`} className="text-blue-600 hover:underline">{campaign.name}</Link> : 'None'],
              ['Approval', post.approval_required ? (post.approved_at ? `Approved ${fmtDateTime(post.approved_at)}` : 'Required') : 'Not required'],
              ['Audience timezone', post.timezone],
              ['Last updated', `${fmtDateTime(post.updated_at)} UTC`],
            ]} />
            {post.is_demo && <p className="mt-2 text-[11.5px] text-slate-400">Demo record</p>}
          </Card>
          <Card className="p-4">
            <CardTitle title="Activity" />
            <div className="mt-3"><ActivityList items={activity} /></div>
          </Card>
        </div>
      </div>
    </>
  )
}

// ── Conversation ─────────────────────────────────────────────────────────────

const SLA: Record<string, { label: string; tone: Tone }> = {
  met: { label: 'SLA met', tone: 'green' }, on_track: { label: 'On track', tone: 'blue' },
  warning: { label: 'SLA at risk', tone: 'amber' }, breached: { label: 'SLA breached', tone: 'red' },
}

export async function ConversationDetailPage({ session, id }: DetailProps) {
  const back = { href: `${session.basePath}/engagement`, label: 'Engagement' }
  const conversationId = parseId(id)
  const [detail, members, templates] = await Promise.all([
    conversationId ? getConversation(session, conversationId) : Promise.resolve(null),
    getWorkspaceMembers(session),
    getReplyTemplates(session),
  ])
  if (!detail) return <NotFound session={session} label="Conversation" back={back} />

  const { conversation: thread, messages, post } = detail
  const sentiment = thread.sentiment ? SENTIMENT[thread.sentiment] : null
  const sla = SLA[thread.sla_state]

  return (
    <>
      <DetailHeader
        session={session} back={back}
        crumbs={[{ label: 'Engagement', href: back.href }, { label: thread.sender_handle ?? thread.sender_name ?? 'Conversation' }]}
        title={thread.sender_name ?? thread.sender_handle ?? 'Conversation'}
        icon={<Avatar src={thread.sender_avatar} name={thread.sender_name} size={40} />}
        badges={(
          <>
            {thread.platform && <ProviderIcon provider={thread.platform} size={18} />}
            <Badge tone={thread.status === 'resolved' ? 'green' : 'blue'}>{thread.status === 'resolved' ? 'Resolved' : thread.status === 'assigned' ? 'Assigned' : 'Open'}</Badge>
            {thread.is_flagged && <Badge tone="red">Flagged</Badge>}
          </>
        )}
        subtitle={`${thread.sender_handle ? `@${thread.sender_handle.replace(/^@/, '')} · ` : ''}${thread.type === 'dm' ? 'Direct message' : thread.type === 'mention' ? 'Mention' : 'Comment'} · received ${fmtDateTime(thread.created_at)} UTC`}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          <Card className="p-4">
            <CardTitle title="Conversation" count={messages.length} />
            <ol className="mt-3 space-y-3">
              {messages.map(message => {
                const outbound = message.sender_type !== 'external'
                return (
                  <li key={message.id} className={cn('flex', outbound && 'justify-end')}>
                    <div className={cn('max-w-[85%] rounded-xl px-3.5 py-2.5 text-[13.5px]',
                      message.is_internal_note ? 'border border-amber-200 bg-amber-50 text-amber-900' : outbound ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-800')}>
                      {message.is_internal_note && <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide">Internal note</p>}
                      <p className="whitespace-pre-wrap">{message.content}</p>
                      <p className={cn('mt-1 text-[11px]', outbound && !message.is_internal_note ? 'text-blue-100' : 'text-slate-500')}>
                        {outbound ? (message.author?.full_name ?? 'Your team') : (thread.sender_handle ?? thread.sender_name)} · <Ago iso={message.sent_at} />
                        {outbound && !message.is_internal_note && message.delivery_status !== 'sent' && ` · ${message.delivery_status === 'failed' ? `Failed${message.failure_reason ? `: ${message.failure_reason}` : ''}` : 'Sending'}`}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ol>
          </Card>
          <ConversationActions
            conversationId={thread.id} status={thread.status} isFlagged={thread.is_flagged} assignedTo={thread.assigned_to}
            members={members.map(member => ({ id: member.id, name: member.name }))}
            templates={(templates as { id: string; title: string; content: string }[]).map(({ id: templateId, title, content }) => ({ id: templateId, title, content }))}
            can={{
              reply: session.can(PERMISSIONS.SOCIAL_ENGAGEMENT_REPLY), assign: session.can(PERMISSIONS.SOCIAL_ENGAGEMENT_ASSIGN),
              resolve: session.can(PERMISSIONS.SOCIAL_ENGAGEMENT_RESOLVE), moderate: session.can(PERMISSIONS.SOCIAL_ENGAGEMENT_MODERATE),
            }}
          />
        </div>
        <div className="space-y-4">
          <Card className="p-4">
            <CardTitle title="Details" />
            <Meta items={[
              ['Sentiment', sentiment ? <Badge key="s" tone={sentiment.tone}>{sentiment.label}{thread.sentiment_source === 'manual' ? ' (set manually)' : ''}</Badge> : 'Unknown'],
              ['Priority', thread.priority],
              ['Response SLA', sla ? <Badge key="l" tone={sla.tone}>{sla.label}</Badge> : '—'],
              ['First response', thread.first_response_at ? `${fmtDateTime(thread.first_response_at)} UTC` : 'Not yet'],
              ['Assigned to', thread.assignee?.full_name ?? 'Unassigned'],
              ['Tags', thread.tags.length ? thread.tags.join(', ') : 'None'],
              ['Flag reason', thread.flag_reason ?? '—'],
            ]} />
          </Card>
          {post && (
            <Card className="p-4">
              <CardTitle title="Related post" />
              <Link href={`${session.basePath}/posts/${post.id}`} className="mt-3 flex items-center gap-3 rounded-lg p-1 hover:bg-slate-50">
                {post.thumbnail_url && (
                  // eslint-disable-next-line @next/next/no-img-element -- storage-backed post media
                  <img src={post.thumbnail_url} alt="" className="h-12 w-12 rounded-md object-cover" />
                )}
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-800">{post.title ?? 'Untitled post'}</span>
                <ArrowUpRight size={14} className="text-slate-400" aria-hidden />
              </Link>
            </Card>
          )}
        </div>
      </div>
    </>
  )
}

// ── Connection ───────────────────────────────────────────────────────────────

export async function ConnectionDetailPage({ session, id }: DetailProps) {
  const back = { href: `${session.basePath}/connections`, label: 'Connections' }
  const channelId = parseId(id)
  const detail = channelId ? await getChannelDetail(session, channelId) : null
  if (!detail) return <NotFound session={session} label="Connection" back={back} />

  const { channel, runs, issues, events, daily, activity } = detail
  const health = HEALTH[channel.health] ?? HEALTH.healthy
  const missing = channel.required_scopes.filter(scope => !channel.granted_scopes.includes(scope))
  const reach = daily.reduce((sum, row) => sum + (row.total_reach ?? 0), 0)
  const engagements = daily.reduce((sum, row) => sum + (row.total_engagement ?? 0), 0)
  const followerGain = daily.reduce((sum, row) => sum + (row.follower_change ?? 0), 0)

  return (
    <>
      <DetailHeader
        session={session} back={back}
        crumbs={[{ label: 'Connections', href: back.href }, { label: channel.handle ?? channel.account_name }]}
        title={channel.handle ?? channel.account_name}
        icon={<ProviderIcon provider={channel.platform} size={40} />}
        badges={<Badge tone={health.tone}>{health.label}</Badge>}
        subtitle={`${PROVIDER_NAMES[channel.platform] ?? channel.platform} · ${channel.account_type?.replace(/_/g, ' ') ?? 'account'}${channel.connected_at ? ` · connected ${fmtDateTime(channel.connected_at)} UTC` : ''}`}
        actions={(
          <ConnectionActions
            channelId={channel.id} accountName={channel.handle ?? channel.account_name} provider={channel.platform}
            teamLabel={channel.team_label} basePath={session.basePath}
            can={{
              sync: session.can(PERMISSIONS.SOCIAL_CONNECTIONS_SYNC), edit: session.can(PERMISSIONS.SOCIAL_CONNECTIONS_EDIT),
              disconnect: session.can(PERMISSIONS.SOCIAL_CONNECTIONS_DISCONNECT), connect: session.can(PERMISSIONS.SOCIAL_CONNECTIONS_CONNECT),
            }}
          />
        )}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4">
          <Card className="p-4">
            <CardTitle title="Last 30 days" hint="From synced daily channel insights." />
            <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Followers" value={fmtCount(channel.follower_count)} />
              <Stat label="New followers" value={fmtCount(followerGain)} />
              <Stat label="Reach" value={fmtCount(reach)} />
              <Stat label="Eng. rate" value={fmtRate(reach ? engagements / reach : null)} />
            </dl>
            <div className="mt-4">
              <LineChart
                labels={daily.map(row => row.date.slice(5).replace('-', '/'))}
                series={[{ key: 'reach', label: 'Reach', color: '#3B6FF5', values: daily.map(row => row.total_reach) }]}
                height={140} dots={false} leftFormat={compactNumber}
                summary={`Daily reach for ${channel.handle ?? channel.account_name} over the last 30 days`}
              />
            </div>
          </Card>

          <Card className="p-4">
            <CardTitle title="Sync history" count={runs.length} />
            {runs.length === 0 ? <EmptyNote className="mt-3" title="No syncs yet" description="Runs appear here after the first scheduled or manual sync." /> : (
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-[13px]">
                  <thead className="text-[12px] text-slate-500"><tr className="[&>th]:py-2 [&>th]:font-medium"><th scope="col">Started</th><th scope="col">Type</th><th scope="col">Trigger</th><th scope="col" className="text-right">Records</th><th scope="col" className="text-right">Status</th></tr></thead>
                  <tbody>
                    {runs.map(run => (
                      <tr key={run.id} className="border-t border-slate-100 [&>td]:py-2">
                        <td className="text-slate-600">{fmtDateTime(run.started_at)}</td>
                        <td className="capitalize">{run.kind}</td>
                        <td className="capitalize text-slate-600">{run.trigger_source}</td>
                        <td className="text-right tabular-nums">{run.records_synced ?? '—'}</td>
                        <td className="text-right" title={run.error_message ?? undefined}>
                          <Badge tone={run.status === 'success' ? 'green' : run.status === 'partial' ? 'amber' : run.status === 'running' ? 'blue' : 'red'}>{run.status}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card className="p-4">
            <CardTitle title="Webhook events" count={events.length} />
            {events.length === 0 ? <EmptyNote className="mt-3" title="No events received" description="Provider webhooks for this account are listed as they arrive." /> : (
              <ul className="mt-2 divide-y divide-slate-100 text-[13px]">
                {events.map(event => (
                  <li key={event.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0 truncate text-slate-700">{event.summary ?? event.event_type} <span className="text-slate-400">· {event.event_type}</span></span>
                    <Ago iso={event.received_at} className="text-[12px] text-slate-400" />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-4">
            <CardTitle title="Access" />
            <Meta items={[
              ['Permissions', channel.permission_mode === 'read_only' ? 'Read only' : 'Read & publish'],
              ['Scopes', `${channel.granted_scopes.length} of ${channel.required_scopes.length} granted`],
              ['Token', <Badge key="t" tone={channel.token_status === 'valid' ? 'green' : channel.token_status === 'expiring' ? 'amber' : 'red'}>{channel.token_status}</Badge>],
              ['Token expires', channel.token_expires_at ? `${fmtDateTime(channel.token_expires_at)} UTC` : '—'],
              ['Team', channel.team_label ?? 'Unassigned'],
              ['Last successful sync', channel.last_successful_sync_at ? <Ago key="a" iso={channel.last_successful_sync_at} /> : 'Never'],
            ]} />
            {missing.length > 0 && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[12.5px] text-amber-800">
                <p className="font-medium">Missing permissions</p>
                <p className="mt-0.5 break-words font-mono text-[11.5px]">{missing.join(', ')}</p>
                <p className="mt-1">Reconnect and approve these to enable every feature.</p>
              </div>
            )}
            <p className="mt-3 flex items-center gap-1.5 text-[11.5px] text-slate-500"><BadgeCheck size={13} aria-hidden /> Tokens are encrypted and never shown in the app.</p>
          </Card>

          <Card className="p-4">
            <CardTitle title="Open issues" count={issues.length} />
            {issues.length === 0 ? <p className="mt-2 text-[13px] text-slate-500">No open issues.</p> : (
              <ul className="mt-2 space-y-2">
                {issues.map(issue => (
                  <li key={issue.id} className="flex items-start justify-between gap-2 rounded-lg border border-slate-100 p-2.5 text-[13px]">
                    <span className="min-w-0">
                      <span className="block font-medium text-slate-800">{issue.message}</span>
                      <span className="text-[12px] text-slate-500">Detected <Ago iso={issue.detected_at} /> ago</span>
                    </span>
                    <ResolveIssueButton issueId={issue.id} allowed={session.can(PERMISSIONS.SOCIAL_CONNECTIONS_EDIT)} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-4">
            <CardTitle title="Activity" />
            <div className="mt-3"><ActivityList items={activity} /></div>
          </Card>
        </div>
      </div>
    </>
  )
}

// ── Mention ──────────────────────────────────────────────────────────────────

export async function MentionDetailPage({ session, id }: DetailProps) {
  const back = { href: `${session.basePath}/listening`, label: 'Listening' }
  const mentionId = parseId(id)
  const detail = mentionId ? await getMentionDetail(session, mentionId) : null
  if (!detail) return <NotFound session={session} label="Mention" back={back} />

  const { mention, keyword, related } = detail
  const sentiment = SENTIMENT[mention.sentiment] ?? SENTIMENT.neutral
  const safeUrl = mention.url && /^https:\/\//i.test(mention.url) ? mention.url : null

  return (
    <>
      <DetailHeader
        session={session} back={back}
        crumbs={[{ label: 'Listening', href: back.href }, { label: 'Mention' }]}
        title={mention.author_name ?? mention.author_handle ?? 'Mention'}
        icon={<Avatar src={mention.author_avatar_url} name={mention.author_name} size={40} />}
        badges={(
          <>
            <ProviderIcon provider={mention.platform} size={18} />
            <Badge tone={sentiment.tone}>{sentiment.label}</Badge>
            {mention.is_influencer && <Badge tone="violet">Influencer</Badge>}
            <Badge tone={mention.priority === 'high' ? 'red' : mention.priority === 'medium' ? 'amber' : 'slate'}>{mention.priority} priority</Badge>
          </>
        )}
        subtitle={`${mention.author_handle ? `@${mention.author_handle.replace(/^@/, '')} · ` : ''}${fmtDateTime(mention.mentioned_at)} UTC`}
        actions={<MentionActions mentionId={mention.id} isStarred={mention.is_starred} isRead={mention.is_read} isActioned={Boolean(mention.is_actioned)} />}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          <Card className="p-4">
            <CardTitle title="Mention" />
            <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-slate-800">{mention.content}</p>
            {safeUrl && (
              <a href={safeUrl} target="_blank" rel="noopener noreferrer nofollow" className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-blue-600 hover:underline">
                View on {PROVIDER_NAMES[mention.platform] ?? 'source'} <ArrowUpRight size={13} aria-hidden />
              </a>
            )}
            <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Est. reach" value={fmtCount(mention.reach_estimate)} hint="Estimated from the author's audience" />
              <Stat label="Engagements" value={fmtCount(mention.engagement_count)} />
              <Stat label="Eng. rate" value={fmtRate(mention.engagement_rate)} />
              <Stat label="Author followers" value={fmtCount(mention.author_followers)} />
            </dl>
          </Card>
          <Card className="p-4">
            <CardTitle title="More from this author" count={related.length} />
            {related.length === 0 ? <p className="mt-2 text-[13px] text-slate-500">No other mentions from this author.</p> : (
              <ul className="mt-2 divide-y divide-slate-100">
                {related.map(item => (
                  <li key={item.id}>
                    <Link href={`${session.basePath}/listening/mentions/${item.id}`} className="flex items-center gap-2.5 py-2 text-[13px] hover:bg-slate-50">
                      <ProviderIcon provider={item.platform} size={16} />
                      <span className="min-w-0 flex-1 truncate text-slate-700">{item.content}</span>
                      <Badge tone={(SENTIMENT[item.sentiment] ?? SENTIMENT.neutral).tone}>{(SENTIMENT[item.sentiment] ?? SENTIMENT.neutral).label}</Badge>
                      <Ago iso={item.mentioned_at} className="w-8 text-right text-[12px] text-slate-400" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <Card className="h-fit p-4">
          <CardTitle title="Details" />
          <Meta items={[
            ['Source', `${PROVIDER_NAMES[mention.platform] ?? mention.platform} · ${mention.source_type.replace(/_/g, ' ')}`],
            ['Matched keyword', keyword ?? '—'],
            ['Topic', mention.topic ?? '—'],
            ['Country', mention.country_code ?? 'Unknown'],
            ['Verified author', mention.author_verified ? 'Yes' : 'No'],
            ['Sentiment score', mention.sentiment],
          ]} />
        </Card>
      </div>
    </>
  )
}
