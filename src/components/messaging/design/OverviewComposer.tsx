'use client'

import { useRef, useState } from 'react'
import { Braces, ChevronDown, ImageIcon, Link2, Type } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CHANNEL_LABELS, type MessagingChannel } from '@/lib/messaging/constants'
import { ChannelIcon } from './kit'
import { PRIMARY, SelectInput, TestSendButton, TextInput, insertAtCursor, useDraftActions, type DraftState } from './composer-kit'

export interface ComposerDraftProps {
  id: string
  name: string
  sender_id: string | null
  subject: string | null
  audience_id: string | null
  content: Record<string, unknown>
}

export interface OverviewComposerProps {
  channels: MessagingChannel[]
  drafts: Partial<Record<MessagingChannel, ComposerDraftProps>>
  senders: Partial<Record<MessagingChannel, string[]>>
  audiences: { id: string; name: string }[]
  userEmail: string
  canCreate: boolean
  canTest: boolean
  canSubmit: boolean
}

/** Brand wordmark derived from the sender display name ("Acme Marketing <…>" → "ACME"). */
export function brandFrom(sender: string | null | undefined) {
  const name = (sender ?? '').split('<')[0].trim()
  return (name.split(/\s+/)[0] || 'Brand').toUpperCase()
}

export default function OverviewComposer(props: OverviewComposerProps) {
  const [channel, setChannel] = useState<MessagingChannel>(props.channels[0] ?? 'email')
  return (
    <div className="flex h-full flex-col">
      <div role="tablist" aria-label="Channel" className="mb-3 flex flex-wrap gap-1.5 lg:mb-[12px] lg:flex-nowrap lg:gap-[5px]">
        {props.channels.map(c => (
          <button key={c} type="button" role="tab" aria-selected={channel === c} onClick={() => setChannel(c)}
            className={cn('inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[12px] lg:h-[23px] lg:gap-[4px] lg:rounded-[5px] lg:px-[6px] lg:text-[8px]',
              channel === c ? 'border-blue-300 bg-blue-50 font-medium text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50')}>
            <ChannelIcon channel={c} className={channel === c ? 'text-blue-600' : c === 'whatsapp' ? 'text-emerald-600' : c === 'rcs' || c === 'push' ? 'text-violet-600' : 'text-blue-600'} />
            {CHANNEL_LABELS[c]}
          </button>
        ))}
      </div>
      {/* Keyed by channel so each tab resumes its own saved draft. */}
      <ChannelForm key={channel} channel={channel} {...props} />
    </div>
  )
}

