import 'server-only'

import { cookies } from 'next/headers'
import { SHELL_NAV_COOKIE, navPreferenceKey } from './nav-preference-constants'

/**
 * Sidebar collapse is a per-user preference read during the server render, so
 * the first paint already has the right width (no hydration mismatch). The
 * shell writes the cookie client-side when the user toggles it.
 */
export async function readNavCollapsed(userId: string): Promise<boolean> {
  const store = await cookies()
  return store.get(SHELL_NAV_COOKIE)?.value === `1.${navPreferenceKey(userId)}`
}
