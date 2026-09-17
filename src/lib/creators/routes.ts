// Canonical Creators & UGC URLs. Every surface lives under the type-first
// workspace route (/{brand|business|agency}/creators/...). Stored activity links
// use the workspace-neutral legacy prefix (/app/creators/...) so they stay valid
// if a record is viewed from another context; `resolveCreatorsLink` rewrites
// them to the current base at render time.

import type { CreatorModule } from './constants'

export const LEGACY_CREATORS_BASE = '/app/creators'

export function creatorsBase(kind: string): string {
  return `/${kind}/creators`
}

export function moduleHref(base: string, module: CreatorModule): string {
  return module === 'overview' ? base : `${base}/${module}`
}

export function recordHref(base: string, module: Exclude<CreatorModule, 'overview'>, id: string): string {
  return `${base}/${module}/${encodeURIComponent(id)}`
}

/** Rewrites a stored `/app/creators/...` link onto the active base path. */
export function resolveCreatorsLink(link: string | null | undefined, base: string): string | null {
  if (!link) return null
  if (link === LEGACY_CREATORS_BASE) return base
  if (link.startsWith(`${LEGACY_CREATORS_BASE}/`)) return `${base}${link.slice(LEGACY_CREATORS_BASE.length)}`
  // Only same-origin app paths are ever rendered as links.
  return link.startsWith('/') && !link.startsWith('//') ? link : null
}

/** The stored (workspace-neutral) link for a record, written by server actions. */
export function storedLink(module: Exclude<CreatorModule, 'overview'>, id: string): string {
  return `${LEGACY_CREATORS_BASE}/${module}/${id}`
}
