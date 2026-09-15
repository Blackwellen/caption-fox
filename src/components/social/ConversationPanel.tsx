'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { assignConversation, sendReply, updateConversation } from '@/lib/social/actions'
import { ProviderBadge, SentimentPill, TimeAgo } from './primitives'
import type { SocialProvider } from '@/types/social'

interface Message {
  id: string; content: string; sender_type: string; sent_at: string
  is_internal_note: boolean; delivery_status: string; is_ai_generated: boolean
  author: { full_name: string | null; avatar_url: string | null } | null
}

interface Conversation {
  id: string; platform: string | null; sender_name: string | null; sender_handle: string | null
  content: string | null; sentiment: string | null; status: string; assigned_to: string | null
  is_flagged: boolean; priority: string; created_at: string
}

const MODES = [
  { id: 'reply', label: 'Reply' },
  { id: 'note', label: 'Note' },
  { id: 'internal_comment', label: 'Internal Comment' },
] as const

export function ConversationPanel({
  conversation, messages, members,
}: {
  conversation: Conversation
  messages: Message[]
  members: { id: string; name: string; avatarUrl: string | null }[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [mode, setMode] = useState<(typeof MODES)[number]['id']>('reply')
  const [body, setBody] = useState('')
  const [sentiment, setSentiment] = useState(conversation.sentiment ?? 'neutral')
  const [error, setError] = useState<string | null>(null)

  function send() {
    if (!body.trim()) return
    setError(null)
    startTransition(async () => {
      const result = await sendReply({ conversationId: conversation.id, body, mode, sentiment })
      if (!result.ok) { setError(result.message); return }
      setBody('')
      router.refresh()
    })
  }

  function assign(userId: string) {
    startTransition(async () => {
      const result = await assignConversation(conversation.id, userId || null)
      if (!result.ok) alert(result.message)
      else router.refresh()
    })
  }

  function resolve() {
    startTransition(async () => {
      const result = await updateConversation({ conversationId: conversation.id, status: 'resolved' })
      if (!result.ok) alert(result.message)
      else router.refresh()
    })
  }

  function flag() {
    startTransition(async () => {
      const result = await updateConversation({ conversationId: conversation.id, isFlagged: !conversation.is_flagged })
      if (!result.ok) alert(result.message)
      else router.refresh()
    })
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-2">
          {conversation.platform && <ProviderBadge provider={conversation.platform as SocialProvider} />}
          <div>
            <p className="text-sm font-semibold text-slate-900">{conversation.sender_name ?? conversation.sender_handle ?? 'Unknown'}</p>
            <p className="text-xs text-slate-500">Comment on <TimeAgo iso={conversation.created_at} /></p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <SentimentPill sentiment={conversation.sentiment} />
          <select
            defaultValue={conversation.assigned_to ?? ''}
            onChange={event => assign(event.target.value)}
            className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
          >
            <option value="">Unassigned</option>
            {members.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}
          </select>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        {conversation.content && (
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-sm text-slate-700">{conversation.content}</p>
          </div>
        )}
        {messages.map(message => (
          <div key={message.id} className={message.sender_type === 'internal' ? 'flex justify-end' : ''}>
            <div className={`max-w-[80%] rounded-lg p-3 text-sm ${message.sender_type === 'internal' ? (message.is_internal_note ? 'bg-amber-50' : 'bg-blue-600 text-white') : 'bg-slate-50'}`}>
              {message.is_internal_note && <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700">Internal note</p>}
              <p>{message.content}</p>
              <p className={`mt-1 text-[10px] ${message.sender_type === 'internal' && !message.is_internal_note ? 'text-blue-100' : 'text-slate-400'}`}>
                {message.author?.full_name ?? 'You'} · {message.delivery_status === 'pending' ? 'Sending…' : message.delivery_status === 'failed' ? 'Failed' : <TimeAgo iso={message.sent_at} />}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-100 p-4">
        <div className="mb-2 flex gap-1">
          {MODES.map(item => (
            <button
              key={item.id}
              onClick={() => setMode(item.id)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium ${mode === item.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <textarea
          value={body} onChange={event => setBody(event.target.value)} rows={3}
          placeholder={mode === 'reply' ? 'Write a reply…' : 'Add a note…'}
          className="w-full rounded-lg border border-slate-200 p-3 text-sm"
        />
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <select value={sentiment} onChange={event => setSentiment(event.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs">
              <option value="positive">Positive</option>
              <option value="neutral">Neutral</option>
              <option value="negative">Negative</option>
            </select>
            <button onClick={flag} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs">{conversation.is_flagged ? 'Unflag' : 'Flag'}</button>
            <button onClick={resolve} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs">Resolve</button>
          </div>
          <button
            onClick={send}
            disabled={pending || !body.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {pending ? 'Sending…' : mode === 'reply' ? 'Send Reply' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
