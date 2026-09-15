import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { requirePartnershipModule } from '@/lib/partnerships/server'
import {
  listPartners, listProgrammes, metricSeries, partnershipAggregates, recentActivity, workspaceMembers,
} from '@/lib/partnerships/data'
import { parsePartnershipQuery, type RawParams } from '@/lib/partnerships/query'
import { MODULE_PROGRAMME_TYPE, PARTNERSHIP_MODULE_META, type PartnershipModule } from '@/lib/partnerships/constants'
import PartnershipsHeader from './PartnershipsHeader'
import { default as PartnershipsFilters } from '@/components/campaigns/CampaignFilters'
import KpiStrip from './KpiStrip'
import ProgrammeCard from './ProgrammeCard'
import PartnersTable from './PartnersTable'
import ActivityFeed from '@/components/campaigns/ActivityFeed'
import NewProgrammeButton from './NewProgrammeButton'
import NewPartnerButton from './NewPartnerButton'
import ImportButton from './ImportButton'
import ExportButton, { HeaderOverflow } from './ExportButton'
import { AccessBlocked, LoadError } from '@/components/campaigns/states'
import { PartnershipsEmpty } from './states'
import { Panel, PARTNERSHIPS_PAGE, formatCompactMoney, formatNumber } from './primitives'
import {
  ChartLegend, DonutChart, DonutLegend, TrendChart, type DonutSlice, type TrendSeries,
} from './charts'
import { LabelledScatter, type LabelledScatterPoint } from './charts'
import type { KpiValue } from '@/lib/partnerships/types'

const PROGRAMME_TYPE_COLOURS: Record<string, string> = {
  affiliate: '#2563eb', referral: '#7c3aed', ambassador: '#10b981',
  loyalty: '#f59e0b', reseller: '#0ea5e9', co_marketing: '#ec4899',
}

/**
 * One shared renderer for all seven Partnerships surfaces. The seven
 * approved designs are the same template (header → KPIs → filters → three
 * charts → next actions → featured programmes → activity → table) with
 * per-programme-type copy and metrics, so this component is parametrised by
 * module rather than duplicated seven times.
 */
