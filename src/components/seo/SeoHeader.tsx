'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { Calendar, ChevronDown, Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import { RANGE_PRESETS, type RangePresetId } from '@/lib/seo/range'
import { buildHref } from '@/lib/seo/url-state'

/**
 * Shared header row for every SEO surface: title, subtitle, date range,
 * optional extra controls (source/country/device selectors), Export and one
 * primary action slot (typically a wizard-trigger Client Component).
 */
export function SeoHeader({
  title, subtitle, pathname, activePreset, extra, exportHref, primarySlot,
}: {
  title: string
  subtitle: string
  pathname: string
  activePreset: RangePresetId | 'custom'
  extra?: React.ReactNode
  exportHref?: string
  primarySlot?: React.ReactNode
}) {
  return (
    <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">{title}</h1>
        <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <DateRangePicker pathname={pathname} activePreset={activePreset} />
        {extra}
        {exportHref && (
          <a
            href={exportHref}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Download size={14} aria-hidden />
            Export
          </a>
        )}
        {primarySlot}
      </div>
    </div>
  )
}

function DateRangePicker({ pathname, activePreset }: { pathname: string; activePreset: RangePresetId | 'custom' }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)
  const current = RANGE_PRESETS.find(p => p.id === activePreset)

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        <Calendar size={14} aria-hidden className="text-slate-400" />
        {current?.label ?? 'Custom range'}
        <ChevronDown size={14} aria-hidden className="text-slate-400" />
      </button>
      {open && (
        <>
          <button aria-hidden tabIndex={-1} className="fixed inset-0 z-10 cursor-default" onClick={() => setOpen(false)} />
          <div role="menu" className="absolute right-0 z-20 mt-1 w-48 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
            {RANGE_PRESETS.map(preset => (
              <button
                key={preset.id}
                role="menuitem"
                onClick={() => {
                  setOpen(false)
                  router.push(buildHref(pathname, searchParams, { range: preset.id, from: undefined, to: undefined, page: undefined }))
                }}
                className={cn(
                  'flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50',
                  preset.id === activePreset ? 'font-semibold text-blue-600' : 'text-slate-700',
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
