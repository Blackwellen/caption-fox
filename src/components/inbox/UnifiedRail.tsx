'use client'

import { useState, useTransition } from 'react'
import { ArrowRight, ArrowRightLeft, CircleAlert, Clock, MoreHorizontal, Plus, UserRound, Users, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { applyRoutingRules, assignConversations, updateConversations, updateTags } from '@/lib/inbox/actions'
import { createTaskFromConversation } from '@/lib/inbox/task-actions'
import type { ConversationDetail } from '@/lib/inbox/data'
import { formatClock, formatDuration } from '@/lib/inbox/format'
import type { MemberLite, TeamLite } from '@/lib/inbox/types'
import { Avatar, Panel, Pill, Progress, tagTone } from './ui'
import { Select } from './UnifiedList'
import { useNow } from './hooks'
import { openFox } from '@/components/fox-ai/events'

export interface SlaPolicyLite { id: string; name: string; targets: Record<string, { first: number; resolve: number }> }

export default function UnifiedRail({ detail, members, teams, policy, timezone, can }: {
  detail: ConversationDetail
  members: MemberLite[]
  teams: TeamLite[]
  policy: SlaPolicyLite | null
  timezone: string
  can: { assign: boolean; tags: boolean; close: boolean; snooze: boolean; editContact: boolean; tasks: boolean }
}) {
  const { conversation: c, contact, activity } = detail
  const now = useNow(30_000)
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [tagInput, setTagInput] = useState<string | null>(null)
  const [allActivity, setAllActivity] = useState(false)
  const [more, setMore] = useState(false)

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, done: string) => start(async () => {
    setError(null)
    const res = await fn()
    if (!res.ok) setError(res.error ?? 'Something went wrong.')
    else { setNotice(done); setTimeout(() => setNotice(null), 3000) }
  })

  const targets = policy?.targets?.[c.priority] ?? { first: 30, resolve: 1440 }
  const firstSecs = c.first_response_at
    ? (new Date(c.first_response_at).getTime() - new Date(c.created_at).getTime()) / 1000
    : (now - new Date(c.created_at).getTime()) / 1000
  const resolveSecs = c.closed_at ? (new Date(c.closed_at).getTime() - new Date(c.created_at).getTime()) / 1000 : null
  const firstPct = (firstSecs / (targets.first * 60)) * 100
  const statusValue = c.lane === 'closed' ? 'closed' : c.lane === 'snoozed' ? 'snoozed' : c.escalated_at ? 'escalated' : c.requires_reply ? 'awaiting' : 'waiting'

  return (
    <div className="space-y-2.5">
      <Panel className="overflow-hidden">
        <div className="px-3.5 pb-3 pt-3.5">
          <div className="flex items-center justify-between">
            <h3 className="text-[13px] font-semibold text-slate-900 lg:text-[10.5px]">Contact details</h3>
            {can.editContact && contact ? <button type="button" onClick={() => openFox({ tab: 'contacts', contactId: contact.id })} className="text-[12px] font-medium text-[#1769ff] hover:underline lg:text-[10px]">Edit</button> : null}
          </div>
          <div className="mt-3 flex gap-3">
            <Avatar name={c.contact_name ?? c.sender_name} src={contact?.avatar_url ?? c.contact_avatar ?? c.sender_avatar} size={36} />
            <div className="min-w-0 space-y-0.5 text-[12px] text-slate-500 lg:text-[9.5px]">
              <p className="text-[13px] font-semibold text-slate-900 lg:text-[11px]">{c.contact_name ?? c.sender_name}</p>
              {contact?.email ?? c.contact_email ? <p className="truncate">{contact?.email ?? c.contact_email}</p> : null}
              {contact?.phone ?? c.contact_phone ? <p>{contact?.phone ?? c.contact_phone}</p> : null}
              {contact?.location ? <p>{contact.location}</p> : null}
            </div>
          </div>
          {contact ? (
            <button type="button" onClick={() => openFox({ tab: 'contacts', contactId: contact.id })} className="mt-3 flex items-center gap-1.5 text-[12px] font-medium text-[#1769ff] hover:underline lg:text-[10px]">
              View full profile <ArrowRight size={12} aria-hidden />
            </button>
          ) : <p className="mt-3 text-[11px] text-slate-400">Not linked to a contact yet.</p>}
        </div>
        <div className="border-t border-[#eef1f6] px-3.5 pb-3.5 pt-3">
          <h3 className="text-[13px] font-semibold text-slate-900 lg:text-[10.5px]">Assignment</h3>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div>
              <p className="mb-1 text-[11px] text-slate-500 lg:text-[9px]">Assign to</p>
              <div className="relative">
                <Users size={12} className="pointer-events-none absolute left-2.5 top-1/2 z-10 -translate-y-1/2 text-slate-600" aria-hidden />
                <Select label="Team" value={c.team_id ?? ''} onChange={v => run(() => assignConversations({ threadIds: [c.id], teamId: v || null }), 'Team updated')}
                  className="h-9 w-full appearance-none rounded-lg border border-[#e6ebf2] bg-white pl-7 pr-6 text-[12px] text-slate-700 disabled:opacity-60 lg:h-[29px] lg:text-[10px]"
                  options={[['', 'No team'], ...teams.map(t => [t.id, t.name] as [string, string])]} />
              </div>
            </div>
            <div>
              <p className="mb-1 text-[11px] text-slate-500 lg:text-[9px]">Owner</p>
              <div className="relative">
                <span className="pointer-events-none absolute left-2 top-1/2 z-10 -translate-y-1/2">
                  {c.assigned_to ? <Avatar name={c.assignee_name} src={c.assignee_avatar} size={16} /> : <UserRound size={12} className="text-slate-500" aria-hidden />}
                </span>
                <Select label="Owner" value={c.assigned_to ?? ''} onChange={v => run(() => assignConversations({ threadIds: [c.id], userId: v || null }), v ? 'Owner updated' : 'Unassigned')}
                  className="h-9 w-full appearance-none rounded-lg border border-[#e6ebf2] bg-white pl-7 pr-6 text-[12px] text-slate-700 lg:h-[29px] lg:text-[10px]"
                  options={[['', 'Unassigned'], ...members.map(m => [m.id, m.name] as [string, string])]} />
              </div>
            </div>
          </div>
          {!can.assign ? <p className="mt-1.5 text-[10px] text-slate-400">Your role can’t change assignment.</p> : null}
        </div>
      </Panel>

      <Panel className="px-3.5 py-3">
        <h3 className="text-[13px] font-semibold text-slate-900 lg:text-[10.5px]">SLA &amp; status</h3>
        <dl className="mt-2.5 space-y-2.5 text-[12px] text-slate-700 lg:text-[10px]">
          <div className="flex justify-between"><dt>SLA policy</dt><dd className="text-slate-600">{policy?.name ?? 'Default'}</dd></div>
          <div>
            <div className="flex justify-between"><dt>First response</dt><dd className="font-semibold text-slate-900">{c.first_response_at ? formatDuration(firstSecs) : `${formatDuration(firstSecs)} elapsed`}</dd></div>
            <div className="mt-1.5 flex items-center gap-2">
              <Progress value={firstPct} tone={firstPct > 100 ? 'red' : firstPct > 80 ? 'orange' : 'green'} />
              <span className="shrink-0 text-[10px] text-slate-400 lg:text-[8px]">Goal: {targets.first}m</span>
            </div>
          </div>
          <div>
            <div className="flex justify-between"><dt>Resolution</dt><dd className="font-semibold text-slate-900">{resolveSecs ? formatDuration(resolveSecs) : '–'}</dd></div>
            <div className="mt-1.5 flex items-center gap-2">
              <Progress value={resolveSecs ? (resolveSecs / (targets.resolve * 60)) * 100 : 0} />
              <span className="shrink-0 text-[10px] text-slate-400 lg:text-[8px]">Goal: {targets.resolve >= 60 ? `${Math.round(targets.resolve / 60)}h` : `${targets.resolve}m`}</span>
            </div>
          </div>
          <div className="flex items-center gap-4 pt-1">
            <dt>Status</dt>
            <dd>
              <Select label="Conversation status" value={statusValue}
                onChange={v => {
                  if (v === 'closed') run(() => updateConversations({ threadIds: [c.id], action: 'close' }), 'Conversation closed')
                  else if (v === 'snoozed') run(() => updateConversations({ threadIds: [c.id], action: 'snooze', snoozeMinutes: 1440 }), 'Snoozed until tomorrow')
                  else if (v === 'escalated') run(() => updateConversations({ threadIds: [c.id], action: 'escalate' }), 'Escalated')
                  else run(() => updateConversations({ threadIds: [c.id], action: 'reopen' }), 'Reopened')
                }}
                className="h-7 appearance-none rounded-md bg-violet-50 pl-2.5 pr-6 text-[12px] font-medium text-violet-600 focus:outline-none lg:h-[21px] lg:text-[9.5px]"
                options={[['awaiting', 'Awaiting reply'], ['waiting', 'Waiting on customer'], ['escalated', 'Escalated'], ['snoozed', 'Snoozed'], ['closed', 'Closed']]} />
            </dd>
          </div>
        </dl>
      </Panel>

      <Panel className="px-3.5 py-3">
        <h3 className="text-[13px] font-semibold text-slate-900 lg:text-[10.5px]">Tags</h3>
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {(c.tags ?? []).map(tag => (
            <span key={tag} className="group inline-flex">
              <Pill tone={tagTone(tag)} className="h-[22px] px-2 lg:h-[19px]">
                {tag}
                {can.tags ? <button type="button" aria-label={`Remove tag ${tag}`} className="ml-1 hidden group-hover:inline" onClick={() => run(() => updateTags({ threadIds: [c.id], remove: [tag] }), 'Tag removed')}><X size={9} /></button> : null}
              </Pill>
            </span>
          ))}
          {can.tags ? (tagInput === null ? (
            <button type="button" onClick={() => setTagInput('')} className="inline-flex h-[22px] items-center gap-1 rounded-md border border-[#e6ebf2] px-2 text-[11px] text-slate-600 hover:bg-slate-50 lg:h-[19px] lg:text-[9px]"><Plus size={10} aria-hidden />Add tag</button>
          ) : (
            <form onSubmit={e => { e.preventDefault(); const t = tagInput.trim(); setTagInput(null); if (t) run(() => updateTags({ threadIds: [c.id], add: [t] }), 'Tag added') }}>
              <label className="sr-only" htmlFor="rail-tag">New tag</label>
              <input id="rail-tag" autoFocus value={tagInput} maxLength={40} onChange={e => setTagInput(e.target.value)} onBlur={() => setTagInput(null)}
                className="h-[22px] w-24 rounded-md border border-blue-300 px-1.5 text-[11px] focus:outline-none" />
            </form>
          )) : null}
        </div>
      </Panel>

      <Panel className="px-3.5 py-3" id="thread-activity">
        <h3 className="text-[13px] font-semibold text-slate-900 lg:text-[10.5px]">Recent activity</h3>
        <ul className="mt-2.5 space-y-2">
          {(allActivity ? activity : activity.slice(0, 4)).map(a => (
            <li key={a.id} className="flex items-center justify-between gap-2 text-[12px] text-slate-600 lg:text-[9.5px]">
              <span className="flex min-w-0 items-center gap-2">
                <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border border-slate-400 text-slate-500" aria-hidden><Clock size={8} /></span>
                <span className="truncate">{a.summary}{a.actor_name && !a.summary.includes(a.actor_name) ? ` • ${a.actor_name}` : ''}</span>
              </span>
              <time className="shrink-0 text-[11px] text-slate-400 lg:text-[9px]" dateTime={a.created_at}>{formatClock(a.created_at, timezone)}</time>
            </li>
          ))}
          {!activity.length ? <li className="text-[12px] text-slate-400">No activity yet.</li> : null}
        </ul>
        {activity.length > 4 ? (
          <button type="button" onClick={() => setAllActivity(v => !v)} className="mt-2.5 flex items-center gap-1.5 text-[12px] font-medium text-[#1769ff] hover:underline lg:text-[10px]">
            {allActivity ? 'Show less' : 'View full activity'} <ArrowRight size={12} aria-hidden />
          </button>
        ) : null}
      </Panel>

      <Panel className="px-3.5 py-3">
        <h3 className="text-[13px] font-semibold text-slate-900 lg:text-[10.5px]">Routing actions</h3>
        <div className="mt-2.5 grid grid-cols-3 gap-2">
          <RailButton disabled={!can.assign || pending} onClick={() => run(() => applyRoutingRules([c.id]).then(r => r.ok && r.data?.routed === 0 ? { ok: false, error: 'No active routing rule matches this conversation.' } : r), 'Routed by rule')} icon={<ArrowRightLeft size={12} />}>Transfer</RailButton>
          <RailButton disabled={!can.snooze || pending} onClick={() => run(() => updateConversations({ threadIds: [c.id], action: 'snooze', snoozeMinutes: 240 }), 'Snoozed for 4 hours')} icon={<Clock size={12} />}>Snooze</RailButton>
          <RailButton danger disabled={!can.close || pending || c.lane === 'closed'} onClick={() => run(() => updateConversations({ threadIds: [c.id], action: 'close' }), 'Conversation closed')} icon={<CircleAlert size={12} />}>Close conversation</RailButton>
        </div>
        <div className="relative mt-2">
          <button type="button" onClick={() => setMore(v => !v)} aria-expanded={more} className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-[#e6ebf2] text-[12px] font-medium text-slate-700 hover:bg-slate-50 lg:h-[29px] lg:text-[10px]">
            More actions <MoreHorizontal size={12} aria-hidden />
          </button>
          {more ? (
            <div role="menu" className="absolute bottom-full left-0 right-0 z-20 mb-1 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
              {can.assign ? <MenuButton onClick={() => { setMore(false); run(() => updateConversations({ threadIds: [c.id], action: 'escalate' }), 'Escalated') }}>Escalate</MenuButton> : null}
              {can.tasks ? <MenuButton onClick={() => { setMore(false); run(() => createTaskFromConversation({ threadId: c.id }), 'Follow-up task created') }}>Create follow-up task</MenuButton> : null}
              <MenuButton onClick={() => { setMore(false); openFox({ tab: 'copilot', prompt: `/summarise conversation with ${c.contact_name ?? c.sender_name}`, threadId: c.id }) }}>Summarise with Fox AI</MenuButton>
              {c.lane !== 'open' && can.close ? <MenuButton onClick={() => { setMore(false); run(() => updateConversations({ threadIds: [c.id], action: 'reopen' }), 'Reopened') }}>Reopen</MenuButton> : null}
            </div>
          ) : null}
        </div>
        {error ? <p role="alert" className="mt-2 text-[11px] text-rose-600">{error}</p> : null}
        {notice ? <p role="status" className="mt-2 text-[11px] text-emerald-600">{notice}</p> : null}
      </Panel>
    </div>
  )
}

function RailButton({ children, icon, onClick, disabled, danger }: { children: React.ReactNode; icon: React.ReactNode; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={cn('flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border px-1 text-[12px] font-medium disabled:opacity-50 lg:h-[29px] lg:text-[9.5px]',
        danger ? 'border-rose-100 bg-rose-50 text-rose-600 hover:bg-rose-100' : 'border-[#e6ebf2] text-slate-700 hover:bg-slate-50')}>
      <span aria-hidden>{icon}</span>{children}
    </button>
  )
}

function MenuButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return <button type="button" role="menuitem" onClick={onClick} className="block w-full rounded-md px-2.5 py-1.5 text-left text-[12px] text-slate-700 hover:bg-slate-100">{children}</button>
}
