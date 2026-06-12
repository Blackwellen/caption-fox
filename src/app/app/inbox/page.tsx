'use client'

import { useState, useEffect } from 'react'
import { MessageSquare, AtSign, Mail, Star, CheckCheck, UserCheck, BookMarked, AlertTriangle, Send, Wand2, RefreshCw, Tag, ClipboardList, Archive, ChevronRight, Link2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Tabs } from '@/components/ui/Tabs'
import { Textarea } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { Skeleton } from '@/components/ui/Skeleton'
import { createClient } from '@/lib/supabase/client'
import { formatRelative, cn } from '@/lib/utils'
import type { InboxThread } from '@/types/database'

const TABS = [
  { id: 'unified', label: 'Unified Inbox' },
  { id: 'comments', label: 'Comments' },
  { id: 'mentions', label: 'Mentions' },
  { id: 'dms', label: 'DMs' },
  { id: 'reviews', label: 'Reviews' },
  { id: 'assignments', label: 'Assignments' },
  { id: 'saved-replies', label: 'Saved Replies' },
  { id: 'escalations', label: 'Escalations' },
  { id: 'done', label: 'Done' },
]

const PLATFORM_ICONS: Record<string, string> = {
  instagram: '📸', tiktok: '🎵', linkedin: '💼', facebook: '👥', x: '✕', youtube: '▶️',
}

const SENTIMENT_COLOR: Record<string, string> = {
  positive: 'bg-emerald-400', neutral: 'bg-slate-400', negative: 'bg-red-400',
}

