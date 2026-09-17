'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AtSign, ChevronDown, FileText, Hash, Image as ImageIcon, Loader2, Paperclip, Smile, Tag, UserPlus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { assignConversation, sendReply, updateConversation, type ActionResult } from '@/lib/social/actions'
import { FormError } from '../Dialog'
import { Kebab, Menu } from '../controls'

// Client controls for the selected conversation on Social Engagement: the
// header sentiment/assign/more controls and the reply composer. Every change
// goes through a server action that re-checks permission and ownership.

const SENTIMENT_STYLE: Record<string, string> = {
  positive: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  neutral: 'border-slate-200 bg-slate-50 text-slate-600',
  negative: 'border-red-200 bg-red-50 text-red-600',
}

function useRun() {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [result, setResult] = useState<ActionResult | null>(null)
  const run = (fn: () => Promise<ActionResult>, after?: () => void) => {
    if (pending) return
    setResult(null)
    start(async () => {
      const outcome = await fn()
      setResult(outcome)
      if (outcome.ok) { after?.(); router.refresh() }
    })
  }
  return { pending, result, run }
}

export function ThreadHeaderControls({ conversationId, sentiment, status, isFlagged, assignedTo, members, detailHref, can }: {
  conversationId: string
  sentiment: string | null
  status: string
  isFlagged: boolean
  assignedTo: string | null
  members: { id: string; name: string }[]
  detailHref: string
  can: { assign: boolean; resolve: boolean; moderate: boolean }
}) {
  const { pending, result, run } = useRun()
  const current = sentiment ?? 'neutral'
  const resolved = status === 'resolved' || status === 'done'
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <label className="relative inline-flex">
          <span className="sr-only">Sentiment</span>
          <span aria-hidden className={cn('pointer-events-none inline-flex h-8 items-center gap-1 rounded-md border px-2 text-[12px] font-medium capitalize lg:h-[20px] lg:text-[9px]', SENTIMENT_STYLE[current])}>
            {current}<ChevronDown size={11} />
          </span>
          <select value={current} disabled={pending} onChange={event => run(() => updateConversation({ conversationId, sentiment: event.target.value as 'positive' | 'neutral' | 'negative' }))}
            className="absolute inset-0 cursor-pointer appearance-none opacity-0">
            <option value="positive">Positive</option><option value="neutral">Neutral</option><option value="negative">Negative</option>
          </select>
        </label>
        <Kebab label="Conversation options">
          <button type="button" disabled={!can.resolve || pending} onClick={() => run(() => updateConversation({ conversationId, status: resolved ? 'open' : 'resolved' }))}>{resolved ? 'Reopen conversation' : 'Mark resolved'}</button>
          <button type="button" disabled={!can.moderate || pending} onClick={() => run(() => updateConversation({ conversationId, isFlagged: !isFlagged }))}>{isFlagged ? 'Remove flag' : 'Flag for review'}</button>
          <button type="button" disabled={pending} onClick={() => run(() => updateConversation({ conversationId, isRead: false }))}>Mark as unread</button>
          <Link href={detailHref}>Open full conversation</Link>
        </Kebab>
        <Menu
          label="Assign conversation" width="w-52"
          triggerClassName={cn('inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium text-blue-600 hover:bg-slate-50 disabled:opacity-50 lg:h-[30px] lg:text-[10.5px]', !can.assign && 'pointer-events-none opacity-50')}
          trigger={<>{pending ? <Loader2 size={13} className="animate-spin" aria-hidden /> : <UserPlus size={13} aria-hidden />} {assignedTo ? members.find(member => member.id === assignedTo)?.name.split(' ')[0] ?? 'Assigned' : 'Assign'}</>}
        >
          <button type="button" onClick={() => run(() => assignConversation(conversationId, null))}>Unassigned</button>
          {members.map(member => (
            <button key={member.id} type="button" onClick={() => run(() => assignConversation(conversationId, member.id))} className={cn(member.id === assignedTo && '!font-semibold !text-blue-700')}>{member.name}</button>
          ))}
        </Menu>
      </div>
      {result && !result.ok && <FormError message={result.message} reference={result.reference} />}
    </div>
  )
}

const MODES = [
  { value: 'reply', label: 'Reply' }, { value: 'note', label: 'Note' },
  { value: 'internal_comment', label: 'Internal Comment' }, { value: 'dm', label: 'DM' },
] as const

