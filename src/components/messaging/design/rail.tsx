import type { ReactNode } from 'react'
import Link from 'next/link'
import {
  AlertTriangle, Bell, Check, CheckCircle2, CircleAlert, Clock, FilePen, Mail, Pause, Rocket, ShieldAlert, Smartphone, TrendingUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ActivityItem } from '@/lib/messaging/dashboard'
import { fmtRelative } from '@/lib/messaging/metrics'
import { OperationalPill, WhatsAppIcon } from './kit'

// Right-rail lists shared by all eight pages. Items always link to the record
// or setting they describe; nothing here is decorative.

function activityIcon(item: ActivityItem): { icon: ReactNode; tone: string } {
  const a = item.action, s = item.summary.toLowerCase()
  if (s.includes('whatsapp') && (a === 'synced' || a === 'approved')) return { icon: <WhatsAppIcon className="h-2.5 w-2.5" />, tone: 'bg-emerald-500 text-white' }
  if (a.includes('paused')) return { icon: <Pause className="h-2.5 w-2.5" />, tone: 'bg-orange-500 text-white' }
  if (['sent', 'completed', 'published', 'audit_passed', 'carrier_resolved', 'agent_resolved', 'click_improved'].includes(a)) return { icon: <Check className="h-2.5 w-2.5" />, tone: 'bg-emerald-500 text-white' }
  if (a.includes('approved')) return { icon: <Check className="h-2.5 w-2.5" />, tone: 'bg-blue-600 text-white' }
  if (a === 'launched') return { icon: <Rocket className="h-2.5 w-2.5" />, tone: 'bg-violet-600 text-white' }
  if (a.includes('updated') || a === 'drafted' || a === 'submitted') return { icon: <FilePen className="h-2.5 w-2.5" />, tone: 'bg-violet-600 text-white' }
  if (a === 'opened') return { icon: <Mail className="h-2.5 w-2.5" />, tone: 'bg-blue-50 text-blue-600' }
  if (a.includes('alert') || a.includes('spike') || a.includes('failed')) return { icon: <AlertTriangle className="h-2.5 w-2.5" />, tone: 'bg-red-50 text-red-500' }
  if (a.includes('fallback')) return { icon: <TrendingUp className="h-2.5 w-2.5" />, tone: 'bg-orange-500 text-white' }
  return { icon: <Clock className="h-2.5 w-2.5" />, tone: 'bg-sky-500 text-white' }
}

export function ActivityList({ items, empty = 'No activity yet.' }: { items: ActivityItem[]; empty?: string }) {
  if (items.length === 0) return <p className="py-5 text-center text-[12px] text-slate-400 lg:text-[9px]">{empty}</p>
  return (
    <ul className="space-y-1 lg:space-y-[5px]">
      {items.map(item => {
        const { icon, tone } = activityIcon(item)
        const body = (
          <>
            <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full lg:h-[15px] lg:w-[15px]', tone)} aria-hidden>{icon}</span>
            <span className="min-w-0 flex-1 truncate text-[12px] text-slate-700 lg:text-[8px]">{item.summary}</span>
            <time dateTime={item.created_at} className="shrink-0 text-[11px] text-slate-400 lg:text-[7px]">{fmtRelative(item.created_at)}</time>
          </>
        )
        return (
          <li key={item.id}>
            {item.link
              ? <Link href={item.link} className="flex items-center gap-2 rounded py-1 hover:bg-slate-50 lg:gap-[10px] lg:py-[3px]">{body}</Link>
              : <div className="flex items-center gap-2 py-1 lg:gap-[10px] lg:py-[3px]">{body}</div>}
          </li>
        )
      })}
    </ul>
  )
}

export interface AlertRow {
  id: string
  title: string
  sub?: string
  value?: ReactNode
  valueTone?: 'red' | 'amber' | 'green' | 'slate'
  icon: 'shield' | 'warning' | 'whatsapp' | 'info' | 'clock' | 'chat' | 'phone' | 'bell' | 'mail'
  iconTone?: string
  href: string
  action?: string
}

const ALERT_ICON = {
  shield: ShieldAlert, warning: CircleAlert, info: CircleAlert, clock: Clock, chat: Bell, phone: Smartphone, bell: Bell, mail: Mail, whatsapp: null,
} as const

export function AlertList({ rows, empty = 'No alerts right now.', dense }: { rows: AlertRow[]; empty?: string; dense?: boolean }) {
  if (rows.length === 0) return <p className="py-5 text-center text-[12px] text-slate-400 lg:text-[9px]">{empty}</p>
  return (
    <ul className={cn('space-y-1', dense ? 'lg:space-y-[2px]' : 'lg:space-y-[6px]')}>
      {rows.map(row => {
        const Icon = ALERT_ICON[row.icon]
        return (
          <li key={row.id}>
            <Link href={row.href} className="flex items-center gap-2 rounded py-1 hover:bg-slate-50 lg:gap-[10px] lg:py-[3px]">
              <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full lg:h-[20px] lg:w-[20px]', row.iconTone ?? 'bg-red-50 text-red-500')} aria-hidden>
                {Icon ? <Icon className="h-3.5 w-3.5 lg:h-[11px] lg:w-[11px]" /> : <WhatsAppIcon className="h-3.5 w-3.5 lg:h-[11px] lg:w-[11px]" />}
              </span>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-[12px] font-medium text-slate-800 lg:text-[8.5px]">{row.title}</span>
                {row.sub && <span className="block truncate text-[11px] text-slate-400 lg:text-[7.5px]">{row.sub}</span>}
              </span>
              {row.action ? (
                <span className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-blue-600 lg:px-[8px] lg:py-[3px] lg:text-[8px]">{row.action}</span>
              ) : row.value !== undefined && (
                <span className={cn('shrink-0 text-[12px] font-semibold tabular-nums lg:text-[10.5px]',
                  row.valueTone === 'amber' ? 'text-orange-500' : row.valueTone === 'green' ? 'text-emerald-600' : row.valueTone === 'slate' ? 'text-slate-600' : 'text-red-500')}>{row.value}</span>
              )}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

export interface HealthRow { id: string; label: string; icon: ReactNode; status: string; href: string }

export function HealthList({ rows }: { rows: HealthRow[] }) {
  return (
    <ul className="space-y-1 lg:space-y-[3px]">
      {rows.map(row => (
        <li key={row.id}>
          <Link href={row.href} className="flex items-center gap-2 rounded py-1 hover:bg-slate-50 lg:gap-[10px] lg:py-[4px]">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-50 text-blue-600 lg:h-[16px] lg:w-[16px]" aria-hidden>{row.icon}</span>
            <span className="min-w-0 flex-1 truncate text-[12px] text-slate-700 lg:text-[8.5px]">{row.label}</span>
            <OperationalPill status={row.status} />
          </Link>
        </li>
      ))}
    </ul>
  )
}

export function HealthCaption({ allOk, label = 'All systems operational' }: { allOk: boolean; label?: string }) {
  return <span className={cn('text-[11px] lg:text-[7.5px]', allOk ? 'text-slate-400' : 'text-orange-500')}>{allOk ? label : 'Attention needed'}</span>
}

export { CheckCircle2 }
