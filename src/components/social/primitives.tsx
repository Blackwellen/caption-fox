'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { AlertTriangle, ArrowDown, ArrowUp, Loader2, RefreshCw, Wifi, WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { compactNumber, percent, signedPct, signedPp } from '@/lib/social/metrics'
import { PROVIDER_COLOURS, PROVIDER_LABELS } from '@/types/social'
import type { ConnectionHealth, SocialProvider } from '@/types/social'

// ── Provider chip ────────────────────────────────────────────────────────────

const INITIALS: Record<SocialProvider, string> = {
  instagram: 'IG', tiktok: 'TT', facebook: 'FB', linkedin: 'LI',
  youtube: 'YT', x: 'X', pinterest: 'PT', threads: '@',
}

export function ProviderBadge({ provider, size = 28 }: { provider: SocialProvider; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-lg font-bold text-white"
      style={{ width: size, height: size, backgroundColor: PROVIDER_COLOURS[provider], fontSize: size * 0.34 }}
      title={PROVIDER_LABELS[provider]}
    >
      {INITIALS[provider]}
    </span>
  )
}

export function ProviderLabel({ provider }: { provider: SocialProvider }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700">
      <ProviderBadge provider={provider} size={18} />
      {PROVIDER_LABELS[provider]}
    </span>
  )
}

// ── Connection health badge ──────────────────────────────────────────────────

const HEALTH_STYLE: Record<ConnectionHealth, { label: string; dot: string; text: string }> = {
  healthy: { label: 'Healthy', dot: 'bg-emerald-500', text: 'text-emerald-700' },
  watch: { label: 'Watch', dot: 'bg-amber-400', text: 'text-amber-700' },
  warning: { label: 'Warning', dot: 'bg-amber-500', text: 'text-amber-700' },
  error: { label: 'Error', dot: 'bg-red-500', text: 'text-red-700' },
  disconnected: { label: 'Disconnected', dot: 'bg-slate-400', text: 'text-slate-600' },
  syncing: { label: 'Syncing', dot: 'bg-blue-500', text: 'text-blue-700' },
  expired: { label: 'Expired', dot: 'bg-red-500', text: 'text-red-700' },
}

export function HealthBadge({ health }: { health: ConnectionHealth }) {
  const style = HEALTH_STYLE[health]
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2 py-0.5 text-xs font-medium', style.text)}>
      {health === 'syncing'
        ? <Loader2 size={10} className="animate-spin" />
        : <span className={cn('h-1.5 w-1.5 rounded-full', style.dot)} />}
      {style.label}
    </span>
  )
}

export function HealthIcon({ health }: { health: ConnectionHealth }) {
  if (health === 'syncing') return <RefreshCw size={14} className="animate-spin text-blue-500" />
  if (health === 'healthy') return <Wifi size={14} className="text-emerald-500" />
  if (['error', 'expired', 'disconnected'].includes(health)) return <WifiOff size={14} className="text-red-500" />
  return <AlertTriangle size={14} className="text-amber-500" />
}

// ── KPI card ─────────────────────────────────────────────────────────────────

export interface KpiCardData {
  key: string
  label: string
  value: string
  changeLabel: string | null
  changeGood: boolean | null
  sparkline?: number[]
  note?: string
}

export function KpiCard({ data }: { data: KpiCardData }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium text-slate-500">{data.label}</p>
      <p className="mt-1.5 text-2xl font-bold text-slate-900">{data.value}</p>
      <div className="mt-1 flex items-center gap-1 text-xs">
        {data.changeLabel ? (
          <span className={cn('inline-flex items-center gap-0.5 font-medium',
            data.changeGood === null ? 'text-slate-400' : data.changeGood ? 'text-emerald-600' : 'text-red-600')}>
            {data.changeGood === null ? null : data.changeGood ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
            {data.changeLabel}
          </span>
        ) : <span className="text-slate-400">No prior data</span>}
      </div>
      {data.sparkline && data.sparkline.length > 1 && <Sparkline values={data.sparkline} />}
      {data.note && <p className="mt-1 text-[11px] text-slate-400">{data.note}</p>}
    </div>
  )
}

