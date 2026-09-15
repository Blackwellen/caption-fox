// Central SEO & Discovery entitlement resolver.
//
// Workspace type, plan, role, permissions and feature flags are combined in
// exactly ONE place so no UI file ever compares a workspace type inline.
// Anything a workspace is not entitled to is OMITTED — never rendered as a
// dead tab, blank route or "coming soon" placeholder.

import { getPlan, type PlanId } from '@/lib/plans'
import { getDefaultPermissions, PERMISSIONS, type Permission } from '@/lib/permissions'
import type { SeoTabId, SeoWorkspaceKind, SeoSourceCapabilities } from './types'

export type SeoCapability =
  // surfaces
  | 'seo.overview'
  | 'seo.keywords'
  | 'seo.briefs'
  | 'seo.rankings'
  | 'seo.local'
  | 'seo.aiSearch'
  | 'seo.backlinks'
  // sources
  | 'sources.view'
  | 'sources.connect'
  | 'sources.sync'
  | 'sources.disconnect'
  // actions
  | 'keywords.create'
  | 'keywords.edit'
  | 'keywords.archive'
  | 'keywords.import'
  | 'keywords.export'
  | 'briefs.create'
  | 'briefs.edit'
  | 'briefs.review'
  | 'briefs.publish'
  | 'briefs.comment'
  | 'briefs.export'
  | 'rankings.track'
  | 'rankings.export'
  | 'local.create'
  | 'local.edit'
  | 'local.sync'
  | 'local.export'
  | 'aiSearch.track'
  | 'aiSearch.check'
  | 'aiSearch.export'
  | 'backlinks.edit'
  | 'backlinks.createOutreach'
  | 'backlinks.export'
  // advanced views
  | 'views.clusters'
  | 'views.board'
  | 'views.map'
  | 'views.breakdown'
  | 'views.savedViews'

/** Workspace types that receive the SEO & Discovery module at all. */
const SEO_WORKSPACE_TYPES: SeoWorkspaceKind[] = ['creator', 'small_business', 'brand', 'agency']

/**
 * Which surfaces each workspace type can ever see.
 *
 * Creators run organic discovery for a personal site and channel pages: they
 * get keywords, briefs, rankings and AI search. Multi-branch Local SEO and
 * link-building operations are business/brand/agency workflows, so creators do
 * not receive those tabs at all (they are omitted, not disabled).
 */
const TYPE_TABS: Record<SeoWorkspaceKind, SeoTabId[]> = {
  creator: ['overview', 'keywords', 'briefs', 'rankings', 'ai-search'],
  small_business: ['overview', 'keywords', 'briefs', 'rankings', 'local', 'ai-search', 'backlinks'],
  brand: ['overview', 'keywords', 'briefs', 'rankings', 'local', 'ai-search', 'backlinks'],
  agency: ['overview', 'keywords', 'briefs', 'rankings', 'local', 'ai-search', 'backlinks'],
}

const PLAN_RANK: Record<PlanId, number> = {
  free: 0, creator_pro: 1, team: 2, agency: 3, enterprise: 4,
}

/** Minimum plan required per capability. Absent = available on every plan. */
const PLAN_FLOOR: Partial<Record<SeoCapability, PlanId>> = {
  'seo.briefs': 'creator_pro',
  'seo.rankings': 'creator_pro',
  'seo.local': 'team',
  'seo.aiSearch': 'team',
  'seo.backlinks': 'team',
  'sources.connect': 'creator_pro',
  'keywords.import': 'team',
  'briefs.review': 'team',
  'aiSearch.check': 'team',
  'backlinks.createOutreach': 'team',
  'views.clusters': 'creator_pro',
  'views.board': 'team',
  'views.map': 'team',
  'views.breakdown': 'team',
  'views.savedViews': 'team',
}

