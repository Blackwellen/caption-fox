export const SHELL_NAV_COOKIE = 'cf_nav_collapsed'

/**
 * The collapse preference is stored as `1.<key>` / `0.<key>`, where the key is
 * derived from the user id, so a preference set by one account on a shared
 * browser never applies to another account.
 */
export function navPreferenceKey(userId: string): string {
  return userId.replace(/-/g, '').slice(0, 12)
}
