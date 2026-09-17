import {
  Activity, ArrowDown, ArrowUp, AtSign, BadgeCheck, BarChart3, ClipboardCheck, Eye, FileText, Gauge, Globe2, Lightbulb,
  Link2, LinkIcon, Loader, MapPin, Minus, MousePointerClick, Puzzle as PuzzleIcon, Rocket, Search,
  ShieldCheck, Star, TrendingDown, TrendingUp, Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { absoluteChange, formatKpi, percentChange } from '@/lib/seo/format'
import { humanise } from '@/lib/seo/format'
import type { SeoKpi } from '@/lib/seo/types'
import { Card } from './primitives'
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
  briefs: FileText,
  'in-progress': Loader,
  'awaiting-review': ClipboardCheck,
  published: Rocket,
  gaps: PuzzleIcon,
  'traffic-potential': TrendingUp,
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
  const ChangeIcon = flat ? Minus : (change ?? 0) > 0 ? ArrowUp : ArrowDown
  const tone = flat ? 'text-slate-400' : good ? 'text-emerald-600' : 'text-red-600'
  const definition = `${kpi.tooltip} Source: ${humanise(kpi.source)}.`

  // Reference layout: tinted icon beside a label/value stack, comparison line
  // underneath and a full-width sparkline. The metric definition stays
  // available on hover and to assistive technology rather than as a glyph.
  return (
    <Card className="flex flex-col px-3.5 pb-2 pt-3" title={definition}>
      <div className="flex items-start gap-2.5">
        <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', kpi.invert ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600')}>
          <Icon size={16} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] font-medium leading-tight text-slate-700">{kpi.label}</p>
          <p className="sr-only">{definition}</p>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5">
            <span className={cn('text-[21px] font-semibold leading-none tracking-tight', empty ? 'text-slate-300' : 'text-slate-900')}>
              {empty ? '—' : formatKpi(kpi.value, kpi.format)}
            </span>
            {change != null && (
              <span className={cn('inline-flex items-center gap-0.5 text-[11.5px] font-medium', tone)}>
                <ChangeIcon size={11} aria-hidden />
                <span className="sr-only">{flat ? 'no change' : good ? 'improved by' : 'worsened by'} </span>
                {Math.abs(change).toLocaleString('en-GB', { maximumFractionDigits: 1 })}{suffix}
              </span>
            )}
          </p>
        </div>
      </div>

      <p className="mt-2 truncate text-[11px] leading-none text-slate-500">{empty ? 'Awaiting first sync' : compareLabel}</p>
      {kpi.spark.filter(point => point.value != null).length >= 2 && (
        <div className="mt-1">
          <Spark data={kpi.spark} tone={kpi.invert && !good && !flat ? '#EF4444' : '#2563EB'} />
        </div>
      )}
    </Card>
  )
}
