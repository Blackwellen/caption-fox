'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Bookmark, BookmarkCheck, GitCompareArrows, Loader2, Trash2, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { buildMarketplaceHref, type MarketplaceQuery } from '@/lib/marketplace/query'
import {
  toggleSavedSupplier, toggleShortlist, removeSavedItem, updateSavedNote,
} from '@/lib/marketplace/actions'

/** Save / unsave a supplier. Optimistic, and rolls back if the server refuses. */
export function SaveButton({
  supplierId, saved, disabled, variant = 'icon', label,
}: {
  supplierId: string
  saved: boolean
  disabled?: boolean
  variant?: 'icon' | 'button' | 'overlay'
  label?: string
}) {
  const router = useRouter()
  const [optimistic, setOptimistic] = useState(saved)
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function onClick(event: React.MouseEvent) {
    event.preventDefault()
    event.stopPropagation()
    if (disabled) return
    const next = !optimistic
    setOptimistic(next)
    setError(null)
    start(async () => {
      const result = await toggleSavedSupplier(supplierId)
      if (!result.ok) {
        setOptimistic(!next)
        setError(result.error ?? 'Could not update saved items.')
      } else {
        router.refresh()
      }
    })
  }

  const title = disabled
    ? 'Saving suppliers is not available for your role'
    : optimistic ? 'Remove from saved' : 'Save supplier'
  const Icon = pending ? Loader2 : optimistic ? BookmarkCheck : Bookmark

  if (variant === 'overlay') {
    return (
      <button
        type="button" onClick={onClick} disabled={disabled} title={error ?? title} aria-label={title}
        aria-pressed={optimistic}
        className={cn(
          'absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 shadow-sm transition',
          optimistic ? 'text-blue-600' : 'text-slate-500 hover:text-slate-900',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        <Icon size={15} className={pending ? 'animate-spin' : undefined} />
      </button>
    )
  }

  if (variant === 'button') {
    return (
      <button
        type="button" onClick={onClick} disabled={disabled} title={error ?? title} aria-pressed={optimistic}
        className={cn(
          'inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition',
          optimistic ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        <Icon size={13} className={pending ? 'animate-spin' : undefined} />
        {label ?? (optimistic ? 'Saved' : 'Save')}
      </button>
    )
  }

  return (
    <button
      type="button" onClick={onClick} disabled={disabled} title={error ?? title} aria-label={title} aria-pressed={optimistic}
      className={cn(
        'rounded-lg border border-slate-200 p-1.5 transition',
        optimistic ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <Icon size={14} className={pending ? 'animate-spin' : undefined} />
    </button>
  )
}

/**
 * Adds or removes a profile from the comparison tray. Comparison state lives in
 * the URL so it survives refresh and can be shared.
 */
export function CompareButton({
  supplierId, query, pathname, limit, disabled, variant = 'button', label = 'Compare',
}: {
  supplierId: string
  query: MarketplaceQuery
  pathname: string
  limit: number
  disabled?: boolean
  variant?: 'button' | 'icon' | 'checkbox'
  label?: string
}) {
  const router = useRouter()
  const selected = query.compare.includes(supplierId)
  const full = !selected && query.compare.length >= limit

  function onClick(event: React.MouseEvent) {
    event.preventDefault()
    event.stopPropagation()
    if (disabled || full) return
    const next = selected
      ? query.compare.filter(id => id !== supplierId)
      : [...query.compare, supplierId]
    router.push(buildMarketplaceHref(pathname, query, { compare: next, page: query.page }), { scroll: false })
  }

  const title = disabled
    ? 'Comparison is not available for your role'
    : full ? `You can compare up to ${limit} profiles` : selected ? 'Remove from comparison' : 'Add to comparison'

  if (variant === 'checkbox') {
    return (
      <label className={cn('inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-600',
        (disabled || full) && 'cursor-not-allowed opacity-50')}>
        <input
          type="checkbox" checked={selected} disabled={disabled || full} readOnly
          onClick={onClick as unknown as React.MouseEventHandler<HTMLInputElement>}
          className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          aria-label={title}
        />
        {label}
      </label>
    )
  }

  if (variant === 'icon') {
    return (
      <button
        type="button" onClick={onClick} disabled={disabled || full} title={title} aria-label={title} aria-pressed={selected}
        className={cn('rounded-lg border border-slate-200 p-1.5 transition',
          selected ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50',
          (disabled || full) && 'cursor-not-allowed opacity-50')}
      >
        <GitCompareArrows size={14} />
      </button>
    )
  }

  return (
    <button
      type="button" onClick={onClick} disabled={disabled || full} title={title} aria-pressed={selected}
      className={cn(
        'inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition',
        selected ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50',
        (disabled || full) && 'cursor-not-allowed opacity-50',
      )}
    >
      <GitCompareArrows size={13} />{selected ? 'Selected' : label}
    </button>
  )
}

export function ShortlistButton({
  supplierId, shortlisted, disabled,
}: {
  supplierId: string
  shortlisted: boolean
  disabled?: boolean
}) {
  const router = useRouter()
  const [optimistic, setOptimistic] = useState(shortlisted)
  const [pending, start] = useTransition()

  function onClick(event: React.MouseEvent) {
    event.preventDefault()
    if (disabled) return
    const next = !optimistic
    setOptimistic(next)
    start(async () => {
      const result = await toggleShortlist(supplierId)
      if (!result.ok) setOptimistic(!next)
      else router.refresh()
    })
  }

  return (
    <button
      type="button" onClick={onClick} disabled={disabled} aria-pressed={optimistic}
      title={disabled ? 'Shortlisting is not available for your role' : optimistic ? 'Remove from shortlist' : 'Add to shortlist'}
      className={cn(
        'inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition',
        optimistic ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      {pending ? <Loader2 size={13} className="animate-spin" /> : <Bookmark size={13} />}
      {optimistic ? 'Shortlisted' : 'Shortlist'}
    </button>
  )
}

/** Saved-page row controls: editable note plus removal. */
export function SavedItemControls({
  savedItemId, note, canEdit,
}: {
  savedItemId: string
  note: string | null
  canEdit: boolean
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(note ?? '')
  const [pending, start] = useTransition()
  const [saved, setSaved] = useState(false)

  if (!canEdit) {
    return <p className="text-xs text-slate-500">{note || 'No note added.'}</p>
  }

  if (!editing) {
    return (
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 flex-1 text-xs text-slate-500">{value || 'Add a note about this partner…'}</p>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button" onClick={() => setEditing(true)}
            className="text-[11px] font-medium text-blue-600 hover:text-blue-700"
          >
            {value ? 'Edit note' : 'Add note'}
          </button>
          <button
            type="button"
            aria-label="Remove from saved"
            onClick={() => start(async () => { await removeSavedItem(savedItemId); router.refresh() })}
            className="rounded p-1 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
          >
            {pending ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        value={value}
        onChange={event => setValue(event.target.value)}
        aria-label="Saved item note"
        maxLength={500}
        className="h-8 min-w-0 flex-1 rounded-md border border-slate-200 px-2 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      <button
        type="button" disabled={pending}
        onClick={() => start(async () => {
          const result = await updateSavedNote(savedItemId, value)
          if (result.ok) { setSaved(true); setEditing(false); router.refresh() }
        })}
        className="inline-flex h-8 items-center gap-1 rounded-md bg-blue-600 px-2.5 text-xs font-medium text-white disabled:opacity-60"
      >
        {pending ? <Loader2 size={12} className="animate-spin" /> : saved ? <Check size={12} /> : null}Save
      </button>
      <button
        type="button" onClick={() => { setEditing(false); setValue(note ?? '') }}
        className="h-8 rounded-md border border-slate-200 px-2 text-xs text-slate-600"
      >
        Cancel
      </button>
    </div>
  )
}
