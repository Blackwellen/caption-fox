import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { requireWebModule } from '@/lib/web/server'
import { getExperiment } from '@/lib/web/data'
import { EXPERIMENT_STATUS_BADGE, EXPERIMENT_STATUS_LABELS, EXPERIMENT_TYPE_LABELS } from '@/lib/web/constants'
import { Badge } from '@/components/ui/Badge'
import ExperimentLifecycleClient from '@/components/web/ExperimentLifecycleClient'
import { AccessBlocked } from '@/components/web/states'
import { WEB_PAGE, formatShortDate } from '@/components/web/primitives'

export default async function ExperimentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, ctx, capabilities, access } = await requireWebModule('experiments')

  if (!access.allowed) return <div className={WEB_PAGE}><AccessBlocked access={access} /></div>

  const experiment = await getExperiment(supabase, ctx.workspaceId, id)
  if (!experiment) notFound()

  return (
    <div className={WEB_PAGE}>
      <nav aria-label="Breadcrumb" className="mb-2">
        <ol className="flex items-center gap-1 text-xs text-slate-400">
          <li><Link href="/app/web" className="hover:text-slate-600">Web &amp; Conversion</Link></li>
          <li aria-hidden><ChevronRight size={12} className="text-slate-300" /></li>
          <li><Link href="/app/web/experiments" className="hover:text-slate-600">Experiments</Link></li>
          <li aria-hidden><ChevronRight size={12} className="text-slate-300" /></li>
          <li aria-current="page" className="font-medium text-slate-700">{experiment.name}</li>
        </ol>
      </nav>

      <header className="mb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-[22px] font-bold tracking-tight text-slate-900">{experiment.name}</h1>
          <Badge variant={EXPERIMENT_STATUS_BADGE[experiment.status]}>{EXPERIMENT_STATUS_LABELS[experiment.status]}</Badge>
        </div>
        <p className="mt-0.5 text-[13px] text-slate-500">
          {EXPERIMENT_TYPE_LABELS[experiment.experiment_type]}{experiment.surface_ref ? ` · ${experiment.surface_ref}` : ''} · {experiment.traffic_allocation_percent}% to variant · updated {formatShortDate(experiment.updated_at)}
        </p>
      </header>

      <ExperimentLifecycleClient
        experiment={experiment}
        canLaunch={capabilities.launchExperiments}
        canDeclareWinner={capabilities.declareWinner}
        canDelete={capabilities.delete}
      />

      <p className="mt-4 text-[11px] text-slate-400">
        Assign visitors from your page with a POST to <code className="rounded bg-slate-100 px-1 font-mono">/api/web/experiments/{experiment.id}/assign</code> (body: {'{'}"visitorId"{'}'}),
        and record a conversion with <code className="rounded bg-slate-100 px-1 font-mono">/api/web/experiments/{experiment.id}/convert</code>.
      </p>
    </div>
  )
}
