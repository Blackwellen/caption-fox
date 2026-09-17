import Link from 'next/link'
import {
  CalendarDays, CheckCircle2, Clock3, Eye, FileEdit, Folder, Heart, LayoutGrid, Link2, List, Maximize2, MessageSquare,
  Share2, SquareCheckBig, User,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { requireStudioModule } from '@/lib/studio/server'
import {
  contentCounts, engagementWindow, getContent, listContent, listStudioActivity, listWorkspacePeople, withContentCovers,
} from '@/lib/studio/data'
import { CHANNEL_LABELS, CONTENT_STATUSES, CONTENT_STATUS_LABELS, STUDIO_CHANNELS } from '@/lib/studio/constants'
import { parseStudioQuery, type RawParams } from '@/lib/studio/query'
import { signStudioMedia } from '@/lib/studio/sign'
import type { ContentRow } from '@/lib/studio/types'
import { ChannelIcon } from '@/components/home/brand-icons'
import StudioPageHeader from '../StudioPageHeader'
import { AccessBlocked } from '../states'
import { ContentStatus } from '../records'
import { FiltersMenu, Pager, SearchInput, SelectFilter, ViewToggle } from '../controls'
import { SortSelect } from '../ideas/IdeaClient'
import { ContentMenu, PreviewButton, ReadMore, RecordsTable, RowsPerPage, type ContentPerms } from '../content/ContentClient'
import { Card, CardHeader, Delta, EmptyBlock, ErrorBlock, PersonAvatar, S_CARD, delta, fmtAgo, fmtCompact, fmtDateTime, personName } from '../ui'

const SORTS = [
  { id: 'updated_desc', label: 'Updated (Newest)' }, { id: 'updated_asc', label: 'Updated (Oldest)' },
  { id: 'created_desc', label: 'Created (Newest)' }, { id: 'scheduled_asc', label: 'Scheduled (Soonest)' }, { id: 'title_asc', label: 'Title (A–Z)' },
]
const SCOPES = [
  { value: 'mine', label: 'My content' }, { value: 'draft', label: 'Drafts' }, { value: 'pending_approval', label: 'In review' },
  { value: 'scheduled', label: 'Scheduled' }, { value: 'published', label: 'Published' }, { value: 'archived', label: 'Archived' },
]

/** Compact card date: "Today, 9:00 AM", "Tomorrow, 12:00 PM" or "22 Sept, 11:00 AM". */
function shortWhen(iso: string, now: number): string {
  const d = new Date(iso)
  const time = d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase()
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diff = Math.round((day(d) - day(new Date(now))) / 86_400_000)
  if (diff === 0) return `Today, ${time}`
  if (diff === 1) return `Tomorrow, ${time}`
  return `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, ${time}`
}

function Engagement({ row, size = 'sm', values }: { row: ContentRow; size?: 'sm' | 'lg'; values?: Record<string, number> }) {
  const e = values ?? row.engagement ?? {}
  const items = [
    { key: 'views', icon: Eye, label: 'Views' }, { key: 'likes', icon: Heart, label: 'Likes' },
    { key: 'comments', icon: MessageSquare, label: 'Comments' }, { key: 'shares', icon: Share2, label: 'Shares' },
  ]
  if (!items.some(i => Number(e[i.key] ?? 0) > 0)) {
    return <p className={cn('text-slate-400', size === 'lg' ? 'py-2 text-[12px] lg:text-[10px]' : 'text-[11px] lg:text-[9px]')}>{row.status !== 'published' ? 'Engagement appears after publishing' : values ? 'No engagement in the last 7 days' : 'No engagement recorded yet'}</p>
  }
  if (size === 'lg') {
    return (
      <dl className="grid grid-cols-4 text-center">
        {items.map(({ key, icon: Icon, label }) => (
          <div key={key}>
            <dd className="flex items-center justify-center gap-1.5 text-[13px] font-semibold text-slate-900 lg:text-[10.5px]"><Icon size={13} className={key === 'likes' ? 'text-[#e5484d]' : 'text-[#1a5cff]'} aria-hidden />{fmtCompact(Number(e[key] ?? 0))}</dd>
            <dt className="mt-1 text-[11px] text-slate-500 lg:text-[8.5px]">{label}</dt>
          </div>
        ))}
      </dl>
    )
  }
  return (
    <ul className="flex items-center gap-4 text-[11px] text-slate-600 lg:gap-[18px] lg:text-[9.5px]" aria-label="Engagement">
      {items.map(({ key, icon: Icon, label }) => (
        <li key={key} className="flex items-center gap-1" title={label}><Icon size={12} aria-hidden /><span className="sr-only">{label}</span>{fmtCompact(Number(e[key] ?? 0))}</li>
      ))}
    </ul>
  )
}

export default async function ContentLibraryPage({ searchParams }: { searchParams: RawParams }) {
  const { supabase, ctx, userId, capabilities, modules, access, base } = await requireStudioModule('content')
  if (!access.allowed) {
    return (
      <>
        <StudioPageHeader layout="label-title" base={base} modules={modules} title="Content Library" />
        <AccessBlocked access={access} />
      </>
    )
  }

  const q = parseStudioQuery(searchParams, { views: ['cards', 'table'], defaultView: 'cards', defaultSort: 'updated_desc', defaultSize: 10 })
  const scope = SCOPES.some(s => s.value === searchParams.scope) ? String(searchParams.scope) : ''
  const scoped = {
    ...q,
    owner: scope === 'mine' ? userId : q.owner,
    status: ['draft', 'pending_approval', 'scheduled', 'published'].includes(scope) ? scope : q.status,
    archived: scope === 'archived' || q.archived,
  }

  const [counts, cards, records, people, activity, campaigns] = await Promise.all([
    contentCounts(supabase, ctx.workspaceId),
    q.view === 'cards' ? listContent(supabase, ctx.workspaceId, { ...scoped, page: 1, size: 4 }) : Promise.resolve({ rows: [], total: 0, error: null }),
    listContent(supabase, ctx.workspaceId, scoped),
    listWorkspacePeople(supabase, ctx.workspaceId),
    listStudioActivity(supabase, ctx.workspaceId, 4, 'content'),
    supabase.from('campaigns').select('id, name').eq('workspace_id', ctx.workspaceId).order('created_at', { ascending: false }).limit(50),
  ])

  const selectedId = q.selected || cards.rows[0]?.id || records.rows[0]?.id || null
  const inPage = [...cards.rows, ...records.rows].find(r => r.id === selectedId)
  const selectedRow = inPage ?? (selectedId ? (await getContent(supabase, ctx.workspaceId, selectedId)).row : null)

  const [cardRows, recordRows, previewRows] = await Promise.all([
    withContentCovers(supabase, ctx.workspaceId, cards.rows),
    withContentCovers(supabase, ctx.workspaceId, records.rows),
    selectedRow ? withContentCovers(supabase, ctx.workspaceId, [selectedRow]) : Promise.resolve([]),
  ])
  const recentEngagement = previewRows[0] ? (await engagementWindow(supabase, ctx.workspaceId, [previewRows[0].id], 7)).get(previewRows[0].id) : undefined
  const signed = await signStudioMedia(ctx.workspaceId, { cards: cardRows, records: recordRows, preview: previewRows[0] ?? null, activity: activity.rows })

  // Server render time anchors relative dates for this request.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now()
  const perms: ContentPerms = {
    edit: capabilities.editContent, approve: capabilities.approveContent, publish: capabilities.publishContent,
    schedule: capabilities.scheduleContent, remove: capabilities.deleteContent, repurpose: capabilities.repurpose,
    compose: capabilities.editContent && modules.includes('compose'),
  }
  const t = (key: string) => counts.trends[key] ?? { current: 0, previous: 0 }
  const filtered = ['q', 'channel', 'status', 'owner', 'campaign', 'tag', 'scope'].some(k => searchParams[k])
  const preview = signed.preview
  const title = (r: ContentRow) => r.internal_title || r.title || 'Untitled'

  const kpis = [
    { key: 'total', label: 'Total Content', value: counts.total, icon: <SquareCheckBig size={17} />, tile: 'bg-[#e9f0ff] text-[#1a5cff]', trend: t('total'), note: 'vs last 30 days', href: `${base}/content` },
    { key: 'draft', label: 'Drafts', value: counts.draft, icon: <FileEdit size={17} />, tile: 'bg-[#f1ebff] text-[#7c3aed]', trend: t('draft'), note: 'vs last 30 days', href: `${base}/content?scope=draft` },
    { key: 'review', label: 'In Review', value: counts.pending_approval, icon: <Clock3 size={17} />, tile: 'bg-[#fff4df] text-[#e59a0b]', trend: t('pending_approval'), note: 'vs last 30 days', href: `${base}/content?scope=pending_approval` },
    { key: 'scheduled', label: 'Scheduled', value: counts.scheduled, icon: <CalendarDays size={17} />, tile: 'bg-[#e9f0ff] text-[#1a5cff]', trend: t('scheduled'), note: 'vs last 30 days', href: `${base}/content?scope=scheduled` },
    { key: 'published', label: 'Published', value: counts.published, icon: <CheckCircle2 size={17} />, tile: 'bg-[#e8f7ee] text-[#16a34a]', trend: t('published'), note: 'vs last 30 days', href: `${base}/content?scope=published` },
    { key: 'assets', label: 'Reusable Assets', value: counts.linkedAssets, icon: <Link2 size={17} />, tile: 'bg-[#e9f0ff] text-[#1a5cff]', trend: t('linked'), note: 'linked in content', href: `${base}/media` },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 lg:gap-[24px] xl:grid-cols-[minmax(0,1fr)_290px]">
      <div className="min-w-0">
        <StudioPageHeader layout="label-title" base={base} modules={modules} title="Content Library" titleClassName="lg:text-[20px]"
          description="Manage, organise and repurpose your approved content across all channels." className="lg:mb-[14px]" />

        {counts.error ? <Card><ErrorBlock message={counts.error} /></Card> : (
          <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:gap-[16px] xl:grid-cols-6">
            {kpis.map(k => (
              <li key={k.key}>
                <Link href={k.href} className={cn(S_CARD, 'flex h-full gap-2.5 px-3 py-3 hover:border-[#c9d8ff] lg:h-[93px] lg:gap-[10px] lg:px-[11px] lg:pt-[14px]')}>
                  <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full lg:h-[34px] lg:w-[34px]', k.tile)} aria-hidden>{k.icon}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-[12px] text-slate-600 lg:overflow-visible lg:whitespace-nowrap lg:text-[9px]">{k.label}</span>
                    <span className="block text-[20px] font-semibold text-slate-900 lg:text-[17px]">{k.value.toLocaleString('en-GB')}</span>
                    <Delta short value={delta(k.trend.current, k.trend.previous)} className="block text-[11px] lg:text-[9px]" />
                    <span className="block text-[10px] text-slate-500 lg:text-[8.5px]">{k.note}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2 lg:mt-[22px] lg:flex-nowrap lg:gap-[11px]">
          <SearchInput placeholder="Search content by title, caption or tag…" className="w-full sm:w-auto lg:w-[256px] lg:shrink-0" inputClassName="lg:h-[29px] lg:text-[9.5px]" />
          <SelectFilter param="channel" label="Channel" allLabel="All channels" display="value" dense className="lg:h-[29px] lg:w-[121px]" options={STUDIO_CHANNELS.map(c => ({ value: c, label: CHANNEL_LABELS[c]! }))} />
          <SelectFilter param="status" label="Status" allLabel="All status" display="value" dense className="lg:h-[29px] lg:w-[108px]" options={CONTENT_STATUSES.filter(s => s !== 'archived').map(s => ({ value: s, label: CONTENT_STATUS_LABELS[s] }))} />
          <SelectFilter param="owner" label="Owner" allLabel="All owners" display="value" dense className="lg:h-[29px] lg:w-[101px]" options={people.map(p => ({ value: p.id, label: p.label }))} />
          <FiltersMenu label="Filter" className="lg:h-[29px] lg:px-[12px] lg:text-[9.5px]" fields={[
            { param: 'campaign', label: 'Campaign', options: (campaigns.data ?? []).map(c => ({ value: c.id, label: c.name })) },
            { param: 'tag', label: 'Tag', options: [...new Set(signed.records.flatMap(r => r.tags ?? []))].map(tag => ({ value: tag, label: tag })) },
          ]} />
        </div>

        <div className="mt-3 flex items-center gap-2 lg:mt-[16px]">
          <ViewToggle value={q.view} defaultValue="cards" className="lg:h-[29px]" itemClassName="lg:h-[25px] lg:px-[10px] lg:text-[9.5px]"
            options={[{ id: 'cards', label: 'Cards', icon: <LayoutGrid size={12} /> }, { id: 'table', label: 'Table', icon: <List size={12} /> }]} />
          <div className="ml-auto"><SortSelect value={q.sort} options={SORTS} /></div>
        </div>

        {q.view === 'cards' && (cards.error ? <Card className="mt-3"><ErrorBlock message={cards.error} /></Card> : signed.cards.length > 0 && (
          <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:mt-[14px] lg:grid-cols-4 lg:gap-[16px]" aria-label="Content cards">
            {signed.cards.map(r => (
              <li key={r.id}>
                <article className={cn(S_CARD, 'flex h-full flex-col overflow-hidden', r.id === preview?.id && 'border-[#9db8ff] ring-1 ring-[#c9d8ff]')}>
                  <div className="relative h-[140px] bg-[#eef1f6] lg:h-[108px]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {r.thumbnail_url && <img src={r.thumbnail_url} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />}
                    {r.platforms?.[0] && (
                      <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/95 px-1.5 py-0.5 text-[10px] text-slate-700 shadow-sm lg:text-[8px]">
                        <ChannelIcon channel={r.platforms[0]} size={10} />{CHANNEL_LABELS[r.platforms[0]]}
                      </span>
                    )}
                    <div className="absolute right-1.5 top-1.5 rounded-full bg-white/90"><ContentMenu row={r} base={base} perms={perms} /></div>
                  </div>
                  <div className="flex flex-1 flex-col px-3 pb-3 pt-2.5 lg:px-[10px] lg:pb-[10px] lg:pt-[10px]">
                    <PreviewButton id={r.id} className="truncate text-left text-[13px] font-semibold text-slate-900 hover:text-[#1a5cff] focus-visible:underline focus-visible:outline-none lg:text-[10.5px]">{title(r)}</PreviewButton>
                    <ContentStatus status={r.status} className="mt-1.5 self-start" />
                    <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-700 lg:mt-[10px] lg:text-[9px]">
                      <PersonAvatar person={r.owner} size={15} /><span className="truncate">{personName(r.owner)}</span>
                      <span className="ml-auto shrink-0 text-slate-500">{r.status === 'scheduled' && r.scheduled_at ? shortWhen(r.scheduled_at, now) : fmtAgo(r.updated_at, now)}</span>
                    </p>
                    <ul className="mt-2 flex flex-wrap gap-1 lg:mt-[10px]" aria-label="Hashtags">
                      {(r.hashtags ?? []).slice(0, 3).map(h => <li key={h} className="rounded-[4px] bg-[#eef3ff] px-1.5 py-0.5 text-[10px] text-[#1a5cff] lg:text-[8.5px]">{h.startsWith('#') ? h : `#${h}`}</li>)}
                    </ul>
                    <div className="mt-auto border-t border-[#f0f2f5] pt-2 lg:pt-[9px]"><Engagement row={r} /></div>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        ))}

        <Card className="mt-3 overflow-hidden lg:mt-[16px]" aria-labelledby="records-title">
          {records.error ? <ErrorBlock message={records.error} /> : (
            <RecordsTable rows={signed.records} base={base} perms={perms} selectedId={preview?.id ?? null}
              controls={(
                <>
                  <SelectFilter param="scope" label="View" allLabel="All Content" display="prefix" prefix="View" className="lg:h-[31px] lg:w-[150px] lg:text-[10px]" options={SCOPES} />
                </>
              )}>
              {signed.records.length === 0 ? (
                <EmptyBlock search={filtered} title={filtered ? 'No content matches these filters' : 'No content yet'}
                  message={filtered ? 'Clear the filters or switch the view to see more records.' : 'Create a post in Compose and it appears here.'} />
              ) : (
                <div className="flex flex-wrap items-center gap-3 border-t border-[#eef0f4] px-3.5 py-2.5 lg:h-[50px] lg:px-[14px] lg:py-0">
                  <Pager page={q.page} size={q.size} total={records.total} noun="results" edges className="min-w-0 flex-1" />
                  <RowsPerPage size={q.size} />
                </div>
              )}
            </RecordsTable>
          )}
        </Card>
      </div>

      {/* ── Right rail ─────────────────────────────────────────────────── */}
      <aside className="flex min-w-0 flex-col gap-3 lg:gap-[12px]" aria-label="Content preview and activity">
        <Card className="px-4 pb-4 pt-4 lg:px-[15px] lg:pb-[14px] lg:pt-[14px]" aria-labelledby="content-preview-title">
          <CardHeader id="content-preview-title" title="Content Preview" titleClassName="lg:text-[11.5px]"
            action={preview && perms.compose ? <Link href={`${base}/compose?id=${preview.id}`} aria-label="Open in Compose" className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"><Maximize2 size={13} /></Link> : undefined} />
          {!preview ? <EmptyBlock title="Nothing to preview" message="Select a content record to see its preview and engagement." /> : (
            <>
              <div className="relative mt-3 h-[150px] overflow-hidden rounded-[8px] bg-[#eef1f6] lg:mt-[12px] lg:h-[124px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {preview.thumbnail_url && <img src={preview.thumbnail_url} alt="" className="absolute inset-0 h-full w-full object-cover" />}
                <div className="absolute right-1.5 top-1.5 rounded-full bg-white/90"><ContentMenu row={preview} base={base} perms={perms} /></div>
              </div>
              <p className="mt-3 flex items-center gap-2 text-[12px] text-slate-700 lg:mt-[12px] lg:text-[9.5px]">
                {preview.platforms?.[0] && <><ChannelIcon channel={preview.platforms[0]} size={14} />{CHANNEL_LABELS[preview.platforms[0]]}</>}
                <ContentStatus status={preview.status} />
              </p>
              <h3 className="mt-2 text-[14px] font-semibold text-slate-900 lg:mt-[8px] lg:text-[11px]">{title(preview)}</h3>
              <ReadMore key={preview.id} text={preview.caption ?? ''} />
              {(preview.hashtags?.length ?? 0) > 0 && (
                <ul className="mt-2 flex flex-wrap gap-1.5 lg:mt-[8px]" aria-label="Hashtags">
                  {preview.hashtags!.slice(0, 3).map(h => <li key={h} className="rounded-[4px] bg-[#eef3ff] px-1.5 py-0.5 text-[11px] text-[#1a5cff] lg:text-[8.5px]">{h.startsWith('#') ? h : `#${h}`}</li>)}
                  {preview.hashtags!.length > 3 && <li className="rounded-[4px] bg-[#eef3ff] px-1.5 py-0.5 text-[11px] text-[#1a5cff] lg:text-[8.5px]">+{preview.hashtags!.length - 3}</li>}
                </ul>
              )}
              <dl className="mt-3 space-y-2 border-b border-[#eef0f4] pb-3 text-[12px] lg:mt-[16px] lg:space-y-[8px] lg:pb-[14px] lg:text-[10px]">
                <div className="flex items-center gap-2"><dt className="flex items-center gap-2 text-slate-600"><CalendarDays size={12} aria-hidden />{preview.published_at ? 'Published' : 'Scheduled'}</dt>
                  <dd className="ml-auto text-slate-800">{preview.published_at ? fmtDateTime(preview.published_at) : preview.scheduled_at ? fmtDateTime(preview.scheduled_at) : 'Not scheduled'}</dd></div>
                <div className="flex items-center gap-2"><dt className="flex items-center gap-2 text-slate-600"><Folder size={12} aria-hidden />Campaign</dt>
                  <dd className="ml-auto truncate">{preview.campaign ? <Link href={`${base.replace(/\/studio$/, '')}/campaigns/${preview.campaign.id}`} className="text-[#1a5cff] hover:underline">{preview.campaign.name}</Link> : <span className="text-slate-400">None</span>}</dd></div>
                <div className="flex items-center gap-2"><dt className="flex items-center gap-2 text-slate-600"><User size={12} aria-hidden />Owner</dt>
                  <dd className="ml-auto flex items-center gap-1.5 text-slate-800"><PersonAvatar person={preview.owner} size={15} />{personName(preview.owner)}</dd></div>
              </dl>
              <h3 className="mt-3 text-[12px] font-semibold text-slate-900 lg:mt-[14px] lg:text-[10px]">Engagement Snapshot (Last 7 Days)</h3>
              <div className="mt-2 lg:mt-[14px]"><Engagement row={preview} size="lg" values={{ views: 0, likes: 0, comments: 0, shares: 0, ...recentEngagement }} /></div>
            </>
          )}
        </Card>

        <Card className="px-4 pb-4 pt-4 lg:px-[15px] lg:pb-[14px] lg:pt-[16px]" aria-labelledby="content-activity-title">
          <CardHeader id="content-activity-title" title="Recent Activity" titleClassName="lg:text-[10.5px]" />
          {signed.activity.length === 0 ? <p className="py-3 text-[12px] text-slate-500 lg:text-[9.5px]">Content changes appear here.</p> : (
            <ul className="mt-3 space-y-3 lg:mt-[16px] lg:space-y-[22px]">
              {signed.activity.map(a => (
                <li key={a.id} className="flex items-center gap-2 lg:gap-[8px]">
                  <PersonAvatar person={a.actor} size={18} />
                  {a.link
                    ? <Link href={a.link} className="min-w-0 flex-1 truncate text-[12px] text-slate-600 hover:text-slate-900 lg:text-[9px]"><b className="font-semibold text-slate-800">{personName(a.actor)}</b> {a.summary}</Link>
                    : <span className="min-w-0 flex-1 truncate text-[12px] text-slate-600 lg:text-[9px]"><b className="font-semibold text-slate-800">{personName(a.actor)}</b> {a.summary}</span>}
                  <time className="shrink-0 text-[11px] text-slate-500 lg:text-[9px]" dateTime={a.created_at}>{fmtAgo(a.created_at, now)}</time>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </aside>
    </div>
  )
}
