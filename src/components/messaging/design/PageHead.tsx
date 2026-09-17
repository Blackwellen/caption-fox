import type { ReactNode } from 'react'
import Link from 'next/link'
import { ChevronRight, Download, Plus, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Delta } from './kit'
import MoreMenu, { type MoreItem } from './MoreMenu'

// Breadcrumb, H1, subtitle and the action cluster from the approved designs.
// Actions the member cannot take are disabled with the reason as a tooltip.

export function PageHead({
  crumb, title, subtitle, actions,
}: { crumb: string; title: string; subtitle: string; actions: ReactNode }) {
  return (
    <header className="mb-3 flex flex-col gap-3 lg:mb-[10px] lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        <nav aria-label="Breadcrumb">
          <ol className="flex items-center gap-1.5 text-[12px] text-slate-500 lg:text-[9px]">
            <li><Link href="/app/messaging" className="hover:text-slate-700">Messaging</Link></li>
            <li aria-hidden><ChevronRight className="h-3 w-3 text-slate-400 lg:h-2.5 lg:w-2.5" /></li>
            <li aria-current="page" className="font-medium text-slate-800">{crumb}</li>
          </ol>
        </nav>
        <h1 className="mt-2 text-[24px] font-semibold leading-tight tracking-[-0.01em] text-slate-950 lg:mt-[9px] lg:text-[22px]">{title}</h1>
        <p className="mt-1 text-[13px] text-slate-500 lg:mt-[6px] lg:text-[9.5px]">{subtitle}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 lg:mt-[18px] lg:gap-[10px]">{actions}</div>
    </header>
  )
}

const BTN = 'inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 lg:h-[26px] lg:gap-[7px] lg:rounded-[5px] lg:px-[13px] lg:text-[9.5px]'

export function HeadButton({
  href, label, icon, primary, disabledReason, className, download,
}: { href?: string; label: string; icon?: 'plus' | 'upload' | 'download'; primary?: boolean; disabledReason?: string | null; className?: string; download?: boolean }) {
  const Icon = icon === 'plus' ? Plus : icon === 'upload' ? Upload : icon === 'download' ? Download : null
  const cls = cn(BTN, primary ? 'bg-blue-600 text-white shadow-sm hover:bg-blue-700' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50', disabledReason && 'cursor-not-allowed opacity-50', className)
  const content = <>{Icon && <Icon className="h-4 w-4 lg:h-3 lg:w-3" aria-hidden />}{label}</>
  if (disabledReason || !href) {
    return <button type="button" disabled className={cls} title={disabledReason ?? undefined}>{content}{disabledReason && <span className="sr-only">. {disabledReason}</span>}</button>
  }
  if (download) return <a href={href} className={cls}>{content}</a>
  return <Link href={href} className={cls}>{content}</Link>
}

export function HeadMore({ items }: { items: MoreItem[] }) {
  return <MoreMenu items={items} label="More messaging actions" className="lg:!h-[26px] lg:!w-[34px]" />
}

// ── KPI band ─────────────────────────────────────────────────────────────────

export interface Kpi {
  id: string
  label: string
  value: string
  icon: ReactNode
  tile: string
  delta: number | null
  unit: 'pp' | '%' | 'count'
  inverse?: boolean
  compare: string
}

/** One card, cells separated by hairlines, as in every Messaging design. */
export function KpiBand({ items, className }: { items: Kpi[]; className?: string }) {
  return (
    <section aria-label="Key metrics" className={cn('mb-3 grid grid-cols-2 overflow-hidden rounded-[10px] border border-slate-200/80 bg-white sm:grid-cols-3 lg:mb-[12px]', items.length === 5 ? 'xl:grid-cols-5' : 'xl:grid-cols-6', className)}>
      {items.map((kpi, index) => (
        <div key={kpi.id} className={cn('flex min-w-0 items-center gap-3 px-4 py-3 lg:h-[72px] lg:gap-[14px] lg:px-[14px] lg:py-0', index > 0 && 'xl:border-l xl:border-slate-100')}>
          <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg lg:h-[34px] lg:w-[34px] [&>svg]:h-5 [&>svg]:w-5 lg:[&>svg]:h-[17px] lg:[&>svg]:w-[17px]', kpi.tile)} aria-hidden>{kpi.icon}</span>
          <div className="min-w-0 leading-none">
            <p className="truncate text-[12px] text-slate-600 lg:text-[9px]">{kpi.label}</p>
            <p className="mt-1.5 text-[22px] font-semibold tracking-[-0.01em] text-slate-950 tabular-nums lg:mt-[6px] lg:text-[19px]">{kpi.value}</p>
            <p className="mt-1.5 flex items-center gap-1 truncate lg:mt-[6px]">
              <Delta value={kpi.delta} unit={kpi.unit} inverse={kpi.inverse} />
              <span className="truncate text-[11px] text-slate-400 lg:text-[7.5px]">vs {kpi.compare}</span>
            </p>
          </div>
        </div>
      ))}
    </section>
  )
}
