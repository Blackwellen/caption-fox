'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import {
  AlertTriangle, Bell, Check, CheckCheck, ChevronDown, Clock, FileText, History, Image as ImageIcon, Italic, Link2,
  Loader2, Mail, MoreHorizontal, Paperclip, RotateCcw, Smile, Sparkles, Star, Tag, UserCog, UserRound, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { markConversationRead, retryDelivery, sendReply, updateConversations, updateTags } from '@/lib/inbox/actions'
import type { ConversationDetail } from '@/lib/inbox/data'
import { CHANNEL_LABEL, formatAge, formatClock, formatCountdown, formatDayTime, minutesUntil, PRIORITY_LABEL } from '@/lib/inbox/format'
import type { MessageRow } from '@/lib/inbox/types'
import { Avatar, ChannelGlyph, Pill, tagTone, iconBtn } from './ui'
import { useNow } from './hooks'

export type ThreadVariant = 'unified' | 'assignments' | 'unassigned'

export interface ThreadPermissions {
  reply: boolean
  note: boolean
  close: boolean
  snooze: boolean
  tags: boolean
  assign: boolean
  ai: boolean
}

const EMOJI = ['\u{1F44B}', '\u{1F60A}', '\u{1F44D}', '\u{1F64F}', '\u{1F389}', '✅', '\u{1F4E6}', '\u{1F69A}', '\u{1F4AC}', '❤️', '\u{1F525}', '\u{1F440}']

