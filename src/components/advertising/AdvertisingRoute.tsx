import { getAdvertisingGate } from '@/lib/advertising/queries/context'
import { assertAdvertisingSurface } from '@/lib/advertising/queries/context'
import { BlockedState, UpgradeState } from './Primitives'
import OverviewPage from './pages/OverviewPage'
import AccountsPage from './pages/AccountsPage'
import CampaignsPage from './pages/CampaignsPage'
import CreativesPage from './pages/CreativesPage'
import AudiencesPage from './pages/AudiencesPage'
import ReportsPage from './pages/ReportsPage'

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
  // segments[0] is 'advertising'; segments[1] is the module, if any.
  const requested = (segments[1] ?? 'overview') as AdvertisingModule
  const module: AdvertisingModule = MODULES.includes(requested) ? requested : 'overview'

  const pageProps = { session, searchParams }

  switch (module) {
    case 'accounts': return <AccountsPage {...pageProps} />
    case 'campaigns': return <CampaignsPage {...pageProps} />
    case 'creatives': return <CreativesPage {...pageProps} />
    case 'audiences': return <AudiencesPage {...pageProps} />
    case 'reports': return <ReportsPage {...pageProps} />
    default: return <OverviewPage {...pageProps} />
  }
}