const PERMISSION_FOR: Record<SeoCapability, Permission> = {
  'seo.overview': PERMISSIONS.SEO_VIEW,
  'seo.keywords': PERMISSIONS.SEO_KEYWORDS_VIEW,
  'seo.briefs': PERMISSIONS.SEO_BRIEFS_VIEW,
  'seo.rankings': PERMISSIONS.SEO_RANKINGS_VIEW,
  'seo.local': PERMISSIONS.SEO_LOCAL_VIEW,
  'seo.aiSearch': PERMISSIONS.SEO_AI_SEARCH_VIEW,
  'seo.backlinks': PERMISSIONS.SEO_BACKLINKS_VIEW,
  'sources.view': PERMISSIONS.SEO_SOURCES_VIEW,
  'sources.connect': PERMISSIONS.SEO_SOURCES_CONNECT,
  'sources.sync': PERMISSIONS.SEO_SOURCES_SYNC,
  'sources.disconnect': PERMISSIONS.SEO_SOURCES_DISCONNECT,
  'keywords.create': PERMISSIONS.SEO_KEYWORDS_CREATE,
  'keywords.edit': PERMISSIONS.SEO_KEYWORDS_EDIT,
  'keywords.archive': PERMISSIONS.SEO_KEYWORDS_ARCHIVE,
  'keywords.import': PERMISSIONS.SEO_KEYWORDS_IMPORT,
  'keywords.export': PERMISSIONS.SEO_KEYWORDS_EXPORT,
  'briefs.create': PERMISSIONS.SEO_BRIEFS_CREATE,
  'briefs.edit': PERMISSIONS.SEO_BRIEFS_EDIT,
  'briefs.review': PERMISSIONS.SEO_BRIEFS_REVIEW,
  'briefs.publish': PERMISSIONS.SEO_BRIEFS_PUBLISH,
  'briefs.comment': PERMISSIONS.SEO_BRIEFS_COMMENT,
  'briefs.export': PERMISSIONS.SEO_BRIEFS_EXPORT,
  'rankings.track': PERMISSIONS.SEO_RANKINGS_TRACK,
  'rankings.export': PERMISSIONS.SEO_RANKINGS_EXPORT,
  'local.create': PERMISSIONS.SEO_LOCAL_CREATE,
  'local.edit': PERMISSIONS.SEO_LOCAL_EDIT,
  'local.sync': PERMISSIONS.SEO_LOCAL_SYNC,
  'local.export': PERMISSIONS.SEO_LOCAL_EXPORT,
  'aiSearch.track': PERMISSIONS.SEO_AI_SEARCH_TRACK,
  'aiSearch.check': PERMISSIONS.SEO_AI_SEARCH_CHECK,
  'aiSearch.export': PERMISSIONS.SEO_AI_SEARCH_EXPORT,
  'backlinks.edit': PERMISSIONS.SEO_BACKLINKS_EDIT,
  'backlinks.createOutreach': PERMISSIONS.SEO_BACKLINKS_CREATE_OUTREACH,
  'backlinks.export': PERMISSIONS.SEO_BACKLINKS_EXPORT,
  'views.clusters': PERMISSIONS.SEO_KEYWORDS_VIEW,
  'views.board': PERMISSIONS.SEO_BRIEFS_VIEW,
  'views.map': PERMISSIONS.SEO_LOCAL_VIEW,
  'views.breakdown': PERMISSIONS.SEO_RANKINGS_VIEW,
  'views.savedViews': PERMISSIONS.SEO_VIEW,
}

/** Capability -> the surface tab it belongs to, so surface gating cascades. */
const TAB_FOR: Partial<Record<SeoCapability, SeoTabId>> = {
  'seo.keywords': 'keywords',
  'seo.briefs': 'briefs',
  'seo.rankings': 'rankings',
  'seo.local': 'local',
  'seo.aiSearch': 'ai-search',
  'seo.backlinks': 'backlinks',
  'keywords.create': 'keywords',
  'keywords.edit': 'keywords',
  'keywords.archive': 'keywords',
  'keywords.import': 'keywords',
  'keywords.export': 'keywords',
  'briefs.create': 'briefs',
  'briefs.edit': 'briefs',
  'briefs.review': 'briefs',
  'briefs.publish': 'briefs',
  'briefs.comment': 'briefs',
  'briefs.export': 'briefs',
  'rankings.track': 'rankings',
  'rankings.export': 'rankings',
  'local.create': 'local',
  'local.edit': 'local',
  'local.sync': 'local',
  'local.export': 'local',
  'aiSearch.track': 'ai-search',
  'aiSearch.check': 'ai-search',
  'aiSearch.export': 'ai-search',
  'backlinks.edit': 'backlinks',
  'backlinks.createOutreach': 'backlinks',
  'backlinks.export': 'backlinks',
  'views.clusters': 'keywords',
  'views.board': 'briefs',
  'views.map': 'local',
  'views.breakdown': 'rankings',
}

