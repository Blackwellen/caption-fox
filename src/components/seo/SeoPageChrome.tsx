import type { SeoTabId } from '@/lib/seo/types'
import { SEO_TOKENS, AccessPanel } from './primitives'
import { SeoSubNav } from './SeoSubNav'
import { SeoNavProvider } from './SeoNavContext'
import type { SeoBlocker } from '@/lib/seo/entitlements'
import { planName, requiredPlanFor, tabCapability } from '@/lib/seo/entitlements'

const BLOCK_MESSAGE: Record<Exclude<SeoBlocker, null>, string> = {
  plan: 'Upgrade your plan to unlock this area of SEO & Discovery.',
  permission: 'Your role does not include access to this area. Ask a workspace owner or admin for access.',
  'feature-flag': 'This area is not enabled for this workspace yet.',
  'workspace-type': 'This area is not part of the current workspace type.',
  'workspace-status': 'This workspace subscription needs attention before SEO & Discovery can be used.',
}

/**
 * Shared chrome for every SEO & Discovery route. Section navigation lives on
 * the page title (see SeoHeader); the standalone sub-nav is only rendered for
 * blocked states, where there is no header to host it.
 */
export function SeoPageChrome({
  tab, tabs, blocked, query, children,
}: { tab: SeoTabId; tabs: SeoTabId[]; blocked: SeoBlocker; query?: string; children: React.ReactNode }) {
  return (
    <SeoNavProvider value={{ tabs, active: tab, query }}>
      <div className={SEO_TOKENS.page}>
        {blocked && <SeoSubNav tabs={tabs} active={tab} query={query} />}
        <div className="pb-4 pt-3">
          {blocked
            ? (
              <AccessPanel
                reason={blocked}
                message={BLOCK_MESSAGE[blocked]}
                planName={blocked === 'plan' ? planName(requiredPlanFor(tabCapability(tab)) ?? 'team') : undefined}
              />
            )
            : children}
        </div>
      </div>
    </SeoNavProvider>
  )
}
