import Link from 'next/link'
import {
  FileText, MessageSquare, Hourglass, CheckCircle2, Trophy, XCircle, ListChecks,
} from 'lucide-react'
import { requireMarketplaceModule } from '@/lib/marketplace/server'
import { parseMarketplaceQuery, type RawParams } from '@/lib/marketplace/query'
import {
  MODULE_ROUTES, REQUEST_STATUS_META, money, deadlineState,
} from '@/lib/marketplace/module'
import {
  getRequests, getProposals, getCategories, searchProfiles,
} from '@/lib/marketplace/data'
import { MarketplacePage, AccessBlocked, NoResults } from '@/components/marketplace/module/Layout'
import SearchHero from '@/components/marketplace/module/SearchHero'
import { requestFilters } from '@/components/marketplace/module/filters'
import { Panel, PanelLink, StatTile, ProfileAvatar, StatusPill } from '@/components/marketplace/module/primitives'
import { Pagination, FilterChips, ColumnsMenu } from '@/components/marketplace/module/Controls'
import {
  NewRequestButton, RequestCard, RequestActions, ProposalComparison, ExportRequests,
} from '@/components/marketplace/module/RequestsClient'
import { formatDate, formatRelative, cn } from '@/lib/utils'

export const metadata = { title: 'Marketplace Requests · Caption Fox' }

const PATH = MODULE_ROUTES.requests

/** Toggleable table columns; ID and Actions always stay visible. */
const REQUEST_COLUMNS = [
  { id: 'type', label: 'Type' },
  { id: 'title', label: 'Project title' },
  { id: 'category', label: 'Category' },
  { id: 'budget', label: 'Budget' },
  { id: 'invited', label: 'Invited' },
  { id: 'responses', label: 'Responses' },
  { id: 'deadline', label: 'Deadline' },
  { id: 'status', label: 'Status' },
  { id: 'updated', label: 'Updated' },
]

