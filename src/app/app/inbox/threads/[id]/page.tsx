'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  ArrowLeft, Send, Wand2, AlertTriangle, ExternalLink, BookMarked,
  User, MessageSquare, AtSign, ChevronDown, CheckCircle2, XCircle,
  Clock, UserCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal, ConfirmModal } from '@/components/ui/Modal'
import { createClient } from '@/lib/supabase/client'
import { formatRelative, formatDate, cn } from '@/lib/utils'
import type { InboxThread, SocialChannel } from '@/types/database'

// ------------------------------------------------------------------
// Local types (inbox_messages is not in the shared type file yet)
// ------------------------------------------------------------------
interface InboxMessage {
  id: string
  thread_id: string
  sender_type: 'external' | 'internal' | 'agent'
  sender_name: string | null
  body: string
  sent_at: string
}

interface SavedReply {
  id: string
  name: string
  content: string
}

// ------------------------------------------------------------------
// Platform helpers
// ------------------------------------------------------------------
const PLATFORM_EMOJI: Record<string, string> = {
  instagram: '📸', tiktok: '🎵', linkedin: '💼',
  facebook: '👥', x: '✕', youtube: '▶️',
}

const SENTIMENT_BADGE: Record<string, { label: string; variant: 'green' | 'amber' | 'red' | 'slate' }> = {
  positive: { label: 'Positive', variant: 'green' },
  neutral:  { label: 'Neutral',  variant: 'slate' },
  negative: { label: 'Negative', variant: 'red'   },
}

const STATUS_OPTIONS = [
  { value: 'open',     label: 'Open',     icon: Clock,        color: 'text-blue-600' },
  { value: 'resolved', label: 'Resolved', icon: CheckCircle2, color: 'text-emerald-600' },
  { value: 'spam',     label: 'Spam',     icon: XCircle,      color: 'text-red-500' },
]

