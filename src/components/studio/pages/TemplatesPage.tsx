import Link from 'next/link'
import {
  BadgeCheck, Bookmark, CircleCheck, Clock3, LayoutGrid, List, MoreHorizontal, Star, TrendingUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { requireStudioModule } from '@/lib/studio/server'
import {
  listMedia, listPreviewAccounts, listTemplates, listWorkspacePeople, templateCounts, templatePerformance,
} from '@/lib/studio/data'
import {
  CHANNEL_LABELS, STUDIO_CHANNELS, TEMPLATE_CATEGORIES, TEMPLATE_STATUS_LABELS, TEMPLATE_STATUSES, type TemplateStatus,
} from '@/lib/studio/constants'
import { parseStudioQuery, type RawParams } from '@/lib/studio/query'
import { signStudioMedia } from '@/lib/studio/sign'
import type { TemplateRow } from '@/lib/studio/types'
import StudioPageHeader from '../StudioPageHeader'
import { AccessBlocked } from '../states'
import { ChannelIcons } from '../records'
import { FiltersMenu, Pager, SearchInput, SelectFilter, ViewToggle } from '../controls'
import SocialPreview from '../SocialPreview'
import {
  DuplicateTemplateButton, FavouriteButton, FullTemplatePreview, PreviewTemplateButton, SelectedTemplateActions, TemplateMenu, TemplateQuickActions,
  UseTemplateButton, type TemplatePerms,
} from '../templates/TemplateClient'
import {
  Card, CardHeader, Delta, EmptyBlock, ErrorBlock, IconTile, btnClass, PersonAvatar, Pill, S_TD, S_TH_PLAIN, delta, fmtAgo, fmtCompact, fmtDate,
  personName, type Tone,
} from '../ui'

const STATUS_TONE: Record<string, Tone> = {
  draft: 'slate', in_review: 'orange', changes_requested: 'red', approved: 'violet', published: 'green', archived: 'slate',
}
const CHANNEL_BADGE: Record<string, string> = {
  linkedin: 'bg-[#e8f0fe] text-[#0a66c2]', instagram: 'bg-[#fdeaf3] text-[#c13584]', x: 'bg-slate-800 text-white',
  facebook: 'bg-[#e7f0ff] text-[#1877f2]', tiktok: 'bg-slate-900 text-white', youtube: 'bg-[#ffe9e9] text-[#e02424]',
}
const POST_LABEL: Record<string, string> = { linkedin: 'LinkedIn Post', instagram: 'Instagram Post', x: 'Twitter/X Post', facebook: 'Facebook Post', tiktok: 'TikTok Video', youtube: 'YouTube Video', pinterest: 'Pin', threads: 'Threads Post' }

const GUIDELINES = [
  'Write one clear message per template and keep the call to action specific.',
  'Use {{placeholders}} for anything that changes between uses, such as {{product}}, {{date}} or {{offer}}.',
  'Stay inside the channel’s character limit once placeholders are filled.',
  'Add a cover image so teammates can recognise the template at a glance.',
  'Send templates for brand review before publishing them to the shared library.',
]

function UsageChart({ points: daily }: { points: { date: string; uses: number }[] }) {
  const w = 170
  const h = 92
  // Plots the running total of uses across the window (daily uses are sparse), sampled into ~10 points.
  const per = Math.max(1, Math.ceil(daily.length / 10))
  const points = Array.from({ length: Math.ceil(daily.length / per) }, (_, i) => {
    const slice = daily.slice(i * per, (i + 1) * per)
    const upTo = (i + 1) * per
    return { date: slice[0]!.date, uses: daily.slice(0, upTo).reduce((s, p) => s + p.uses, 0) }
  })
  const max = Math.max(1, ...points.map(p => p.uses))
  const step = points.length > 1 ? w / (points.length - 1) : w
  const coords = points.map((p, i) => [i * step, h - (p.uses / max) * (h - 12) - 6] as const)
  const line = coords.map(([x, y], i) => {
    if (i === 0) return `M${x.toFixed(1)},${y.toFixed(1)}`
    const [px, py] = coords[i - 1]!
    const mx = ((px + x) / 2).toFixed(1)
    return `C${mx},${py.toFixed(1)} ${mx},${y.toFixed(1)} ${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  const labels = points.filter((_, i) => i % Math.max(1, Math.ceil(points.length / 5)) === 0).slice(0, 5)
  const total = daily.reduce((s, p) => s + p.uses, 0)
  return (
    <figure className="min-w-0 flex-1">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-[92px] w-full overflow-visible" role="img" aria-label={`Cumulative template uses, ${total} in total over ${daily.length} days`}>
        <defs><linearGradient id="tpl-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1a5cff" stopOpacity="0.18" /><stop offset="1" stopColor="#1a5cff" stopOpacity="0" /></linearGradient></defs>
        {[0.25, 0.5, 0.75].map(r => <line key={r} x1="0" x2={w} y1={h * r} y2={h * r} stroke="#eef0f4" strokeWidth="0.6" />)}
        {coords.length > 1 && <path d={`${line} L${w},${h} L0,${h} Z`} fill="url(#tpl-area)" />}
        <path d={line} fill="none" stroke="#1a5cff" strokeWidth="1.4" strokeLinejoin="round" />
        {coords.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.6" fill="#fff" stroke="#1a5cff" strokeWidth="1" />)}
      </svg>
      <figcaption className="mt-1 flex justify-between text-[10px] text-slate-500 lg:text-[7.5px]">
        {labels.map(p => <span key={p.date}>{new Date(`${p.date}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>)}
      </figcaption>
    </figure>
  )
}