export default async function PartnershipModulePage({
  module, searchParams,
}: { module: PartnershipModule; searchParams: Promise<RawParams> }) {
  const params = await searchParams
  const { supabase, ctx, capabilities, modules, access } = await requirePartnershipModule(module)
  const meta = PARTNERSHIP_MODULE_META[module]
  const programmeType = MODULE_PROGRAMME_TYPE[module] ?? null

  if (!access.allowed) {
    return (
      <div className={PARTNERSHIPS_PAGE}>
        <PartnershipsHeader module={module} modules={modules} />
        <AccessBlocked access={access} />
      </div>
    )
  }

  const query = parsePartnershipQuery(params)
  const to = query.to || new Date().toISOString().slice(0, 10)
  const from = query.from || new Date(Date.parse(to) - 29 * 86_400_000).toISOString().slice(0, 10)

  const [aggregates, series, programmes, partnersPage, members, activity] = await Promise.all([
    partnershipAggregates(supabase, ctx.workspaceId, programmeType),
    metricSeries(supabase, ctx.workspaceId, programmeType, from, to),
    listProgrammes(supabase, ctx.workspaceId, programmeType, { limit: 4 }),
    listPartners(supabase, ctx.workspaceId, programmeType, query, opts(query)),
    workspaceMembers(supabase, ctx.workspaceId),
    recentActivity(supabase, ctx.workspaceId, { limit: 6 }),
  ])

  const kpis = buildKpis(module, aggregates, series)

  const typeSlices: DonutSlice[] = programmeType
    ? tierMixSlices(programmes.rows)
    : overviewMixSlices(aggregates, programmes.rows)

  const scatterPoints: LabelledScatterPoint[] = programmes.rows
    .filter(p => (p.revenue ?? 0) > 0 || (p.commission ?? 0) > 0)
    .map(p => ({ id: p.id, name: p.name, x: p.revenue ?? 0, y: p.commission ?? 0, group: p.programme_type }))

  const trendData = series.points.map(point => ({
    date: point.metric_date, primary: point.primary_count, secondary: point.secondary_count, revenue: point.revenue,
  }))

  const trendSeries: TrendSeries[] = [
    { key: 'primary', label: meta.primaryMetricLabel, colour: '#2563eb' },
    { key: 'secondary', label: meta.secondaryMetricLabel, colour: '#7c3aed' },
    { key: 'revenue', label: 'Revenue (£)', colour: '#10b981' },
  ]

  const nextActions = buildNextActions(module, aggregates)

  return (
    <div className={PARTNERSHIPS_PAGE}>
      <PartnershipsHeader
        module={module} modules={modules}
        actions={
          <>
            {capabilities.createPartner && (
              <NewPartnerButton
                programmes={programmes.rows} members={members}
                partnerType={defaultPartnerType(module)} label={meta.createPartnerLabel}
              />
            )}
            {capabilities.createProgramme && <NewProgrammeButton members={members} defaultType={programmeType ?? undefined} />}
            {capabilities.import && <ImportButton programmes={programmes.rows} partnerType={defaultPartnerType(module)} />}
            <ExportButton entity="partners" module={module} allowed={capabilities.export} />
            <HeaderOverflow items={[
              { label: 'Refresh data' },
              { label: 'Programme settings', href: '/app/settings' },
              { label: 'Payouts', href: '/app/partnerships' },
              { label: 'Tracking', href: '/app/partnerships' },
            ]} />
          </>
        }
      />

      <KpiStrip items={kpis} className="mb-3" />

      <PartnershipsFilters
        className="mb-3"
        searchPlaceholder="Search partners or programmes…"
        views={['cards', 'table']}
        filters={[
          { key: 'owner', label: 'Owner', options: members.map(m => ({ value: m.id, label: m.full_name ?? m.email ?? 'Member' })) },
          { key: 'status', label: 'Status', options: [
            { value: 'active', label: 'Active' }, { value: 'applicant', label: 'Applicant' },
            { value: 'pending_review', label: 'Pending review' }, { value: 'at_risk', label: 'At risk' },
            { value: 'paused', label: 'Paused' }, { value: 'suspended', label: 'Suspended' },
          ] },
          { key: 'platform', label: 'Platform', options: ['instagram', 'tiktok', 'youtube', 'facebook', 'x', 'linkedin', 'web'].map(p => ({ value: p, label: p })), advanced: true },
          { key: 'region', label: 'Region', options: [
            { value: 'North America', label: 'North America' }, { value: 'EMEA', label: 'EMEA' },
            { value: 'APAC', label: 'APAC' }, { value: 'Latin America', label: 'Latin America' },
          ], advanced: true },
        ]}
      />

      {partnersPage.error && <LoadError message={partnersPage.error} className="mb-3" />}

      {query.view === 'table' ? (
        <PartnersTable
          partners={partnersPage.rows} capabilities={capabilities}
          hrefFor={partner => `/app/partnerships/partners/${partner.id}`}
        />
      ) : (
        <>
          <div className="mb-3 grid gap-3 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1.05fr)_minmax(0,1.15fr)_minmax(0,1.1fr)]">
            <Panel
              title={`${meta.label === 'Overview' ? 'Programme' : meta.label} performance`}
              info={`Daily ${meta.primaryMetricLabel.toLowerCase()}, ${meta.secondaryMetricLabel.toLowerCase()} and revenue across the selected period`}
              action={<span className="text-[11px] text-slate-400">{from} → {to}</span>}
            >
              <ChartLegend series={trendSeries} className="mb-1" />
              <TrendChart data={trendData} series={trendSeries} />
            </Panel>

            <Panel title={programmeType ? 'Tier mix' : 'Programme mix'} info="Live programmes broken down by type or tier">
              <div className="flex items-center gap-3">
                <DonutChart slices={typeSlices} total={programmes.total} totalLabel="Total" emptyMessage="No programmes yet." />
                <DonutLegend slices={typeSlices} total={programmes.total} />
              </div>
            </Panel>

            <Panel title="Commission vs revenue" info="Commission paid plotted against revenue for each programme">
              <LabelledScatter points={scatterPoints} xLabel="Revenue" yLabel="Commission" colours={PROGRAMME_TYPE_COLOURS} format="money" />
            </Panel>

            <Panel title="Next actions" viewAllHref="/app/partnerships/applications" viewAllLabel="View all">
              {nextActions.length === 0 ? (
                <p className="py-6 text-center text-[13px] text-slate-400">Nothing needs your attention right now.</p>
              ) : (
                <ul className="space-y-1">
                  {nextActions.map(action => (
                    <li key={action.id}>
                      <Link href={action.href} className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-slate-50">
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold ${action.tone}`}>{action.count}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12px] font-medium text-slate-900">{action.label}</span>
                          <span className="block truncate text-[11px] text-slate-400">{action.sub}</span>
                        </span>
                        <ChevronRight size={13} className="shrink-0 text-slate-300" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          <div className="mb-3 grid gap-3 xl:grid-cols-[minmax(0,2.6fr)_minmax(0,1.1fr)]">
            <Panel title={`Featured ${meta.label.toLowerCase()} programmes`} viewAllHref={meta.href} viewAllLabel="View all programmes">
              {programmes.rows.length === 0 ? (
                <PartnershipsEmpty
                  bare title="No programmes yet"
                  message="Create your first programme to start tracking partners, conversions and payouts in one place."
                  action={capabilities.createProgramme ? <NewProgrammeButton members={members} defaultType={programmeType ?? undefined} /> : undefined}
                />
              ) : (
                <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                  {programmes.rows.map(programme => (
                    <ProgrammeCard
                      key={programme.id} programme={programme}
                      href={`/app/partnerships/programmes/${programme.id}`}
                      platforms={partnersPage.rows.find(p => p.programme_id === programme.id)?.platforms}
                    />
                  ))}
                </div>
              )}
            </Panel>

            <Panel title="Recent activity" viewAllHref={meta.href}>
              <ActivityFeed items={activity} />
            </Panel>
          </div>

          <Panel
            title={`${meta.label === 'Overview' ? 'Partners' : meta.label} summary`}
            info="Partners matching your current filters" viewAllHref={`${meta.href}?view=table`} viewAllLabel="View full table"
            bodyClassName="px-0 pb-0"
          >
            <PartnersTable
              partners={partnersPage.rows.slice(0, 6)} capabilities={capabilities}
              hrefFor={partner => `/app/partnerships/partners/${partner.id}`}
              compact bare emptyMessage="No partners match the current filters."
            />
          </Panel>
        </>
      )}
    </div>
  )
}

function opts(query: ReturnType<typeof parsePartnershipQuery>) {
  return query.view === 'table'
    ? { paginate: true as const }
    : { limit: 12 }
}

function defaultPartnerType(module: PartnershipModule): string {
  const map: Record<PartnershipModule, string> = {
    overview: 'affiliate', affiliates: 'affiliate', referrals: 'referral_advocate', ambassadors: 'ambassador',
    loyalty: 'loyalty_member', resellers: 'reseller', co_marketing: 'co_marketing_partner',
  }
  return map[module]
}

function tierMixSlices(programmes: { current_tier_name?: string | null }[]): DonutSlice[] {
  const counts = new Map<string, number>()
  for (const p of programmes) {
    const key = p.current_tier_name ?? 'Unranked'
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const palette = ['#2563eb', '#7c3aed', '#10b981', '#f59e0b', '#ec4899', '#94a3b8']
  return [...counts.entries()].map(([key, value], i) => ({ key, label: key, value, colour: palette[i % palette.length] }))
}

function overviewMixSlices(
  aggregates: Awaited<ReturnType<typeof partnershipAggregates>>, programmes: { programme_type: string }[],
): DonutSlice[] {
  void aggregates
  const counts = new Map<string, number>()
  for (const p of programmes) counts.set(p.programme_type, (counts.get(p.programme_type) ?? 0) + 1)
  return [...counts.entries()].map(([key, value]) => ({
    key, value, colour: PROGRAMME_TYPE_COLOURS[key] ?? '#94a3b8',
    label: key.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()),
  }))
}

function buildKpis(
  module: PartnershipModule,
  agg: Awaited<ReturnType<typeof partnershipAggregates>>,
  series: Awaited<ReturnType<typeof metricSeries>>,
): KpiValue[] {
  const money = (v: number) => formatCompactMoney(v)
  const base: KpiValue[] = [
    { id: 'partners', label: 'Total partners', value: formatNumber(agg.totalPartners), icon: 'users', tone: 'blue' },
    { id: 'programmes', label: 'Active programmes', value: formatNumber(agg.activeProgrammes), icon: 'handshake', tone: 'violet' },
    { id: 'conversions', label: 'Conversions', value: formatNumber(agg.conversions), icon: 'cart', tone: 'blue' },
    { id: 'commission', label: 'Commission paid', value: money(agg.commissionPaid), hint: `${money(agg.commissionOwed)} owed`, icon: 'wallet', tone: 'green' },
    { id: 'revenue', label: 'Partner-generated revenue', value: money(agg.revenue), icon: 'trend', tone: 'green' },
    { id: 'at_risk', label: 'At-risk partners', value: formatNumber(agg.atRiskPartners), icon: 'alert', tone: agg.atRiskPartners > 0 ? 'red' : 'slate' },
  ]

  switch (module) {
    case 'referrals':
      return [
        { id: 'programmes', label: 'Active referral programmes', value: formatNumber(agg.activeProgrammes), icon: 'handshake', tone: 'blue' },
        { id: 'advocates', label: 'Referral advocates', value: formatNumber(agg.totalPartners), icon: 'users', tone: 'green' },
        { id: 'conversions', label: 'Successful referrals', value: formatNumber(agg.conversions), icon: 'cart', tone: 'amber' },
        { id: 'rewards', label: 'Reward payouts', value: money(agg.commissionPaid), icon: 'gift', tone: 'violet' },
        { id: 'rate', label: 'Referral conversion rate', value: agg.totalPartners > 0 ? `${Math.round((agg.conversions / agg.totalPartners) * 100)}%` : '0%', icon: 'trend', tone: 'green' },
        { id: 'pending', label: 'Pending approvals', value: formatNumber(agg.pendingApplications), icon: 'clock', tone: agg.pendingApplications > 0 ? 'amber' : 'slate' },
      ]
    case 'ambassadors':
      return [
        { id: 'ambassadors', label: 'Active ambassadors', value: formatNumber(agg.totalPartners), icon: 'users', tone: 'blue' },
        { id: 'content', label: 'Content pieces submitted', value: formatNumber(agg.assetsTotal), icon: 'clock', tone: 'blue' },
        { id: 'conversions', label: 'Ambassador conversions', value: formatNumber(agg.conversions), icon: 'cart', tone: 'green' },
        { id: 'commission', label: 'Commission paid', value: money(agg.commissionPaid), icon: 'wallet', tone: 'violet' },
        { id: 'reach', label: 'Social reach', value: formatNumber(series.primaryTotal), icon: 'trend', tone: 'green' },
        { id: 'review', label: 'Content awaiting review', value: formatNumber(agg.assetsAwaitingApproval), icon: 'alert', tone: agg.assetsAwaitingApproval > 0 ? 'amber' : 'slate' },
      ]
    case 'loyalty':
      return [
        { id: 'programmes', label: 'Active loyalty programmes', value: formatNumber(agg.activeProgrammes), icon: 'handshake', tone: 'blue' },
        { id: 'members', label: 'Members enrolled', value: formatNumber(agg.totalPartners), icon: 'users', tone: 'green' },
        { id: 'redeemed', label: 'Rewards redeemed', value: formatNumber(agg.rewardsRedeemed), icon: 'gift', tone: 'violet' },
        { id: 'cost', label: 'Commission or rewards paid', value: money(agg.commissionPaid), icon: 'wallet', tone: 'amber' },
        { id: 'repeat', label: 'Repeat purchase rate', value: `${agg.repeatPurchaseRate}%`, icon: 'refresh', tone: 'green' },
        { id: 'at_risk', label: 'Members at risk', value: formatNumber(agg.membersAtRisk), icon: 'alert', tone: agg.membersAtRisk > 0 ? 'red' : 'slate' },
      ]
    case 'resellers':
      return [
        { id: 'resellers', label: 'Active resellers', value: formatNumber(agg.totalPartners), icon: 'users', tone: 'blue' },
        { id: 'territories', label: 'Territories covered', value: formatNumber(agg.territoriesCovered), icon: 'globe', tone: 'green' },
        { id: 'deals', label: 'Reseller conversions', value: formatNumber(agg.conversions), icon: 'cart', tone: 'amber' },
        { id: 'rebates', label: 'Rebates owed', value: money(agg.rebatesOwed), icon: 'wallet', tone: 'violet' },
        { id: 'revenue', label: 'Reseller revenue', value: money(agg.revenue), icon: 'trend', tone: 'green' },
        { id: 'review', label: 'Accounts needing review', value: formatNumber(agg.atRiskPartners), icon: 'alert', tone: agg.atRiskPartners > 0 ? 'red' : 'slate' },
      ]
    case 'co_marketing':
      return [
        { id: 'programmes', label: 'Active co-marketing programmes', value: formatNumber(agg.activeProgrammes), icon: 'handshake', tone: 'blue' },
        { id: 'campaigns', label: 'Joint campaigns', value: formatNumber(agg.totalPartners), icon: 'users', tone: 'green' },
        { id: 'leads', label: 'Partner-sourced leads', value: formatNumber(agg.leadsCount), icon: 'click', tone: 'amber' },
        { id: 'spend', label: 'Shared spend', value: money(agg.sharedSpend), icon: 'wallet', tone: 'violet' },
        { id: 'revenue', label: 'Attributed revenue', value: money(agg.revenue), icon: 'trend', tone: 'green' },
        { id: 'assets', label: 'Assets awaiting approval', value: formatNumber(agg.assetsAwaitingApproval), icon: 'clock', tone: agg.assetsAwaitingApproval > 0 ? 'amber' : 'slate' },
      ]
    case 'affiliates':
      return [
        { id: 'affiliates', label: 'Total affiliates', value: formatNumber(agg.totalPartners), icon: 'users', tone: 'blue' },
        { id: 'programmes', label: 'Active programmes', value: formatNumber(agg.activeProgrammes), icon: 'handshake', tone: 'violet' },
        { id: 'conversions', label: 'Affiliate conversions', value: formatNumber(agg.conversions), icon: 'cart', tone: 'green' },
        { id: 'owed', label: 'Commission owed', value: money(agg.commissionOwed), icon: 'wallet', tone: 'amber' },
        { id: 'revenue', label: 'Affiliate revenue', value: money(agg.revenue), icon: 'trend', tone: 'green' },
        { id: 'applications', label: 'Applications pending', value: formatNumber(agg.pendingApplications), icon: 'clock', tone: agg.pendingApplications > 0 ? 'amber' : 'slate' },
      ]
    default:
      return base
  }
}

function buildNextActions(module: PartnershipModule, agg: Awaited<ReturnType<typeof partnershipAggregates>>) {
  const meta = PARTNERSHIP_MODULE_META[module]
  return [
    {
      id: 'applications', label: 'Approve partner applications', sub: `${agg.pendingApplications} pending applications`,
      count: agg.pendingApplications, href: '/app/partnerships/applications', tone: 'bg-blue-50 text-blue-600',
    },
    {
      id: 'payouts', label: 'Review commission payouts', sub: `${agg.pendingPayouts} payouts need review`,
      count: agg.pendingPayouts, href: '/app/partnerships/payouts', tone: 'bg-violet-50 text-violet-600',
    },
    {
      id: 'at_risk', label: 'Partners at risk', sub: `${agg.atRiskPartners} partners at risk`,
      count: agg.atRiskPartners, href: `${meta.href}?status=at_risk`, tone: 'bg-red-50 text-red-600',
    },
  ].filter(action => action.count > 0)
}
