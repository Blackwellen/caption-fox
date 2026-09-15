import Link from 'next/link'
import { ArrowLeft, CheckCircle2, Circle, FileText, ShieldAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BrandContext } from '@/lib/brand-assets/context'
import { can } from '@/lib/brand-assets/entitlements'
import type {
  ActivityPageData, AssetDetail, KitDetail, LicenseDetail, ProductDetail,
} from '@/lib/brand-assets/detail-queries'
import type { BrandActivityItem } from '@/types/brand-assets'
import { EmptyPanel, Pagination, Panel, StatusBadge } from '../ui/primitives'
import { Avatar } from '../shell/BrandAssetsShell'
import { AssetThumb, BrandLogo, fontPair } from './OverviewPage'
import KitCommentForm from '../client/KitCommentForm'
import { CopyLinkButton } from '../client/KitTransfer'
import {
  AssetApprovalActions, DownloadButton, KitApprovalActions, ProductStatusActions, UnlinkButton, UsageRequestForm,
} from '../client/DetailActions'
import { LicenseRowActions, UploadAgreementDialog } from '../client/RightsClient'
import { LinkAssetsDialog } from '../client/ProductClient'
import { formatBytes, formatDaysLeft, formatRelativeShort, formatUkDate, humanise } from '../tokens'

// ---------------------------------------------------------------------------
// Shared detail chrome: back link, record header, tab row (URL ?tab=).
// ---------------------------------------------------------------------------

function DetailHeader({ back, backLabel, title, subtitle, media, badges, actions }: {
  back: string; backLabel: string; title: string; subtitle?: string; media?: React.ReactNode; badges?: React.ReactNode; actions?: React.ReactNode
}) {
  return (
    <>
      <Link href={back} className="mb-3 inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-500 hover:text-slate-800"><ArrowLeft size={14} />{backLabel}</Link>
      <header className="mb-4 flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:flex-row sm:items-center">
        {media && <div className="h-20 w-28 shrink-0 overflow-hidden rounded-lg bg-slate-100">{media}</div>}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[22px] font-bold tracking-tight text-slate-900">{title}</h1>
          {subtitle && <p className="mt-0.5 text-[13px] text-slate-500">{subtitle}</p>}
          {badges && <div className="mt-2 flex flex-wrap gap-1.5">{badges}</div>}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </header>
    </>
  )
}

function Tabs({ href, tabs, active }: { href: string; tabs: [string, string][]; active: string }) {
  return (
    <nav aria-label="Record sections" className="mb-4 overflow-x-auto border-b border-slate-200 [scrollbar-width:none]">
      <div className="flex min-w-max gap-1">
        {tabs.map(([key, label]) => (
          <Link key={key} href={key === tabs[0][0] ? href : `${href}?tab=${key}`} scroll={false} aria-current={active === key ? 'page' : undefined}
            className={cn('border-b-2 px-3 pb-2.5 text-[13px]', active === key ? 'border-blue-600 font-semibold text-blue-600' : 'border-transparent font-medium text-slate-500 hover:text-slate-800')}>
            {label}
          </Link>
        ))}
      </div>
    </nav>
  )
}

function Facts({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 px-4 pb-4 sm:grid-cols-2">
      {rows.map(([k, v]) => <div key={k}><dt className="text-[11px] text-slate-400">{k}</dt><dd className="mt-0.5 text-[13px] text-slate-800">{v ?? '—'}</dd></div>)}
    </dl>
  )
}

function ActivityList({ items }: { items: BrandActivityItem[] }) {
  if (items.length === 0) return <EmptyPanel title="No activity yet" body="Changes to this record appear here." />
  return (
    <ol className="divide-y divide-slate-100">
      {items.map(a => (
        <li key={a.id} className="flex items-start gap-3 px-4 py-2.5">
          <Avatar name={a.actor?.full_name ?? 'System'} src={a.actor?.avatar_url} size={26} />
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] text-slate-800"><span className="font-semibold">{a.actor?.full_name ?? 'System'}</span> · {a.summary}</p>
            {typeof a.metadata?.detail === 'string' && <p className="text-[11.5px] text-slate-500">{a.metadata.detail}</p>}
          </div>
          <time className="shrink-0 text-[11px] text-slate-400" dateTime={a.created_at} title={formatUkDate(a.created_at)}>{formatRelativeShort(a.created_at)}</time>
        </li>
      ))}
    </ol>
  )
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