export default async function TemplatesPage({ searchParams }: { searchParams: RawParams }) {
  const { supabase, ctx, userId, capabilities, modules, access, base } = await requireStudioModule('templates')
  if (!access.allowed) {
    return (
      <>
        <StudioPageHeader layout="stacked" base={base} modules={modules} title="Templates" />
        <AccessBlocked access={access} />
      </>
    )
  }

  const q = parseStudioQuery(searchParams, { views: ['grid', 'list'], defaultView: 'grid', defaultSize: 5 })
  const range = [7, 30, 90].includes(Number(searchParams.range)) ? Number(searchParams.range) : 30
  const size = q.view === 'list' ? Math.max(10, q.size) : q.size

  const [counts, popular, all, people, rawAccounts, images, brandVoice] = await Promise.all([
    templateCounts(supabase, ctx.workspaceId),
    listTemplates(supabase, ctx.workspaceId, { ...q, sort: 'usage_desc', page: 1, size: 4 }, { userId }),
    listTemplates(supabase, ctx.workspaceId, { ...q, size }, { userId }),
    listWorkspacePeople(supabase, ctx.workspaceId),
    listPreviewAccounts(supabase, ctx.workspaceId),
    listMedia(supabase, ctx.workspaceId, { ...q, q: '', status: 'ready', type: 'image', tag: '', collection: '', owner: '', from: '', to: '', archived: false, sort: 'created_desc', page: 1, size: 12 }),
    supabase.from('brand_voice_profiles').select('style_rules, do_not_use').eq('workspace_id', ctx.workspaceId).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
  ])

  const selectedId = q.selected || popular.rows[0]?.id || all.rows[0]?.id || ''
  let selected: TemplateRow | null = [...popular.rows, ...all.rows].find(t => t.id === selectedId) ?? null
  if (!selected && selectedId) {
    selected = (await listTemplates(supabase, ctx.workspaceId, { ...q, q: '', status: '', category: '', channel: '', owner: '', tag: '', page: 1, size: 200 }, { userId })).rows.find(t => t.id === selectedId) ?? null
  }
  const performance = selected ? await templatePerformance(supabase, ctx.workspaceId, selected.id, range) : null
  const signed = await signStudioMedia(ctx.workspaceId, { popular: popular.rows, all: all.rows, selected, accounts: rawAccounts, images: images.rows })

  // Server render time anchors relative dates for this request.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now()
  const perms: TemplatePerms = {
    create: capabilities.createTemplates, edit: capabilities.editTemplates, approve: capabilities.approveTemplates,
    publish: capabilities.publishTemplates, useForContent: capabilities.createContent && modules.includes('compose'),
  }
  const covers = signed.images.map(i => ({ id: i.id, name: i.file_name, url: i.thumbnail_path }))
  const pct = (n: number) => (counts.total ? `${Math.round((n / counts.total) * 1000) / 10}% of total` : '0% of total')
  const guidelines = [
    ...(brandVoice.data?.style_rules ? [`Brand voice: ${brandVoice.data.style_rules}`] : []),
    ...(brandVoice.data?.do_not_use?.length ? [`Never use: ${brandVoice.data.do_not_use.join(', ')}.`] : []),
    ...GUIDELINES,
  ]
  const filterKeys = ['q', 'channel', 'category', 'owner', 'status', 'tag']
  const filtered = filterKeys.some(k => searchParams[k])
  const sel = signed.selected
  const account = sel ? rawAccounts[sel.channel ?? 'linkedin'] ? signed.accounts[sel.channel ?? 'linkedin']! : { name: 'Your account', handle: '@your_account', avatar_url: null, followers: null } : null

  const kpi = (key: string, icon: React.ReactNode, tone: Tone, label: string, value: React.ReactNode, note: React.ReactNode, href: string) => (
    <li key={key}>
      <Link href={href} className="flex h-full gap-3 rounded-[10px] border border-[#e6e9f0] bg-white px-3 py-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)] hover:border-[#c9d8ff] lg:h-[90px] lg:gap-[9px] lg:px-[11px] lg:pt-[15px]">
        <IconTile tone={tone} className="h-9 w-9 rounded-[8px] lg:h-[28px] lg:w-[28px]">{icon}</IconTile>
        <span className="min-w-0">
          <span className="block whitespace-nowrap text-[12px] text-slate-600 lg:text-[8.5px]">{label}</span>
          <span className="mt-0.5 block truncate text-[20px] font-semibold text-slate-900 lg:mt-[4px] lg:overflow-visible lg:whitespace-nowrap lg:text-[16px]">{value}</span>
          <span className="mt-1 block truncate text-[11px] lg:mt-[10px] lg:overflow-visible lg:whitespace-nowrap lg:text-[8.5px]">{note}</span>
        </span>
      </Link>
    </li>
  )

  const card = (t: TemplateRow) => (
    <article key={t.id} className={cn('flex flex-col overflow-hidden rounded-[10px] border bg-white', t.id === sel?.id ? 'border-[#8fb0ff] ring-1 ring-[#c9d8ff]' : 'border-[#e6e9f0]')}>
      <div className="relative aspect-[190/162] shrink-0 overflow-hidden bg-slate-100 lg:aspect-auto lg:h-[162px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {t.cover_url && <img src={t.cover_url} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />}
        <div className="absolute right-2 top-2 rounded-full bg-white/95 shadow">
          <TemplateMenu template={t} perms={perms} label={`Actions for ${t.name}`} />
        </div>
      </div>
      <div className="flex flex-1 flex-col px-3 pb-3 pt-2.5 lg:px-[10px] lg:pb-[10px] lg:pt-[10px]">
        <div className="flex items-center">
          <span className={cn('rounded-[4px] px-1.5 py-0.5 text-[10px] font-medium lg:text-[8px]', CHANNEL_BADGE[t.channel ?? ''] ?? 'bg-slate-100 text-slate-600')}>{POST_LABEL[t.channel ?? ''] ?? 'Post'}</span>
          <FavouriteButton id={t.id} favourite={Boolean(t.favourite)} className="ml-auto" />
        </div>
        <h3 className="mt-1.5 truncate text-[13px] font-semibold text-slate-900 lg:mt-[5px] lg:text-[10.5px]">{t.name}</h3>
        <p className="mt-2 flex items-center gap-2 text-[11px] text-slate-600 lg:mt-[10px] lg:gap-[8px] lg:text-[8.5px]">
          <TrendingUp size={10} aria-hidden /> {fmtCompact(t.usage_count)} uses
          <span className="ml-3 flex min-w-0 items-center gap-1.5"><PersonAvatar person={t.owner} size={14} /><span className="truncate">{personName(t.owner)}</span></span>
        </p>
        <p className="mt-2 flex items-center text-[11px] text-slate-500 lg:mt-[12px] lg:text-[8.5px]">
          <Pill tone={STATUS_TONE[t.status] ?? 'slate'}>{TEMPLATE_STATUS_LABELS[t.status as TemplateStatus] ?? t.status}</Pill>
          <span className="ml-auto">Updated {fmtAgo(t.updated_at, now).toLowerCase()}</span>
        </p>
        <div className="mt-3 grid grid-cols-[auto_auto_1fr] gap-1.5 lg:mt-[12px] lg:gap-[5px]">
          <PreviewTemplateButton id={t.id} className={btnClass('secondary', 'xs', 'px-2 lg:h-[22px] lg:px-[6px] lg:text-[8px]')} />
          <DuplicateTemplateButton id={t.id} canCreate={perms.create} className={btnClass('secondary', 'xs', 'px-2 lg:h-[22px] lg:px-[6px] lg:text-[8px]')} />
          <UseTemplateButton template={t} base={base} perms={perms} className={btnClass('primary', 'xs', 'min-w-0 whitespace-nowrap px-2 lg:h-[22px] lg:px-[6px] lg:text-[8px]')} />
        </div>
      </div>
    </article>
  )

  return (
    <div className="grid grid-cols-1 gap-4 lg:gap-[16px] xl:grid-cols-[minmax(0,1fr)_337px]">
      <div className="min-w-0">
        <StudioPageHeader layout="stacked" base={base} modules={modules} title="Templates" titleClassName="lg:text-[23px]"
          description="Build faster with reusable, brand-approved templates for every channel and campaign." className="lg:mb-[12px]" />

        {counts.error ? <Card><ErrorBlock message={counts.error} /></Card> : (
          <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:gap-[10px] xl:grid-cols-6">
            {kpi('total', <LayoutGrid size={15} />, 'blue', 'Total templates', counts.total, <span className="font-medium text-[#1a5cff]">+{counts.savedThisMonth} this month</span>, `${base}/templates`)}
            {kpi('published', <CircleCheck size={15} />, 'green', 'Published', counts.published, <span className="text-[#16a34a]">{pct(counts.published)}</span>, `${base}/templates?status=published`)}
            {kpi('most', <Star size={15} />, 'violet', 'Most used', <span className="block truncate text-[13px] lg:max-w-[92px] lg:text-[10.5px]" title={counts.mostUsed?.name}>{counts.mostUsed?.name ?? '—'}</span>, <span className="text-slate-500">Used {(counts.mostUsed?.usage_count ?? 0).toLocaleString('en-GB')} times</span>, counts.mostUsed ? `${base}/templates?selected=${counts.mostUsed.id}` : `${base}/templates`)}
            {kpi('saved', <Bookmark size={15} />, 'blue', 'Saved this month', counts.savedThisMonth, <Delta short value={delta(counts.savedThisMonth, counts.savedLastMonth)} suffix="vs last mo." />, `${base}/templates?sort=created_desc`)}
            {kpi('approved', <BadgeCheck size={15} />, 'green', 'Brand approved', counts.brandApproved, <span className="text-[#16a34a]">{pct(counts.brandApproved)}</span>, `${base}/templates?status=approved`)}
            {kpi('review', <Clock3 size={15} />, 'orange', 'Needs review', counts.needsReview, <span className="text-[#e0621a]">{pct(counts.needsReview)}</span>, `${base}/templates?status=in_review`)}
          </ul>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2 lg:mt-[12px] lg:flex-nowrap lg:gap-[12px]">
          <SearchInput placeholder="Search templates…" className="w-full sm:w-auto lg:w-[211px] lg:shrink-0" inputClassName="lg:h-[30px]" />
          <SelectFilter param="channel" label="Channel" display="prefix" dense className="lg:h-[30px] lg:w-[98px]" options={STUDIO_CHANNELS.map(c => ({ value: c, label: CHANNEL_LABELS[c]! }))} />
          <SelectFilter param="category" label="Category" display="prefix" dense className="lg:h-[30px] lg:w-[102px]" options={TEMPLATE_CATEGORIES.map(c => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) }))} />
          <SelectFilter param="owner" label="Owner" display="prefix" dense className="lg:h-[30px] lg:w-[90px]" options={people.map(p => ({ value: p.id, label: p.label }))} />
          <SelectFilter param="status" label="Status" display="prefix" dense className="lg:h-[30px] lg:w-[88px]" options={TEMPLATE_STATUSES.map(s => ({ value: s, label: TEMPLATE_STATUS_LABELS[s] }))} />
          <ViewToggle value={q.view} defaultValue="grid" iconOnly className="lg:ml-auto lg:h-[30px]" itemClassName="lg:h-[24px] lg:w-[30px] lg:justify-center"
            options={[{ id: 'grid', label: 'Grid', icon: <LayoutGrid size={13} /> }, { id: 'list', label: 'List', icon: <List size={13} /> }]} />
          <FiltersMenu label="Filters" iconRight className="lg:h-[30px] lg:text-[9.5px]" fields={[
            { param: 'tag', label: 'Tag', options: [...new Set(signed.all.flatMap(t => t.tags ?? []))].map(t => ({ value: t, label: t })) },
          ]} />
        </div>

        {popular.error || all.error ? <Card className="mt-3"><ErrorBlock message={popular.error ?? all.error ?? ''} /></Card> : all.total === 0 ? (
          <Card className="mt-3"><EmptyBlock search={filtered} title={filtered ? 'No templates match' : 'No templates yet'} message={filtered ? 'Clear the filters to see every template.' : 'Create a template or import one to give your team a head start.'} /></Card>
        ) : (
          <>
            {q.view === 'grid' && (
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:mt-[21px] lg:grid-cols-4 lg:gap-[16px]">
                {signed.popular.map(card)}
              </div>
            )}
            <Card className="mt-3 overflow-hidden lg:mt-[25px]" aria-labelledby="all-templates-title">
              <h2 id="all-templates-title" className="px-3.5 pt-3 text-[14px] font-semibold text-slate-900 lg:px-[14px] lg:pt-[10px] lg:text-[11px]">All templates</h2>
              <div className="mt-2 overflow-x-auto lg:mt-[12px]">
                <table className="w-full min-w-[720px] border-collapse">
                  <caption className="sr-only">All templates</caption>
                  <thead><tr className="border-b border-[#eef0f4]">
                    {[['Template', 'pl-3.5 lg:pl-[14px] lg:w-[178px]'], ['Channel', 'lg:w-[78px]'], ['Category', 'lg:w-[113px]'], ['Usage', 'lg:w-[87px]'], ['Owner', 'lg:w-[105px]'], ['Status', 'lg:w-[104px]'], ['Updated', 'lg:w-[116px]'], ['Actions', '']].map(([h, c]) => (
                      <th key={h} scope="col" className={cn(S_TH_PLAIN, 'lg:h-[22px] lg:text-[8.5px]', c)}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {signed.all.map(t => (
                      <tr key={t.id} className={cn('border-b border-[#f0f2f5] last:border-0 hover:bg-slate-50/60', t.id === sel?.id && 'bg-[#f7f9ff]')}>
                        <td className={cn(S_TD, 'h-14 pl-3.5 lg:h-[45px] lg:pl-[14px]')}>
                          <Link href={`${base}/templates?${new URLSearchParams({ ...Object.fromEntries(Object.entries(searchParams).filter(([, v]) => typeof v === 'string')) as Record<string, string>, selected: t.id }).toString()}`} scroll={false} className="flex items-center gap-2.5 lg:gap-[8px]">
                            <span className="h-9 w-9 shrink-0 overflow-hidden rounded-[4px] bg-slate-100 lg:h-[30px] lg:w-[30px]">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              {t.cover_url && <img src={t.cover_url} alt="" loading="lazy" className="h-full w-full object-cover" />}
                            </span>
                            <span className="line-clamp-2 text-slate-800 hover:text-[#1a5cff] lg:text-[9.5px]">{t.name}</span>
                          </Link>
                        </td>
                        <td className={S_TD}><ChannelIcons channels={[t.channel ?? t.platforms?.[0] ?? ''].filter(Boolean)} size={13} /></td>
                        <td className={cn(S_TD, 'capitalize lg:text-[9px]')}>{t.category ?? '—'}</td>
                        <td className={cn(S_TD, 'tabular-nums lg:text-[9px]')}>{fmtCompact(t.usage_count)}</td>
                        <td className={cn(S_TD, 'lg:text-[9px]')}><span className="flex items-center gap-1.5"><PersonAvatar person={t.owner} size={16} /><span className="truncate">{personName(t.owner)}</span></span></td>
                        <td className={S_TD}><Pill tone={STATUS_TONE[t.status] ?? 'slate'}>{TEMPLATE_STATUS_LABELS[t.status as TemplateStatus] ?? t.status}</Pill></td>
                        <td className={cn(S_TD, 'whitespace-nowrap lg:text-[9px]')}>{fmtAgo(t.updated_at, now)}</td>
                        <td className={S_TD}><TemplateMenu template={t} perms={perms} label={`Actions for ${t.name}`} icon={<MoreHorizontal size={14} />} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pager page={q.page} size={size} total={all.total} noun="templates" className="border-t border-[#eef0f4] px-3.5 py-2.5 lg:px-[28px] lg:py-[12px]" />
            </Card>
          </>
        )}
      </div>

      {/* ── Right rail ─────────────────────────────────────────────────── */}
      <aside className="flex min-w-0 flex-col gap-3 lg:gap-[12px]" aria-label="Template tools and details">
        <Card className="bg-[#fbfcfe] px-3.5 pb-3 pt-3 lg:px-[16px] lg:pb-[12px] lg:pt-[14px]" aria-labelledby="tpl-quick-title">
          <h2 id="tpl-quick-title" className="text-[14px] font-semibold text-slate-900 lg:text-[11px]">Quick actions</h2>
          <TemplateQuickActions selected={sel} covers={covers} perms={perms} guidelines={guidelines} />
        </Card>

        {sel ? (
          <>
            <Card className="px-3.5 pb-3.5 pt-3 lg:px-[13px] lg:pb-[12px] lg:pt-[12px]" aria-labelledby="tpl-preview-title">
              <CardHeader id="tpl-preview-title" title="Template preview" titleClassName="lg:text-[11px]"
                action={<FullTemplatePreview name={sel.name} channel={sel.channel ?? 'linkedin'} account={account!} caption={sel.caption_template ?? ''} mediaUrl={sel.cover_url} />} />
              <div id="tpl-preview-card" className="mt-2 lg:mt-[10px]">
                <SocialPreview channel={sel.channel ?? 'linkedin'} account={account!} content={{ caption: sel.caption_template ?? '', mediaUrl: sel.cover_url, mediaAspect: 'aspect-[316/150]' }} />
              </div>
            </Card>

            <Card className="px-3.5 pb-3.5 pt-3 lg:px-[13px] lg:pb-[12px] lg:pt-[12px]" aria-labelledby="tpl-perf-title">
              <CardHeader id="tpl-perf-title" title="Template performance" titleClassName="lg:text-[11px]"
                action={<SelectFilter param="range" label="Range" allLabel="Last 30 days" display="value" dense className="lg:h-[22px] lg:w-[102px] lg:shrink-0 lg:text-[8.5px]" options={[{ value: '7', label: 'Last 7 days' }, { value: '90', label: 'Last 90 days' }]} />} />
              {!performance || performance.error ? <ErrorBlock message={performance?.error ?? ''} className="mx-0" /> : (
                <div className="mt-3 flex gap-4 lg:mt-[12px] lg:gap-[14px]">
                  <UsageChart points={performance.points} />
                  <dl className="w-[96px] shrink-0 space-y-2.5 lg:space-y-[10px]">
                    {([['Uses', performance.uses], ['Drafts created', performance.drafts], ['Published', performance.published]] as const).map(([label, w]) => (
                      <div key={label}>
                        <dt className="text-[11px] text-slate-500 lg:text-[8px]">{label}</dt>
                        <dd className="flex items-baseline justify-between"><span className="text-[15px] font-semibold text-slate-900 lg:text-[12px]">{w.current.toLocaleString('en-GB')}</span>
                          <Delta short value={delta(w.current, w.previous)} className="text-[10px] lg:text-[8px]" /></dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </Card>

            <Card className="px-3.5 pb-3.5 pt-3 lg:px-[13px] lg:pb-[12px] lg:pt-[12px]" aria-labelledby="tpl-details-title">
              <h2 id="tpl-details-title" className="text-[14px] font-semibold text-slate-900 lg:text-[11px]">Template details</h2>
              <dl className="mt-3 grid grid-cols-[96px_1fr] gap-y-2 text-[12px] lg:mt-[14px] lg:grid-cols-[88px_1fr] lg:gap-y-[8px] lg:text-[9.5px]">
                <dt className="text-slate-500">Category</dt><dd className="capitalize text-slate-800">{sel.category ?? '—'}</dd>
                <dt className="text-slate-500">Channels</dt><dd className="text-slate-800">{(sel.platforms?.length ? sel.platforms : [sel.channel ?? '']).filter(Boolean).map(c => CHANNEL_LABELS[c] ?? c).join(', ') || '—'}</dd>
                <dt className="text-slate-500">Tags</dt><dd className="text-slate-800">{sel.tags?.join(', ') || '—'}</dd>
                <dt className="text-slate-500">Created by</dt><dd className="text-slate-800">{personName(sel.owner)}</dd>
                <dt className="text-slate-500">Created on</dt><dd className="text-slate-800">{fmtDate(sel.created_at)}</dd>
                {sel.review_note && <><dt className="text-slate-500">Review note</dt><dd className="text-[#c2410c]">{sel.review_note}</dd></>}
              </dl>
            </Card>

            <SelectedTemplateActions template={sel} covers={covers} base={base} perms={perms} />
          </>
        ) : (
          <Card><EmptyBlock title="No template selected" message="Choose Preview on a template to see its preview, performance and details." /></Card>
        )}
      </aside>
    </div>
  )
}
