import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight, CircleCheck, CircleAlert, ExternalLink, Globe, Link2, Lightbulb, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { compact, dateTime, percent, shortDate } from '@/lib/link-in-bio/format'
import { loadPageDetail, type PageDetail } from '@/lib/link-in-bio/server/detail'
import { DEFAULT_TOKENS } from '@/lib/link-in-bio/theme'
import type { LinksSession } from '@/lib/link-in-bio/server/context'
import type { Params } from '@/lib/link-in-bio/server/collections'
import { Avatar, Breadcrumbs, Panel, PanelTitle, StatusBadge, TextLink } from '../ui'
import { DetailTabs, MetaItem } from '../detail/DetailChrome'
import PageActions, { PageTitle } from './PageActions'
import DesignWorkbench from './DesignWorkbench'
import ActivityFeed from './ActivityFeed'
import { AnalyticsTab, FormsTab, LinksTab, PixelsTab, ProductsTab, SettingsTab, VersionsTab } from './PageTabs'

export const PAGE_TAB_DEFS = [
  { id: 'design', label: 'Design' }, { id: 'links', label: 'Links' }, { id: 'products', label: 'Products' }, { id: 'forms', label: 'Forms' },
  { id: 'pixels', label: 'Pixels' }, { id: 'analytics', label: 'Analytics' }, { id: 'settings', label: 'Settings' }, { id: 'versions', label: 'Versions' },
]

export default async function PageDetailRoute({ session, pageId, tab, searchParams }: { session: LinksSession; pageId: string; tab: string; searchParams: Params }) {
  const detail = await loadPageDetail(session, pageId)
  if (!detail) notFound()
  const { page } = detail
  const base = session.basePath
  const tabBase = `${base}/pages/${page.id}`
  const caps = session.capabilities
  const archived = !!page.archivedAt
  const readOnlyReason = archived ? 'This page is archived and read-only. Restore it to make changes.' : !caps['pages.edit'] ? 'You have view-only access to this page.' : null
  const displayUrl = detail.publicHost ? `${detail.publicHost}/${page.slug}` : detail.publicPath.slice(1)
  const live = page.status === 'published' || page.status === 'scheduled'
  const hasUnpublishedChanges = page.currentVersion !== page.publishedVersion || new Date(page.updatedAt).getTime() > new Date(detail.versions.find(v => v.published)?.createdAt ?? 0).getTime() + 60_000

  return (
    <div>
      <Breadcrumbs items={[
        { label: session.workspace.name, href: `/${session.workspaceType}` }, { label: 'Link in Bio', href: base },
        { label: 'Link Library', href: `${base}/library` }, { label: page.title },
      ]} />
      <div className="mt-2.5 flex flex-wrap items-start justify-between gap-3">
        <PageTitle workspaceType={session.workspaceType} pageId={page.id} title={page.title} canEdit={!readOnlyReason} />
        <PageActions workspaceType={session.workspaceType} pageId={page.id} title={page.title} status={page.status} archived={archived} publicPath={detail.publicPath} base={base}
          hasUnpublishedChanges={hasUnpublishedChanges}
          caps={{ edit: caps['pages.edit'], publish: caps['pages.publish'], archive: caps['pages.archive'], create: caps['pages.create'] }} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-3">
        <span className="inline-flex h-7 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-[11px] font-medium text-slate-700">
          <Link2 size={13} className="text-violet-600" aria-hidden /> {page.kind === 'conversion_page' ? 'Conversion Page' : 'Link Page'}
        </span>
        <StatusBadge status={archived ? 'archived' : page.status} className="h-7 px-3" />
        <div className="flex items-center gap-2 text-[11px] text-slate-500">Owner <span className="inline-flex items-center gap-1.5 text-slate-800"><Avatar member={detail.owner} size={20} />{detail.owner?.name ?? 'Unassigned'}</span></div>
        <MetaItem label="Created">{shortDate(page.createdAt)}</MetaItem>
        <MetaItem label="Last updated">{shortDate(page.updatedAt)}{detail.updatedBy ? ` by ${detail.updatedBy.name}` : ''}</MetaItem>
        <MetaItem label="Published">{page.publishedAt ? shortDate(page.publishedAt) : 'Not published'}</MetaItem>
        <div className="flex h-8 min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-[11px] text-slate-600 xl:ml-2">
          <Globe size={13} className="shrink-0 text-slate-400" aria-hidden />
          <span className="truncate">{displayUrl}</span>
          {live && <a href={detail.publicPath} target="_blank" rel="noopener" className="ml-2 text-slate-500 hover:text-[#1a5cff]" aria-label="Open live page"><ExternalLink size={13} /></a>}
        </div>
      </div>

      {archived && (
        <p role="status" className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-600">
          Archived {shortDate(page.archivedAt)}. This page is read-only and not visible to visitors.
        </p>
      )}

      <div className="mt-4"><DetailTabs base={tabBase} tabs={PAGE_TAB_DEFS} ariaLabel="Link page sections" /></div>

      <div className="mt-4">
        {tab === 'design' && <DesignTab session={session} detail={detail} readOnlyReason={readOnlyReason} />}
        {tab === 'links' && <LinksTab session={session} detail={detail} readOnlyReason={readOnlyReason} searchParams={searchParams} />}
        {tab === 'products' && <ProductsTab session={session} detail={detail} readOnlyReason={readOnlyReason} />}
        {tab === 'forms' && <FormsTab session={session} detail={detail} readOnlyReason={readOnlyReason} />}
        {tab === 'pixels' && <PixelsTab session={session} detail={detail} readOnlyReason={readOnlyReason} />}
        {tab === 'analytics' && <AnalyticsTab session={session} detail={detail} />}
        {tab === 'settings' && <SettingsTab session={session} detail={detail} readOnlyReason={readOnlyReason} />}
        {tab === 'versions' && <VersionsTab session={session} detail={detail} />}
      </div>
    </div>
  )
}

