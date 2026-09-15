import Link from 'next/link'
import {
  ArrowUpDown, BadgeCheck, Camera, CircleCheck, FileText, Folder, Image as ImageIcon, Layers,
  LayoutTemplate, MessageCircle, MoreVertical, Plus, Share2, Upload, Users, Palette, Pencil,
  ShoppingBag, Heart, Leaf, Cpu, GraduationCap, Landmark, Dumbbell, Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BrandContext } from '@/lib/brand-assets/context'
import type { KitsPage as KitsPageData, KitSystem } from '@/lib/brand-assets/queries'
import { buildHref, chipsFor, type KitFilters, type RawParams } from '@/lib/brand-assets/filters'
import { can } from '@/lib/brand-assets/entitlements'
import type { BrandKitCard } from '@/types/brand-assets'
import {
  ActionLink, EmptyPanel, KpiStrip, PageHeading, Pagination, Panel, StatusBadge, type KpiSpec,
} from '../ui/primitives'
import { FilterBar, FilterChips, FilterSelect, SearchField, ViewSwitcher } from '../ui/controls'
import { Avatar } from '../shell/BrandAssetsShell'
import { AssetThumb, BrandLogo, fontPair } from './OverviewPage'
import KitCommentForm from '../client/KitCommentForm'
import { formatBytes, formatCount, formatRelativeShort, humanise } from '../tokens'

