import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getNavigationForContext } from '@/lib/navigation/resolver'
import { initialsFor } from '@/lib/navigation/session'
import { readNavCollapsed } from '@/lib/shell/nav-preference'
import CaptionFoxAppShell from '@/components/shell/app-shell/CaptionFoxAppShell'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin-login')

  const { data: profile } = await supabase.from('profiles').select('full_name, is_platform_admin').eq('id', user.id).single()
  if (!profile?.is_platform_admin) redirect('/app/home')

  // Platform admin requires a second factor on every session (AAL2). Checked
  // per request, so a removed role or a password-only session is locked out.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (aal?.currentLevel !== 'aal2') redirect('/admin-login?reason=mfa')

  const [{ data: notifications }, collapsed] = await Promise.all([
    supabase.from('notifications')
      .select('id, title, body, link, is_read, created_at')
      .eq('user_id', user.id).order('created_at', { ascending: false }).limit(10),
    readNavCollapsed(user.id),
  ])

  const name = profile.full_name ?? user.email?.split('@')[0] ?? 'Administrator'

  return (
    <CaptionFoxAppShell
      nav={getNavigationForContext({ context: 'admin', isPlatformAdmin: true })}
      user={{ name, email: user.email ?? null, initials: initialsFor(profile.full_name, user.email), secondary: 'Platform administrator' }}
      context={{ kind: 'admin', label: 'Platform Admin', badge: 'Admin Console' }}
      userId={user.id}
      notifications={notifications ?? []}
      initialCollapsed={collapsed}
    >
      {children}
    </CaptionFoxAppShell>
  )
}
