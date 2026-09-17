'use client'

import Link from 'next/link'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { Calendar, ChevronDown, Download, Filter, Loader2, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import ResponsiveTabs, { type TabItem } from '@/components/ui/ResponsiveTabs'
import { useUrlState } from '@/components/advertising/Controls'
import { SOCIAL_SURFACES, SURFACE_LABELS, type SocialSurface } from '@/lib/social/entitlements'

// Client controls for the Social pages. Every control writes to the URL, so
// state is shareable, restored on refresh, correct under back/forward, and the
// server components do the filtering.

const control = 'inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-colors hover:bg-slate-50 lg:h-[34px] lg:text-[11.5px]'

// ── Section navigation ───────────────────────────────────────────────────────

export function SocialSubNav({ basePath, visible, badges }: { basePath: string; visible: SocialSurface[]; badges?: Partial<Record<SocialSurface, number>> }) {
  const pathname = usePathname()
  const items: TabItem[] = SOCIAL_SURFACES.filter(surface => visible.includes(surface)).map(surface => ({
    id: surface,
    label: SURFACE_LABELS[surface],
    href: surface === 'overview' ? basePath : `${basePath}/${surface}`,
    badge: badges?.[surface] || undefined,
  }))
  const isActive = (item: TabItem) => {
    if (item.id === 'overview') return pathname === basePath || pathname.startsWith(`${basePath}/posts`)
    return pathname === item.href || pathname.startsWith(`${item.href}/`)
      || (item.id === 'engagement' && pathname.startsWith(`${basePath}/conversations`))
  }
  return <ResponsiveTabs items={items} isActive={isActive} ariaLabel="Social sections" />
}

// ── Selects ──────────────────────────────────────────────────────────────────

export type Option = { value: string; label: string }

/** Header-sized native select dressed as the reference pill: icon · label · caret. */
export function PillSelect({
  paramKey, options, allLabel, label, icon, prefix, className, defaultValue = '', compact = false,
}: {
  paramKey: string
  options: Option[]
  /** Text when nothing is selected; omit to force a value. */
  allLabel?: string
  label: string
  icon?: ReactNode
  prefix?: string
  className?: string
  defaultValue?: string
  compact?: boolean
}) {
  const { params, set, pending } = useUrlState()
  const id = useId()
  const value = params.get(paramKey) ?? defaultValue
  const selected = options.find(option => option.value === value)
  const display = selected?.label ?? allLabel ?? options[0]?.label ?? ''
  return (
    <div className={cn('relative inline-flex', className)}>
      <label htmlFor={id} className="sr-only">{label}</label>
      <span
        aria-hidden
        className={cn(
          compact
            ? 'inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md border border-slate-200 bg-white px-2 text-[12px] text-slate-600 lg:h-[22px] lg:text-[9.5px]'
            : control,
          'pointer-events-none w-full',
          value && value !== defaultValue && !compact && 'border-blue-200 text-blue-700',
        )}
      >
        {icon}
        <span className="flex-1 truncate">{prefix}{display}</span>
        {pending ? <Loader2 size={12} className="animate-spin text-slate-400" /> : <ChevronDown size={compact ? 11 : 14} className="text-slate-400" />}
      </span>
      <select
        id={id}
        value={value}
        onChange={event => set({ [paramKey]: event.target.value === defaultValue ? null : event.target.value })}
        className="absolute inset-0 cursor-pointer appearance-none opacity-0"
      >
        {allLabel !== undefined && <option value="">{allLabel}</option>}
        {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </div>
  )
}

export function DateRangeSelect({ label, className }: { label: string; className?: string }) {
  return (
    <PillSelect
      paramKey="days"
      label={`Date range, currently ${label}`}
      defaultValue="7"
      icon={<Calendar size={14} className="text-slate-500" aria-hidden />}
      options={[
        { value: '7', label },
        { value: '14', label: 'Last 14 days' },
        { value: '30', label: 'Last 30 days' },
        { value: '90', label: 'Last 90 days' },
      ].map((option, index) => index === 0 ? option : option)}
      className={cn('min-w-[170px] lg:min-w-[182px]', className)}
    />
  )
}

// ── Tabs bound to a param ────────────────────────────────────────────────────

/** Underline tabs (Feed / Inbox / …) or pill tabs (Reach / Impressions / …). */
export function ParamTabs({
  paramKey, options, defaultValue, ariaLabel, variant = 'underline', className, keep,
}: {
  paramKey: string
  options: { value: string; label: string; count?: number | null; icon?: ReactNode }[]
  defaultValue: string
  ariaLabel: string
  variant?: 'underline' | 'pill' | 'soft'
  className?: string
  /** Extra params cleared when the tab changes (e.g. selected record). */
  keep?: Record<string, null>
}) {
  const { params, set } = useUrlState()
  const active = params.get(paramKey) ?? defaultValue
  return (
    <div role="tablist" aria-label={ariaLabel} className={cn('flex min-w-0 items-center overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden', variant === 'pill' && 'gap-0.5 rounded-lg border border-slate-200 bg-white p-0.5', variant === 'soft' && 'gap-0.5 rounded-lg bg-slate-50 p-0.5', variant === 'underline' && 'gap-1', className)}>
      {options.map(option => {
        const selected = option.value === active
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => set({ [paramKey]: option.value === defaultValue ? null : option.value, ...keep })}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600',
              variant === 'underline' && cn('h-10 border-b-2 px-2.5 text-[13px] lg:h-[34px] lg:text-[11px]', selected ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-600 hover:text-slate-900'),
              variant === 'pill' && cn('h-8 rounded-md px-3 text-[12.5px] lg:h-[24px] lg:px-3.5 lg:text-[10.5px]', selected ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'),
              variant === 'soft' && cn('h-8 rounded-md px-3 text-[12.5px] lg:h-[26px] lg:px-3.5 lg:text-[10.5px]', selected ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'),
            )}
          >
            {option.icon}
            {option.label}
            {option.count !== undefined && option.count !== null && (
              <span className={cn('rounded px-1.5 text-[11px] tabular-nums lg:text-[9.5px]', selected ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-600')}>{option.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ── Search ───────────────────────────────────────────────────────────────────

export function SearchBox({ paramKey = 'q', placeholder, className }: { paramKey?: string; placeholder: string; className?: string }) {
  const { params, set, pending } = useUrlState()
  const urlValue = params.get(paramKey) ?? ''
  const [value, setValue] = useState(urlValue)
  const [synced, setSynced] = useState(urlValue)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const id = useId()
  if (synced !== urlValue) { setSynced(urlValue); setValue(urlValue) }
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  return (
    <div className={cn('relative min-w-0', className)}>
      <label htmlFor={id} className="sr-only">{placeholder}</label>
      <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
      <input
        id={id} type="search" value={value} placeholder={placeholder} maxLength={120}
        onChange={event => {
          const next = event.target.value
          setValue(next)
          if (timer.current) clearTimeout(timer.current)
          timer.current = setTimeout(() => set({ [paramKey]: next.trim() || null }), 300)
        }}
        onKeyDown={event => {
          if (event.key === 'Enter') { event.preventDefault(); if (timer.current) clearTimeout(timer.current); set({ [paramKey]: value.trim() || null }) }
          if (event.key === 'Escape') { setValue(''); set({ [paramKey]: null }) }
        }}
        className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-7 text-[13px] text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/15 lg:h-[28px] lg:text-[10.5px] [&::-webkit-search-cancel-button]:hidden"
      />
      {pending && value
        ? <Loader2 size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-slate-400" aria-hidden />
        : value && (
          <button type="button" aria-label="Clear search" onClick={() => { setValue(''); set({ [paramKey]: null }) }} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600">
            <X size={12} />
          </button>
        )}
    </div>
  )
}

// ── Menus ────────────────────────────────────────────────────────────────────

/**
 * Disclosure menu. Closes on outside click, Escape and item activation, and
 * returns focus to its trigger. Items are links or buttons from the caller.
 */
export function Menu({ trigger, children, label, align = 'right', className, triggerClassName, width = 'w-52' }: {
  trigger: ReactNode; children: ReactNode; label: string; align?: 'left' | 'right'; className?: string; triggerClassName?: string; width?: string
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); button.current?.focus() } }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])
  return (
    <div ref={root} className={cn('relative inline-flex', className)}>
      <button ref={button} type="button" aria-haspopup="menu" aria-expanded={open} aria-label={label} onClick={() => setOpen(value => !value)} className={triggerClassName ?? control}>
        {trigger}
      </button>
      {open && (
        <div
          role="menu"
          onClick={event => { if ((event.target as HTMLElement).closest('a,button')) setOpen(false) }}
          className={cn('absolute top-full z-40 mt-1.5 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white p-1 text-[13px] shadow-lg lg:text-[11.5px]', width, align === 'right' ? 'right-0' : 'left-0',
            '[&_a]:flex [&_a]:w-full [&_a]:items-center [&_a]:gap-2 [&_a]:rounded-md [&_a]:px-2.5 [&_a]:py-1.5 [&_a]:text-left [&_a]:text-slate-700 [&_a:hover]:bg-slate-50',
            '[&_button]:flex [&_button]:w-full [&_button]:items-center [&_button]:gap-2 [&_button]:rounded-md [&_button]:px-2.5 [&_button]:py-1.5 [&_button]:text-left [&_button]:text-slate-700 [&_button:hover]:bg-slate-50 [&_button:disabled]:cursor-not-allowed [&_button:disabled]:opacity-50')}
        >
          {children}
        </div>
      )}
    </div>
  )
}

export function Kebab({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <Menu
      label={label}
      className={className}
      triggerClassName="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 lg:h-5 lg:w-5"
      trigger={<svg width="13" height="13" viewBox="0 0 24 24" aria-hidden><circle cx="12" cy="5" r="1.9" fill="currentColor" /><circle cx="12" cy="12" r="1.9" fill="currentColor" /><circle cx="12" cy="19" r="1.9" fill="currentColor" /></svg>}
    >
      {children}
    </Menu>
  )
}

/** Export ▾ — CSV, Excel and PDF of the current view, with the page's filters. */
export function ExportMenu({ dataset, extra, className, disabledReason }: {
  dataset: 'posts' | 'engagement' | 'listening' | 'connections' | 'analytics'
  extra?: Record<string, string>
  className?: string
  disabledReason?: string | null
}) {
  const params = useSearchParams()
  if (disabledReason) {
    return (
      <button type="button" disabled title={disabledReason} className={cn(control, 'cursor-not-allowed opacity-55', className)}>
        <Download size={14} aria-hidden /> Export <ChevronDown size={14} className="text-slate-400" aria-hidden />
        <span className="sr-only">Unavailable: {disabledReason}</span>
      </button>
    )
  }
  const href = (format: string) => {
    const query = new URLSearchParams(params.toString())
    query.set('dataset', dataset)
    query.set('format', format)
    for (const [key, value] of Object.entries(extra ?? {})) query.set(key, value)
    return `/api/social/export?${query.toString()}`
  }
  return (
    <Menu label="Export" className={className} width="w-48" trigger={<><Download size={14} aria-hidden /> Export <ChevronDown size={14} className="text-slate-400" aria-hidden /></>}>
      <a href={href('csv')} download>CSV (.csv)</a>
      <a href={href('xlsx')} download>Excel (.xlsx)</a>
      <a href={href('pdf')} download>PDF report (.pdf)</a>
    </Menu>
  )
}

/** Filters ▾ popover holding the page's secondary filter selects. */
export function FilterPopover({ children, activeCount, clearKeys, className }: { children: ReactNode; activeCount: number; clearKeys: string[]; className?: string }) {
  const { set } = useUrlState()
  return (
    <Menu
      label="Filters"
      className={className}
      width="w-64"
      trigger={<><Filter size={14} className="text-slate-500" aria-hidden /> Filters {activeCount > 0 && <span className="rounded-full bg-blue-600 px-1.5 text-[10px] font-semibold text-white">{activeCount}</span>}<ChevronDown size={14} className="text-slate-400" aria-hidden /></>}
    >
      <div className="space-y-2 p-2 [&_select]:cursor-pointer" onClick={event => event.stopPropagation()}>{children}</div>
      {activeCount > 0 && (
        <button type="button" onClick={() => set(Object.fromEntries(clearKeys.map(key => [key, null])))} className="!text-blue-600">Clear all filters</button>
      )}
    </Menu>
  )
}

/** Labelled native select for use inside FilterPopover and dialogs. */
export function FieldSelect({ paramKey, label, options, allLabel = 'All' }: { paramKey: string; label: string; options: Option[]; allLabel?: string }) {
  const { params, set } = useUrlState()
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500 lg:text-[9.5px]">{label}</label>
      <select id={id} value={params.get(paramKey) ?? ''} onChange={event => set({ [paramKey]: event.target.value || null })} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-[13px] text-slate-700 lg:h-8 lg:text-[11.5px]">
        <option value="">{allLabel}</option>
        {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </div>
  )
}

/** Split primary action: main link + caret menu of related actions. */
export function PrimarySplit({ href, label, icon, children, disabledReason, menuLabel }: {
  href: string; label: string; icon?: ReactNode; children?: ReactNode; disabledReason?: string | null; menuLabel: string
}) {
  const base = 'inline-flex h-10 items-center bg-blue-600 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 lg:h-[34px] lg:text-[11.5px]'
  if (disabledReason) {
    return (
      <button type="button" disabled title={disabledReason} className={cn(base, 'cursor-not-allowed gap-2 rounded-lg px-4 opacity-55')}>
        {icon}{label}<span className="sr-only">Unavailable: {disabledReason}</span>
      </button>
    )
  }
  return (
    <div className="inline-flex rounded-lg shadow-sm">
      <Link href={href} scroll={false} className={cn(base, 'gap-2 rounded-l-lg px-4 lg:px-5', !children && 'rounded-r-lg')}>{icon}{label}</Link>
      {children && (
        <Menu label={menuLabel} width="w-56" triggerClassName={cn(base, 'rounded-r-lg border-l border-white/25 px-2.5')} trigger={<ChevronDown size={15} aria-hidden />}>
          {children}
        </Menu>
      )}
    </div>
  )
}

/** Opens a URL-driven dialog (?compose=1 etc.) by adding a param in place. */
export function ParamLink({ param, value = '1', children, className, clear }: { param: string; value?: string; children: ReactNode; className?: string; clear?: string[] }) {
  const params = useSearchParams()
  const pathname = usePathname()
  const query = new URLSearchParams(params.toString())
  query.set(param, value)
  for (const key of clear ?? []) query.delete(key)
  return <Link href={`${pathname}?${query.toString()}`} scroll={false} className={className}>{children}</Link>
}
