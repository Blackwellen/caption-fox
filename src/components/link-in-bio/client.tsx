'use client'

import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Download, Loader2, MoreHorizontal, Upload } from 'lucide-react'
import ResponsiveTabs, { type TabItem } from '@/components/ui/ResponsiveTabs'
import { cn } from '@/lib/utils'
import { exportLinkData, importReusableLinks, type ActionResult } from '@/lib/link-in-bio/actions'
import { buttonClass } from './ui'
import { downloadText, notify } from './feedback'

export function LinksTabs({ basePath }: { basePath: string }) {
  const pathname = usePathname()
  const items: TabItem[] = [
    { id: 'overview', label: 'Overview', href: basePath },
    { id: 'library', label: 'Link Library', href: `${basePath}/library` },
    { id: 'themes', label: 'Themes', href: `${basePath}/themes` },
    { id: 'analytics', label: 'Analytics', href: `${basePath}/analytics` },
  ]
  const isActive = (item: TabItem) => item.id === 'overview' ? pathname === basePath : pathname === item.href || pathname.startsWith(`${item.href}/`)
  return <ResponsiveTabs items={items} isActive={isActive} ariaLabel="Link in Bio sections" />
}

export type MenuItem = { label: string; href?: string; onSelect?: () => void | Promise<void>; danger?: boolean; disabledReason?: string | null; external?: boolean }

/** Accessible dropdown menu: Escape closes and returns focus to the trigger. */
export function Menu({ items, label, trigger, align = 'right', className }: { items: MenuItem[]; label: string; trigger?: ReactNode; align?: 'left' | 'right'; className?: string }) {
  const [open, setOpen] = useState(false)
  const button = useRef<HTMLButtonElement | null>(null)
  const list = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!open) return
    list.current?.querySelector<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])')?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); button.current?.focus() }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        const nodes = [...(list.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])]
        const index = nodes.indexOf(document.activeElement as HTMLElement)
        nodes[(index + (event.key === 'ArrowDown' ? 1 : -1) + nodes.length) % nodes.length]?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])
  const itemClass = (item: MenuItem) => cn('flex w-full items-center rounded-md px-2.5 py-1.5 text-left text-[12.5px] focus:bg-slate-100 focus:outline-none',
    item.disabledReason ? 'cursor-not-allowed text-slate-400' : item.danger ? 'text-red-600 hover:bg-red-50' : 'text-slate-700 hover:bg-slate-100')
  return (
    <div className={cn('relative', className)}>
      <button ref={button} type="button" aria-haspopup="menu" aria-expanded={open} aria-label={label} onClick={() => setOpen(v => !v)} className={trigger ? 'inline-flex w-full rounded-md focus-visible:outline-2 focus-visible:outline-blue-600' : buttonClass.icon}>
        {trigger ?? <MoreHorizontal size={16} aria-hidden />}
      </button>
      {open && (
        <>
          <button type="button" tabIndex={-1} className="fixed inset-0 z-30 cursor-default" aria-hidden onClick={() => setOpen(false)} />
          <div ref={list} role="menu" aria-label={label} className={cn('absolute top-full z-40 mt-1 min-w-[190px] rounded-lg border border-slate-200 bg-white p-1 shadow-lg', align === 'right' ? 'right-0' : 'left-0')}>
            {items.map(item => item.href && !item.disabledReason ? (
              <Link key={item.label} role="menuitem" href={item.href} target={item.external ? '_blank' : undefined} rel={item.external ? 'noopener' : undefined} className={itemClass(item)} onClick={() => setOpen(false)}>{item.label}</Link>
            ) : (
              <button key={item.label} type="button" role="menuitem" aria-disabled={!!item.disabledReason} title={item.disabledReason ?? undefined} className={itemClass(item)}
                onClick={async () => { if (item.disabledReason) return; setOpen(false); await item.onSelect?.() }}>
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/** Runs a server action with pending state, toast feedback and a refresh. */
export function useAction() {
  const router = useRouter()
  const [pending, start] = useTransition()
  const run = <T,>(action: () => Promise<ActionResult<T>>, messages: { success?: string; confirm?: string } = {}, after?: (data: T) => void) => {
    if (messages.confirm && !window.confirm(messages.confirm)) return
    start(async () => {
      try {
        const result = await action()
        if (!result.ok) { notify(result.error, 'error'); return }
        if (messages.success) notify(messages.success)
        after?.(result.data)
        router.refresh()
      } catch {
        notify('Something went wrong. Please try again.', 'error')
      }
    })
  }
  return { run, pending }
}

export function ExportButton({ workspaceType, kind, disabledReason, label = 'Export', icon = 'download' }: { workspaceType: string; kind: 'library' | 'themes' | 'analytics'; disabledReason: string | null; label?: string; icon?: 'download' }) {
  const searchParams = useSearchParams()
  const { run, pending } = useAction()
  return (
    <button
      type="button" disabled={pending || !!disabledReason} title={disabledReason ?? undefined} className={buttonClass.secondary}
      onClick={() => run(() => exportLinkData({ workspaceType, kind, params: Object.fromEntries(searchParams.entries()) }), { success: 'Export downloaded' }, data => downloadText(data.filename, data.content))}
    >
      {pending ? <Loader2 size={14} className="animate-spin" aria-hidden /> : icon === 'download' && <Download size={14} aria-hidden />}
      {label}
      {disabledReason && <span className="sr-only">. Unavailable: {disabledReason}</span>}
    </button>
  )
}

export function ImportLinksButton({ workspaceType, disabledReason }: { workspaceType: string; disabledReason: string | null }) {
  const input = useRef<HTMLInputElement | null>(null)
  const { run, pending } = useAction()
  return (
    <>
      <button type="button" disabled={pending || !!disabledReason} title={disabledReason ?? 'Import reusable links from a CSV with name, destination_url, vanity_slug, label and tags columns'} onClick={() => input.current?.click()} className={buttonClass.secondary}>
        {pending ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Upload size={14} aria-hidden />} Import
      </button>
      <input
        ref={input} type="file" accept=".csv,text/csv" className="sr-only" tabIndex={-1} aria-label="Import reusable links CSV"
        onChange={async event => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (!file) return
          if (file.size > 512_000) { notify('CSV files must be 500 KB or smaller.', 'error'); return }
          const content = await file.text()
          run(() => importReusableLinks({ workspaceType, csv: content }), {}, data => {
            notify(`Imported ${data.created} ${data.created === 1 ? 'link' : 'links'}${data.errors.length ? `; ${data.errors.length} rows skipped (${data.errors.slice(0, 2).join(' ')})` : ''}`, data.errors.length && !data.created ? 'error' : 'success')
          })
        }}
      />
    </>
  )
}

export function CopyText({ value, label, className, children }: { value: string; label: string; className?: string; children: ReactNode }) {
  return (
    <button
      type="button" aria-label={label} title={label} className={className}
      onClick={async () => {
        try { await navigator.clipboard.writeText(value.startsWith('/') ? `${window.location.origin}${value}` : value); notify('Copied to clipboard') }
        catch { notify('Could not copy. Select and copy the link manually.', 'error') }
      }}
    >
      {children}
    </button>
  )
}
