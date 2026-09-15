import Link from 'next/link'
import {
  AlertTriangle, ChevronLeft, ChevronRight, CircleCheck, FileText, Image as ImageIcon,
  LayoutGrid, List, MoreVertical, Package, PanelsTopLeft, Play, ShieldCheck, Upload, Users,
  BadgeCheck, BookOpen, Film, FileSpreadsheet, Presentation, Archive, Music, Palette,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { OverviewData } from '@/lib/brand-assets/queries'
import type { BrandContext } from '@/lib/brand-assets/context'
import { can, isModuleAvailable } from '@/lib/brand-assets/entitlements'
import { buildHref, type RawParams } from '@/lib/brand-assets/filters'
import type { BrandKitCard } from '@/types/brand-assets'
import {
  ActionLink, EmptyPanel, KpiStrip, PageHeading, Panel, StatusBadge, type KpiSpec,
} from '../ui/primitives'
import { FilterSelect } from '../ui/controls'
import { Avatar } from '../shell/BrandAssetsShell'
import {
  assetKindLabel, formatBytes, formatCount, formatDaysLeft, formatRelativeShort, formatUkDate, humanise, layout,
} from '../tokens'

export default function OverviewPage({ ctx, data, params }: { ctx: BrandContext; data: OverviewData; params: RawParams }) {
  const base = `${ctx.basePath}/brand`
  const e = ctx.entitlements
  const k = data.kpis

  // Overview summarises the other modules, so each summary is shown only when
  // that module is available — a gated module must not leak through a KPI,
  // a preview panel or an alert target.
  const hasAssets = isModuleAvailable(e, 'assets').allowed
  const hasRights = isModuleAvailable(e, 'rights').allowed
  const hasProducts = isModuleAvailable(e, 'products').allowed
  const recentView = params.rview === 'list' ? 'list' : 'grid'
  // Brand Kits preview pages five at a time (the reference row); the chevrons page through them.
  const KITS_PER_PAGE = 5
  const kitPages = Math.max(1, Math.ceil(data.kits.length / KITS_PER_PAGE))
  const kp = Math.min(Math.max(0, typeof params.kp === 'string' ? Number.parseInt(params.kp, 10) || 0 : 0), kitPages - 1)
  const kitsShown = data.kits.slice(kp * KITS_PER_PAGE, kp * KITS_PER_PAGE + KITS_PER_PAGE)

  const all: (KpiSpec & { needs?: 'assets' | 'rights' | 'products' })[] = [
    { key: 'kits', label: 'Brand Kits', value: formatCount(k.brandKits), icon: PanelsTopLeft, tone: 'blue',
      delta: k.brandKitsDelta, deltaSuffix: 'this month', riseIsGood: true, href: `${base}/kits`,
      tooltip: 'Active brand kits in this workspace' },
    { key: 'assets', needs: 'assets', label: 'Approved Assets', value: formatCount(k.approvedAssets), icon: ImageIcon, tone: 'green',
      delta: k.approvedAssetsDelta, deltaSuffix: 'this month', riseIsGood: true, href: `${base}/assets?status=approved`,
      tooltip: 'Assets that have passed approval' },
    { key: 'rights', needs: 'rights', label: 'Rights Expiring', value: formatCount(k.rightsExpiring), icon: ShieldCheck, tone: 'amber',
      delta: k.rightsExpiringDelta, deltaSuffix: 'this month', riseIsGood: false, href: `${base}/rights?status=expiring_soon`,
      tooltip: 'Licences expiring within 30 days' },
    { key: 'products', needs: 'products', label: 'Products', value: formatCount(k.products), icon: Package, tone: 'purple',
      delta: k.productsDelta, deltaSuffix: 'this month', riseIsGood: true, href: `${base}/products`,
      tooltip: 'Products in the catalogue' },
    { key: 'usage', needs: 'assets', label: 'Usage Requests', value: formatCount(k.usageRequests), icon: Users, tone: 'indigo',
      delta: k.usageRequestsDelta, deltaSuffix: 'this week', riseIsGood: true, href: `${base}/assets?status=pending`,
      tooltip: 'Open asset usage requests' },
    { key: 'compliance', label: 'Compliance Score', value: `${k.complianceScore}%`, icon: CircleCheck, tone: 'emerald',
      delta: k.complianceScoreDelta, deltaSuffix: 'pts this month', riseIsGood: true, href: hasRights ? `${base}/rights` : null,
      tooltip: 'Share of licences with no open conflict', ring: k.complianceScore },
  ]
  const kpis = all.filter(x => !x.needs || (x.needs === 'assets' ? hasAssets : x.needs === 'rights' ? hasRights : hasProducts))
    .map(({ needs: _n, ...rest }) => rest)

  return (
    <>
      <PageHeading
        title="Brand & Assets Overview"
        subtitle="Centralize brand governance, manage assets, monitor rights, and drive compliant brand usage."
        actions={
          <>
            <ActionLink href={`${base}/kits/new`} icon={Palette}
              disabled={!can(e, 'brand.kits.create')}
              title={can(e, 'brand.kits.create') ? undefined : 'Your role does not permit creating brand kits'}>
              Create Kit
            </ActionLink>
            {hasAssets && (
              <ActionLink href={`${base}/assets?upload=1`} icon={Upload} tone="primary"
                disabled={!can(e, 'brand.assets.upload')}
                title={can(e, 'brand.assets.upload') ? undefined : 'Upload is not available for your role, plan or storage quota'}>
                Upload Asset
              </ActionLink>
            )}
            {hasProducts && (
              <ActionLink href={`${base}/products/new`} icon={Package}
                disabled={!can(e, 'brand.products.create')}
                title={can(e, 'brand.products.create') ? undefined : 'Your role does not permit adding products'}>
                Add Product
              </ActionLink>
            )}
          </>
        }
      />

      <KpiStrip items={kpis} />

      <div className={cn(layout.railGrid, 'lg:mt-4')}>
        <div className="min-w-0 space-y-3.5">
          {/* ---------------- Brand Kits ---------------- */}
          <Panel>
            <PanelHead title="Brand Kits">
              <Link href={`${base}/kits`} className="text-[11px] font-medium text-blue-600 lg:text-[9.5px] hover:text-blue-700">View all</Link>
              {kitPages > 1 && (
                <span className="ml-2 hidden gap-1 sm:flex">
                  {kp > 0
                    ? <Link href={buildHref(base, params, { kp: kp - 1 || null })} aria-label="Previous brand kits" scroll={false}
                        className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50 lg:h-5 lg:w-5"><ChevronLeft size={12} /></Link>
                    : <span aria-disabled="true" className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-100 text-slate-300 lg:h-5 lg:w-5"><ChevronLeft size={12} /></span>}
                  {kp < kitPages - 1
                    ? <Link href={buildHref(base, params, { kp: kp + 1 })} aria-label="Next brand kits" scroll={false}
                        className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50 lg:h-5 lg:w-5"><ChevronRight size={12} /></Link>
                    : <span aria-disabled="true" className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-100 text-slate-300 lg:h-5 lg:w-5"><ChevronRight size={12} /></span>}
                </span>
              )}
            </PanelHead>
            {data.kits.length === 0 ? (
              <EmptyPanel icon={PanelsTopLeft} title="No brand kits yet"
                body="Create your first brand kit to define logos, colour, typography and templates."
                action={can(e, 'brand.kits.create') ? 'Create Brand Kit' : undefined} actionHref={`${base}/kits/new`} />
            ) : (
              <div className="grid snap-x grid-flow-col auto-cols-[minmax(172px,1fr)] gap-3 overflow-x-auto px-3.5 pb-3.5 [scrollbar-width:none] xl:grid-flow-row xl:grid-cols-5 xl:overflow-visible">
                {kitsShown.map(kit => <OverviewKitCard key={kit.id} kit={kit} href={`${base}/kits/${kit.id}`} />)}
              </div>
            )}
          </Panel>

          {/* ---------------- Recent Assets ---------------- */}
          {hasAssets && (
            <Panel>
              <PanelHead title="Recent Assets">
                <Link href={`${base}/assets`} className="mr-1 text-[11px] font-medium text-blue-600 lg:text-[9.5px] hover:text-blue-700">View all assets</Link>
                <FilterSelect compact pathname={base} params={params} name="rtype" label="Type" allLabel="All Types"
                  value={typeof params.rtype === 'string' ? params.rtype : null}
                  options={['image', 'video', 'pdf', 'social', 'packaging', 'design', 'presentation', 'template'].map(v => ({ value: v, label: humanise(v) }))} />
                <FilterSelect compact pathname={base} params={params} name="rsort" label="Sort" allLabel="Recently Added"
                  value={typeof params.rsort === 'string' ? params.rsort : null}
                  options={[{ value: 'name_asc', label: 'Name A–Z' }, { value: 'size_desc', label: 'Largest' }]} />
                <span className="inline-flex overflow-hidden rounded-md border border-slate-200" role="group" aria-label="Recent assets view">
                  <Link href={buildHref(base, params, { rview: null })} aria-current={recentView === 'grid' ? 'true' : undefined} aria-label="Grid view"
                    className={cn('flex h-7 w-8 items-center justify-center', recentView === 'grid' ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:bg-slate-50')}>
                    <LayoutGrid size={13} />
                  </Link>
                  <Link href={buildHref(base, params, { rview: 'list' })} aria-current={recentView === 'list' ? 'true' : undefined} aria-label="List view"
                    className={cn('flex h-7 w-8 items-center justify-center border-l border-slate-200', recentView === 'list' ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:bg-slate-50')}>
                    <List size={13} />
                  </Link>
                </span>
              </PanelHead>
              {data.recentAssets.length === 0 ? (
                <EmptyPanel icon={ImageIcon} title={params.rtype ? 'No assets of that type yet' : 'No assets yet'}
                  body="Upload your first asset to start building the brand library."
                  action={can(e, 'brand.assets.upload') ? 'Upload Assets' : undefined} actionHref={`${base}/assets?upload=1`} />
              ) : recentView === 'list' ? (
                <ul className="divide-y divide-slate-100 px-1 pb-2">
                  {data.recentAssets.map(a => (
                    <li key={a.id}>
                      <Link href={`${base}/assets/${a.id}`} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-slate-50">
                        <span className="relative h-9 w-12 shrink-0 overflow-hidden rounded-md bg-slate-100"><AssetThumb name={a.file_name} kind={a.asset_kind} url={a.thumbnail_path} /></span>
                        <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-slate-800">{a.file_name}</span>
                        <span className="text-[11px] text-slate-400">{(a.file_type ?? '').toUpperCase()} · {formatBytes(a.file_size)}</span>
                        <StatusBadge status={a.approval_status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="grid grid-cols-2 gap-3 px-3.5 pb-3.5 sm:grid-cols-3 lg:grid-cols-6 2xl:grid-cols-7">
                  {data.recentAssets.map(a => (
                    <Link key={a.id} href={`${base}/assets/${a.id}`} className="group min-w-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
                      <div className="relative mb-2 aspect-[136/110] overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200/70">
                        <AssetThumb name={a.file_name} kind={a.asset_kind} url={a.thumbnail_path} />
                        <KindChip kind={a.asset_kind} />
                        {a.asset_kind === 'video' && <VideoOverlay seconds={a.duration_seconds} />}
                      </div>
                      <p className="truncate text-[11.5px] font-medium text-slate-800 group-hover:text-blue-600 lg:text-[8.5px]">{a.file_name}</p>
                      <p className="mt-0.5 text-[10.5px] text-slate-400 lg:text-[7.5px]">{(a.file_type ?? '').toUpperCase()} · {formatBytes(a.file_size)}</p>
                    </Link>
                  ))}
                </div>
              )}
            </Panel>
          )}

          {/* ---------------- Rights + Products ---------------- */}
          {(hasRights || hasProducts) && (
            <div className={cn('grid gap-3.5', hasRights && hasProducts && 'lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]')}>
              {hasRights && (
                <Panel title="Rights & Licensing" action="View all rights" actionHref={`${base}/rights`}>
                  {data.rights.length === 0 ? (
                    <EmptyPanel icon={ShieldCheck} title="No licences recorded"
                      body="Add a licence to start tracking territories, channels and expiry."
                      action={can(e, 'brand.rights.create') ? 'Add License' : undefined} actionHref={`${base}/rights/new`} />
                  ) : (
                    <div className="overflow-x-auto px-1.5 pb-1.5">
                      <table className="w-full min-w-[430px] table-fixed text-left">
                        <colgroup>
                          <col className="w-[28%]" /><col className="w-[13%]" /><col className="w-[13%]" />
                          <col className="w-[14%]" /><col className="w-[13%]" /><col className="w-[19%]" /><col className="w-5" />
                        </colgroup>
                        <thead>
                          <tr className="border-y border-slate-100 bg-slate-50/60 text-[9.5px] font-medium text-slate-500 lg:text-[7px]">
                            <th className="px-2.5 py-1.5 font-medium">Asset / License</th>
                            <th className="px-1.5 py-1.5 font-medium">Territory</th>
                            <th className="px-1.5 py-1.5 font-medium">Channel</th>
                            <th className="px-1.5 py-1.5 font-medium">Expiry Date</th>
                            <th className="px-1.5 py-1.5 font-medium">Owner</th>
                            <th className="px-1.5 py-1.5 font-medium">Status</th>
                            <th aria-label="Actions" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {data.rights.map(l => {
                            const d = formatDaysLeft(l.days_remaining)
                            return (
                              <tr key={l.id} className="hover:bg-slate-50/70">
                                <td className="px-2.5 py-2">
                                  <Link href={`${base}/rights/${l.id}`} className="flex min-w-0 items-center gap-2">
                                    <span className="h-8 w-8 shrink-0 overflow-hidden rounded-md bg-slate-100 ring-1 ring-slate-200/70">
                                      <AssetThumb name={l.name} kind={l.asset?.asset_kind ?? 'image'} url={l.asset?.thumbnail_path ?? null} />
                                    </span>
                                    <span className="min-w-0">
                                      <span className="block truncate text-[10.5px] font-semibold text-slate-800 lg:text-[7.5px]">{l.name}</span>
                                      <span className="block truncate text-[9.5px] text-slate-400 lg:text-[7px]">{humanise(l.license_type)} License</span>
                                    </span>
                                  </Link>
                                </td>
                                <td className="truncate px-1.5 py-2 text-[10px] text-slate-600 lg:text-[7.5px]">{l.territories[0]?.name ?? '—'}</td>
                                <td className="truncate px-1.5 py-2 text-[10px] text-slate-600 lg:text-[7.5px]">{l.channels.slice(0, 2).map(c => c.name).join(', ') || '—'}</td>
                                <td className="whitespace-nowrap px-1.5 py-2">
                                  <span className="block text-[10px] text-slate-700 lg:text-[7.5px]">{formatUkDate(l.expires_on)}</span>
                                  <span className={cn('block text-[9.5px] font-medium lg:text-[7px]', d.tone)}>{d.label}</span>
                                </td>
                                <td className="px-1.5 py-2">
                                  <span className="flex items-center gap-1">
                                    <Avatar name={l.owner?.full_name ?? '—'} src={l.owner?.avatar_url} size={14} />
                                    <span className="min-w-0 truncate text-[9.5px] text-slate-600 lg:text-[7px]">{l.owner?.full_name ?? '—'}</span>
                                  </span>
                                </td>
                                <td className="px-1.5 py-2"><StatusBadge status={l.status} size="xs" /></td>
                                <td className="pr-2 text-slate-300"><MoreVertical size={13} aria-hidden="true" /></td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Panel>
              )}

              {hasProducts && (
                <Panel title="Product Library" action="View all products" actionHref={`${base}/products`}>
                  {data.products.length === 0 ? (
                    <EmptyPanel icon={Package} title="No products yet"
                      body="Add a product to link assets and track campaign readiness."
                      action={can(e, 'brand.products.create') ? 'Add Product' : undefined} actionHref={`${base}/products/new`} />
                  ) : (
                    <div className="grid grid-cols-3 gap-2.5 px-3.5 pb-3.5">
                      {data.products.map(p => (
                        <Link key={p.id} href={`${base}/products/${p.id}`} className="group min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
                          <div className="aspect-[135/125] overflow-hidden bg-slate-100">
                            <AssetThumb name={p.name} kind="image" url={p.primary_asset?.thumbnail_path ?? null} />
                          </div>
                          <div className="p-2">
                            <p className="truncate text-[10.5px] font-semibold text-slate-800 group-hover:text-blue-600 lg:text-[8px]">{p.name}</p>
                            <p className="text-[9.5px] text-slate-400 lg:text-[7px]">{p.sku}</p>
                            <p className="mt-0.5 text-[9.5px] text-slate-500 lg:mt-1 lg:text-[7px]">{p.linked_asset_count} linked assets</p>
                            <span className="mt-1 inline-block"><StatusBadge status={p.status} size="xs" /></span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </Panel>
              )}
            </div>
          )}
        </div>

        {/* ---------------- Right rail ---------------- */}
        <div className="space-y-3.5">
          <Panel title="Activity Feed" action="View all" actionHref={`${base}/activity`} dense>
            {data.activity.length === 0
              ? <EmptyPanel title="No activity yet" body="Actions across brand, assets, rights and products appear here." />
              : (
                <ul className="space-y-0.5 px-1.5 pb-2">
                  {data.activity.map(a => (
                    <li key={a.id}>
                      <Link href={a.href ?? `${base}/activity`} className="flex gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                        <ActivityIcon type={a.entity_type} action={a.action} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[10.5px] font-semibold leading-snug text-slate-800 lg:text-[8px]">
                            {a.actor?.full_name ?? 'System'} <span className="font-normal text-slate-600">{a.action}</span>
                          </span>
                          <span className="block truncate text-[9.5px] text-slate-400 lg:text-[7.5px]">{stripVerb(a.summary)}</span>
                        </span>
                        <span className="shrink-0 pt-0.5 text-[9px] text-slate-400 lg:text-[7px]">{formatRelativeShort(a.created_at)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
          </Panel>

          <Panel title="Alerts" action="View all" actionHref={hasRights ? `${base}/rights?status=expiring_soon` : `${base}/kits`} dense>
            {data.alerts.length === 0
              ? <EmptyPanel title="No open alerts" body="Rights, approvals and readiness warnings appear here." />
              : (
                <ul className="space-y-2.5 px-3.5 pb-3">
                  {data.alerts.slice(0, 4).map(al => {
                    const tone = al.severity === 'critical' ? 'text-rose-600' : al.severity === 'warning' ? 'text-amber-500' : 'text-blue-600'
                    return (
                      <li key={al.id} className="flex gap-2.5">
                        <AlertTriangle size={17} className={cn('mt-0.5 shrink-0', tone)} aria-hidden="true" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[10.5px] font-semibold text-slate-800 lg:text-[8px]">{al.title}</p>
                          {al.body && <p className="mt-0.5 text-[9.5px] leading-snug text-slate-500 lg:text-[7.5px]">{al.body}</p>}
                          <Link href={al.href ?? ({
                            guideline_update: `${base}/kits`,
                            pending_approvals: hasAssets ? `${base}/assets?status=pending` : `${base}/kits?approval=pending`,
                            missing_product_assets: hasProducts ? `${base}/products?readiness=not_ready` : base,
                          } as Record<string, string>)[al.alert_type] ?? (hasRights ? `${base}/rights?status=expiring_soon` : base)}
                            className={cn('mt-0.5 inline-block text-[9.5px] font-medium hover:underline lg:text-[7.5px]', al.severity === 'critical' ? 'text-rose-600' : 'text-blue-600')}>
                            {al.alert_type === 'guideline_update' ? 'View update' : 'Review now'}
                          </Link>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
          </Panel>

          <Panel title="Storage Overview" dense>
            <div className="px-3.5 pb-3.5">
              <div className="mb-1.5 flex items-baseline justify-between text-[10px] text-slate-600 lg:text-[8px]">
                <span>{formatBytes(data.storage.used)} of {formatBytes(data.storage.quota)} used</span>
                <span className="font-medium">{data.storage.used > 0 && data.storage.percent === 0 ? '<1' : data.storage.percent}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100" role="progressbar"
                aria-valuenow={data.storage.percent} aria-valuemin={0} aria-valuemax={100} aria-label="Storage used">
                <div className={cn('h-full rounded-full', data.storage.percent >= 90 ? 'bg-rose-500' : data.storage.percent >= 75 ? 'bg-amber-500' : 'bg-blue-600')}
                  style={{ width: `${Math.max(data.storage.used > 0 ? 1 : 0, data.storage.percent)}%` }} />
              </div>
              <Link href={`${ctx.basePath}/settings/billing`} className="mt-2.5 inline-block text-[10px] font-medium text-blue-600 hover:text-blue-700 lg:text-[8px]">
                Manage storage
              </Link>
            </div>
          </Panel>
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------

function PanelHead({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 pb-2.5 pt-3.5">
      <h2 className="text-[13.5px] font-semibold tracking-tight text-slate-900 lg:text-[11px]">{title}</h2>
      <div className="flex items-center gap-1.5">{children}</div>
    </div>
  )
}

/** Heading + body family pairing, deduplicated: "Inter / DM Sans", never "Inter / Inter". */
export function fontPair(kit: BrandKitCard): string {
  const families = [...new Set(kit.typography.map(t => t.font_family))]
  return families.slice(0, 2).join(' / ') || '—'
}

function OverviewKitCard({ kit, href }: { kit: BrandKitCard; href: string }) {
  const name = kit.brand?.name ?? kit.name
  return (
    <Link href={href} className="group relative flex snap-start flex-col rounded-lg border border-slate-200 bg-white p-2.5 transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 lg:min-h-[162px] lg:px-3 lg:pt-3">
      <MoreVertical size={14} className="absolute right-1.5 top-2.5 text-slate-300" aria-hidden="true" />
      <div className="mb-2 flex h-10 items-center justify-center lg:mb-3 lg:h-9">
        <BrandLogo name={name} url={kit.brand?.logo_url ?? null} className="max-h-9 max-w-[130px] lg:max-h-7 lg:max-w-[110px]" />
      </div>
      <div className="mb-2 flex gap-1.5 lg:mb-3">
        {kit.colours.slice(0, 5).map(c => (
          <span key={c.id} title={`${c.name} ${c.hex}`} className="h-[26px] flex-1 rounded-md ring-1 ring-inset ring-slate-900/10 lg:h-7" style={{ backgroundColor: c.hex }} />
        ))}
      </div>
      <div className="mb-2 flex items-center gap-1.5 rounded-md bg-slate-50 px-1.5 py-1 lg:mb-3">
        <span className="rounded bg-white px-1 text-[10px] font-bold text-slate-600 ring-1 ring-slate-200 lg:text-[8px]">Aa</span>
        <span className="truncate text-[10px] text-slate-600 lg:text-[8px]">{fontPair(kit)}</span>
      </div>
      <div className="mt-auto flex items-center gap-1.5 pt-0.5">
        <Avatar name={kit.owner?.full_name ?? 'Unassigned'} src={kit.owner?.avatar_url} size={16} />
        <span className="min-w-0 flex-1 truncate text-[10px] text-slate-600 lg:text-[7.5px]">{kit.owner?.full_name ?? 'Unassigned'}</span>
        <span className="shrink-0 text-[9.5px] text-slate-400 lg:text-[7px]">{kit.asset_count} assets</span>
      </div>
    </Link>
  )
}

/** Real logo when the brand has one; otherwise the brand name set as a wordmark. */
export function BrandLogo({ name, url, className }: { name: string; url: string | null; className?: string }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={`${name} logo`} className={cn('object-contain', className)} loading="lazy" decoding="async" />
  }
  return <span className="truncate text-[15px] font-black uppercase tracking-tight text-slate-900">{name}</span>
}

function stripVerb(summary: string): string {
  return summary.replace(/^(Approved|Uploaded|Updated|Requested usage of|Added|Renewed|Linked|Created|Archived|Restored|Submitted)\s+/i, '')
}

function ActivityIcon({ type, action }: { type: string; action: string }) {
  const map: Record<string, { icon: React.ComponentType<{ size?: number; className?: string }>; wash: string }> = {
    approved: { icon: BadgeCheck, wash: 'bg-emerald-50 text-emerald-600' },
    uploaded: { icon: Play, wash: 'bg-slate-900 text-white' },
    updated: { icon: PanelsTopLeft, wash: 'bg-amber-50 text-amber-600' },
    requested: { icon: Users, wash: 'bg-indigo-50 text-indigo-600' },
    linked: { icon: Package, wash: 'bg-violet-50 text-violet-600' },
    renewed: { icon: ShieldCheck, wash: 'bg-blue-50 text-blue-600' },
    expired: { icon: AlertTriangle, wash: 'bg-rose-50 text-rose-600' },
    created: { icon: PanelsTopLeft, wash: 'bg-blue-50 text-blue-600' },
    added: { icon: Package, wash: 'bg-violet-50 text-violet-600' },
    rejected: { icon: AlertTriangle, wash: 'bg-rose-50 text-rose-600' },
  }
  const fallback = type === 'product'
    ? { icon: Package, wash: 'bg-violet-50 text-violet-600' }
    : type === 'license'
      ? { icon: ShieldCheck, wash: 'bg-amber-50 text-amber-600' }
      : { icon: FileText, wash: 'bg-blue-50 text-blue-600' }
  const m = map[action] ?? fallback
  const Icon = m.icon
  return <span className={cn('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ring-current/10', m.wash)} aria-hidden="true"><Icon size={13} /></span>
}

export function KindChip({ kind }: { kind: string }) {
  return (
    <span className="absolute bottom-1.5 left-1.5 rounded-[4px] bg-slate-900/75 px-1.5 py-[1px] text-[8.5px] font-semibold uppercase tracking-wide text-white backdrop-blur-sm">
      {assetKindLabel[kind] ?? 'FILE'}
    </span>
  )
}

export function VideoOverlay({ seconds }: { seconds: number | null }) {
  const mm = seconds ? `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.round(seconds % 60)).padStart(2, '0')}` : null
  return (
    <>
      <span className="absolute left-1/2 top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white/90 bg-slate-900/30 text-white backdrop-blur-sm" aria-hidden="true">
        <Play size={13} fill="currentColor" />
      </span>
      {mm && <span className="absolute bottom-1.5 right-1.5 rounded-[4px] bg-slate-900/75 px-1.5 py-[1px] text-[8.5px] font-semibold text-white">{mm}</span>}
    </>
  )
}

const KIND_ICON: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  pdf: BookOpen, document: FileText, presentation: Presentation, template: Presentation,
  video: Film, audio: Music, archive: Archive, design: Palette, other: FileSpreadsheet,
}

/**
 * Real thumbnail (signed R2 URL) when one exists. Without one, a neutral typed
 * file tile — the file kind and nothing invented — rather than a fake image.
 */
export function AssetThumb({ name, kind, url }: { name: string; kind: string; url: string | null }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
  }
  const Icon = KIND_ICON[kind] ?? ImageIcon
  return (
    <span className="flex h-full w-full flex-col items-center justify-center gap-1 bg-gradient-to-br from-slate-50 to-slate-100 text-slate-400" title={name}>
      <Icon size={20} aria-hidden="true" />
      <span className="text-[8.5px] font-semibold uppercase tracking-wide">{assetKindLabel[kind] ?? 'FILE'}</span>
    </span>
  )
}
