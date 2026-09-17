'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Check, ChevronDown, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { buildHref } from '@/lib/seo/url-state'
import { BrandLogo } from '@/components/brand/BrandLogo'

export interface HeaderMenuOption {
  value: string
  label: string
  /** Brand registry key rendered as the option's logo. */
  brand?: string
}

/**
 * Header-height dropdown that can show a logo or icon beside the label, as the
 * references do for "Google" and "All Locations". Writes one URL param, so it
 * behaves exactly like the native selects used elsewhere.
 */
export function HeaderMenuSelect({
  pathname, paramKey, value, placeholder, options, label, icon, resetKeys = ['page'],
}: {
  pathname: string
  paramKey: string
  value: string | undefined
  placeholder: string
  options: HeaderMenuOption[]
  label: string
  icon?: 'pin'
  resetKeys?: string[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)
  const current = options.find(option => option.value === value)

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  function choose(next: string | undefined) {
    setOpen(false)
    const overrides: Record<string, string | undefined> = { [paramKey]: next }
    for (const key of resetKeys) overrides[key] = undefined
    router.push(buildHref(pathname, searchParams, overrides))
  }

  const leading = current?.brand
    ? <BrandLogo brand={current.brand} size={15} />
    : icon === 'pin' ? <MapPin size={14} className="text-slate-500" aria-hidden /> : null

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${current?.label ?? placeholder}`}
        className="inline-flex h-8 max-w-[220px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-[12.5px] font-medium text-slate-700 hover:bg-slate-50"
      >
        {leading}
        <span className="truncate">{current?.label ?? placeholder}</span>
        <ChevronDown size={14} className="shrink-0 text-slate-400" aria-hidden />
      </button>
      {open && (
        <>
          <button aria-hidden tabIndex={-1} className="fixed inset-0 z-10 cursor-default" onClick={() => setOpen(false)} />
          <ul role="listbox" aria-label={label} className="absolute right-0 z-20 mt-1 max-h-72 w-56 overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
            <li>
              <button type="button" role="option" aria-selected={!current} onClick={() => choose(undefined)} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-slate-700 hover:bg-slate-50">
                {icon === 'pin' ? <MapPin size={14} className="text-slate-400" aria-hidden /> : <span className="w-[15px]" />}
                <span className="flex-1 truncate">{placeholder}</span>
                {!current && <Check size={13} className="text-blue-600" aria-hidden />}
              </button>
            </li>
            {options.map(option => (
              <li key={option.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  onClick={() => choose(option.value)}
                  className={cn('flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] hover:bg-slate-50', option.value === value ? 'font-medium text-blue-700' : 'text-slate-700')}
                >
                  {option.brand ? <BrandLogo brand={option.brand} size={15} /> : icon === 'pin' ? <MapPin size={14} className="text-slate-400" aria-hidden /> : <span className="w-[15px]" />}
                  <span className="flex-1 truncate">{option.label}</span>
                  {option.value === value && <Check size={13} className="text-blue-600" aria-hidden />}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
