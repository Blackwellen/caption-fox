'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { SHELL_NAV_COOKIE } from './nav-preference-constants'

/** Sidebar collapse is a per-user preference, so it survives refresh and deep links. */
export async function readNavCollapsed(): Promise<boolean> {
  const store = await cookies()
  return store.get(SHELL_NAV_COOKIE)?.value === '1'
}

export async function toggleNavCollapsed(pathname: string) {
  const store = await cookies()
  const next = store.get(SHELL_NAV_COOKIE)?.value === '1' ? '0' : '1'
  store.set(SHELL_NAV_COOKIE, next, {
    httpOnly: false,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })
  // Only revalidate a path we own.
  if (/^\/[\w-]+(\/[\w-]+)*$/.test(pathname)) revalidatePath(pathname)
}
