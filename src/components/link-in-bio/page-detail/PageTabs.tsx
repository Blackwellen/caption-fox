import type { PageDetail } from '@/lib/link-in-bio/server/detail'
import type { LinksSession } from '@/lib/link-in-bio/server/context'
import type { Params } from '@/lib/link-in-bio/server/collections'
import { compact, dateTime, percent } from '@/lib/link-in-bio/format'
import { Panel, PanelTitle, StatusBadge } from '../ui'
import { AddBlockButton, AddLinkForm, BlockSelect, BlockToggle, LinkRowActions, PixelActions, PixelForm, RestoreVersionButton, SettingsForm } from './PageTabsClient'

type Props = { session: LinksSession; detail: PageDetail; readOnlyReason?: string | null; searchParams?: Params }

export function LinksTab({ session, detail, readOnlyReason = null }: Props) {
  const blocks = detail.blocks.filter(block => block.type === 'links')
  return <Panel className="space-y-4 p-4">
    <PanelTitle title="Links" />
    <AddLinkForm workspaceType={session.workspaceType} pageId={detail.page.id} blocks={blocks.map(block => ({ id: block.id, label: block.title || 'Link list' }))} reusableLinks={detail.reusableLinks} disabledReason={readOnlyReason} />
    {blocks.flatMap(block => block.children.map(link => <div key={link.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 py-3">
      <div><p>{link.title}</p><p className="break-all text-sm text-slate-500">{link.url}</p></div>
      <LinkRowActions workspaceType={session.workspaceType} pageId={detail.page.id} blockId={block.id} link={link} disabled={!!readOnlyReason} />
    </div>))}
  </Panel>
}

function RecordBlocks({ session, detail, readOnlyReason = null, type }: Props & { type: 'product' | 'form' }) {
  const records = type === 'product' ? detail.products : detail.forms
  const label = type === 'product' ? 'Products' : 'Forms'
  const allowed = session.capabilities[type === 'product' ? 'products.manage' : 'forms.manage']
  const reason = readOnlyReason || (!allowed ? `You do not have permission to manage ${label.toLowerCase()}.` : null)
  const field = type === 'product' ? 'productId' : 'formId'
  const blocks = detail.blocks.filter(block => block.type === type)
  return <Panel className="space-y-4 p-4">
    <PanelTitle title={label} />
    <AddBlockButton workspaceType={session.workspaceType} pageId={detail.page.id} type={type} label={`Add ${type}`} disabledReason={reason} />
    {blocks.length === 0 && <p className="text-sm text-slate-500">No {label.toLowerCase()} added to this page.</p>}
    {blocks.map(block => <div key={block.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 py-3">
      <BlockSelect workspaceType={session.workspaceType} pageId={detail.page.id} blockId={block.id} field={field} value={typeof block.config[field] === 'string' ? block.config[field] as string : ''} options={records} label={`Choose ${type}`} disabled={!!reason} />
      <BlockToggle workspaceType={session.workspaceType} pageId={detail.page.id} blockId={block.id} active={block.isActive} disabled={!!reason} label={`Show ${block.title || type}`} />
    </div>)}
  </Panel>
}

export function ProductsTab(props: Props) { return <RecordBlocks {...props} type="product" /> }
export function FormsTab(props: Props) { return <RecordBlocks {...props} type="form" /> }

export function PixelsTab({ session, detail, readOnlyReason }: Props) {
  const canManage = !readOnlyReason && session.capabilities['pixels.manage']
  return <Panel className="space-y-4 p-4">
    <PanelTitle title="Tracking pixels" />
    {canManage && <PixelForm workspaceType={session.workspaceType} pageId={detail.page.id} existing={detail.pixels.map(pixel => pixel.provider)} />}
    {!detail.pixels.length && <p className="text-sm text-slate-500">No tracking pixels connected.</p>}
    {detail.pixels.map(pixel => <div key={pixel.provider} className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 py-3">
      <div><p>{pixel.provider}</p><p className="text-sm text-slate-500">{pixel.pixelId}</p></div>
      <StatusBadge status={pixel.approvalStatus} />
      <PixelActions workspaceType={session.workspaceType} pageId={detail.page.id} provider={pixel.provider} enabled={pixel.enabled} approved={pixel.approvalStatus === 'approved'} canManage={canManage} canApprove={!readOnlyReason && session.capabilities['pages.approve']} />
    </div>)}
  </Panel>
}

export function AnalyticsTab({ detail }: Props) {
  return <Panel className="space-y-4 p-4">
    <PanelTitle title="Page analytics — last 30 days" />
    <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {[['Views', compact(detail.stats.views)], ['Clicks', compact(detail.stats.clicks)], ['Click-through rate', percent(detail.stats.ctr)], ['Conversions', compact(detail.stats.conversions)]].map(([label, value]) => <div key={label}><dt className="text-sm text-slate-500">{label}</dt><dd className="font-semibold">{value}</dd></div>)}
    </dl>
    <div className="overflow-x-auto"><table className="w-full text-left text-sm">
      <thead><tr><th scope="col">Date</th><th scope="col">Views</th><th scope="col">Clicks</th><th scope="col">Conversions</th></tr></thead>
      <tbody>{detail.analytics.dailyFilled.map(day => <tr key={day.day}><th scope="row">{day.day}</th><td>{compact(day.views)}</td><td>{compact(day.clicks)}</td><td>{compact(day.conversions)}</td></tr>)}</tbody>
    </table></div>
  </Panel>
}

export function SettingsTab({ session, detail, readOnlyReason = null }: Props) {
  const page = detail.page
  // Do not silently turn an existing password-protected page into a private page.
  if (page.visibility === 'password') return <Panel className="p-4"><p>Password-protected page settings are not supported by this editor.</p></Panel>
  return <SettingsForm workspaceType={session.workspaceType} pageId={page.id} members={session.members} campaigns={detail.campaigns} themes={detail.themes} domains={detail.domains} disabledReason={readOnlyReason} canPublish={session.capabilities['pages.publish']} canDomains={session.capabilities['domains.manage']} initial={{
    title: page.title, slug: page.slug, description: page.description ?? '', ownerId: page.ownerId ?? '', goal: page.goal ?? '', campaignId: page.campaignId ?? '', themeId: page.themeId ?? '', tags: page.tags.join(', '),
    visibility: page.visibility, indexInSearch: page.indexInSearch, utmTracking: page.utmTracking, seoTitle: page.seoTitle ?? '', seoDescription: page.seoDescription ?? '', ogImage: page.ogImage ?? '',
    privacyUrl: page.legal.privacyUrl ?? '', termsUrl: page.legal.termsUrl ?? '', disclosure: page.legal.disclosure ?? '', consentBanner: !!page.consent.banner,
    scheduledPublishAt: page.scheduledPublishAt ?? '', scheduledUnpublishAt: page.scheduledUnpublishAt ?? '', domainId: page.domainId ?? '',
  }} />
}

export function VersionsTab({ session, detail }: Props) {
  const reason = detail.page.archivedAt ? 'Restore this page before restoring a version.' : !session.capabilities['versions.restore'] ? 'You do not have permission to restore versions.' : null
  return <Panel className="space-y-4 p-4">
    <PanelTitle title="Version history" />
    {!detail.versions.length && <p className="text-sm text-slate-500">No versions recorded yet.</p>}
    {detail.versions.map(version => <div key={version.version} className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 py-3">
      <div><p>{version.label} · {dateTime(version.createdAt)}</p><p className="text-sm text-slate-500">{version.changes}</p></div>
      <StatusBadge status={version.status} />
      <RestoreVersionButton workspaceType={session.workspaceType} pageId={detail.page.id} version={version.version} disabledReason={reason} />
    </div>)}
  </Panel>
}
