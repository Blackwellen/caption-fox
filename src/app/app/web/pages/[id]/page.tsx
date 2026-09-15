import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { requireWebModule } from '@/lib/web/server'
import { getPage } from '@/lib/web/data'
import { PAGE_STATUS_BADGE, PAGE_STATUS_LABELS, PAGE_TYPE_LABELS } from '@/lib/web/constants'
import { Badge } from '@/components/ui/Badge'
import PageBuilderClient from '@/components/web/PageBuilderClient'
import { AccessBlocked } from '@/components/web/states'
import { WEB_PAGE, formatCompactNumber, formatPercentValue, formatShortDate } from '@/components/web/primitives'

export default async function PageDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, ctx, capabilities, access } = await requireWebModule('pages')

  if (!access.allowed) {
    return <div className={WEB_PAGE}><AccessBlocked access={access} /></div>
  }

  const page = await getPage(supabase, ctx.workspaceId, id)
  if (!page) notFound()

  const conversionRate = page.sessions > 0 ? (page.conversions / page.sessions) * 100 : 0

  return (
    <div className={WEB_PAGE}>
      <nav aria-label="Breadcrumb" className="mb-2">
        <ol className="flex items-center gap-1 text-xs text-slate-400">
          <li><Link href="/app/web" className="hover:text-slate-600">Web &amp; Conversion</Link></li>
          <li aria-hidden><ChevronRight size={12} className="text-slate-300" /></li>
          <li><Link href="/app/web/pages" className="hover:text-slate-600">Pages</Link></li>
          <li aria-hidden><ChevronRight size={12} className="text-slate-300" /></li>
          <li aria-current="page" className="font-medium text-slate-700">{page.name}</li>
        </ol>
      </nav>

      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[22px] font-bold tracking-tight text-slate-900">{page.name}</h1>
            <Badge variant={PAGE_STATUS_BADGE[page.status]}>{PAGE_STATUS_LABELS[page.status]}</Badge>
          </div>
          <p className="mt-0.5 text-[13px] text-slate-500">
            /{page.slug} · {PAGE_TYPE_LABELS[page.page_type]} · v{page.version} · updated {formatShortDate(page.updated_at)}
          </p>
        </div>
        <div className="flex gap-4 text-right text-[12px]">
          <div><p className="text-[18px] font-bold text-slate-900">{formatCompactNumber(page.sessions)}</p><p className="text-slate-400">Sessions</p></div>
          <div><p className="text-[18px] font-bold text-slate-900">{formatCompactNumber(page.conversions)}</p><p className="text-slate-400">Conversions</p></div>
          <div><p className="text-[18px] font-bold text-slate-900">{formatPercentValue(conversionRate)}</p><p className="text-slate-400">Conv. rate</p></div>
        </div>
      </header>

      <PageBuilderClient page={page} canEdit={capabilities.edit} canPublish={capabilities.publish} canDelete={capabilities.delete} />
    </div>
  )
}
