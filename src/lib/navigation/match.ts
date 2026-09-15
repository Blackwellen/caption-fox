// Client-safe active-route resolution. No imports, so it can ship in the shell
// bundle without pulling entitlement code into the browser.

export interface MatchableItem {
  id: string
  match: string[]
  exact?: boolean
}

export function normalisePath(path: string): string {
  const clean = path.split(/[?#]/)[0].replace(/\/+$/, '')
  return clean || '/'
}

/**
 * The item whose route is the longest prefix of `pathname` wins, so every
 * descendant (`/brand/campaigns/abc/content`) activates its parent module
 * without each deep route declaring shell state, and a nested module
 * (`/app/strategy/audiences`) beats its ancestor (`/app/strategy`).
 */
export function findActiveNavItem(groups: { items: MatchableItem[] }[], pathname: string): string | null {
  const path = normalisePath(pathname)
  let best: { id: string; length: number } | null = null
  for (const group of groups) {
    for (const item of group.items) {
      for (const candidate of item.match) {
        const target = normalisePath(candidate)
        const hit = item.exact ? path === target : path === target || path.startsWith(`${target}/`)
        if (hit && (!best || target.length > best.length)) best = { id: item.id, length: target.length }
      }
    }
  }
  return best?.id ?? null
}
