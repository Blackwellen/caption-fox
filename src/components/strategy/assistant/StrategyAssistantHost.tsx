'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Loader2, SendHorizontal, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { STRATEGY_MODULE_META } from '@/lib/strategy/constants'
import { answerLines, moduleFromPath, safeInternalHref, splitCitations } from '@/lib/strategy/ai-render'
import { Dialog } from '../client/dialog'
import { STRATEGY_ASSISTANT_EVENT } from './open'
import { STRATEGY_SUGGESTIONS } from './suggestions'

interface Citation { ref: string; label: string; module: string; href: string }
interface Turn { id: number; question: string; answer?: string; citations?: Citation[]; error?: string; upgrade?: boolean }
type Availability =
  | { state: 'loading' }
  | { state: 'ready'; remainingToday: number; remainingMonth: number }
  | { state: 'blocked'; message: string; upgrade: boolean }
  | { state: 'error'; message: string }

const MAX_LENGTH = 600

/**
 * Read-only Fox AI for Strategy. Answers come from `/api/strategy/ai`, which
 * grounds every reply in records the signed-in user can already open, cites
 * them, and stores neither the question nor the answer. Nothing here can
 * change a record.
 */
export default function StrategyAssistantHost() {
  const pathname = usePathname()
  const area = moduleFromPath(pathname)
  const meta = STRATEGY_MODULE_META[area]
  const [open, setOpen] = useState(false)
  const [availability, setAvailability] = useState<Availability>({ state: 'loading' })
  const [question, setQuestion] = useState('')
  const [turns, setTurns] = useState<Turn[]>([])
  const [busy, setBusy] = useState(false)
  const controller = useRef<AbortController | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)
  const nextId = useRef(1)

  const loadAvailability = useCallback(async () => {
    setAvailability({ state: 'loading' })
    try {
      const res = await fetch('/api/strategy/ai', { cache: 'no-store' })
      const json = await res.json().catch(() => ({}))
      if (res.status === 401) { setAvailability({ state: 'error', message: 'Your session has expired. Sign in again.' }); return }
      if (json.available === false) { setAvailability({ state: 'blocked', message: json.message ?? 'Fox AI is not available right now.', upgrade: Boolean(json.upgrade) }); return }
      if (!res.ok) { setAvailability({ state: 'error', message: json.error ?? 'Could not check your Fox AI allowance.' }); return }
      setAvailability({ state: 'ready', remainingToday: Number(json.remainingToday ?? 0), remainingMonth: Number(json.remainingMonth ?? 0) })
    } catch {
      setAvailability({ state: 'error', message: 'You appear to be offline. Check your connection and try again.' })
    }
  }, [])

  useEffect(() => {
    const onOpen = () => { setOpen(true); void loadAvailability() }
    window.addEventListener(STRATEGY_ASSISTANT_EVENT, onOpen)
    return () => window.removeEventListener(STRATEGY_ASSISTANT_EVENT, onOpen)
  }, [loadAvailability])
  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' }) }, [turns, busy])

  function close() {
    controller.current?.abort()
    controller.current = null
    setBusy(false)
    setOpen(false)
  }

  async function ask(text?: string) {
    const asked = (text ?? question).replace(/\s+/g, ' ').trim()
    if (busy || asked.length < 3) return
    const id = nextId.current++
    setTurns(list => [...list, { id, question: asked }])
    setQuestion('')
    setBusy(true)
    controller.current = new AbortController()
    try {
      const res = await fetch('/api/strategy/ai', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.current.signal,
        body: JSON.stringify({ question: asked, module: area }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setTurns(list => list.map(turn => turn.id === id ? { ...turn, error: json.error ?? 'Fox AI could not answer right now.', upgrade: Boolean(json.upgrade) } : turn))
        if (res.status === 429 || res.status === 402 || res.status === 403) void loadAvailability()
        return
      }
      setTurns(list => list.map(turn => turn.id === id ? { ...turn, answer: String(json.answer ?? ''), citations: Array.isArray(json.citations) ? json.citations : [] } : turn))
      setAvailability(state => state.state === 'ready'
        ? { ...state, remainingToday: Number(json.remainingToday ?? Math.max(0, state.remainingToday - 1)), remainingMonth: Math.max(0, state.remainingMonth - 1) }
        : state)
    } catch (error) {
      if ((error as Error).name === 'AbortError') return
      setTurns(list => list.map(turn => turn.id === id ? { ...turn, error: 'Could not reach Fox AI. Check your connection and try again.' } : turn))
    } finally {
      setBusy(false)
      controller.current = null
    }
  }

  const ready = availability.state === 'ready'
  const exhausted = ready && (availability.remainingToday <= 0 || availability.remainingMonth <= 0)
  const suggestions = STRATEGY_SUGGESTIONS[area]

  return (
    <Dialog open={open} onClose={close} size="lg" title={`Fox AI · ${meta.label}`} initialFocusRef={input}
      description="Answers only from your Strategy records, with sources. Read-only — it can’t change anything.">
      <div className="flex min-h-[320px] flex-col gap-3">
        <div ref={scroller} className="max-h-[52vh] min-h-[200px] flex-1 space-y-4 overflow-y-auto pr-1" aria-live="polite">
          {availability.state === 'loading' && (
            <p className="flex items-center gap-2 text-[13px] text-sg-muted"><Loader2 aria-hidden className="h-4 w-4 animate-spin" />Checking your Fox AI allowance…</p>
          )}

          {(availability.state === 'blocked' || availability.state === 'error') && (
            <div role="alert" className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
              {availability.message}{' '}
              {availability.state === 'blocked' && availability.upgrade && (
                <Link href="/app/settings?tab=billing" className="font-semibold underline">See plans</Link>
              )}
              {availability.state === 'error' && (
                <button type="button" onClick={() => void loadAvailability()} className="font-semibold underline">Try again</button>
              )}
            </div>
          )}

          {ready && turns.length === 0 && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sg-blue-soft text-sg-blue"><Sparkles aria-hidden className="h-6 w-6" /></span>
              <p className="max-w-[420px] text-[13.5px] text-sg-body">Ask about the {meta.label.toLowerCase()} you’re looking at, or anything else in Strategy.</p>
              <ul className="flex flex-wrap justify-center gap-2">
                {suggestions.map(suggestion => (
                  <li key={suggestion}>
                    <button type="button" disabled={busy || exhausted} onClick={() => void ask(suggestion)}
                      className="min-h-10 rounded-full border border-sg-line bg-white px-3.5 text-[12.5px] text-sg-body hover:border-sg-blue/40 hover:bg-sg-blue-soft/40 disabled:opacity-50">
                      {suggestion}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {turns.map(turn => (
            <div key={turn.id} className="space-y-2">
              <p className="ml-auto w-fit max-w-[85%] rounded-2xl bg-sg-blue-soft px-3.5 py-2 text-[13.5px] text-sg-ink">{turn.question}</p>
              {turn.error ? (
                <div role="alert" className="max-w-[92%] rounded-2xl border border-rose-100 bg-rose-50 px-3.5 py-2.5 text-[13px] text-rose-700">
                  {turn.error}{' '}
                  {turn.upgrade && <Link href="/app/settings?tab=billing" className="font-semibold underline">See plans</Link>}
                </div>
              ) : turn.answer !== undefined ? (
                <div className="max-w-[92%] space-y-1.5 rounded-2xl bg-slate-50 px-3.5 py-2.5 text-[13.5px] leading-relaxed text-sg-ink">
                  {answerLines(turn.answer).map((line, index) => (
                    <p key={index} className={cn(line.bullet && 'flex gap-2')}>
                      {line.bullet && <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-slate-400" />}
                      <span>
                        {splitCitations(line.text).map((part, i) => {
                          if (part.kind === 'text') return <span key={i}>{part.value}</span>
                          const cited = turn.citations?.find(c => c.ref === part.ref)
                          const href = safeInternalHref(cited?.href)
                          return href
                            ? <Link key={i} href={href} onClick={close} title={cited?.label} className="mx-0.5 inline-flex rounded bg-white px-1 text-[11px] font-medium text-sg-blue ring-1 ring-sg-line hover:bg-sg-blue-soft">{part.ref}</Link>
                            : null
                        })}
                      </span>
                    </p>
                  ))}
                  {turn.citations && turn.citations.length > 0 && (
                    <p className="flex flex-wrap gap-1.5 pt-1.5">
                      {turn.citations.map(cited => {
                        const href = safeInternalHref(cited.href)
                        return href ? (
                          <Link key={cited.ref} href={href} onClick={close}
                            className="inline-flex min-h-8 items-center rounded-md bg-white px-2 text-[11.5px] text-sg-muted ring-1 ring-sg-line hover:text-sg-blue">
                            <span className="mr-1 font-medium text-sg-blue">{cited.ref}</span>{cited.label}
                          </Link>
                        ) : null
                      })}
                    </p>
                  )}
                </div>
              ) : (
                <p className="flex items-center gap-2 text-[13px] text-sg-muted"><Loader2 aria-hidden className="h-4 w-4 animate-spin" />Fox AI is reading your records…</p>
              )}
            </div>
          ))}
        </div>

        <form className="border-t border-sg-line-soft pt-3" onSubmit={event => { event.preventDefault(); void ask() }}>
          <label htmlFor="strategy-ai-question" className="sr-only">Ask Fox AI about {meta.label}</label>
          <div className="flex items-end gap-2">
            <textarea id="strategy-ai-question" ref={input} rows={2} value={question} maxLength={MAX_LENGTH}
              disabled={!ready || exhausted}
              placeholder={exhausted ? 'You’ve used your Fox AI allowance for now.' : `Ask about ${meta.label.toLowerCase()}…`}
              onChange={event => setQuestion(event.target.value)}
              onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void ask() } }}
              className="min-h-[44px] w-full resize-none rounded-xl border border-sg-line bg-white px-3 py-2.5 text-[14px] text-sg-ink placeholder:text-slate-400 focus:border-sg-blue focus:outline-none focus:ring-2 focus:ring-sg-blue/20 disabled:cursor-not-allowed disabled:bg-slate-50" />
            <button type="submit" aria-label="Send question" disabled={busy || !ready || exhausted || question.trim().length < 3}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sg-blue text-white hover:bg-sg-blue-hover disabled:opacity-50">
              {busy ? <Loader2 aria-hidden className="h-5 w-5 animate-spin" /> : <SendHorizontal aria-hidden className="h-5 w-5" />}
            </button>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 text-[11.5px] text-sg-muted">
            <span>Fox AI can make mistakes — check important figures against the records.</span>
            {ready && <span className="shrink-0 tabular-nums">{question.length}/{MAX_LENGTH} · {availability.remainingToday} left today</span>}
          </div>
        </form>
      </div>
    </Dialog>
  )
}
