import Link from 'next/link'
import {
  Clock, DollarSign, FileText, RefreshCw, Star, TrendingUp, Users,
} from 'lucide-react'
import EventsShell, { Avatar } from '@/components/events/EventsShell'
import GalaDockPromotion from '@/components/events/GalaDockPromotion'
import { EventsFilterBar, Pagination, ViewSwitcher } from '@/components/events/FilterBar'
import { ExportButton, MoreActionsButton } from '@/components/events/HeaderActions'
import { CreateSponsorshipButton } from '@/components/events/CreateModals'
import { RevenueChart } from '@/components/events/charts'
import { ActivityPanel, DateChip } from '@/components/events/records'
import {
  EventsEmptyState, EventsLockedState, EventsPageHeader, KpiCard, KpiStrip,
  Panel, PanelLink, ProgressRing, StatusBadge,
} from '@/components/events/primitives'
import { getEventsPageContext, parseEventsFilters } from '@/lib/events/page-context'
import {
  getActivationTimeline, getDeliverableSummary, getEventActivity, getGalaDockState,
  getSponsorshipKpis, getSponsorshipRevenueTrend, listEvents, listSponsors, listSponsorships,
} from '@/lib/events/queries'
import { formatCurrency, formatEventDate, formatNumber, formatRate, titleCase } from '@/lib/events/format'
import type { EventViewMode, SponsorshipWithRelations } from '@/lib/events/types'

export const dynamic = 'force-dynamic'

const VIEWS: EventViewMode[] = ['cards', 'table', 'pipeline', 'timeline']

const PIPELINE_STAGES = [
  'prospect', 'contacted', 'proposal', 'negotiation', 'verbal',
  'contracted', 'active', 'completed', 'renewal', 'lost',
] as const

export const metadata = {
  title: 'Sponsorships · Caption Fox',
  description: 'Manage sponsors, packages, deliverables, and revenue across all your events.',
}

