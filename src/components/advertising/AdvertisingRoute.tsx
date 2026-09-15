import { getAdvertisingGate } from '@/lib/advertising/queries/context'
import { assertAdvertisingSurface } from '@/lib/advertising/queries/context'
import { BlockedState, UpgradeState } from './Primitives'
import OverviewPage from './pages/OverviewPage'
import AccountsPage from './pages/AccountsPage'
import CampaignsPage from './pages/CampaignsPage'
import CreativesPage from './pages/CreativesPage'
import AudiencesPage from './pages/AudiencesPage'
import ReportsPage from './pages/ReportsPage'
import AdvertisingSubNav from './AdvertisingSubNav'
import { PageTrail } from '@/components/ui/Breadcrumbs'
import {
  AccountDetailPage, AudienceDetailPage, CampaignDetailPage, CreativeDetailPage,
} from './pages/DetailPages'

// Server entry point for `/{type}/advertising[/module]`.
//
// Resolves the module from the URL, resolves the workspace/role/plan/provider
// entitlement gate exactly once, then renders only that page's data. An
// unknown module falls back to Overview rather than 404ing inside an otherwise
// valid workspace.

const MODULES = ['overview', 'accounts', 'campaigns', 'creatives', 'audiences', 'reports'] as const
type AdvertisingModule = typeof MODULES[number]

export default async function AdvertisingRoute({
  workspaceType, segments, searchParams,
}: {
  workspaceType: string
  segments: string[]
  searchParams: Record<string, string | string[] | undefined>
}) {
  if (!assertAdvertisingSurface(workspaceType)) {
    return (
      <div className="mx-auto max-w-lg py-10">
        <BlockedState
          title="Advertising is not available here"
          description="The Advertising module is part of the Brand and Agency workspace products."
        />
      </div>
    )
  }

  const gate = await getAdvertisingGate(workspaceType)

  if (!gate.ok) {
    const { denial, basePath } = gate
    if (denial.reason === 'plan' || denial.reason === 'plan_tier') {
      return (
        <div className="mx-auto max-w-lg py-10">
          <UpgradeState
            title="Advertising is a Team plan feature"
            description={denial.message}
            planLabel={denial.upgradeTo === 'agency' ? 'Agency' : 'Team'}
            billingHref={`/${workspaceType}/settings/billing`}
          />
        </div>
      )
    }
    return (
      <div className="mx-auto max-w-lg py-10">
        <BlockedState
          title={denial.reason === 'workspace_status' ? 'No workspace access' : 'Advertising is not available'}
          description={denial.message}
        />
      </div>
    )
  }

  const { session } = gate
  // segments[0] is 'advertising'; segments[1] is the module; segments[2] a record id.
  const requested = (segments[1] ?? 'overview') as AdvertisingModule
  const activeModule: AdvertisingModule = MODULES.includes(requested) ? requested : 'overview'
  const recordId = segments[2]

  // Only modules the member can view become tabs; hidden ones are omitted, not disabled.
  const tabs = TAB_DEFS.filter(tab => tab.id === 'overview' ? session.capabilities.view : session.capabilities[`${tab.id}.view` as const])

  const moduleLabel = TAB_DEFS.find(tab => tab.id === activeModule)?.label ?? 'Overview'
  // One row under each list page's title: back link + breadcrumbs, then the
  // section tabs. Merged so the page keeps the reference design's density.
  // Detail pages carry their own trail instead (they know the record's name).
  const trail = activeModule === 'overview'
    ? <PageTrail compact flush crumbs={[{ label: 'Campaign Manager', href: `/${workspaceType}/home` }, { label: 'Advertising' }]} />
    : <PageTrail compact flush back={{ href: session.basePath, label: 'Back' }} crumbs={[{ label: 'Advertising', href: session.basePath }, { label: moduleLabel }]} />
  const nav = (
    <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
      <div className="shrink-0">{trail}</div>
      <span className="hidden h-5 w-px shrink-0 bg-slate-200 lg:block" aria-hidden />
      <div className="min-w-0 flex-1"><AdvertisingSubNav basePath={session.basePath} tabs={tabs} /></div>
    </div>
  )
  const pageProps = { session, searchParams, nav }
  const detailProps = { session, searchParams, id: recordId ?? '' }

  if (recordId && activeModule !== 'overview' && activeModule !== 'reports') {
    switch (activeModule) {
      case 'accounts': return <AccountDetailPage {...detailProps} />
      case 'campaigns': return <CampaignDetailPage {...detailProps} />
      case 'creatives': return <CreativeDetailPage {...detailProps} />
      case 'audiences': return <AudienceDetailPage {...detailProps} />
    }
  }

  let page: React.ReactNode
  switch (activeModule) {
    case 'accounts': page = <AccountsPage {...pageProps} />; break
    case 'campaigns': page = <CampaignsPage {...pageProps} />; break
    case 'creatives': page = <CreativesPage {...pageProps} />; break
    case 'audiences': page = <AudiencesPage {...pageProps} />; break
    case 'reports': page = <ReportsPage {...pageProps} />; break
    default: page = <OverviewPage {...pageProps} />
  }

  return page
}

const TAB_DEFS = [
  { id: 'overview', label: 'Overview' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'campaigns', label: 'Campaigns' },
  { id: 'creatives', label: 'Creatives' },
  { id: 'audiences', label: 'Audiences' },
  { id: 'reports', label: 'Reports' },
] as const
