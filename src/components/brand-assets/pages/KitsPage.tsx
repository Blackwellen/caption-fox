import Link from 'next/link'
import {
  BadgeCheck, CircleCheck, FileText, Image as ImageIcon, Layers, MoreVertical,
  PanelsTopLeft, Plus, Send, Share2, Upload, Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BrandContext } from '@/lib/brand-assets/context'
import type { KitsPage as KitsPageData } from '@/lib/brand-assets/queries'
import { buildHref, chipsFor, type KitFilters, type RawParams } from '@/lib/brand-assets/filters'
import { can } from '@/lib/brand-assets/entitlements'
import {
  ActionLink, EmptyPanel, KpiStrip, PageHeading, Pagination, Panel, StatusBadge,
  type KpiSpec,
} from '../ui/primitives'
import {
  FilterBar, FilterChips, FilterSelect, SearchField, SortSelect, ViewSwitcher,
} from '../ui/controls'
import { Avatar } from '../shell/BrandAssetsShell'
import { AssetThumb } from './OverviewPage'
import { formatCount, formatRelativeShort, humanise } from '../tokens'

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

  const kpis: KpiSpec[] = [
    { key: 'total', label: 'Total Kits', value: formatCount(k.totalKits), icon: Layers, tone: 'blue',
      delta: null, deltaSuffix: '', riseIsGood: true, href: pathname, tooltip: 'All brand kits in this workspace' },
    { key: 'brands', label: 'Active Brands', value: formatCount(k.activeBrands), icon: PanelsTopLeft, tone: 'green',
      delta: null, deltaSuffix: '', riseIsGood: true, href: null, tooltip: 'Brands with an active status' },
    { key: 'templates', label: 'Templates', value: formatCount(k.templates), icon: FileText, tone: 'amber',
      delta: null, deltaSuffix: '', riseIsGood: true, href: null, tooltip: 'Templates across all kits' },
    { key: 'approvals', label: 'Pending Approvals', value: formatCount(k.pendingApprovals), icon: BadgeCheck, tone: 'red',
      delta: null, deltaSuffix: '', riseIsGood: false, href: buildHref(pathname, params, { approval: 'pending' }),
      tooltip: 'Kits awaiting review' },
    { key: 'linked', label: 'Linked Assets', value: formatCount(k.linkedAssets), icon: ImageIcon, tone: 'indigo',
      delta: null, deltaSuffix: '', riseIsGood: true, href: `${base}/assets`, tooltip: 'Assets attached to a brand kit' },
    { key: 'consistency', label: 'Consistency Score', value: `${k.consistencyScore}%`, icon: CircleCheck, tone: 'emerald',
      delta: null, deltaSuffix: '', riseIsGood: true, href: null, ring: k.consistencyScore,
      tooltip: 'Mean consistency score across kits' },
  ]

  const chips = chipsFor(
    { q: filters.q, status: filters.status, team: filters.team, approval: filters.approval },
    { q: 'Search', status: 'Status', team: 'Team', approval: 'Approval' },
  )

  return (
    <>
      <PageHeading
        title="Brand Kits"
        subtitle="Manage brand systems, style governance and reusable identity kits across the organization."
        actions={
          <>
            <ActionLink href={buildHref(pathname, params, { create: 1 })} icon={Plus}
              disabled={!can(e, 'brand.kits.create')}
              title={can(e, 'brand.kits.create') ? undefined : 'Your role does not permit creating brand kits'}>
              Create Brand Kit
            </ActionLink>
            <ActionLink href={buildHref(pathname, params, { import: 1 })} icon={Upload} tone="primary"
              disabled={!can(e, 'brand.kits.create')}
              title={can(e, 'brand.kits.create') ? undefined : 'Import requires kit creation permission'}>
              Import Kit
            </ActionLink>
            <ActionLink href={buildHref(pathname, params, { share: 1 })} icon={Share2}
              disabled={!can(e, 'brand.kits.share')}
              title={can(e, 'brand.kits.share') ? undefined : 'Your role does not permit sharing kits'}>
              Share Kit
            </ActionLink>
          </>
        }
      />

      <KpiStrip items={kpis} />

      <FilterBar>
        <SearchField pathname={pathname} params={params} placeholder="Search brand kits…"
          defaultValue={filters.q} className="w-full max-w-[260px]" />
        <FilterSelect pathname={pathname} params={params} name="team" label="Team" allLabel="All Teams"
          value={filters.team} options={data.teams.map(t => ({ value: t, label: t }))} />
        <FilterSelect pathname={pathname} params={params} name="status" label="Status" allLabel="All Statuses"
          value={filters.status} options={[
            { value: 'active', label: 'Active' }, { value: 'draft', label: 'Draft' },
            { value: 'review', label: 'Review' }, { value: 'archived', label: 'Archived' },
          ]} />
        <FilterSelect pathname={pathname} params={params} name="brand" label="Brand" allLabel="All Brands"
          value={filters.brandId} options={ctx.brands.map(b => ({ value: b.id, label: b.name }))} />
        <FilterSelect pathname={pathname} params={params} name="approval" label="Approval" allLabel="All"
          value={filters.approval} options={[
            { value: 'pending', label: 'Pending' }, { value: 'approved', label: 'Approved' },
            { value: 'changes_requested', label: 'Changes requested' },
          ]} />
        <div className="ml-auto flex items-center gap-2">
          <SortSelect pathname={pathname} params={params} value={filters.sort} options={[
            { value: 'recently_updated', label: 'Recently Updated' },
            { value: 'name_asc', label: 'Name A–Z' },
            { value: 'name_desc', label: 'Name Z–A' },
            { value: 'created_desc', label: 'Newest' },
          ]} />
          <ViewSwitcher pathname={pathname} params={params} active={filters.view}
            views={[{ value: 'cards', label: 'Cards' }, { value: 'table', label: 'Table' }]} />
        </div>
      </FilterBar>

      <FilterChips pathname={pathname} params={params} chips={chips} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_288px]">
        <div className="min-w-0 space-y-4">
          {data.kits.length === 0 ? (
            <Panel>
              <EmptyPanel
                icon={PanelsTopLeft}
                title={filters.q || chips.length ? 'No brand kits match those filters' : 'No brand kits yet'}
                body={filters.q || chips.length
                  ? 'Try a different search term or clear the filters to see everything.'
                  : 'A brand kit holds logos, colour, typography, templates and tone of voice in one governed place.'}
                action={filters.q || chips.length ? 'Clear filters' : (can(e, 'brand.kits.create') ? 'Create Brand Kit' : undefined)}
                actionHref={filters.q || chips.length ? pathname : buildHref(pathname, params, { create: 1 })}
              />
            </Panel>
          ) : filters.view === 'table' ? (
            <KitTable data={data} base={base} />
          ) : (
            <KitCards data={data} base={base} canCreate={can(e, 'brand.kits.create')} createHref={buildHref(pathname, params, { create: 1 })} />
          )}

          {data.total > filters.pageSize && (
            <Panel>
              <Pagination
                page={filters.page} pageSize={filters.pageSize} total={data.total}
                hrefFor={patch => buildHref(pathname, params, patch)}
              />
            </Panel>
          )}

          {/* Brand system detail panels */}
          {data.kits[0] && <BrandSystemPanels kit={data.kits[0]} base={base} />}
        </div>

        {/* Right rail */}
        <div className="space-y-4">
          <Panel title="Recent Brand Updates" action="View all" actionHref={pathname} dense>
            {data.recentUpdates.length === 0
              ? <EmptyPanel title="No recent updates" body="Changes to brand kits appear here." />
              : (
                <ul className="divide-y divide-slate-50">
                  {data.recentUpdates.map(u => (
                    <li key={u.id} className="flex gap-2.5 px-4 py-2.5">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded bg-purple-50">
                        <PanelsTopLeft size={12} className="text-purple-600" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-medium text-slate-800">{u.summary}</p>
                        <p className="truncate text-[11px] text-slate-400">{u.actor?.full_name ?? 'System'}</p>
                      </div>
                      <span className="shrink-0 text-[11px] text-slate-400">{formatRelativeShort(u.created_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
          </Panel>

          <Panel title="Approval Workflow" action="View all" actionHref={buildHref(pathname, params, { approval: 'pending' })} dense>
            {data.approvalQueue.length === 0
              ? <EmptyPanel title="Nothing awaiting approval" body="Kits submitted for review appear here." />
              : (
                <ul className="divide-y divide-slate-50">
                  {data.approvalQueue.map(a => (
                    <li key={a.id} className="flex items-center gap-2.5 px-4 py-2.5">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-blue-50">
                        <FileText size={12} className="text-blue-600" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-medium text-slate-800">{a.name}</p>
                        <p className="text-[11px] text-slate-400">Updated {formatRelativeShort(a.updated_at)}</p>
                      </div>
                      <StatusBadge status={a.status} />
                      <Avatar name={a.owner?.full_name ?? '—'} src={a.owner?.avatar_url} size={20} />
                    </li>
                  ))}
                </ul>
              )}
          </Panel>

          <Panel title="Team Comments" action="View all" actionHref={pathname} dense>
            {data.comments.length === 0
              ? <EmptyPanel title="No comments yet" body="Discussion on brand kits appears here." />
              : (
                <ul className="divide-y divide-slate-50">
                  {data.comments.map(c => (
                    <li key={c.id} className="flex gap-2.5 px-4 py-2.5">
                      <Avatar name={c.author?.full_name ?? '—'} src={c.author?.avatar_url} size={22} />
                      <div className="min-w-0 flex-1">
                        <p className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-[12px] font-semibold text-slate-800">{c.author?.full_name ?? 'Unknown'}</span>
                          <span className="shrink-0 text-[11px] text-slate-400">{formatRelativeShort(c.created_at)}</span>
                        </p>
                        <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{c.body}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            <div className="flex items-center gap-2 border-t border-slate-100 px-4 py-2.5">
              <input
                className="h-8 flex-1 rounded-lg border border-slate-200 px-2.5 text-[12px] placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
                placeholder="Add a comment…"
                aria-label="Add a comment"
                readOnly
              />
              <span className="text-slate-400"><Send size={14} /></span>
            </div>
          </Panel>
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------

function KitCards({
  data, base, canCreate, createHref,
}: { data: KitsPageData; base: string; canCreate: boolean; createHref: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {data.kits.map(kit => (
        <article key={kit.id} className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-sm">
          <div className="mb-3 flex items-start justify-between gap-2">
            <Link href={`${base}/kits?kit=${kit.id}`} className="min-w-0">
              <span className="block truncate text-[19px] font-black uppercase leading-tight tracking-tight text-slate-900">
                {kit.brand?.name ?? kit.name}
              </span>
            </Link>
            <button className="shrink-0 rounded p-0.5 text-slate-300 hover:bg-slate-50 hover:text-slate-500" aria-label={`Actions for ${kit.name}`}>
              <MoreVertical size={15} />
            </button>
          </div>

          <div className="mb-3 flex gap-1.5">
            {kit.colours.slice(0, 5).map(c => (
              <span key={c.id} title={`${c.name} · ${c.hex}`}
                className="h-8 w-8 rounded border border-slate-200"
                style={{ backgroundColor: c.hex }} />
            ))}
          </div>

          <div className="mb-3 grid grid-cols-2 gap-2">
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Typography</p>
              <p className="flex items-center gap-1.5 text-[11px] text-slate-600">
                <span className="font-bold text-slate-800">Aa</span>
                <span className="truncate">{kit.typography.slice(0, 2).map(t => t.font_family).join(' / ') || '—'}</span>
              </p>
            </div>
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Icon Style</p>
              <p className="flex gap-1 text-slate-400">
                <span className="h-4 w-4 rounded border border-slate-300" />
                <span className="h-4 w-4 rounded-full border border-slate-300" />
                <span className="h-4 w-4 rounded-sm border border-slate-300" />
              </p>
            </div>
          </div>

          <div className="mb-2.5 flex items-center gap-3 text-[11px] text-slate-500">
            <span className="flex items-center gap-1"><ImageIcon size={11} />{kit.asset_count} assets</span>
            <span className="flex items-center gap-1"><FileText size={11} />{kit.template_count} templates</span>
          </div>

          <div className="mt-auto flex items-center gap-2 border-t border-slate-100 pt-2.5">
            <Avatar name={kit.owner?.full_name ?? 'Unassigned'} src={kit.owner?.avatar_url} size={22} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-medium text-slate-700">{kit.owner?.full_name ?? 'Unassigned'}</p>
              <p className="truncate text-[10px] text-slate-400">{kit.team_name ?? '—'}</p>
            </div>
            <div className="shrink-0 text-right">
              <StatusBadge status={kit.status} />
              <p className="mt-0.5 text-[10px] text-slate-400">Updated {formatRelativeShort(kit.updated_at)}</p>
            </div>
          </div>
        </article>
      ))}

      {canCreate && (
        <Link href={createHref}
          className="flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center transition-colors hover:border-blue-400 hover:bg-blue-50/30">
          <span className="mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            <Plus size={18} />
          </span>
          <p className="text-[13px] font-semibold text-blue-600">Create New Brand Kit</p>
          <p className="mt-1 max-w-[190px] text-[11px] text-slate-500">
            Start building a new brand system from scratch or a template.
          </p>
          <span className="mt-3 inline-flex h-8 items-center rounded-lg bg-blue-600 px-3 text-[12px] font-semibold text-white">
            Create Kit
          </span>
        </Link>
      )}
    </div>
  )
}

function KitTable({ data, base }: { data: KitsPageData; base: string }) {
  return (
    <Panel>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left">
          <thead>
            <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              <th className="px-5 py-2.5">Brand Kit</th>
              <th className="px-3 py-2.5">Brand</th>
              <th className="px-3 py-2.5">Team</th>
              <th className="px-3 py-2.5">Palette</th>
              <th className="px-3 py-2.5">Assets</th>
              <th className="px-3 py-2.5">Templates</th>
              <th className="px-3 py-2.5">Owner</th>
              <th className="px-3 py-2.5">Status</th>
              <th className="px-3 py-2.5">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {data.kits.map(kit => (
              <tr key={kit.id} className="hover:bg-slate-50">
                <td className="px-5 py-2.5">
                  <Link href={`${base}/kits?kit=${kit.id}`} className="text-[13px] font-semibold text-slate-800 hover:text-blue-600">
                    {kit.name}
                  </Link>
                </td>
                <td className="px-3 py-2.5 text-[12px] text-slate-600">{kit.brand?.name ?? '—'}</td>
                <td className="px-3 py-2.5 text-[12px] text-slate-600">{kit.team_name ?? '—'}</td>
                <td className="px-3 py-2.5">
                  <span className="flex gap-1">
                    {kit.colours.slice(0, 5).map(c => (
                      <span key={c.id} title={c.hex} className="h-4 w-4 rounded border border-slate-200" style={{ backgroundColor: c.hex }} />
                    ))}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-[12px] text-slate-600">{kit.asset_count}</td>
                <td className="px-3 py-2.5 text-[12px] text-slate-600">{kit.template_count}</td>
                <td className="px-3 py-2.5">
                  <span className="flex items-center gap-1.5">
                    <Avatar name={kit.owner?.full_name ?? '—'} src={kit.owner?.avatar_url} size={20} />
                    <span className="truncate text-[12px] text-slate-600">{kit.owner?.full_name ?? '—'}</span>
                  </span>
                </td>
                <td className="px-3 py-2.5"><StatusBadge status={kit.status} /></td>
                <td className="px-3 py-2.5 text-[12px] text-slate-500">{formatRelativeShort(kit.updated_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

/** Typography, lockups, palette, templates, tone and guidelines for the lead kit. */
function BrandSystemPanels({ kit, base }: { kit: KitsPageData['kits'][number]; base: string }) {
  const href = `${base}/kits?kit=${kit.id}`
  return (
    <>
      <div className="grid gap-4 lg:grid-cols-4">
        <Panel title="Typography System" action="View all" actionHref={href} dense className="lg:col-span-1">
          <div className="px-4 py-3">
            <p className="mb-2 text-4xl font-bold leading-none text-slate-900">Ag</p>
            <ul className="space-y-1">
              {kit.typography.slice(0, 5).map(t => (
                <li key={t.id} className="flex items-baseline justify-between gap-2 text-[11px]">
                  <span className="font-medium text-slate-700">{t.style_name}</span>
                  <span className="truncate text-slate-400">{t.font_family} {t.font_weight}</span>
                  <span className="shrink-0 tabular-nums text-slate-400">
                    {t.font_size_px ?? '—'} / {t.line_height_px ?? '—'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Panel>

        <Panel title="Logo Lockups" action="View all" actionHref={href} dense>
          <div className="grid grid-cols-2 gap-2 px-4 py-3">
            {['Primary Lockup', 'Secondary Lockup', 'Icon Mark', 'Monogram'].map(label => (
              <div key={label} className="flex h-14 flex-col items-center justify-center rounded-lg border border-slate-200 bg-slate-50">
                <span className="text-[13px] font-black uppercase tracking-tight text-slate-800">
                  {label === 'Monogram'
                    ? (kit.brand?.name ?? kit.name).split(' ').map(w => w[0]).join('').slice(0, 2)
                    : (kit.brand?.name ?? kit.name)}
                </span>
                <span className="mt-0.5 text-[9px] text-slate-400">{label}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Color Palette" action="View all" actionHref={href} dense>
          <div className="grid grid-cols-5 gap-1.5 px-4 py-3">
            {kit.colours.slice(0, 5).map(c => (
              <div key={c.id} className="min-w-0">
                <span className="mb-1 block h-12 w-full rounded border border-slate-200" style={{ backgroundColor: c.hex }} />
                <p className="truncate text-[10px] font-medium text-slate-700">{c.name}</p>
                <p className="truncate text-[9px] uppercase text-slate-400">{c.hex}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Templates" action="View all" actionHref={href} dense>
          <div className="grid grid-cols-4 gap-1.5 px-4 py-3">
            {['Presentation', 'Social Post', 'One Pager', 'Email Header'].map((t, i) => (
              <div key={t} className="min-w-0">
                <span className="mb-1 block aspect-[3/4] overflow-hidden rounded border border-slate-200">
                  <AssetThumb name={t} kind={i === 0 ? 'presentation' : 'image'} url={null} />
                </span>
                <p className="truncate text-[9px] text-slate-500">{t}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Tone of Voice" dense>
          <div className="px-4 py-3">
            <p className="text-[12px] italic leading-snug text-slate-600">
              “We are clear, confident and human. We cut through complexity with honest language and a helpful tone.”
            </p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {['Clear', 'Confident', 'Helpful', 'Human', 'Straightforward'].map(t => (
                <span key={t} className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">{t}</span>
              ))}
            </div>
          </div>
        </Panel>

        <Panel title="Brand Guidelines & Standards" action="View all" actionHref={href} dense>
          <ul className="grid grid-cols-2 gap-2 px-4 py-3">
            {[
              { t: 'Brand Guidelines', v: 'v3.2' }, { t: 'Logo Usage Rules', v: 'v1.4' },
              { t: 'Color Standards', v: 'v2.0' }, { t: 'Typography Guide', v: 'v1.1' },
            ].map(d => (
              <li key={d.t} className="flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-rose-50">
                  <FileText size={12} className="text-rose-600" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[11px] font-medium text-slate-700">{d.t}</span>
                  <span className="block text-[10px] text-slate-400">PDF · {d.v}</span>
                </span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Linked Assets Preview" action="View all" actionHref={`${base}/assets`} dense>
          <div className="grid grid-cols-5 gap-1.5 px-4 py-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <span key={i} className="aspect-square overflow-hidden rounded border border-slate-200">
                <AssetThumb name={`${kit.name} ${i}`} kind="image" url={null} />
              </span>
            ))}
            <Link href={`${base}/assets?brand=${kit.brand_id}`}
              className="flex aspect-square flex-col items-center justify-center rounded border border-slate-200 bg-slate-50 text-center">
              <span className="text-[12px] font-bold text-slate-700">+{Math.max(0, kit.asset_count - 4)}</span>
              <span className="text-[8px] text-slate-400">More assets</span>
            </Link>
          </div>
        </Panel>
      </div>
    </>
  )
}

export { humanise, Users }