function Delta({ value, unit }: { value: number | null; unit: 'pct' | 'pp' }) {
  if (value === null || !Number.isFinite(value) || value === 0) return null
  const up = value > 0
  return (
    <span className={cn('text-[10.5px] font-medium', up ? 'text-emerald-600' : 'text-red-500')}>
      <span aria-hidden>{up ? '▲' : '▼'}</span><span className="sr-only">{up ? 'up' : 'down'}</span> {Math.abs(value).toFixed(1)}{unit === 'pp' ? 'pp' : '%'}
    </span>
  )
}

function DesignTab({ session, detail, readOnlyReason }: { session: LinksSession; detail: PageDetail; readOnlyReason: string | null }) {
  const { page } = detail
  const base = session.basePath
  const tabBase = `${base}/pages/${page.id}`
  const publishedVersion = detail.versions.find(v => v.published)
  const failing = detail.governance.checks.filter(c => c.status === 'failed' || c.status === 'warning')

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_196px]">
        <DesignWorkbench
          workspaceType={session.workspaceType} pageId={page.id} kind={page.kind}
          page={{ title: page.title, description: page.description, legal: page.legal, showBranding: page.showBranding }}
          initialBlocks={detail.blocks} tokens={detail.theme?.tokens ?? DEFAULT_TOKENS}
          readOnly={!!readOnlyReason} readOnlyReason={readOnlyReason}
          lookups={{ products: detail.products, forms: detail.forms, reusableLinks: detail.reusableLinks }}
          livePath={page.status === 'published' || page.status === 'scheduled' ? detail.publicPath : null}
          capabilities={session.capabilities}
        />

        <Panel className="p-4" aria-label="Page summary">
          <PanelTitle title="Page summary" action={<TextLink href={`${tabBase}/settings`}>Edit</TextLink>} />
          <dl className="mt-3.5 space-y-4">
            <div>
              <dt className="text-[10px] text-slate-500">Total clicks <span className="text-slate-400">(30 days)</span></dt>
              <dd className="mt-1 flex items-baseline justify-between gap-2"><span className="text-[20px] font-semibold tracking-[-0.01em] text-slate-900 tabular-nums">{compact(detail.stats.clicks)}</span><Delta value={detail.stats.clicksDelta} unit="pct" /></dd>
            </div>
            <div>
              <dt className="text-[10px] text-slate-500">CTR</dt>
              <dd className="mt-1 flex items-baseline justify-between gap-2"><span className="text-[20px] font-semibold tracking-[-0.01em] text-slate-900 tabular-nums">{percent(detail.stats.ctr, 2)}</span><Delta value={detail.stats.ctrDelta} unit="pp" /></dd>
            </div>
            <div>
              <dt className="text-[10px] text-slate-500">Theme</dt>
              <dd className="mt-1 flex items-center gap-1.5 text-[11.5px] text-slate-800">
                {detail.theme ? <><span className="h-2.5 w-2.5 rounded-full" style={{ background: detail.theme.tokens.palette.primary === '#FFFFFF' ? detail.theme.tokens.palette.accent : detail.theme.tokens.palette.primary }} aria-hidden /><Link href={`${base}/themes/${detail.theme.id}/editor`} className="hover:text-[#1a5cff]">{detail.theme.name}</Link></> : <span className="text-slate-500">No theme</span>}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] text-slate-500">Custom domain</dt>
              <dd className="mt-1 flex items-center justify-between gap-2 text-[11.5px]">
                {detail.domain ? <><span className="truncate text-[#1a5cff]">{detail.domain.hostname}</span><StatusBadge status={detail.domain.status === 'verified' ? 'verified' : detail.domain.status} label={detail.domain.status === 'verified' ? 'Verified' : detail.domain.status === 'failed' ? 'Failed' : 'Pending'} /></> : <Link href={`${tabBase}/settings#domain`} className="text-slate-500 hover:text-[#1a5cff]">Hosted on Caption Fox</Link>}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] text-slate-500">Last published version</dt>
              <dd className="mt-1 flex items-center justify-between text-[11.5px] text-slate-800"><span>{publishedVersion ? publishedVersion.label : 'None'}</span><span className="text-[10.5px] text-slate-500">{publishedVersion ? shortDate(publishedVersion.createdAt) : ''}</span></dd>
            </div>
            <div>
              <dt className="text-[10px] text-slate-500">Governance status</dt>
              <dd className="mt-1">
                <Link href={`${tabBase}/settings#governance`} className="flex items-center justify-between gap-2 text-[11.5px]">
                  {detail.governance.passed && failing.length === 0
                    ? <><span className="flex items-center gap-1.5 font-medium text-slate-900"><CircleCheck size={15} className="text-emerald-500" aria-hidden />Compliant</span><span className="text-[10px] text-emerald-600">All checks passed</span></>
                    : <><span className="flex items-center gap-1.5 font-medium text-slate-900"><CircleAlert size={15} className={detail.governance.passed ? 'text-amber-500' : 'text-red-500'} aria-hidden />{detail.governance.passed ? 'Warnings' : 'Action needed'}</span><span className="text-[10px] text-slate-500">{failing.length} {failing.length === 1 ? 'check' : 'checks'}</span></>}
                </Link>
              </dd>
            </div>
            {detail.recommendation && (
              <div>
                <dt className="text-[10px] text-slate-500">Next recommended action</dt>
                <dd className="mt-1.5 flex gap-2">
                  <Lightbulb size={15} className="mt-0.5 shrink-0 text-orange-500" aria-hidden />
                  <div className="min-w-0 text-[11px]">
                    <p className="font-medium text-slate-900">{detail.recommendation.title}</p>
                    <p className="mt-0.5 text-[10.5px] text-slate-500">{detail.recommendation.detail}</p>
                    <Link href={detail.recommendation.href} className="mt-2 inline-flex h-7 items-center rounded-md border border-slate-200 px-2.5 text-[10.5px] font-medium text-[#1a5cff] hover:bg-slate-50">{detail.recommendation.cta}</Link>
                  </div>
                </dd>
              </div>
            )}
          </dl>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.5fr)_minmax(0,1.65fr)]">
        <Panel className="flex flex-col p-4" aria-label="Related records">
          <PanelTitle title="Related records" />
          {detail.related.length === 0 ? <p className="mt-3 text-[12px] text-slate-500">Link a campaign in Settings, or add products and forms to see them here.</p> : (
            <ul className="mt-3 space-y-2">
              {detail.related.slice(0, 4).map(record => (
                <li key={record.id}>
                  <Link href={record.href} className="flex items-center gap-2.5 rounded-lg border border-slate-100 p-1.5 pr-2 hover:bg-slate-50">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-slate-100 text-[10px] font-semibold text-slate-500">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {record.imageUrl ? <img src={record.imageUrl} alt="" className="h-full w-full object-cover" /> : record.kind.charAt(0)}
                    </span>
                    <span className="min-w-0 flex-1 text-[11px]"><span className="block truncate font-medium text-slate-900">{record.name}</span><span className="block text-[10px] text-slate-500">{record.kind} · {record.status.charAt(0).toUpperCase() + record.status.slice(1)}</span></span>
                    <ChevronRight size={14} className="text-slate-400" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link href={`${tabBase}/settings`} className="mt-auto inline-flex items-center justify-center gap-1 pt-3 text-[11px] font-medium text-[#1a5cff] hover:underline">Manage related <ArrowRight size={12} /></Link>
        </Panel>

        <ActivityFeed items={detail.activity.map(a => ({ id: a.id, actor: a.actor, summary: a.summary, badge: a.badge, createdAt: a.createdAt, action: a.action }))} viewAllHref={`${tabBase}/versions`} />

        <Panel className="p-4" aria-label="Material audit trail">
          <PanelTitle title="Material audit trail" hint="Every published, approved or restored version of this page." action={<TextLink href={`${tabBase}/versions`} className="inline-flex items-center gap-1">View full audit log <ArrowRight size={12} /></TextLink>} />
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-[10.5px]">
              <thead className="text-[9.5px] text-slate-500"><tr className="border-b border-slate-100">{['Version', 'Date', 'Published by', 'Changes', 'Status'].map(h => <th key={h} scope="col" className="py-1.5 pr-2 font-medium">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">
                {detail.versions.slice(0, 5).map((v, i) => (
                  <tr key={v.version}>
                    <td className="py-2.5 pr-2 font-medium text-slate-900">{v.label}{i === 0 && <span className="ml-1 font-normal text-emerald-600">(Latest)</span>}</td>
                    <td className="py-2.5 pr-2 text-slate-600">{shortDate(v.createdAt)}</td>
                    <td className="py-2.5 pr-2"><span className="inline-flex items-center gap-1.5 text-slate-700"><Avatar member={v.by} size={16} />{v.by?.name ?? 'System'}</span></td>
                    <td className="py-2.5 pr-2 text-slate-600">{v.changes}</td>
                    <td className="py-2.5"><StatusBadge status={v.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {detail.versions.length === 0 && <p className="py-3 text-[12px] text-slate-500">No versions yet.</p>}
          </div>
          <Link href={`${tabBase}/versions?compare=1`} className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-[#1a5cff] hover:underline">Compare versions</Link>
        </Panel>
      </div>
      <p className="sr-only">Last activity {detail.activity[0] ? dateTime(detail.activity[0].createdAt) : 'none'}</p>
    </div>
  )
}