export default async function SponsorshipsPage({
  params, searchParams,
}: {
  params: Promise<{ workspaceType: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { workspaceType } = await params
  const query = await searchParams
  const page = await getEventsPageContext(workspaceType, 'sponsorships')

  const allowedViews = VIEWS.filter(view =>
    view === 'pipeline' ? page.can('views.pipeline')
      : view === 'timeline' ? page.can('views.timeline') : true)
  const filters = parseEventsFilters(query, allowedViews, 'cards')
  const showMoney = page.can('sponsorships.viewFinancials')

  const { supabase, workspace } = page
  const [list, kpis, revenue, deliverables, activation, activity, events, gala, sponsorsList] = await Promise.all([
    listSponsorships(supabase, workspace.id, filters),
    getSponsorshipKpis(supabase, workspace.id, filters.range),
    showMoney ? getSponsorshipRevenueTrend(supabase, workspace.id) : Promise.resolve([]),
    getDeliverableSummary(supabase, workspace.id),
    getActivationTimeline(supabase, workspace.id, 4),
    getEventActivity(supabase, workspace.id, 5, ['sponsorship', 'sponsor', 'deliverable']),
    listEvents(supabase, workspace.id, { pageSize: 50 }),
    getGalaDockState(supabase, workspace.id, page.userId),
    listSponsors(supabase, workspace.id),
  ])

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
      searchPlaceholder="Search sponsors, companies, events..."
    >
      <EventsPageHeader
        title="Sponsorships"
        subtitle="Manage sponsors, packages, deliverables, and revenue across all your events."
        actions={
          <>
            <ExportButton
              routeSegment={workspaceType}
              resource="sponsorships"
              disabledReason={page.can('events.export') ? null : 'Your role cannot export sponsorship data'}
            />
            <CreateSponsorshipButton
              routeSegment={workspaceType}
              events={events.events.map(ev => ({ id: ev.id, name: ev.name }))}
              sponsors={sponsorsList.map(s => ({ id: s.id as string, name: s.name as string }))}
              disabledReason={page.can('sponsorships.manage') ? null : 'Your role cannot create sponsorships'}
            />
            <MoreActionsButton
              items={[
                { label: 'Pipeline view', href: `${page.basePath}/sponsorships?view=pipeline` },
                { label: 'Activation timeline', href: `${page.basePath}/sponsorships?view=timeline` },
              ]}
            />
          </>
        }
      />

      <KpiStrip>
        <KpiCard label="Active Sponsors" tone="blue" icon={<Users size={17} />}
          value={formatNumber(kpis.activeSponsors.value)} comparison="Contracted or active" />
        <KpiCard label="Pipeline Value" tone="violet" icon={<TrendingUp size={17} />}
          value={showMoney ? formatCurrency(kpis.pipelineValue.value, workspace.currency, true) : 'Hidden'}
          comparison={showMoney ? 'Open opportunities' : 'Restricted for your role'} />
        <KpiCard label="Sponsorship Revenue" tone="amber" icon={<DollarSign size={17} />}
          value={showMoney ? formatCurrency(kpis.revenue.value, workspace.currency, true) : 'Hidden'}
          kpi={showMoney ? kpis.revenue : undefined}
          comparison={showMoney ? `vs last ${filters.range} days` : 'Restricted for your role'} />
        <KpiCard label="Deliverables Due" tone="rose" icon={<FileText size={17} />}
          value={formatNumber(kpis.deliverablesDue.value)} comparison="Next 30 days" />
        <KpiCard label="Renewal Opportunities" tone="emerald" icon={<RefreshCw size={17} />}
          value={formatNumber(kpis.renewalOpportunities.value)} comparison="Renewal due soon" />
        <KpiCard label="Follow-up Tasks" tone="sky" icon={<Clock size={17} />}
          value={formatNumber(kpis.followUpTasks.value)}
          href={page.visibleTabs.includes('follow-up') ? `${page.basePath}/follow-up` : undefined}
          comparison="Open tasks" />
      </KpiStrip>

      <GalaDockPromotion
        placement="sponsorships-banner"
        routeSegment={workspaceType}
        connectionState={gala.connectionState}
        workspaceUrl={gala.workspaceUrl}
        syncError={gala.syncError}
        dismissed={gala.dismissedPlacements.includes('sponsorships-banner')}
        title="Power your events with Gala Dock"
        body="One powerful platform to manage venues, sponsors, schedules and logistics — seamlessly."
        className="mb-5"
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="min-w-[280px] flex-1">
          <EventsFilterBar
            searchPlaceholder="Search sponsors, companies, events..."
            dateRangeLabel="Date Range"
            filters={[
              { key: 'event', label: 'Event', options: events.events.map(event => ({ value: event.id, label: event.name })) },
              {
                key: 'status', label: 'Status', allLabel: 'All Statuses',
                options: PIPELINE_STAGES.map(stage => ({ value: stage, label: titleCase(stage) })),
              },
              {
                key: 'tier', label: 'Tier',
                options: ['premier', 'platinum', 'gold', 'silver', 'bronze', 'community']
                  .map(tier => ({ value: tier, label: titleCase(tier) })),
              },
            ]}
          />
        </div>
        <ViewSwitcher views={allowedViews} active={filters.view} />
      </div>

      <div className="mb-4 grid gap-4 xl:grid-cols-[1.62fr_1fr]">
        <Panel
          title="Sponsor Portfolio"
          action={<PanelLink href={`${page.basePath}/sponsorships?view=table`}>View all sponsors →</PanelLink>}
          contentClassName={filters.view === 'cards' ? 'p-4' : 'p-0'}
        >
          {list.total === 0 ? (
            <EventsEmptyState
              title={filters.q ? `No sponsorships match “${filters.q}”` : 'No sponsorships yet'}
              description={
                filters.q
                  ? 'Try a different search term or clear the filters.'
                  : 'Add a sponsor and a package to start tracking pipeline, deliverables and revenue against your events.'
              }
              icon={<Star size={26} />}
            />
          ) : filters.view === 'cards' ? (
            <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
              {list.sponsorships.slice(0, 4).map(sponsorship => (
                <SponsorCard
                  key={sponsorship.id}
                  sponsorship={sponsorship}
                  href={`${page.basePath}/sponsorships/${sponsorship.id}`}
                  currency={workspace.currency}
                  showMoney={showMoney}
                />
              ))}
            </div>
          ) : filters.view === 'pipeline' ? (
            <PipelineView
              sponsorships={list.sponsorships}
              basePath={page.basePath}
              currency={workspace.currency}
              showMoney={showMoney}
            />
          ) : filters.view === 'timeline' ? (
            <SponsorshipTimeline
              sponsorships={list.sponsorships}
              basePath={page.basePath}
              timezone={workspace.timezone}
            />
          ) : (
            <>
              <SponsorshipTable
                sponsorships={list.sponsorships}
                basePath={page.basePath}
                currency={workspace.currency}
                showMoney={showMoney}
              />
              <Pagination page={list.page} pageSize={list.pageSize} total={list.total} />
            </>
          )}
        </Panel>

        <ActivityPanel
          activity={activity}
          title="Recent Sponsor Activity"
          viewAllHref={`${page.basePath}/sponsorships`}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Sponsorship Revenue">
          {showMoney ? (
            <>
              <p className="text-[22px] font-bold text-slate-900">
                {formatCurrency(kpis.revenue.value, workspace.currency)}
              </p>
              <p className="mb-2 text-[11.5px] text-slate-500">Contracted, active and completed sponsorships</p>
              <RevenueChart data={revenue} currency={workspace.currency} />
            </>
          ) : (
            <EventsLockedState
              reason="permission"
              billingHref={`${page.workspaceRoot}/settings/billing`}
              capabilityLabel="Sponsorship revenue"
            />
          )}
        </Panel>

        <Panel
          title="Sponsorship Activation Timeline"
          action={<PanelLink href={`${page.basePath}/sponsorships?view=timeline`}>View full timeline</PanelLink>}
          contentClassName="p-0"
        >
          {activation.length === 0 ? (
            <div className="p-4">
              <EventsEmptyState
                title="No activation dates set"
                description="Give deliverables a due date and the activation timeline builds itself."
              />
            </div>
          ) : (
            <ol className="divide-y divide-slate-50">
              {activation.map(item => (
                <li key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                  <DateChip iso={item.due_at} timezone={workspace.timezone} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-semibold text-slate-900">{item.title}</span>
                    <span className="block truncate text-[11px] text-slate-500">{titleCase(item.deliverable_type)}</span>
                  </span>
                  <StatusBadge status={item.status} />
                </li>
              ))}
            </ol>
          )}
        </Panel>

        <Panel
          title="Sponsor Deliverables"
          action={<PanelLink href={`${page.basePath}/sponsorships?view=table`}>View all</PanelLink>}
          contentClassName="p-0"
        >
          {deliverables.length === 0 ? (
            <div className="p-4">
              <EventsEmptyState
                title="No deliverables tracked"
                description="Add deliverables to a sponsorship — logo placements, speaking slots, podcast reads — to track fulfilment."
              />
            </div>
          ) : (
            <>
              <ul className="divide-y divide-slate-50">
                {deliverables.slice(0, 4).map(item => {
                  const rate = item.total ? item.completed / item.total : 0
                  return (
                    <li key={item.type} className="flex items-center gap-3 px-4 py-2.5">
                      <ProgressRing value={rate} tone={rate >= 0.8 ? 'emerald' : rate >= 0.6 ? 'blue' : 'amber'} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12.5px] font-semibold text-slate-900">
                          {titleCase(item.type)}
                        </span>
                        <span className="block text-[11px] text-slate-500">
                          {item.completed} / {item.total} completed
                        </span>
                      </span>
                      <span className="shrink-0 text-[12.5px] font-bold text-slate-700">{formatRate(rate, 0)}</span>
                    </li>
                  )
                })}
              </ul>
              <div className="border-t border-slate-100 px-4 py-2.5 text-center">
                <PanelLink href={`${page.basePath}/sponsorships?view=table`}>View all deliverables →</PanelLink>
              </div>
            </>
          )}
        </Panel>
      </div>

      <GalaDockPromotion
        placement="sponsorships-footer"
        routeSegment={workspaceType}
        connectionState={gala.connectionState}
        workspaceUrl={gala.workspaceUrl}
        dismissed={gala.dismissedPlacements.includes('sponsorships-footer')}
        title="Manage venues, sponsors, schedules, and logistics in one unified platform."
        body="Gala Dock integrates with Caption Fox to power unforgettable event experiences."
        className="mt-4"
      />
    </EventsShell>
  )
}

