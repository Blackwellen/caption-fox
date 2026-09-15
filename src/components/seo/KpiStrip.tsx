import {
  Activity, AtSign, BadgeCheck, BarChart3, Eye, Gauge, Globe2, Lightbulb, Link2, LinkIcon,
  MapPin, Minus, MousePointerClick, Search, ShieldCheck, Star, TrendingDown, TrendingUp, Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { absoluteChange, formatKpi, percentChange } from '@/lib/seo/format'
import { humanise } from '@/lib/seo/format'
import type { SeoKpi } from '@/lib/seo/types'
import { Card, InfoTip } from './primitives'
import { Spark } from './charts'

const ICONS: Record<string, typeof Search> = {
  clicks: MousePointerClick,
  impressions: Eye,
  tracked: Search,
  'avg-rank': BarChart3,
  visibility: ShieldCheck,
  opportunities: Lightbulb,
  winning: BadgeCheck,
  declining: TrendingDown,
  'keyword-opps': Lightbulb,
  traffic: Users,
  top3: BadgeCheck,
  top10: BarChart3,
  sov: Gauge,
  'map-pack': MapPin,
  'local-rank': BarChart3,
  locations: Globe2,
  'review-score': Star,
  'profile-views': Eye,
  'local-opps': Lightbulb,
  'ai-visibility': Activity,
  prompts: Search,
  'citation-rate': ShieldCheck,
  mentions: AtSign,
  linked: Link2,
  total: LinkIcon,
  domains: Users,
  authority: ShieldCheck,
  new: TrendingUp,
  lost: TrendingDown,
  toxic: TrendingDown,
  briefs: BarChart3,
  gaps: Lightbulb,
}

/**
 * The KPI strip shared by every SEO surface. Each card shows the current
 * value, the comparison value, the change, a sparkline, the source that
 * produced it and a definition tooltip.
 */
export function KpiStrip({ kpis, compareLabel }: { kpis: SeoKpi[]; compareLabel: string }) {
  if (kpis.length === 0) return null
  return (
    <section aria-label="Key metrics" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {kpis.map(kpi => <KpiCard key={kpi.id} kpi={kpi} compareLabel={compareLabel} />)}
    </section>
  )
}

function KpiCard({ kpi, compareLabel }: { kpi: SeoKpi; compareLabel: string }) {
  const Icon = ICONS[kpi.id] ?? BarChart3
  const isPercentish = kpi.format === 'percent' || kpi.format === 'decimal'
  const change = isPercentish ? absoluteChange(kpi.value, kpi.previous) : percentChange(kpi.value, kpi.previous)
  const suffix = isPercentish ? '' : '%'
  const empty = kpi.value == null

  const flat = change == null || Math.abs(change) < 0.05
  const good = kpi.invert ? (change ?? 0) < 0 : (change ?? 0) > 0
  const ChangeIcon = flat ? Minus : good ? TrendingUp : TrendingDown
  const tone = flat ? 'text-slate-400' : good ? 'text-emerald-600' : 'text-red-600'

  return (
    <Card className="flex flex-col gap-2 p-4">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
          <Icon size={14} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 text-[12px] font-medium leading-tight text-slate-600">
            <span className="truncate">{kpi.label}</span>
            <InfoTip text={`${kpi.tooltip} Source: ${humanise(kpi.source)}.`} />
          </p>
          <p className="mt-1 flex items-baseline gap-1.5">
            <span className={cn('text-[22px] font-bold leading-none tracking-tight', empty ? 'text-slate-300' : 'text-slate-900')}>
              {empty ? '—' : formatKpi(kpi.value, kpi.format)}
            </span>
            {change != null && (
              <span className={cn('inline-flex items-center gap-0.5 text-[11px] font-semibold', tone)}>
                <ChangeIcon size={11} aria-hidden />
                <span className="sr-only">{flat ? 'no change' : good ? 'improved by' : 'worsened by'} </span>
                {Math.abs(change).toLocaleString('en-GB', { maximumFractionDigits: 1 })}{suffix}
              </span>
            )}
          </p>
        </div>
      </div>
      <p className="text-[11px] text-slate-400">{empty ? 'Awaiting first sync' : compareLabel}</p>
      <Spark data={kpi.spark} tone={kpi.invert && !good && !flat ? '#EF4444' : '#2563EB'} />
    </Card>
  )
}
