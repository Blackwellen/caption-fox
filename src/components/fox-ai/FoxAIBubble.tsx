'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { X, Send, Sparkles, Pencil, Inbox, CheckSquare, AlertTriangle, RotateCcw, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

type BubbleMode = 'copilot' | 'create' | 'inbox' | 'tasks' | 'alerts'

const modes: { id: BubbleMode; label: string; icon: React.ReactNode }[] = [
  { id: 'copilot', label: 'Copilot',  icon: <Sparkles size={14} /> },
  { id: 'create',  label: 'Create',   icon: <Pencil size={14} /> },
  { id: 'inbox',   label: 'Inbox',    icon: <Inbox size={14} /> },
  { id: 'tasks',   label: 'Tasks',    icon: <CheckSquare size={14} /> },
  { id: 'alerts',  label: 'Alerts',   icon: <AlertTriangle size={14} /> },
]

const createSuggestions = [
  'Generate 10 TikTok hooks',
  'Write an Instagram caption',
  'Create a LinkedIn post',
  'Generate hashtag set',
  'Write a Reel script',
  'Repurpose this post',
]

const copilotSuggestions = [
  'Summarise this week\'s performance',
  'What should I post today?',
  'Find content gaps',
  'Suggest next campaign ideas',
  'Review my brand voice',
]

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export default function FoxAIBubble() {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<BubbleMode>('copilot')
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [alertCount] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend() {
    if (!input.trim() || loading) return
    const userMsg: Message = { role: 'user', content: input.trim(), timestamp: new Date() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg.content, mode }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.response ?? 'I couldn\'t process that request. Please try again.',
        timestamp: new Date(),
      }])
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Something went wrong. Please check your AI configuration.',
        timestamp: new Date(),
      }])
    } finally {
      setLoading(false)
    }
  }

  function useSuggestion(s: string) { setInput(s) }

  return (
    <>
      {/* Collapsed bubble */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-fox-gradient shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 flex items-center justify-center group"
          aria-label="Open Fox AI"
        >
          <Image src="/caption fox favicon.png" alt="Fox AI" width={32} height={32} className="rounded-lg" />
          {alertCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
              {alertCount}
            </span>
          )}
        </button>
      )}

      {/* Expanded panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[420px] max-h-[620px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-fox-gradient px-4 py-3 flex items-center gap-3">
            <Image src="/caption fox favicon.png" alt="Fox AI" width={28} height={28} className="rounded-lg" />
            <div className="flex-1">
              <p className="text-white font-semibold text-sm">Fox AI Copilot</p>
              <p className="text-blue-100 text-xs">Your social content assistant</p>
            </div>
            <button onClick={() => setOpen(false)} className="p-1 text-blue-100 hover:text-white transition-colors">
              <X size={16} />
            </button>
          </div>

          {/* Mode tabs */}
          <div className="flex border-b border-slate-100 px-2 pt-1.5 gap-0.5">
            {modes.map(m => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-t-lg border-b-2 -mb-px transition-all',
                  mode === m.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700',
                )}
              >
                {m.icon}
                {m.label}
              </button>
            ))}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
            {messages.length === 0 && (
              <div className="text-center py-6">
                <div className="w-12 h-12 rounded-2xl bg-fox-50 flex items-center justify-center mx-auto mb-3">
                  <Sparkles size={20} className="text-blue-500" />
                </div>
                <p className="text-sm font-medium text-slate-700">
                  {mode === 'copilot' && 'Ask me anything about your content'}
                  {mode === 'create' && 'Generate captions, hooks, scripts & more'}
                  {mode === 'inbox' && 'Manage and reply to your messages'}
                  {mode === 'tasks' && 'View and manage your tasks'}
                  {mode === 'alerts' && 'No active alerts'}
                </p>
                <div className="flex flex-wrap gap-1.5 justify-center mt-4">
                  {(mode === 'create' ? createSuggestions : copilotSuggestions).map(s => (
                    <button
                      key={s}
                      onClick={() => useSuggestion(s)}
                      className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={cn('flex gap-2', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                {msg.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-full bg-fox-gradient flex items-center justify-center shrink-0 mt-0.5">
                    <Image src="/caption fox favicon.png" alt="" width={14} height={14} className="rounded" />
                  </div>
                )}
                <div className={cn(
                  'max-w-[80%] px-3 py-2 rounded-xl text-sm',
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-sm'
                    : 'bg-slate-100 text-slate-800 rounded-bl-sm',
                )}>
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-2">
                <div className="w-6 h-6 rounded-full bg-fox-gradient flex items-center justify-center shrink-0">
                  <Image src="/caption fox favicon.png" alt="" width={14} height={14} className="rounded" />
                </div>
                <div className="bg-slate-100 rounded-xl px-3 py-2">
                  <span className="flex gap-1">
                    {[0,1,2].map(i => (
                      <span key={i} className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                    ))}
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Composer */}
          <div className="p-3 border-t border-slate-100">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                placeholder={
                  mode === 'create' ? 'What would you like to create?' :
                  mode === 'copilot' ? 'Ask Fox anything…' : 'Type a message…'
                }
                rows={2}
                className="flex-1 resize-none text-sm px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || loading}
                className="p-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl transition-colors shrink-0"
              >
                <Send size={15} />
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-1.5 px-1">Fox AI drafts only — review before publishing.</p>
          </div>
        </div>
      )}
    </>
  )
}
