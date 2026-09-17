import Link from 'next/link'
import type { ReactNode } from 'react'
import {
  AlertTriangle, ArrowRight, BarChart3, ChevronDown, Clock3, Globe, Image as ImageIcon, LayoutGrid, Link2, MessageSquare, Plus,
  RefreshCw, Send, ShieldCheck, Table2, User, Users, Activity,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { PERMISSIONS } from '@/lib/permissions'
import {
  getChannels, getConnectionHealthSeries, getConnectionIssues, getHealthByChannel, getSyncRuns, getWebhookEvents,
} from '@/lib/social/queries'
import { getSyncStats } from '@/lib/social/connections-queries'
import { canAccessSocialCapability, canConnectAnotherChannel } from '@/lib/social/entitlements'
import { providerConfigured } from '@/lib/social/oauth'
import { changePct, previousRange, rangeFromDays, shortDay } from '@/lib/social/metrics'
import { parseDays, parseEnum, withParams } from '@/lib/social/url-state'
import { SOCIAL_PROVIDERS, type SocialChannelRow, type SocialProvider } from '@/types/social'
import Sparkline from '@/components/advertising/Sparkline'
import { ScrollRow } from '@/components/advertising/MiniControls'
import type { SocialPageProps } from '../SocialRoute'
import { SocialHeader } from '../Header'
import { Avatar, Badge, Card, CardTitle, Delta, EmptyNote, fmtTime, HEALTH, LineChart, PROVIDER_NAMES, ProviderIcon, TextLink } from '../kit'
import { FieldSelect, FilterPopover, Kebab, Menu, PillSelect } from '../controls'
import { ConnectChannelDialog, RefreshButton, SyncNowButton } from '../connections/ConnectionsClient'

// /{type}/social/connections — Social Connections, built to design reference (5).
// Header filters · view toggle · six KPI cards · connected channel cards (or
// accounts table / health view) · Connected Accounts | Source Health Overview |
// Sync History · Webhook / Activity Log | Issues & Alerts.

const VIEWS = ['cards', 'table', 'health'] as const
const PLATFORM_ORDER: SocialProvider[] = ['instagram', 'tiktok', 'facebook', 'linkedin', 'youtube', 'x', 'pinterest', 'threads']
const MONTH_DAY = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const SYNC_STATUS: Record<string, { label: string; tone: 'green' | 'amber' | 'red' | 'blue' }> = {
  success: { label: 'Success', tone: 'green' }, partial: { label: 'Partial', tone: 'amber' }, failed: { label: 'Failed', tone: 'red' }, running: { label: 'Running', tone: 'blue' },
}
const ACCOUNT_TYPE: Record<string, string> = { business: 'Business', creator: 'Creator', page: 'Page', company_page: 'Company Page', channel: 'Channel', personal: 'Personal' }
const ISSUE_ACTION: Record<string, string> = { renew_token: 'Renew Token', review_access: 'Review Access', update_scopes: 'Update Scopes' }
const WEBHOOK_LABEL: Record<string, string> = {}

function scopeIcon(scope: string): ReactNode {
  const value = scope.toLowerCase()
  if (/publish|write|post|upload/.test(value)) return <Send size={12} aria-hidden />
  if (/insight|analytics|stats|report/.test(value)) return <BarChart3 size={12} aria-hidden />
  if (/comment|message|dm|engagement/.test(value)) return <MessageSquare size={12} aria-hidden />
  if (/media|video|list/.test(value)) return <ImageIcon size={12} aria-hidden />
  if (/profile|basic|user|member/.test(value)) return <User size={12} aria-hidden />
  return <Globe size={12} aria-hidden />
}

const fullDateTime = (iso: string) => `${MONTH_DAY.format(new Date(iso))} ${new Date(iso).getUTCFullYear()}, ${fmtTime(iso)}`

export default async function ConnectionsPage({ session, searchParams, nav }: SocialPageProps) {
  const base = session.basePath
  const days = parseDays(searchParams.days)
  const range = rangeFromDays(days)
  const prev = previousRange(range)
  const view = parseEnum(searchParams.view, VIEWS, 'cards')
  const healthFilter = parseEnum(searchParams.health, ['', 'healthy', 'warning', 'error', 'expired', 'syncing', 'disconnected'] as const, '') || null
  const typeFilter = parseEnum(searchParams.type, ['', ...SOCIAL_PROVIDERS] as const, '') || null
  const teamFilter = typeof searchParams.team === 'string' ? searchParams.team.slice(0, 60) : null

  const allChannels = await getChannels(session)
  const channels = allChannels
    .filter(channel => (!healthFilter || channel.health === healthFilter) && (!typeFilter || channel.platform === typeFilter) && (!teamFilter || channel.team_label === teamFilter))
    .sort((a, b) => PLATFORM_ORDER.indexOf(a.platform) - PLATFORM_ORDER.indexOf(b.platform) || (a.team_label ?? '').localeCompare(b.team_label ?? ''))

  const [runs, events, issues, healthSeries, healthByChannel, stats] = await Promise.all([
    getSyncRuns(session, 40),
    getWebhookEvents(session, 5),
    getConnectionIssues(session),
    getConnectionHealthSeries(session, range),
    getHealthByChannel(session, range, channels),
    getSyncStats(session, range, prev),
  ])

  const channelById = new Map(allChannels.map(channel => [channel.id, channel]))
  const teams = [...new Set(allChannels.map(channel => channel.team_label).filter((team): team is string => Boolean(team)))]
  const connectedBefore = allChannels.filter(channel => channel.connected_at && new Date(channel.connected_at) < range.from).length
  const expiring = allChannels.filter(channel => channel.token_status === 'expiring' || (channel.token_expires_at && new Date(channel.token_expires_at).getTime() - range.to.getTime() < 7 * 24 * 60 * 60 * 1000))
  const healthy = allChannels.filter(channel => channel.health === 'healthy')
  const compare = `vs ${MONTH_DAY.format(prev.from)} – ${MONTH_DAY.format(prev.to)}`
  const daily = stats.daily.map(day => ({ date: day.date, value: day.total }))

  const canConnect = canConnectAnotherChannel(session.ctx)
  const canSync = session.can(PERMISSIONS.SOCIAL_CONNECTIONS_SYNC)
  const canEdit = session.can(PERMISSIONS.SOCIAL_CONNECTIONS_EDIT)
  const connectAccess = canAccessSocialCapability(session.ctx, PERMISSIONS.SOCIAL_CONNECTIONS_CONNECT)
  const latestRunByChannel = new Map<string, (typeof runs)[number]>()
  for (const run of runs) if (!latestRunByChannel.has(run.channel_id)) latestRunByChannel.set(run.channel_id, run)

  const kpis: { label: string; value: number; delta: number | null; inverse?: boolean; icon: ReactNode; tile: string; color: string; series: { date: string; value: number }[] }[] = [
    { label: 'Connected Channels', value: allChannels.length, delta: changePct(allChannels.length, connectedBefore || null), icon: <Link2 size={17} />, tile: 'bg-blue-50 text-blue-600', color: '#3B6FF5', series: daily },
    { label: 'Healthy Connections', value: healthy.length, delta: null, icon: <ShieldCheck size={17} />, tile: 'bg-emerald-50 text-emerald-600', color: '#22C55E', series: stats.daily.map(day => ({ date: day.date, value: day.success })) },
    { label: 'Sync Errors', value: stats.failed, delta: changePct(stats.failed, stats.failedPrev || null), inverse: true, icon: <AlertTriangle size={17} />, tile: 'bg-red-50 text-red-600', color: '#EF4444', series: stats.daily.map(day => ({ date: day.date, value: day.failed })) },
    { label: 'Expiring Tokens', value: expiring.length, delta: null, inverse: true, icon: <Clock3 size={17} />, tile: 'bg-amber-50 text-amber-600', color: '#F59E0B', series: daily },
    { label: 'Mapped Teams', value: teams.length, delta: null, icon: <Users size={17} />, tile: 'bg-blue-50 text-blue-600', color: '#3B6FF5', series: daily },
    { label: 'Recent Syncs', value: stats.runs, delta: changePct(stats.runs, stats.runsPrev || null), icon: <RefreshCw size={17} />, tile: 'bg-blue-50 text-blue-600', color: '#3B6FF5', series: daily },
  ]

  const providers = PLATFORM_ORDER.map(provider => ({
    provider, name: PROVIDER_NAMES[provider], configured: providerConfigured(provider),
    connected: allChannels.filter(channel => channel.platform === provider).length,
    note: providerConfigured(provider) ? 'Sign in with the platform to authorise access.' : 'Waiting for the platform app credentials on this deployment.',
  }))
  const connectBlocked = connectAccess.allowed ? (canConnect.allowed ? null : canConnect.message) : connectAccess.message

  return (
    <>
      <SocialHeader
        title="Social Connections"
        subtitle="Manage connected sources, sync health, permissions, and account mappings."
        nav={nav}
        note={false}
        actions={(
          <>
            <FilterPopover activeCount={[healthFilter, typeFilter, teamFilter].filter(Boolean).length} clearKeys={['health', 'type', 'team']}>
              <FieldSelect paramKey="days" label="Sync window" allLabel="Last 7 days" options={[{ value: '14', label: 'Last 14 days' }, { value: '30', label: 'Last 30 days' }]} />
            </FilterPopover>
            <PillSelect paramKey="health" label="Health" allLabel="Health: All" options={['healthy', 'warning', 'error', 'expired', 'disconnected'].map(value => ({ value, label: `Health: ${HEALTH[value].label}` }))} className="min-w-[118px]" />
            <PillSelect paramKey="type" label="Channel type" allLabel="Channel Type: All" options={PLATFORM_ORDER.map(value => ({ value, label: `Channel Type: ${PROVIDER_NAMES[value]}` }))} className="min-w-[148px]" />
            <PillSelect paramKey="team" label="Team" allLabel="Team: All" options={teams.map(team => ({ value: team, label: `Team: ${team}` }))} className="min-w-[112px]" />
            <div className="inline-flex rounded-lg shadow-sm">
              {connectBlocked
                ? <button type="button" disabled title={connectBlocked} className="inline-flex h-10 cursor-not-allowed items-center gap-2 rounded-l-lg bg-blue-600 px-5 text-[13px] font-semibold text-white opacity-55 lg:h-[34px] lg:text-[11.5px]"><Plus size={15} aria-hidden /> Connect Channel</button>
                : <Link href={withParams(searchParams, { connect: '1' })} scroll={false} className="inline-flex h-10 items-center gap-2 rounded-l-lg bg-blue-600 px-5 text-[13px] font-semibold text-white hover:bg-blue-700 lg:h-[34px] lg:px-6 lg:text-[11.5px]"><Plus size={15} aria-hidden /> Connect Channel</Link>}
              <Menu label="More connection actions" width="w-56" triggerClassName="inline-flex h-10 items-center rounded-r-lg border-l border-white/25 bg-blue-600 px-2.5 text-white hover:bg-blue-700 lg:h-[34px]" trigger={<ChevronDown size={15} aria-hidden />}>
                <Link href={withParams(searchParams, { view: 'health' })}>Review connection health</Link>
                <Link href={withParams(searchParams, { health: 'warning' })}>Connections needing attention</Link>
                {session.can(PERMISSIONS.SOCIAL_ANALYTICS_EXPORT) && <a href="/api/social/export?dataset=connections&format=csv" download>Export connections (CSV)</a>}
              </Menu>
            </div>
          </>
        )}
      />

      <div className="-mt-1 mb-3 flex items-center justify-end gap-2">
        <div role="tablist" aria-label="Connections view" className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
          {([['cards', 'Cards', <LayoutGrid key="c" size={13} aria-hidden />], ['table', 'Table', <Table2 key="t" size={13} aria-hidden />], ['health', 'Health', <Activity key="h" size={13} aria-hidden />]] as const).map(([value, label, icon]) => (
            <Link key={value} role="tab" aria-selected={view === value} scroll={false} href={withParams(searchParams, { view: value === 'cards' ? null : value })}
              className={cn('inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-[12.5px] font-medium lg:h-[24px] lg:px-3 lg:text-[10px]', view === value ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50')}>{icon}{label}</Link>
          ))}
        </div>
        <RefreshButton />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6 xl:gap-[14px]">
        {kpis.map(kpi => (
          <Card key={kpi.label} className="px-3.5 pb-2 pt-3 xl:h-[106px]">
            <div className="flex items-start gap-2.5">
              <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full xl:h-[34px] xl:w-[34px]', kpi.tile)} aria-hidden>{kpi.icon}</span>
              <div className="min-w-0">
                <p className="truncate text-[12px] font-medium text-slate-700 lg:text-[9.5px]">{kpi.label}</p>
                <p className="mt-0.5 flex items-baseline gap-2"><span className="text-[21px] font-semibold leading-none text-slate-900 tabular-nums">{kpi.value}</span><Delta value={kpi.delta} inverse={kpi.inverse} digits={0} /></p>
                <p className="mt-1 truncate text-[11px] text-slate-400 lg:text-[8.5px]">{compare}</p>
              </div>
            </div>
            <div className="mt-1.5 h-[18px]"><Sparkline points={kpi.series} color={kpi.color} height={18} strokeWidth={1.3} summary={`${kpi.label} daily trend`} /></div>
          </Card>
        ))}
      </div>

      {view !== 'health' && (
        <Card className="mt-4 p-3.5 xl:h-[262px] xl:px-4 xl:py-3">
          <CardTitle title={`Connected Channels (${channels.length})`} />
          {channels.length === 0 ? (
            <EmptyNote className="mt-3" title={allChannels.length ? 'No channels match these filters' : 'No channels connected yet'} description={allChannels.length ? 'Clear the filters to see every connection.' : 'Connect a social account to start publishing, engaging and reporting.'}
              action={allChannels.length ? <Link href={withParams(searchParams, { health: null, type: null, team: null })} className="text-[13px] font-medium text-blue-600 hover:underline">Clear filters</Link> : undefined} />
          ) : view === 'table' ? (
            <AccountsTable channels={channels} base={base} latestRun={latestRunByChannel} expanded />
          ) : (
            <div className="mt-2 pr-3">
              <ScrollRow label="connected channels" className="gap-3 xl:gap-[12px]">
                {channels.map(channel => <ChannelCard key={channel.id} channel={channel} base={base} canSync={canSync} lastRun={latestRunByChannel.get(channel.id)} />)}
              </ScrollRow>
            </div>
          )}
        </Card>
      )}

      <div className={cn('mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2 xl:gap-[14px]', view === 'health' ? 'xl:grid-cols-[1fr_1fr]' : 'xl:grid-cols-[426fr_350fr_390fr]')}>
        {view !== 'table' && (
          <Card className="flex flex-col p-3.5 xl:h-[285px] xl:py-3">
            <CardTitle title="Connected Accounts" count={`${allChannels.length} Accounts`} />
            <AccountsTable channels={channels} base={base} latestRun={latestRunByChannel} />
            <Link href={withParams(searchParams, { view: 'table' })} className="mt-auto inline-flex items-center justify-center gap-1 pt-1 text-[12px] font-medium text-blue-600 hover:underline lg:text-[9.5px]">View all accounts <ArrowRight size={11} aria-hidden /></Link>
          </Card>
        )}

        <Card className="flex flex-col p-3.5 xl:h-[285px] xl:py-3">
          <CardTitle title="Source Health Overview" hint="Daily sync runs by result. Health by channel is the share of successful runs in the window.">
            <PillSelect compact paramKey="days" label="Health window" defaultValue="7" options={[{ value: '7', label: 'Last 7 Days' }, { value: '14', label: 'Last 14 Days' }, { value: '30', label: 'Last 30 Days' }]} className="min-w-[78px]" />
          </CardTitle>
          <ul className="mt-1.5 flex gap-4 text-[11px] text-slate-600 lg:text-[8.5px]">
            {[['Healthy', '#22C55E'], ['Warning', '#F59E0B'], ['Error', '#EF4444']].map(([label, color]) => <li key={label} className="flex items-center gap-1.5"><span className="h-[6px] w-[6px] rounded-full" style={{ background: color }} aria-hidden />{label}</li>)}
          </ul>
          <LineChart className="mt-1" height={view === 'health' ? 180 : 82} labels={healthSeries.map(day => shortDay(day.date))}
            leftFormat={value => `${Math.round(value * 100)}%`}
            leftMax={1}
            series={[
              { key: 'healthy', label: 'Healthy', color: '#22C55E', values: healthSeries.map(day => ratio(day.healthy, day)) },
              { key: 'warning', label: 'Warning', color: '#F59E0B', values: healthSeries.map(day => ratio(day.warning, day)) },
              { key: 'error', label: 'Error', color: '#EF4444', values: healthSeries.map(day => ratio(day.error, day)) },
            ]}
            summary="Share of sync runs per day that succeeded, partially succeeded or failed" />
          <p className="mt-1 text-[11px] font-medium text-slate-600 lg:text-[8.5px]">Health by Channel</p>
          <ul className="mt-1 space-y-[3px]">
            {healthByChannel.slice(0, view === 'health' ? 12 : 6).map(row => (
              <li key={row.channel.id} className="grid grid-cols-[14px_62px_1fr_30px] items-center gap-1.5 text-[11px] lg:text-[8px]">
                <ProviderIcon provider={row.channel.platform} size={11} decorative />
                <span className="truncate text-slate-600">{PROVIDER_NAMES[row.channel.platform]}</span>
                <span className="h-[4px] rounded-full bg-slate-100"><span className={cn('block h-full rounded-full', (row.successPct ?? 0) >= 0.95 ? 'bg-emerald-500' : 'bg-amber-500')} style={{ width: `${(row.successPct ?? 0) * 100}%` }} /></span>
                <span className="text-right tabular-nums text-slate-600">{row.successPct === null ? '—' : `${Math.round(row.successPct * 100)}%`}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="flex flex-col p-3.5 xl:h-[285px] xl:py-3">
          <CardTitle title="Sync History"><TextLink href={withParams(searchParams, { view: 'health' })}>View all</TextLink></CardTitle>
          {runs.length === 0 ? <EmptyNote className="mt-3 flex-1" title="No syncs yet" /> : (
            <ul className="mt-2 min-h-0 flex-1 divide-y divide-slate-50 overflow-hidden">
              {runs.filter(run => channels.some(channel => channel.id === run.channel_id)).slice(0, view === 'health' ? 14 : 6).map(run => {
                const channel = channelById.get(run.channel_id)
                const status = SYNC_STATUS[run.status] ?? { label: run.status, tone: 'blue' as const }
                return (
                  <li key={run.id} className="flex items-center gap-2 py-2 text-[12px] lg:py-[7px] lg:text-[9px]" title={run.error_message ?? undefined}>
                    {channel && <ProviderIcon provider={channel.platform} size={17} />}
                    <Link href={`${base}/connections/${run.channel_id}`} className="min-w-0 flex-1 truncate text-slate-700 hover:underline">
                      {channel ? PROVIDER_NAMES[channel.platform] : 'Channel'} <span className="text-slate-400">({channel?.handle ?? channel?.account_name})</span>
                    </Link>
                    <Badge tone={status.tone}>{status.label}</Badge>
                    <span className="w-[96px] whitespace-nowrap text-right text-slate-500">{MONTH_DAY.format(new Date(run.started_at))}, {fmtTime(run.started_at)}</span>
                  </li>
                )
              })}
            </ul>
          )}
          <Link href={withParams(searchParams, { view: 'health' })} className="mt-1 inline-flex items-center gap-1 text-[12px] font-medium text-blue-600 hover:underline lg:text-[9.5px]">View all syncs <ArrowRight size={11} aria-hidden /></Link>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.5fr_1fr] xl:grid-cols-[600fr_578fr] xl:gap-[16px]">
        <Card className="p-3.5 xl:h-[150px] xl:py-3">
          <CardTitle title="Webhook / Activity Log"><TextLink href={withParams(searchParams, { view: 'health' })}>View all</TextLink></CardTitle>
          {events.length === 0 ? <p className="mt-2 text-[12px] text-slate-500">No provider events received yet.</p> : (
            <ul className="mt-2 space-y-1.5 lg:space-y-[5px]">
              {events.map(event => {
                const channel = event.channel_id ? channelById.get(event.channel_id) : null
                return (
                  <li key={event.id} className="grid grid-cols-[8px_14px_minmax(0,1fr)_minmax(0,1fr)_110px] items-center gap-2 text-[12px] lg:text-[9px]">
                    <span className={cn('h-[6px] w-[6px] rounded-full', event.status === 'processed' ? 'bg-emerald-500' : event.status === 'failed' ? 'bg-red-500' : 'bg-amber-500')} aria-label={event.status} />
                    <ProviderIcon provider={event.provider} size={12} decorative />
                    <span className="truncate text-slate-700">{event.summary ?? WEBHOOK_LABEL[event.event_type] ?? event.event_type}</span>
                    <span className="truncate text-slate-600">{PROVIDER_NAMES[event.provider]} ({channel?.handle ?? channel?.account_name ?? 'account'})</span>
                    <span className="text-right text-slate-500">{fullDateTime(event.received_at)}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        <Card className="p-3.5 xl:h-[150px] xl:py-3">
          <CardTitle title="Issues & Alerts" count={issues.length} />
          {issues.length === 0 ? <p className="mt-2 text-[12px] text-slate-500">No open connection issues.</p> : (
            <ul className="mt-2 space-y-1.5 lg:space-y-[6px]">
              {issues.slice(0, 3).map(issue => (
                <li key={issue.id} className="flex items-center gap-2.5 text-[12px] lg:text-[9px]" title={issue.hint ?? undefined}>
                  <AlertTriangle size={14} className={issue.severity === 'error' ? 'text-red-500' : 'text-amber-500'} aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-slate-700">{issue.message}</span>
                  {issue.channel_id && (
                    <Link href={`${base}/connections/${issue.channel_id}`} className="inline-flex h-8 items-center rounded-md border border-slate-200 px-2.5 font-medium text-blue-600 hover:bg-slate-50 lg:h-[20px] lg:px-2">
                      {ISSUE_ACTION[issue.action_kind ?? ''] ?? 'Review'}
                    </Link>
                  )}
                  <span className="w-6 text-right text-slate-400">{relative(issue.detected_at)}</span>
                </li>
              ))}
            </ul>
          )}
          {!canEdit && issues.length > 0 && <p className="mt-1 text-[11px] text-slate-400">Your role can view issues but not resolve them.</p>}
        </Card>
      </div>

      <ConnectChannelDialog providers={providers} returnTo={`${base}/connections`} blockedReason={connectBlocked} />
    </>
  )
}

function ratio(value: number, day: { healthy: number; warning: number; error: number }) {
  const total = day.healthy + day.warning + day.error
  return total ? value / total : null
}

function relative(iso: string) {
  const hours = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 3_600_000))
  return hours < 24 ? `${hours}h` : `${Math.round(hours / 24)}d`
}

function ChannelCard({ channel, base, canSync, lastRun }: { channel: SocialChannelRow; base: string; canSync: boolean; lastRun?: { status: string } }) {
  const health = HEALTH[channel.health] ?? HEALTH.healthy
  const lastSync = channel.last_successful_sync_at ?? channel.last_sync_at
  const scopes = channel.granted_scopes
  const needsDetails = channel.health !== 'healthy'
  return (
    <div className="flex w-[228px] shrink-0 snap-start flex-col rounded-xl border border-slate-200/80 bg-white p-3 xl:h-[210px] xl:w-[186px]">
      <div className="flex items-center gap-2">
        <ProviderIcon provider={channel.platform} size={24} />
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-slate-900 lg:text-[10.5px]">{PROVIDER_NAMES[channel.platform]}</span>
        <Badge tone={health.tone}>{health.label}</Badge>
      </div>
      <div className="mt-2.5 flex items-center gap-2">
        {channel.platform === 'facebook' || channel.platform === 'linkedin' || channel.platform === 'youtube'
          ? <ProviderIcon provider={channel.platform} size={26} decorative />
          : <Avatar src={channel.avatar_url} name={channel.handle ?? channel.account_name} size={26} />}
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-[12px] font-medium text-slate-800 lg:text-[9.5px]">{channel.handle ?? channel.account_name}</span>
          <span className="block truncate text-[11px] text-slate-400 lg:text-[8.5px]">{ACCOUNT_TYPE[channel.account_type ?? ''] ?? 'Account'}{channel.team_label ? ` · ${channel.team_label}` : ''}</span>
        </span>
      </div>
      <div className="mt-2.5 flex items-center justify-between text-[11px] lg:text-[8.5px]">
        <span className="text-slate-600">Scopes</span>
        <span className="rounded bg-blue-50 px-1.5 font-medium text-blue-700">{channel.granted_scopes.length} of {channel.required_scopes.length}</span>
      </div>
      <p className="mt-1.5 flex items-center gap-2 text-slate-400" aria-label={`Granted scopes: ${scopes.join(', ')}`} title={scopes.join('\n')}>
        {scopes.slice(0, 4).map(scope => <span key={scope}>{scopeIcon(scope)}</span>)}
        {scopes.length > 4 && <span className="text-[10px] lg:text-[8px]">+{scopes.length - 4}</span>}
      </p>
      <dl className="mt-2.5 space-y-1 text-[11px] lg:text-[8.5px]">
        <div className="flex justify-between gap-2"><dt className="text-slate-500">Last Sync</dt><dd className="flex items-center gap-1 text-slate-700">{lastSync ? `${MONTH_DAY.format(new Date(lastSync))}, ${fmtTime(lastSync)}` : 'Never'}{lastRun?.status === 'success' && <ShieldCheck size={10} className="text-emerald-500" aria-label="Last sync succeeded" />}</dd></div>
        <div className="flex justify-between gap-2"><dt className="text-slate-500">Permissions</dt><dd className="text-slate-700">{channel.permission_mode === 'read_only' ? 'Read Only' : 'Read + Write'}</dd></div>
      </dl>
      <div className="mt-auto flex items-center gap-1.5 pt-2">
        <Link href={`${base}/connections/${channel.id}`} className="inline-flex h-8 flex-1 items-center justify-center rounded-md border border-slate-200 text-[12px] font-medium text-blue-600 hover:bg-slate-50 lg:h-[24px] lg:text-[9.5px]">{needsDetails ? 'View Details' : 'Manage'}</Link>
        <Kebab label={`${channel.handle ?? channel.account_name} options`} className="[&>button]:h-8 [&>button]:w-8 [&>button]:border [&>button]:border-slate-200 lg:[&>button]:h-[24px] lg:[&>button]:w-[24px]">
          <SyncNowButton channelId={channel.id} allowed={canSync} />
          <Link href={`${base}/connections/${channel.id}`}>Permissions and team</Link>
          <Link href={`${base}/analytics?channel=${channel.id}`}>View analytics</Link>
        </Kebab>
      </div>
    </div>
  )
}

function AccountsTable({ channels, base, latestRun, expanded = false }: { channels: SocialChannelRow[]; base: string; latestRun: Map<string, { status: string }>; expanded?: boolean }) {
  return (
    <div className={cn('mt-2 min-h-0 flex-1 overflow-x-auto', expanded ? 'overflow-y-auto' : 'overflow-y-hidden')}>
      <table className="w-full min-w-[400px] table-fixed xl:min-w-0 text-left text-[11px] lg:text-[8.5px]">
        <colgroup><col className="w-[24%]" /><col className="w-[11%]" /><col className="w-[17%]" /><col className="w-[19%]" /><col className="w-[14%]" /><col className="w-[15%]" /></colgroup>
        <thead className="text-slate-500"><tr className="border-b border-slate-100 [&>th]:pb-1.5 [&>th]:font-medium"><th scope="col">Account</th><th scope="col" className="text-center">Platform</th><th scope="col">Type</th><th scope="col">Team</th><th scope="col">Health</th><th scope="col">Last Sync</th></tr></thead>
        <tbody>
          {channels.slice(0, expanded ? 100 : 8).map(channel => {
            const health = HEALTH[channel.health] ?? HEALTH.healthy
            const lastSync = channel.last_successful_sync_at ?? channel.last_sync_at
            return (
              <tr key={channel.id} className="border-b border-slate-50 [&>td]:py-[4px]">
                <td><Link href={`${base}/connections/${channel.id}`} className="flex items-center gap-1.5 hover:underline"><Avatar src={channel.avatar_url} name={channel.handle ?? channel.account_name} size={16} /><span className="truncate text-slate-800">{channel.handle ?? channel.account_name}</span></Link></td>
                <td className="text-center"><ProviderIcon provider={channel.platform} size={13} className="mx-auto" /></td>
                <td className="truncate text-slate-500">{ACCOUNT_TYPE[channel.account_type ?? ''] ?? '—'}</td>
                <td className="truncate text-slate-500">{channel.team_label ?? '—'}</td>
                <td><span className={cn('inline-flex items-center gap-1', health.text)}><span className={cn('h-[5px] w-[5px] rounded-full', health.dot)} aria-hidden />{health.label}</span></td>
                <td className="truncate text-slate-500" title={latestRun.get(channel.id)?.status}>{lastSync ? `${MONTH_DAY.format(new Date(lastSync))}, ${fmtTime(lastSync)}` : 'Never'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}


