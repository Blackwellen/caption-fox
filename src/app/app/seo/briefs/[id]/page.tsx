import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { requireSeoTab } from '@/lib/seo/server'
import { getBriefComments, getBriefSections } from '@/lib/seo/queries'
import { formatDate, formatDateTime, formatCompact, dueLabel, humanise, formatCurrency } from '@/lib/seo/format'
import { Card, CardHeader, EmptyPanel, IntentChip, ProgressBar, StatusChip } from '@/components/seo/primitives'
import { SeoPageChrome } from '@/components/seo/SeoPageChrome'
import { BriefStatusControl } from '@/components/seo/wizards/BriefStatusControl'
import { BriefOutlineEditor } from '@/components/seo/wizards/BriefOutlineEditor'
import { BriefCommentComposer } from '@/components/seo/wizards/BriefCommentComposer'

export const dynamic = 'force-dynamic'

export default async function SeoBriefDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await requireSeoTab('briefs')
  const { site, ctx, blocked, capabilities } = session
  if (blocked || !site) return <SeoPageChrome tab="briefs" tabs={session.tabs} blocked={blocked ?? 'workspace-type'}><div /></SeoPageChrome>

  const { data: brief } = await session.supabase
    .from('seo_content_briefs')
    .select('*, owner:profiles!seo_content_briefs_owner_id_fkey(id, full_name, avatar_url), keyword:seo_keywords(id, keyword, search_volume, difficulty, cpc, current_rank)')
    .eq('workspace_id', ctx.workspaceId)
    .eq('site_id', site.id)
    .eq('id', id)
    .maybeSingle()

  if (!brief) notFound()

  const scope = { supabase: session.supabase, workspaceId: ctx.workspaceId, siteId: site.id }
  const [sections, comments] = await Promise.all([getBriefSections(scope, id), getBriefComments(scope, id)])
  const completedSections = sections.filter(s => s.completed).length
  const due = dueLabel(brief.due_date)

  return (
    <SeoPageChrome tab="briefs" tabs={session.tabs} blocked={null}>
      <Link href="/app/seo/briefs" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft size={14} /> Back to Briefs
      </Link>

      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">{brief.title}</h1>
            {capabilities.editBrief ? <BriefStatusControl briefId={brief.id} status={brief.status} /> : <StatusChip status={brief.status} />}
          </div>
          <p className="text-sm text-slate-500">Target keyword: {brief.target_keyword}</p>
        </div>
        <div className="flex items-center gap-2">
          <IntentChip intent={brief.intent} />
          <StatusChip status={brief.priority} />
          <span className={due.overdue ? 'text-sm font-medium text-red-600' : 'text-sm text-slate-500'}>{due.text}</span>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-5">
          <Card className="p-5">
            <CardHeader title="Brief Outline" action={<span className="text-xs text-slate-400">{completedSections}/{sections.length} sections complete</span>} />
            {sections.length === 0 && !capabilities.editBrief
              ? <EmptyPanel title="No outline yet" description="Add H1/H2/H3 sections to plan this piece of content." />
              : <div className="mt-3"><BriefOutlineEditor briefId={brief.id} sections={sections} canEdit={capabilities.editBrief} /></div>}
          </Card>

          <Card className="p-5">
            <CardHeader title="Comments" action={<span className="text-xs text-slate-400">{comments.length}</span>} />
            {comments.length === 0
              ? <EmptyPanel title="No comments yet" description="Feedback and discussion on this brief will appear here." />
              : (
                <ul className="mt-3 space-y-4">
                  {comments.map(comment => (
                    <li key={comment.id} className="flex gap-2.5">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
                        {(comment.author?.full_name ?? '?').slice(0, 1).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm"><span className="font-medium text-slate-800">{comment.author?.full_name ?? 'Unknown'}</span> <span className="text-xs text-slate-400">{formatDateTime(comment.created_at)}</span></p>
                        <p className="mt-0.5 text-sm text-slate-600">{comment.body}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            {capabilities.commentBrief && <BriefCommentComposer briefId={brief.id} />}
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="p-5">
            <CardHeader title="Brief Details" />
            <dl className="mt-3 space-y-3 text-sm">
              <Row label="Content Type" value={humanise(brief.content_type)} />
              <Row label="Owner" value={brief.owner?.full_name ?? '—'} />
              <Row label="Due Date" value={brief.due_date ? formatDate(brief.due_date) : 'No due date'} />
              <Row label="Est. Traffic" value={formatCompact(brief.est_traffic)} />
              {brief.published_url && (
                <Row label="Published URL" value={<a href={brief.published_url} className="inline-flex items-center gap-1 text-blue-600 hover:underline">{brief.published_url}<ExternalLink size={11} /></a>} />
              )}
            </dl>
            <div className="mt-4"><ProgressBar value={brief.completion} label="Brief completion" /><p className="mt-1 text-xs text-slate-500">{brief.completion}% complete</p></div>
          </Card>

          {brief.keyword && (
            <Card className="p-5">
              <CardHeader title="Source Keyword" />
              <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                <Row label="Current Rank" value={brief.keyword.current_rank != null ? `#${brief.keyword.current_rank}` : 'Not ranking'} />
                <Row label="Volume" value={formatCompact(brief.keyword.search_volume)} />
                <Row label="Difficulty" value={brief.keyword.difficulty != null ? String(brief.keyword.difficulty) : '—'} />
                <Row label="CPC" value={brief.keyword.cpc != null ? formatCurrency(brief.keyword.cpc) : '—'} />
              </div>
            </Card>
          )}
        </div>
      </div>
    </SeoPageChrome>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-slate-400">{label}</dt>
      <dd className="font-medium text-slate-800">{value}</dd>
    </div>
  )
}
