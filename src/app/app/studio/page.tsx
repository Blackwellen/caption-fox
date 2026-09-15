import Link from 'next/link'
import { requireStudioModule } from '@/lib/studio/server'
import {
  contentCounts, listContent, listStudioActivity, listWorkspaceChannels,
} from '@/lib/studio/data'
import { PIPELINE_STAGES, CONTENT_STATUS_BADGE, CONTENT_STATUS_LABELS, CHANNEL_LABELS } from '@/lib/studio/constants'
import { parseStudioQuery, type RawParams } from '@/lib/studio/query'
import StudioHeader from '@/components/studio/StudioHeader'
import KpiStrip from '@/components/studio/KpiStrip'
import { AccessBlocked, StudioEmpty, LoadError } from '@/components/studio/states'
import { CARD, CARD_SHADOW, STUDIO_PAGE, Panel, OwnerChip, formatShortDate } from '@/components/studio/primitives'
import { Badge } from '@/components/ui/Badge'
import QuickComposer from './overview/QuickComposer'
import type { KpiValue } from '@/lib/studio/types'

export const metadata = { title: 'Studio · Caption Fox' }

export default async function StudioOverviewPage({
  searchParams,
}: { searchParams: Promise<RawParams> }) {
  const params = await searchParams
  const { supabase, ctx, capabilities, modules, access } = await requireStudioModule('overview')

  if (!access.allowed) {
    return (
      <div className={STUDIO_PAGE}>
        <StudioHeader module="overview" modules={modules} />
        <AccessBlocked access={access} />
      </div>
    )
  }

  const q = parseStudioQuery(params, { views: ['cards', 'table'], defaultView: 'table' })

  const [counts, recent, activity, channels] = await Promise.all([
    contentCounts(supabase, ctx.workspaceId),
    listContent(supabase, ctx.workspaceId, q, { limit: 8, paginate: false }),
    listStudioActivity(supabase, ctx.workspaceId, 6),
    listWorkspaceChannels(supabase, ctx.workspaceId),
  ])

  const kpis: KpiValue[] = [
    { id: 'drafts', label: 'Drafts in progress', value: String(counts.draft), tone: 'violet', icon: 'file' },
    { id: 'review', label: 'Ready to review', value: String(counts.pending_approval), tone: 'amber', icon: 'eye' },
    { id: 'scheduled', label: 'Scheduled this week', value: String(counts.scheduledThisWeek), tone: 'blue', icon: 'calendar' },
    { id: 'published', label: 'Published', value: String(counts.published), tone: 'green', icon: 'send' },
    { id: 'assets', label: 'Assets linked', value: String(counts.linkedAssets), tone: 'slate', icon: 'link' },
    { id: 'total', label: 'Total content', value: String(counts.total), tone: 'slate', icon: 'layers' },
  ]

  const stageCounts: Record<string, number> = {
    ideation: 0, draft: counts.draft, pending_approval: counts.pending_approval,
    approved: counts.approved, scheduled: counts.scheduled, published: counts.published,
  }

  return (
    <div className={STUDIO_PAGE}>
      <StudioHeader
        module="overview"
        modules={modules}
        actions={
          capabilities.createContent
            ? <Link href="/app/studio/compose" className="inline-flex h-9 items-center rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition-colors hover:bg-blue-700">Open Compose</Link>
            : undefined
        }
      />

      {counts.error ? <LoadError message={counts.error} className="mb-4" /> : <KpiStrip items={kpis} className="mb-4" />}

      <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          {capabilities.compose ? (
            <QuickComposer channels={channels} />
          ) : (
            <Panel title="Compose New Post">
              <StudioEmpty bare title="You do not have compose access" message="Ask a workspace admin for the Studio compose permission." />
            </Panel>
          )}
        </div>

        <Panel title="Quick actions">
          <div className="grid grid-cols-1 gap-2">
            <QuickAction href="/app/studio/ai-generate" title="AI Generate Post" hint="Create with AI in seconds" />
            <QuickAction href="/app/studio/templates" title="Create from Template" hint="Use a proven template" />
            <QuickAction href="/app/studio/content" title="Repurpose Content" hint="Turn one post into many" />
            <QuickAction href="/app/studio/ideas" title="Add from Ideas Board" hint="Pick an idea to get started" />
          </div>
        </Panel>
      </div>

      <Panel title="Content Pipeline" className="mb-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {PIPELINE_STAGES.map(stage => (
            <Link
              key={stage.id}
              href={stage.id === 'ideation' ? '/app/studio/ideas' : `/app/studio/content?status=${stage.id}`}
              className="rounded-lg border border-slate-200 px-3 py-3 transition-colors hover:border-blue-200 hover:bg-blue-50/40"
            >
              <p className="text-[22px] font-bold leading-none text-slate-900">{stageCounts[stage.id] ?? 0}</p>
              <p className="mt-1.5 text-xs font-medium text-slate-600">{stage.label}</p>
              <p className="text-[11px] text-slate-400">{stage.hint}</p>
            </Link>
          ))}
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Panel title="Recent Content" viewAllHref="/app/studio/content">
            {recent.error ? (
              <LoadError message={recent.error} />
            ) : recent.rows.length === 0 ? (
              <StudioEmpty bare icon="search" title="No content yet"
                message="Compose your first post, or generate one with AI, to see it here."
                action={<Link href="/app/studio/compose" className="text-sm font-medium text-blue-600 hover:text-blue-700">Open Compose →</Link>}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs font-medium uppercase tracking-wide text-slate-400">
                      <th className="py-2 pr-3 font-medium">Title</th>
                      <th className="py-2 pr-3 font-medium">Channels</th>
                      <th className="py-2 pr-3 font-medium">Status</th>
                      <th className="py-2 pr-3 font-medium">Owner</th>
                      <th className="py-2 pr-3 font-medium">Updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {recent.rows.map(row => (
                      <tr key={row.id} className="hover:bg-slate-50/60">
                        <td className="py-2.5 pr-3">
                          <Link href={`/app/studio/compose?id=${row.id}`} className="font-medium text-slate-800 hover:text-blue-600">
                            {row.internal_title || row.title || 'Untitled'}
                          </Link>
                        </td>
                        <td className="py-2.5 pr-3 text-slate-500">
                          {(row.platforms ?? []).map(p => CHANNEL_LABELS[p] ?? p).join(', ') || '—'}
                        </td>
                        <td className="py-2.5 pr-3">
                          <Badge variant={CONTENT_STATUS_BADGE[row.status as keyof typeof CONTENT_STATUS_BADGE] ?? 'slate'}>
                            {CONTENT_STATUS_LABELS[row.status as keyof typeof CONTENT_STATUS_LABELS] ?? row.status}
                          </Badge>
                        </td>
                        <td className="py-2.5 pr-3"><OwnerChip person={row.owner} /></td>
                        <td className="py-2.5 pr-3 text-slate-400">{formatShortDate(row.updated_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>

        <Panel title="Recent Activity" viewAllHref="/app/studio/content">
          {activity.rows.length === 0 ? (
            <p className="py-4 text-center text-[13px] text-slate-400">No activity yet.</p>
          ) : (
            <ul className="space-y-3">
              {activity.rows.map(item => (
                <li key={item.id} className="flex gap-2.5 text-[13px]">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
                  <span className="min-w-0">
                    <Link href={item.link ?? '#'} className="text-slate-700 hover:text-blue-600">
                      {item.summary}
                    </Link>
                    <span className="block text-[11px] text-slate-400">
                      {item.actor?.full_name ?? item.actor?.email ?? 'Someone'} · {formatShortDate(item.created_at)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  )
}

function QuickAction({ href, title, hint }: { href: string; title: string; hint: string }) {
  return (
    <Link
      href={href}
      className={`${CARD} ${CARD_SHADOW} flex flex-col gap-0.5 px-3 py-2.5 transition-colors hover:border-blue-200 hover:bg-blue-50/40`}
    >
      <span className="text-[13px] font-medium text-slate-800">{title}</span>
      <span className="text-[11px] text-slate-400">{hint}</span>
    </Link>
  )
}
