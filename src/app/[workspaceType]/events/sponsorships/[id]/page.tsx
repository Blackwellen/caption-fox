import Link from 'next/link'
import { notFound } from 'next/navigation'
import { DollarSign, FileText, Star } from 'lucide-react'
import EventsShell, { Avatar } from '@/components/events/EventsShell'
import { DetailBreadcrumb, DetailHeaderBar, DetailTabStrip } from '@/components/events/DetailHeader'
import { EventsEmptyState, EventsLockedState, KpiCard, KpiStrip, Panel, StatusBadge } from '@/components/events/primitives'
import { getEventsPageContext } from '@/lib/events/page-context'
import { getSponsorshipDeliverables, getSponsorshipDetail } from '@/lib/events/detail-queries'
import { formatCurrency, formatEventDate, titleCase } from '@/lib/events/format'

export const dynamic = 'force-dynamic'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'deliverables', label: 'Deliverables' },
  { id: 'payments', label: 'Payments' },
]

export default async function SponsorshipDetailPage({
  params, searchParams,
}: {
  params: Promise<{ workspaceType: string; id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { workspaceType, id } = await params
  const query = await searchParams
  const page = await getEventsPageContext(workspaceType, 'sponsorships')
  const { supabase, workspace } = page

  const sponsorship = await getSponsorshipDetail(supabase, workspace.id, id)
  if (!sponsorship) notFound()

  const activeTab = (Array.isArray(query.tab) ? query.tab[0] : query.tab) || 'overview'
  const tab = TABS.some(t => t.id === activeTab) ? activeTab : 'overview'
  const detailPath = `${page.basePath}/sponsorships/${id}`
  const showMoney = page.can('sponsorships.viewFinancials')

  const deliverables = await getSponsorshipDeliverables(supabase, workspace.id, id)
  const completed = deliverables.filter(d => ['completed', 'approved'].includes(d.status as string)).length

  return (
    <EventsShell
      basePath={page.basePath}
      activeTab="sponsorships"
      visibleTabs={page.visibleTabs}
      workspaces={page.workspaces}
      activeWorkspace={{ id: workspace.id, name: workspace.name, plan: workspace.plan }}
      user={page.user}
      notificationCount={page.notificationCount}
      planUsage={page.planUsage}
    >
      <DetailBreadcrumb
        parentLabel="Sponsorships"
        parentHref={`${page.basePath}/sponsorships`}
        recordName={sponsorship.sponsor?.name ?? 'Sponsorship'}
      />

      <DetailHeaderBar
        title={sponsorship.sponsor?.name ?? 'Unnamed sponsor'}
        status={sponsorship.stage === 'active' ? 'active' : 'in_progress'}
        subtitle={[titleCase(sponsorship.tier), sponsorship.eventName, sponsorship.packageName].filter(Boolean).join(' · ')}
        cover={
          sponsorship.sponsor?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={sponsorship.sponsor.logo_url} alt="" className="h-14 w-14 shrink-0 rounded-xl object-contain ring-1 ring-slate-200" />
          ) : (
            <span className="shrink-0"><Avatar name={sponsorship.sponsor?.name ?? 'Sponsor'} size={56} /></span>
          )
        }
        actions={<StatusBadge status={sponsorship.tier} label={titleCase(sponsorship.tier)} />}
      />

      <DetailTabStrip tabs={TABS} active={tab} basePath={detailPath} />

      {tab === 'overview' && (
        <div className="space-y-4">
          <KpiStrip>
            {showMoney ? (
              <KpiCard label="Value" tone="amber" icon={<DollarSign size={17} />} value={formatCurrency(sponsorship.value, sponsorship.currency)} comparison="Contracted value" />
            ) : (
              <KpiCard label="Value" tone="amber" icon={<DollarSign size={17} />} value="Hidden" comparison="Restricted for your role" />
            )}
            <KpiCard label="Stage" tone="blue" icon={<Star size={17} />} value={titleCase(sponsorship.stage)} comparison="Sales pipeline" />
            <KpiCard label="Deliverables" tone="violet" icon={<FileText size={17} />} value={`${completed} / ${deliverables.length}`} comparison="Completed" />
            <KpiCard label="Renewal" tone="emerald" icon={<Star size={17} />} value={formatEventDate(sponsorship.renewal_due_at, workspace.timezone)} comparison="Due date" />
          </KpiStrip>

          <div className="grid gap-4 xl:grid-cols-2">
            <Panel title="Sponsor">
              <dl className="space-y-2.5 text-[13px]">
                <Row label="Company" value={sponsorship.sponsor?.company_name ?? sponsorship.sponsor?.name ?? '—'} />
                <Row label="Industry" value={sponsorship.sponsor?.industry ?? '—'} />
                <Row label="Owner" value={sponsorship.ownerName ?? 'Unassigned'} />
                <Row label="Proposal sent" value={formatEventDate(sponsorship.proposal_sent_at, workspace.timezone)} />
                <Row label="Contract signed" value={formatEventDate(sponsorship.contract_signed_at, workspace.timezone)} />
              </dl>
            </Panel>
            <Panel title="Deliverables" contentClassName="p-0">
              {deliverables.length === 0 ? (
                <div className="p-6"><EventsEmptyState title="No deliverables yet" description="Add deliverables to track fulfilment for this sponsorship." /></div>
              ) : (
                <ul className="divide-y divide-slate-50">
                  {deliverables.slice(0, 5).map(d => (
                    <li key={d.id as string} className="flex items-center gap-3 px-4 py-3">
                      <span className="min-w-0 flex-1 text-[13px] font-medium text-slate-800">{d.title as string}</span>
                      <StatusBadge status={d.status as string} label={titleCase(d.status as string)} />
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>
      )}

      {tab === 'deliverables' && (
        <Panel title="Deliverables" contentClassName="p-0">
          {deliverables.length === 0 ? (
            <div className="p-6"><EventsEmptyState title="No deliverables yet" description="Add deliverables to track fulfilment for this sponsorship." /></div>
          ) : (
            <ul className="divide-y divide-slate-50">
              {deliverables.map(d => (
                <li key={d.id as string} className="flex items-center gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium text-slate-800">{d.title as string}</span>
                    <span className="block text-[11.5px] text-slate-500">{titleCase(d.deliverable_type as string)} · Due {formatEventDate(d.due_at as string, workspace.timezone)}</span>
                  </span>
                  <StatusBadge status={d.status as string} label={titleCase(d.status as string)} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      {tab === 'payments' && (
        <Panel title="Payments">
          {showMoney ? (
            <dl className="space-y-2.5 text-[13px]">
              <Row label="Value" value={formatCurrency(sponsorship.value, sponsorship.currency)} />
              <Row label="Payment status" value={titleCase(sponsorship.payment_status)} />
              <Row label="Payment terms" value={sponsorship.payment_terms ?? '—'} />
              <Row label="Paid" value={formatEventDate(sponsorship.paid_at, workspace.timezone)} />
            </dl>
          ) : (
            <EventsLockedState
              reason="permission"
              billingHref={`${page.workspaceRoot}/settings/billing`}
              capabilityLabel="Sponsorship payment details"
            />
          )}
        </Panel>
      )}

      <p className="mt-6">
        <Link href={`${page.basePath}/sponsorships`} className="text-[12.5px] font-semibold text-blue-600 hover:text-blue-700">← Back to sponsorships</Link>
      </p>
    </EventsShell>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-50 pb-2.5 last:border-0 last:pb-0">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-800">{value}</dd>
    </div>
  )
}
