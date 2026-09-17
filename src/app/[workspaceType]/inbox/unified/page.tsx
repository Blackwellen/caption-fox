import { AlertTriangle, CheckCircle2, Clock3, MessageSquareText, Timer } from 'lucide-react'
import InboxFrame from '@/components/inbox/InboxFrame'
import { KpiTile, PageHeader, Panel, EmptyState } from '@/components/inbox/ui'
import UnifiedList from '@/components/inbox/UnifiedList'
import ThreadView from '@/components/inbox/ThreadView'
import UnifiedRail from '@/components/inbox/UnifiedRail'
import { TitleAddons, UnifiedHeaderActions } from '@/components/inbox/HeaderActions'
import { getInboxPage } from '@/lib/inbox/page-context'
import { getConversationDetail, getInboxCounts, listConversations, listMembers, listTeams } from '@/lib/inbox/data'
import { parseInboxQuery } from '@/lib/inbox/filters'
import { deltaFor, formatDuration, formatPct, kpiDelta, percentChange } from '@/lib/inbox/format'
import type { InboxCounts } from '@/lib/inbox/types'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Unified Inbox · Caption Fox' }

export default async function UnifiedInboxPage({ params, searchParams }: {
  params: Promise<{ workspaceType: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { workspaceType } = await params
  const page = await getInboxPage(workspaceType, 'unified')
  const state = parseInboxQuery(await searchParams, { filters: { lane: 'open' }, pageSize: 8 })
  const { supabase, workspace, userId, can } = page

  const [{ counts, yesterday }, list, members, teams, { data: policies }, { data: replies }] = await Promise.all([
    getInboxCounts(supabase, workspace.id, workspace.timezone),
    listConversations(supabase, workspace.id, { filters: state.filters, sort: state.sort, page: state.page, pageSize: state.pageSize, userId }),
    listMembers(supabase, workspace.id),
    listTeams(supabase, workspace.id),
    supabase.from('inbox_sla_policies').select('id, name, targets, is_default').eq('workspace_id', workspace.id),
    supabase.from('saved_replies').select('id, title, content').eq('workspace_id', workspace.id).is('archived_at', null).order('title').limit(30),
  ])
  const selectedId = state.conversationId ?? list.rows[0]?.id ?? null
  const detail = selectedId ? await getConversationDetail(supabase, workspace.id, selectedId) : null
  const policy = detail ? (policies ?? []).find(p => p.id === detail.conversation.sla_policy_id) ?? (policies ?? []).find(p => p.is_default) ?? null : null

  const firstResponseChange = percentChange(counts.avg_first_response_secs, counts.avg_first_response_prev_secs)
  const resolvedChange = percentChange(counts.resolved_today, counts.resolved_yesterday)
  const d = (key: keyof InboxCounts, good = true) => kpiDelta(deltaFor(key, counts, yesterday), good)

  return (
    <InboxFrame basePath={page.basePath} activeTab="unified" visibleTabs={page.visibleTabs} counts={{ unassigned: counts.unassigned }}>
      <PageHeader
        title="Unified Inbox"
        subtitle="Manage all conversations across channels in one place. Respond faster and keep every customer happy."
        titleAddon={<TitleAddons filters={state.filters} sort={state.sort} canSave={can('inbox.saved_views.create')} info="Every conversation from your connected channels, in one queue." />}
        actions={<UnifiedHeaderActions pageThreadIds={list.rows.map(r => r.id)} canBulk={can('inbox.bulk_manage')} canExport={can('inbox.export')} canImport={can('contacts.import')} canReply={can('inbox.reply')} userId={userId} />}
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:gap-[13px]">
        <KpiTile label="Open conversations" value={counts.open.toLocaleString('en-GB')} tone="purple" icon={<MessageSquareText size={19} />} delta={d('open')} />
        <KpiTile label="Awaiting reply" value={counts.awaiting.toLocaleString('en-GB')} tone="orange" icon={<Clock3 size={19} />} delta={d('awaiting', false)} />
        <KpiTile label="SLA at risk" value={counts.sla_at_risk.toLocaleString('en-GB')} tone="red" icon={<AlertTriangle size={19} />} delta={d('sla_at_risk', false)} />
        <KpiTile label="Avg. first response time" value={formatDuration(counts.avg_first_response_secs)} tone="blue" icon={<Timer size={19} />}
          delta={firstResponseChange ? { direction: firstResponseChange > 0 ? 'up' : 'down', good: firstResponseChange < 0, text: formatPct(firstResponseChange) } : null}
          footnote={counts.avg_first_response_secs == null ? 'No replies in the last 24h' : undefined} />
        <KpiTile label="Resolved today" value={counts.resolved_today.toLocaleString('en-GB')} tone="green" icon={<CheckCircle2 size={19} />}
          delta={resolvedChange ? { direction: resolvedChange > 0 ? 'up' : 'down', good: resolvedChange > 0, text: formatPct(resolvedChange) } : null} />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:h-[793px] lg:grid-cols-[minmax(0,335fr)_minmax(0,533fr)_minmax(0,323fr)] lg:gap-[10px]">
        <Panel className="h-[620px] overflow-hidden lg:h-full">
          <UnifiedList
            workspaceId={workspace.id} rows={list.rows} total={list.total} page={state.page} pageSize={state.pageSize}
            lane={state.filters.lane ?? 'open'} laneCounts={{ open: counts.open, snoozed: counts.snoozed, closed: counts.closed }}
            selectedId={selectedId} members={members} timezone={workspace.timezone} error={list.error}
          />
        </Panel>
        <Panel className="h-[640px] overflow-hidden lg:h-full">
          {detail ? (
            <ThreadView key={detail.conversation.id} detail={detail} variant="unified" timezone={workspace.timezone} savedReplies={replies ?? []}
              can={{ reply: can('inbox.reply'), note: can('inbox.note'), close: can('inbox.close'), snooze: can('inbox.snooze'), tags: can('inbox.tags.manage'), assign: can('inbox.assign'), ai: can('copilot.use') }} />
          ) : (
            <EmptyState icon={MessageSquareText} title="Select a conversation" body="Choose a conversation from the list to read and reply." />
          )}
        </Panel>
        <div className="lg:h-full lg:overflow-y-auto">
          {detail ? (
            <UnifiedRail detail={detail} members={members} teams={teams} timezone={workspace.timezone}
              policy={policy ? { id: policy.id, name: policy.name, targets: policy.targets as Record<string, { first: number; resolve: number }> } : null}
              can={{ assign: can('inbox.assign'), tags: can('inbox.tags.manage'), close: can('inbox.close'), snooze: can('inbox.snooze'), editContact: can('contacts.edit'), tasks: can('tasks.edit') }} />
          ) : null}
        </div>
      </div>
    </InboxFrame>
  )
}