// ===========================================================================
// Brand Kit
// ===========================================================================
export function KitDetailPage({ ctx, data, tab }: { ctx: BrandContext; data: KitDetail; tab?: string }) {
  const base = `${ctx.basePath}/brand`
  const { kit } = data.system
  const href = `${base}/kits/${kit.id}`
  const e = ctx.entitlements
  const TABS: [string, string][] = [['overview', 'Overview'], ['colours', 'Colours'], ['typography', 'Typography'], ['logos', 'Logos'], ['templates', 'Templates'], ['guidelines', 'Guidelines'], ['approvals', 'Approvals'], ['comments', 'Comments'], ['versions', 'Versions'], ['share', 'Share'], ['activity', 'Activity']]
  const active = TABS.some(t => t[0] === tab) ? tab! : 'overview'
  return (
    <>
      <DetailHeader back={`${base}/kits`} backLabel="Brand Kits" title={kit.name}
        subtitle={`${kit.brand?.name ?? 'Brand'} · ${kit.team_name ?? 'No team'} · v${kit.current_version}${kit.published_version ? ` (published v${kit.published_version})` : ''}`}
        media={<span className="flex h-full items-center justify-center bg-white p-2"><BrandLogo name={kit.brand?.name ?? kit.name} url={kit.brand?.logo_url ?? null} className="max-h-14 max-w-full" /></span>}
        badges={<><StatusBadge status={kit.status} /><StatusBadge status={kit.approval_status === 'none' ? 'draft' : kit.approval_status} label={kit.approval_status === 'none' ? 'Not submitted' : humanise(kit.approval_status)} /></>} />
      <Tabs href={href} tabs={TABS} active={active} />

      {active === 'overview' && (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <Panel title="Summary"><Facts rows={[['Brand', kit.brand?.name], ['Owner', kit.owner?.full_name], ['Team', kit.team_name], ['Typography', fontPair(kit)],
            ['Linked assets', data.system.linkedTotal], ['Templates', kit.template_count], ['Consistency score', kit.consistency_score !== null ? `${Math.round(Number(kit.consistency_score))}%` : '—'], ['Updated', formatUkDate(kit.updated_at)]]} />
            {kit.description && <p className="px-4 pb-4 text-[13px] text-slate-600">{kit.description}</p>}
          </Panel>
          <Panel title="Palette"><div className="grid grid-cols-5 gap-2 px-4 pb-4">{kit.colours.map(c => (
            <div key={c.id} className="text-center"><span className="mb-1 block h-12 rounded-md ring-1 ring-inset ring-slate-900/10" style={{ background: c.hex }} /><span className="block truncate text-[10.5px] text-slate-700">{c.name}</span><span className="block text-[10px] uppercase text-slate-400">{c.hex}</span></div>
          ))}</div></Panel>
        </div>
      )}
      {active === 'colours' && <Panel title="Colour palette"><ul className="divide-y divide-slate-100">{kit.colours.map(c => (
        <li key={c.id} className="flex items-center gap-3 px-4 py-2.5"><span className="h-9 w-9 rounded-md ring-1 ring-inset ring-slate-900/10" style={{ background: c.hex }} /><span className="flex-1 text-[13px] font-medium text-slate-800">{c.name}</span><span className="font-mono text-[12px] uppercase text-slate-500">{c.hex}</span><span className="w-24 text-right text-[12px] capitalize text-slate-500">{c.role}</span></li>
      ))}</ul></Panel>}
      {active === 'typography' && <Panel title="Typography scale"><ul className="divide-y divide-slate-100">{kit.typography.map(t => (
        <li key={t.id} className="grid grid-cols-[1fr_1fr_auto] items-baseline gap-3 px-4 py-2.5"><span style={{ fontFamily: t.font_family, fontSize: Math.min(28, Number(t.font_size_px ?? 16)) }} className="truncate text-slate-900">{t.style_name}</span><span className="text-[12px] text-slate-500">{t.font_family} {t.font_weight}</span><span className="text-[12px] tabular-nums text-slate-500">{t.font_size_px ?? '—'} / {t.line_height_px ?? '—'}</span></li>
      ))}</ul></Panel>}
      {active === 'logos' && <Panel title="Logo lockups">{data.system.logos.length === 0 ? <EmptyPanel title="No lockups" body="Lockups recorded for this kit appear here." /> : (
        <div className="grid gap-3 px-4 pb-4 sm:grid-cols-2 lg:grid-cols-4">{data.system.logos.map(l => (
          <div key={l.id} className={cn('flex h-28 flex-col items-center justify-center rounded-lg border border-slate-200', l.background === 'dark' ? 'bg-slate-900' : 'bg-slate-50')}>
            <BrandLogo name={kit.brand?.name ?? kit.name} url={kit.brand?.logo_url ?? null} className="max-h-12 max-w-[80%]" />
            <span className={cn('mt-2 text-[11px]', l.background === 'dark' ? 'text-slate-300' : 'text-slate-500')}>{l.label}</span>
          </div>
        ))}</div>)}</Panel>}
      {active === 'templates' && <Panel title="Templates">{data.system.templates.length === 0 ? <EmptyPanel title="No templates" body="Templates in this kit appear here." /> : (
        <ul className="divide-y divide-slate-100">{data.system.templates.map(t => <li key={t.id} className="flex items-center justify-between px-4 py-2.5 text-[13px]"><span className="font-medium text-slate-800">{t.name}</span><span className="text-slate-500">{humanise(t.template_type)} · {t.dimensions ?? '—'}</span></li>)}</ul>)}</Panel>}
      {active === 'guidelines' && <Panel title="Guidelines & standards">{data.system.documents.length === 0 ? <EmptyPanel title="No guideline documents" body="Attached guideline PDFs appear here." /> : (
        <ul className="divide-y divide-slate-100">{data.system.documents.map(d => <li key={d.id} className="flex items-center gap-3 px-4 py-2.5"><FileText size={16} className="text-rose-500" /><span className="flex-1 text-[13px] font-medium text-slate-800">{d.title}</span><span className="text-[12px] text-slate-500">{d.version_label ?? ''}{d.file_size ? ` · ${formatBytes(d.file_size)}` : ''}</span></li>)}</ul>)}
        {data.system.tone?.statement && <div className="border-t border-slate-100 p-4"><p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Tone of voice</p><p className="text-[13px] text-slate-700">{data.system.tone.statement}</p></div>}
      </Panel>}
      {active === 'approvals' && <Panel title="Approval workflow"><div className="px-4 pb-4">
        <p className="mb-3 text-[13px] text-slate-600">Current state: <strong>{kit.approval_status === 'none' ? 'Not submitted' : humanise(kit.approval_status)}</strong>. Publishing makes the current version the one teams use.</p>
        <KitApprovalActions workspaceType={ctx.basePath.slice(1)} kitId={kit.id} approval={kit.approval_status} archived={kit.status === 'archived'}
          canSubmit={can(e, 'brand.kits.edit')} canApprove={can(e, 'brand.kits.approve')} canArchive={can(e, 'brand.kits.edit')} />
      </div></Panel>}
      {active === 'comments' && <Panel title="Team comments">
        {data.comments.length === 0 ? <p className="px-4 pb-3 text-[13px] text-slate-500">No comments yet.</p> : (
          <ul className="divide-y divide-slate-100">{data.comments.map(c => (
            <li key={c.id} className="flex gap-3 px-4 py-2.5"><Avatar name={c.author?.full_name ?? '—'} src={c.author?.avatar_url} size={28} /><div className="min-w-0 flex-1"><p className="text-[12.5px] font-semibold text-slate-800">{c.author?.full_name ?? 'Unknown'} <span className="font-normal text-slate-400">· {formatRelativeShort(c.created_at)}</span></p><p className="text-[13px] text-slate-600">{c.body}</p></div></li>
          ))}</ul>)}
        <div className="pt-3"><KitCommentForm workspaceType={ctx.basePath.slice(1)} kitId={kit.id} kitName={kit.name} /></div>
      </Panel>}
      {active === 'versions' && <Panel title="Version history"><ol className="divide-y divide-slate-100">{data.versions.map(v => (
        <li key={v.id} className="flex items-center gap-3 px-4 py-2.5"><span className="w-10 text-[13px] font-semibold text-slate-800">v{v.version}</span><span className="flex-1 text-[13px] text-slate-600">{v.change_summary ?? '—'}</span><StatusBadge status={v.status} size="xs" /><span className="w-28 text-right text-[12px] text-slate-400">{formatUkDate(v.published_at ?? v.created_at)}</span></li>
      ))}</ol></Panel>}
      {active === 'share' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Share with your team">
            <div className="space-y-3 px-4 pb-4 text-[13px] text-slate-600">
              <p>Anyone who is a member of this workspace can open this kit. Access is enforced by workspace permissions, so the link shows nothing to people outside the workspace.</p>
              {can(e, 'brand.kits.share')
                ? <CopyLinkButton path={href} />
                : <p className="text-[12px] text-slate-500">Your role does not permit sharing kits.</p>}
            </div>
          </Panel>
          <Panel title="Download or move this kit">
            <div className="space-y-3 px-4 pb-4 text-[13px] text-slate-600">
              <p>Download the brand system (colours, typography and tone of voice) as a <code className="rounded bg-slate-100 px-1">.brandkit.json</code> file. Use <strong>Import Kit</strong> to bring it into another workspace or restore it later. Downloads are recorded in the activity log.</p>
              {can(e, 'brand.kits.export')
                ? <a href={`${href}/export`} download className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-4 text-[12.5px] font-semibold text-white hover:bg-blue-700">Download brand kit</a>
                : <p className="text-[12px] text-slate-500">Your role does not permit exporting kits.</p>}
            </div>
          </Panel>
        </div>
      )}
      {active === 'activity' && <Panel title="Activity"><ActivityList items={data.activity} /></Panel>}
    </>
  )
}