export function ReplyComposer({ conversationId, sentiment, tags, templates, canReply, dmSupported }: {
  conversationId: string
  sentiment: string | null
  tags: string[]
  templates: { id: string; title: string; content: string }[]
  canReply: boolean
  dmSupported: boolean
}) {
  const { pending, result, run } = useRun()
  const [mode, setMode] = useState<(typeof MODES)[number]['value']>('reply')
  const [body, setBody] = useState('')
  const [tone, setTone] = useState(sentiment ?? 'neutral')
  const [tagText, setTagText] = useState('')
  const outbound = mode === 'reply' || mode === 'dm'
  const blocked = outbound && !canReply ? 'Your role cannot send replies.' : mode === 'dm' && !dmSupported ? 'This platform does not support direct messages through its API.' : null

  const insert = (text: string) => setBody(current => `${current}${current && !current.endsWith(' ') ? ' ' : ''}${text}`)
  const submit = () => {
    if (!body.trim() || blocked) return
    const added = tagText.split(',').map(tag => tag.trim()).filter(Boolean)
    const tagList = added.length ? [...new Set([...tags, ...added])].slice(0, 10) : undefined
    run(() => sendReply({ conversationId, body, mode, sentiment: tone, tags: tagList }), () => { setBody(''); setTagText('') })
  }

  return (
    <form className="rounded-xl border border-slate-200 bg-white" onSubmit={event => { event.preventDefault(); submit() }}>
      <div role="tablist" aria-label="Message type" className="flex gap-1 overflow-x-auto overflow-y-hidden border-b border-slate-100 px-3">
        {MODES.map(item => (
          <button key={item.value} type="button" role="tab" aria-selected={mode === item.value} onClick={() => setMode(item.value)}
            className={cn('-mb-px h-10 shrink-0 whitespace-nowrap border-b-2 px-2.5 text-[13px] font-medium lg:h-[32px] lg:text-[10px]', mode === item.value ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800')}>
            {item.label}
          </button>
        ))}
      </div>
      <div className="p-3">
        <div className={cn('rounded-lg border border-slate-200 focus-within:border-blue-400', !outbound && 'bg-amber-50/40')}>
          <label htmlFor="engagement-reply" className="sr-only">{outbound ? 'Write a reply' : 'Write an internal note'}</label>
          <textarea
            id="engagement-reply" rows={3} maxLength={2000} value={body}
            onChange={event => setBody(event.target.value)}
            onKeyDown={event => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); submit() } }}
            placeholder={outbound ? 'Write a reply...' : 'Only your team can see this.'}
            className="block w-full resize-none rounded-lg bg-transparent px-3 py-2 text-[13.5px] text-slate-800 placeholder:text-slate-400 focus:outline-none lg:text-[11px]"
          />
          <div className="flex items-center gap-1 px-2 pb-1.5 text-slate-400">
            {[
              { label: 'Insert emoji', icon: <Smile size={14} />, text: '🙂' },
              { label: 'Insert mention', icon: <AtSign size={14} />, text: '@' },
              { label: 'Insert hashtag', icon: <Hash size={14} />, text: '#' },
            ].map(item => (
              <button key={item.label} type="button" aria-label={item.label} title={item.label} onClick={() => insert(item.text)} className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-100 hover:text-slate-700 lg:h-6 lg:w-6">{item.icon}</button>
            ))}
            <span className="flex h-8 w-8 items-center justify-center lg:h-6 lg:w-6" title="Attachments are added from Brand & Assets in the post composer"><ImageIcon size={14} aria-hidden /></span>
            <span className="flex h-8 w-8 items-center justify-center lg:h-6 lg:w-6" title="File attachments are not supported for replies by the platform APIs"><Paperclip size={14} aria-hidden /></span>
            <span className="ml-auto text-[11px] tabular-nums lg:text-[8.5px]">{body.length} / 2000</span>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="relative inline-flex">
            <span className="sr-only">Sentiment for this conversation</span>
            <span aria-hidden className="pointer-events-none inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-[12.5px] capitalize text-slate-700 lg:h-[30px] lg:text-[9.5px]">
              <Smile size={13} className="text-emerald-600" />{tone}<ChevronDown size={11} className="text-slate-400" />
            </span>
            <select value={tone} onChange={event => setTone(event.target.value)} className="absolute inset-0 cursor-pointer appearance-none opacity-0">
              <option value="positive">Positive</option><option value="neutral">Neutral</option><option value="negative">Negative</option>
            </select>
          </label>
          <label className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-[12.5px] text-slate-700 lg:h-[30px] lg:text-[9.5px]">
            <Tag size={13} className="text-slate-400" aria-hidden />
            <span className="sr-only">Tags, separated by commas</span>
            <input value={tagText} onChange={event => setTagText(event.target.value)} placeholder="Add Tags" maxLength={200} className="w-20 bg-transparent placeholder:text-slate-600 focus:outline-none" />
          </label>
          <label className="relative inline-flex">
            <span className="sr-only">Use a saved reply template</span>
            <span aria-hidden className="pointer-events-none inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-[12.5px] text-slate-700 lg:h-[30px] lg:text-[9.5px]">
              <FileText size={13} className="text-slate-400" />Use Template<ChevronDown size={11} className="text-slate-400" />
            </span>
            <select value="" disabled={templates.length === 0} onChange={event => { const template = templates.find(item => item.id === event.target.value); if (template) setBody(template.content) }}
              className="absolute inset-0 cursor-pointer appearance-none opacity-0">
              <option value="">{templates.length ? 'Choose a template' : 'No saved replies'}</option>
              {templates.map(template => <option key={template.id} value={template.id}>{template.title}</option>)}
            </select>
          </label>
          <button type="submit" disabled={pending || !body.trim() || Boolean(blocked)} title={blocked ?? undefined}
            className="ml-auto inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-4 text-[13px] font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 lg:h-[30px] lg:px-5 lg:text-[10.5px]">
            {pending && <Loader2 size={13} className="animate-spin" aria-hidden />}
            {mode === 'reply' ? 'Send Reply' : mode === 'dm' ? 'Send DM' : mode === 'note' ? 'Add Note' : 'Add Comment'}
          </button>
        </div>
        {result && (result.ok
          ? <p role="status" className="mt-2 text-[12px] text-emerald-700">{result.message}</p>
          : <div className="mt-2"><FormError message={result.message} reference={result.reference} /></div>)}
      </div>
    </form>
  )
}