/* ------------------------------------------------------------------- cards */

function SponsorCard({
  sponsorship, href, currency, showMoney,
}: {
  sponsorship: SponsorshipWithRelations
  href: string
  currency: string
  showMoney: boolean
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-3.5 transition-shadow hover:shadow-[0_6px_20px_rgba(15,23,42,0.06)]">
      <div className="flex items-start gap-2">
        {sponsorship.sponsor?.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={sponsorship.sponsor.logo_url} alt="" className="h-7 w-7 shrink-0 rounded-md object-contain" loading="lazy" />
        ) : (
          <Avatar name={sponsorship.sponsor?.name ?? 'Sponsor'} size={28} />
        )}
        <h3 className="min-w-0 flex-1 text-[13px] font-semibold leading-snug text-slate-900">
          <Link href={href} className="hover:text-blue-700">{sponsorship.sponsor?.name ?? 'Unnamed sponsor'}</Link>
        </h3>
        <span className="shrink-0">
          <StatusBadge status={sponsorship.tier} label={titleCase(sponsorship.tier)} />
        </span>
      </div>

      <dl className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 text-[11.5px]">
        <Row label="Event" value={sponsorship.eventName ?? '—'} />
        {showMoney && <Row label="Value" value={formatCurrency(sponsorship.value, sponsorship.currency || currency)} />}
        <Row label="Status" value={<StatusBadge status={sponsorship.stage === 'active' ? 'active' : 'in_progress'} label={titleCase(sponsorship.stage)} />} />
        <Row label="Package" value={sponsorship.packageName ?? '—'} />
        <Row
          label="Deliverables"
          value={`${sponsorship.deliverablesCompleted} / ${sponsorship.deliverablesTotal} completed`}
        />
      </dl>

      {sponsorship.ownerName && (
        <p className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
          <Avatar name={sponsorship.ownerName} src={sponsorship.ownerAvatarUrl} size={24} />
          <span className="truncate text-[11.5px] text-slate-600">{sponsorship.ownerName}</span>
        </p>
      )}
    </article>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="shrink-0 text-slate-500">{label}</dt>
      <dd className="min-w-0 truncate text-right font-medium text-slate-800">{value}</dd>
    </div>
  )
}

