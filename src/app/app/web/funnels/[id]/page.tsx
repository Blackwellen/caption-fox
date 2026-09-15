import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { requireWebModule } from '@/lib/web/server'
import { getFunnel } from '@/lib/web/data'
import { FUNNEL_STATUS_BADGE, FUNNEL_STATUS_LABELS, FUNNEL_TYPE_LABELS } from '@/lib/web/constants'
import { Badge } from '@/components/ui/Badge'
import FunnelStepsClient from '@/components/web/FunnelStepsClient'
import { AccessBlocked } from '@/components/web/states'
import { WEB_PAGE, formatCompactNumber, formatPercentValue, formatShortDate } from '@/components/web/primitives'

export default async function FunnelDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, ctx, capabilities, access } = await requireWebModule('funnels')

  if (!access.allowed) return <div className={WEB_PAGE}><AccessBlocked access={access} /></div>

  const funnel = await getFunnel(supabase, ctx.workspaceId, id)
  if (!funnel) notFound()

  const conversionRate = funnel.entries > 0 ? (funnel.conversions / funnel.entries) * 100 : 0

  return (
    <div className={WEB_PAGE}>
      <nav aria-label="Breadcrumb" className="mb-2">
        <ol className="flex items-center gap-1 text-xs text-slate-400">
          <li><Link href="/app/web" className="hover:text-slate-600">Web &amp; Conversion</Link></li>
          <li aria-hidden><ChevronRight size={12} className="text-slate-300" /></li>
          <li><Link href="/app/web/funnels" className="hover:text-slate-600">Funnels</Link></li>
          <li aria-hidden><ChevronRight size={12} className="text-slate-300" /></li>
          <li aria-current="page" className="font-medium text-slate-700">{funnel.name}</li>
        </ol>
      </nav>

      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[22px] font-bold tracking-tight text-slate-900">{funnel.name}</h1>
            <Badge variant={FUNNEL_STATUS_BADGE[funnel.status]}>{FUNNEL_STATUS_LABELS[funnel.status]}</Badge>
          </div>
          <p className="mt-0.5 text-[13px] text-slate-500">{FUNNEL_TYPE_LABELS[funnel.funnel_type]} · updated {formatShortDate(funnel.updated_at)}</p>
        </div>
        <div className="flex gap-4 text-right text-[12px]">
          <div><p className="text-[18px] font-bold text-slate-900">{formatCompactNumber(funnel.entries)}</p><p className="text-slate-400">Entries</p></div>
          <div><p className="text-[18px] font-bold text-slate-900">{formatCompactNumber(funnel.conversions)}</p><p className="text-slate-400">Conversions</p></div>
          <div><p className="text-[18px] font-bold text-slate-900">{formatPercentValue(conversionRate)}</p><p className="text-slate-400">Conv. rate</p></div>
        </div>
      </header>

      <FunnelStepsClient funnel={funnel} canEdit={capabilities.edit} canDelete={capabilities.delete} />
    </div>
  )
}
