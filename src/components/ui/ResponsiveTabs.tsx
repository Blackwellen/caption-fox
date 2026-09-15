'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface TabItem {
  id: string
  label: string
  href: string
  badge?: string | number
}

/**
 * Standing rule for every tab-style navigation row in Caption Fox: desktop,
 * tablet and mobile each get a genuinely different layout rather than one
 * layout squeezed down.
 *
 * - Desktop (lg+): a normal horizontal tab row.
 * - Tablet (sm–lg): a horizontally scrollable, pill-style sliding tray —
 *   holds more items than fit without wrapping or clipping.
 * - Mobile (<sm): a dropdown showing the active tab, opening a list to jump
 *   to another one. A tab row never survives mobile width intact.
 */
export default function ResponsiveTabs({ items, isActive, ariaLabel, className }: {
  items: TabItem[]
  isActive: (item: TabItem) => boolean
  ariaLabel: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const active = items.find(isActive) ?? items[0]

  return (
    <div className={className}>
      {/* Mobile: dropdown selector */}
      <div className="relative sm:hidden">
        <button
          type="button" onClick={() => setOpen(v => !v)} aria-expanded={open} aria-haspopup="listbox"
          className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] font-medium text-slate-700"
        >
          <span className="truncate">{active?.label}</span>
          <ChevronDown size={15} className={cn('shrink-0 text-slate-400 transition-transform', open && 'rotate-180')} />
        </button>
        {open && (
          <>
            <button type="button" className="fixed inset-0 z-20 cursor-default" aria-label="Close" onClick={() => setOpen(false)} />
            <div role="listbox" aria-label={ariaLabel} className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
              {items.map(item => (
                <Link
                  key={item.id} href={item.href} role="option" aria-selected={isActive(item)}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'flex items-center justify-between rounded-lg px-3 py-2 text-[13px]',
                    isActive(item) ? 'bg-blue-50 font-medium text-blue-700' : 'text-slate-600 hover:bg-slate-50',
                  )}
                >
                  <span className="truncate">{item.label}</span>
                  {item.badge !== undefined && <span className="ml-2 shrink-0 text-[11px] text-slate-400">{item.badge}</span>}
                </Link>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Tablet: sliding segmented tray */}
      <nav aria-label={ariaLabel} className="hidden overflow-x-auto sm:block lg:hidden">
        <ul className="flex min-w-max snap-x gap-1 rounded-lg bg-slate-100 p-1">
          {items.map(item => (
            <li key={item.id} className="snap-start">
              <Link
                href={item.href} aria-current={isActive(item) ? 'page' : undefined}
                className={cn(
                  'inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium transition-colors',
                  isActive(item) ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800',
                )}
              >
                {item.label}
                {item.badge !== undefined && <span className="text-[11px] opacity-60">{item.badge}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Desktop: standard tab row */}
      <nav aria-label={ariaLabel} className="hidden lg:block">
        <ul className="flex min-w-max items-center gap-1">
          {items.map(item => (
            <li key={item.id}>
              <Link
                href={item.href} aria-current={isActive(item) ? 'page' : undefined}
                className={cn(
                  'inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition-colors',
                  isActive(item) ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700',
                )}
              >
                {item.label}
                {item.badge !== undefined && <span className="text-[11px] opacity-60">{item.badge}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