export interface SeoContext {
  workspaceId: string
  workspaceType: SeoWorkspaceKind | string | null | undefined
  plan: PlanId
  role: string
  /** Explicit per-member permission overrides stored on workspace_members. */
  permissions?: string[] | null
  /** Feature flags from workspace settings; `seo.*` keys disable surfaces. */
  featureFlags?: Record<string, boolean> | null
  workspaceStatus?: string | null
  isPlatformAdmin?: boolean
}

function effectivePermissions(ctx: SeoContext): string[] {
  if (ctx.isPlatformAdmin) return Object.values(PERMISSIONS) as string[]
  if (ctx.permissions && ctx.permissions.length > 0) return ctx.permissions
  return getDefaultPermissions(ctx.role) as string[]
}

function planAllows(capability: SeoCapability, plan: PlanId): boolean {
  const floor = PLAN_FLOOR[capability]
  if (!floor) return true
  return PLAN_RANK[plan] >= PLAN_RANK[floor]
}

function flagAllows(capability: SeoCapability, flags?: Record<string, boolean> | null): boolean {
  if (!flags) return true
  if (flags['seo'] === false) return false
  const tab = TAB_FOR[capability]
  if (tab && flags[`seo.${tab}`] === false) return false
  return flags[`capability.${capability}`] !== false
}

/** Does this workspace type receive the SEO module at all? */
export function workspaceTypeHasSeo(type: string | null | undefined): type is SeoWorkspaceKind {
  return !!type && (SEO_WORKSPACE_TYPES as string[]).includes(type)
}

function tabsFor(ctx: SeoContext): SeoTabId[] {
  return workspaceTypeHasSeo(ctx.workspaceType) ? TYPE_TABS[ctx.workspaceType] : []
}

/** The single gate every server component, action and API route calls. */
export function canAccessSeoCapability(ctx: SeoContext, capability: SeoCapability): boolean {
  if (!workspaceTypeHasSeo(ctx.workspaceType)) return false
  if (ctx.workspaceStatus === 'suspended') return false

  const tab = TAB_FOR[capability]
  if (tab && !tabsFor(ctx).includes(tab)) return false

  if (!planAllows(capability, ctx.plan)) return false
  if (!flagAllows(capability, ctx.featureFlags)) return false

  return effectivePermissions(ctx).includes(PERMISSION_FOR[capability])
}

export type SeoBlocker = 'workspace-type' | 'plan' | 'feature-flag' | 'permission' | 'workspace-status' | null

/** Reason a capability is unavailable — drives upgrade vs. permission states. */
export function seoCapabilityBlocker(ctx: SeoContext, capability: SeoCapability): SeoBlocker {
  if (!workspaceTypeHasSeo(ctx.workspaceType)) return 'workspace-type'
  if (ctx.workspaceStatus === 'suspended') return 'workspace-status'
  const tab = TAB_FOR[capability]
  if (tab && !tabsFor(ctx).includes(tab)) return 'workspace-type'
  if (!planAllows(capability, ctx.plan)) return 'plan'
  if (!flagAllows(capability, ctx.featureFlags)) return 'feature-flag'
  if (!effectivePermissions(ctx).includes(PERMISSION_FOR[capability])) return 'permission'
  return null
}

export function requiredPlanFor(capability: SeoCapability): PlanId | null {
  return PLAN_FLOOR[capability] ?? null
}

export function planName(plan: PlanId): string {
  return getPlan(plan).name
}

const TAB_CAPABILITY: Record<SeoTabId, SeoCapability> = {
  overview: 'seo.overview',
  keywords: 'seo.keywords',
  briefs: 'seo.briefs',
  rankings: 'seo.rankings',
  local: 'seo.local',
  'ai-search': 'seo.aiSearch',
  backlinks: 'seo.backlinks',
}

export const SEO_TAB_ORDER: SeoTabId[] = [
  'overview', 'keywords', 'briefs', 'rankings', 'local', 'ai-search', 'backlinks',
]

