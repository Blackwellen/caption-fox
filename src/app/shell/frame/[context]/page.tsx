import { notFound } from 'next/navigation'
import CaptionFoxAppShell from '@/components/shell/app-shell/CaptionFoxAppShell'
import { getNavigationForContext, isWorkspaceKind } from '@/lib/navigation/resolver'
import type { NavContextId } from '@/lib/navigation/types'
import type { ShellContextInfo } from '@/components/shell/app-shell/types'

// Development-only visual QA harness for the permanent application shell:
// renders the real CaptionFoxAppShell with fixture navigation so the frame
// can be compared against the approved references without signing in.
// Disabled in production exactly like the /shell fixture preview.
function harnessEnabled() {
  return process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_CAPTION_FOX_SHELL_DEMO === 'true'
}

const CONTEXTS: NavContextId[] = ['creator', 'business', 'brand', 'agency', 'supplier', 'admin', 'affiliate']

export default async function ShellFrameHarness({ params, searchParams }: {
  params: Promise<{ context: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  if (!harnessEnabled()) notFound()
  const { context } = await params
  if (!(CONTEXTS as string[]).includes(context)) notFound()
  const query = await searchParams
  const ctx = context as NavContextId

  const nav = isWorkspaceKind(ctx)
    ? getNavigationForContext({
      context: ctx,
      entitlements: { workspaceType: ctx, plan: query.plan === 'starter' ? 'starter' : 'team', planStatus: 'active', role: 'owner' },
      isPlatformAdmin: true,
    })
    : ctx === 'affiliate'
      ? getNavigationForContext({ context: 'affiliate', grantId: 'qa-grant' })
      : getNavigationForContext({ context: ctx, isPlatformAdmin: true, hasWorkspaces: true })

  const contextInfo: ShellContextInfo = ctx === 'admin'
    ? { kind: 'admin', label: 'Platform Admin', badge: 'Admin Console' }
    : ctx === 'affiliate'
      ? { kind: 'affiliate', label: 'Affiliate Portal', badge: 'Affiliate Portal' }
      : ctx === 'supplier'
        ? { kind: 'supplier', label: 'Northlight Studio' }
        : { kind: 'workspace', label: 'Caption Fox' }

  return (
    <CaptionFoxAppShell
      nav={nav}
      user={{ name: 'Jamahl Thomas', email: 'qa@example.test', initials: 'JT', secondary: 'Personal Workspace' }}
      context={contextInfo}
      userId="00000000-0000-0000-0000-00000000qa00"
      workspaces={[
        { id: 'ws-1', name: 'Caption Fox', type: 'brand', role: 'owner' },
        { id: 'ws-2', name: 'BrightSide Agency', type: 'agency', role: 'owner' },
      ]}
      activeWorkspaceId="ws-1"
      supplier={{ display_name: 'Northlight Studio' }}
      notifications={[]}
      initialCollapsed={query.collapsed === '1'}
      copyValue={ctx === 'affiliate' ? 'https://caption-fox.vercel.app/?ref=QA123' : null}
      qaPathname={typeof query.path === 'string' ? query.path : undefined}
    >
      <div className="px-8 py-8">
        <p className="text-[13px] font-medium text-shell-muted">Shell QA harness · {ctx} · fixture navigation (content area intentionally empty)</p>
      </div>
    </CaptionFoxAppShell>
  )
}
