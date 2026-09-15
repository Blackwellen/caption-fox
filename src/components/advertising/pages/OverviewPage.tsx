import Link from 'next/link'
import {
  BarChart3, DollarSign, Gauge, LineChart, Plug, Target, TrendingUp,
} from 'lucide-react'
import type { AdvertisingSession } from '@/lib/advertising/queries/context'
import { resolveRange, previousRange, kpi } from '@/lib/advertising/queries/shared'
import { getOverviewData, providerLabel } from '@/lib/advertising/queries/overview'
import {
  formatChange, formatCurrency, formatDateRange, formatNumber,
  formatPercent, formatRelativeTime, formatRoas,
} from '@/lib/advertising/metrics'
import PageHeader, { type HeaderAction } from '../PageHeader'
import KpiCard from '../KpiCard'
import Sparkline from '../Sparkline'
import ProviderLogo from '../ProviderLogo'
import StatusPill, { CAMPAIGN_STATUS, HEALTH_STATUS, ISSUE_SEVERITY } from '../StatusPill'
import { DateRangeSelect, ComparisonLabel } from '../Controls'
import { EmptyState, Panel, PanelHeader } from '../Primitives'

export default async function OverviewPage({
  session, searchParams,
}: { session: AdvertisingSession; searchParams: Record<string, string | string[] | undefined> }) {
  const range = resolveRange({ preset: firstParam(searchParams.range) })
  const compare = previousRange(range)
  const data = await getOverviewData(session.supabase, session.workspace.id, range)

  const base = session.basePath
  const canConnect = session.capabilities['accounts.connect']
  const canCreateCampaign = session.capabilities['campaigns.create']

  const rawHeaderActions: (HeaderAction | null)[] = [
    canConnect ? { key: 'connect', label: 'Connect Account', href: `${base}/accounts`, icon: <Plug size={14} /> } : null,
    canCreateCampaign ? { key: 'create', label: 'Create Campaign', href: `${base}/campaigns?create=1`, variant: 'primary', icon: <Target size={14} /> } : null,
    { key: 'export', label: 'Export', hasMenu: true },
  ]
  const headerActions = rawHeaderActions.filter((action): action is HeaderAction => action !== null)

  const spendKpi = kpi({
    id: 'spend', label: 'Total Spend', format: 'currency',
    current: data.currentTotals.spend, previous: data.previousTotals.spend,
    spark: data.spendSeries, tooltip: 'Total spend across every connected advertising account.',
  })
  const roasKpi = kpi({
    id: 'roas', label: 'ROAS (All)', format: 'roas',
    current: data.currentTotals.roas, previous: data.previousTotals.roas,
    spark: [], tooltip: 'Attributed revenue divided by spend, blended across platforms.',
  })
  const ctrKpi = kpi({
    id: 'ctr', label: 'CTR (All)', format: 'percent',
    current: data.currentTotals.ctr, previous: data.previousTotals.ctr,
    spark: [], tooltip: 'Clicks divided by impressions, blended across platforms.',
  })
  const conversionsKpi = kpi({
    id: 'conversions', label: 'Conversions', format: 'integer',
    current: data.currentTotals.conversions, previous: data.previousTotals.conversions,
    spark: [], tooltip: 'Attributed conversions across every connected account.',
  })
  const cpaKpi = kpi({
    id: 'cpa', label: 'CPA (All)', format: 'currency', inverse: true,
    current: data.currentTotals.cpa, previous: data.previousTotals.cpa,
    spark: [], tooltip: 'Spend divided by conversions. A lower CPA is better.',
  })
  const activeKpi = kpi({
    id: 'active', label: 'Active Campaigns', format: 'integer',
    current: data.activeCampaignCount, previous: data.previousActiveCampaignCount,
    spark: [], tooltip: 'Campaigns currently live on any connected platform.',
  })

  if (!data.hasAnyAccount) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader
          title="Advertising Overview" hint="Paid-media performance across every connected platform."
          subtitle="Monitor paid media performance, spend, and ad operations across all channels."
        />
        <EmptyState
          icon={<Plug size={30} />}
          title="Connect your first advertising account"
          description="Meta, Google, TikTok, LinkedIn and more — once an account is connected and synced, spend, performance and pacing appear here automatically."
          action={
            canConnect ? (
              <Link href={`${base}/accounts`} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-medium text-white shadow-sm hover:bg-blue-700">
                <Plug size={14} /> Connect Account
              </Link>
            ) : (
              <p className="text-[12.5px] text-slate-400">Ask a workspace admin to connect an advertising account.</p>
            )
          }
        />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Advertising Overview" hint="Blended totals across every connected platform, in the selected date range."
        subtitle="Monitor paid media performance, spend, and ad operations across all channels."
        actions={headerActions}
      >
        <DateRangeSelect currentLabel={formatDateRange(new Date(range.since), new Date(range.until))} className="w-44" />
        <ComparisonLabel label={formatDateRange(new Date(compare.since), new Date(compare.until))} />
      </PageHeader>

      {data.integrity.mixedCurrency && (
        <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
          Totals mix {data.integrity.currencies.join(', ')} accounts without conversion. Figures are summed as-is.
        </p>
      )}

      <section className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard kpi={spendKpi} icon={<DollarSign size={13} />} accent="#2563EB" comparisonLabel={compare.label} />
        <KpiCard kpi={roasKpi} icon={<TrendingUp size={13} />} accent="#7C3AED" comparisonLabel={compare.label} />
        <KpiCard kpi={ctrKpi} icon={<Target size={13} />} accent="#0D9488" comparisonLabel={compare.label} />
        <KpiCard kpi={conversionsKpi} icon={<Gauge size={13} />} accent="#EA580C" comparisonLabel={compare.label} />
        <KpiCard kpi={cpaKpi} icon={<LineChart size={13} />} accent="#0891B2" comparisonLabel={compare.label} />
        <KpiCard kpi={activeKpi} icon={<BarChart3 size={13} />} accent="#4F46E5" comparisonLabel={compare.label} />
      </section>

      <Panel className="mb-4">
        <PanelHeader title={`Connected Ad Accounts (${data.accounts.length})`} actionHref={`${base}/accounts`} actionLabel="View All Accounts" />
        {data.accounts.length === 0 ? (
          <EmptyState compact title="No accounts synced yet" description="Connect a platform to see spend and health here." />
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {data.accounts.slice(0, 4).map(account => {
              const health = HEALTH_STATUS[account.health] ?? HEALTH_STATUS.attention
              return (
                <div key={account.provider} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ProviderLogo provider={account.provider} size={26} tile />
                      <span className="text-[13px] font-semibold text-slate-900">{providerLabel(account.provider)}</span>
                    </div>
                    <StatusPill status={account.health} map={HEALTH_STATUS} label={health.label} />
                  </div>
                  <div className="mt-2.5 flex items-end justify-between">
                    <div>
                      <p className="text-[10.5px] font-medium uppercase tracking-wide text-slate-400">Spend ({Math.round((new Date(range.until).getTime() - new Date(range.since).getTime()) / 86400000) + 1}d)</p>
                      <p className="mt-0.5 text-[15px] font-bold text-slate-900">{formatCurrency(account.spend)}</p>
                      {account.spendChangePct !== null && (
                        <p className={`text-[11px] font-medium ${account.spendChangePct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {formatChange(account.spendChangePct)}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-[10.5px] font-medium uppercase tracking-wide text-slate-400">Accounts</p>
                      <p className="mt-0.5 text-[15px] font-bold text-slate-900">{account.accountCount}</p>
                    </div>
                  </div>
                  <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2">
                    <span className="flex items-center gap-1 text-[11px] text-slate-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
                      {account.lastSyncedAt ? `Synced ${formatRelativeTime(account.lastSyncedAt)}` : 'Not synced yet'}
                    </span>
                    <Link href={`${base}/accounts?provider=${account.provider}`} className="rounded border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50">View</Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Panel>

      <div className="mb-4 grid gap-4 xl:grid-cols-[1.7fr_1fr]">
        <Panel padded={false}>
          <div className="p-4 pb-0">
            <PanelHeader title="Campaign Performance" actionHref={`${base}/campaigns`} actionLabel="View All" />
          </div>
          {data.topCampaigns.length === 0 ? (
            <div className="p-4"><EmptyState compact title="No campaigns yet" description="Campaigns synced from your connected accounts will appear here." /></div>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-[13px]">
                <thead>
                  <tr className="border-y border-slate-100 text-[11px] uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-2 font-medium">Campaign</th>
                    <th className="px-3 py-2 text-right font-medium">Spend</th>
                    <th className="px-3 py-2 text-right font-medium">ROAS</th>
                    <th className="px-3 py-2 text-right font-medium">CTR</th>
                    <th className="px-3 py-2 text-right font-medium">Conversions</th>
                    <th className="px-3 py-2 text-right font-medium">CPA</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {data.topCampaigns.map(campaign => (
                    <tr key={campaign.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-2.5">
                        <Link href={`${base}/campaigns/${campaign.id}`} className="flex items-center gap-2 font-medium text-slate-800 hover:text-blue-700">
                          <ProviderLogo provider={campaign.provider} size={16} decorative />
                          <span className="truncate">{campaign.name}</span>
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency(campaign.spend)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{formatRoas(campaign.roas)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{formatPercent(campaign.ctr)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{formatNumber(campaign.conversions)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency(campaign.cpa)}</td>
                      <td className="px-3 py-2.5"><StatusPill status={campaign.status} map={CAMPAIGN_STATUS} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel>
          <PanelHeader title="Alerts & Recent Activity" actionHref={`${base}/accounts`} actionLabel="View All" />
          {data.alerts.length === 0 && data.activity.length === 0 ? (
            <EmptyState compact title="All clear" description="No open alerts and no recent activity." />
          ) : (
            <ul className="mt-3 space-y-3">
              {data.alerts.map(alert => (
                <li key={alert.id} className="flex gap-2.5">
                  <span className="mt-0.5"><StatusPill status={alert.severity} map={ISSUE_SEVERITY} dot label="" className="h-2 w-2 p-0" /></span>
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-medium text-slate-800">{alert.title}</p>
                    {alert.detail && <p className="mt-0.5 text-[11.5px] text-slate-500">{alert.detail}</p>}
                    <p className="mt-0.5 text-[10.5px] text-slate-400">{formatRelativeTime(alert.createdAt)}</p>
                  </div>
                </li>
              ))}
              {data.activity.slice(0, Math.max(0, 6 - data.alerts.length)).map(entry => (
                <li key={entry.id} className="flex gap-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" aria-hidden />
                  <div className="min-w-0">
                    <p className="text-[12.5px] text-slate-700">{entry.summary}</p>
                    <p className="mt-0.5 text-[10.5px] text-slate-400">{formatRelativeTime(entry.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel className="xl:col-span-1">
          <PanelHeader title="Creative Performance" actionHref={`${base}/creatives`} actionLabel="View All" />
          {data.topCreatives.length === 0 ? (
            <EmptyState compact title="No creatives yet" description="Creatives synced from your accounts will appear here." />
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              {data.topCreatives.map(creative => (
                <Link key={creative.id} href={`${base}/creatives?q=${encodeURIComponent(creative.name)}`} className="group rounded-lg border border-slate-200 p-2 hover:border-slate-300">
                  <div className="flex aspect-square items-center justify-center rounded-md bg-slate-100 text-slate-300">
                    <ProviderLogo provider={creative.provider} size={22} decorative />
                  </div>
                  <p className="mt-1.5 truncate text-[11.5px] font-medium text-slate-800">{creative.name}</p>
                  <div className="mt-0.5 flex items-center justify-between text-[10.5px] text-slate-500">
                    <span>{formatCurrency(creative.spend, undefined, { compact: true })}</span>
                    <span>{formatPercent(creative.ctr)}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Panel>

        <Panel className="xl:col-span-1">
          <PanelHeader title="Spend Trend" hint="Daily spend across the selected period" />
          <div className="mt-4 h-40">
            <Sparkline points={data.spendSeries} color="#2563EB" height={160} fill strokeWidth={2} summary="Daily spend trend" />
          </div>
          <div className="mt-2 flex justify-between text-[10.5px] text-slate-400">
            <span>{formatDateRange(new Date(range.since), new Date(range.since))}</span>
            <span>{formatDateRange(new Date(range.until), new Date(range.until))}</span>
          </div>
        </Panel>

        <Panel className="xl:col-span-1">
          <PanelHeader title="Budget Pacing" actionHref={`${base}/campaigns`} actionLabel="Manage budgets" />
          {data.budgetPacing.length === 0 ? (
            <EmptyState compact title="No active budgets" description="Campaigns with a set budget and live dates will show pacing here." />
          ) : (
            <div className="mt-3 space-y-2.5">
              {data.budgetPacing.map(campaign => (
                <div key={campaign.id}>
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="truncate font-medium text-slate-700">{campaign.name}</span>
                    <span className="tabular-nums text-slate-500">{formatCurrency(campaign.spend, undefined, { compact: true })} / {formatCurrency(campaign.budget, undefined, { compact: true })}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${campaign.band === 'over' ? 'bg-red-500' : campaign.band === 'under' ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      style={{ width: `${Math.min(100, campaign.pct)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  )
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}
