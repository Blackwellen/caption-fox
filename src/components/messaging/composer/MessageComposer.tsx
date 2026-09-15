'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Send, Save, FlaskConical, CalendarClock, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/campaigns/Toast'
import { createMessage, sendTestMessage, sendMessageNow, scheduleMessage, updateMessageContent, submitMessageForApproval } from '@/app/app/messaging/actions'
import { CHANNEL_LABELS, type MessagingChannel } from '@/lib/messaging/constants'
import AudiencePicker from './AudiencePicker'
import type { AudienceRow } from '@/lib/messaging/types'

const FIELD = 'w-full rounded-lg border border-slate-200 px-3 text-[13px] text-slate-700 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100'
const BUTTON = 'inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-[13px] font-medium shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50'

export interface MessageComposerProps {
  channel: MessagingChannel
  audiences: AudienceRow[]
  senderPlaceholder: string
  canSend: boolean
  canSchedule: boolean
  canTestSend: boolean
  canSubmitApproval?: boolean
  /** Editing an existing draft, or starting a new one. */
  existing?: { id: string; name: string; senderId: string | null; audienceId: string | null; subject: string | null; body: string; headline?: string }
}

export default function MessageComposer({
  channel, audiences, senderPlaceholder, canSend, canSchedule, canTestSend, canSubmitApproval = true, existing,
}: MessageComposerProps) {
  const router = useRouter()
  const { notify } = useToast()
  const [pending, startTransition] = useTransition()

  const [name, setName] = useState(existing?.name ?? '')
  const [sender, setSender] = useState(existing?.senderId ?? '')
  const [audienceId, setAudienceId] = useState(existing?.audienceId ?? '')
  const [subject, setSubject] = useState(existing?.subject ?? '')
  const [headline, setHeadline] = useState(existing?.headline ?? '')
  const [body, setBody] = useState(existing?.body ?? '')
  const [messageId, setMessageId] = useState(existing?.id ?? '')
  const [testAddress, setTestAddress] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')

  const showSubject = channel === 'email'
  const showHeadline = channel === 'push' || channel === 'rcs'
  const smsLimit = channel === 'sms' ? 918 : null

  function content() {
    return { subject: showSubject ? subject : undefined, headline: showHeadline ? headline : undefined, body }
  }

  async function ensureSaved(): Promise<string | null> {
    if (messageId) {
      const res = await updateMessageContent(messageId, channel, { name, senderId: sender, audienceId, content: content() })
      if (!res.ok) { notify('error', res.error ?? 'Could not save.'); return null }
      return messageId
    }
    const res = await createMessage({ channel, name, senderId: sender, audienceId: audienceId || undefined, content: content() })
    if (!res.ok || !res.id) { notify('error', res.error ?? 'Could not save.'); return null }
    setMessageId(res.id)
    return res.id
  }

  function handleSaveDraft() {
    startTransition(async () => {
      const id = await ensureSaved()
      if (id) { notify('success', 'Draft saved.'); router.refresh() }
    })
  }

  function handleTestSend() {
    startTransition(async () => {
      const id = await ensureSaved()
      if (!id) return
      const res = await sendTestMessage(id, testAddress)
      notify(res.ok ? 'success' : 'error', res.ok ? (res.message ?? 'Test sent.') : (res.error ?? 'Test send failed.'))
    })
  }

  function handleSendNow() {
    startTransition(async () => {
      const id = await ensureSaved()
      if (!id) return
      if (!audienceId) { notify('error', 'Choose an audience first.'); return }
      const res = await sendMessageNow(id)
      notify(res.ok ? 'success' : 'error', res.ok ? (res.message ?? 'Sent.') : (res.error ?? 'Send failed.'))
      if (res.ok) router.refresh()
    })
  }

  function handleSubmitApproval() {
    startTransition(async () => {
      const id = await ensureSaved()
      if (!id) return
      const res = await submitMessageForApproval(id)
      notify(res.ok ? 'success' : 'error', res.ok ? (res.message ?? 'Submitted.') : (res.error ?? 'Could not submit.'))
      if (res.ok) router.push(`/app/messaging/messages/${id}`)
    })
  }

  function handleSchedule() {
    startTransition(async () => {
      const id = await ensureSaved()
      if (!id) return
      if (!scheduledAt) { notify('error', 'Choose a date and time.'); return }
      const res = await scheduleMessage(id, new Date(scheduledAt).toISOString())
      notify(res.ok ? 'success' : 'error', res.ok ? (res.message ?? 'Scheduled.') : (res.error ?? 'Could not schedule.'))
      if (res.ok) router.refresh()
    })
  }

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <label className="mb-1 block text-[11px] font-medium text-slate-500">Message name</label>
          <input className={cn(FIELD, 'h-9')} value={name} onChange={e => setName(e.target.value)} placeholder={`e.g. Welcome ${CHANNEL_LABELS[channel]}`} />
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-medium text-slate-500">{channel === 'email' ? 'From' : 'Sender ID'}</label>
          <input className={cn(FIELD, 'h-9')} value={sender} onChange={e => setSender(e.target.value)} placeholder={senderPlaceholder} />
        </div>

        {showSubject && (
          <div>
            <label className="mb-1 block text-[11px] font-medium text-slate-500">Subject</label>
            <input className={cn(FIELD, 'h-9')} value={subject} onChange={e => setSubject(e.target.value)} placeholder="Your personalised update is ready" />
          </div>
        )}

        {showHeadline && (
          <div>
            <label className="mb-1 block text-[11px] font-medium text-slate-500">{channel === 'push' ? 'Title' : 'Headline'}</label>
            <input className={cn(FIELD, 'h-9')} value={headline} onChange={e => setHeadline(e.target.value)} placeholder="New arrivals are here" />
          </div>
        )}

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="block text-[11px] font-medium text-slate-500">Body</label>
            {smsLimit && <span className={cn('text-[11px]', body.length > smsLimit ? 'text-red-500' : 'text-slate-400')}>{body.length} / {smsLimit}</span>}
          </div>
          <textarea
            className={cn(FIELD, 'min-h-[140px] resize-y py-2')} value={body} onChange={e => setBody(e.target.value)}
            placeholder={`Write your ${CHANNEL_LABELS[channel]} message. Use {{first_name}} for personalisation.`}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          <button type="button" onClick={handleSaveDraft} disabled={pending || !name || !body} className={cn(BUTTON, 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50')}>
            {pending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save draft
          </button>

          {canTestSend && (
            <div className="flex items-center gap-1.5">
              <input
                className={cn(FIELD, 'h-9 w-44')} value={testAddress} onChange={e => setTestAddress(e.target.value)}
                placeholder={channel === 'email' ? 'you@example.com' : 'Test address'}
              />
              <button type="button" onClick={handleTestSend} disabled={pending || !name || !body || !testAddress} className={cn(BUTTON, 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50')}>
                <FlaskConical size={14} />
                Send test
              </button>
            </div>
          )}

          {canSchedule && (
            <div className="flex items-center gap-1.5">
              <input type="datetime-local" className={cn(FIELD, 'h-9 w-48')} value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} />
              <button type="button" onClick={handleSchedule} disabled={pending || !name || !body || !audienceId} className={cn(BUTTON, 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50')}>
                <CalendarClock size={14} />
                Schedule
              </button>
            </div>
          )}

          {canSubmitApproval && (
            <button type="button" onClick={handleSubmitApproval} disabled={pending || !name || !body} className={cn(BUTTON, 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50')}>
              <CheckCircle2 size={14} />
              Submit for approval
            </button>
          )}

          {canSend && (
            <button type="button" onClick={handleSendNow} disabled={pending || !name || !body || !audienceId} className={cn(BUTTON, 'ml-auto bg-blue-600 text-white hover:bg-blue-700')}>
              <Send size={14} />
              Send now
            </button>
          )}
        </div>
      </div>

      <AudiencePicker channel={channel} audiences={audiences} value={audienceId} onChange={setAudienceId} />
    </div>
  )
}