export default function KitsPage({
  ctx, data, filters, params,
}: {
  ctx: BrandContext
  data: KitsPageData
  filters: KitFilters
  params: RawParams
}) {
  const base = `${ctx.basePath}/brand`
  const pathname = `${base}/kits`
  const e = ctx.entitlements
  const k = data.kpis
  const workspaceType = ctx.basePath.slice(1)

  const kpis: KpiSpec[] = [
    { key: 'total', label: 'Total Kits', value: formatCount(k.totalKits), icon: Layers, tone: 'blue',
      delta: k.totalKitsDelta, deltaSuffix: 'this month', riseIsGood: true, href: pathname, tooltip: 'All brand kits in this workspace' },
    { key: 'brands', label: 'Active Brands', value: formatCount(k.activeBrands), icon: Palette, tone: 'green',
      delta: k.activeBrandsDelta, deltaSuffix: 'this month', riseIsGood: true, href: null, tooltip: 'Brands with an active status' },
    { key: 'templates', label: 'Templates', value: formatCount(k.templates), icon: LayoutTemplate, tone: 'amber',
      delta: k.templatesDelta, deltaSuffix: 'this month', riseIsGood: true, href: null, tooltip: 'Templates across all kits' },
    { key: 'approvals', label: 'Pending Approvals', value: formatCount(k.pendingApprovals), icon: BadgeCheck, tone: 'red',
      delta: k.pendingApprovalsDelta, deltaSuffix: 'this week', riseIsGood: false, href: buildHref(pathname, params, { approval: 'pending' }),
      tooltip: 'Kits awaiting review' },
    { key: 'linked', label: 'Linked Assets', value: formatCount(k.linkedAssets), icon: Users, tone: 'indigo',
      delta: k.linkedAssetsDelta, deltaSuffix: 'this month', riseIsGood: true, href: `${base}/assets`, tooltip: 'Assets attached to a brand kit' },
    { key: 'consistency', label: 'Consistency Score', value: `${k.consistencyScore}%`, icon: CircleCheck, tone: 'emerald',
      delta: null, deltaSuffix: '', riseIsGood: true, href: null, ring: k.consistencyScore,
      tooltip: 'Mean guideline-consistency score across active kits' },
  ]

  const chips = chipsFor(
    { q: filters.q, status: filters.status, team: filters.team, family: filters.familyId ? data.families.find(f => f.id === filters.familyId)?.name : null, approval: filters.approval },
    { q: 'Search', status: 'Status', team: 'Team', family: 'Family', approval: 'Approval' },
  )
  const filtered = chips.length > 0
  const nextSort = filters.sort === 'name_asc' ? 'name_desc' : filters.sort === 'name_desc' ? 'recently_updated' : 'name_asc'
  const sortLabel = filters.sort === 'name_asc' ? 'Name A–Z' : filters.sort === 'name_desc' ? 'Name Z–A' : 'Recently updated'

  return (
    <>
      <PageHeading
        title="Brand Kits"
        subtitle="Manage brand systems, style governance and reusable identity kits across the organization."
        actions={
          <>
            <ActionLink href={`${pathname}/new`} icon={Palette}
              disabled={!can(e, 'brand.kits.create')}
              title={can(e, 'brand.kits.create') ? undefined : 'Your role does not permit creating brand kits'}>
              Create Brand Kit
            </ActionLink>
            <ActionLink href={`${pathname}/import`} icon={Upload} tone="primary"
              disabled={!can(e, 'brand.kits.create')}
              title={can(e, 'brand.kits.create') ? undefined : 'Import requires kit creation permission'}>
              Import Kit
            </ActionLink>
            <ActionLink href={data.system ? `${pathname}/${data.system.kit.id}?tab=share` : pathname} icon={Share2}
              disabled={!can(e, 'brand.kits.share') || !data.system}
              title={can(e, 'brand.kits.share') ? 'Share the selected kit' : 'Your role does not permit sharing kits'}>
              Share Kit
            </ActionLink>
          </>
        }
      />

      <KpiStrip items={kpis} />

      <FilterBar>
        <SearchField pathname={pathname} params={params} placeholder="Search brand kits..."
          defaultValue={filters.q} className="w-full sm:w-[196px]" />
        <FilterSelect stacked pathname={pathname} params={params} name="team" label="Team" allLabel="All Teams"
          value={filters.team} options={data.teams.map(t => ({ value: t, label: t }))} className="w-[132px]" />
        <FilterSelect stacked pathname={pathname} params={params} name="status" label="Status" allLabel="All Statuses"
          value={filters.status} options={[
            { value: 'active', label: 'Active' }, { value: 'review', label: 'Review' },
            { value: 'draft', label: 'Draft' }, { value: 'archived', label: 'Archived' },
          ]} className="w-[132px]" />
        <FilterSelect stacked pathname={pathname} params={params} name="family" label="Brand Family" allLabel="All Families"
          value={filters.familyId} options={data.families.map(f => ({ value: f.id, label: f.name }))} className="w-[132px]" />
        <FilterSelect stacked pathname={pathname} params={params} name="approval" label="Approval" allLabel="Any State"
          value={filters.approval} options={[
            { value: 'pending', label: 'Pending' }, { value: 'approved', label: 'Approved' },
            { value: 'changes_requested', label: 'Changes requested' },
          ]} className="w-[132px]" />
        <div className="ml-auto flex items-center gap-2">
          <ViewSwitcher pathname={pathname} params={params} active={filters.view}
            views={[{ value: 'cards', label: 'Cards' }, { value: 'table', label: 'Table' }]} />
          <Link href={buildHref(pathname, params, { sort: nextSort === 'recently_updated' ? null : nextSort })}
            aria-label={`Sorted by ${sortLabel}. Change sort`} title={`Sorted by ${sortLabel}`}
            className="flex h-9 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50">
            <ArrowUpDown size={14} />
          </Link>
        </div>
      </FilterBar>

      <FilterChips pathname={pathname} params={params} chips={chips} />

      <div className="grid gap-3.5 xl:grid-cols-[minmax(0,1fr)_262px]">
        <div className="min-w-0 space-y-3.5">
          {data.kits.length === 0 ? (
            <Panel>
              <EmptyPanel
                icon={Palette}
                title={filtered ? 'No brand kits match those filters' : 'No brand kits yet'}
                body={filtered
                  ? 'Try a different search term or clear the filters to see everything.'
                  : 'A brand kit holds logos, colour, typography, templates and tone of voice in one governed place.'}
                action={filtered ? 'Clear filters' : (can(e, 'brand.kits.create') ? 'Create Brand Kit' : undefined)}
                actionHref={filtered ? pathname : `${pathname}/new`}
              />
            </Panel>
          ) : filters.view === 'table' ? (
            <KitTable kits={data.kits} base={base} />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {data.kits.map(kit => <KitCard key={kit.id} kit={kit} href={`${pathname}/${kit.id}`} selectHref={buildHref(pathname, params, { kit: kit.id })} selected={kit.id === data.system?.kit.id} />)}
              {can(e, 'brand.kits.create') && !filtered && (
                <Link href={`${pathname}/new`}
                  className="flex min-h-[222px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center transition-colors hover:border-blue-400 hover:bg-blue-50/30 lg:min-h-[200px]">
                  <span className="mb-2.5 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 lg:h-8 lg:w-8"><Plus size={18} /></span>
                  <p className="text-[12.5px] font-semibold text-blue-600 lg:text-[10px]">Create New Brand Kit</p>
                  <p className="mt-1 max-w-[170px] text-[10.5px] leading-snug text-slate-500 lg:text-[8px]">Start building a new brand system from scratch or a template.</p>
                  <span className="mt-3.5 inline-flex h-8 items-center rounded-lg bg-blue-600 px-4 text-[11px] font-semibold text-white lg:h-6 lg:text-[8.5px]">Create Kit</span>
                </Link>
              )}
            </div>
          )}

          {data.total > filters.pageSize && (
            <Panel>
              <Pagination page={filters.page} pageSize={filters.pageSize} total={data.total}
                hrefFor={patch => buildHref(pathname, params, patch)} />
            </Panel>
          )}

          {data.system && <SystemPanels system={data.system} base={base} />}
        </div>

        {/* ---------------- Right rail ---------------- */}
        <div className="space-y-3.5">
          <Panel title="Recent Brand Updates" action="View all" actionHref={`${base}/activity?type=brand_kit`} dense>
            {data.recentUpdates.length === 0
              ? <EmptyPanel title="No recent updates" body="Changes to brand kits appear here." />
              : (
                <ul className="space-y-0.5 px-1.5 pb-2">
                  {data.recentUpdates.map((u, i) => (
                    <li key={u.id}>
                      <Link href={u.href ?? `${base}/activity`} className="flex gap-2.5 rounded-lg px-2 py-1 hover:bg-slate-50">
                        <span className={cn('mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
                          ['bg-violet-50 text-violet-600', 'bg-emerald-50 text-emerald-600', 'bg-indigo-50 text-indigo-600', 'bg-amber-50 text-amber-600', 'bg-emerald-50 text-emerald-600'][i % 5])}>
                          <Palette size={13} aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[10.5px] font-semibold text-slate-800 lg:text-[8px]">{u.summary}</span>
                          <span className="block truncate text-[9.5px] text-slate-400 lg:text-[7.5px]">
                            {typeof u.metadata?.detail === 'string' ? u.metadata.detail : `by ${u.actor?.full_name ?? 'System'}`}
                          </span>
                        </span>
                        <span className="shrink-0 pt-0.5 text-[9px] text-slate-400 lg:text-[7px]">{formatRelativeShort(u.created_at)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
          </Panel>

          <Panel title="Approval Workflow" action="View all" actionHref={buildHref(pathname, params, { approval: 'pending' })} dense>
            {data.approvalQueue.length === 0
              ? <EmptyPanel title="Nothing awaiting approval" body="Kits submitted for review appear here." />
              : (
                <ul className="space-y-0.5 px-1.5 pb-2">
                  {data.approvalQueue.map(a => (
                    <li key={a.id}>
                      <Link href={`${pathname}/${a.id}?tab=approvals`} className="flex items-center gap-2 rounded-lg px-2 py-[3px] hover:bg-slate-50">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-600"><FileText size={11} aria-hidden="true" /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[10.5px] font-medium text-slate-800 lg:text-[8px]">{a.name}</span>
                          <span className="block text-[9.5px] text-slate-400 lg:text-[7px]">Updated {formatRelativeShort(a.updated_at)}</span>
                        </span>
                        <StatusBadge status={a.status === 'pending' ? 'in_review' : a.status}
                          label={a.status === 'pending' ? 'In Review' : a.status === 'changes_requested' ? 'Changes' : undefined} size="xs" />
                        <Avatar name={a.owner?.full_name ?? '—'} src={a.owner?.avatar_url} size={18} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
          </Panel>

          <Panel title="Team Comments" action="View all" actionHref={data.system ? `${pathname}/${data.system.kit.id}?tab=comments` : pathname} dense>
            {data.comments.length === 0
              ? <p className="px-3.5 pb-2 text-[10.5px] text-slate-500">No comments yet — start the discussion below.</p>
              : (
                <ul className="space-y-1.5 px-3.5 pb-2">
                  {data.comments.map(c => (
                    <li key={c.id} className="flex gap-2">
                      <Avatar name={c.author?.full_name ?? '—'} src={c.author?.avatar_url} size={22} />
                      <div className="min-w-0 flex-1">
                        <p className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-[10.5px] font-semibold text-slate-800 lg:text-[8px]">{c.author?.full_name ?? 'Unknown'}</span>
                          <span className="shrink-0 text-[9px] text-slate-400 lg:text-[7px]">{formatRelativeShort(c.created_at)}</span>
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-[9.5px] leading-snug text-slate-500 lg:text-[7.5px]">{c.body}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            {data.system && <KitCommentForm workspaceType={workspaceType} kitId={data.system.kit.id} kitName={data.system.kit.name} />}
          </Panel>
        </div>
      </div>

      {data.system && <BottomRow system={data.system} base={base} />}
    </>
  )
}

// ---------------------------------------------------------------------------

/** Icons drawn in the kit's own icon style (stroke width + fill), in its primary colour. */
const STYLE_GLYPHS: Record<string, React.ComponentType<{ size?: number; strokeWidth?: number; className?: string; fill?: string; style?: React.CSSProperties }>[]> = {
  acme: [Camera, MessageCircle, Users], 'acme-sport': [Dumbbell, Sparkles, Heart], 'acme-care': [Heart, Leaf, Sparkles],
  'acme-foods': [ShoppingBag, Leaf, Heart], 'acme-tech': [Cpu, Layers, Sparkles], 'acme-finance': [Landmark, Layers, FileText],
  'acme-education': [GraduationCap, FileText, Folder],
}

function IconStyle({ kit }: { kit: BrandKitCard }) {
  const style = kit.icons?.[0]
  const colour = kit.colours[0]?.hex ?? '#475569'
  const glyphs = STYLE_GLYPHS[kit.brand?.slug ?? ''] ?? [Camera, MessageCircle, Users]
  const filled = style?.fill_style === 'filled'
  return (
    <span className="flex items-center gap-2" title={style?.style_name ?? 'No icon style defined'}>
      {glyphs.map((G, i) => (
        <G key={i} size={16} strokeWidth={style?.stroke_width ?? 1.75}
          className={style ? undefined : 'text-slate-400'}
          style={style ? { color: style.fill_style === 'duotone' && i === 1 ? '#94a3b8' : colour } : undefined}
          fill={filled ? colour : 'none'} />
      ))}
    </span>
  )
}

function KitCard({ kit, href, selectHref, selected }: { kit: BrandKitCard; href: string; selectHref: string; selected: boolean }) {
  const name = kit.brand?.name ?? kit.name
  return (
    <article className={cn('relative flex min-h-[214px] flex-col rounded-xl border bg-white px-3 pb-2.5 pt-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-shadow hover:shadow-md lg:min-h-[200px] lg:pb-2 lg:pt-2',
      selected ? 'border-blue-300 ring-1 ring-blue-200' : 'border-slate-200')}>
      <Link href={selectHref} scroll={false} className="absolute right-2 top-2.5 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        aria-label={`Show ${name} brand system below`} title="Show brand system">
        <MoreVertical size={15} />
      </Link>
      <Link href={href} className="flex h-[44px] items-center justify-center focus-visible:outline-2 focus-visible:outline-blue-600 lg:h-10" aria-label={`Open ${kit.name}`}>
        <BrandLogo name={name} url={kit.brand?.logo_url ?? null} className="max-h-[40px] max-w-[160px] lg:max-h-[36px] lg:max-w-[140px]" />
      </Link>
      <div className="mb-2 mt-1.5 flex gap-1.5 lg:mb-3 lg:mt-2">
        {kit.colours.slice(0, 5).map(c => (
          <span key={c.id} title={`${c.name} · ${c.hex}`} className="h-[30px] flex-1 rounded-md ring-1 ring-inset ring-slate-900/10 lg:h-7" style={{ backgroundColor: c.hex }} />
        ))}
      </div>
      <div className="mb-2 grid grid-cols-[1.25fr_1fr] gap-2">
        <div className="min-w-0">
          <p className="mb-1 text-[9.5px] text-slate-500 lg:text-[7.5px]">Typography</p>
          <p className="flex items-baseline gap-1.5">
            <span className="text-[17px] font-semibold leading-none text-slate-800 lg:text-[14px]">Aa</span>
            <span className="truncate text-[9px] text-slate-500 lg:text-[7px]">{fontPair(kit)}</span>
          </p>
        </div>
        <div>
          <p className="mb-1 text-[9.5px] text-slate-500 lg:text-[7.5px]">Icon Style</p>
          <IconStyle kit={kit} />
        </div>
      </div>
      <div className="mb-2.5 flex items-center gap-3 text-[9.5px] text-slate-500 lg:mb-2 lg:text-[7.5px]">
        <span className="flex items-center gap-1"><Folder size={11} aria-hidden="true" />{kit.asset_count} assets</span>
        <span className="flex items-center gap-1"><FileText size={11} aria-hidden="true" />{kit.template_count} templates</span>
      </div>
      <div className="mt-auto flex items-center gap-2 border-t border-slate-100 pt-2.5 lg:pt-2">
        <Avatar name={kit.owner?.full_name ?? 'Unassigned'} src={kit.owner?.avatar_url} size={20} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[10px] font-medium text-slate-700 lg:text-[8px]">{kit.owner?.full_name ?? 'Unassigned'}</p>
          <p className="truncate text-[9px] text-slate-400 lg:text-[7px]">{kit.team_name ?? '—'}</p>
        </div>
        <div className="shrink-0 text-right">
          <StatusBadge status={kit.status} size="xs" />
          <p className="mt-0.5 text-[8.5px] text-slate-400 lg:text-[7px]">Updated {formatRelativeShort(kit.updated_at)}</p>
        </div>
      </div>
    </article>
  )
}

function KitTable({ kits, base }: { kits: BrandKitCard[]; base: string }) {
  return (
    <Panel>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60 text-[10px] font-medium text-slate-500">
              <th className="px-4 py-2.5 font-medium">Brand Kit</th>
              <th className="px-3 py-2.5 font-medium">Team</th>
              <th className="px-3 py-2.5 font-medium">Palette</th>
              <th className="px-3 py-2.5 font-medium">Typography</th>
              <th className="px-3 py-2.5 font-medium">Assets</th>
              <th className="px-3 py-2.5 font-medium">Templates</th>
              <th className="px-3 py-2.5 font-medium">Owner</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-3 py-2.5 font-medium">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {kits.map(kit => (
              <tr key={kit.id} className="hover:bg-slate-50/70">
                <td className="px-4 py-2.5">
                  <Link href={`${base}/kits/${kit.id}`} className="flex items-center gap-2.5">
                    <span className="flex h-8 w-16 shrink-0 items-center justify-center rounded-md border border-slate-100 bg-white p-1">
                      <BrandLogo name={kit.brand?.name ?? kit.name} url={kit.brand?.logo_url ?? null} className="max-h-6 max-w-[56px]" />
                    </span>
                    <span className="text-[12px] font-semibold text-slate-800 hover:text-blue-600">{kit.name}</span>
                  </Link>
                </td>
                <td className="px-3 py-2.5 text-[11px] text-slate-600">{kit.team_name ?? '—'}</td>
                <td className="px-3 py-2.5">
                  <span className="flex gap-1">
                    {kit.colours.slice(0, 5).map(c => <span key={c.id} title={c.hex} className="h-4 w-4 rounded ring-1 ring-inset ring-slate-900/10" style={{ backgroundColor: c.hex }} />)}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-[11px] text-slate-600">{fontPair(kit)}</td>
                <td className="px-3 py-2.5 text-[11px] tabular-nums text-slate-600">{kit.asset_count}</td>
                <td className="px-3 py-2.5 text-[11px] tabular-nums text-slate-600">{kit.template_count}</td>
                <td className="px-3 py-2.5">
                  <span className="flex items-center gap-1.5">
                    <Avatar name={kit.owner?.full_name ?? '—'} src={kit.owner?.avatar_url} size={20} />
                    <span className="truncate text-[11px] text-slate-600">{kit.owner?.full_name ?? '—'}</span>
                  </span>
                </td>
                <td className="px-3 py-2.5"><StatusBadge status={kit.status} size="xs" /></td>
                <td className="px-3 py-2.5 text-[11px] text-slate-500">{formatRelativeShort(kit.updated_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

/** Typography, lockups, palette and templates for the selected kit — all read from its records. */
function SystemPanels({ system, base }: { system: KitSystem; base: string }) {
  const { kit } = system
  const href = `${base}/kits/${kit.id}`
  const brandName = kit.brand?.name ?? kit.name
  const monogram = brandName.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const lockups = system.logos.length ? system.logos : []
  return (
    <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-[1.15fr_1fr_1.05fr_1.1fr]">
      <Panel title="Typography System" action="View all" actionHref={`${href}?tab=typography`} dense>
        <div className="flex gap-3 px-3.5 pb-3">
          <span className="shrink-0 text-[46px] font-bold leading-none text-slate-900" style={{ fontFamily: kit.typography[0]?.font_family }}>Ag</span>
          <ul className="min-w-0 flex-1 space-y-[3px]">
            {kit.typography.slice(0, 6).map(t => (
              <li key={t.id} className="grid grid-cols-[1fr_1fr_auto] items-baseline gap-2 text-[8.5px]">
                <span className="truncate font-medium text-slate-700">{t.style_name}</span>
                <span className="truncate text-slate-400">{t.font_family} {t.font_weight}</span>
                <span className="tabular-nums text-slate-400">{t.font_size_px ?? '—'} / {t.line_height_px ?? '—'}</span>
              </li>
            ))}
          </ul>
        </div>
      </Panel>

      <Panel title="Logo Lockups" action="View all" actionHref={`${href}?tab=logos`} dense>
        {lockups.length === 0 ? (
          <p className="px-3.5 pb-3 text-[10.5px] text-slate-500">No lockups recorded for this kit yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-1.5 px-3.5 pb-3">
            {lockups.slice(0, 4).map(l => (
              <div key={l.id} className="rounded-md border border-slate-100 bg-slate-50/60 px-2 py-1.5 lg:py-1">
                <p className="mb-1 text-[8px] text-slate-400 lg:mb-0 lg:text-[7px]">{l.label}</p>
                <div className="flex h-7 items-center justify-center lg:h-6">
                  {l.lockup_type === 'monogram'
                    ? <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">{monogram}</span>
                    : l.lockup_type === 'icon_mark'
                      ? <span className="text-[22px] font-black leading-none text-slate-900">{brandName[0]}</span>
                      : l.lockup_type === 'secondary'
                        ? <span className="text-[14px] font-bold tracking-wide text-slate-900">{brandName.toUpperCase()}</span>
                        : <BrandLogo name={brandName} url={kit.brand?.logo_url ?? null} className="max-h-6 max-w-[88px]" />}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Color Palette" action="View all" actionHref={`${href}?tab=colours`} dense>
        <div className="grid grid-cols-5 gap-1.5 px-3.5 pb-3">
          {kit.colours.slice(0, 5).map(c => (
            <div key={c.id} className="min-w-0 text-center">
              <span className="mb-1 block h-9 w-full rounded-md ring-1 ring-inset ring-slate-900/10" style={{ backgroundColor: c.hex }} />
              <p className="truncate text-[8.5px] font-medium text-slate-700">{c.name}</p>
              <p className="truncate text-[8px] uppercase text-slate-400">{c.hex}</p>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Templates" action="View all" actionHref={`${href}?tab=templates`} dense>
        {system.templates.length === 0 ? (
          <p className="px-3.5 pb-3 text-[10.5px] text-slate-500">No templates in this kit yet.</p>
        ) : (
          <div className="grid grid-cols-4 gap-1.5 px-3.5 pb-3">
            {system.templates.map(t => (
              <div key={t.id} className="min-w-0 text-center">
                <span className="mb-1 flex aspect-[4/3] items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                  {t.thumbnail_path
                    ? <AssetThumb name={t.name} kind="template" url={t.thumbnail_path} />
                    : <TemplateGlyph type={t.template_type} colour={kit.colours[0]?.hex ?? '#2563EB'} brand={brandName} />}
                </span>
                <p className="truncate text-[8.5px] font-medium text-slate-700">{t.name}</p>
                <p className="truncate text-[8px] text-slate-400">{t.dimensions ?? humanise(t.template_type)}</p>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  )
}

/** Template preview drawn from the kit's own colour and name when no file is attached. */
function TemplateGlyph({ type, colour, brand }: { type: string; colour: string; brand: string }) {
  if (type === 'one_pager') {
    return <span className="flex h-full w-[60%] flex-col gap-0.5 bg-white p-1 shadow-sm"><span className="h-1 w-3/4 rounded-sm" style={{ background: colour }} />{[0, 1, 2, 3].map(i => <span key={i} className="h-0.5 w-full rounded-sm bg-slate-200" />)}</span>
  }
  return (
    <span className="flex h-full w-full flex-col justify-center px-1.5 text-left" style={{ background: type === 'social' ? 'white' : colour }}>
      <span className={cn('text-[6.5px] font-bold leading-tight', type === 'social' ? 'text-slate-900' : 'text-white')}>{type === 'presentation' ? 'Presentation' : brand.toUpperCase()}</span>
      {type === 'social' && <span className="mt-0.5 h-1.5 w-1/2 rounded-sm" style={{ background: colour }} />}
    </span>
  )
}

function BottomRow({ system, base }: { system: KitSystem; base: string }) {
  const { kit } = system
  const href = `${base}/kits/${kit.id}`
  const more = Math.max(0, system.linkedTotal - system.linkedAssets.length)
  return (
    <div className="mt-3.5 grid gap-3.5 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,405px)_minmax(0,1fr)]">
      <Panel title="Tone of Voice" dense>
        <div className="px-3.5 pb-3">
          {system.tone?.statement
            ? <p className="text-[9.5px] leading-relaxed text-slate-600">&ldquo;{system.tone.statement}&rdquo;</p>
            : <p className="text-[10px] text-slate-500">No tone of voice defined for this kit.</p>}
          {!!system.tone?.traits?.length && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {system.tone.traits.map(t => <span key={t} className="rounded-md bg-blue-50 px-2 py-0.5 text-[9px] font-medium text-blue-700">{t}</span>)}
            </div>
          )}
        </div>
      </Panel>

      <Panel title="Brand Guidelines & Standards" action="View all" actionHref={`${href}?tab=guidelines`} dense>
        {system.documents.length === 0 ? (
          <p className="px-3.5 pb-3 text-[10.5px] text-slate-500">No guideline documents attached yet.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-2 px-3.5 pb-3 sm:grid-cols-4">
            {system.documents.map(d => (
              <li key={d.id} className="flex items-start gap-1.5 rounded-md border border-slate-100 px-1.5 py-1.5">
                <span className="flex h-6 w-5 shrink-0 items-center justify-center rounded-sm bg-rose-50 text-[6px] font-bold text-rose-600">PDF</span>
                <span className="min-w-0">
                  <span className="block text-[9px] font-medium leading-tight text-slate-700">{d.title}{d.version_label ? ` ${d.version_label}` : ''}</span>
                  <span className="block text-[8px] text-slate-400">PDF{d.file_size ? ` · ${formatBytes(d.file_size)}` : ''}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Linked Assets Preview" action="View all" actionHref={`${base}/assets?brand=${kit.brand_id}`} dense className="lg:col-span-2 xl:col-span-1">
        {system.linkedTotal === 0 ? (
          <p className="px-3.5 pb-3 text-[10.5px] text-slate-500">No assets linked to this kit yet.</p>
        ) : (
          <div className="grid grid-cols-5 gap-2 px-3.5 pb-3">
            {system.linkedAssets.map(a => (
              <Link key={a.id} href={`${base}/assets/${a.id}`} className="aspect-[4/3] overflow-hidden rounded-md bg-slate-100 ring-1 ring-slate-200/70">
                <AssetThumb name={a.file_name} kind={a.asset_kind} url={a.thumbnail_path} />
              </Link>
            ))}
            {Array.from({ length: Math.max(0, 4 - system.linkedAssets.length) }).map((_, i) => <span key={`pad-${i}`} aria-hidden="true" />)}
            <Link href={`${base}/assets?brand=${kit.brand_id}`} className="flex aspect-[4/3] flex-col items-center justify-center rounded-md bg-slate-50 ring-1 ring-slate-200/70 hover:bg-slate-100">
              <span className="text-[15px] font-semibold text-slate-700">+{more}</span>
              <span className="text-[8.5px] text-slate-400">More assets</span>
            </Link>
          </div>
        )}
      </Panel>
    </div>
  )
}

export { ImageIcon, Pencil }