/* -------------------------------------------------------------- pipeline */

function PipelineView({
  sponsorships, basePath, currency, showMoney,
}: {
  sponsorships: SponsorshipWithRelations[]
  basePath: string
  currency: string
  showMoney: boolean
}) {
  const stages = PIPELINE_STAGES.filter(stage =>
    sponsorships.some(item => item.stage === stage) || ['prospect', 'proposal', 'negotiation', 'contracted', 'active'].includes(stage))

  return (
    <div className="overflow-x-auto p-4">
      <div className="flex min-w-max gap-3">
        {stages.map(stage => {
          const inStage = sponsorships.filter(item => item.stage === stage)
          const value = inStage.reduce((sum, item) => sum + item.value, 0)
          return (
            <section key={stage} className="w-[220px] shrink-0 rounded-xl bg-slate-50 p-2.5">
              <header className="mb-2 flex items-center justify-between px-1">
                <h3 className="text-[12px] font-semibold text-slate-700">{titleCase(stage)}</h3>
                <span className="text-[11px] font-semibold text-slate-500">{inStage.length}</span>
              </header>
              {showMoney && (
                <p className="mb-2 px-1 text-[11px] text-slate-500">{formatCurrency(value, currency, true)}</p>
              )}
              <ul className="space-y-2">
                {inStage.map(item => (
                  <li key={item.id}>
                    <Link
                      href={`${basePath}/sponsorships/${item.id}`}
                      className="block rounded-lg border border-slate-200 bg-white p-2.5 hover:border-slate-300"
                    >
                      <span className="block truncate text-[12.5px] font-semibold text-slate-900">
                        {item.sponsor?.name ?? 'Unnamed sponsor'}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-slate-500">{item.eventName ?? '—'}</span>
                      {showMoney && (
                        <span className="mt-1.5 block text-[12px] font-bold text-slate-800">
                          {formatCurrency(item.value, item.currency || currency)}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
                {inStage.length === 0 && (
                  <li className="rounded-lg border border-dashed border-slate-200 px-2.5 py-3 text-center text-[11px] text-slate-400">
                    Nothing here
                  </li>
                )}
              </ul>
            </section>
          )
        })}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------- timeline */

function SponsorshipTimeline({
  sponsorships, basePath, timezone,
}: { sponsorships: SponsorshipWithRelations[]; basePath: string; timezone: string }) {
  const milestones = sponsorships.flatMap(item => [
    { id: `${item.id}-proposal`, at: item.proposal_sent_at, label: 'Proposal sent', item },
    { id: `${item.id}-contract`, at: item.contract_signed_at, label: 'Contract signed', item },
    { id: `${item.id}-activation`, at: item.activation_start_at, label: 'Activation starts', item },
    { id: `${item.id}-renewal`, at: item.renewal_due_at, label: 'Renewal due', item },
  ]).filter(entry => entry.at).sort((a, b) => (a.at! < b.at! ? -1 : 1))

  if (milestones.length === 0) {
    return (
      <div className="p-4">
        <EventsEmptyState
          title="No dated milestones"
          description="Proposal, contract, activation and renewal dates build this timeline."
        />
      </div>
    )
  }

  return (
    <ol className="divide-y divide-slate-50">
      {milestones.map(entry => (
        <li key={entry.id} className="flex items-center gap-3 px-4 py-3">
          <DateChip iso={entry.at!} timezone={timezone} />
          <span className="min-w-0 flex-1">
            <Link
              href={`${basePath}/sponsorships/${entry.item.id}`}
              className="block truncate text-[13px] font-semibold text-slate-900 hover:text-blue-700"
            >
              {entry.item.sponsor?.name ?? 'Sponsor'} — {entry.item.eventName ?? 'Unassigned event'}
            </Link>
            <span className="block text-[11.5px] text-slate-500">
              {entry.label} · {formatEventDate(entry.at!, timezone)}
            </span>
          </span>
          <StatusBadge status={entry.item.stage === 'active' ? 'active' : 'in_progress'} label={titleCase(entry.item.stage)} />
        </li>
      ))}
    </ol>
  )
}

/* ----------------------------------------------------------------- table */

function SponsorshipTable({
  sponsorships, basePath, currency, showMoney,
}: {
  sponsorships: SponsorshipWithRelations[]
  basePath: string
  currency: string
  showMoney: boolean
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] border-collapse text-left">
        <caption className="sr-only">Sponsorships</caption>
        <thead>
          <tr className="border-b border-slate-100 text-[11.5px] font-semibold uppercase tracking-wide text-slate-500">
            <th scope="col" className="px-4 py-3">Sponsor</th>
            <th scope="col" className="px-3 py-3">Event</th>
            <th scope="col" className="px-3 py-3">Package</th>
            {showMoney && <th scope="col" className="px-3 py-3 text-right">Value</th>}
            <th scope="col" className="px-3 py-3">Stage</th>
            <th scope="col" className="px-3 py-3">Deliverables</th>
            <th scope="col" className="px-3 py-3">Owner</th>
            <th scope="col" className="px-3 py-3">Renewal</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sponsorships.map(item => (
            <tr key={item.id} className="text-[13px] text-slate-700 hover:bg-slate-50/70">
              <th scope="row" className="px-4 py-3 text-left font-medium">
                <Link href={`${basePath}/sponsorships/${item.id}`} className="font-semibold text-slate-900 hover:text-blue-700">
                  {item.sponsor?.name ?? 'Unnamed sponsor'}
                </Link>
              </th>
              <td className="px-3 py-3">{item.eventName ?? '—'}</td>
              <td className="px-3 py-3">{item.packageName ?? titleCase(item.tier)}</td>
              {showMoney && (
                <td className="px-3 py-3 text-right tabular-nums">
                  {formatCurrency(item.value, item.currency || currency)}
                </td>
              )}
              <td className="px-3 py-3"><StatusBadge status={item.stage === 'active' ? 'active' : 'in_progress'} label={titleCase(item.stage)} /></td>
              <td className="px-3 py-3 tabular-nums">{item.deliverablesCompleted} / {item.deliverablesTotal}</td>
              <td className="px-3 py-3">{item.ownerName ?? '—'}</td>
              <td className="whitespace-nowrap px-3 py-3">
                {item.renewal_due_at ? formatEventDate(item.renewal_due_at) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
