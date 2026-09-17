import { workspaceKindFromType } from '@/lib/navigation/resolver'

/** Canonical Campaigns base for a workspace, e.g. `/brand/campaigns`. */
export function campaignsBaseFor(workspaceType: string | null | undefined): string {
  return `/${workspaceKindFromType(workspaceType)}/campaigns`
}

/** Route pattern revalidated after every Campaigns mutation (all sub-tabs + detail pages). */
export const CAMPAIGNS_ROUTE_PATTERN = '/[workspaceType]/campaigns'