export const SEO_TAB_LABELS: Record<SeoTabId, string> = {
  overview: 'Overview',
  keywords: 'Keywords',
  briefs: 'Briefs',
  rankings: 'Rankings',
  local: 'Local',
  'ai-search': 'AI Search',
  backlinks: 'Backlinks',
}

export const SEO_TAB_HREF: Record<SeoTabId, string> = {
  overview: '/app/seo',
  keywords: '/app/seo/keywords',
  briefs: '/app/seo/briefs',
  rankings: '/app/seo/rankings',
  local: '/app/seo/local',
  'ai-search': '/app/seo/ai-search',
  backlinks: '/app/seo/backlinks',
}

/** Navigation is entitlement-driven: hidden tabs are omitted, never disabled. */
export function visibleSeoTabs(ctx: SeoContext): SeoTabId[] {
  return SEO_TAB_ORDER.filter(tab => canAccessSeoCapability(ctx, TAB_CAPABILITY[tab]))
}

export function tabCapability(tab: SeoTabId): SeoCapability {
  return TAB_CAPABILITY[tab]
}

/** Which view modes a surface may offer, after plan gating. */
export function availableSeoViews(ctx: SeoContext, candidates: readonly string[]): string[] {
  return candidates.filter(view => {
    if (view === 'clusters') return canAccessSeoCapability(ctx, 'views.clusters')
    if (view === 'board') return canAccessSeoCapability(ctx, 'views.board')
    if (view === 'map') return canAccessSeoCapability(ctx, 'views.map')
    if (view === 'breakdown') return canAccessSeoCapability(ctx, 'views.breakdown')
    return true
  })
}

/**
 * Union of what the connected sources can supply for this site. Metrics,
 * filters and dimensions that no connected source supports are omitted.
 */
export function mergedSourceCapabilities(
  sources: { capabilities?: SeoSourceCapabilities | null; status: string }[],
): SeoSourceCapabilities {
  const merged: SeoSourceCapabilities = {}
  for (const source of sources) {
    if (source.status !== 'connected') continue
    for (const [key, value] of Object.entries(source.capabilities ?? {})) {
      if (value) merged[key as keyof SeoSourceCapabilities] = true
    }
  }
  return merged
}

/** Resolved action capabilities for one context — used by every SEO surface. */
export interface SeoCapabilities {
  connectSource: boolean
  syncSource: boolean
  disconnectSource: boolean
  addKeywords: boolean
  editKeywords: boolean
  archiveKeywords: boolean
  importKeywords: boolean
  exportKeywords: boolean
  createBrief: boolean
  editBrief: boolean
  reviewBrief: boolean
  publishBrief: boolean
  commentBrief: boolean
  exportBriefs: boolean
  trackKeywords: boolean
  exportRankings: boolean
  addLocation: boolean
  editLocation: boolean
  syncListings: boolean
  exportLocal: boolean
  trackPrompts: boolean
  runPromptCheck: boolean
  exportAiSearch: boolean
  editBacklinks: boolean
  createOutreachList: boolean
  exportBacklinks: boolean
}

export function seoCapabilities(ctx: SeoContext): SeoCapabilities {
  const can = (capability: SeoCapability) => canAccessSeoCapability(ctx, capability)
  return {
    connectSource: can('sources.connect'),
    syncSource: can('sources.sync'),
    disconnectSource: can('sources.disconnect'),
    addKeywords: can('keywords.create'),
    editKeywords: can('keywords.edit'),
    archiveKeywords: can('keywords.archive'),
    importKeywords: can('keywords.import'),
    exportKeywords: can('keywords.export'),
    createBrief: can('briefs.create'),
    editBrief: can('briefs.edit'),
    reviewBrief: can('briefs.review'),
    publishBrief: can('briefs.publish'),
    commentBrief: can('briefs.comment'),
    exportBriefs: can('briefs.export'),
    trackKeywords: can('rankings.track'),
    exportRankings: can('rankings.export'),
    addLocation: can('local.create'),
    editLocation: can('local.edit'),
    syncListings: can('local.sync'),
    exportLocal: can('local.export'),
    trackPrompts: can('aiSearch.track'),
    runPromptCheck: can('aiSearch.check'),
    exportAiSearch: can('aiSearch.export'),
    editBacklinks: can('backlinks.edit'),
    createOutreachList: can('backlinks.createOutreach'),
    exportBacklinks: can('backlinks.export'),
  }
}
