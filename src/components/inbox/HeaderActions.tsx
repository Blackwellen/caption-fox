'use client'

import { useState, useTransition } from 'react'
import { ChevronDown, Download, Info, MoreHorizontal, Plus, Star, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import { assignConversations, saveView, updateConversations } from '@/lib/inbox/actions'
import type { ConversationFilters, ConversationSort } from '@/lib/inbox/types'
import { openFox } from '@/components/fox-ai/events'
import { btnPrimary, btnSecondary, iconBtn } from './ui'
import { useInboxUrl } from './hooks'

export function TitleAddons({ filters, sort, canSave, info }: { filters: ConversationFilters; sort: ConversationSort; canSave: boolean; info: string }) {
  const [saved, setSaved] = useState(false)
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  return (
    <span className="flex items-center gap-2 text-slate-500">
      <span title={info} aria-label={info} role="img" className="cursor-help"><Info size={14} /></span>
      <button type="button" aria-label={saved ? 'Saved to your views' : 'Save these filters as a pinned view'} title={saved ? 'Saved to your views' : 'Save these filters as a pinned view'}
        disabled={!canSave || pending || saved}
        onClick={() => start(async () => {
          const res = await saveView({ name: `Unified • ${new Date().toLocaleDateString('en-GB')}`, filters, sort, visibility: 'personal', folder: 'Favourites' })
          if (res.ok) setSaved(true); else setError(res.error)
        })}
        className="rounded p-0.5 hover:text-amber-500 disabled:cursor-default">
        <Star size={15} className={cn(saved && 'fill-amber-400 text-amber-400')} />
      </button>
      {error ? <span className="text-[11px] text-rose-600">{error}</span> : null}
    </span>
  )
}

export function UnifiedHeaderActions({ pageThreadIds, canBulk, canExport, canImport, canReply, userId }: {
  pageThreadIds: string[]; canBulk: boolean; canExport: boolean; canImport: boolean; canReply: boolean; userId: string
}) {
  const { params } = useInboxUrl()
  const [open, setOpen] = useState<null | 'bulk' | 'more'>(null)
  const [pending, start] = useTransition()
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)

  function bulk(label: string, fn: () => Promise<{ ok: boolean; error?: string; data?: { updated: number } }>, confirmText?: string) {
    setOpen(null)
    if (!pageThreadIds.length) { setMessage({ tone: 'error', text: 'There are no conversations on this page.' }); return }
    if (confirmText && !window.confirm(confirmText)) return
    start(async () => {
      const res = await fn()
      setMessage(res.ok ? { tone: 'ok', text: `${label}: ${res.data?.updated ?? pageThreadIds.length} conversations` } : { tone: 'error', text: res.error ?? 'Bulk action failed.' })
    })
  }

  return (
    <div className="relative flex flex-wrap items-center gap-2">
      <button type="button" className={cn(btnPrimary, 'lg:px-[18px]')} disabled={!canReply} onClick={() => openFox({ tab: 'contacts' })}>
        <Plus size={14} aria-hidden />New message
      </button>
      <div className="relative">
        <button type="button" className={btnSecondary} aria-expanded={open === 'bulk'} disabled={!canBulk || pending} onClick={() => setOpen(open === 'bulk' ? null : 'bulk')}
          title={canBulk ? undefined : 'Bulk actions need a Team plan and a manager role'}>
          Bulk actions <ChevronDown size={13} aria-hidden />
        </button>
        {open === 'bulk' ? (
          <div role="menu" className="absolute right-0 top-full z-30 mt-1 w-64 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
            <p className="px-2.5 pb-1 pt-0.5 text-[11px] text-slate-500">Applies to the {pageThreadIds.length} conversations on this page</p>
            <MenuItem onClick={() => bulk('Assigned to you', () => assignConversations({ threadIds: pageThreadIds, userId }))}>Assign all to me</MenuItem>
            <MenuItem onClick={() => bulk('Snoozed', () => updateConversations({ threadIds: pageThreadIds, action: 'snooze', snoozeMinutes: 1440 }))}>Snooze all until tomorrow</MenuItem>
            <MenuItem onClick={() => bulk('Priority set', () => updateConversations({ threadIds: pageThreadIds, action: 'priority', priority: 'high' }))}>Set priority to High</MenuItem>
            <MenuItem danger onClick={() => bulk('Closed', () => updateConversations({ threadIds: pageThreadIds, action: 'close' }), `Close all ${pageThreadIds.length} conversations on this page?`)}>Close all</MenuItem>
          </div>
        ) : null}
      </div>
      <button type="button" className={btnSecondary} disabled={!canImport} onClick={() => openFox({ tab: 'contacts', prompt: 'import' })} title={canImport ? 'Import contacts from CSV' : 'Importing needs a manager role'}>
        <Upload size={13} aria-hidden />Import
      </button>
      <a className={cn(btnSecondary, !canExport && 'pointer-events-none opacity-50')} aria-disabled={!canExport} href={canExport ? `/api/inbox/export?${params.toString()}` : undefined} title={canExport ? 'Export the current view as CSV' : 'Export needs a manager role'}>
        <Download size={13} aria-hidden />Export
      </a>
      <div className="relative">
        <button type="button" className={iconBtn} aria-label="More" aria-expanded={open === 'more'} onClick={() => setOpen(open === 'more' ? null : 'more')}><MoreHorizontal size={15} /></button>
        {open === 'more' ? (
          <div role="menu" className="absolute right-0 top-full z-30 mt-1 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
            <MenuItem onClick={() => { setOpen(null); openFox({ tab: 'copilot', prompt: '/summarise inbox backlog' }) }}>Summarise backlog with Fox AI</MenuItem>
            <MenuItem onClick={() => { setOpen(null); window.location.reload() }}>Refresh</MenuItem>
          </div>
        ) : null}
      </div>
      {message ? <p role={message.tone === 'error' ? 'alert' : 'status'} className={cn('w-full text-right text-[11px]', message.tone === 'error' ? 'text-rose-600' : 'text-emerald-600')}>{message.text}</p> : null}
    </div>
  )
}

function MenuItem({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return <button type="button" role="menuitem" onClick={onClick} className={cn('block w-full rounded-md px-2.5 py-1.5 text-left text-[12px] hover:bg-slate-100', danger ? 'text-rose-600' : 'text-slate-700')}>{children}</button>
}
