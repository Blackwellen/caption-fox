import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { requireWebModule } from '@/lib/web/server'
import { getForm, listFormSubmissions } from '@/lib/web/data'
import { FORM_STATUS_BADGE, FORM_STATUS_LABELS, FORM_TYPE_LABELS } from '@/lib/web/constants'
import { Badge } from '@/components/ui/Badge'
import FormFieldsClient from '@/components/web/FormFieldsClient'
import SubmissionsTable from '@/components/web/SubmissionsTable'
import { AccessBlocked } from '@/components/web/states'
import { WEB_PAGE, Panel, formatCompactNumber, formatPercentValue, formatShortDate } from '@/components/web/primitives'

export default async function FormDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, ctx, capabilities, access } = await requireWebModule('forms')

  if (!access.allowed) return <div className={WEB_PAGE}><AccessBlocked access={access} /></div>

  const form = await getForm(supabase, ctx.workspaceId, id)
  if (!form) notFound()

  const submissions = capabilities.viewFormSubmissions ? await listFormSubmissions(supabase, ctx.workspaceId, id, { limit: 50 }) : { rows: [], total: 0 }
  const completionRate = form.submissions_count > 0 ? (form.completed_count / form.submissions_count) * 100 : 0

  return (
    <div className={WEB_PAGE}>
      <nav aria-label="Breadcrumb" className="mb-2">
        <ol className="flex items-center gap-1 text-xs text-slate-400">
          <li><Link href="/app/web" className="hover:text-slate-600">Web &amp; Conversion</Link></li>
          <li aria-hidden><ChevronRight size={12} className="text-slate-300" /></li>
          <li><Link href="/app/web/forms" className="hover:text-slate-600">Forms</Link></li>
          <li aria-hidden><ChevronRight size={12} className="text-slate-300" /></li>
          <li aria-current="page" className="font-medium text-slate-700">{form.name}</li>
        </ol>
      </nav>

      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[22px] font-bold tracking-tight text-slate-900">{form.name}</h1>
            <Badge variant={FORM_STATUS_BADGE[form.status]}>{FORM_STATUS_LABELS[form.status]}</Badge>
          </div>
          <p className="mt-0.5 text-[13px] text-slate-500">{FORM_TYPE_LABELS[form.form_type]} · updated {formatShortDate(form.updated_at)}</p>
        </div>
        <div className="flex gap-4 text-right text-[12px]">
          <div><p className="text-[18px] font-bold text-slate-900">{formatCompactNumber(form.submissions_count)}</p><p className="text-slate-400">Submissions</p></div>
          <div><p className="text-[18px] font-bold text-slate-900">{formatPercentValue(completionRate)}</p><p className="text-slate-400">Completion</p></div>
        </div>
      </header>

      <div className="space-y-4">
        <FormFieldsClient form={form} canEdit={capabilities.edit} canPublish={capabilities.publish} canDelete={capabilities.delete} />

        {capabilities.viewFormSubmissions && (
          <Panel title="Recent submissions" info={`${submissions.total} total`} bodyClassName="px-0 pb-0">
            <SubmissionsTable rows={submissions.rows} fields={form.fields} />
          </Panel>
        )}
      </div>
    </div>
  )
}
