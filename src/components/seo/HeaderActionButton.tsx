'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ChevronDown, Plus } from 'lucide-react'

export interface HeaderActionMenuItem {
  label: string
  description?: string
  href?: string
  onSelect?: () => void
}

/**
 * The primary header action shared by every SEO surface. Matches SeoHeader's
 * control height and, when `menu` is supplied, renders the split-button caret
 * from the approved references. Every menu entry routes somewhere real — the
 * caret is never a decorative affordance.
 */
export function HeaderActionButton({
  label, onClick, variant = 'button', menu,
}: {
  label: string
  onClick: () => void
  variant?: 'button' | 'link'
  menu?: HeaderActionMenuItem[]
}) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  if (variant === 'link') {
    return <button type="button" onClick={onClick} className="text-sm font-medium text-blue-600 hover:text-blue-700">{label}</button>
  }

  const primary = (
    <button
      type="button"
      onClick={onClick}
      className={
        'inline-flex h-8 items-center gap-1.5 bg-blue-600 px-3.5 text-[12.5px] font-medium text-white transition-colors hover:bg-blue-700 '
        + (menu && menu.length > 0 ? 'rounded-l-lg' : 'rounded-lg')
      }
    >
      <Plus size={14} aria-hidden />
      {label}
    </button>
  )

  if (!menu || menu.length === 0) return primary

  return (
    <div className="relative inline-flex">
      {primary}
      <span aria-hidden className="w-px self-stretch bg-blue-500/60" />
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`More ${label.toLowerCase()} options`}
        className="inline-flex h-8 items-center rounded-r-lg bg-blue-600 px-2 text-white transition-colors hover:bg-blue-700"
      >
        <ChevronDown size={14} aria-hidden />
      </button>
      {open && (
        <>
          <button aria-hidden tabIndex={-1} className="fixed inset-0 z-10 cursor-default" onClick={() => setOpen(false)} />
          <div role="menu" className="absolute right-0 top-full z-20 mt-1 w-64 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
            {menu.map(item => {
              const body = (
                <>
                  <span className="block text-sm font-medium text-slate-800">{item.label}</span>
                  {item.description && <span className="mt-0.5 block text-xs text-slate-500">{item.description}</span>}
                </>
              )
              return item.href
                ? (
                  <Link key={item.label} role="menuitem" href={item.href} onClick={() => setOpen(false)} className="block px-3 py-2 hover:bg-slate-50">
                    {body}
                  </Link>
                )
                : (
                  <button
                    key={item.label}
                    type="button"
                    role="menuitem"
                    onClick={() => { setOpen(false); item.onSelect?.() }}
                    className="block w-full px-3 py-2 text-left hover:bg-slate-50"
                  >
                    {body}
                  </button>
                )
            })}
          </div>
        </>
      )}
    </div>
  )
}
