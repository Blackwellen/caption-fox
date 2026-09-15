import Link from 'next/link'
import type { ReactNode } from 'react'
import { BarChart3, DollarSign, Gauge, MousePointerClick, Target, TrendingUp } from 'lucide-react'
import type { AdvertisingSession } from '@/lib/advertising/queries/context'
import { kpi, loadMetrics, previousRange, resolveRange, series, totals } from '@/lib/advertising/queries/shared'
import {
  formatCurrency, formatNumber, formatPercent, formatRelativeTime,
} from '@/lib/advertising/metrics'
import { AD_PROVIDERS, type AdProvider } from '@/lib/advertising/providers'
import BackLink from '@/components/ui/BackLink'
import { PageTrail } from '@/components/ui/Breadcrumbs'
import KpiCard from '../KpiCard'
import ProviderLogo from '../ProviderLogo'
import StatusPill, {
  AUDIENCE_STATUS, AUDIENCE_TYPE_LABELS, CAMPAIGN_STATUS, FORMAT_LABELS, HEALTH_STATUS, OBJECTIVE_LABELS, REVIEW_STATUS,
} from '../StatusPill'
import { EmptyState, Panel, PanelHeader } from '../Primitives'
import { DateRangeSelect } from '../Controls'

// Detail pages for one advertising record: /{type}/advertising/{module}/{id}.
//
// Every read goes through the member's RLS-scoped client AND an explicit
// workspace_id filter, so a record id from another workspace resolves to the
// not-found state rather than leaking. Each page carries a Back link to its
// parent list and links onward to its related records.

type SearchParams = Record<string, string | string[] | undefined>
type DetailProps = { session: AdvertisingSession; id: string; searchParams: SearchParams }

const providerName = (provider: string) => AD_PROVIDERS[provider as AdProvider]?.name ?? provider
const firstParam = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)
const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)

/** "← Back to Campaigns | Advertising › Campaigns › {record}" */
function Trail({ base, module, moduleLabel, recordLabel }: { base: string; module: string; moduleLabel: string; recordLabel: string }) {
  return (
    <PageTrail
      back={{ href: `${base}/${module}`, label: `Back to ${moduleLabel}` }}
      crumbs={[{ label: 'Advertising', href: base }, { label: moduleLabel, href: `${base}/${module}` }, { label: recordLabel }]}
    />
  )
}

function NotFound({ backHref, backLabel, noun }: { backHref: string; backLabel: string; noun: string }) {
  return (
    <div>
      <BackLink href={backHref} label={backLabel} />
      <EmptyState
        title={`This ${noun} could not be found`}
        description={`It may have been removed, or it belongs to a workspace you do not have access to.`}
        action={<Link href={backHref} className="text-[13px] font-medium text-blue-600 hover:underline">{backLabel}</Link>}
      />
    </div>
  )
}

function DetailHeader({ title, provider, meta, status, actions }: {
  title: string; provider: string; meta: ReactNode; status: ReactNode; actions?: ReactNode
}) {
  return (
    <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <ProviderLogo provider={provider} size={40} tile />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-[24px] font-semibold leading-tight tracking-[-0.01em] text-slate-900">{title}</h1>
            {status}
          </div>
          <p className="mt-1 text-[13px] text-slate-500">{meta}</p>
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  )
}

