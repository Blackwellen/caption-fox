type ChannelPrefs = { email?: boolean; in_app?: boolean }

/**
 * Reads the recipient's Account Settings → Notifications row for approvals.
 * Newer profiles store `{ approvals: { email, in_app } }`; older ones store the
 * boolean `approval_requests`. Both default to on.
 */
export function approvalChannels(preferences: unknown): { email: boolean; inApp: boolean } {
  const prefs = (preferences ?? {}) as Record<string, unknown>
  const approvals = prefs.approvals as ChannelPrefs | undefined
  const legacyOff = prefs.approval_requests === false
  return {
    email: !legacyOff && approvals?.email !== false,
    inApp: !legacyOff && approvals?.in_app !== false,
  }
}

/** Demo workspaces (slug `*-demo` or `settings.demo`) never send real email. */
export function isDemoWorkspace(slug: string | null | undefined, settings: unknown): boolean {
  const s = (settings ?? {}) as Record<string, unknown>
  return Boolean(slug?.endsWith('-demo') || s.demo === true || s.is_demo === true)
}
