import { findActiveNavItem } from './match'
import { getNavigationForContext } from './resolver'

// Every module any workspace can have, used only to identify which module an
// /app/* compatibility path belongs to (not to grant anything).
const SUPERSET = getNavigationForContext({
  context: 'agency',
  entitlements: { workspaceType: 'agency', plan: 'enterprise', planStatus: 'active', role: 'owner' },
})

// Match on each module's own page only — shared compatibility pages such as
// the personal affiliate dashboard (/app/affiliates) are not module-gated.
const APP_MODULE_GROUPS = SUPERSET.groups.map(group => ({
  items: group.items.filter(item => item.href.startsWith('/app/')).map(item => ({ id: item.id, match: [item.href] })),
}))

/** The workspace module an /app/* path belongs to, or null for shared pages. */
export function appPathModule(pathname: string): string | null {
  return findActiveNavItem(APP_MODULE_GROUPS, pathname)
}
