import { MessageSquare, Clock, AlertTriangle, Timer, CheckCircle2, UserX } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface InboxKpis {
  open: number
  awaitingReply: number
  slaAtRisk: number
  resolvedToday: number
  unassigned: number
  avgFirstResponseMinutes: number | null
}

function formatMinutes(min: number | null) {
  if (min === null) return '—'
  if (min < 60) return `${Math.round(min)}m`
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return `${h}h ${m}m`
}

const CARDS: {
  key: keyof InboxKpis
  label: string
  icon: typeof MessageSquare
  tone: string
  format?: (kpis: InboxKpis) => string
}[] = [
  { key: 'open', label: 'Open conversations', icon: MessageSquare, tone: 'bg-blue-50 text-blue-600' },
  { key: 'awaitingReply', label: 'Awaiting reply', icon: Clock, tone: 'bg-amber-50 text-amber-600' },
  { key: 'slaAtRisk', label: 'SLA at risk', icon: AlertTriangle, tone: 'bg-red-50 text-red-600' },
  { key: 'avgFirstResponseMinutes', label: 'Avg. first response time', icon: Timer, tone: 'bg-violet-50 text-violet-600', format: k => formatMinutes(k.avgFirstResponseMinutes) },
  { key: 'resolvedToday', label: 'Resolved today', icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-600' },
]

export function InboxKpiStrip({ kpis, loading, extra }: { kpis: InboxKpis | null; loading?: boolean; extra?: { label: string; value: number; icon: typeof UserX; tone: string }[] }) {
  const cards = [...CARDS, ...(extra ?? []).map(e => ({ key: 'x' as keyof InboxKpis, label: e.label, icon: e.icon, tone: e.tone, format: () => String(e.value) }))]
  return (
    <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
      {cards.map((c, i) => (
        <div key={i} className="rounded-xl border border-slate-200 bg-white p-4">
          <div className={cn('mb-2 flex h-8 w-8 items-center justify-center rounded-lg', c.tone)}>
            <c.icon size={16} />
          </div>
          <p className="text-xs font-medium text-slate-500">{c.label}</p>
          <p className="mt-0.5 text-xl font-bold text-slate-900">
            {loading || !kpis ? '—' : c.format ? c.format(kpis) : (kpis[c.key] as number)}
          </p>
        </div>
      ))}
    </div>
  )
}