// ------------------------------------------------------------------
// Page
// ------------------------------------------------------------------
export default function ThreadDetailPage({ params }: { params: { id: string } }) {
  const threadId = params.id

  const [thread, setThread]             = useState<InboxThread | null>(null)
  const [channel, setChannel]           = useState<SocialChannel | null>(null)
  const [messages, setMessages]         = useState<InboxMessage[]>([])
  const [loading, setLoading]           = useState(true)
  const [notFound, setNotFound]         = useState(false)

  // Composer state
  const [replyText, setReplyText]       = useState('')
  const [sending, setSending]           = useState(false)
  const [aiLoading, setAiLoading]       = useState(false)
  const [showConfirm, setShowConfirm]   = useState(false)

  // Saved replies
  const [savedReplies, setSavedReplies] = useState<SavedReply[]>([])
  const [showSavedMenu, setShowSavedMenu] = useState(false)

  // Status dropdown
  const [statusOpen, setStatusOpen]     = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  // Assign to me
  const [assigningMe, setAssigningMe]   = useState(false)

  // Stripe-redirect info modal (reused for billing)
  const [stripeModal, setStripeModal]   = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const savedMenuRef   = useRef<HTMLDivElement>(null)

  // ------------------------------------------------------------------
  // Load thread + messages
  // ------------------------------------------------------------------
  const loadThread = useCallback(async () => {
    setLoading(true)
    const sb = createClient()

    const { data: threadData, error } = await sb
      .from('inbox_threads')
      .select('*')
      .eq('id', threadId)
      .single()

    if (error || !threadData) {
      setNotFound(true)
      setLoading(false)
      return
    }
    setThread(threadData)

    // Load channel info
    if (threadData.channel_id) {
      const { data: ch } = await sb
        .from('social_channels')
        .select('*')
        .eq('id', threadData.channel_id)
        .single()
      setChannel(ch ?? null)
    }

    // Load messages
    const { data: msgs } = await sb
      .from('inbox_messages')
      .select('*')
      .eq('thread_id', threadId)
      .order('sent_at', { ascending: true })
    setMessages((msgs as InboxMessage[]) ?? [])

    // Load saved replies (workspace-wide)
    const { data: replies } = await sb
      .from('saved_replies')
      .select('id, name, content')
      .order('name')
    setSavedReplies((replies as SavedReply[]) ?? [])

    setLoading(false)
  }, [threadId])

  useEffect(() => { loadThread() }, [loadThread])

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Close saved menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (savedMenuRef.current && !savedMenuRef.current.contains(e.target as Node)) {
        setShowSavedMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // ------------------------------------------------------------------
  // Actions
  // ------------------------------------------------------------------
  async function updateStatus(status: string) {
    if (!thread) return
    setUpdatingStatus(true)
    setStatusOpen(false)
    const sb = createClient()
    const { error } = await sb
      .from('inbox_threads')
      .update({ status })
      .eq('id', thread.id)
    if (!error) setThread(prev => prev ? { ...prev, status } : prev)
    setUpdatingStatus(false)
  }

  async function assignToMe() {
    if (!thread) return
    setAssigningMe(true)
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (user) {
      const { error } = await sb
        .from('inbox_threads')
        .update({ assignee_id: user.id })
        .eq('id', thread.id)
      if (!error) setThread(prev => prev ? { ...prev, assignee_id: user.id } : prev)
    }
    setAssigningMe(false)
  }

  async function draftWithAI() {
    if (!thread) return
    setAiLoading(true)
    try {
      const contextText = messages.length > 0
        ? messages.map(m => `${m.sender_type === 'external' ? thread.author_name ?? 'User' : 'Agent'}: ${m.body}`).join('\n')
        : `${thread.author_name ?? 'User'} sent a ${thread.thread_type} on ${thread.platform}`

      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'caption',
          topic: `Draft a single helpful, professional reply to this conversation:\n\n${contextText}`,
          count: 1,
          platform: thread.platform,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        const result = data.result
        const draft = Array.isArray(result) ? result[0] : (typeof result === 'string' ? result : '')
        if (draft) setReplyText(draft)
      }
    } catch {
      // non-critical; leave textarea blank so user can still type
    }
    setAiLoading(false)
  }

  async function doSend() {
    if (!replyText.trim() || !thread) return
    setSending(true)
    setShowConfirm(false)
    const sb = createClient()

    const { data: newMsg, error } = await sb
      .from('inbox_messages')
      .insert({
        thread_id: thread.id,
        sender_type: 'internal',
        sender_name: 'You',
        body: replyText.trim(),
        sent_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (!error && newMsg) {
      setMessages(prev => [...prev, newMsg as InboxMessage])
      setReplyText('')
      // Mark thread as open (replied) if it was resolved
      if (thread.status !== 'open') {
        await updateStatus('open')
      } else {
        // Bump updated_at
        await sb.from('inbox_threads').update({ updated_at: new Date().toISOString() }).eq('id', thread.id)
      }
    }
    setSending(false)
  }

  // ------------------------------------------------------------------
  // Skeleton loading
  // ------------------------------------------------------------------
  if (loading) {
    return (
      <div className="flex h-[calc(100vh-64px)] overflow-hidden">
        {/* Left sidebar skeleton */}
        <div className="w-[280px] shrink-0 bg-white border-r border-slate-200 p-5 space-y-4">
          <Skeleton className="h-4 w-24" />
          <div className="space-y-2">
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-px w-full" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-6 w-full" />
            </div>
          ))}
        </div>
        {/* Main area skeleton */}
        <div className="flex-1 flex flex-col bg-white overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-56" />
            </div>
          </div>
          <div className="flex-1 p-5 space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className={cn('flex gap-3', i % 2 === 1 && 'flex-row-reverse')}>
                <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                <Skeleton className={cn('h-16 rounded-2xl', i % 2 === 1 ? 'w-64' : 'w-80')} />
              </div>
            ))}
          </div>
          <div className="p-4 border-t border-slate-200 space-y-3">
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-9 w-24 ml-auto" />
          </div>
        </div>
      </div>
    )
  }

  // ------------------------------------------------------------------
  // Not found
  // ------------------------------------------------------------------
  if (notFound || !thread) {
    return (
      <div className="p-6">
        <a href="/app/inbox" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6">
          <ArrowLeft size={14} /> Back to Inbox
        </a>
        <EmptyState
          icon={MessageSquare}
          title="Thread not found"
          description="This conversation may have been deleted or you don't have access to it."
          action={{ label: 'Back to Inbox', onClick: () => { window.location.href = '/app/inbox' } }}
        />
      </div>
    )
  }

  const currentStatusOption = STATUS_OPTIONS.find(s => s.value === thread.status) ?? STATUS_OPTIONS[0]
  const sentimentInfo = thread.sentiment ? SENTIMENT_BADGE[thread.sentiment] : null

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">

      {/* ============================================================
          LEFT SIDEBAR — Thread metadata
      ============================================================ */}
      <aside className="w-[280px] shrink-0 bg-white border-r border-slate-200 flex flex-col overflow-y-auto">

        {/* Back link */}
        <div className="px-4 pt-4 pb-3 border-b border-slate-100">
          <a
            href="/app/inbox"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-700 transition-colors"
          >
            <ArrowLeft size={13} /> Back to Inbox
          </a>
        </div>

        <div className="p-5 space-y-5">

          {/* Sender info */}
          <div className="flex flex-col items-center text-center gap-2">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-lg font-bold text-blue-700">
              {thread.author_name?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div>
              <p className="font-semibold text-slate-900 text-sm">
                {thread.author_name ?? 'Unknown Sender'}
              </p>
              {thread.author_handle && (
                <p className="text-xs text-slate-400 mt-0.5 flex items-center justify-center gap-1">
                  <AtSign size={11} /> {thread.author_handle}
                </p>
              )}
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Metadata rows */}
          <div className="space-y-3 text-xs">

            <MetaRow label="Platform">
              <span className="flex items-center gap-1.5 text-slate-700 font-medium capitalize">
                <span>{PLATFORM_EMOJI[thread.platform] ?? '💬'}</span>
                {thread.platform}
              </span>
            </MetaRow>

            <MetaRow label="Type">
              <Badge variant="blue">{thread.thread_type}</Badge>
            </MetaRow>

            {sentimentInfo && (
              <MetaRow label="Sentiment">
                <Badge variant={sentimentInfo.variant}>{sentimentInfo.label}</Badge>
              </MetaRow>
            )}

            {channel && (
              <MetaRow label="Channel">
                <span className="text-slate-700 font-medium">@{channel.platform_username}</span>
              </MetaRow>
            )}

            <MetaRow label="Assigned to">
              <span className="text-slate-500 italic">
                {thread.assignee_id ? 'Assigned' : 'Unassigned'}
              </span>
            </MetaRow>

            <MetaRow label="Created">
              <span className="text-slate-500">{formatDate(thread.created_at)}</span>
            </MetaRow>

          </div>

          <hr className="border-slate-100" />

          {/* Status selector */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Status</p>
            <div className="relative">
              <button
                onClick={() => setStatusOpen(v => !v)}
                disabled={updatingStatus}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm font-medium border border-slate-200 rounded-lg bg-white hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                <span className={cn('flex items-center gap-1.5', currentStatusOption.color)}>
                  <currentStatusOption.icon size={13} />
                  {currentStatusOption.label}
                </span>
                <ChevronDown size={12} className="text-slate-400" />
              </button>
              {statusOpen && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                  {STATUS_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => updateStatus(opt.value)}
                      className={cn(
                        'w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 transition-colors',
                        opt.color,
                        thread.status === opt.value && 'bg-slate-50 font-semibold',
                      )}
                    >
                      <opt.icon size={13} />
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Assign to me */}
          <Button
            variant="secondary"
            size="sm"
            icon={<UserCheck size={13} />}
            className="w-full"
            loading={assigningMe}
            onClick={assignToMe}
            disabled={!!thread.assignee_id}
          >
            {thread.assignee_id ? 'Assigned' : 'Assign to me'}
          </Button>

        </div>
      </aside>

      {/* ============================================================
          RIGHT MAIN — Header + Messages + Composer
      ============================================================ */}
      <div className="flex-1 flex flex-col bg-white overflow-hidden">

        {/* ---- Header ---- */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-700 shrink-0">
            {thread.author_name?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-900 text-sm truncate">
              {thread.author_name ?? 'Unknown Sender'}
              {thread.author_handle && (
                <span className="font-normal text-slate-400 ml-1">
                  @{thread.author_handle}
                </span>
              )}
            </p>
            <p className="text-xs text-slate-400 truncate capitalize">
              {PLATFORM_EMOJI[thread.platform]} {thread.platform} · {thread.thread_type}
              {thread.updated_at && ` · ${formatRelative(thread.updated_at)}`}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Badge status={thread.status}>
              {thread.status.charAt(0).toUpperCase() + thread.status.slice(1)}
            </Badge>

            {/* External post link */}
            {(thread as InboxThread & { external_post_url?: string }).external_post_url && (
              <a
                href={(thread as InboxThread & { external_post_url?: string }).external_post_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 border border-blue-200 px-2 py-1 rounded-lg transition-colors"
              >
                <ExternalLink size={11} /> View Post
              </a>
            )}
          </div>
        </div>

        {/* ---- Messages ---- */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          {messages.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title="No messages yet"
              description="Messages from this conversation will appear here once loaded from the connected channel."
              compact
            />
          ) : (
            messages.map(msg => {
              const isInternal = msg.sender_type === 'internal' || msg.sender_type === 'agent'
              return (
                <div
                  key={msg.id}
                  className={cn('flex gap-3', isInternal && 'flex-row-reverse')}
                >
                  {/* Avatar */}
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 self-end',
                    isInternal ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600',
                  )}>
                    {isInternal
                      ? 'You'[0]
                      : (msg.sender_name?.[0]?.toUpperCase() ?? <User size={12} />)
                    }
                  </div>

                  {/* Bubble */}
                  <div className={cn('max-w-[70%] flex flex-col gap-1', isInternal && 'items-end')}>
                    <div className={cn(
                      'px-4 py-3 text-sm leading-relaxed',
                      isInternal
                        ? 'bg-blue-600 text-white rounded-2xl rounded-br-sm'
                        : 'bg-slate-100 text-slate-800 rounded-2xl rounded-bl-sm',
                    )}>
                      {msg.body}
                    </div>
                    <p className="text-[11px] text-slate-400 px-1">
                      {formatRelative(msg.sent_at)}
                    </p>
                  </div>
                </div>
              )
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* ---- Composer area ---- */}
        <div className="border-t border-slate-200 bg-white px-5 py-4 space-y-3 shrink-0">

          {/* Safety banner */}
          <div className="flex items-start gap-2 px-3 py-2.5 bg-orange-50 border border-orange-200 rounded-lg text-xs text-orange-800">
            <AlertTriangle size={13} className="shrink-0 mt-0.5 text-orange-500" />
            <span>
              <strong>Review required.</strong> AI-drafted replies require your review before sending.
              You must approve before publishing — replies are never sent automatically.
            </span>
          </div>

          {/* Toolbar: AI Draft + Saved Replies */}
          <div className="flex items-center gap-2">
            <Button
              variant="ai"
              size="xs"
              icon={<Wand2 size={12} />}
              loading={aiLoading}
              onClick={draftWithAI}
            >
              AI Draft
            </Button>

            {/* Saved replies dropdown */}
            <div className="relative" ref={savedMenuRef}>
              <Button
                variant="secondary"
                size="xs"
                icon={<BookMarked size={12} />}
                iconRight={<ChevronDown size={11} />}
                onClick={() => setShowSavedMenu(v => !v)}
              >
                Saved Replies
              </Button>
              {showSavedMenu && (
                <div className="absolute z-20 top-full left-0 mt-1 w-72 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                  {savedReplies.length === 0 ? (
                    <p className="px-4 py-3 text-xs text-slate-400">No saved replies yet.</p>
                  ) : (
                    savedReplies.map(r => (
                      <button
                        key={r.id}
                        onClick={() => { setReplyText(r.content); setShowSavedMenu(false) }}
                        className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-b-0"
                      >
                        <p className="text-sm font-medium text-slate-800">{r.name}</p>
                        <p className="text-xs text-slate-400 mt-0.5 truncate">{r.content}</p>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Textarea + Send */}
          <div className="flex gap-2 items-end">
            <textarea
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              placeholder="Write a reply… (AI-drafted replies will appear here for your review)"
              rows={3}
              className="flex-1 px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white resize-none transition-all"
              onKeyDown={e => {
                // Ctrl/Cmd+Enter opens confirm modal
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && replyText.trim()) {
                  e.preventDefault()
                  setShowConfirm(true)
                }
              }}
            />
            <Button
              variant="primary"
              size="sm"
              icon={<Send size={13} />}
              disabled={!replyText.trim() || sending}
              onClick={() => setShowConfirm(true)}
            >
              Send
            </Button>
          </div>

          <p className="text-[11px] text-slate-400">
            Tip: Ctrl+Enter to send · Replies are saved internally and sent to the platform via connected channel.
          </p>
        </div>
      </div>

      {/* ============================================================
          CONFIRM SEND MODAL
      ============================================================ */}
      <ConfirmModal
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={doSend}
        title="Send this reply?"
        description="This will post your reply to the conversation. Please confirm you have reviewed the message before sending."
        confirmLabel="Send Reply"
        loading={sending}
      />

      {/* Stripe redirect info (placeholder — only shown if triggered) */}
      <Modal
        open={stripeModal}
        onClose={() => setStripeModal(false)}
        title="Redirecting to Stripe"
        description="You will be taken to Stripe's secure portal to manage your payment details."
        size="sm"
        footer={
          <Button variant="primary" onClick={() => setStripeModal(false)}>OK</Button>
        }
      >
        <p className="text-sm text-slate-600">
          Caption Fox uses Stripe for all billing. Your payment details are never stored on our servers.
        </p>
      </Modal>
    </div>
  )
}

// ------------------------------------------------------------------
// Helper: metadata row
// ------------------------------------------------------------------
function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-slate-400 shrink-0">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  )
}
