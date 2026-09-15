'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BrandModule } from '@/lib/brand-assets/entitlements'

/**
 * Module frame for Brand & Assets. The sidebar and top bar come from the
 * permanent CaptionFoxAppShell (see app/[workspaceType]/layout.tsx);
 * this component only renders the module tabs, which are entitlement-driven —
 * a gated module is absent, never a disabled tab.
 *
 * Tabs follow the three-layout rule: a row on desktop, a horizontally sliding
 * tray on tablet, a dropdown on phones.
 */
export interface BrandModuleFrameProps {
  activeModule: BrandModule
  modules: { module: BrandModule; label: string; href: string }[]
  children: React.ReactNode
}

export default function BrandModuleFrame({ activeModule, modules, children }: BrandModuleFrameProps) {
  const router = useRouter()
  const active = modules.find(m => m.module === activeModule)

  return (
    <div className="mx-auto w-full max-w-[1240px]">
      <nav aria-label="Brand and Assets sections" className="mb-6 border-b border-slate-200 lg:mb-4">
        {/* Phone: dropdown */}
        <label className="relative mb-3 block sm:hidden">
          <span className="sr-only">Brand and Assets section</span>
          <select
            value={active?.href ?? ''}
            onChange={e => router.push(e.target.value)}
            className="h-11 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 pr-9 text-sm font-semibold text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          >
            {modules.map(m => <option key={m.module} value={m.href}>{m.label}</option>)}
          </select>
          <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
        </label>

        {/* Tablet: sliding tray. Desktop: fixed row. Same markup, scroll only when needed. */}
        <div className="-mb-px hidden snap-x gap-1 overflow-x-auto sm:flex [scrollbar-width:none]">
          {modules.map(m => {
            const on = m.module === activeModule
            return (
              <Link
                key={m.module}
                href={m.href}
                aria-current={on ? 'page' : undefined}
                className={cn(
                  'snap-start whitespace-nowrap border-b-2 px-3 pb-3 pt-1 text-[13.5px] transition-colors lg:px-[18px] lg:pb-2.5 lg:text-[11px]',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600',
                  on ? 'border-blue-600 font-semibold text-blue-600' : 'border-transparent font-medium text-slate-500 hover:text-slate-800',
                )}
              >
                {m.label}
              </Link>
            )
          })}
        </div>
      </nav>
      {children}
    </div>
  )
}

export function Avatar({ name, src, size = 28 }: { name: string; src?: string | null; size?: number }) {
  const initials = name.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  }
  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-full bg-slate-200 font-semibold text-slate-600"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
    >
      {initials}
    </span>
  )
}
