'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Search, Send, ArrowLeft, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { createClient } from '@/lib/supabase/client'
import { formatRelative, cn } from '@/lib/utils'
import type { InboxThread, InboxMessage } from '@/types/database'
import { listThreads, getThread, listMessages, sendMessage, assignThread, PLATFORM_EMOJI, STATUS_LABEL } from '@/lib/inbox/queries'

export function InboxTab({ workspaceId, userId, canAssign, initialThreadId }: { workspaceId: string; userId: string; canAssign: boolean; initialThreadId?: string | null }) {
  const sb = useRef(createClient()).current
  const [threads, setThreads] = useState<InboxThread[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<InboxThread | null>(null)
  const [messages, setMessages] = useState<InboxMessage[]>([])
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { threads: rows } = await listThreads(sb, workspaceId, { search: search || undefined }, { sort: 'newest', pageSize: 20 })
    setThreads(rows)
    setLoading(false)
  }, [sb, workspaceId, search])

  useEffect(() => { load() }, [load])

  const open = useCallback(async (t: InboxThread) => {
    setSelected(t)
    const { messages: msgs } = await listMessages(sb, t.id)
    setMessages(msgs)
  }, [sb])

  useEffect(() => {
    if (!initialThreadId) return
    getThread(sb, initialThreadId).then(({ thread }) => { if (thread) open(thread) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialThreadId])

  async function generateReply() {
    if (!selected) return
    setAiLoading(true)
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'caption', topic: `Draft a single helpful reply to: ${selected.content ?? selected.sender_name}`, count: 1, platform: selected.platform }),
      })
      if (res.ok) {
        const data = await res.json()
        const draft = Array.isArray(data.result) ? data.result[0] : data.result
        if (draft) setReplyText(draft)
      }
    } catch { /* ignore */ }
    setAiLoading(false)
  }

  async function send() {
    if (!replyText.trim() || !selected) return
    setSending(true)
    const { message } = await sendMessage(sb, { threadId: selected.id, workspaceId, content: replyText.trim(), senderType: 'internal', sentBy: userId })
    if (message) { setMessages(prev => [...prev, message]); setReplyText('') }
    setSending(false)
  }

  if (selected) {
    return (
      <div className="flex h-[560px] flex-col">
        <div className="flex items-center gap-2 border-b border-slate-100 p-3">
          <button onClick={() => setSelected(null)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><ArrowLeft size={15} /></button>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700">{selected.sender_name?.[0]?.toUpperCase() ?? '?'}</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-900">{selected.sender_name ?? 'Unknown'}</p>
            <p className="truncate text-xs text-slate-500">{PLATFORM_EMOJI[selected.platform] ?? ''} {selected.platform} · {STATUS_LABEL[selected.status]}</p>
          </div>
          {canAssign && !selected.assigned_to && (
            <Button size="xs" variant="secondary" onClick={async () => { const { thread } = await assignThread(sb, selected.id, userId); if (thread) setSelected(thread) }}>Assign to me</Button>
          )}
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto p-3">
          {messages.length === 0 ? (
            <div className="rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-700">{selected.content ?? 'No message content.'}</div>
          ) : messages.map(m => (
            <div key={m.id} className={cn('flex', (m.sender_type === 'internal' || m.sender_type === 'agent') ? 'justify-end' : 'justify-start')}>
              <div className={cn('max-w-[80%] rounded-xl px-3 py-2 text-sm', m.sender_type === 'internal' || m.sender_type === 'agent' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-800')}>{m.content}</div>
            </div>
          ))}
        </div>
        <div className="space-y-2 border-t border-slate-100 p-3">
          <Button variant="ai" size="xs" icon={<Wand2 size={12} />} loading={aiLoading} onClick={generateReply}>AI draft</Button>
          <div className="flex gap-2">
            <textarea value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Write a reply…" rows={2} className="flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm" />
            <button onClick={send} disabled={!replyText.trim() || sending} className="shrink-0 self-end rounded-xl bg-blue-600 p-2.5 text-white disabled:opacity-40"><Send size={14} /></button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-[560px] flex-col">
      <div className="border-b border-slate-100 p-3">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search conversations…" className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-sm" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <div key={i} className="flex gap-3 border-b border-slate-100 p-3"><Skeleton className="h-8 w-8 rounded-full" /><div className="flex-1 space-y-1.5"><Skeleton className="h-3 w-2/3" /><Skeleton className="h-3 w-full" /></div></div>)
        ) : threads.length === 0 ? (
          <EmptyState title="No conversations" description="New messages will appear here." compact />
        ) : threads.map(t => (
          <button key={t.id} onClick={() => open(t)} className="flex w-full gap-3 border-b border-slate-100 p-3 text-left hover:bg-slate-50">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm">{t.sender_name?.[0]?.toUpperCase() ?? '?'}</div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5"><span className="truncate text-sm font-medium text-slate-800">{t.sender_name ?? 'Unknown'}</span><span className="text-xs">{PLATFORM_EMOJI[t.platform] ?? ''}</span></div>
              <p className="truncate text-xs text-slate-500">{t.content ?? t.type}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="text-[11px] text-slate-400">{formatRelative(t.updated_at)}</span>
              <Badge variant={t.sla_state === 'breached' ? 'red' : 'slate'} className="!px-1.5 !py-0 text-[10px]">{STATUS_LABEL[t.status]}</Badge>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