export default async function MarketplaceRequestsPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const session = await requireMarketplaceModule('requests')
  if (!session.access.allowed) {
    return (
      <MarketplacePage
        module="requests" modules={session.modules}
        title="Marketplace Requests" subtitle="Manage discovery requests and RFQs to find the perfect suppliers for your projects."
      >
        <AccessBlocked access={session.access} title="Requests are not available on your plan" />
      </MarketplacePage>
    )
  }

  const params = await searchParams
  const query = parseMarketplaceQuery(params, { views: ['cards', 'table'], defaultView: 'cards' })
  const newKind = (Array.isArray(params.new) ? params.new[0] : params.new) as 'discovery' | 'rfq' | undefined

  const [{ rows, total, kpis }, categories, proposals, invitable] = await Promise.all([
    getRequests(session, query),
    getCategories(session.supabase),
    getProposals(session, { limit: 8 }),
    searchProfiles(session.supabase, { ...query, q: '', sort: 'rating' }, { limit: 30 }),
  ])

  const first = (query.page - 1) * query.size + 1
  const last = Math.min(query.page * query.size, total)
  const nextActions = [
    { icon: <Hourglass size={15} />, title: `${kpis.awaiting} request${kpis.awaiting === 1 ? '' : 's'} awaiting proposals`, note: 'Review and send reminders', href: `${PATH}?status=awaiting_proposals` },
    { icon: <MessageSquare size={15} />, title: `${proposals.filter(p => p.status === 'submitted').length} proposals to review`, note: 'Evaluate and shortlist suppliers', href: PATH },
    { icon: <ListChecks size={15} />, title: `${kpis.shortlisted} request${kpis.shortlisted === 1 ? '' : 's'} shortlisted`, note: 'Compare and select best matches', href: `${PATH}?status=shortlisted` },
  ]

  return (
    <MarketplacePage
      module="requests" modules={session.modules}
      title="Marketplace Requests"
      subtitle="Manage discovery requests and RFQs to find the perfect suppliers for your projects."
    >
      <SearchHero
        title="Find the right suppliers with precision"
        subtitle="Create requests, compare proposals, and choose the best partner for your project."
        placeholder="Search requests by project title, ID, or keywords…"
        query={query} pathname={PATH} mode="requests" resultCount={total}
        filters={requestFilters(categories)}
        canSaveSearch={false}
        layout="requests"
        inputActions={
          <NewRequestButton
            categories={categories} suppliers={invitable.rows}
            canCreate={session.capabilities.createRequest}
            canInvite={session.capabilities.inviteSuppliers}
            defaultKind={newKind}
            onBlue
          />
        }
      />

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile icon={<FileText size={17} />} label="Open requests" value={String(kpis.open)} tone="blue" />
        <StatTile icon={<MessageSquare size={17} />} label="Responses received" value={String(kpis.responses)} tone="violet" />
        <StatTile icon={<Hourglass size={17} />} label="Awaiting proposals" value={String(kpis.awaiting)} tone="amber" />
        <StatTile icon={<CheckCircle2 size={17} />} label="Shortlisted" value={String(kpis.shortlisted)} tone="emerald" />
        <StatTile icon={<Trophy size={17} />} label="Closed won" value={String(kpis.closed_won)} tone="emerald" />
        <StatTile icon={<XCircle size={17} />} label="Closed cancelled" value={String(kpis.closed_cancelled)} tone="red" />
      </div>

      <div className="grid gap-5 lg:gap-4 xl:grid-cols-[minmax(0,1fr)_250px]">
        <div className="min-w-0 space-y-5 lg:space-y-4">
          <Panel
            title="Your requests"
            subtitle={total > 0 ? `Card view · ${rows.length} most recent` : 'No requests yet'}
            padded={false}
          >
            <div className="px-4 pt-3 lg:px-3">
              <FilterChips
                query={query} pathname={PATH}
                labels={{
                  type: query.type === 'rfq' ? 'RFQ' : query.type === 'discovery' ? 'Discovery' : undefined,
                  category: categories.find(c => c.slug === query.category)?.name,
                  budget: 'Budget', status: REQUEST_STATUS_META[query.status as keyof typeof REQUEST_STATUS_META]?.label,
                }}
              />
            </div>

            {rows.length === 0 ? (
              <NoResults
                title="No requests match these filters"
                description="Create a request to brief suppliers and collect comparable proposals."
                action={
                  <Link href={PATH} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 lg:text-[11px] lg:px-3">
                    Clear filters
                  </Link>
                }
              />
            ) : (
              // Reference: one scrolling row of request cards above the full table.
              <div className="flex snap-x gap-4 overflow-x-auto p-4 lg:gap-2.5 lg:p-3 [&>*]:w-[260px] [&>*]:shrink-0 [&>*]:snap-start lg:[&>*]:w-[calc((100%-40px)/5)]">
                {rows.map(request => (
                  <RequestCard
                    key={request.id} request={request}
                    canEdit={session.capabilities.editRequest}
                    canClose={session.capabilities.closeRequest}
                  />
                ))}
              </div>
            )}
          </Panel>

          {rows.length > 0 && (
            <Panel
              title="All requests"
              subtitle={`Table view · showing ${first}–${last} of ${total}`}
              action={
                <div className="flex items-center gap-2">
                  <ExportRequests rows={rows} canExport={session.capabilities.export} />
                  <ColumnsMenu tableId="requests" columns={REQUEST_COLUMNS} />
                </div>
              }
              padded={false}
            >
                <div className="overflow-x-auto">
                  <table data-columns="requests" className="w-full min-w-[880px] whitespace-nowrap text-xs lg:min-w-0 lg:text-[9.5px]">
                    <caption className="sr-only">Marketplace requests</caption>
                    <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-400 lg:text-[8.5px]">
                      <tr>
                        <th scope="col" data-col="id" className="px-4 py-2.5 text-left font-semibold lg:py-1 lg:px-3">ID</th>
                        <th scope="col" data-col="type" className="px-3 py-2.5 text-left font-semibold lg:py-1 lg:px-2">Type</th>
                        <th scope="col" data-col="title" className="px-3 py-2.5 text-left font-semibold lg:py-1 lg:px-2">Project title</th>
                        <th scope="col" data-col="category" className="px-3 py-2.5 text-left font-semibold lg:py-1 lg:px-2">Category</th>
                        <th scope="col" data-col="budget" className="px-3 py-2.5 text-left font-semibold lg:py-1 lg:px-2">Budget</th>
                        <th scope="col" data-col="invited" className="px-3 py-2.5 text-left font-semibold lg:py-1 lg:px-2">Invited</th>
                        <th scope="col" data-col="responses" className="px-3 py-2.5 text-left font-semibold lg:py-1 lg:px-2">Responses</th>
                        <th scope="col" data-col="deadline" className="px-3 py-2.5 text-left font-semibold lg:py-1 lg:px-2">Deadline</th>
                        <th scope="col" data-col="status" className="px-3 py-2.5 text-left font-semibold lg:py-1 lg:px-2">Status</th>
                        <th scope="col" data-col="updated" className="px-3 py-2.5 text-left font-semibold lg:py-1 lg:px-2">Updated</th>
                        <th scope="col" data-col="actions" className="px-4 py-2.5 text-right font-semibold lg:py-1 lg:px-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rows.map(request => {
                        const meta = REQUEST_STATUS_META[request.status]
                        const due = deadlineState(request.deadline)
                        return (
                          <tr key={request.id} className="hover:bg-slate-50">
                            <td data-col="id" className="px-4 py-2.5 font-medium text-slate-700 lg:py-1 lg:px-3">{request.reference}</td>
                            <td data-col="type" className="px-3 py-2.5 lg:py-1 lg:px-2">
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-600 lg:text-[8.5px]">
                                {request.kind === 'rfq' ? 'RFQ' : 'Discovery'}
                              </span>
                            </td>
                            <td data-col="title" className="max-w-[180px] truncate lg:max-w-[140px] px-3 py-2.5 font-medium text-slate-800 lg:py-1 lg:px-2">{request.title}</td>
                            <td data-col="category" className="px-3 py-2.5 text-slate-500 lg:py-1 lg:px-2">{request.category ?? '—'}</td>
                            <td data-col="budget" className="px-3 py-2.5 text-slate-600 lg:py-1 lg:px-2">
                              {money(request.budget_min_cents)} – {money(request.budget_max_cents)}
                            </td>
                            <td data-col="invited" className="px-3 py-2.5 text-slate-600 lg:py-1 lg:px-2">{request.invited_count}</td>
                            <td data-col="responses" className="px-3 py-2.5 text-slate-600 lg:py-1 lg:px-2">{request.response_count}</td>
                            <td data-col="deadline" className="px-3 py-2.5 lg:py-1 lg:px-2">
                              <span title={due.label} className={cn(due.tone === 'danger' ? 'text-red-600' : due.tone === 'warn' ? 'text-amber-600' : 'text-slate-600')}>{request.deadline ? formatDate(request.deadline) : '—'}</span>
                            </td>
                            <td data-col="status" className="px-3 py-2.5 lg:py-1 lg:px-2"><StatusPill label={meta.label} cls={meta.cls} /></td>
                            <td data-col="updated" className="px-3 py-2.5 text-slate-400 lg:py-1 lg:px-2">{formatRelative(request.updated_at)}</td>
                            <td data-col="actions" className="px-4 py-2.5 lg:py-1 lg:px-3">
                              <div className="flex justify-end">
                                <RequestActions
                                  request={request}
                                  canEdit={session.capabilities.editRequest}
                                  canClose={session.capabilities.closeRequest}
                                />
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

              <div className="border-t border-slate-100 p-4 lg:px-3 lg:py-2">
                <Pagination query={query} pathname={PATH} total={total} />
              </div>
            </Panel>
          )}

          <Panel
            title="Compare supplier responses"
            subtitle="Price, capability, availability and rating, scored consistently"
            action={<PanelLink href={PATH}>View full comparison</PanelLink>}
            padded={false}
          >
            <ProposalComparison proposals={proposals} canEvaluate={session.capabilities.evaluateProposals} />
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel
            title="Recent proposals"
            action={<PanelLink href={PATH}>View all requests</PanelLink>}
            padded={false}
          >
            {proposals.length === 0 ? (
              <p className="p-5 text-xs text-slate-500 lg:text-[10px]">Supplier proposals will appear here as they arrive.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {proposals.slice(0, 5).map(proposal => (
                  <li key={proposal.id} className="flex items-center gap-2.5 px-4 py-2.5 lg:py-1.5 lg:px-3">
                    {proposal.supplier && <ProfileAvatar profile={proposal.supplier} size={30} />}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-slate-800 lg:text-[10px]">{proposal.supplier?.display_name}</p>
                      <p className="truncate text-[11px] text-slate-400 lg:text-[9px]">{proposal.request_title}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      {proposal.status === 'submitted' && (
                        <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 lg:text-[8.5px]">New</span>
                      )}
                      <p className="mt-0.5 text-[11px] text-slate-400 lg:text-[9px]">{formatRelative(proposal.created_at)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Next actions" padded={false}>
            <ul className="divide-y divide-slate-100">
              {nextActions.map(action => (
                <li key={action.title}>
                  <Link href={action.href} className="flex items-center gap-2.5 px-4 py-3 hover:bg-slate-50 lg:py-2 lg:px-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                      {action.icon}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-slate-800 lg:text-[10px]">{action.title}</p>
                      <p className="truncate text-[11px] text-slate-500 lg:text-[9px]">{action.note}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Request activity" padded={false}>
            {rows.length === 0 ? (
              <p className="p-5 text-xs text-slate-500 lg:text-[10px]">Request updates will show here.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {rows.slice(0, 5).map(request => (
                  <li key={request.id} className="px-4 py-2.5 lg:py-1.5 lg:px-3">
                    <p className="truncate text-xs font-medium text-slate-800 lg:text-[10px]">{request.title}</p>
                    <p className="mt-0.5 text-[11px] text-slate-400 lg:text-[9px]">
                      {REQUEST_STATUS_META[request.status].label} · updated {formatRelative(request.updated_at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </MarketplacePage>
  )
}
