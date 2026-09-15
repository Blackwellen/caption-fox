import { redirect } from 'next/navigation'
import { requireStudioModule } from '@/lib/studio/server'
import {
  getContent, listContentAssets, listContentComments, listContentVersions,
  listWorkspaceCampaigns, listWorkspaceChannels, contentCounts,
} from '@/lib/studio/data'
import { parseStudioQuery, type RawParams } from '@/lib/studio/query'
import StudioHeader from '@/components/studio/StudioHeader'
import KpiStrip from '@/components/studio/KpiStrip'
import { AccessBlocked, LoadError } from '@/components/studio/states'
import { STUDIO_PAGE } from '@/components/studio/primitives'
import ComposeEditor from './ComposeEditor'
import type { KpiValue } from '@/lib/studio/types'

export const metadata = { title: 'Compose · Studio · Caption Fox' }

export default async function ComposePage({
  searchParams,
}: { searchParams: Promise<RawParams> }) {
  const params = await searchParams
  const { supabase, ctx, capabilities, modules, access } = await requireStudioModule('compose')

  if (!access.allowed) {
    return (
      <div className={STUDIO_PAGE}>
        <StudioHeader module="compose" modules={modules} />
        <AccessBlocked access={access} />
      </div>
    )
  }

  const q = parseStudioQuery(params, { views: ['table', 'cards'], defaultView: 'table' })
  const contentId = q.selected || (typeof params.id === 'string' ? params.id : '')

  const [counts, campaigns, channels] = await Promise.all([
    contentCounts(supabase, ctx.workspaceId),
    listWorkspaceCampaigns(supabase, ctx.workspaceId),
    listWorkspaceChannels(supabase, ctx.workspaceId),
  ])

  let existing = null
  let versions: Awaited<ReturnType<typeof listContentVersions>>['rows'] = []
  let comments: Awaited<ReturnType<typeof listContentComments>>['rows'] = []
  let assets: Awaited<ReturnType<typeof listContentAssets>>['rows'] = []

  if (contentId) {
    const result = await getContent(supabase, ctx.workspaceId, contentId)
    if (result.error) return <div className={STUDIO_PAGE}><LoadError message={result.error} /></div>
    if (!result.row) redirect('/app/studio/compose')
    existing = result.row
    ;[
      { rows: versions }, { rows: comments }, { rows: assets },
    ] = await Promise.all([
      listContentVersions(supabase, ctx.workspaceId, contentId),
      listContentComments(supabase, ctx.workspaceId, contentId),
      listContentAssets(supabase, ctx.workspaceId, contentId),
    ])
  }

  const kpis: KpiValue[] = [
    { id: 'drafts', label: 'Drafts', value: String(counts.draft), tone: 'violet', icon: 'file' },
    { id: 'review', label: 'In review', value: String(counts.pending_approval), tone: 'amber', icon: 'eye' },
    { id: 'scheduled', label: 'Scheduled today', value: String(counts.scheduledThisWeek), tone: 'blue', icon: 'calendar' },
    { id: 'assets', label: 'Needs assets', value: String(counts.draft > 0 ? Math.max(0, counts.draft - counts.linkedAssets) : 0), tone: 'amber', icon: 'image' },
    { id: 'approved', label: 'Approved', value: String(counts.approved), tone: 'green', icon: 'check' },
    { id: 'failed', label: 'Approval blockers', value: String(counts.failed), tone: 'red', icon: 'alert' },
  ]

  return (
    <div className={STUDIO_PAGE}>
      <StudioHeader module="compose" modules={modules} />
      <KpiStrip items={kpis} className="mb-4" />

      <ComposeEditor
        capabilities={capabilities}
        content={existing}
        versions={versions}
        comments={comments}
        assets={assets}
        campaigns={campaigns}
        channels={channels}
      />
    </div>
  )
}
