'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { Send, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

const SUGGESTIONS = [
  "Summarise this week's performance",
  'What should I post today?',
  'Find content gaps',
  'Suggest next campaign ideas',
  'Review my brand voice',
]

interface Message { role: 'user' | 'assistant'; content: string }

export function CopilotTab({ workspaceId }: { workspaceId: string }) {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function send(text?: string) {
    const content = (text ?? input).trim()
    if (!content || loading) return
    const history = [...messages, { role: 'user' as const, content }]
    setMessages(history)
    setInput('')
    setLoading(true)
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history.slice(-12), mode: 'copilot', workspaceId }),
      })
      const data = await res.json().catch(() => ({} as { text?: string; error?: string }))
      const reply = res.ok ? (data.text ?? "I couldn't process that request. Please try again.")
        : (data.error === 'Unauthorized' ? 'Please sign in to use Fox AI.' : data.error ?? "I couldn't process that request.")
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong. Please check your connection and try again.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-[520px] flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="py-8 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-fox-50">
              <Sparkles size={20} className="text-blue-500" />
            </div>
            <p className="text-sm font-medium text-slate-700">Ask me anything about your content</p>
            <div className="mt-4 flex flex-wrap justify-center gap-1.5">
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => send(s)} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600 transition-colors hover:bg-slate-200">{s}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={cn('flex gap-2', m.role === 'user' ? 'justify-end' : 'justify-start')}>
            {m.role === 'assistant' && (
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-fox-gradient">
                <Image src="/caption fox favicon.png" alt="" width={14} height={14} className="rounded" />
              </div>
            )}
            <div className={cn('max-w-[80%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm', m.role === 'user' ? 'rounded-br-sm bg-blue-600 text-white' : 'rounded-bl-sm bg-slate-100 text-slate-800')}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-fox-gradient"><Image src="/caption fox favicon.png" alt="" width={14} height={14} className="rounded" /></div>
            <div className="rounded-xl bg-slate-100 px-3 py-2"><span className="flex gap-1">{[0, 1, 2].map(i => <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: `${i * 150}ms` }} />)}</span></div>
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div className="border-t border-slate-100 p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder="Ask Fox anything…"
            rows={2}
            className="flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button onClick={() => send()} disabled={!input.trim() || loading} className="shrink-0 rounded-xl bg-blue-600 p-2.5 text-white transition-colors hover:bg-blue-700 disabled:opacity-40">
            <Send size={15} />
          </button>
        </div>
        <p className="mt-1.5 px-1 text-[10px] text-slate-400">Fox AI can make mistakes. Review before publishing.</p>
      </div>
    </div>
  )
}
