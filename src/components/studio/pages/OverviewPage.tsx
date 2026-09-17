import Link from 'next/link'
import {
  ArrowRight, CalendarDays, CheckCircle2, Eye, FileText, LayoutGrid, Lightbulb, MoreHorizontal, Repeat2, Send,
  Sparkles, SquareStack, Wand2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { requireStudioModule } from '@/lib/studio/server'
import {
  latestOwnDraft, listContent, listMedia, listMediaCollections, listPreviewAccounts, listStudioActivity, listWorkspaceChannels, overviewStats,
} from '@/lib/studio/data'
import { CHANNEL_LABELS, CONTENT_STATUSES, STUDIO_CHANNELS } from '@/lib/studio/constants'
import { parseStudioQuery, type RawParams } from '@/lib/studio/query'
import { signStudioMedia } from '@/lib/studio/sign'
import StudioPageHeader from '../StudioPageHeader'
import { AccessBlocked } from '../states'
import { ActivityList, ChannelIcons, ContentStatus } from '../records'
import { FiltersMenu, ViewToggle } from '../controls'
import { MenuLink } from '../MenuLink'
import { OverviewAssets, OverviewComposer, OverviewComposerProvider, type ComposerAsset } from '../overview/OverviewComposer'
import {
  Card, CardHeader, Delta, EmptyBlock, ErrorBlock, IconTile, PersonAvatar, S_TD, S_TH, TextLink,
  delta, fmtDate, fmtTime, personName, type Tone,
} from '../ui'

const PIPELINE: { id: string; label: string; hint: string; icon: React.ReactNode; tone: Tone; bg: string; href: (b: string) => string }[] = [
  { id: 'ideation', label: 'Ideation', hint: 'Ideas', icon: <Lightbulb size={15} />, tone: 'violet', bg: 'bg-[#f7f4ff] border-[#ece6ff]', href: b => `${b}/ideas` },
  { id: 'draft', label: 'Drafting', hint: 'In Progress', icon: <FileText size={15} />, tone: 'blue', bg: 'bg-[#f3f7ff] border-[#e1eaff]', href: b => `${b}/content?status=draft` },
  { id: 'pending_approval', label: 'Review', hint: 'Ready', icon: <Eye size={15} />, tone: 'amber', bg: 'bg-[#fffaf0] border-[#fcefd2]', href: b => `${b}/content?status=pending_approval` },
  { id: 'approved', label: 'Approval', hint: 'Pending', icon: <CheckCircle2 size={15} />, tone: 'violet', bg: 'bg-[#f8f5ff] border-[#ece6ff]', href: b => `${b}/content?status=approved` },
  { id: 'scheduledWeek', label: 'Scheduled', hint: 'This Week', icon: <CalendarDays size={15} />, tone: 'green', bg: 'bg-[#f2fbf5] border-[#daf2e2]', href: b => `${b}/content?status=scheduled` },
  { id: 'publishedMonth', label: 'Published', hint: 'This Month', icon: <Send size={15} />, tone: 'blue', bg: 'bg-[#f3f7ff] border-[#e1eaff]', href: b => `${b}/content?status=published` },
]

export default async function OverviewPage({ searchParams }: { searchParams: RawParams }) {
  const { supabase, ctx, userId, capabilities, modules, access, base } = await requireStudioModule('overview')
  if (!access.allowed) {
    return (
      <>
        <StudioPageHeader layout="stacked" base={base} modules={modules} title="Studio" />
        <AccessBlocked access={access} />
      </>
    )
  }

  const q = parseStudioQuery(searchParams, { views: ['table', 'cards'], defaultView: 'table', defaultSize: 10 })
  const [stats, recent, activity, rawAssets, connected, rawAccounts, collections, draft] = await Promise.all([
    overviewStats(supabase, ctx.workspaceId),
    listContent(supabase, ctx.workspaceId, { ...q, page: 1, size: 4 }),
    listStudioActivity(supabase, ctx.workspaceId, 4),
    listMedia(supabase, ctx.workspaceId, { ...q, q: '', status: 'ready', type: 'image', tag: '', collection: '', owner: '', from: '', to: '', archived: false, sort: 'created_desc', page: 1, size: 6 }),
    listWorkspaceChannels(supabase, ctx.workspaceId),
    listPreviewAccounts(supabase, ctx.workspaceId),
    listMediaCollections(supabase, ctx.workspaceId),
    latestOwnDraft(supabase, ctx.workspaceId, userId),
  ])
  const [recentRows, activityRows, assetRows, accounts] = await Promise.all([
    signStudioMedia(ctx.workspaceId, recent.rows),
    signStudioMedia(ctx.workspaceId, activity.rows),
    signStudioMedia(ctx.workspaceId, rawAssets.rows),
    signStudioMedia(ctx.workspaceId, rawAccounts),
  ])

  // Server render time anchors relative dates for this request.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now()
  const preferred = ['instagram', 'linkedin', 'tiktok', 'facebook', 'x']
  const available = preferred.filter(ch => connected.includes(ch))
  const composerChannels = (available.length ? available : preferred).slice(0, 3)
  const assets: ComposerAsset[] = assetRows.map(a => ({ id: a.id, name: a.file_name, url: a.thumbnail_path ?? null, type: a.file_type }))

  const kpis = [
    { id: 'drafts', value: stats.drafts, label: 'Drafts in progress', trend: stats.trend.drafts, icon: <FileText size={18} />, tone: 'violet' as Tone, href: `${base}/content?status=draft` },
    { id: 'review', value: stats.review, label: 'Ready to review', trend: stats.trend.review, icon: <Eye size={18} />, tone: 'blue' as Tone, href: `${base}/content?status=pending_approval` },
    { id: 'scheduled', value: stats.scheduledThisWeek, label: 'Scheduled this week', trend: stats.trend.scheduled, icon: <CalendarDays size={18} />, tone: 'green' as Tone, href: `${base}/content?status=scheduled` },
    { id: 'ai', value: stats.aiOutputs, label: 'AI-assisted outputs', trend: stats.trend.ai, icon: <Sparkles size={18} />, tone: 'amber' as Tone, href: `${base}/ai-generate` },
  ]
  const pipelineCount: Record<string, number> = stats.pipeline

  return (
    <>
      <StudioPageHeader layout="stacked" base={base} modules={modules} title="Studio"
        description="Create, customise and prepare content that performs across every channel."
        titleClassName="lg:text-[26px]" className="lg:mb-[17px]" />

      <OverviewComposerProvider assets={assets} channels={composerChannels} draft={capabilities.compose ? draft : null}>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_280px] xl:gap-5">
          <div className="flex min-w-0 flex-col gap-4 lg:gap-[15px]">
            {stats.error ? <Card><ErrorBlock message={stats.error} /></Card> : (
              <ul className="grid grid-cols-2 gap-3 lg:mb-[3px] lg:grid-cols-4 lg:gap-4">
                {kpis.map(kpi => (
                  <li key={kpi.id}>
                    <Link href={kpi.href} className="flex h-full items-center gap-3 rounded-[10px] border border-[#e6e9f0] bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-colors hover:border-[#c9d8ff] lg:h-[82px] lg:gap-[14px] lg:px-[16px] lg:py-0">
                      <IconTile tone={kpi.tone} round className="h-11 w-11">{kpi.icon}</IconTile>
                      <span className="min-w-0">
                        <span className="block text-[20px] font-semibold leading-tight text-slate-900 lg:text-[16px]">{kpi.value.toLocaleString('en-GB')}</span>
                        <span className="block truncate text-[12px] text-slate-600 lg:mt-[2px] lg:text-[10.5px]">{kpi.label}</span>
                        <Delta value={delta(kpi.trend.current, kpi.trend.previous)} suffix="vs last 7 days" muted className="mt-0.5 text-[11px] text-slate-500 lg:mt-[3px] lg:text-[10px]" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            <OverviewComposer base={base} canCompose={capabilities.compose && capabilities.createContent}
              canSchedule={capabilities.scheduleContent} canAssist={capabilities.generateAi && modules.includes('ai-generate')}
              accounts={accounts} allChannels={(connected.length ? STUDIO_CHANNELS.filter(c => connected.includes(c)) : [...STUDIO_CHANNELS]).slice(0, 8)} />

            <Card className="px-4 pb-4 pt-4 lg:h-[95px] lg:px-[15px] lg:pb-0 lg:pt-[9px]" aria-labelledby="pipeline-title">
              <CardHeader id="pipeline-title" title="Content Pipeline" />
              <ol className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:mt-[7px] lg:flex lg:items-center lg:gap-0">
                {PIPELINE.map((stage, i) => (
                  <li key={stage.id} className="flex items-center lg:flex-1">
                    <Link href={stage.href(base)} className={cn('flex h-full w-full items-center gap-2.5 rounded-[8px] border px-2.5 py-2.5 transition-shadow hover:shadow-sm lg:h-[52px] lg:gap-[10px] lg:px-[9px] lg:py-0', stage.bg)}>
                      <IconTile tone={stage.tone} round className="h-8 w-8 bg-white/70 lg:h-[30px] lg:w-[30px]">{stage.icon}</IconTile>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-slate-800 lg:text-[10.5px]">{stage.label}</span>
                        <span className="block truncate text-[11px] text-slate-500 lg:text-[9px]">{stage.hint}</span>
                      </span>
                      <span className="self-start pt-0.5 text-[13px] font-medium text-slate-800 lg:pt-[9px] lg:text-[10.5px]">{(pipelineCount[stage.id] ?? 0).toLocaleString('en-GB')}</span>
                    </Link>
                    {i < PIPELINE.length - 1 && <ArrowRight size={13} className="mx-1.5 hidden shrink-0 text-slate-500 lg:block" aria-hidden />}
                  </li>
                ))}
              </ol>
            </Card>

            <Card className="overflow-hidden" aria-labelledby="recent-content-title">
              <CardHeader id="recent-content-title" title="Recent Content" className="h-12 px-4 lg:h-[38px] lg:px-[15px]"
                action={(
                  <>
                    <ViewToggle value={q.view} defaultValue="table" className="lg:mr-[18px]"
                      options={[
                        { id: 'cards', label: 'Cards', icon: <SquareStack size={13} /> },
                        { id: 'table', label: 'Table', icon: <LayoutGrid size={13} /> },
                      ]} />
                    <FiltersMenu fields={[
                      { param: 'status', label: 'Status', options: CONTENT_STATUSES.filter(s => s !== 'archived').map(s => ({ value: s, label: s === 'pending_approval' ? 'In review' : s.charAt(0).toUpperCase() + s.slice(1) })) },
                      { param: 'channel', label: 'Channel', options: STUDIO_CHANNELS.map(c => ({ value: c, label: CHANNEL_LABELS[c]! })) },
                    ]} />
                    <MenuLink label="More content options" icon={<MoreHorizontal size={14} />} items={[
                      { label: 'Open Content Library', href: `${base}/content` },
                      ...(capabilities.exportContent ? [{ label: 'Export recent content (CSV)', href: `/api/studio/export?kind=content${q.status ? `&status=${q.status}` : ''}${q.channel ? `&channel=${q.channel}` : ''}`, download: true }] : []),
                      ...(capabilities.createContent ? [{ label: 'New content', href: `${base}/compose` }] : []),
                    ]} />
                  </>
                )} />
              {recent.error ? <ErrorBlock message={recent.error} /> : recentRows.length === 0 ? (
                <EmptyBlock search={Boolean(q.status || q.channel)} title={q.status || q.channel ? 'No content matches these filters' : 'No content yet'}
                  message={q.status || q.channel ? 'Clear the filters to see all recent content.' : 'Compose your first post or generate one with AI to see it here.'}
                  action={capabilities.createContent ? <TextLink href={`${base}/compose`}>Open Compose →</TextLink> : undefined} />
              ) : q.view === 'cards' ? (
                <ul className="grid grid-cols-1 gap-3 border-t border-[#eef0f4] p-4 sm:grid-cols-2 lg:grid-cols-4 lg:p-[15px]">
                  {recentRows.map(row => (
                    <li key={row.id}>
                      <Link href={`${base}/compose?id=${row.id}`} className="block overflow-hidden rounded-[8px] border border-[#e6e9f0] hover:border-[#c9d8ff]">
                        <div className="aspect-[16/9] bg-slate-100">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {row.thumbnail_url && <img src={row.thumbnail_url} alt="" loading="lazy" className="h-full w-full object-cover" />}
                        </div>
                        <div className="space-y-1.5 p-2.5">
                          <p className="truncate text-[13px] font-medium text-slate-800 lg:text-[10.5px]">{row.internal_title || row.title || 'Untitled'}</p>
                          <div className="flex items-center justify-between"><ChannelIcons channels={row.platforms} size={13} /><ContentStatus status={row.status} /></div>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="relative overflow-x-auto">
                  <table className="w-full min-w-[760px] border-collapse">
                    <caption className="sr-only">Recently updated content</caption>
                    <thead className="bg-[#f8f9fb]">
                      <tr className="border-y border-[#eef0f4]">
                        <th scope="col" className={cn(S_TH, 'pl-4 lg:w-[260px] lg:pl-[18px]')}>Title</th>
                        <th scope="col" className={cn(S_TH, 'lg:w-[160px]')}>Campaign</th>
                        <th scope="col" className={cn(S_TH, 'lg:w-[115px]')}>Channels</th>
                        <th scope="col" className={cn(S_TH, 'lg:w-[112px]')}>Status</th>
                        <th scope="col" className={cn(S_TH, 'lg:w-[152px]')}>Scheduled for</th>
                        <th scope="col" className={S_TH}>Author</th>
                        <th scope="col" className={cn(S_TH, 'w-10')}><span className="sr-only">Actions</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentRows.map(row => (
                        <tr key={row.id} className="border-b border-[#f0f2f5] last:border-0 hover:bg-slate-50/60">
                          <td className={cn(S_TD, 'h-12 pl-4 lg:h-[34px] lg:pl-[18px]')}>
                            <Link href={`${base}/compose?id=${row.id}`} className="flex items-center gap-2 font-normal text-slate-800 hover:text-[#1a5cff]">
                              <FileText size={13} className="shrink-0 text-[#4b7bff]" aria-hidden />
                              <span className="truncate">{row.internal_title || row.title || 'Untitled'}</span>
                            </Link>
                          </td>
                          <td className={cn(S_TD, 'truncate')}>{row.campaign?.name ?? '—'}</td>
                          <td className={S_TD}><ChannelIcons channels={row.platforms} size={13} /></td>
                          <td className={S_TD}><ContentStatus status={row.status} /></td>
                          <td className={cn(S_TD, 'whitespace-nowrap')}>
                            {row.scheduled_at && row.status !== 'draft'
                              ? <span className="inline-flex gap-4 lg:gap-[26px]"><span className="lg:w-[60px]">{fmtDate(row.scheduled_at)}</span><span>{fmtTime(row.scheduled_at)}</span></span>
                              : <span className="pl-1 text-slate-400">—</span>}
                          </td>
                          <td className={S_TD}>
                            <span className="flex items-center gap-2"><PersonAvatar person={row.owner} size={19} /><span className="truncate">{personName(row.owner)}</span></span>
                          </td>
                          <td className={cn(S_TD, 'pr-3 text-right')}>
                            <MenuLink label={`Actions for ${row.internal_title || row.title || 'content'}`} icon={<MoreHorizontal size={14} className="rotate-90" />} variant="ghost" items={[
                              { label: 'Open in Compose', href: `${base}/compose?id=${row.id}` },
                              { label: 'View in Content Library', href: `${base}/content?selected=${row.id}` },
                            ]} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {recentRows.length > 0 && (
                <div className="flex items-center justify-between border-t border-[#eef0f4] px-4 py-3 lg:h-[34px] lg:px-[22px] lg:py-0">
                  <p className="text-[12px] text-slate-500 lg:text-[9.5px]">Showing 1 to {recentRows.length} of {recent.total.toLocaleString('en-GB')} results</p>
                  <TextLink href={`${base}/content`} className="inline-flex items-center gap-1 lg:mr-[10px]">View all content <ArrowRight size={11} /></TextLink>
                </div>
              )}
            </Card>
          </div>

          <aside aria-label="Studio shortcuts" className="min-w-0 self-start rounded-[10px] border border-[#e6e9f0] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <section aria-labelledby="quick-actions-title" className="px-4 pb-4 pt-5 lg:px-[16px] lg:pb-[12px] lg:pt-[18px]">
              <CardHeader id="quick-actions-title" title="Quick Actions" />
              <ul className="mt-3 lg:mt-[11px]">
                {[
                  { href: `${base}/ai-generate`, title: 'AI Generate Post', hint: 'Create with AI in seconds', icon: <Wand2 size={15} />, show: modules.includes('ai-generate') },
                  { href: `${base}/templates`, title: 'Create from Template', hint: 'Use a proven template', icon: <FileText size={15} />, show: modules.includes('templates') },
                  { href: `${base}/content`, title: 'Repurpose Content', hint: 'Turn one post into many', icon: <Repeat2 size={15} />, show: modules.includes('content') && capabilities.repurpose },
                  { href: `${base}/ideas`, title: 'Add from Ideas Board', hint: 'Pick an idea to get started', icon: <Lightbulb size={15} />, show: modules.includes('ideas') },
                ].filter(a => a.show).map(action => (
                  <li key={action.title} className="-mt-px first:mt-0">
                    <Link href={action.href} className="flex items-center gap-3 rounded-[8px] border border-[#eceff4] px-3 py-2.5 transition-colors hover:border-[#c9d8ff] hover:bg-[#fafbff] lg:h-[48px] lg:gap-[11px] lg:px-[8px] lg:py-0">
                      <IconTile tone="blue" className="h-9 w-9 rounded-[7px] bg-[#f0f4ff] lg:h-[30px] lg:w-[30px]">{action.icon}</IconTile>
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-medium text-slate-800 lg:text-[10.5px]">{action.title}</span>
                        <span className="block truncate text-[12px] text-slate-500 lg:text-[9.5px]">{action.hint}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            {modules.includes('media') && (
              <OverviewAssets base={base} canUpload={capabilities.uploadMedia} collections={collections.rows.map(c => ({ id: c.id, name: c.name }))} />
            )}

            <section aria-labelledby="activity-title" className="border-t border-[#e6e9f0] px-4 pb-5 pt-4 lg:px-[16px] lg:pb-[22px] lg:pt-[21px]">
              <CardHeader id="activity-title" title="Recent Activity" action={<TextLink href={`${base}/content`}>View all</TextLink>} />
              {activity.error ? <ErrorBlock message={activity.error} className="mx-0" /> : <ActivityList rows={activityRows} now={now} className="mt-4 lg:mt-[16px]" />}
            </section>
          </aside>
        </div>
      </OverviewComposerProvider>
    </>
  )
}
