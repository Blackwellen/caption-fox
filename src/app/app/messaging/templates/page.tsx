import { requireMessagingModule } from '@/lib/messaging/server'
import { listTemplates, recentActivity } from '@/lib/messaging/data'
import { CHANNEL_LABELS, TEMPLATE_STATUS_BADGE, TEMPLATE_STATUS_LABELS } from '@/lib/messaging/constants'
import MessagingHeader from '@/components/messaging/MessagingHeader'
import KpiStrip from '@/components/messaging/KpiStrip'
import ActivityFeed from '@/components/messaging/ActivityFeed'
import ExportButton, { HeaderOverflow } from '@/components/messaging/ExportButton'
import { AccessBlocked, MessagingEmpty } from '@/components/messaging/states'
import { ChannelChip, OwnerChip, Panel, MESSAGING_PAGE, formatNumber, formatShortDate } from '@/components/messaging/primitives'
import { Badge } from '@/components/ui/Badge'
import TemplateStatusActions from '@/components/messaging/templates/TemplateStatusActions'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import type { KpiValue } from '@/lib/messaging/types'

export const metadata = {
  title: 'Messaging Templates · Caption Fox',
  description: 'Manage reusable message templates across email, SMS, WhatsApp, RCS and push.',
}

const RIGHT_RAIL = 'w-full shrink-0 space-y-3 xl:w-[292px]'
const STALE_DAYS = 90

export default async function MessagingTemplatesPage() {
  const { supabase, ctx, capabilities, modules, access } = await requireMessagingModule('templates')

  if (!access.allowed) {
    return (
      <div className={MESSAGING_PAGE}>
        <MessagingHeader module="templates" modules={modules} />
        <AccessBlocked access={access} />
      </div>
    )
  }

  const [{ rows: templates, total }, activity] = await Promise.all([
    listTemplates(supabase, ctx.workspaceId, { limit: 50 }),
    recentActivity(supabase, ctx.workspaceId, { limit: 6 }),
  ])

  const published = templates.filter(t => t.status === 'published').length
  const inReview = templates.filter(t => t.status === 'in_review')
  const avgReuse = templates.length > 0 ? (templates.reduce((sum, t) => sum + Number(t.avg_reuse_rate ?? 0), 0) / templates.length).toFixed(1) : '0'
  const staleCutoff = Date.now() - STALE_DAYS * 86_400_000
  const staleTemplates = templates.filter(t => t.status === 'published' && Date.parse(t.updated_at) < staleCutoff)
  const missingVariables = templates.filter(t => t.variables.length === 0 && t.status === 'published')

  const kpis: KpiValue[] = [
    { id: 'total', label: 'Total templates', value: String(total), icon: 'mail', tone: 'blue' },
    { id: 'published', label: 'Published', value: String(published), icon: 'check', tone: 'green' },
    { id: 'review', label: 'In review', value: String(inReview.length), icon: 'alert', tone: inReview.length > 0 ? 'amber' : 'slate' },
    { id: 'reuse', label: 'Avg reuse rate', value: `${avgReuse}x`, icon: 'refresh', tone: 'violet' },
  ]

  return (
    <div className={MESSAGING_PAGE}>
      <MessagingHeader
        module="templates" modules={modules}
        actions={
          <>
            {capabilities.manageTemplates && (
              <Link
                href="/app/messaging/templates/new"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
              >
                <Plus size={14} />
                New template
              </Link>
            )}
            <ExportButton entity="templates" allowed={capabilities.export} />
            <HeaderOverflow items={[{ label: 'Refresh data' }, { label: 'Messaging overview', href: '/app/messaging' }]} />
          </>
        }
      />

      <KpiStrip items={kpis} className="mb-3" />

      <div className="flex flex-col gap-3 xl:flex-row xl:items-start">
        <div className="min-w-0 flex-1 space-y-3">
          <Panel title="Templates" bodyClassName="px-0 pb-0">
            {templates.length === 0 ? (
              <MessagingEmpty
                bare title="No templates yet"
                message="Create your first reusable template so email, SMS, WhatsApp, RCS and push messages can be built and reviewed faster."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400">
                      <th className="px-3 py-2.5 font-medium">Template</th>
                      <th className="px-3 py-2.5 font-medium">Category</th>
                      <th className="px-3 py-2.5 font-medium">Status</th>
                      <th className="px-3 py-2.5 font-medium">Uses</th>
                      <th className="px-3 py-2.5 font-medium">Unique recipients</th>
                      <th className="px-3 py-2.5 font-medium">Owner</th>
                      <th className="px-3 py-2.5 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {templates.map(template => (
                      <tr key={template.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <ChannelChip channel={template.channel} />
                            <span className="truncate font-medium text-slate-900">{template.name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-slate-600">{template.category}</td>
                        <td className="px-3 py-2.5">
                          <Badge variant={TEMPLATE_STATUS_BADGE[template.status as keyof typeof TEMPLATE_STATUS_BADGE] ?? 'slate'}>
                            {TEMPLATE_STATUS_LABELS[template.status as keyof typeof TEMPLATE_STATUS_LABELS] ?? template.status}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5 font-medium text-slate-900">{formatNumber(template.usage_count)}</td>
                        <td className="px-3 py-2.5 text-slate-600">{formatNumber(template.unique_recipients)}</td>
                        <td className="px-3 py-2.5"><OwnerChip person={template.owner} /></td>
                        <td className="px-3 py-2.5">
                          <TemplateStatusActions id={template.id} status={template.status} canManage={capabilities.manageTemplates} canApprove={capabilities.approveTemplates} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <div className="rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-3 text-[12px] text-blue-800">
            Templates support real create / submit-for-review / publish / archive workflows against the database.
            The live rich-text preview, variable-insertion picker and journey-usage graph from the approved designs are a later visual pass.
          </div>
        </div>

        <div className={RIGHT_RAIL}>
          <Panel title="Recent activity" viewAllHref="/app/messaging/templates">
            <ActivityFeed items={activity} />
          </Panel>

          <Panel title="Expiring approvals" viewAllHref="/app/messaging/templates" viewAllLabel="View all">
            {inReview.length === 0 ? (
              <p className="py-4 text-center text-[12px] text-slate-400">Nothing awaiting approval.</p>
            ) : (
              <ul className="space-y-2">
                {inReview.slice(0, 5).map(t => (
                  <li key={t.id} className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-[12px] font-medium text-slate-900">{t.name}</span>
                    <span className="shrink-0 text-[11px] text-slate-400">{formatShortDate(t.updated_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Content governance" viewAllHref="/app/messaging/templates" viewAllLabel="View all">
            <ul className="space-y-2 text-[12px]">
              <li className="flex items-center justify-between">
                <span className="text-slate-600">Stale templates (90+ days)</span>
                <span className={`font-semibold ${staleTemplates.length > 0 ? 'text-amber-600' : 'text-slate-400'}`}>{staleTemplates.length}</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-slate-600">Missing personalisation</span>
                <span className={`font-semibold ${missingVariables.length > 0 ? 'text-amber-600' : 'text-slate-400'}`}>{missingVariables.length}</span>
              </li>
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  )
}
