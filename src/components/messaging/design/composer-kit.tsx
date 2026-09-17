'use client'

import { useEffect, useRef, useState, useTransition, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/campaigns/Toast'
import {
  createMessage, sendTestMessage, submitMessageForApproval, updateMessageContent, type MessageContentInput,
} from '@/app/app/messaging/actions'
import type { MessagingChannel } from '@/lib/messaging/constants'

// Building blocks for the page composers. Every button here calls a real
// server action: drafts are saved to messaging_messages (with a version row),
// tests go through the channel's provider adapter, approval uses the real queue.

export const FIELD = 'h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 text-[13px] text-slate-700 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 lg:h-[21px] lg:rounded-[4px] lg:px-[7px] lg:text-[8.5px]'

export function Label({ children, htmlFor, className, aside }: { children: ReactNode; htmlFor?: string; className?: string; aside?: ReactNode }) {
  return (
    <div className={cn('mb-1 flex items-center justify-between lg:mb-[4px]', className)}>
      <label htmlFor={htmlFor} className="text-[12px] text-slate-600 lg:text-[8.5px]">{children}</label>
      {aside && <span className="text-[11px] text-slate-400 lg:text-[7.5px]">{aside}</span>}
    </div>
  )
}

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement> & { ref?: React.Ref<HTMLInputElement> }) {
  return <input {...props} className={cn(FIELD, className)} />
}

export function TextArea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: React.Ref<HTMLTextAreaElement> }) {
  return <textarea {...props} className={cn(FIELD, 'h-auto resize-none py-2 leading-relaxed lg:py-[5px]', className)} />
}

export function SelectInput({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className={cn('relative block', className)}>
      <select {...props} className={cn(FIELD, 'appearance-none pr-7 lg:pr-[18px]')}>{children}</select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400 lg:right-[6px] lg:h-2.5 lg:w-2.5" aria-hidden />
    </span>
  )
}

export const BUTTON = 'inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 lg:h-[22px] lg:rounded-[4px] lg:px-[10px] lg:text-[8.5px]'
export const PRIMARY = cn(BUTTON, 'bg-blue-600 text-white hover:bg-blue-700')
export const SECONDARY = cn(BUTTON, 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50')

export interface DraftState {
  id?: string
  name: string
  senderId?: string
  audienceId?: string
  content: MessageContentInput
}

/**
 * Save/test/approve for one channel. `ensure` creates the draft on first use
 * and updates it (with a new version) afterwards, so nothing is sent from
 * unsaved client state.
 */
export function useDraftActions(channel: MessagingChannel, initialId?: string) {
  const router = useRouter()
  const { notify } = useToast()
  const [id, setId] = useState(initialId)
  const [pending, startTransition] = useTransition()
  const busy = useRef(false)

  async function ensure(draft: DraftState): Promise<string | null> {
    if (id) {
      const res = await updateMessageContent(id, channel, { name: draft.name, senderId: draft.senderId, audienceId: draft.audienceId, content: draft.content })
      if (!res.ok) { notify('error', res.error ?? 'The draft could not be saved.'); return null }
      return id
    }
    const res = await createMessage({ channel, name: draft.name, senderId: draft.senderId, audienceId: draft.audienceId || undefined, content: draft.content })
    if (!res.ok || !res.id) { notify('error', res.error ?? 'The draft could not be saved.'); return null }
    setId(res.id)
    return res.id
  }

  function run(task: () => Promise<void>) {
    if (busy.current) return
    busy.current = true
    startTransition(async () => { try { await task() } finally { busy.current = false } })
  }

  return {
    id, pending,
    save: (draft: DraftState) => run(async () => { if (await ensure(draft)) { notify('success', 'Draft saved.'); router.refresh() } }),
    test: (draft: DraftState, address: string) => run(async () => {
      const saved = await ensure(draft)
      if (!saved) return
      const res = await sendTestMessage(saved, address)
      notify(res.ok ? 'success' : 'error', res.ok ? (res.message ?? 'Test sent.') : (res.error ?? 'The test could not be sent.'))
    }),
    openEditor: (draft: DraftState) => run(async () => {
      const saved = await ensure(draft)
      if (saved) router.push(`/app/messaging/${channel}/compose?id=${saved}`)
    }),
    review: (draft: DraftState) => run(async () => {
      const saved = await ensure(draft)
      if (!saved) return
      const res = await submitMessageForApproval(saved)
      notify(res.ok ? 'success' : 'error', res.ok ? 'Submitted for approval.' : (res.error ?? 'Could not submit for approval.'))
      if (res.ok) router.push(`/app/messaging/messages/${saved}?tab=approval`)
    }),
  }
}

/** Send test with an inline address prompt (defaults to the member's own address). */
export function TestSendButton({
  onSend, defaultAddress, channel, disabledReason, className, label = 'Send test', icon, primary,
}: { onSend: (address: string) => void; defaultAddress: string; channel: MessagingChannel; disabledReason?: string | null; className?: string; label?: string; icon?: ReactNode; primary?: boolean }) {
  const [open, setOpen] = useState(false)
  const [address, setAddress] = useState(defaultAddress)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown); document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])
  const kind = channel === 'email' ? 'email address' : channel === 'push' ? 'device token' : 'phone number'
  return (
    <div ref={ref} className="relative">
      <button type="button" disabled={!!disabledReason} title={disabledReason ?? undefined} onClick={() => setOpen(o => !o)}
        className={cn(primary ? PRIMARY : SECONDARY, className)} aria-haspopup="dialog" aria-expanded={open}>
        {icon}{label}
      </button>
      {open && (
        <form role="dialog" aria-label="Send a test" className="absolute bottom-full right-0 z-40 mb-1 w-64 space-y-2 rounded-lg border border-slate-200 bg-white p-3 shadow-lg"
          onSubmit={e => { e.preventDefault(); if (address.trim()) { onSend(address.trim()); setOpen(false) } }}>
          <label className="block text-[12px] text-slate-600">Send a test to this {kind}
            <input autoFocus value={address} onChange={e => setAddress(e.target.value)} className="mt-1 h-8 w-full rounded-md border border-slate-200 px-2 text-[12px]" />
          </label>
          <p className="text-[11px] text-slate-400">Tests go only to this address, never to the audience.</p>
          <button type="submit" className="h-8 w-full rounded-md bg-blue-600 text-[12px] font-medium text-white hover:bg-blue-700">Send test</button>
        </form>
      )}
    </div>
  )
}

export function Spinner({ show }: { show: boolean }) {
  return show ? <Loader2 className="h-3.5 w-3.5 animate-spin lg:h-2.5 lg:w-2.5" aria-hidden /> : null
}

export function insertAtCursor(el: HTMLTextAreaElement | HTMLInputElement | null, value: string, current: string, set: (v: string) => void) {
  if (!el) { set(current + value); return }
  const start = el.selectionStart ?? current.length
  const end = el.selectionEnd ?? current.length
  set(current.slice(0, start) + value + current.slice(end))
  requestAnimationFrame(() => { el.focus(); el.setSelectionRange(start + value.length, start + value.length) })
}
