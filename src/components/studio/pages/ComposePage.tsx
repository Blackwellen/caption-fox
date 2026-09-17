import Link from 'next/link'
import {
  AlertCircle, CalendarDays, FileText, ImageOff, LayoutGrid, MoreVertical, SearchCheck, Sparkles, SquareStack,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { requireStudioModule } from '@/lib/studio/server'
import {
  composeStats, getContent, latestOwnDraft, listContent, listContentAssets, listContentComments, listContentVersions,
  listMedia, listPreviewAccounts, listTemplates, listWorkspaceChannels,
} from '@/lib/studio/data'
import { STUDIO_CHANNELS } from '@/lib/studio/constants'
import { parseStudioQuery, type RawParams, type StudioQuery } from '@/lib/studio/query'
import { signStudioMedia } from '@/lib/studio/sign'
import type { MediaRow } from '@/lib/studio/types'
import ComposeWorkspace, { type PickerAsset } from '../compose/ComposeWorkspace'
import StudioPageHeader from '../StudioPageHeader'
import { AccessBlocked } from '../states'
import { ChannelIcons, ContentStatus } from '../records'
import { SearchInput, SelectFilter, ViewToggle } from '../controls'
import { MenuLink } from '../MenuLink'
import { Card, EmptyBlock, ErrorBlock, KpiTile, PersonAvatar, S_TD, S_TH_PLAIN, personName } from '../ui'

const toPicker = (rows: MediaRow[]): PickerAsset[] =>
  rows.map(a => ({ id: a.id, name: a.file_name, url: a.thumbnail_path ?? (a.file_type === 'image' ? a.file_url : null), type: a.file_type }))

export default async function ComposePage({ searchParams }: { searchParams: RawParams }) {
  const { supabase, ctx, userId, capabilities, modules, access, base } = await requireStudioModule('compose')
  if (!access.allowed) {
    return (
      <>
        <StudioPageHeader layout="bar" base={base} modules={modules} title="Compose" />
        <AccessBlocked access={access} />
      </>
    )
  }

  const q = parseStudioQuery(searchParams, { views: ['table', 'cards'], defaultView: 'table', defaultSize: 3 })
  const wantsNew = searchParams.new === '1'
  const requested = typeof searchParams.id === 'string' ? searchParams.id : ''

  // Editing resolves in order: an explicit ?id, a fresh post (?new=1), then the
  // signed-in user's latest Compose draft so the page reopens work in progress.
  let contentId = /^[0-9a-f-]{36}$/i.test(requested) ? requested : ''
  if (!contentId && !wantsNew && capabilities.compose) contentId = (await latestOwnDraft(supabase, ctx.workspaceId, userId, 'compose'))?.id ?? ''

  const mediaQuery: StudioQuery = { ...q, q: '', status: 'ready', tag: '', collection: '', owner: '', from: '', to: '', archived: false, sort: 'created_desc', page: 1, size: 6, type: 'image' }
  const scope = ['draft', 'pending_approval', 'mine'].includes(String(searchParams.drafts)) ? String(searchParams.drafts) : ''
  const draftScope = { ...q, status: '', owner: scope === 'mine' ? userId : '' }
  const [stats, record, connected, rawAccounts, images, videos, gifs, templates, drafts] = await Promise.all([
    composeStats(supabase, ctx.workspaceId),
    contentId ? getContent(supabase, ctx.workspaceId, contentId) : Promise.resolve({ row: null, error: null }),
    listWorkspaceChannels(supabase, ctx.workspaceId),
    listPreviewAccounts(supabase, ctx.workspaceId),
    listMedia(supabase, ctx.workspaceId, mediaQuery),
    listMedia(supabase, ctx.workspaceId, { ...mediaQuery, type: 'video' }),
    listMedia(supabase, ctx.workspaceId, { ...mediaQuery, type: '', q: '.gif' }),
    listTemplates(supabase, ctx.workspaceId, { ...q, q: '', status: 'published', category: '', channel: '', owner: '', archived: false, sort: 'updated_desc', page: 1, size: 6 }),
    listContent(supabase, ctx.workspaceId, { ...draftScope, page: q.page, size: 3 }, { statuses: scope && scope !== 'mine' ? [scope] : ['draft', 'pending_approval'] }),
  ])

  const content = record.row
  const [versions, comments, attachedRows] = content
    ? await Promise.all([
      listContentVersions(supabase, ctx.workspaceId, content.id),
      listContentComments(supabase, ctx.workspaceId, content.id),
      listContentAssets(supabase, ctx.workspaceId, content.id),
    ])
    : [{ rows: [] }, { rows: [] }, { rows: [] }]

  const signed = await signStudioMedia(ctx.workspaceId, {
    content, comments: comments.rows, drafts: drafts.rows, accounts: rawAccounts, versions: versions.rows,
    attached: attachedRows.rows, images: images.rows, videos: videos.rows, gifs: gifs.rows.filter(g => g.mime_type === 'image/gif'),
    templates: templates.rows,
  })

  const labelSuggestions = [...new Set(signed.drafts.flatMap(d => d.tags ?? []))].slice(0, 20)
  // Server render time anchors relative dates for this request.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now()
  const channels = connected.length ? STUDIO_CHANNELS.filter(c => connected.includes(c)) : []
  const isNew = !content

  const kpis = stats.error ? <Card className="mt-3"><ErrorBlock message={stats.error} /></Card> : (
    <ul className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:mt-[12px] lg:gap-[12px] xl:grid-cols-6">
      <li key="kpi-1"><KpiTile icon={<FileText size={16} />} tone="blue" value={stats.drafts.total} label="Drafts" trend={stats.drafts} href={`${base}/content?status=draft`} /></li>
      <li key="kpi-2"><KpiTile icon={<SearchCheck size={16} />} tone="violet" value={stats.review.total} label="In review" trend={stats.review} href={`${base}/content?status=pending_approval`} /></li>
      <li key="kpi-3"><KpiTile icon={<CalendarDays size={16} />} tone="blue" value={stats.scheduledToday.total} label="Scheduled today" trend={stats.scheduledToday} suffix="vs yesterday" href={`${base}/content?status=scheduled`} /></li>
      <li key="kpi-4"><KpiTile icon={<ImageOff size={16} />} tone="amber" value={stats.needsAssets.total} label="Needs assets" trend={stats.needsAssets} invert href={`${base}/content?status=draft`} /></li>
      <li key="kpi-5"><KpiTile icon={<Sparkles size={16} />} tone="blue" value={stats.aiSuggestions.total} label="AI suggestions" trend={stats.aiSuggestions} href={`${base}/ai-generate`} /></li>
      <li key="kpi-6"><KpiTile icon={<AlertCircle size={16} />} tone="red" value={stats.blockers.total} label="Approval blockers" trend={stats.blockers} invert href={`${base}/content?status=pending_approval`} /></li>
    </ul>
  )

  const recentDrafts = (
    <Card className="overflow-hidden" aria-labelledby="recent-drafts-title">
      <div className="flex flex-wrap items-center gap-2 px-3.5 py-3 lg:h-[46px] lg:flex-nowrap lg:gap-[10px] lg:px-[11px] lg:py-0">
        <h2 id="recent-drafts-title" className="mr-auto text-[14px] font-semibold text-slate-900 lg:text-[12px]">Recent drafts</h2>
        <ViewToggle value={q.view} defaultValue="table" className="lg:mr-[8px]" itemClassName="lg:h-[22px] lg:w-[64px] lg:justify-center"
          options={[{ id: 'cards', label: 'Cards', icon: <SquareStack size={12} /> }, { id: 'table', label: 'Table', icon: <LayoutGrid size={12} /> }]} />
        <SelectFilter param="drafts" label="Drafts" allLabel="All drafts" display="value" className="lg:h-[26px] lg:w-[104px]"
          options={[{ value: 'draft', label: 'Drafts only' }, { value: 'pending_approval', label: 'In review' }, { value: 'mine', label: 'My drafts' }]} />
        <SearchInput placeholder="Search drafts…" className="w-full sm:w-auto lg:w-[262px]" inputClassName="lg:h-[26px]" />
      </div>
      {drafts.error ? <ErrorBlock message={drafts.error} /> : signed.drafts.length === 0 ? (
        <EmptyBlock search={Boolean(q.q || scope)} title={q.q || scope ? 'No drafts match' : 'No drafts yet'}
          message={q.q || scope ? 'Try a different search or clear the filter.' : 'Drafts you save appear here for quick access.'} />
      ) : q.view === 'cards' ? (
        <ul className="grid grid-cols-1 gap-2.5 border-t border-[#eef0f4] p-3 sm:grid-cols-3">
          {signed.drafts.map(d => (
            <li key={d.id}>
              <Link href={`${base}/compose?id=${d.id}`} className="block rounded-[8px] border border-[#e6e9f0] p-2.5 hover:border-[#c9d8ff]">
                <p className="truncate text-[13px] font-medium text-slate-800 lg:text-[10.5px]">{d.internal_title || d.title || 'Untitled'}</p>
                <div className="mt-2 flex items-center justify-between"><ChannelIcons channels={d.platforms} size={13} /><ContentStatus status={d.status} /></div>
                <p className="mt-1.5 text-[11px] text-slate-500 lg:text-[9px]">Edited {new Date(d.updated_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true })}</p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse">
            <caption className="sr-only">Recent drafts</caption>
            <thead>
              <tr className="border-y border-[#eef0f4]">
                <th scope="col" className={cn(S_TH_PLAIN, 'pl-3.5 lg:w-[270px] lg:pl-[11px]')}>Title</th>
                <th scope="col" className={cn(S_TH_PLAIN, 'lg:w-[164px]')}>Channels</th>
                <th scope="col" className={cn(S_TH_PLAIN, 'lg:w-[135px]')}>Status</th>
                <th scope="col" className={cn(S_TH_PLAIN, 'lg:w-[176px]')}>Last edited</th>
                <th scope="col" className={S_TH_PLAIN}>Owner</th>
                <th scope="col" className={cn(S_TH_PLAIN, 'w-10')}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {signed.drafts.map(d => (
                <tr key={d.id} className={cn('border-b border-[#f0f2f5] hover:bg-slate-50/60', d.id === content?.id && 'bg-[#f7f9ff]')}>
                  <td className={cn(S_TD, 'h-11 pl-3.5 lg:h-[31px] lg:pl-[11px] lg:text-[9.5px]')}>
                    <Link href={`${base}/compose?id=${d.id}`} aria-current={d.id === content?.id ? 'page' : undefined} className="block truncate text-slate-800 hover:text-[#1a5cff]">
                      {d.internal_title || d.title || 'Untitled'}
                    </Link>
                  </td>
                  <td className={S_TD}><ChannelIcons channels={d.platforms} size={12} /></td>
                  <td className={S_TD}><ContentStatus status={d.status} /></td>
                  <td className={cn(S_TD, 'whitespace-nowrap lg:text-[9.5px]')}>{new Date(d.updated_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}</td>
                  <td className={cn(S_TD, 'lg:text-[9.5px]')}><span className="flex items-center gap-2"><PersonAvatar person={d.owner} size={16} /><span className="truncate">{personName(d.owner)}</span></span></td>
                  <td className={cn(S_TD, 'pr-3 text-right')}>
                    <MenuLink variant="ghost" label={`Actions for ${d.internal_title || d.title || 'draft'}`} icon={<MoreVertical size={13} />} items={[
                      { label: 'Open in Compose', href: `${base}/compose?id=${d.id}` },
                      { label: 'View in Content Library', href: `${base}/content?selected=${d.id}` },
                    ]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {signed.drafts.length > 0 && (
        <div className="flex h-11 items-center justify-center lg:h-[34px]">
          <Link href={`${base}/content?status=draft`} className="text-[12px] font-medium text-[#1a5cff] hover:underline lg:text-[10px]">
            View all drafts{drafts.total > 3 ? ` (${drafts.total})` : ''}
          </Link>
        </div>
      )}
    </Card>
  )

  if (contentId && !content && !record.error && requested) {
    return (
      <>
        <StudioPageHeader layout="bar" base={base} modules={modules} title="Compose" />
        <Card><EmptyBlock search title="This post is not available" message="It may have been deleted, or it belongs to another workspace." action={<Link href={`${base}/compose?new=1`} className="text-[13px] font-medium text-[#1a5cff]">Start a new post</Link>} /></Card>
      </>
    )
  }

  return (
    <ComposeWorkspace
      key={content?.id ?? 'new'}
      base={base} modules={modules} content={signed.content} versions={signed.versions} comments={signed.comments}
      attached={toPicker(signed.attached)}
      assets={{ images: [...toPicker(signed.attached.filter(a => a.file_type !== 'video')), ...toPicker(signed.images).filter(i => !signed.attached.some(a => a.id === i.id))].slice(0, 6), videos: toPicker(signed.videos), gifs: toPicker(signed.gifs) }}
      templates={signed.templates.map(t => ({ id: t.id, name: t.name, url: t.cover_url, caption: t.caption_template ?? '', hashtags: t.hashtags ?? [] }))}
      accounts={signed.accounts} channels={channels} labelSuggestions={labelSuggestions} now={now}
      capabilities={{
        save: capabilities.compose && (isNew ? capabilities.createContent : capabilities.editContent),
        review: capabilities.editContent, schedule: capabilities.scheduleContent, publish: capabilities.publishContent,
        archive: capabilities.editContent, remove: capabilities.deleteContent, comment: capabilities.view,
        upload: capabilities.uploadMedia && modules.includes('media'), assist: capabilities.generateAi && modules.includes('ai-generate'),
      }}
      kpis={kpis} recentDrafts={recentDrafts}
    />
  )
}
