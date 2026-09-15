'use client'

import { useState, useRef } from 'react'
import { Plus, Pin, PinOff, Share2, Trash2, Search, BookMarked } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { createClient } from '@/lib/supabase/client'
import { cn, formatRelative } from '@/lib/utils'
import type { InboxSavedView } from '@/types/database'
import { createSavedView, updateSavedView, deleteSavedView, recordSavedViewUsage } from '@/lib/inbox/queries'
import { InboxThreePane } from './InboxThreePane'
import type { ThreadFilters, ThreadSort } from '@/lib/inbox/queries'

const STATUS_OPTIONS = ['open', 'assigned', 'resolved', 'spam', 'done']
const PRIORITY_OPTIONS = ['low', 'normal', 'high', 'urgent']

export function SavedViewsManager({
  workspaceId, currentUserId, canReply, canAssign, initialViews,
}: { workspaceId: string; currentUserId: string; canReply: boolean; canAssign: boolean; initialViews: InboxSavedView[] }) {
  const [views, setViews] = useState(initialViews)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<InboxSavedView | null>(views.find(v => v.is_pinned) ?? views[0] ?? null)
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<string[]>([])
  const [priority, setPriority] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const sb = useRef(createClient()).current

  const filtered = views.filter(v => v.name.toLowerCase().includes(search.toLowerCase()))
  const pinned = filtered.filter(v => v.is_pinned)
  const rest = filtered.filter(v => !v.is_pinned)

  async function togglePin(v: InboxSavedView) {
    const { view } = await updateSavedView(sb, v.id, { is_pinned: !v.is_pinned })
    if (view) setViews(prev => prev.map(x => x.id === view.id ? view : x))
  }

  async function toggleShare(v: InboxSavedView) {
    const { view } = await updateSavedView(sb, v.id, { is_shared: !v.is_shared })
    if (view) setViews(prev => prev.map(x => x.id === view.id ? view : x))
  }

  async function remove(v: InboxSavedView) {
    await deleteSavedView(sb, v.id)
    setViews(prev => prev.filter(x => x.id !== v.id))
    if (selected?.id === v.id) setSelected(null)
  }

  async function select(v: InboxSavedView) {
    setSelected(v)
    const { view } = await recordSavedViewUsage(sb, v.id, v.usage_count)
    if (view) setViews(prev => prev.map(x => x.id === view.id ? view : x))
  }

  async function createView() {
    if (!name.trim()) return
    setSaving(true)
    const filters: ThreadFilters = { status: status.length ? status : undefined, priority: priority.length ? priority : undefined }
    const { view } = await createSavedView(sb, { workspaceId, name: name.trim(), description: description.trim() || undefined, filters, sort: 'newest', createdBy: currentUserId })
    if (view) {
      setViews(prev => [view, ...prev])
      setSelected(view)
      setName(''); setDescription(''); setStatus([]); setPriority([])
      setCreateOpen(false)
    }
    setSaving(false)
  }

  const selectedFilters = (selected?.filters ?? {}) as ThreadFilters
  const selectedSort = (selected?.sort ?? 'newest') as ThreadSort

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><BookMarked size={17} /></div>
          <div>
            <p className="font-semibold text-slate-900">Saved Views <span className="ml-1 text-sm font-normal text-slate-400">{views.length}</span></p>
            <p className="text-xs text-slate-500">Reusable filters your team can jump to instantly</p>
          </div>
        </div>
        <Button size="sm" icon={<Plus size={14} />} onClick={() => setCreateOpen(true)}>New Saved View</Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
        <div className="space-y-3">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search views…" className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-3 text-sm" />
          </div>

          {filtered.length === 0 ? (
            <EmptyState icon={BookMarked} title="No saved views yet" description="Create one from your current filters to reuse it later." compact />
          ) : (
            <div className="space-y-4">
              {pinned.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Pinned</p>
                  <div className="space-y-1.5">{pinned.map(v => <ViewRow key={v.id} view={v} active={selected?.id === v.id} onSelect={() => select(v)} onPin={() => togglePin(v)} onShare={() => toggleShare(v)} onDelete={() => remove(v)} />)}</div>
                </div>
              )}
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">All views</p>
                <div className="space-y-1.5">{rest.map(v => <ViewRow key={v.id} view={v} active={selected?.id === v.id} onSelect={() => select(v)} onPin={() => togglePin(v)} onShare={() => toggleShare(v)} onDelete={() => remove(v)} />)}</div>
              </div>
            </div>
          )}
        </div>

        <div>
          {!selected ? (
            <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white">
              <EmptyState icon={BookMarked} title="Select a saved view" description="Pick a view on the left to preview its matching conversations." compact />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-900">{selected.name}</p>
                    {selected.description && <p className="text-sm text-slate-500">{selected.description}</p>}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(selectedFilters.status ?? []).map(s => <Badge key={s} variant="blue">{s}</Badge>)}
                    {(selectedFilters.priority ?? []).map(p => <Badge key={p} variant="amber">{p}</Badge>)}
                  </div>
                </div>
                <p className="mt-2 text-xs text-slate-400">Used {selected.usage_count} times{selected.last_used_at ? ` · last used ${formatRelative(selected.last_used_at)}` : ''} · {selected.is_shared ? 'Shared with workspace' : 'Private'}</p>
              </div>
              <InboxThreePane
                workspaceId={workspaceId}
                currentUserId={currentUserId}
                canReply={canReply}
                canAssign={canAssign}
                scope="unified"
                baseFilters={{}}
                savedViewFilters={selectedFilters}
              />
            </div>
          )}
        </div>
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New Saved View" size="sm">
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. High priority WhatsApp" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Description (optional)</label>
            <input value={description} onChange={e => setDescription(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-slate-600">Status</p>
            <div className="flex flex-wrap gap-1">
              {STATUS_OPTIONS.map(s => <button key={s} onClick={() => setStatus(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])} className={cn('rounded-full px-2 py-0.5 text-xs font-medium', status.includes(s) ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600')}>{s}</button>)}
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-slate-600">Priority</p>
            <div className="flex flex-wrap gap-1">
              {PRIORITY_OPTIONS.map(p => <button key={p} onClick={() => setPriority(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])} className={cn('rounded-full px-2 py-0.5 text-xs font-medium', priority.includes(p) ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600')}>{p}</button>)}
            </div>
          </div>
          <Button className="w-full" loading={saving} disabled={!name.trim()} onClick={createView}>Save View</Button>
        </div>
      </Modal>
    </div>
  )
}

function ViewRow({ view, active, onSelect, onPin, onShare, onDelete }: { view: InboxSavedView; active: boolean; onSelect: () => void; onPin: () => void; onShare: () => void; onDelete: () => void }) {
  return (
    <div className={cn('group flex items-center gap-1 rounded-lg border px-2 py-2', active ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50')}>
      <button onClick={onSelect} className="min-w-0 flex-1 text-left">
        <p className="truncate text-sm font-medium text-slate-800">{view.name}</p>
        <p className="text-xs text-slate-400">{view.usage_count} uses</p>
      </button>
      <button onClick={onPin} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title={view.is_pinned ? 'Unpin' : 'Pin'}>{view.is_pinned ? <PinOff size={13} /> : <Pin size={13} />}</button>
      <button onClick={onShare} className={cn('rounded p-1 hover:bg-slate-100', view.is_shared ? 'text-blue-500' : 'text-slate-400')} title={view.is_shared ? 'Shared' : 'Private'}><Share2 size={13} /></button>
      <button onClick={onDelete} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Delete"><Trash2 size={13} /></button>
    </div>
  )
}
