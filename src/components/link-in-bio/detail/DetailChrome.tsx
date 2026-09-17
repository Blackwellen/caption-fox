'use client'

import { useRef, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { Check, Loader2, Pencil, X } from 'lucide-react'
import ResponsiveTabs, { type TabItem } from '@/components/ui/ResponsiveTabs'
import type { ActionResult } from '@/lib/link-in-bio/actions'
import { useAction } from '../client'

// Pieces shared by every detail page (Link Page, Reusable Link, Theme): the
// editable title and the deep-linkable underline tabs.

export function DetailTabs({ base, tabs, ariaLabel }: { base: string; tabs: { id: string; label: string }[]; ariaLabel: string }) {
  const pathname = usePathname()
  const items: TabItem[] = tabs.map(tab => ({ id: tab.id, label: tab.label, href: `${base}/${tab.id}` }))
  return (
    <div className="border-b border-slate-200">
      <ResponsiveTabs items={items} ariaLabel={ariaLabel} desktop="underline" desktopItemClassName="h-10 px-3 text-[12.5px] first:pl-0"
        isActive={item => pathname === item.href || (item.id === tabs[0].id && pathname === base)} />
    </div>
  )
}

export function EditableTitle({ value, canEdit, onSave, maxLength = 80 }: { value: string; canEdit: boolean; onSave: (next: string) => Promise<ActionResult<unknown>>; maxLength?: number }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const input = useRef<HTMLInputElement | null>(null)
  const { run, pending } = useAction()
  const save = () => {
    const next = draft.trim()
    if (!next || next === value) { setEditing(false); setDraft(value); return }
    run(() => onSave(next), { success: 'Name updated' }, () => setEditing(false))
  }
  if (editing) {
    return (
      <form className="flex items-center gap-1.5" onSubmit={event => { event.preventDefault(); save() }}>
        <label className="sr-only" htmlFor="detail-title">Name</label>
        <input id="detail-title" ref={input} autoFocus value={draft} maxLength={maxLength} onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Escape') { setEditing(false); setDraft(value) } }}
          className="h-9 w-[min(420px,70vw)] rounded-lg border border-blue-300 px-2.5 text-[20px] font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
        <button type="submit" disabled={pending} className="rounded-md p-1.5 text-emerald-600 hover:bg-emerald-50" aria-label="Save name">{pending ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}</button>
        <button type="button" onClick={() => { setEditing(false); setDraft(value) }} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Cancel rename"><X size={16} /></button>
      </form>
    )
  }
  return (
    <div className="flex min-w-0 items-center gap-2">
      <h1 className="truncate text-[22px] font-semibold leading-tight tracking-[-0.015em] text-slate-900">{value}</h1>
      {canEdit && (
        <button type="button" onClick={() => setEditing(true)} className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800" aria-label="Rename">
          <Pencil size={14} />
        </button>
      )}
    </div>
  )
}

export function MetaItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] text-slate-500">{label}</p>
      <div className="mt-0.5 truncate text-[11.5px] text-slate-800">{children}</div>
    </div>
  )
}
