'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import {
  Search, RefreshCw, Star, Send, Wand2, AlertTriangle, UserCheck, Tag,
  Archive, ChevronRight, ChevronDown, MessageSquare, Filter, X,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { createClient } from '@/lib/supabase/client'
import { formatRelative, cn } from '@/lib/utils'
import type { InboxThread, InboxMessage, SavedReply } from '@/types/database'
import {
  listThreads, getThread, listMessages, sendMessage, assignThread, updateThread,
  listSavedReplies, slaMinutesRemaining, PLATFORM_EMOJI, STATUS_LABEL, PRIORITY_LABEL,
  type ThreadFilters, type ThreadSort,
} from '@/lib/inbox/queries'

const SENTIMENT_COLOR: Record<string, string> = { positive: 'bg-emerald-400', neutral: 'bg-slate-400', negative: 'bg-red-400' }
const STATUS_OPTIONS = ['open', 'assigned', 'resolved', 'spam', 'done']
const PRIORITY_OPTIONS = ['low', 'normal', 'high', 'urgent']

export type InboxScope = 'unified' | 'assignments' | 'unassigned'

interface Member { id: string; full_name: string | null; email: string }

export function InboxThreePane({
  workspaceId, currentUserId, canReply, canAssign, scope, baseFilters, savedViewFilters,
}: {
  workspaceId: string
  currentUserId: string
  canReply: boolean
  canAssign: boolean
  scope: InboxScope
  /** Filters that define this page's scope and cannot be cleared by the user (e.g. assignedTo: 'unassigned'). */
  baseFilters: ThreadFilters
  /** Optional filters applied from a Saved View / query params, layered on top of baseFilters. */
  savedViewFilters?: ThreadFilters
}) {
  const [threads, setThreads] = useState<InboxThread[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const pageSize = 25

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<string[]>(['open', 'assigned'])
  const [priority, setPriority] = useState<string[]>([])
  const [sort, setSort] = useState<ThreadSort>('newest')
  const [filtersOpen, setFiltersOpen] = useState(false)

  const [selected, setSelected] = useState<InboxThread | null>(null)
  const [messages, setMessages] = useState<InboxMessage[]>([])
  const [threadLoading, setThreadLoading] = useState(false)

  const [replyText, setReplyText] = useState('')
  const [replyMode, setReplyMode] = useState<'reply' | 'note'>('reply')
  const [sending, setSending] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)

  const [members, setMembers] = useState<Member[]>([])
  const [assignOpen, setAssignOpen] = useState(false)
  const [savedReplies, setSavedReplies] = useState<SavedReply[]>([])
  const [savedRepliesOpen, setSavedRepliesOpen] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const sb = useRef(createClient()).current
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const deepLinkedThreadId = searchParams.get('thread')
  const didDeepLink = useRef(false)

  const effectiveFilters: ThreadFilters = {
    ...baseFilters,
    ...savedViewFilters,
    status: savedViewFilters?.status ?? (status.length ? status : undefined),
    priority: savedViewFilters?.priority ?? (priority.length ? priority : undefined),
    search: search || undefined,
  }

  const loadThreads = useCallback(async () => {
    setLoading(true)
    const { threads: rows, count: total } = await listThreads(sb, workspaceId, effectiveFilters, { sort, page, pageSize, currentUserId })
    setThreads(rows)
    setCount(total)
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, JSON.stringify(effectiveFilters), sort, page, currentUserId])

  useEffect(() => { loadThreads() }, [loadThreads])

  useEffect(() => {
    sb.from('workspace_members').select('user_id, profiles(id, full_name, email)').eq('workspace_id', workspaceId).then(({ data }) => {
      const rows = (data ?? []) as unknown as { user_id: string; profiles: { id: string; full_name: string | null; email: string } | { id: string; full_name: string | null; email: string }[] }[]
      setMembers(rows.map(r => {
        const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles
        return { id: r.user_id, full_name: p?.full_name ?? null, email: p?.email ?? '' }
      }))
    })
    listSavedReplies(sb, workspaceId).then(({ replies }) => setSavedReplies(replies))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId])

  const openThread = useCallback(async (t: InboxThread) => {
    setSelected(t)
    setThreadLoading(true)
    router.replace(`${pathname}?thread=${t.id}`, { scroll: false })
    const [{ thread }, { messages: msgs }] = await Promise.all([getThread(sb, t.id), listMessages(sb, t.id)])
    setSelected(thread ?? t)
    setMessages(msgs)
    setThreadLoading(false)
    if (!t.is_read) await updateThread(sb, t.id, { is_read: true })
  }, [sb, router, pathname])

  // Deep-link support: open a thread by id from ?thread=<id> once threads have loaded.
  useEffect(() => {
    if (didDeepLink.current || !deepLinkedThreadId || loading) return
    didDeepLink.current = true
    const existing = threads.find(t => t.id === deepLinkedThreadId)
    if (existing) openThread(existing)
    else getThread(sb, deepLinkedThreadId).then(({ thread }) => { if (thread) openThread(thread) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkedThreadId, loading, threads])

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function refreshSelected() {
    if (!selected) return
    const { thread } = await getThread(sb, selected.id)
    if (thread) setSelected(thread)
    loadThreads()
  }

  async function doAssign(userId: string | null) {
    if (!selected) return
    setAssignOpen(false)
    const { thread } = await assignThread(sb, selected.id, userId)
    if (thread) setSelected(thread)
    loadThreads()
  }

  async function doStatusChange(next: string) {
    if (!selected) return
    const patch: Partial<InboxThread> = { status: next }
    if (next === 'resolved') patch.resolved_at = new Date().toISOString()
    const { thread } = await updateThread(sb, selected.id, patch)
    if (thread) setSelected(thread)
    loadThreads()
  }

  async function doPriorityChange(next: string) {
    if (!selected) return
    const { thread } = await updateThread(sb, selected.id, { priority: next })
    if (thread) setSelected(thread)
  }

  async function toggleFlag() {
    if (!selected) return
    const { thread } = await updateThread(sb, selected.id, { is_flagged: !selected.is_flagged })
    if (thread) setSelected(thread)
  }

  async function generateReply() {
    if (!selected) return
    setAiLoading(true)
    try {
      const context = messages.length
        ? messages.slice(-6).map(m => `${m.sender_type === 'external' ? (selected.sender_name ?? 'Customer') : 'Agent'}: ${m.content}`).join('\n')
        : `${selected.sender_name ?? 'Customer'} sent: ${selected.content ?? ''}`
      const res = await fetch('/api/ai/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'caption', topic: `Draft a single helpful, professional reply to this conversation:\n\n${context}`, count: 1, platform: selected.platform }),
      })
      if (res.ok) {
        const data = await res.json()
        const result = data.result
        const draft = Array.isArray(result) ? result[0] : (typeof result === 'string' ? result : '')
        if (draft) setReplyText(draft)
      }
    } catch { /* leave textarea for manual entry */ }
    setAiLoading(false)
  }

  async function doSend() {
    if (!replyText.trim() || !selected) return
    setSending(true)
    const { message } = await sendMessage(sb, {
      threadId: selected.id, workspaceId, content: replyText.trim(),
      senderType: replyMode === 'note' ? 'internal' : 'internal',
      sentBy: currentUserId, isInternalNote: replyMode === 'note',
    })
    if (message) {
      setMessages(prev => [...prev, message])
      setReplyText('')
      if (replyMode === 'reply' && !selected.first_response_at) {
        await updateThread(sb, selected.id, { first_response_at: new Date().toISOString() })
      }
      await refreshSelected()
    }
    setSending(false)
  }

  const title = scope === 'assignments' ? 'Assignments' : scope === 'unassigned' ? 'Unassigned' : 'Unified Inbox'

  return (
    <div className="flex h-[calc(100vh-280px)] min-h-[560px] gap-4">
      {/* Thread list */}
      <div className="flex w-80 shrink-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white lg:w-96">
        <div className="space-y-2 border-b border-slate-100 p-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
                placeholder="Search conversations…"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <Button variant="secondary" size="sm" icon={<Filter size={13} />} onClick={() => setFiltersOpen(v => !v)} />
          </div>
          {filtersOpen && (
            <div className="space-y-2 rounded-lg border border-slate-100 bg-slate-50 p-2.5">
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Status</p>
                <div className="flex flex-wrap gap-1">
                  {STATUS_OPTIONS.map(s => (
                    <button
                      key={s}
                      onClick={() => { setStatus(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]); setPage(1) }}
                      className={cn('rounded-full px-2 py-0.5 text-xs font-medium transition-colors', status.includes(s) ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-200')}
                    >
                      {STATUS_LABEL[s]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Priority</p>
                <div className="flex flex-wrap gap-1">
                  {PRIORITY_OPTIONS.map(p => (
                    <button
                      key={p}
                      onClick={() => { setPriority(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]); setPage(1) }}
                      className={cn('rounded-full px-2 py-0.5 text-xs font-medium transition-colors', priority.includes(p) ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-200')}
                    >
                      {PRIORITY_LABEL[p]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Sort</p>
                <select value={sort} onChange={e => setSort(e.target.value as ThreadSort)} className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-xs">
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                  <option value="priority">Priority</option>
                  <option value="sla">SLA</option>
                </select>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex gap-3 border-b border-slate-100 p-3">
                <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-2/3" /><Skeleton className="h-3 w-full" /></div>
              </div>
            ))
          ) : threads.length === 0 ? (
            <EmptyState icon={MessageSquare} title="No conversations" description={scope === 'unassigned' ? 'Everything is assigned — nice work.' : 'Nothing matches your current filters.'} compact />
          ) : (
            threads.map(t => (
              <button
                key={t.id}
                onClick={() => openThread(t)}
                className={cn('flex w-full gap-3 border-b border-slate-100 p-3 text-left transition-colors hover:bg-slate-50', selected?.id === t.id && 'border-l-2 border-l-blue-600 bg-blue-50')}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-medium">
                  {t.sender_name?.[0]?.toUpperCase() ?? '?'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-0.5 flex items-center gap-1.5">
                    <span className={cn('truncate text-sm', t.is_read ? 'font-medium text-slate-800' : 'font-semibold text-slate-900')}>{t.sender_name ?? 'Unknown'}</span>
                    <span className="text-xs">{PLATFORM_EMOJI[t.platform] ?? '💬'}</span>
                    {t.sentiment && <span className={cn('h-2 w-2 shrink-0 rounded-full', SENTIMENT_COLOR[t.sentiment])} />}
                  </div>
                  <p className="truncate text-xs text-slate-500">{t.content ?? t.sender_handle ?? t.type}</p>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className="text-[11px] text-slate-400">{formatRelative(t.updated_at)}</span>
                    <Badge variant={t.sla_state === 'breached' ? 'red' : t.sla_state === 'warning' ? 'amber' : 'slate'} className="!px-1.5 !py-0 text-[10px]">
                      {STATUS_LABEL[t.status] ?? t.status}
                    </Badge>
                  </div>
                </div>
                {t.is_flagged && <Star size={12} className="mt-1 shrink-0 text-amber-400" />}
              </button>
            ))
          )}
        </div>

        {count > pageSize && (
          <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
            <span>Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, count)} of {count}</span>
            <div className="flex gap-1">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="rounded px-1.5 py-0.5 disabled:opacity-30 hover:bg-slate-100">Prev</button>
              <button disabled={page * pageSize >= count} onClick={() => setPage(p => p + 1)} className="rounded px-1.5 py-0.5 disabled:opacity-30 hover:bg-slate-100">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Conversation detail */}
      {!selected ? (
        <div className="flex flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white">
          <EmptyState icon={MessageSquare} title="Select a conversation" description="Click a thread on the left to view and reply." />
        </div>
      ) : (
        <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center gap-3 border-b border-slate-100 p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700">{selected.sender_name?.[0]?.toUpperCase() ?? '?'}</div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-slate-900">{selected.sender_name ?? 'Unknown'}</p>
              <p className="truncate text-xs text-slate-500">{selected.sender_handle ?? ''} · {selected.platform} · {formatRelative(selected.updated_at)}</p>
            </div>
            <div className="flex gap-1">
              {canAssign && (
                <div className="relative">
                  <Button variant="ghost" size="xs" icon={<UserCheck size={12} />} onClick={() => setAssignOpen(v => !v)}>Assign</Button>
                  {assignOpen && (
                    <div className="absolute right-0 top-full z-20 mt-1 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                      <button onClick={() => doAssign(currentUserId)} className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50">Assign to me</button>
                      {members.filter(m => m.id !== currentUserId).map(m => (
                        <button key={m.id} onClick={() => doAssign(m.id)} className="w-full truncate px-3 py-2 text-left text-sm hover:bg-slate-50">{m.full_name ?? m.email}</button>
                      ))}
                      {selected.assigned_to && <button onClick={() => doAssign(null)} className="w-full border-t border-slate-100 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50">Unassign</button>}
                    </div>
                  )}
                </div>
              )}
              <Button variant="ghost" size="xs" icon={<Star size={12} className={selected.is_flagged ? 'fill-amber-400 text-amber-400' : ''} />} onClick={toggleFlag}>Flag</Button>
              <Button variant="ghost" size="xs" icon={<Archive size={12} />} onClick={() => doStatusChange('done')}>Close</Button>
            </div>
          </div>

          <div className="flex items-center gap-4 border-b border-slate-100 px-4 py-2 text-xs">
            <label className="flex items-center gap-1.5 text-slate-500">Status
              <select value={selected.status} onChange={e => doStatusChange(e.target.value)} className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 font-medium text-slate-800">
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-1.5 text-slate-500">Priority
              <select value={selected.priority} onChange={e => doPriorityChange(e.target.value)} className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 font-medium text-slate-800">
                {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
              </select>
            </label>
            {(() => { const rem = slaMinutesRemaining(selected); return rem !== null && (
              <span className={cn('ml-auto flex items-center gap-1 font-medium', rem < 0 ? 'text-red-600' : rem < 30 ? 'text-amber-600' : 'text-emerald-600')}>
                <AlertTriangle size={11} /> {rem < 0 ? `SLA breached ${Math.abs(rem)}m ago` : `${rem}m to SLA`}
              </span>
            ) })()}
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {threadLoading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-2/3 rounded-2xl" />)
            ) : messages.length === 0 ? (
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm">{selected.sender_name?.[0]?.toUpperCase() ?? '?'}</div>
                <div className="max-w-lg rounded-2xl rounded-tl-sm bg-slate-100 px-4 py-3 text-sm text-slate-800">{selected.content ?? 'No message content.'}</div>
              </div>
            ) : (
              messages.map(m => {
                const isInternal = m.sender_type === 'internal' || m.sender_type === 'agent'
                return (
                  <div key={m.id} className={cn('flex gap-3', isInternal && 'flex-row-reverse')}>
                    <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center self-end rounded-full text-xs font-bold', isInternal ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600')}>
                      {isInternal ? 'Y' : (selected.sender_name?.[0]?.toUpperCase() ?? '?')}
                    </div>
                    <div className={cn('flex max-w-[70%] flex-col gap-1', isInternal && 'items-end')}>
                      <div className={cn('px-4 py-3 text-sm leading-relaxed', m.is_internal_note ? 'rounded-2xl border border-amber-200 bg-amber-50 text-amber-900' : isInternal ? 'rounded-2xl rounded-br-sm bg-blue-600 text-white' : 'rounded-2xl rounded-bl-sm bg-slate-100 text-slate-800')}>
                        {m.is_internal_note && <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide opacity-70">Internal note</span>}
                        {m.content}
                      </div>
                      <p className="px-1 text-[11px] text-slate-400">{formatRelative(m.sent_at)}</p>
                    </div>
                  </div>
                )
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {canReply && (
            <div className="space-y-2 border-t border-slate-100 p-4">
              <div className="flex items-center gap-2">
                <button onClick={() => setReplyMode('reply')} className={cn('rounded-lg px-2.5 py-1 text-xs font-medium', replyMode === 'reply' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600')}>Reply</button>
                <button onClick={() => setReplyMode('note')} className={cn('rounded-lg px-2.5 py-1 text-xs font-medium', replyMode === 'note' ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600')}>Internal note</button>
                <span className="mx-1 h-4 w-px bg-slate-200" />
                <Button variant="ai" size="xs" icon={<Wand2 size={12} />} loading={aiLoading} onClick={generateReply}>Generate Reply</Button>
                <div className="relative">
                  <Button variant="ghost" size="xs" onClick={() => setSavedRepliesOpen(v => !v)}>Saved Replies</Button>
                  {savedRepliesOpen && (
                    <div className="absolute left-0 top-full z-20 mt-1 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                      {savedReplies.length === 0 ? <p className="px-4 py-3 text-xs text-slate-400">No saved replies yet.</p> : savedReplies.map(r => (
                        <button key={r.id} onClick={() => { setReplyText(r.content); setSavedRepliesOpen(false) }} className="w-full border-b border-slate-100 px-4 py-3 text-left last:border-b-0 hover:bg-slate-50">
                          <p className="text-sm font-medium text-slate-800">{r.title}</p>
                          <p className="mt-0.5 truncate text-xs text-slate-400">{r.content}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {replyMode === 'reply' && (
                <div className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  <AlertTriangle size={12} className="shrink-0" /> Reply requires your review before sending.
                </div>
              )}
              <div className="flex gap-2">
                <textarea value={replyText} onChange={e => setReplyText(e.target.value)} placeholder={replyMode === 'note' ? 'Add an internal note (never sent to the customer)…' : 'Write a reply…'} rows={2} className="flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <Button onClick={doSend} loading={sending} disabled={!replyText.trim()} icon={<Send size={14} />} className="self-end">Send</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Right rail */}
      {selected && <InboxRightRail thread={selected} members={members} onAssign={doAssign} canAssign={canAssign} />}
    </div>
  )
}

function InboxRightRail({ thread, members, onAssign, canAssign }: { thread: InboxThread; members: Member[]; onAssign: (id: string | null) => void; canAssign: boolean }) {
  const [newTag, setNewTag] = useState('')
  const sb = useRef(createClient()).current
  const [tags, setTags] = useState(thread.tags)
  useEffect(() => { setTags(thread.tags) }, [thread.id, thread.tags])

  async function addTag() {
    if (!newTag.trim()) return
    const next = [...new Set([...tags, newTag.trim()])]
    setTags(next)
    setNewTag('')
    await updateThread(sb, thread.id, { tags: next })
  }

  const assignee = members.find(m => m.id === thread.assigned_to)
  const rem = slaMinutesRemaining(thread)

  return (
    <aside className="hidden w-72 shrink-0 space-y-5 overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 xl:block">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Contact details</p>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700">{thread.sender_name?.[0]?.toUpperCase() ?? '?'}</div>
          <div className="min-w-0">
            <p className="truncate font-medium text-slate-900">{thread.sender_name ?? 'Unknown'}</p>
            <p className="truncate text-xs text-slate-500">{thread.sender_handle ?? '—'}</p>
          </div>
        </div>
      </div>

      {canAssign && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Assignment</p>
          <select value={thread.assigned_to ?? ''} onChange={e => onAssign(e.target.value || null)} className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm">
            <option value="">Unassigned</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.full_name ?? m.email}</option>)}
          </select>
          {assignee && <p className="mt-1 text-xs text-slate-400">Currently: {assignee.full_name ?? assignee.email}</p>}
        </div>
      )}

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">SLA & status</p>
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between"><span className="text-slate-500">SLA state</span><Badge variant={thread.sla_state === 'breached' ? 'red' : thread.sla_state === 'warning' ? 'amber' : 'green'}>{thread.sla_state}</Badge></div>
          <div className="flex justify-between"><span className="text-slate-500">Target</span><span className="font-medium">{thread.sla_target_minutes}m</span></div>
          {rem !== null && <div className="flex justify-between"><span className="text-slate-500">Remaining</span><span className={cn('font-medium', rem < 0 ? 'text-red-600' : 'text-slate-800')}>{rem}m</span></div>}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Tags</p>
        <div className="mb-2 flex flex-wrap gap-1">
          {tags.map(t => <Badge key={t} variant="blue">{t}</Badge>)}
          {tags.length === 0 && <span className="text-xs text-slate-400">No tags yet</span>}
        </div>
        <div className="flex gap-1">
          <input value={newTag} onChange={e => setNewTag(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTag()} placeholder="Add tag…" className="flex-1 rounded-lg border border-slate-200 px-2 py-1 text-xs" />
          <button onClick={addTag} className="rounded-lg border border-slate-200 px-2 text-xs hover:bg-slate-50"><Tag size={12} /></button>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Details</p>
        <div className="space-y-1 text-xs text-slate-500">
          <div className="flex justify-between"><span>Type</span><span className="font-medium text-slate-700 capitalize">{thread.type}</span></div>
          <div className="flex justify-between"><span>Platform</span><span className="font-medium capitalize text-slate-700">{PLATFORM_EMOJI[thread.platform] ?? ''} {thread.platform}</span></div>
          <div className="flex justify-between"><span>Created</span><span className="font-medium text-slate-700">{formatRelative(thread.created_at)}</span></div>
          {thread.external_post_url && <a href={thread.external_post_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 pt-1 text-blue-600 hover:underline"><ChevronRight size={11} /> View original post</a>}
        </div>
      </div>
    </aside>
  )
}