export function Sparkline({ values, colour = '#2563eb' }: { values: number[]; colour?: string }) {
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const range = max - min || 1
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * 100
    const y = 24 - ((v - min) / range) * 22 - 1
    return `${x},${y}`
  }).join(' ')
  return (
    <svg viewBox="0 0 100 24" className="mt-2 h-6 w-full" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={points} fill="none" stroke={colour} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export function metricKpi(input: {
  key: string; label: string; value: number; previous: number | null; changePct: number | null
  format?: 'number' | 'percent' | 'duration'; series?: number[]; note?: string
}): KpiCardData {
  const value = input.format === 'percent' ? percent(input.value / 100)
    : input.format === 'duration' ? `${input.value}`
    : compactNumber(input.value)
  return {
    key: input.key, label: input.label, value,
    changeLabel: input.previous === null ? null : signedPct(input.changePct),
    changeGood: input.changePct === null ? null : input.changePct >= 0,
    sparkline: input.series, note: input.note,
  }
}

export function rateKpi(input: {
  key: string; label: string; value: number | null; changePp: number | null; series?: number[]; note?: string
}): KpiCardData {
  return {
    key: input.key, label: input.label, value: percent(input.value),
    changeLabel: input.changePp === null ? null : signedPp(input.changePp),
    changeGood: input.changePp === null ? null : input.changePp >= 0,
    sparkline: input.series, note: input.note,
  }
}

// ── URL-synced date range + view switcher (client controls) ─────────────────

export const RANGE_OPTIONS = [
  { days: 7, label: 'Last 7 days' },
  { days: 14, label: 'Last 14 days' },
  { days: 30, label: 'Last 30 days' },
  { days: 90, label: 'Last 90 days' },
]

export function useSocialQueryState() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  function set(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString())
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === '') next.delete(key)
      else next.set(key, value)
    }
    router.push(`${pathname}?${next.toString()}`)
  }

  return { params, set }
}

export function RangePicker({ days }: { days: number }) {
  const { set } = useSocialQueryState()
  return (
    <select
      value={days}
      onChange={event => set({ days: event.target.value })}
      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm"
      aria-label="Date range"
    >
      {RANGE_OPTIONS.map(option => (
        <option key={option.days} value={option.days}>{option.label}</option>
      ))}
    </select>
  )
}

export function ViewSwitcher({ views, active }: { views: { id: string; label: string }[]; active: string }) {
  const { set } = useSocialQueryState()
  return (
    <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
      {views.map(view => (
        <button
          key={view.id}
          onClick={() => set({ view: view.id })}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            active === view.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700',
          )}
        >
          {view.label}
        </button>
      ))}
    </div>
  )
}

export function ExportButton({ dataset, days, extraParams }: { dataset: string; days: number; extraParams?: Record<string, string> }) {
  const params = new URLSearchParams({ dataset, days: String(days), ...(extraParams ?? {}) })
  return (
    <a
      href={`/api/social/export?${params.toString()}`}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
    >
      Export
    </a>
  )
}

export function TimeAgo({ iso }: { iso: string | null }) {
  if (!iso) return <span className="text-slate-400">Never</span>
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return <span>Just now</span>
  if (diff < 3600) return <span>{Math.floor(diff / 60)}m ago</span>
  if (diff < 86400) return <span>{Math.floor(diff / 3600)}h ago</span>
  return <span>{Math.floor(diff / 86400)}d ago</span>
}

export function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-600',
    pending_approval: 'bg-amber-100 text-amber-700',
    approved: 'bg-blue-100 text-blue-700',
    scheduled: 'bg-blue-100 text-blue-700',
    queued: 'bg-blue-100 text-blue-700',
    publishing: 'bg-violet-100 text-violet-700',
    published: 'bg-emerald-100 text-emerald-700',
    partially_published: 'bg-amber-100 text-amber-700',
    failed: 'bg-red-100 text-red-700',
    cancelled: 'bg-slate-100 text-slate-500',
    archived: 'bg-slate-100 text-slate-500',
  }
  const label = status.replaceAll('_', ' ')
  return <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize', styles[status] ?? 'bg-slate-100 text-slate-600')}>{label}</span>
}

export function SentimentPill({ sentiment }: { sentiment: string | null }) {
  if (!sentiment) return <span className="text-xs text-slate-400">—</span>
  const styles: Record<string, string> = {
    positive: 'bg-emerald-100 text-emerald-700',
    neutral: 'bg-slate-100 text-slate-600',
    negative: 'bg-red-100 text-red-700',
  }
  return <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize', styles[sentiment])}>{sentiment}</span>
}

export { Link }