export default function ThreadView({
  detail, variant, can, timezone, savedReplies = [], onOpenAssign,
}: {
  detail: ConversationDetail
  variant: ThreadVariant
  can: ThreadPermissions
  timezone: string
  savedReplies?: { id: string; title: string; content: string }[]
  onOpenAssign?: () => void
}) {
  const { conversation: c, contact } = detail
  const now = useNow(30_000)
  const [messages, setMessages] = useState<MessageRow[]>(detail.messages)
  const [mode, setMode] = useState<'reply' | 'note'>('reply')
  const [draft, setDraft] = useState('')
  const [aiAssisted, setAiAssisted] = useState(false)
  const [attachments, setAttachments] = useState<{ name: string; size: number; type: string; path: string }[]>([])
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [menu, setMenu] = useState<null | 'emoji' | 'template' | 'more' | 'close' | 'snooze' | 'tag' | 'send'>(null)
  const [tagInput, setTagInput] = useState('')
  const [pending, start] = useTransition()
  const [aiLoading, setAiLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)
  const textarea = useRef<HTMLTextAreaElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => { setMessages(detail.messages) }, [detail.messages])
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight })
    if (c.unread_count > 0) void markConversationRead(c.id)
  }, [c.id, c.unread_count, messages.length])

  const name = c.contact_name ?? c.sender_name ?? 'Unknown contact'
  const avatar = c.contact_avatar ?? c.sender_avatar
  const channelLabel = CHANNEL_LABEL[c.platform] ?? c.platform
  const dueMins = minutesUntil(c.sla_due_at, now)
  const canWrite = mode === 'note' ? can.note : can.reply

  function flash(text: string) { setNotice(text); setTimeout(() => setNotice(null), 3500) }

  async function send(close = false) {
    if (pending || !canWrite) return
    const body = draft.trim()
    if (!body && !attachments.length) { setError('Write a message before sending.'); return }
    setError(null)
    const optimistic: MessageRow = {
      id: `tmp-${Date.now()}`, thread_id: c.id, content: body, sender_type: 'internal', sent_by: null, sent_at: new Date().toISOString(),
      is_internal_note: mode === 'note', is_ai_generated: aiAssisted, delivery_status: 'pending', failure_reason: null, read_at: null, attachments, author_name: 'You',
    }
    setMessages(prev => [...prev, optimistic])
    const previous = { draft, attachments, aiAssisted }
    setDraft(''); setAttachments([]); setAiAssisted(false)
    start(async () => {
      const res = await sendReply({ threadId: c.id, body, mode, close, aiAssisted: previous.aiAssisted, attachments: previous.attachments })
      if (!res.ok) {
        setMessages(prev => prev.filter(m => m.id !== optimistic.id))
        setDraft(previous.draft); setAttachments(previous.attachments); setAiAssisted(previous.aiAssisted)
        setError(res.error)
        return
      }
      setMessages(prev => prev.map(m => m.id === optimistic.id ? { ...m, id: res.data!.messageId, delivery_status: res.data!.deliveryStatus as MessageRow['delivery_status'], failure_reason: res.data!.failureReason } : m))
      if (res.data?.deliveryStatus === 'failed') setError(res.data.failureReason ?? 'The reply could not be delivered.')
      else flash(mode === 'note' ? 'Internal note added' : close ? 'Reply sent and conversation closed' : 'Reply sent')
    })
  }

  function act(action: Parameters<typeof updateConversations>[0]['action'], extra: Partial<Parameters<typeof updateConversations>[0]> = {}, done?: string) {
    setMenu(null)
    start(async () => {
      const res = await updateConversations({ threadIds: [c.id], action, ...extra })
      if (!res.ok) setError(res.error)
      else if (done) flash(done)
    })
  }

  function addTag(tag: string) {
    const clean = tag.trim()
    if (!clean) return
    setMenu(null); setTagInput('')
    start(async () => {
      const res = await updateTags({ threadIds: [c.id], add: [clean] })
      if (!res.ok) setError(res.error)
      else flash(`Tag “${clean}” added`)
    })
  }

  async function aiDraft() {
    if (!can.ai || aiLoading) return
    setAiLoading(true); setError(null)
    try {
      const res = await fetch('/api/fox/inbox/draft', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ threadId: c.id, instruction: draft.trim() || undefined }) })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Fox AI could not draft a reply.')
      setDraft(json.draft); setAiAssisted(true); setMode('reply')
      textarea.current?.focus()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fox AI could not draft a reply.')
    } finally {
      setAiLoading(false)
    }
  }

  async function upload(files: FileList | null) {
    if (!files?.length) return
    setUploading(true); setError(null)
    try {
      for (const file of Array.from(files).slice(0, 5)) {
        const res = await fetch('/api/inbox/attachments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: file.name, size: file.size, type: file.type }) })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? 'Upload failed.')
        const put = await fetch(json.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file })
        if (!put.ok) throw new Error('Upload failed. Try again.')
        setAttachments(prev => [...prev, { name: file.name, size: file.size, type: file.type || 'file', path: json.path }])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.')
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const statusPill = c.lane === 'closed' ? <Pill tone="slate">Closed</Pill>
    : c.sla_status === 'breached' ? <Pill tone="red">Overdue</Pill>
    : c.requires_reply ? <Pill tone="purple">Awaiting reply</Pill>
    : <Pill tone="green">Open</Pill>

  const grouped = useMemo(() => {
    const out: { day: string; items: MessageRow[] }[] = []
    for (const m of messages) {
      const key = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: timezone }).format(new Date(m.sent_at))
      const today = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: timezone }).format(new Date(now))
      const label = key === today ? 'Today' : key
      if (!out.length || out[out.length - 1].day !== label) out.push({ day: label, items: [] })
      out[out.length - 1].items.push(m)
    }
    return out
  }, [messages, timezone, now])

  // ------------------------------------------------------------ header
  const header = variant === 'assignments' ? (
    <div className="border-b border-[#eef1f6] px-4 pb-3 pt-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="truncate text-[15px] font-semibold text-slate-900 lg:text-[12px]">{c.subject ?? c.last_message_preview ?? name}</h2>
          {c.sla_status === 'at_risk' || c.sla_status === 'breached' ? (
            <Pill tone="red"><span className="mr-1 h-1.5 w-1.5 rounded-full bg-rose-500" aria-hidden />{c.sla_status === 'breached' ? 'SLA breached' : 'SLA at risk'}</Pill>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1 text-slate-500">
          <HeaderIcon label="Star conversation" onClick={() => act('escalate', {}, 'Conversation escalated')} disabled={!can.assign}><Star size={13} /></HeaderIcon>
          <HeaderIcon label="Snooze" onClick={() => setMenu(menu === 'snooze' ? null : 'snooze')} disabled={!can.snooze}><Bell size={13} /></HeaderIcon>
          <HeaderIcon label="Activity" href="#thread-activity"><History size={13} /></HeaderIcon>
          <HeaderIcon label="Copy link" onClick={() => { void navigator.clipboard?.writeText(window.location.href); flash('Link copied') }}><Link2 size={13} /></HeaderIcon>
          <HeaderIcon label="More actions" onClick={() => setMenu(menu === 'more' ? null : 'more')}><MoreHorizontal size={14} /></HeaderIcon>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Avatar name={name} src={avatar} size={24} />
        <div className="min-w-0">
          <p className="text-[12px] font-semibold text-slate-900 lg:text-[10px]">{name}</p>
          <p className="truncate text-[11px] text-slate-500 lg:text-[9px]">{[c.contact_email, c.contact_phone].filter(Boolean).join('  •  ')}</p>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-500 lg:text-[9px]">
        <span className="flex items-center gap-1"><ChannelGlyph channel={c.platform} size={11} />{channelLabel}</span>
        <span className="flex items-center gap-1"><Clock size={10} aria-hidden />{formatDayTime(c.created_at, timezone)}</span>
        <span className={cn('flex items-center gap-1 font-medium', c.lane === 'closed' ? 'text-slate-500' : 'text-emerald-600')}>
          <span className={cn('h-1.5 w-1.5 rounded-full', c.lane === 'closed' ? 'bg-slate-400' : 'bg-emerald-500')} aria-hidden />{c.lane === 'closed' ? 'Closed' : 'Open'}
        </span>
      </div>
      <TagRow />
    </div>
  ) : variant === 'unassigned' ? (
    <div className="border-b border-[#eef1f6] px-5 pb-3 pt-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="relative">
            <Avatar name={name} src={avatar} size={36} />
            <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-white p-px"><ChannelGlyph channel={c.platform} size={11} /></span>
          </span>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold text-slate-900 lg:text-[12.5px]">{name}</p>
            <p className="flex items-center gap-1 text-[11px] text-slate-500 lg:text-[9.5px]"><ChannelGlyph channel={c.platform} size={10} />{channelLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {contact ? <Link href={`?${new URLSearchParams({ c: c.id, profile: '1' })}`} className="flex items-center gap-1.5 text-[12px] font-medium text-[#1769ff] hover:underline lg:text-[10px]"><UserRound size={12} aria-hidden />Contact profile</Link> : null}
          <button type="button" className={iconBtn} aria-label="More actions" onClick={() => setMenu(menu === 'more' ? null : 'more')}><MoreHorizontal size={14} /></button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 lg:text-[9.5px]">
        <div className="flex items-center gap-3">
          {c.sla_status === 'at_risk' || c.sla_status === 'breached' ? (
            <span className="flex items-center gap-1 rounded-md bg-rose-50 px-1.5 py-0.5 font-medium text-rose-600"><AlertTriangle size={10} aria-hidden />{c.sla_status === 'breached' ? 'SLA breached' : 'SLA at risk'}</span>
          ) : <Pill tone="green">On track</Pill>}
          <span>{dueMins == null ? 'No SLA' : dueMins < 0 ? `Response overdue by ${formatCountdown(-dueMins)}` : `Response due in ${formatCountdown(dueMins)}`}</span>
        </div>
        <span>First contact: {formatAge(c.created_at, now) === 'now' ? 'just now' : `${formatAge(c.created_at, now)} ago`}</span>
      </div>
    </div>
  ) : (
    <div className="border-b border-[#eef1f6]">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <ChannelGlyph channel={c.platform} size={16} />
          <Avatar name={name} src={avatar} size={32} />
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold text-slate-900 lg:text-[12px]">{name}</p>
            <p className="truncate text-[11px] text-slate-500 lg:text-[10px]">{c.contact_phone ?? c.contact_email ?? c.sender_handle}</p>
          </div>
        </div>
        <div className="relative flex shrink-0 items-center gap-1.5">
          <button type="button" className={iconBtn} aria-label="Assign conversation" onClick={onOpenAssign} disabled={!can.assign}><UserCog size={13} /></button>
          <button type="button" className={iconBtn} aria-label="Snooze conversation" onClick={() => setMenu(menu === 'snooze' ? null : 'snooze')} disabled={!can.snooze}><Clock size={13} /></button>
          <button type="button" className={iconBtn} aria-label="Add tag" onClick={() => setMenu(menu === 'tag' ? null : 'tag')} disabled={!can.tags}><Tag size={13} /></button>
          <button type="button" className={iconBtn} aria-label="More actions" onClick={() => setMenu(menu === 'more' ? null : 'more')}><MoreHorizontal size={14} /></button>
          <div className="flex h-9 overflow-hidden rounded-lg border border-[#e1e6ee] lg:h-[29px]">
            <button type="button" disabled={!can.close || pending} onClick={() => act(c.lane === 'closed' ? 'reopen' : 'close', {}, c.lane === 'closed' ? 'Conversation reopened' : 'Conversation closed')}
              className="px-3 text-[12px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 lg:text-[10.5px]">{c.lane === 'closed' ? 'Reopen' : 'Close'}</button>
            <button type="button" aria-label="Close options" disabled={!can.close} onClick={() => setMenu(menu === 'close' ? null : 'close')} className="border-l border-[#e1e6ee] px-2 text-slate-500 hover:bg-slate-50 disabled:opacity-50"><ChevronDown size={12} /></button>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-[#eef1f6] px-4 py-2 text-[11px] text-slate-600 lg:text-[9.5px]">
        <span className="flex items-center gap-1.5">Status: {statusPill}</span>
        <span className="flex items-center gap-1.5">Priority: <Pill tone="blue" className="border border-blue-100">{PRIORITY_LABEL[c.priority] ?? c.priority}</Pill></span>
        <span className="flex items-center gap-1.5">Channel: <Pill tone="green" className="gap-1"><ChannelGlyph channel={c.platform} size={10} />{channelLabel}</Pill></span>
      </div>
    </div>
  )

  function TagRow() {
    return (
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {c.priority === 'high' || c.priority === 'urgent' ? <Pill tone="red">{PRIORITY_LABEL[c.priority]} priority</Pill> : null}
        {(c.tags ?? []).map(tag => <Pill key={tag} tone={tagTone(tag)}>{tag}</Pill>)}
        {can.tags ? <button type="button" onClick={() => setMenu(menu === 'tag' ? null : 'tag')} className="text-[11px] text-slate-500 hover:text-slate-800 lg:text-[9px]">+ Add tag</button> : null}
      </div>
    )
  }

  // ------------------------------------------------------------ render
  return (
    <div className="relative flex h-full min-h-0 flex-col">
      {header}

      {menu && ['more', 'close', 'snooze', 'tag'].includes(menu) ? (
        <div role="menu" className="absolute right-4 top-12 z-20 w-56 rounded-xl border border-slate-200 bg-white p-1.5 text-[12px] shadow-lg">
          {menu === 'snooze' ? ([[60, '1 hour'], [240, '4 hours'], [1440, 'Tomorrow'], [10080, 'Next week']] as const).map(([mins, label]) => (
            <MenuItem key={label} onClick={() => act('snooze', { snoozeMinutes: Number(mins) }, `Snoozed until ${label.toLowerCase()}`)}>Snooze for {label}</MenuItem>
          )) : menu === 'tag' ? (
            <form onSubmit={e => { e.preventDefault(); addTag(tagInput) }} className="p-1">
              <label className="sr-only" htmlFor="tag-input">Tag name</label>
              <input id="tag-input" autoFocus value={tagInput} onChange={e => setTagInput(e.target.value)} placeholder="Add a tag…" maxLength={40}
                className="h-8 w-full rounded-md border border-slate-200 px-2 text-[12px] focus:border-blue-500 focus:outline-none" />
            </form>
          ) : menu === 'close' ? (
            <>
              <MenuItem onClick={() => act('close', {}, 'Conversation closed')}>Close conversation</MenuItem>
              <MenuItem onClick={() => act('snooze', { snoozeMinutes: 1440 }, 'Snoozed until tomorrow')}>Close and snooze 24h</MenuItem>
            </>
          ) : (
            <>
              {can.assign ? <MenuItem onClick={() => act('escalate', {}, 'Conversation escalated')}>Escalate</MenuItem> : null}
              {can.tags ? ['urgent', 'high', 'normal', 'low'].map(p => <MenuItem key={p} onClick={() => act('priority', { priority: p }, `Priority set to ${PRIORITY_LABEL[p]}`)}>Set priority: {PRIORITY_LABEL[p]}</MenuItem>) : null}
              {c.snoozed_until && can.snooze ? <MenuItem onClick={() => act('unsnooze', {}, 'Snooze removed')}>Remove snooze</MenuItem> : null}
              {c.lane === 'closed' && can.close ? <MenuItem onClick={() => act('reopen', {}, 'Conversation reopened')}>Reopen</MenuItem> : null}
            </>
          )}
        </div>
      ) : null}

      <div ref={scroller} className={cn('min-h-0 flex-1 overflow-y-auto', variant === 'assignments' ? 'space-y-2.5 px-3 py-3' : 'px-4 py-3')} aria-live="polite" aria-label={`Messages with ${name}`}>
        {grouped.map(group => (
          <div key={group.day}>
            {variant !== 'assignments' ? (
              <div className="my-2 flex items-center gap-3 text-[11px] text-slate-500 lg:text-[9.5px]" role="separator">
                <span className="h-px flex-1 bg-[#eef1f6]" />{group.day}<span className="h-px flex-1 bg-[#eef1f6]" />
              </div>
            ) : null}
            <div className={variant === 'assignments' ? 'space-y-2.5' : 'space-y-3'}>
              {group.items.map(m => variant === 'assignments'
                ? <CardMessage key={m.id} m={m} name={name} avatar={avatar} timezone={timezone} onRetry={id => start(async () => { const r = await retryDelivery(id); if (!r.ok) setError(r.error) })} />
                : <BubbleMessage key={m.id} m={m} variant={variant} timezone={timezone} onRetry={id => start(async () => { const r = await retryDelivery(id); if (!r.ok) setError(r.error) })} />)}
            </div>
          </div>
        ))}
        {!messages.length ? <p className="py-10 text-center text-[12px] text-slate-500">No messages yet.</p> : null}
        {variant === 'unassigned' ? <p className="mt-3 text-[10px] text-slate-400 lg:text-[8.5px]">via {channelLabel}</p> : null}
      </div>

      {/* Composer */}
      <div className={cn('shrink-0', variant === 'unified' ? 'px-3 pb-3' : 'px-3 pb-2.5')}>
        <div role="tablist" aria-label="Message type" className={cn('flex border-b border-[#eef1f6]', variant === 'unassigned' ? 'gap-6 px-2' : 'gap-5 px-2')}>
          {(['reply', 'note'] as const).map(t => (
            <button key={t} role="tab" type="button" aria-selected={mode === t} onClick={() => setMode(t)} disabled={t === 'note' ? !can.note : !can.reply}
              className={cn('-mb-px border-b-2 py-2 font-medium disabled:opacity-40', variant === 'unassigned' ? 'px-3 text-[13px] lg:text-[11px]' : 'px-2 text-[12px] lg:text-[10px]',
                mode === t ? 'border-[#1769ff] text-[#1769ff]' : 'border-transparent text-slate-600 hover:text-slate-900')}>
              {t === 'reply' ? 'Reply' : variant === 'unassigned' ? 'Note' : 'Internal note'}
            </button>
          ))}
        </div>

        <div className={cn('mt-2 rounded-xl border bg-white', mode === 'note' ? 'border-amber-200 bg-amber-50/40' : 'border-[#e6ebf2]')}>
          {!canWrite ? (
            <p className="px-3 py-4 text-[12px] text-slate-500">Your role can view this conversation but can’t {mode === 'note' ? 'add notes' : 'reply'}.</p>
          ) : (
            <>
              <label htmlFor={`composer-${c.id}`} className="sr-only">{mode === 'note' ? 'Internal note' : 'Reply'}</label>
              <textarea
                id={`composer-${c.id}`} ref={textarea} value={draft} maxLength={5000}
                onChange={e => { setDraft(e.target.value); if (!e.target.value) setAiAssisted(false) }}
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void send() } }}
                placeholder={mode === 'note' ? 'Add an internal note — only your team can see this…' : variant === 'unassigned' ? 'Type your message...' : 'Type your reply...'}
                className={cn('w-full resize-none bg-transparent px-3 pt-2.5 text-[13px] text-slate-800 placeholder:text-slate-400 focus:outline-none lg:text-[11px]', variant === 'unified' ? 'h-[70px]' : 'h-[46px]')}
              />
              {aiAssisted ? <p className="px-3 text-[10px] font-medium text-violet-600">Drafted by Fox AI — review before sending.</p> : null}
              {attachments.length ? (
                <div className="flex flex-wrap gap-1.5 px-3 pb-1">
                  {attachments.map(a => (
                    <span key={a.path} className="flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">
                      <FileText size={11} aria-hidden />{a.name}
                      <button type="button" aria-label={`Remove ${a.name}`} onClick={() => setAttachments(prev => prev.filter(x => x.path !== a.path))}><X size={11} /></button>
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="relative flex items-center justify-between gap-2 px-2 pb-2">
                <div className="flex items-center gap-1 text-slate-500">
                  <input ref={fileInput} type="file" multiple hidden accept="image/*,application/pdf,.doc,.docx,.xlsx,.csv,.txt" onChange={e => void upload(e.target.files)} />
                  {variant === 'assignments' ? (
                    <>
                      <ToolIcon label="Emoji" onClick={() => setMenu(menu === 'emoji' ? null : 'emoji')}><Smile size={13} /></ToolIcon>
                      <ToolIcon label="Attach file" onClick={() => fileInput.current?.click()}>{uploading ? <Loader2 size={13} className="animate-spin" /> : <Paperclip size={13} />}</ToolIcon>
                      <ToolIcon label="Insert link" onClick={() => setDraft(d => `${d}${d ? ' ' : ''}https://`)}><Link2 size={13} /></ToolIcon>
                      <ToolIcon label="Italic" onClick={() => setDraft(d => `${d}_text_`)}><Italic size={13} /></ToolIcon>
                      <ToolIcon label="Saved replies" onClick={() => setMenu(menu === 'template' ? null : 'template')}><Mail size={13} /></ToolIcon>
                      <ToolIcon label="Draft with Fox AI" onClick={() => void aiDraft()} disabled={!can.ai}>{aiLoading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}</ToolIcon>
                    </>
                  ) : (
                    <>
                      {variant === 'unassigned' ? <ToolIcon label="Emoji" onClick={() => setMenu(menu === 'emoji' ? null : 'emoji')}><Smile size={14} /></ToolIcon> : null}
                      <ToolIcon label="Attach file" boxed={variant === 'unified'} onClick={() => fileInput.current?.click()}>{uploading ? <Loader2 size={13} className="animate-spin" /> : <Paperclip size={13} />}</ToolIcon>
                      {variant === 'unified' ? <ToolIcon label="Emoji" boxed onClick={() => setMenu(menu === 'emoji' ? null : 'emoji')}><Smile size={13} /></ToolIcon> : null}
                      <ToolIcon label="Saved replies" boxed={variant === 'unified'} onClick={() => setMenu(menu === 'template' ? null : 'template')}><ImageIcon size={13} /></ToolIcon>
                      <ToolIcon label="Draft with Fox AI" boxed={variant === 'unified'} onClick={() => void aiDraft()} disabled={!can.ai}>{aiLoading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}</ToolIcon>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {variant === 'unified' && mode === 'reply' ? (
                    <div className="flex h-9 overflow-hidden rounded-lg border border-[#e1e6ee] lg:h-[29px]">
                      <button type="button" onClick={() => void send(true)} disabled={pending || !can.close} className="px-3 text-[12px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 lg:text-[10.5px]">Send and close</button>
                      <button type="button" aria-label="More send options" onClick={() => setMenu(menu === 'send' ? null : 'send')} className="border-l border-[#e1e6ee] px-2 text-slate-500 hover:bg-slate-50"><ChevronDown size={12} /></button>
                    </div>
                  ) : null}
                  <div className={cn('flex h-9 overflow-hidden rounded-lg bg-[#1769ff] text-white lg:h-[29px]', variant === 'unified' && 'lg:w-[85px]')}>
                    <button type="button" onClick={() => void send()} disabled={pending} className="flex flex-1 items-center justify-center gap-1 px-3 text-[12px] font-semibold hover:bg-[#0f5ce5] disabled:opacity-70 lg:text-[10.5px]">
                      {pending ? <Loader2 size={12} className="animate-spin" /> : null}{mode === 'note' ? 'Add note' : 'Send'}
                    </button>
                    <button type="button" aria-label="Schedule or snooze after sending" onClick={() => setMenu(menu === 'send' ? null : 'send')} className="border-l border-white/25 px-1.5 hover:bg-[#0f5ce5]"><ChevronDown size={12} /></button>
                  </div>
                </div>

                {menu === 'emoji' ? (
                  <div className="absolute bottom-11 left-2 z-20 grid grid-cols-6 gap-1 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                    {EMOJI.map(e => <button key={e} type="button" className="h-8 w-8 rounded-md text-[16px] hover:bg-slate-100" onClick={() => { setDraft(d => d + e); setMenu(null); textarea.current?.focus() }}>{e}</button>)}
                  </div>
                ) : null}
                {menu === 'template' ? (
                  <div className="absolute bottom-11 left-2 z-20 max-h-56 w-64 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
                    {savedReplies.length ? savedReplies.map(r => (
                      <MenuItem key={r.id} onClick={() => { setDraft(r.content); setMenu(null) }}>{r.title}</MenuItem>
                    )) : <p className="px-2 py-3 text-[12px] text-slate-500">No saved replies yet. Create them in Messaging templates.</p>}
                  </div>
                ) : null}
                {menu === 'send' ? (
                  <div className="absolute bottom-11 right-2 z-20 w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
                    <MenuItem onClick={() => { setMenu(null); void send(true) }}>Send and close</MenuItem>
                    <MenuItem onClick={() => { setMenu(null); void send().then(() => act('snooze', { snoozeMinutes: 1440 }, 'Sent and snoozed until tomorrow')) }}>Send and snooze 24h</MenuItem>
                  </div>
                ) : null}
              </div>
            </>
          )}
        </div>
        {variant === 'assignments' ? <p className="mt-1 text-right text-[10px] text-slate-400 lg:text-[8.5px]">Press ⌘ Enter to send</p> : null}
        {error ? <p role="alert" className="mt-1.5 flex items-center gap-1 text-[11px] text-rose-600"><AlertTriangle size={11} aria-hidden />{error}</p> : null}
        {notice ? <p role="status" className="mt-1.5 flex items-center gap-1 text-[11px] text-emerald-600"><Check size={11} aria-hidden />{notice}</p> : null}
      </div>
    </div>
  )
}

function BubbleMessage({ m, variant, timezone, onRetry }: { m: MessageRow; variant: ThreadVariant; timezone: string; onRetry: (id: string) => void }) {
  const outbound = m.sender_type !== 'external'
  if (m.is_internal_note) {
    return (
      <div className="mx-auto max-w-[85%] rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900 lg:text-[10px]">
        <p className="mb-0.5 font-semibold">Internal note{m.author_name ? ` • ${m.author_name}` : ''}</p>
        <p className="whitespace-pre-wrap">{m.content}</p>
      </div>
    )
  }
  return (
    <div className={cn('flex', outbound ? 'justify-end' : 'justify-start')}>
      <div className={cn('max-w-[72%] rounded-[14px] px-3.5 py-2.5',
        outbound ? 'bg-[#e9f1ff] text-slate-800' : variant === 'unassigned' ? 'border border-[#e6ebf2] bg-white text-slate-800' : 'bg-[#f3f5f9] text-slate-800')}>
        <p className={cn('whitespace-pre-wrap leading-[1.55]', variant === 'unified' ? 'text-[13px] lg:text-[11px]' : 'text-[12.5px] lg:text-[10.5px]', outbound && variant === 'unified' && 'text-[#1d4ed8]')}>{m.content}</p>
        {m.attachments?.length ? <Attachments list={m.attachments} /> : null}
        <div className={cn('mt-1.5 flex items-center gap-3 text-[10px] text-slate-500 lg:text-[8.5px]', outbound ? 'justify-between' : 'justify-between')}>
          <span>{formatClock(m.sent_at, timezone)}</span>
          {outbound ? <DeliveryMark m={m} onRetry={onRetry} /> : variant === 'unified' ? <CheckCheck size={11} className="text-blue-500" aria-label="Read" /> : null}
        </div>
      </div>
    </div>
  )
}

function CardMessage({ m, name, avatar, timezone, onRetry }: { m: MessageRow; name: string; avatar: string | null; timezone: string; onRetry: (id: string) => void }) {
  const inbound = m.sender_type === 'external'
  const author = inbound ? name : m.author_name ?? 'Team member'
  if (m.is_internal_note && /assigned to .* by rule/i.test(m.content)) {
    return (
      <div className="rounded-lg border border-[#eef1f6] bg-white px-3 py-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex gap-2">
            <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 text-slate-400"><RotateCcw size={10} aria-hidden /></span>
            <div>
              <p className="text-[12px] font-medium text-slate-800 lg:text-[10px]">System note</p>
              <p className="text-[11px] text-slate-500 lg:text-[8.5px]">{formatDayTime(m.sent_at, timezone)}</p>
              <p className="mt-2 text-[12px] text-slate-700 lg:text-[9.5px]">{m.content}</p>
            </div>
          </div>
          <Pill tone="slate" className="border border-slate-200 bg-white">Internal</Pill>
        </div>
      </div>
    )
  }
  return (
    <div className="rounded-lg border border-[#eef1f6] bg-white px-3 py-2.5">
      <div className="flex gap-2">
        <Avatar name={author} src={inbound ? avatar : m.author_avatar} size={20} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-[12px] font-medium text-slate-800 lg:text-[10px]">
            {author}
            {m.is_internal_note ? <span className="text-[10px] font-medium text-orange-500 lg:text-[8.5px]">Internal note</span> : null}
            {m.is_internal_note ? <span className="text-[10px] font-normal text-slate-500 lg:text-[8.5px]">{formatDayTime(m.sent_at, timezone)}</span> : null}
          </p>
          {!m.is_internal_note ? <p className="text-[11px] text-slate-500 lg:text-[8.5px]">{formatDayTime(m.sent_at, timezone)}</p> : null}
          <div className={cn('mt-2 whitespace-pre-wrap text-[12px] leading-relaxed text-slate-700 lg:text-[9.5px]', m.is_internal_note && 'rounded-md bg-amber-50 px-2.5 py-2 text-slate-700')}>{m.content}</div>
          {m.attachments?.length ? <Attachments list={m.attachments} /> : null}
          {!inbound && !m.is_internal_note ? <div className="mt-1 flex justify-end"><DeliveryMark m={m} onRetry={onRetry} /></div> : null}
        </div>
      </div>
    </div>
  )
}

function DeliveryMark({ m, onRetry }: { m: MessageRow; onRetry: (id: string) => void }) {
  if (m.delivery_status === 'pending') return <Loader2 size={10} className="animate-spin text-slate-400" aria-label="Sending" />
  if (m.delivery_status === 'failed') {
    return (
      <span className="flex items-center gap-1 text-rose-600" title={m.failure_reason ?? undefined}>
        <AlertTriangle size={10} aria-hidden />Not delivered
        {!m.id.startsWith('tmp-') ? <button type="button" onClick={() => onRetry(m.id)} className="font-semibold underline">Retry</button> : null}
      </span>
    )
  }
  if (m.delivery_status === 'simulated') return <span className="flex items-center gap-1 text-blue-500" title="Demo conversation: recorded without contacting the channel"><CheckCheck size={11} aria-label="Recorded (demo)" /></span>
  return m.read_at ? <CheckCheck size={11} className="text-blue-500" aria-label="Read" /> : <Check size={11} className="text-slate-400" aria-label="Delivered" />
}

function Attachments({ list }: { list: MessageRow['attachments'] }) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {list.map(a => a.url ? (
        <a key={a.path} href={a.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-50">
          <FileText size={11} aria-hidden />{a.name}
        </a>
      ) : <span key={a.path} className="flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-400"><FileText size={11} aria-hidden />{a.name} (unavailable)</span>)}
    </div>
  )
}

function MenuItem({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return <button type="button" role="menuitem" onClick={onClick} className="block w-full rounded-md px-2.5 py-1.5 text-left text-[12px] text-slate-700 hover:bg-slate-100">{children}</button>
}

function ToolIcon({ children, label, onClick, disabled, boxed }: { children: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; boxed?: boolean }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled}
      className={cn('flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40 lg:h-6 lg:w-6', boxed && 'border border-[#e6ebf2] lg:h-[25px] lg:w-[25px]')}>
      {children}
    </button>
  )
}

function HeaderIcon({ children, label, onClick, href, disabled }: { children: React.ReactNode; label: string; onClick?: () => void; href?: string; disabled?: boolean }) {
  const cls = 'flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40 lg:h-6 lg:w-6'
  return href ? <a href={href} aria-label={label} title={label} className={cls}>{children}</a>
    : <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled} className={cls}>{children}</button>
}
