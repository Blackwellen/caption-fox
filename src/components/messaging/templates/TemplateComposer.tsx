'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Save } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/campaigns/Toast'
import { createMessagingTemplate } from '@/app/app/messaging/actions'
import { CHANNEL_LABELS, MESSAGING_CHANNELS, type MessagingChannel } from '@/lib/messaging/constants'

const FIELD = 'w-full rounded-lg border border-slate-200 px-3 text-[13px] text-slate-700 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100'
const CATEGORIES = ['lifecycle', 'transactional', 'promotional', 'retention', 'engagement']

export default function TemplateComposer({ channels }: { channels: MessagingChannel[] }) {
  const router = useRouter()
  const { notify } = useToast()
  const [pending, startTransition] = useTransition()

  const [channel, setChannel] = useState<MessagingChannel>(channels[0] ?? 'email')
  const [name, setName] = useState('')
  const [category, setCategory] = useState('lifecycle')
  const [subject, setSubject] = useState('')
  const [headline, setHeadline] = useState('')
  const [body, setBody] = useState('')

  const showSubject = channel === 'email'
  const showHeadline = channel === 'push' || channel === 'rcs'

  function handleSave() {
    startTransition(async () => {
      const res = await createMessagingTemplate({
        name, channel, category,
        content: { subject: showSubject ? subject : undefined, headline: showHeadline ? headline : undefined, body },
      })
      if (!res.ok) { notify('error', res.error ?? 'Could not create template.'); return }
      notify('success', res.message ?? 'Template created.')
      router.push('/app/messaging/templates')
      router.refresh()
    })
  }

  return (
    <div className="max-w-2xl space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-[11px] font-medium text-slate-500">Channel</label>
          <select className={cn(FIELD, 'h-9')} value={channel} onChange={e => setChannel(e.target.value as MessagingChannel)}>
            {(channels.length ? channels : MESSAGING_CHANNELS).map(c => <option key={c} value={c}>{CHANNEL_LABELS[c]}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium text-slate-500">Category</label>
          <select className={cn(FIELD, 'h-9')} value={category} onChange={e => setCategory(e.target.value)}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-[11px] font-medium text-slate-500">Template name</label>
        <input className={cn(FIELD, 'h-9')} value={name} onChange={e => setName(e.target.value)} placeholder="Welcome Series — Email 1" />
      </div>

      {showSubject && (
        <div>
          <label className="mb-1 block text-[11px] font-medium text-slate-500">Subject</label>
          <input className={cn(FIELD, 'h-9')} value={subject} onChange={e => setSubject(e.target.value)} placeholder="Welcome to Acme! Here's what's next" />
        </div>
      )}
      {showHeadline && (
        <div>
          <label className="mb-1 block text-[11px] font-medium text-slate-500">{channel === 'push' ? 'Title' : 'Headline'}</label>
          <input className={cn(FIELD, 'h-9')} value={headline} onChange={e => setHeadline(e.target.value)} placeholder="New arrivals are here" />
        </div>
      )}

      <div>
        <label className="mb-1 block text-[11px] font-medium text-slate-500">Content</label>
        <textarea
          className={cn(FIELD, 'min-h-[140px] resize-y py-2')} value={body} onChange={e => setBody(e.target.value)}
          placeholder="Hi {{first_name}}, thanks for joining! ..."
        />
      </div>

      <button
        type="button" onClick={handleSave} disabled={pending || !name || !body}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-[13px] font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
      >
        {pending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
        Save template
      </button>
    </div>
  )
}