// ===========================================================================
// Asset
// ===========================================================================
export function AssetDetailPage({ ctx, data, tab }: { ctx: BrandContext; data: AssetDetail; tab?: string }) {
  const base = `${ctx.basePath}/brand`
  const a = data.asset
  const href = `${base}/assets/${a.id}`
  const e = ctx.entitlements
  const workspaceType = ctx.basePath.slice(1)
  const TABS: [string, string][] = [['overview', 'Overview'], ['rights', 'Rights'], ['approvals', 'Approvals'], ['usage', 'Usage'], ['products', 'Linked Products'], ['versions', 'Versions'], ['activity', 'Activity']]
  const active = TABS.some(t => t[0] === tab) ? tab! : 'overview'
  const pending = data.approvals.find(x => x.status === 'pending')
  return (
    <>
      <DetailHeader back={`${base}/assets`} backLabel="Assets" title={a.file_name}
        subtitle={`${(a.file_type ?? '').toUpperCase()} · ${formatBytes(a.file_size)} · ${a.brand?.name ?? 'Unassigned'} · v${a.version_no}`}
        media={<AssetThumb name={a.file_name} kind={a.asset_kind} url={a.thumbnail_path} />}
        badges={<><StatusBadge status={a.approval_status} /><StatusBadge status={a.rights_state} />{a.scan_state !== 'clean' && <StatusBadge status="pending" label={`Scan ${a.scan_state}`} />}</>}
        actions={can(e, 'brand.assets.download') ? <DownloadButton workspaceType={workspaceType} assetId={a.id} /> : undefined} />
      {data.conflicts.length > 0 && (
        <div role="alert" className="mb-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-800">
          <ShieldAlert size={16} className="mt-0.5 shrink-0" /><div>{data.conflicts.map(c => <p key={c.id}><strong className="capitalize">{c.severity}</strong> — {c.detail}</p>)}</div>
        </div>
      )}
      <Tabs href={href} tabs={TABS} active={active} />

      {active === 'overview' && (
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <Panel><div className="aspect-[16/10] overflow-hidden rounded-t-xl bg-slate-100"><AssetThumb name={a.file_name} kind={a.asset_kind} url={a.thumbnail_path} /></div></Panel>
          <Panel title="Details"><Facts rows={[['Owner', a.owner?.full_name], ['Brand', a.brand?.name], ['Folder', data.folder], ['Usage scope', a.usage_scope],
            ['Added', formatUkDate(a.created_at)], ['Rights expire', formatUkDate(a.expires_at)], ['Downloads', data.downloads], ['Tags', a.tags?.length ? a.tags.join(', ') : '—']]} /></Panel>
        </div>
      )}
      {active === 'rights' && <Panel title="Licences covering this asset">{data.licenses.length === 0 ? <EmptyPanel title="No licence recorded" body="Add a licence to record where and until when this asset may be used." action={can(e, 'brand.rights.create') ? 'Add License' : undefined} actionHref={`${base}/rights/new`} /> : (
        <ul className="divide-y divide-slate-100">{data.licenses.map(l => { const d = formatDaysLeft(l.days_remaining); return (
          <li key={l.id}><Link href={`${base}/rights/${l.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50"><span className="flex-1"><span className="block text-[13px] font-medium text-slate-800">{l.name}</span><span className="block text-[12px] text-slate-500">{l.territories.map(t => t.name).join(', ') || '—'} · {l.channels.map(c => c.name).join(', ') || '—'}</span></span><span className={cn('text-[12px] font-medium', d.tone)}>{d.label}</span><StatusBadge status={l.status} size="xs" /></Link></li>
        ) })}</ul>)}</Panel>}
      {active === 'approvals' && <Panel title="Approvals">
        {pending && can(e, 'brand.assets.approve') && <div className="border-b border-slate-100 px-4 pb-4"><p className="text-[13px] text-slate-600">Awaiting review since {formatUkDate(pending.created_at)} · {humanise(pending.priority)} priority</p><AssetApprovalActions workspaceType={workspaceType} approvalId={pending.id} /></div>}
        {data.approvals.length === 0 ? <EmptyPanel title="Never submitted" body="Send this asset for approval from the Assets library menu." /> : (
          <ul className="divide-y divide-slate-100">{data.approvals.map(x => <li key={x.id} className="flex items-center gap-3 px-4 py-2.5 text-[13px]"><StatusBadge status={x.status} size="xs" /><span className="flex-1 text-slate-600">{x.note ?? '—'}</span><span className="text-[12px] text-slate-400">{formatUkDate(x.decided_at ?? x.created_at)}</span></li>)}</ul>)}
      </Panel>}
      {active === 'usage' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Usage requests">{data.usage.length === 0 ? <EmptyPanel title="No usage requests" body="Requests to use this asset appear here." /> : (
            <ul className="divide-y divide-slate-100">{data.usage.map(u => <li key={u.id} className="px-4 py-2.5"><div className="flex items-center justify-between"><span className="text-[13px] text-slate-800">{u.purpose}</span><StatusBadge status={u.status} size="xs" /></div><p className="text-[12px] text-slate-500">{formatUkDate(u.starts_on)} – {formatUkDate(u.ends_on)} · {u.channels.join(', ') || 'Any channel'}</p></li>)}</ul>)}</Panel>
          {can(e, 'brand.usage_requests.create') && <Panel title="Request usage"><div className="px-4 pb-4"><UsageRequestForm workspaceType={workspaceType} assetId={a.id} territories={data.territories} channels={data.channels} /></div></Panel>}
        </div>
      )}
      {active === 'products' && <Panel title="Linked products">{data.products.length === 0 ? <EmptyPanel title="Not linked to a product" body="Link this asset from a product page." /> : (
        <ul className="divide-y divide-slate-100">{data.products.map(p => <li key={`${p.id}-${p.link_type}`}><Link href={`${base}/products/${p.id}`} className="flex items-center justify-between px-4 py-2.5 text-[13px] hover:bg-slate-50"><span className="font-medium text-slate-800">{p.name} <span className="font-normal text-slate-400">· {p.sku}</span></span><span className="text-slate-500">{humanise(p.link_type)}</span></Link></li>)}</ul>)}</Panel>}
      {active === 'versions' && <Panel title="Version history"><ol className="divide-y divide-slate-100">
        <li className="flex items-center gap-3 px-4 py-2.5 text-[13px]"><span className="w-10 font-semibold text-slate-800">v{a.version_no}</span><span className="flex-1 text-slate-600">Current version</span><span className="text-slate-400">{formatBytes(a.file_size)}</span></li>
        {data.versions.map(v => <li key={v.id} className="flex items-center gap-3 px-4 py-2.5 text-[13px]"><span className="w-10 font-semibold text-slate-800">v{v.version_no}</span><span className="flex-1 text-slate-600">{v.change_summary ?? '—'}</span><span className="text-slate-400">{formatUkDate(v.created_at)}</span></li>)}
      </ol></Panel>}
      {active === 'activity' && <Panel title="Activity"><ActivityList items={data.activity} /></Panel>}
    </>
  )
}

// ===========================================================================
// Licence
// ===========================================================================
export function LicenseDetailPage({ ctx, data, tab }: { ctx: BrandContext; data: LicenseDetail; tab?: string }) {
  const base = `${ctx.basePath}/brand`
  const l = data.license
  const href = `${base}/rights/${l.id}`
  const e = ctx.entitlements
  const d = formatDaysLeft(l.days_remaining)
  const TABS: [string, string][] = [['overview', 'Overview'], ['agreements', 'Agreements'], ['renewals', 'Renewals'], ['activity', 'Activity']]
  const active = TABS.some(t => t[0] === tab) ? tab! : 'overview'
  return (
    <>
      <DetailHeader back={`${base}/rights`} backLabel="Rights" title={l.name} subtitle={`${humanise(l.license_type)} licence${l.reference ? ` · ${l.reference}` : ''}`}
        media={l.asset ? <AssetThumb name={l.name} kind={l.asset.asset_kind} url={l.asset.thumbnail_path} /> : undefined}
        badges={<><StatusBadge status={l.status} />{l.risk_level && <StatusBadge status={l.risk_level} label={`${humanise(l.risk_level)} risk`} />}<span className={cn('text-[12px] font-medium', d.tone)}>{d.label}</span></>}
        actions={<LicenseRowActions workspaceType={ctx.basePath.slice(1)} licenseId={l.id} name={l.name} status={l.status} expiresOn={l.expires_on} href={href}
          canRenew={can(e, 'brand.rights.renew')} canRestrict={can(e, 'brand.rights.restrict')} canEdit={can(e, 'brand.rights.edit')} />} />
      {data.conflicts.length > 0 && <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-800">{data.conflicts.map(c => <p key={c.id}><strong className="capitalize">{c.severity}</strong> — {c.detail}</p>)}</div>}
      <Tabs href={href} tabs={TABS} active={active} />
      {active === 'overview' && <Panel title="Terms"><Facts rows={[
        ['Asset', l.asset ? <Link href={`${base}/assets/${l.asset.id}`} className="text-blue-600 hover:underline">{l.asset.file_name}</Link> : '—'],
        ['Product', l.product ? <Link href={`${base}/products/${l.product.id}`} className="text-blue-600 hover:underline">{l.product.name}</Link> : '—'],
        ['Licensor', l.licensor], ['Licensee', l.licensee], ['Territories', l.territories.map(t => t.name).join(', ') || '—'], ['Channels', l.channels.map(c => c.name).join(', ') || '—'],
        ['Start', formatUkDate(l.starts_on)], ['Expiry', formatUkDate(l.expires_on)], ['Renewal due', formatUkDate(l.renewal_due_on)], ['Usage scope', l.usage_scope],
        ['Exclusive', l.exclusivity ? 'Yes' : 'No'], ['Modification allowed', l.modification_allowed ? 'Yes' : 'No'], ['Owner', l.owner?.full_name],
      ]} />{l.notes && <p className="border-t border-slate-100 px-4 py-3 text-[13px] text-slate-600">{l.notes}</p>}</Panel>}
      {active === 'agreements' && <Panel title="Signed agreements" action={can(e, 'brand.rights.edit') ? 'Upload agreement' : undefined} actionHref={`${href}?tab=agreements&uploadAgreement=1&license=${l.id}`}>
        {data.agreements.length === 0 ? <EmptyPanel title="No agreement on file" body="Upload the signed agreement so this licence is evidenced." /> : (
          <ul className="divide-y divide-slate-100">{data.agreements.map(g => <li key={g.id} className="flex items-center gap-3 px-4 py-2.5"><FileText size={16} className="text-rose-500" /><span className="flex-1 text-[13px] font-medium text-slate-800">{g.title}</span><span className="text-[12px] text-slate-500">Signed {formatUkDate(g.signed_on)}</span>{g.asset_id && <Link href={`${base}/assets/${g.asset_id}`} className="text-[12px] font-medium text-blue-600 hover:underline">Open</Link>}</li>)}</ul>)}
        <UploadAgreementDialog workspaceType={ctx.basePath.slice(1)} licences={[{ id: l.id, name: l.name }]} />
      </Panel>}
      {active === 'renewals' && <Panel title="Renewals">{data.renewals.length === 0 ? <EmptyPanel title="No renewals" body="Renewal tasks are created as the licence approaches expiry." /> : (
        <ul className="divide-y divide-slate-100">{data.renewals.map(r => <li key={r.id} className="flex items-center gap-3 px-4 py-2.5 text-[13px]"><span className="w-28 text-slate-700">Due {formatUkDate(r.due_on)}</span><span className="flex-1 text-slate-500">{r.new_terms ?? '—'}</span><StatusBadge status={r.status} size="xs" /></li>)}</ul>)}</Panel>}
      {active === 'activity' && <Panel title="Activity"><ActivityList items={data.activity} /></Panel>}
    </>
  )
}

// ===========================================================================
// Product
// ===========================================================================
export function ProductDetailPage({ ctx, data, tab }: { ctx: BrandContext; data: ProductDetail; tab?: string }) {
  const base = `${ctx.basePath}/brand`
  const p = data.product
  const href = `${base}/products/${p.id}`
  const e = ctx.entitlements
  const workspaceType = ctx.basePath.slice(1)
  const TABS: [string, string][] = [['overview', 'Overview'], ['assets', 'Assets'], ['readiness', 'Campaign Readiness'], ['variants', 'SKUs & Variants'], ['rights', 'Rights'], ['activity', 'Activity']]
  const active = TABS.some(t => t[0] === tab) ? tab! : 'overview'
  const score = Math.round(Number(p.readiness_score))
  return (
    <>
      <DetailHeader back={`${base}/products`} backLabel="Product Library" title={p.name} subtitle={`${p.sku} · ${p.category_name ?? 'Uncategorised'} · ${p.brand?.name ?? 'No brand'}`}
        media={<AssetThumb name={p.name} kind="image" url={p.primary_asset?.thumbnail_path ?? null} />}
        badges={<><StatusBadge status={p.status} /><StatusBadge status={p.readiness_state} label={`Campaign ready ${score}%`} /></>}
        actions={<ProductStatusActions workspaceType={workspaceType} productId={p.id} status={p.status} canEdit={can(e, 'brand.products.edit')} canApprove={can(e, 'brand.products.approve')} canArchive={can(e, 'brand.products.archive')} />} />
      <Tabs href={href} tabs={TABS} active={active} />
      {active === 'overview' && <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Panel title="Details"><Facts rows={[['SKU', p.sku], ['Brand', p.brand?.name], ['Category', p.category_name], ['Product line', p.product_line], ['Markets', p.markets.join(', ') || '—'], ['Linked assets', p.linked_asset_count], ['Owner', p.owner?.full_name], ['Updated', formatUkDate(p.updated_at)]]} />
          {p.description && <p className="border-t border-slate-100 px-4 py-3 text-[13px] text-slate-600">{p.description}</p>}</Panel>
        <Panel title="Readiness"><ReadinessList checks={data.checks} /></Panel>
      </div>}
      {active === 'assets' && <Panel title="Linked assets" action={can(e, 'brand.products.edit') ? 'Link assets' : undefined} actionHref={`${href}?tab=assets&link=1&product=${p.id}`}>
        {data.assets.length === 0 ? <EmptyPanel title="No assets linked" body="Link packshots, lifestyle imagery and video to raise campaign readiness." /> : (
          <ul className="grid gap-3 px-4 pb-4 sm:grid-cols-2 lg:grid-cols-4">{data.assets.map(a => (
            <li key={`${a.id}-${a.link_type}`} className="overflow-hidden rounded-lg border border-slate-200">
              <Link href={`${base}/assets/${a.id}`} className="block aspect-[4/3] bg-slate-100"><AssetThumb name={a.file_name} kind={a.asset_kind} url={a.thumbnail_path} /></Link>
              <div className="flex items-center gap-2 p-2"><span className="min-w-0 flex-1"><span className="block truncate text-[12px] font-medium text-slate-800">{a.file_name}</span><span className="block text-[11px] text-slate-500">{humanise(a.link_type)}</span></span>
                {can(e, 'brand.products.edit') && <UnlinkButton workspaceType={workspaceType} productId={p.id} assetId={a.id} name={a.file_name} />}</div>
            </li>
          ))}</ul>)}
        <LinkAssetsDialog workspaceType={workspaceType} products={[{ id: p.id, name: p.name, sku: p.sku }]} assets={data.linkable} />
      </Panel>}
      {active === 'readiness' && <Panel title={`Campaign readiness · ${score}%`}><p className="px-4 pb-2 text-[12.5px] text-slate-500">Each check is weighted; the score is the weighted share passed. 90%+ is ready, 60%+ needs review.</p><ReadinessList checks={data.checks} /></Panel>}
      {active === 'variants' && <Panel title="SKUs & variants">{data.variants.length === 0 ? <EmptyPanel title="No variants" body="Variants of this product appear here." /> : (
        <ul className="divide-y divide-slate-100">{data.variants.map(v => <li key={v.id} className="flex items-center gap-3 px-4 py-2.5 text-[13px]"><span className="w-40 font-mono text-slate-700">{v.sku}</span><span className="flex-1 text-slate-600">{v.name}</span><StatusBadge status={v.status} size="xs" /></li>)}</ul>)}</Panel>}
      {active === 'rights' && <Panel title="Licences">{data.licenses.length === 0 ? <EmptyPanel title="No product licence" body="Licences recorded against this product appear here." /> : (
        <ul className="divide-y divide-slate-100">{data.licenses.map(l => <li key={l.id}><Link href={`${base}/rights/${l.id}`} className="flex items-center justify-between px-4 py-2.5 text-[13px] hover:bg-slate-50"><span className="font-medium text-slate-800">{l.name}</span><StatusBadge status={l.status} size="xs" /></Link></li>)}</ul>)}</Panel>}
      {active === 'activity' && <Panel title="Activity"><ActivityList items={data.activity} /></Panel>}
    </>
  )
}

function ReadinessList({ checks }: { checks: ProductDetail['checks'] }) {
  if (checks.length === 0) return <EmptyPanel title="Not yet evaluated" body="Readiness is calculated when assets are linked." />
  return (
    <ul className="divide-y divide-slate-100 pb-2">
      {checks.map(c => (
        <li key={c.check_key} className="flex items-center gap-2.5 px-4 py-2 text-[13px]">
          {c.passed ? <CheckCircle2 size={15} className="text-emerald-600" aria-label="Passed" /> : <Circle size={15} className="text-rose-400" aria-label="Missing" />}
          <span className={cn('flex-1', c.passed ? 'text-slate-700' : 'text-slate-900')}>{c.label}</span>
          <span className="text-[11px] text-slate-400">weight {c.weight}</span>
        </li>
      ))}
    </ul>
  )
}

// ===========================================================================
// Activity log
// ===========================================================================
export function ActivityPage({ ctx, data, type, page }: { ctx: BrandContext; data: ActivityPageData; type: string | null; page: number }) {
  const base = `${ctx.basePath}/brand`
  const TYPES: [string | null, string][] = [[null, 'All'], ['brand_kit', 'Brand Kits'], ['asset', 'Assets'], ['license', 'Rights'], ['product', 'Products'], ['approval', 'Approvals']]
  const hrefFor = (patch: Record<string, string | number | null>) => {
    const sp = new URLSearchParams(); const t = 'type' in patch ? patch.type : type; const pg = 'page' in patch ? patch.page : page
    if (t) sp.set('type', String(t)); if (pg && Number(pg) > 1) sp.set('page', String(pg))
    return `${base}/activity${sp.toString() ? `?${sp}` : ''}`
  }
  return (
    <>
      <Link href={base} className="mb-3 inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-500 hover:text-slate-800"><ArrowLeft size={14} />Overview</Link>
      <h1 className="mb-1 text-[26px] font-bold tracking-tight text-slate-900">Brand activity</h1>
      <p className="mb-4 text-[13px] text-slate-500">Every change across brand kits, assets, rights and products in this workspace.</p>
      <div className="mb-4 flex flex-wrap gap-1.5">{TYPES.map(([v, l]) => (
        <Link key={l} href={hrefFor({ type: v, page: 1 })} aria-current={type === v ? 'true' : undefined}
          className={cn('rounded-full border px-3 py-1 text-[12px]', type === v ? 'border-blue-300 bg-blue-50 font-medium text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50')}>{l}</Link>
      ))}</div>
      <Panel><ActivityList items={data.items} /><Pagination page={page} pageSize={25} total={data.total} hrefFor={p => hrefFor({ page: Number(p.page) })} /></Panel>
    </>
  )
}

export { one }
