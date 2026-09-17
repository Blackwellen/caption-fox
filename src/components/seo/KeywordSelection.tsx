'use client'

import { createContext, useCallback, useContext, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { MoreHorizontal, Star, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { updateKeywordsBulk, type KeywordBulkOperation } from '@/lib/seo/actions'

interface SelectionApi {
  selected: Set<string>
  toggle: (id: string) => void
  toggleAll: (ids: string[]) => void
  clear: () => void
  run: (operation: KeywordBulkOperation, ids?: string[]) => void
  pending: boolean
  canEdit: boolean
  canArchive: boolean
  clusters: { id: string; name: string }[]
}

const SelectionContext = createContext<SelectionApi | null>(null)

function useSelection(): SelectionApi {
  const api = useContext(SelectionContext)
  if (!api) throw new Error('Keyword selection controls must be rendered inside <KeywordSelectionProvider>')
  return api
}

/**
 * Owns keyword row selection and the bulk edits it enables. Every mutation
 * goes through the `updateKeywordsBulk` server action, which re-scopes each id
 * to the caller's workspace and site, so selection state in the browser can
 * never widen what the edit touches.
 */
export function KeywordSelectionProvider({
  canEdit, canArchive, clusters, children,
}: {
  canEdit: boolean
  canArchive: boolean
  clusters: { id: string; name: string }[]
  children: React.ReactNode
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const toggle = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleAll = useCallback((ids: string[]) => {
    setSelected(prev => (ids.every(id => prev.has(id)) ? new Set() : new Set(ids)))
  }, [])

  const clear = useCallback(() => setSelected(new Set()), [])

  const run = useCallback((operation: KeywordBulkOperation, ids?: string[]) => {
    const target = ids ?? [...selected]
    if (target.length === 0 || pending) return
    setError(null)
    startTransition(async () => {
      const result = await updateKeywordsBulk(target, operation)
      if (!result.ok) { setError(result.error ?? 'Could not update those keywords.'); return }
      setSelected(new Set())
      router.refresh()
    })
  }, [selected, pending, router])

  const api = useMemo<SelectionApi>(
    () => ({ selected, toggle, toggleAll, clear, run, pending, canEdit, canArchive, clusters }),
    [selected, toggle, toggleAll, clear, run, pending, canEdit, canArchive, clusters],
  )

  return (
    <SelectionContext.Provider value={api}>
      {error && (
        <p role="alert" className="border-b border-red-100 bg-red-50 px-4 py-2 text-[12px] text-red-700">{error}</p>
      )}
      {children}
    </SelectionContext.Provider>
  )
}

/** Header checkbox that selects or clears every row on the current page. */
export function SelectAllCheckbox({ ids }: { ids: string[] }) {
  const { selected, toggleAll, canEdit } = useSelection()
  if (!canEdit || ids.length === 0) return null
  const all = ids.every(id => selected.has(id))
  const some = !all && ids.some(id => selected.has(id))
  return (
    <input
      type="checkbox"
      checked={all}
      ref={el => { if (el) el.indeterminate = some }}
      onChange={() => toggleAll(ids)}
      aria-label={all ? 'Clear selection' : 'Select all keywords on this page'}
      className="h-3.5 w-3.5 cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-blue-500"
    />
  )
}

export function RowCheckbox({ id, keyword }: { id: string; keyword: string }) {
  const { selected, toggle, canEdit } = useSelection()
  if (!canEdit) return null
  return (
    <input
      type="checkbox"
      checked={selected.has(id)}
      onChange={() => toggle(id)}
      aria-label={`Select ${keyword}`}
      className="h-3.5 w-3.5 cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-blue-500"
    />
  )
}

/** Star toggle — a real `is_favourite` write, not a display-only icon. */
export function FavouriteToggle({ id, keyword, favourite }: { id: string; keyword: string; favourite: boolean }) {
  const { run, canEdit, pending } = useSelection()
  if (!canEdit) {
    return favourite ? <Star size={13} className="fill-amber-400 text-amber-400" aria-label="Starred" /> : null
  }
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => run({ type: 'favourite', favourite: !favourite }, [id])}
      aria-pressed={favourite}
      aria-label={favourite ? `Unstar ${keyword}` : `Star ${keyword}`}
      className="rounded text-slate-300 transition-colors hover:text-amber-400 disabled:opacity-50"
    >
      <Star size={13} className={favourite ? 'fill-amber-400 text-amber-400' : ''} aria-hidden />
    </button>
  )
}

/** Per-row overflow menu holding the same operations as the bulk bar. */
export function RowActionsMenu({ id, keyword, favourite }: { id: string; keyword: string; favourite: boolean }) {
  const { run, canEdit, canArchive, clusters, pending } = useSelection()
  const [open, setOpen] = useState(false)
  if (!canEdit && !canArchive) return null

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions for ${keyword}`}
        className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600"
      >
        <MoreHorizontal size={14} aria-hidden />
      </button>
      {open && (
        <>
          <button aria-hidden tabIndex={-1} className="fixed inset-0 z-10 cursor-default" onClick={() => setOpen(false)} />
          <div role="menu" className="absolute right-0 z-20 mt-1 w-52 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
            {canEdit && (
              <>
                <MenuButton onClick={() => { setOpen(false); run({ type: 'favourite', favourite: !favourite }, [id]) }} disabled={pending}>
                  {favourite ? 'Remove star' : 'Star keyword'}
                </MenuButton>
                <MenuLabel>Set status</MenuLabel>
                {['winning', 'rising', 'stable', 'declining'].map(status => (
                  <MenuButton key={status} onClick={() => { setOpen(false); run({ type: 'status', status }, [id]) }} disabled={pending}>
                    {status[0].toUpperCase() + status.slice(1)}
                  </MenuButton>
                ))}
                {clusters.length > 0 && (
                  <>
                    <MenuLabel>Move to cluster</MenuLabel>
                    {clusters.slice(0, 6).map(cluster => (
                      <MenuButton key={cluster.id} onClick={() => { setOpen(false); run({ type: 'cluster', clusterId: cluster.id }, [id]) }} disabled={pending}>
                        {cluster.name}
                      </MenuButton>
                    ))}
                    <MenuButton onClick={() => { setOpen(false); run({ type: 'cluster', clusterId: null }, [id]) }} disabled={pending}>
                      Remove from cluster
                    </MenuButton>
                  </>
                )}
              </>
            )}
            {canArchive && (
              <>
                <div className="my-1 border-t border-slate-100" />
                <MenuButton tone="danger" onClick={() => { setOpen(false); run({ type: 'archive' }, [id]) }} disabled={pending}>
                  Archive keyword
                </MenuButton>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

/** Sticky bar shown once rows are selected. */
export function BulkActionBar() {
  const { selected, clear, run, canEdit, canArchive, clusters, pending } = useSelection()
  const count = selected.size
  if (count === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-blue-100 bg-blue-50/70 px-4 py-2">
      <p className="text-[12px] font-medium text-blue-800">
        {count} keyword{count === 1 ? '' : 's'} selected
      </p>
      {canEdit && (
        <>
          <select
            name="bulk-status"
            defaultValue=""
            disabled={pending}
            onChange={event => { if (event.target.value) run({ type: 'status', status: event.target.value }) }}
            aria-label="Set status for selected keywords"
            className="h-7 rounded-lg border border-blue-200 bg-white px-2 text-[11.5px] font-medium text-slate-700"
          >
            <option value="">Set status…</option>
            {['winning', 'rising', 'stable', 'declining', 'not_ranking'].map(status => (
              <option key={status} value={status}>{status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
            ))}
          </select>
          {clusters.length > 0 && (
            <select
              name="bulk-cluster"
              defaultValue=""
              disabled={pending}
              onChange={event => { if (event.target.value) run({ type: 'cluster', clusterId: event.target.value === '__none' ? null : event.target.value }) }}
              aria-label="Move selected keywords to a cluster"
              className="h-7 rounded-lg border border-blue-200 bg-white px-2 text-[11.5px] font-medium text-slate-700"
            >
              <option value="">Move to cluster…</option>
              {clusters.map(cluster => <option key={cluster.id} value={cluster.id}>{cluster.name}</option>)}
              <option value="__none">Remove from cluster</option>
            </select>
          )}
        </>
      )}
      {canArchive && (
        <button
          type="button"
          disabled={pending}
          onClick={() => run({ type: 'archive' })}
          className="h-7 rounded-lg border border-red-200 bg-white px-2.5 text-[11.5px] font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          Archive
        </button>
      )}
      <button
        type="button"
        onClick={clear}
        className="ml-auto inline-flex h-7 items-center gap-1 rounded-lg px-2 text-[11.5px] font-medium text-blue-700 hover:bg-blue-100"
      >
        <X size={12} aria-hidden />
        Clear
      </button>
      {pending && <span className="text-[11.5px] text-blue-700">Saving…</span>}
    </div>
  )
}

function MenuLabel({ children }: { children: React.ReactNode }) {
  return <p className="px-3 pb-0.5 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{children}</p>
}

function MenuButton({
  children, onClick, disabled, tone,
}: { children: React.ReactNode; onClick: () => void; disabled?: boolean; tone?: 'danger' }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'block w-full px-3 py-1.5 text-left text-[12.5px] hover:bg-slate-50 disabled:opacity-50',
        tone === 'danger' ? 'text-red-600' : 'text-slate-700',
      )}
    >
      {children}
    </button>
  )
}