/** KPI strip for one entity, from its own daily metric rows. */
async function EntityKpis({ session, entityType, id, searchParams }: {
  session: AdvertisingSession; entityType: 'account' | 'campaign' | 'creative' | 'audience'; id: string; searchParams: SearchParams
}) {
  const range = resolveRange({ preset: firstParam(searchParams.range) })
  const compare = previousRange(range)
  const [current, previous] = await Promise.all([
    loadMetrics(session.supabase, { workspaceId: session.workspace.id, entityType, range, entityIds: [id] }),
    loadMetrics(session.supabase, { workspaceId: session.workspace.id, entityType, range: compare, entityIds: [id] }),
  ])
  const now = totals(current)
  const before = totals(previous)
  const cards = [
    { value: kpi({ id: 'spend', label: 'Spend', format: 'currency', current: now.spend, previous: before.spend, spark: series(current, range, 'spend'), tooltip: 'Spend in the selected range.' }), icon: <DollarSign size={13} />, accent: '#2563EB' },
    { value: kpi({ id: 'roas', label: 'ROAS', format: 'roas', current: now.roas, previous: before.roas, spark: series(current, range, 'roas'), tooltip: 'Revenue divided by spend.' }), icon: <TrendingUp size={13} />, accent: '#7C3AED' },
    { value: kpi({ id: 'ctr', label: 'CTR', format: 'percent', current: now.ctr, previous: before.ctr, spark: series(current, range, 'ctr'), tooltip: 'Clicks divided by impressions.' }), icon: <Target size={13} />, accent: '#0D9488' },
    { value: kpi({ id: 'clicks', label: 'Clicks', format: 'integer', current: now.clicks, previous: before.clicks, spark: series(current, range, 'clicks'), tooltip: 'Link clicks.' }), icon: <MousePointerClick size={13} />, accent: '#0891B2' },
    { value: kpi({ id: 'conversions', label: 'Conversions', format: 'integer', current: now.conversions, previous: before.conversions, spark: series(current, range, 'conversions'), tooltip: 'Attributed conversions.' }), icon: <Gauge size={13} />, accent: '#EA580C' },
    { value: kpi({ id: 'cpa', label: 'CPA', format: 'currency', inverse: true, current: now.cpa, previous: before.cpa, spark: series(current, range, 'cpa'), tooltip: 'Spend divided by conversions.' }), icon: <BarChart3 size={13} />, accent: '#4F46E5' },
  ]
  return (
    <section className="mb-2 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
      {cards.map(card => <KpiCard key={card.value.id} kpi={card.value} icon={card.icon} accent={card.accent} comparisonLabel={compare.label} />)}
    </section>
  )
}