export default function InboxPage() {
  const [tab, setTab] = useState('unified')
  const [threads, setThreads] = useState<InboxThread[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedThread, setSelectedThread] = useState<InboxThread | null>(null)
  const [replyText, setReplyText] = useState('')
  const [replyLoading, setReplyLoading] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [noChannels, setNoChannels] = useState(false)

  useEffect(() => { loadThreads() }, [tab])

  async function loadThreads() {
    setLoading(true)
    const sb = createClient()
    const typeMap: Record<string, string | null> = { comments: 'comment', mentions: 'mention', dms: 'dm', done: 'done', assignments: null, escalations: null }
    let query = sb.from('inbox_threads').select('*').order('updated_at', { ascending: false })
    if (tab === 'unified') query = query.not('status', 'eq', 'resolved')
    else if (tab === 'done') query = query.eq('status', 'resolved')
    else if (tab === 'escalations') query = query.eq('is_important', true)
    else if (typeMap[tab]) query = query.eq('thread_type', typeMap[tab])

    const { data } = await query
    const { data: channels } = await sb.from('social_channels').select('id').limit(1)
    setNoChannels(!channels || channels.length === 0)
    setThreads(data ?? [])
    setLoading(false)
  }

  async function generateReply() {
    if (!selectedThread) return
    setAiLoading(true)
    try {
      const res = await fetch('/api/ai/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: `Draft a friendly, professional reply to this message: "${selectedThread.author_name} said something"`, mode: 'inbox' }) })
      const data = await res.json()
      setReplyText(data.response ?? 'Thank you for reaching out! We\'ll get back to you shortly.')
    } catch { setReplyText('Thank you for reaching out! We\'ll get back to you shortly.') }
    setAiLoading(false)
  }

  async function sendReply() {
    if (!replyText.trim()) return
    setReplyLoading(true)
    // In production: this would call the social platform API
    // For now: mark as replied in audit log
    setReplyText('')
    setReplyLoading(false)
  }

  const filteredThreads = threads.filter(t => {
    if (tab === 'saved-replies' || tab === 'reviews') return false
    return true
  })

  return (
    <div className="p-6">
      <PageHeader title="Inbox" subtitle="Manage comments, mentions and messages across all channels.">
        <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={loadThreads}>Refresh</Button>
      </PageHeader>

      {noChannels && (
        <div className="mb-5 p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-3 text-sm text-blue-800">
          <Link2 size={16} className="shrink-0 text-blue-500" />
          <span>Connect your social channels in <a href="/app/settings?tab=channels" className="font-semibold underline">Settings → Channels</a> to start receiving messages.</span>
        </div>
      )}

      <Tabs tabs={TABS} active={tab} onChange={setTab} className="mb-6" />

      {tab === 'saved-replies' && <SavedRepliesTab />}
      {tab === 'reviews' && <EmptyState icon={Star} title="Review imports via integrations" description="Connect Google My Business or Trustpilot in Settings → Integrations." />}

      {tab !== 'saved-replies' && tab !== 'reviews' && (
        <div className="flex gap-4 h-[calc(100vh-280px)] min-h-80">
          {/* Thread list */}
          <div className="w-80 shrink-0 bg-white rounded-xl border border-slate-200 flex flex-col overflow-hidden">
            <div className="p-3 border-b border-slate-100">
              <input className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Search messages…" />
            </div>
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="p-3 border-b border-slate-100 flex gap-3">
                    <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                    <div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-2/3" /><Skeleton className="h-3 w-full" /></div>
                  </div>
                ))
              ) : filteredThreads.length === 0 ? (
                <EmptyState icon={MessageSquare} title="No messages" description={noChannels ? "Connect channels to start receiving messages" : "Your inbox is empty"} compact />
              ) : (
                filteredThreads.map(t => (
                  <button key={t.id} onClick={() => setSelectedThread(t)}
                    className={cn('w-full text-left p-3 border-b border-slate-100 hover:bg-slate-50 transition-colors flex gap-3', selectedThread?.id === t.id && 'bg-blue-50 border-l-2 border-l-blue-600')}
                  >
                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-sm shrink-0">
                      {t.author_name?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-sm font-medium text-slate-900 truncate">{t.author_name ?? 'Unknown'}</span>
                        <span className="text-xs">{PLATFORM_ICONS[t.platform] ?? '💬'}</span>
                        {t.sentiment && <span className={cn('w-2 h-2 rounded-full shrink-0', SENTIMENT_COLOR[t.sentiment] ?? 'bg-slate-400')} />}
                      </div>
                      <p className="text-xs text-slate-500 truncate">{t.author_handle ?? t.thread_type}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{formatRelative(t.updated_at)}</p>
                    </div>
                    {t.is_important && <Star size={12} className="text-amber-400 shrink-0 mt-1" />}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Conversation detail */}
          {selectedThread ? (
            <div className="flex-1 bg-white rounded-xl border border-slate-200 flex flex-col overflow-hidden">
              {/* Header */}
              <div className="p-4 border-b border-slate-100 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center font-medium">{selectedThread.author_name?.[0]?.toUpperCase() ?? '?'}</div>
                <div className="flex-1">
                  <p className="font-medium text-slate-900">{selectedThread.author_name ?? 'Unknown'}</p>
                  <p className="text-xs text-slate-500">{selectedThread.author_handle ?? ''} · {selectedThread.platform} · {formatRelative(selectedThread.updated_at)}</p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="xs" icon={<UserCheck size={12} />}>Assign</Button>
                  <Button variant="ghost" size="xs" icon={<Tag size={12} />}>Tag</Button>
                  <Button variant="ghost" size="xs" icon={<ClipboardList size={12} />}>Task</Button>
                  <Button variant="ghost" size="xs" icon={<Archive size={12} />}>Archive</Button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-sm shrink-0">{selectedThread.author_name?.[0]?.toUpperCase() ?? '?'}</div>
                  <div className="flex-1">
                    <div className="bg-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-slate-800 max-w-lg">
                      [Original message from {selectedThread.platform}. Connect channels to see real messages.]
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{formatRelative(selectedThread.updated_at)}</p>
                  </div>
                </div>
              </div>

              {/* Reply bar */}
              <div className="p-4 border-t border-slate-100 space-y-3">
                <div className="flex gap-2">
                  <Button variant="ai" size="xs" icon={<Wand2 size={12} />} loading={aiLoading} onClick={generateReply}>Generate Reply</Button>
                  <Button variant="ghost" size="xs">Improve Reply</Button>
                  <Button variant="ghost" size="xs">Saved Replies</Button>
                </div>
                <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 flex items-center gap-1.5">
                  <AlertTriangle size={12} className="shrink-0" />
                  Reply requires your review before sending publicly.
                </div>
                <div className="flex gap-2">
                  <Textarea value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Write a reply…" rows={2} className="flex-1" />
                  <Button onClick={sendReply} loading={replyLoading} disabled={!replyText.trim()} icon={<Send size={14} />} className="self-end">Send</Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 bg-white rounded-xl border border-slate-200 flex items-center justify-center">
              <EmptyState icon={MessageSquare} title="Select a conversation" description="Click a thread on the left to view and reply." />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function SavedRepliesTab() {
  const replies = [
    { id: 1, name: 'Thank you', content: 'Thank you so much for your kind words! We really appreciate your support. 💙', usage: 12 },
    { id: 2, name: 'Will investigate', content: 'We\'re sorry to hear about this issue. We\'re looking into it and will get back to you shortly.', usage: 5 },
    { id: 3, name: 'Link to support', content: 'For further assistance, please reach out to our support team at support@captionfox.com', usage: 3 },
  ]
  return (
    <div className="space-y-3">
      <div className="flex justify-end"><Button size="sm" icon={<BookMarked size={14} />}>Create Saved Reply</Button></div>
      {replies.map(r => (
        <div key={r.id} className="bg-white rounded-xl border border-slate-200 p-5 flex items-start gap-4">
          <div className="flex-1">
            <p className="font-medium text-slate-900">{r.name}</p>
            <p className="text-sm text-slate-500 mt-1">{r.content}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-slate-400">Used {r.usage}×</span>
            <Button variant="ghost" size="xs">Edit</Button>
            <Button variant="ghost" size="xs">Delete</Button>
          </div>
        </div>
      ))}
    </div>
  )
}