function ChannelForm({ channel, drafts, senders, audiences, userEmail, canCreate, canTest, canSubmit }: OverviewComposerProps & { channel: MessagingChannel }) {
  const draft = drafts[channel]
  const content = (draft?.content ?? {}) as Record<string, string | undefined> & { cta?: { label?: string }; image?: string }
  const senderOptions = senders[channel] ?? []
  const [sender, setSender] = useState(draft?.sender_id ?? senderOptions[0] ?? '')
  const [audienceId, setAudienceId] = useState(draft?.audience_id ?? '')
  const [subject, setSubject] = useState(draft?.subject ?? content.subject ?? content.title ?? content.headline ?? '')
  const [body, setBody] = useState(content.body ?? '')
  const [menu, setMenu] = useState(false)
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const subjectRef = useRef<HTMLInputElement>(null)
  const actions = useDraftActions(channel, draft?.id)

  const subjectLabel = channel === 'email' ? 'Subject' : channel === 'push' ? 'Title' : channel === 'rcs' ? 'Headline' : null
  const state = (): DraftState => ({
    name: draft?.name ?? `${CHANNEL_LABELS[channel]} message`, senderId: sender, audienceId,
    content: {
      subject: channel === 'email' ? subject : undefined, headline: channel === 'push' || channel === 'rcs' ? subject : undefined, body,
      extras: { image: content.image, cta: content.cta, preheader: content.preheader, replyTo: content.replyTo },
    },
  })
  const noCreate = canCreate ? null : 'Your role cannot create messages.'
  const lines = body.split('\n')

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-2 lg:space-y-[7px]">
        <Row label="From">
          <SelectInput value={sender} onChange={e => setSender(e.target.value)} aria-label="From">
            {senderOptions.length === 0 && <option value="">No sender configured</option>}
            {senderOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </SelectInput>
        </Row>
        <Row label="To">
          <SelectInput value={audienceId} onChange={e => setAudienceId(e.target.value)} aria-label="To">
            <option value="">Select audience</option>
            {audiences.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </SelectInput>
        </Row>
        {subjectLabel && (
          <Row label={subjectLabel}>
            <TextInput ref={subjectRef} value={subject} maxLength={200} onChange={e => setSubject(e.target.value)} aria-label={subjectLabel} placeholder={`Add a ${subjectLabel.toLowerCase()}`} />
          </Row>
        )}
      </div>

      {/* Live preview of the draft content. The body is editable inline. */}
      <div className="mt-3 rounded-md border border-slate-200 bg-slate-50/40 p-2.5 lg:mt-[16px] lg:h-[146px] lg:overflow-hidden lg:rounded-[6px] lg:px-[10px] lg:py-[9px]">
        <p className="mb-2 flex items-center gap-1 text-[12px] font-bold tracking-tight text-slate-900 lg:mb-[8px] lg:text-[8px]">
          <span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-slate-900 lg:h-[7px] lg:w-[7px] lg:border-[1.5px]" aria-hidden />
          {brandFrom(sender)}
          <span className="ml-3 hidden h-1 w-10 rounded bg-slate-200 lg:inline-block" aria-hidden /><span className="hidden h-1 w-10 rounded bg-slate-200 lg:inline-block" aria-hidden />
        </p>
        <div className="flex gap-3 rounded-md bg-white p-2 lg:gap-[10px] lg:p-[6px]">
          {content.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={content.image} alt="" className="h-28 w-24 shrink-0 rounded object-cover lg:h-[100px] lg:w-[80px]" />
          )}
          <div className="min-w-0 flex-1 pt-1 lg:pt-[10px]">
            <p className="text-[13px] font-semibold text-slate-900 lg:text-[8.5px]">{lines[0] || 'Your message'}</p>
            <label className="sr-only" htmlFor={`body-${channel}`}>Message body</label>
            <textarea id={`body-${channel}`} ref={bodyRef} value={lines.slice(1).join('\n')} rows={2} maxLength={channel === 'sms' ? 900 : 5000}
              onChange={e => setBody(`${lines[0] ?? ''}\n${e.target.value}`)}
              className="mt-1 w-full resize-none bg-transparent text-[12px] leading-snug text-slate-600 outline-none lg:mt-[6px] lg:text-[8px]" placeholder="Write your message" />
            {content.cta?.label && <span className="mt-1 inline-flex h-7 items-center rounded bg-blue-600 px-3 text-[12px] font-medium text-white lg:h-[16px] lg:px-[12px] lg:text-[7px]">{content.cta.label}</span>}
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 lg:mt-[10px]">
        <div className="flex items-center rounded-md border border-slate-200 lg:h-[22px]">
          <Tool label="Insert first name" onClick={() => insertAtCursor(subjectRef.current, '{{first_name}}', subject, setSubject)}><Type /></Tool>
          <Tool label="Add image in the full editor" onClick={() => actions.openEditor(state())}><ImageIcon /></Tool>
          <Tool label="Insert tracked link" onClick={() => insertAtCursor(bodyRef.current, ' {{short_url}}', lines.slice(1).join('\n'), v => setBody(`${lines[0] ?? ''}\n${v}`))}><Link2 /></Tool>
          <Tool label="Insert variable" onClick={() => insertAtCursor(bodyRef.current, ' {{last_name}}', lines.slice(1).join('\n'), v => setBody(`${lines[0] ?? ''}\n${v}`))}><Braces /></Tool>
        </div>
        <div className="ml-auto flex items-center gap-2 lg:mr-[10px] lg:gap-[8px]">
          <div className="relative flex">
            <button type="button" disabled={!!noCreate || actions.pending} title={noCreate ?? undefined} onClick={() => actions.openEditor(state())} className={cn(PRIMARY, 'rounded-r-none lg:w-[52px]')}>Preview</button>
            <button type="button" aria-label="More compose actions" aria-haspopup="menu" aria-expanded={menu} disabled={!!noCreate} onClick={() => setMenu(m => !m)} className={cn(PRIMARY, 'rounded-l-none border-l border-white/25 px-2 lg:px-[5px]')}><ChevronDown className="h-3 w-3 lg:h-2.5 lg:w-2.5" /></button>
            {menu && (
              <div role="menu" className="absolute bottom-full right-0 z-40 mb-1 w-48 rounded-md border border-slate-200 bg-white py-1 shadow-lg">
                <MenuItem onClick={() => { setMenu(false); actions.save(state()) }}>Save draft</MenuItem>
                <MenuItem onClick={() => { setMenu(false); actions.openEditor(state()) }}>Open full editor</MenuItem>
                <MenuItem disabled={!canSubmit} onClick={() => { setMenu(false); actions.review(state()) }}>Submit for approval</MenuItem>
              </div>
            )}
          </div>
          <TestSendButton channel={channel} defaultAddress={channel === 'email' ? userEmail : ''} onSend={address => actions.test(state(), address)}
            disabledReason={!canTest ? 'Your role cannot send tests.' : noCreate} className="lg:w-[46px] lg:px-0" />
        </div>
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 shrink-0 text-[12px] text-slate-500 lg:w-[38px] lg:text-[8.5px]">{label}</span>
      <div className="min-w-0 flex-1 lg:max-w-[156px]">{children}</div>
    </div>
  )
}

function Tool({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick}
      className="flex h-8 w-8 items-center justify-center text-slate-500 hover:bg-slate-50 lg:h-full lg:w-[22px] [&>svg]:h-3.5 [&>svg]:w-3.5 lg:[&>svg]:h-[10px] lg:[&>svg]:w-[10px]">
      {children}
    </button>
  )
}

function MenuItem({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return <button type="button" role="menuitem" disabled={disabled} onClick={onClick} className="block w-full px-3 py-2 text-left text-[12px] text-slate-700 hover:bg-slate-50 disabled:text-slate-300">{children}</button>
}