function Facts({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="mt-3 divide-y divide-slate-100">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-center justify-between gap-4 py-2 text-[12.5px]">
          <dt className="text-slate-500">{label}</dt>
          <dd className="min-w-0 truncate text-right font-medium text-slate-800">{value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  )
}

async function ActivityPanel({ session, entityIds }: { session: AdvertisingSession; entityIds: string[] }) {
  const { data } = await session.supabase
    .from('ad_activity')
    .select('id, summary, actor_label, created_at')
    .eq('workspace_id', session.workspace.id)
    .in('entity_id', entityIds)
    .order('created_at', { ascending: false })
    .limit(8)
  return (
    <Panel>
      <PanelHeader title="Activity" />
      {!data?.length ? (
        <EmptyState compact title="No activity yet" description="Changes, syncs and approvals for this record appear here." className="mt-3" />
      ) : (
        <ul className="mt-3 space-y-3">
          {data.map(entry => (
            <li key={entry.id as string} className="text-[12.5px]">
              <p className="text-slate-700">{entry.summary as string}</p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                {entry.actor_label ? `${entry.actor_label} · ` : ''}{formatRelativeTime(entry.created_at as string)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

// ------------------------------------------------------------- campaign

export async function CampaignDetailPage({ session, id, searchParams }: DetailProps) {
  const base = session.basePath
  const back = { href: `${base}/campaigns`, label: 'Back to Campaigns' }
  if (!isUuid(id)) return <NotFound backHref={back.href} backLabel={back.label} noun="campaign" />

  const { data: campaign } = await session.supabase
    .from('ad_campaigns')
    .select('id, name, provider, objective, status, budget_amount, budget_type, currency, starts_at, ends_at, attribution_window, account_id, ad_accounts(name)')
    .eq('workspace_id', session.workspace.id).eq('id', id).maybeSingle()
  if (!campaign) return <NotFound backHref={back.href} backLabel={back.label} noun="campaign" />

  const [{ data: creatives }, { data: audienceLinks }] = await Promise.all([
    session.supabase.from('ad_creatives').select('id, name, format, review_status').eq('workspace_id', session.workspace.id).eq('campaign_id', id).limit(20),
    session.supabase.from('ad_audience_campaigns').select('ad_audiences(id, name, audience_type)').eq('workspace_id', session.workspace.id).eq('campaign_id', id),
  ])
  const account = campaign.ad_accounts as unknown as { name: string } | null
  const audiences = (audienceLinks ?? []).map(link => link.ad_audiences as unknown as { id: string; name: string; audience_type: string } | null).filter(Boolean) as { id: string; name: string; audience_type: string }[]

  return (
    <div>
      <Trail base={base} module="campaigns" moduleLabel="Campaigns" recordLabel={campaign.name as string} />
      <DetailHeader
        title={campaign.name as string}
        provider={campaign.provider as string}
        status={<StatusPill status={campaign.status as string} map={CAMPAIGN_STATUS} />}
        meta={<>{providerName(campaign.provider as string)} · {OBJECTIVE_LABELS[campaign.objective as string] ?? campaign.objective} · {account?.name ?? 'Unknown account'}</>}
        actions={<DateRangeSelect currentLabel="Date range" className="w-40" />}
      />
      <EntityKpis session={session} entityType="campaign" id={id} searchParams={searchParams} />
      <div className="grid gap-2 xl:grid-cols-3">
        <Panel>
          <PanelHeader title="Campaign details" />
          <Facts rows={[
            ['Account', account ? <Link href={`${base}/accounts/${campaign.account_id}`} className="text-blue-600 hover:underline">{account.name}</Link> : null],
            ['Budget', campaign.budget_amount !== null ? `${formatCurrency(Number(campaign.budget_amount), campaign.currency as string)} (${campaign.budget_type ?? 'lifetime'})` : null],
            ['Starts', campaign.starts_at ? new Date(campaign.starts_at as string).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null],
            ['Ends', campaign.ends_at ? new Date(campaign.ends_at as string).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null],
            ['Attribution', (campaign.attribution_window as string).replace(/_/g, ' ')],
          ]} />
        </Panel>
        <Panel>
          <PanelHeader title={`Creatives (${creatives?.length ?? 0})`} actionHref={`${base}/creatives`} actionLabel="All creatives" />
          {!creatives?.length ? <EmptyState compact title="No creatives" description="Creatives attached to this campaign appear here." className="mt-3" /> : (
            <ul className="mt-3 divide-y divide-slate-100">
              {creatives.map(creative => (
                <li key={creative.id as string} className="flex items-center justify-between gap-3 py-2 text-[12.5px]">
                  <Link href={`${base}/creatives/${creative.id}`} className="min-w-0 truncate font-medium text-slate-800 hover:text-blue-700">{creative.name as string}</Link>
                  <StatusPill status={creative.review_status as string} map={REVIEW_STATUS} dot={false} />
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 border-t border-slate-100 pt-3">
            <PanelHeader title={`Audiences (${audiences.length})`} />
            {audiences.length === 0 ? <p className="mt-2 text-[12px] text-slate-400">No audiences linked.</p> : (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {audiences.map(audience => (
                  <li key={audience.id}><Link href={`${base}/audiences/${audience.id}`} className="inline-flex rounded-md bg-slate-100 px-2 py-1 text-[11.5px] font-medium text-slate-600 hover:bg-blue-50 hover:text-blue-700">{audience.name}</Link></li>
                ))}
              </ul>
            )}
          </div>
        </Panel>
        <ActivityPanel session={session} entityIds={[id]} />
      </div>
    </div>
  )
}

// -------------------------------------------------------------- account

export async function AccountDetailPage({ session, id, searchParams }: DetailProps) {
  const base = session.basePath
  const back = { href: `${base}/accounts`, label: 'Back to Accounts' }
  if (!isUuid(id)) return <NotFound backHref={back.href} backLabel={back.label} noun="account" />

  const { data: account } = await session.supabase
    .from('ad_accounts')
    .select('id, name, provider, external_id, currency, timezone, sync_status, mapping_label, scopes, last_synced_at')
    .eq('workspace_id', session.workspace.id).eq('id', id).maybeSingle()
  if (!account) return <NotFound backHref={back.href} backLabel={back.label} noun="account" />

  const [{ data: campaigns }, { data: issues }] = await Promise.all([
    session.supabase.from('ad_campaigns').select('id, name, status, objective').eq('workspace_id', session.workspace.id).eq('account_id', id).order('updated_at', { ascending: false }).limit(25),
    session.supabase.from('ad_issues').select('id, title, detail, required_action, severity').eq('workspace_id', session.workspace.id).eq('account_id', id).is('resolved_at', null),
  ])

  return (
    <div>
      <Trail base={base} module="accounts" moduleLabel="Accounts" recordLabel={account.name as string} />
      <DetailHeader
        title={account.name as string}
        provider={account.provider as string}
        status={<StatusPill status={account.sync_status as string} map={HEALTH_STATUS} />}
        meta={<>{providerName(account.provider as string)} · {account.external_id as string} · Last synced {formatRelativeTime(account.last_synced_at as string | null)}</>}
        actions={<DateRangeSelect currentLabel="Date range" className="w-40" />}
      />
      {issues && issues.length > 0 && (
        <div className="mb-4 space-y-2">
          {issues.map(issue => (
            <div key={issue.id as string} role="alert" className="rounded-lg border border-red-200 bg-red-50/70 px-4 py-3 text-[12.5px]">
              <p className="font-semibold text-red-900">{issue.title as string}</p>
              {issue.detail && <p className="mt-0.5 text-red-800/90">{issue.detail as string}</p>}
              {issue.required_action && <p className="mt-1 font-medium text-red-700">{issue.required_action as string}</p>}
            </div>
          ))}
        </div>
      )}
      <EntityKpis session={session} entityType="account" id={id} searchParams={searchParams} />
      <div className="grid gap-2 xl:grid-cols-3">
        <Panel>
          <PanelHeader title="Account details" />
          <Facts rows={[
            ['Platform', providerName(account.provider as string)],
            ['Workspace mapping', account.mapping_label as string | null],
            ['Currency', account.currency as string],
            ['Time zone', account.timezone as string],
            ['Granted scopes', `${((account.scopes as string[] | null) ?? []).length}`],
          ]} />
        </Panel>
        <Panel className="xl:col-span-1">
          <PanelHeader title={`Campaigns (${campaigns?.length ?? 0})`} actionHref={`${base}/campaigns?platform=${account.provider}`} actionLabel="View in Campaigns" />
          {!campaigns?.length ? <EmptyState compact title="No campaigns" description="Campaigns synced from this account appear here." className="mt-3" /> : (
            <ul className="mt-3 divide-y divide-slate-100">
              {campaigns.map(campaign => (
                <li key={campaign.id as string} className="flex items-center justify-between gap-3 py-2 text-[12.5px]">
                  <Link href={`${base}/campaigns/${campaign.id}`} className="min-w-0 truncate font-medium text-slate-800 hover:text-blue-700">{campaign.name as string}</Link>
                  <StatusPill status={campaign.status as string} map={CAMPAIGN_STATUS} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <ActivityPanel session={session} entityIds={[id]} />
      </div>
    </div>
  )
}

// ------------------------------------------------------------- creative

export async function CreativeDetailPage({ session, id, searchParams }: DetailProps) {
  const base = session.basePath
  const back = { href: `${base}/creatives`, label: 'Back to Creatives' }
  if (!isUuid(id)) return <NotFound backHref={back.href} backLabel={back.label} noun="creative" />

  const { data: creative } = await session.supabase
    .from('ad_creatives')
    .select('id, name, provider, format, status, review_status, provider_feedback, internal_feedback, aspect_ratio, duration_seconds, headline, destination_url, is_winning_variant, updated_at, campaign_id, ad_campaigns(name)')
    .eq('workspace_id', session.workspace.id).eq('id', id).maybeSingle()
  if (!creative) return <NotFound backHref={back.href} backLabel={back.label} noun="creative" />
  const campaign = creative.ad_campaigns as unknown as { name: string } | null

  return (
    <div>
      <Trail base={base} module="creatives" moduleLabel="Creatives" recordLabel={creative.name as string} />
      <DetailHeader
        title={creative.name as string}
        provider={creative.provider as string}
        status={<><StatusPill status={creative.status as string} map={CAMPAIGN_STATUS} /><StatusPill status={creative.review_status as string} map={REVIEW_STATUS} dot={false} /></>}
        meta={<>{FORMAT_LABELS[creative.format as string] ?? creative.format} · {providerName(creative.provider as string)} · Updated {formatRelativeTime(creative.updated_at as string)}</>}
        actions={<DateRangeSelect currentLabel="Date range" className="w-40" />}
      />
      {creative.provider_feedback && (
        <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50/70 px-4 py-3 text-[12.5px]">
          <p className="font-semibold text-red-900">Platform feedback</p>
          <p className="mt-0.5 text-red-800/90">{creative.provider_feedback as string}</p>
        </div>
      )}
      <EntityKpis session={session} entityType="creative" id={id} searchParams={searchParams} />
      <div className="grid gap-2 xl:grid-cols-3">
        <Panel>
          <PanelHeader title="Creative details" />
          <Facts rows={[
            ['Campaign', campaign && creative.campaign_id ? <Link href={`${base}/campaigns/${creative.campaign_id}`} className="text-blue-600 hover:underline">{campaign.name}</Link> : null],
            ['Aspect ratio', creative.aspect_ratio as string | null],
            ['Duration', creative.duration_seconds ? `${Number(creative.duration_seconds)}s` : null],
            ['Headline', creative.headline as string | null],
            ['Winning variant', creative.is_winning_variant ? 'Yes' : 'No'],
          ]} />
        </Panel>
        <Panel>
          <PanelHeader title="Internal review" />
          <p className="mt-3 text-[12.5px] text-slate-600">{(creative.internal_feedback as string | null) ?? 'No internal feedback recorded.'}</p>
        </Panel>
        <ActivityPanel session={session} entityIds={[id]} />
      </div>
    </div>
  )
}

// ------------------------------------------------------------- audience

export async function AudienceDetailPage({ session, id, searchParams }: DetailProps) {
  const base = session.basePath
  const back = { href: `${base}/audiences`, label: 'Back to Audiences' }
  if (!isUuid(id)) return <NotFound backHref={back.href} backLabel={back.label} noun="audience" />

  const { data: audience } = await session.supabase
    .from('ad_audiences')
    .select('id, name, provider, audience_type, description, size_estimate, matched_users, match_rate, recency_days, refresh_schedule, refresh_status, last_refreshed_at')
    .eq('workspace_id', session.workspace.id).eq('id', id).maybeSingle()
  if (!audience) return <NotFound backHref={back.href} backLabel={back.label} noun="audience" />

  const [{ data: links }, { data: overlaps }] = await Promise.all([
    session.supabase.from('ad_audience_campaigns').select('ad_campaigns(id, name, status)').eq('workspace_id', session.workspace.id).eq('audience_id', id),
    session.supabase.from('ad_audience_overlaps')
      .select('overlap_pct, audience_a_id, audience_b_id, a:ad_audiences!ad_audience_overlaps_audience_a_id_fkey(id, name), b:ad_audiences!ad_audience_overlaps_audience_b_id_fkey(id, name)')
      .eq('workspace_id', session.workspace.id).or(`audience_a_id.eq.${id},audience_b_id.eq.${id}`),
  ])
  const campaigns = (links ?? []).map(link => link.ad_campaigns as unknown as { id: string; name: string; status: string } | null).filter(Boolean) as { id: string; name: string; status: string }[]

  return (
    <div>
      <Trail base={base} module="audiences" moduleLabel="Audiences" recordLabel={audience.name as string} />
      <DetailHeader
        title={audience.name as string}
        provider={audience.provider as string}
        status={<StatusPill status={audience.refresh_status as string} map={AUDIENCE_STATUS} />}
        meta={<>{AUDIENCE_TYPE_LABELS[audience.audience_type as string] ?? audience.audience_type} · {providerName(audience.provider as string)} · Refreshed {formatRelativeTime(audience.last_refreshed_at as string | null)}</>}
        actions={<DateRangeSelect currentLabel="Date range" className="w-40" />}
      />
      <EntityKpis session={session} entityType="audience" id={id} searchParams={searchParams} />
      <div className="grid gap-2 xl:grid-cols-3">
        <Panel>
          <PanelHeader title="Audience details" />
          <Facts rows={[
            ['Size', formatNumber(Number(audience.size_estimate), { compact: true })],
            ['Matched users', formatNumber(Number(audience.matched_users), { compact: true })],
            ['Match rate', formatPercent(Number(audience.match_rate))],
            ['Recency window', audience.recency_days ? `${audience.recency_days} days` : null],
            ['Refresh', audience.refresh_schedule as string | null],
          ]} />
          <p className="mt-3 text-[11px] text-slate-400">Aggregate counts only — individual audience members are never shown.</p>
        </Panel>
        <Panel>
          <PanelHeader title={`Linked campaigns (${campaigns.length})`} />
          {campaigns.length === 0 ? <EmptyState compact title="Not used yet" description="Campaigns targeting this audience appear here." className="mt-3" /> : (
            <ul className="mt-3 divide-y divide-slate-100">
              {campaigns.map(campaign => (
                <li key={campaign.id} className="flex items-center justify-between gap-3 py-2 text-[12.5px]">
                  <Link href={`${base}/campaigns/${campaign.id}`} className="min-w-0 truncate font-medium text-slate-800 hover:text-blue-700">{campaign.name}</Link>
                  <StatusPill status={campaign.status} map={CAMPAIGN_STATUS} />
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 border-t border-slate-100 pt-3">
            <PanelHeader title="Overlap" />
            {!overlaps?.length ? <p className="mt-2 text-[12px] text-slate-400">No measured overlap.</p> : (
              <ul className="mt-2 space-y-1.5">
                {overlaps.map(row => {
                  const other = (row.audience_a_id === id ? row.b : row.a) as unknown as { id: string; name: string } | null
                  const pct = Number(row.overlap_pct)
                  return (
                    <li key={`${row.audience_a_id}-${row.audience_b_id}`} className="flex items-center justify-between text-[12px]">
                      {other ? <Link href={`${base}/audiences/${other.id}`} className="truncate text-slate-700 hover:text-blue-700">{other.name}</Link> : <span>—</span>}
                      <span className={pct > 30 ? 'font-semibold text-red-600' : 'text-slate-600'}>{pct.toFixed(0)}%</span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </Panel>
        <ActivityPanel session={session} entityIds={[id]} />
      </div>
    </div>
  )
}

