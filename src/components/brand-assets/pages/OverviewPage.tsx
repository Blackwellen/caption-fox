import Link from 'next/link'
import {
  AlertTriangle, BookOpen, ChevronLeft, ChevronRight, CircleCheck, FileText,
  Image as ImageIcon, LayoutGrid, MoreVertical, Package, PanelsTopLeft, Plus,
  ShieldCheck, Upload, Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { OverviewData } from '@/lib/brand-assets/queries'
import type { BrandContext } from '@/lib/brand-assets/context'
import { can, isModuleAvailable } from '@/lib/brand-assets/entitlements'
import {
  ActionLink, EmptyPanel, KpiStrip, MoreLink, PageHeading, Panel,
  ProgressRing, StatusBadge, type KpiSpec,
} from '../ui/primitives'
import { Avatar } from '../shell/BrandAssetsShell'
import {
  assetKindChip, assetKindLabel, formatBytes, formatCount, formatDaysLeft,
  formatRelativeShort, formatUkDate,
} from '../tokens'

export default function OverviewPage({ ctx, data }: { ctx: BrandContext; data: OverviewData }) {
  const base = `${ctx.basePath}/brand`
  const e = ctx.entitlements
  const k = data.kpis

  // Overview summarises the other modules, so each summary is shown only when
  // that module is available. A gated module must not leak through a KPI link,
  // a preview panel or an alert target.
  const hasAssets = isModuleAvailable(e, 'assets').allowed
  const hasRights = isModuleAvailable(e, 'rights').allowed
  const hasProducts = isModuleAvailable(e, 'products').allowed
  const alertsHref = hasRights ? `${base}/rights` : base

  const kpis: KpiSpec[] = ([
    { key: 'kits', label: 'Brand Kits', value: formatCount(k.brandKits), icon: PanelsTopLeft, tone: 'blue',
      delta: k.brandKitsDelta, deltaSuffix: 'this month', riseIsGood: true, href: `${base}/kits`,
      tooltip: 'Active brand kits in this workspace' },
    { key: 'assets', label: 'Approved Assets', value: formatCount(k.approvedAssets), icon: ImageIcon, tone: 'green',
      delta: k.approvedAssetsDelta, deltaSuffix: 'this month', riseIsGood: true, href: `${base}/assets?status=approved`,
      tooltip: 'Assets that have passed approval' },
    { key: 'rights', label: 'Rights Expiring', value: formatCount(k.rightsExpiring), icon: ShieldCheck, tone: 'amber',
      delta: k.rightsExpiringDelta, deltaSuffix: 'this month', riseIsGood: false, href: `${base}/rights?status=expiring_soon`,
      tooltip: 'Licences expiring within 30 days' },
    { key: 'products', label: 'Products', value: formatCount(k.products), icon: Package, tone: 'purple',
      delta: k.productsDelta, deltaSuffix: 'this month', riseIsGood: true, href: `${base}/products`,
      tooltip: 'Products in the catalogue' },
    { key: 'usage', label: 'Usage Requests', value: formatCount(k.usageRequests), icon: Users, tone: 'indigo',
      delta: k.usageRequestsDelta, deltaSuffix: 'this week', riseIsGood: true, href: `${base}/assets?status=pending`,
      tooltip: 'Open asset usage requests' },
    { key: 'compliance', label: 'Compliance Score', value: `${k.complianceScore}%`, icon: CircleCheck, tone: 'emerald',
      delta: k.complianceScoreDelta, deltaSuffix: 'pts this month', riseIsGood: true, href: `${base}/rights`,
      tooltip: 'Share of licences with no open conflict', ring: k.complianceScore },
  ] as (KpiSpec & { needs?: 'assets' | 'rights' | 'products' })[])
    .map(kpi => {
      const needs = kpi.key === 'rights' ? 'rights'
        : kpi.key === 'products' ? 'products'
          : kpi.key === 'assets' || kpi.key === 'usage' ? 'assets' : undefined
      return { ...kpi, needs }
    })
    .filter(kpi => kpi.needs === 'rights' ? hasRights
      : kpi.needs === 'products' ? hasProducts
        : kpi.needs === 'assets' ? hasAssets : true)
    .map(({ needs, ...kpi }) => {
      void needs
      // Compliance links into Rights; drop the link when Rights is gated.
      if (kpi.key === 'compliance' && !hasRights) return { ...kpi, href: null }
      return kpi
    })

  return (
    <>
      <PageHeading
        title="Brand & Assets Overview"
        subtitle="Centralize brand governance, manage assets, monitor rights, and drive compliant brand usage."
        actions={
          <>
            <ActionLink href={`${base}/kits?create=1`} icon={Plus}
              disabled={!can(e, 'brand.kits.create')}
              title={can(e, 'brand.kits.create') ? undefined : 'Your role does not permit creating brand kits'}>
              Create Kit
            </ActionLink>
            <ActionLink href={`${base}/assets?upload=1`} icon={Upload} tone="primary"
              disabled={!can(e, 'brand.assets.upload')}
              title={can(e, 'brand.assets.upload') ? undefined : 'Upload is not available for your role or plan'}>
              Upload Asset
            </ActionLink>
            <ActionLink href={`${base}/products?create=1`} icon={Package}
              disabled={!can(e, 'brand.products.create')}
              title={can(e, 'brand.products.create') ? undefined : 'Your role does not permit adding products'}>
              Add Product
            </ActionLink>
          </>
        }
      />

      <KpiStrip items={kpis} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_288px]">
        {/* ---------------- Left column ---------------- */}
        <div className="min-w-0 space-y-4">
          {/* Brand Kits carousel */}
          <Panel>
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
              <h2 className="text-[15px] font-semibold text-slate-900">Brand Kits</h2>
              <div className="flex items-center gap-2">
                <Link href={`${base}/kits`} className="text-[13px] font-medium text-blue-600 hover:text-blue-700">View all</Link>
                <span className="flex gap-1">
                  <span className="flex h-6 w-6 items-center justify-center rounded border border-slate-200 text-slate-400"><ChevronLeft size={14} /></span>
                  <span className="flex h-6 w-6 items-center justify-center rounded border border-slate-200 text-slate-400"><ChevronRight size={14} /></span>
                </span>
              </div>
            </div>
            {data.kits.length === 0 ? (
              <EmptyPanel
                icon={PanelsTopLeft}
                title="No brand kits yet"
                body="Create your first brand kit to define logos, colour, typography and templates."
                action={can(e, 'brand.kits.create') ? 'Create Brand Kit' : undefined}
                actionHref={`${base}/kits?create=1`}
              />
            ) : (
              <div className="grid grid-cols-2 gap-3 p-4 md:grid-cols-3 xl:grid-cols-5">
                {data.kits.map(kit => (
                  <Link key={kit.id} href={`${base}/kits?kit=${kit.id}`}
                    className="flex flex-col rounded-lg border border-slate-200 p-3 transition-shadow hover:shadow-sm">
                    <div className="mb-2 flex items-start justify-between">
                      <span className="truncate text-[15px] font-black uppercase tracking-tight text-slate-900">
                        {kit.brand?.name ?? kit.name}
                      </span>
                      <MoreVertical size={14} className="shrink-0 text-slate-300" />
                    </div>
                    <div className="mb-2.5 flex gap-1">
                      {kit.colours.slice(0, 5).map(c => (
                        <span key={c.id} title={`${c.name} ${c.hex}`}
                          className="h-6 w-6 rounded border border-slate-200"
                          style={{ backgroundColor: c.hex }} />
                      ))}
                    </div>
                    <div className="mb-2.5 flex items-center gap-1.5 rounded bg-slate-50 px-2 py-1">
                      <span className="text-[11px] font-bold text-slate-500">Aa</span>
                      <span className="truncate text-[11px] text-slate-500">
                        {kit.typography.slice(0, 2).map(t => t.font_family).join(' / ') || '—'}
                      </span>
                    </div>
                    <div className="mt-auto flex items-center gap-1.5 border-t border-slate-100 pt-2">
                      <Avatar name={kit.owner?.full_name ?? 'Unassigned'} src={kit.owner?.avatar_url} size={18} />
                      <span className="min-w-0 flex-1 truncate text-[11px] text-slate-600">
                        {kit.owner?.full_name ?? 'Unassigned'}
                      </span>
                      <span className="shrink-0 text-[11px] text-slate-400">{kit.asset_count} assets</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Panel>

          {/* Recent Assets */}
          {hasAssets && <Panel>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3.5">
              <h2 className="text-[15px] font-semibold text-slate-900">Recent Assets</h2>
              <div className="flex items-center gap-2">
                <Link href={`${base}/assets`} className="text-[13px] font-medium text-blue-600 hover:text-blue-700">View all assets</Link>
                <span className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-[13px] text-slate-600">All Types</span>
                <span className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-[13px] text-slate-600">Recently Added</span>
                <span className="flex h-8 items-center rounded-lg bg-blue-600 px-2 text-white"><LayoutGrid size={14} /></span>
              </div>
            </div>
            {data.recentAssets.length === 0 ? (
              <EmptyPanel
                icon={ImageIcon}
                title="No assets yet"
                body="Upload your first asset to start building the brand library."
                action={can(e, 'brand.assets.upload') ? 'Upload Assets' : undefined}
                actionHref={`${base}/assets?upload=1`}
              />
            ) : (
              <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-6">
                {data.recentAssets.map(a => (
                  <Link key={a.id} href={`${base}/assets?asset=${a.id}`} className="group min-w-0">
                    <div className="relative mb-2 aspect-[4/3] overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                      <AssetThumb name={a.file_name} kind={a.asset_kind} url={a.thumbnail_path ?? null} />
                      <span className={cn(
                        'absolute bottom-1.5 left-1.5 rounded px-1.5 py-0.5 text-[9px] font-bold',
                        assetKindChip[a.asset_kind] ?? assetKindChip.other,
                      )}>
                        {assetKindLabel[a.asset_kind] ?? 'FILE'}
                      </span>
                    </div>
                    <p className="truncate text-[13px] font-medium text-slate-800 group-hover:text-blue-600">{a.file_name}</p>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {a.file_type?.toUpperCase()} · {formatBytes(a.file_size)}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </Panel>}

          {/* Rights + Products — each only when that module is entitled */}
          {(hasRights || hasProducts) && <div className="grid gap-4 lg:grid-cols-2">
            {hasRights && <Panel title="Rights & Licensing" action="View all rights" actionHref={`${base}/rights`}>
              {data.rights.length === 0 ? (
                <EmptyPanel icon={ShieldCheck} title="No licences recorded"
                  body="Add a licence to start tracking territories, channels and expiry."
                  action={can(e, 'brand.rights.create') ? 'Add License' : undefined}
                  actionHref={`${base}/rights?create=1`} />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-left">
                    <thead>
                      <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        <th className="px-5 py-2">Asset / License</th>
                        <th className="px-2 py-2">Territory</th>
                        <th className="px-2 py-2">Channel</th>
                        <th className="px-2 py-2">Expiry Date</th>
                        <th className="px-2 py-2">Owner</th>
                        <th className="px-2 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {data.rights.map(l => {
                        const d = formatDaysLeft(l.days_remaining)
                        return (
                          <tr key={l.id} className="hover:bg-slate-50">
                            <td className="px-5 py-2.5">
                              <Link href={`${base}/rights?license=${l.id}`} className="block min-w-0">
                                <span className="block truncate text-[13px] font-medium text-slate-800">{l.name}</span>
                                <span className="block truncate text-[11px] text-slate-400">{l.license_type.replace(/_/g, ' ')}</span>
                              </Link>
                            </td>
                            <td className="px-2 py-2.5 text-[12px] text-slate-600">{l.territories[0]?.name ?? '—'}</td>
                            <td className="px-2 py-2.5 text-[12px] text-slate-600">{l.channels.slice(0, 2).map(c => c.name).join(', ') || '—'}</td>
                            <td className="px-2 py-2.5">
                              <span className="block text-[12px] text-slate-700">{formatUkDate(l.expires_on)}</span>
                              <span className={cn('block text-[11px] font-medium', d.tone)}>{d.label}</span>
                            </td>
                            <td className="px-2 py-2.5">
                              <span className="flex items-center gap-1.5">
                                <Avatar name={l.owner?.full_name ?? '—'} src={l.owner?.avatar_url} size={18} />
                                <span className="truncate text-[12px] text-slate-600">{l.owner?.full_name ?? '—'}</span>
                              </span>
                            </td>
                            <td className="px-2 py-2.5"><StatusBadge status={l.status} /></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>}

            {hasProducts && <Panel title="Product Library" action="View all products" actionHref={`${base}/products`}>
              {data.products.length === 0 ? (
                <EmptyPanel icon={Package} title="No products yet"
                  body="Add a product to link assets and track campaign readiness."
                  action={can(e, 'brand.products.create') ? 'Add Product' : undefined}
                  actionHref={`${base}/products?create=1`} />
              ) : (
                <div className="grid grid-cols-3 gap-3 p-4">
                  {data.products.map(p => (
                    <Link key={p.id} href={`${base}/products?product=${p.id}`} className="group min-w-0">
                      <div className="mb-2 aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                        <AssetThumb name={p.name} kind="image" url={p.primary_asset?.thumbnail_path ?? null} />
                      </div>
                      <p className="truncate text-[13px] font-semibold text-slate-800 group-hover:text-blue-600">{p.name}</p>
                      <p className="text-[11px] text-slate-400">{p.sku}</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">{p.linked_asset_count} linked assets</p>
                      <span className="mt-1.5 inline-block"><StatusBadge status={p.status} /></span>
                    </Link>
                  ))}
                </div>
              )}
            </Panel>}
          </div>}
        </div>

        {/* ---------------- Right rail ---------------- */}
        <div className="space-y-4">
          <Panel title="Activity Feed" action="View all" actionHref={hasAssets ? `${base}/assets?sort=newest` : base} dense>
            {data.activity.length === 0
              ? <EmptyPanel title="No activity yet" body="Actions across brand, assets, rights and products appear here." />
              : (
                <ul className="divide-y divide-slate-50">
                  {data.activity.map(a => (
                    <li key={a.id} className="flex gap-2.5 px-4 py-2.5">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded bg-slate-100">
                        <ActivityIcon type={a.entity_type} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-medium text-slate-800">{a.summary}</p>
                        <p className="truncate text-[11px] text-slate-400">{a.actor?.full_name ?? 'System'}</p>
                      </div>
                      <span className="shrink-0 text-[11px] text-slate-400">{formatRelativeShort(a.created_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
          </Panel>

          <Panel title="Alerts" action="View all" actionHref={hasRights ? `${base}/rights?status=expiring_soon` : base} dense>
            {data.alerts.length === 0
              ? <EmptyPanel title="No open alerts" body="Rights, approvals and readiness warnings appear here." />
              : (
                <ul className="divide-y divide-slate-50">
                  {data.alerts.map(al => (
                    <li key={al.id} className="flex gap-2.5 px-4 py-3">
                      <span className={cn(
                        'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
                        al.severity === 'critical' ? 'bg-rose-50 text-rose-600'
                          : al.severity === 'warning' ? 'bg-amber-50 text-amber-600'
                            : 'bg-blue-50 text-blue-600',
                      )}>
                        <AlertTriangle size={13} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-semibold text-slate-800">{al.title}</p>
                        {al.body && <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{al.body}</p>}
                        <Link href={al.href ?? alertsHref} className="mt-1 inline-block text-[11px] font-medium text-blue-600 hover:text-blue-700">
                          Review now
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
          </Panel>

          <Panel title="Storage Overview" dense>
            <div className="px-4 py-3.5">
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-[12px] text-slate-600">
                  {formatBytes(data.storage.used)} of {formatBytes(data.storage.quota)} used
                </span>
                <span className="text-[13px] font-bold text-slate-900">{data.storage.percent}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar"
                aria-valuenow={data.storage.percent} aria-valuemin={0} aria-valuemax={100}
                aria-label="Storage used">
                <div
                  className={cn('h-full rounded-full',
                    data.storage.percent >= 90 ? 'bg-rose-500'
                      : data.storage.percent >= 75 ? 'bg-amber-500' : 'bg-blue-600')}
                  style={{ width: `${data.storage.percent}%` }}
                />
              </div>
              <Link href={`${ctx.basePath}/settings/billing`} className="mt-2.5 inline-block text-[12px] font-medium text-blue-600 hover:text-blue-700">
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

function ActivityIcon({ type }: { type: string }) {
  const cls = 'text-slate-500'
  switch (type) {
    case 'asset': return <ImageIcon size={13} className={cls} />
    case 'brand_kit': return <PanelsTopLeft size={13} className={cls} />
    case 'license': case 'agreement': return <ShieldCheck size={13} className={cls} />
    case 'product': return <Package size={13} className={cls} />
    case 'usage_request': case 'approval': return <Users size={13} className={cls} />
    default: return <FileText size={13} className={cls} />
  }
}

/**
 * Thumbnail with a deterministic placeholder. Demo rows carry no real file, so
 * rather than a broken image we render a stable tinted initial derived from the
 * name — no random values, so server and client markup always agree.
 */
export function AssetThumb({ name, kind, url }: { name: string; kind: string; url: string | null }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
  }
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) % 360
  const isDoc = ['pdf', 'document', 'presentation', 'template'].includes(kind)
  return (
    <span
      className="flex h-full w-full items-center justify-center"
      style={{ background: `linear-gradient(135deg, hsl(${hash} 45% 92%), hsl(${(hash + 40) % 360} 45% 84%))` }}
      aria-hidden="true"
    >
      {isDoc
        ? <BookOpen size={22} style={{ color: `hsl(${hash} 45% 42%)` }} />
        : <span className="text-lg font-black" style={{ color: `hsl(${hash} 45% 42%)` }}>
            {name.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase() || 'CF'}
          </span>}
    </span>
  )
}

export { ProgressRing, MoreLink }
