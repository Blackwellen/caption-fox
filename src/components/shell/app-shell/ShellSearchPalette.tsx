'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CornerDownLeft, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ResolvedAction, ShellNavigation } from '@/lib/navigation/types'
import { NAV_ICONS } from './icons'

interface Entry extends ResolvedAction { group: 'Go to' | 'Create' | 'Help' }

/**
 * Context search (Ctrl/⌘ K). Its index is built only from the navigation and
 * actions already resolved for this user and context, so it can never surface
 * a module, workspace or record the user is not authorised for.
 */
export default function ShellSearchPalette({ open, onClose, nav }: { open: boolean; onClose: () => void; nav: ShellNavigation }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)

  const entries = useMemo<Entry[]>(() => [
    ...nav.groups.flatMap(group => group.items.map(item => ({ id: `go-${item.id}`, label: item.label, icon: item.icon, href: item.href, group: 'Go to' as const }))),
    ...(nav.primaryAction?.type === 'create' ? nav.primaryAction.items.map(item => ({ ...item, id: `create-${item.id}`, group: 'Create' as const })) : []),
    ...nav.helpMenu.map(item => ({ ...item, id: `help-${item.id}`, group: 'Help' as const })),
  ], [nav])

  const results = useMemo(() => {
    const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean)
    if (terms.length === 0) return entries
    return entries.filter(entry => terms.every(term => `${entry.label} ${entry.group}`.toLowerCase().includes(term)))
  }, [entries, query])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  if (!open) return null

  const active = Math.min(cursor, Math.max(results.length - 1, 0))

  function go(entry: Entry | undefined) {
    if (!entry) return
    onClose()
    router.push(entry.href)
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'ArrowDown') { event.preventDefault(); setCursor((active + 1) % Math.max(results.length, 1)) }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setCursor((active - 1 + results.length) % Math.max(results.length, 1)) }
    else if (event.key === 'Enter') { event.preventDefault(); go(results[active]) }
    else if (event.key === 'Escape') { event.preventDefault(); onClose() }
  }

  let lastGroup = ''

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-[12vh]">
      <button type="button" tabIndex={-1} aria-label="Close search" onClick={onClose} className="absolute inset-0 bg-[#0a1630]/30 backdrop-blur-[2px]" />
      <div role="dialog" aria-modal="true" aria-label="Search" className="cf-shell-pop relative w-full max-w-[620px] overflow-hidden rounded-2xl border border-shell-border bg-white shadow-shell-pop">
        <div className="flex items-center gap-3 border-b border-shell-border-soft px-4">
          <Search size={18} aria-hidden className="shrink-0 text-shell-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={event => { setQuery(event.target.value); setCursor(0) }}
            onKeyDown={onKeyDown}
            placeholder={nav.searchPlaceholder}
            role="combobox"
            aria-expanded="true"
            aria-controls="cf-search-results"
            aria-activedescendant={results[active] ? `cf-search-${results[active].id}` : undefined}
            aria-autocomplete="list"
            maxLength={120}
            className="h-14 min-w-0 flex-1 bg-transparent text-[15px] text-shell-text outline-none placeholder:text-shell-muted"
          />
          <kbd className="rounded-md border border-shell-border px-1.5 py-0.5 font-sans text-[11px] text-shell-muted">Esc</kbd>
        </div>
        <ul id="cf-search-results" role="listbox" aria-label="Results" className="max-h-[min(60vh,420px)] overflow-y-auto p-2">
          {results.length === 0 && (
            <li className="px-3 py-8 text-center text-[13.5px] text-shell-muted">No sections or actions match “{query}”.</li>
          )}
          {results.map((entry, index) => {
            const Icon = NAV_ICONS[entry.icon]
            const header = entry.group !== lastGroup ? entry.group : null
            lastGroup = entry.group
            return (
              <li key={entry.id} role="presentation">
                {header && <p className="px-3 pb-1 pt-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-shell-muted">{header}</p>}
                <div
                  id={`cf-search-${entry.id}`}
                  role="option"
                  aria-selected={index === active}
                  onMouseEnter={() => setCursor(index)}
                  onClick={() => go(entry)}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-[14px]',
                    index === active ? 'bg-shell-blue-soft text-shell-blue' : 'text-shell-text-2',
                  )}
                >
                  <Icon size={17} aria-hidden className={index === active ? 'text-shell-blue' : 'text-shell-icon'} />
                  <span className="flex-1 truncate font-medium">{entry.label}</span>
                  {index === active && <CornerDownLeft size={14} aria-hidden />}
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
