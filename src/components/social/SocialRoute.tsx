import type { ReactNode } from 'react'
import { BlockedState, UpgradeState } from '@/components/advertising/Primitives'
import { PageTrail } from '@/components/ui/Breadcrumbs'
import { canAccessSocialSurface, SURFACE_LABELS, type SocialSurface } from '@/lib/social/entitlements'
import { getSocialSession, type SocialSession } from '@/lib/social/server'
import type { SearchParams } from '@/lib/social/url-state'
import { SocialSubNav } from './controls'
import OverviewPage from './pages/OverviewPage'
import PublishingPage from './pages/PublishingPage'
import EngagementPage from './pages/EngagementPage'
import ListeningPage from './pages/ListeningPage'
import ConnectionsPage from './pages/ConnectionsPage'
import AnalyticsPage from './pages/AnalyticsPage'
import { ConnectionDetailPage, ConversationDetailPage, MentionDetailPage, PostDetailPage } from './pages/DetailPages'

// Server entry point for `/{type}/social[/…]`.
//
// One implementation for every workspace type. The route resolves the session
// once, then the surface gate (workspace type → subscription → feature flag →
// plan → role) for the requested page. Hidden surfaces never render: a direct
// URL to one shows the canonical upgrade or no-access state, and its tab is
// omitted from the section navigation rather than disabled.

export type SocialPageProps = {
  session: SocialSession
  searchParams: SearchParams
  nav: ReactNode
}

const PAGE_SURFACES = ['publishing', 'engagement', 'listening', 'connections', 'analytics'] as const

type Resolved =
  | { kind: 'page'; surface: SocialSurface }
  | { kind: 'detail'; surface: SocialSurface; detail: 'post' | 'conversation' | 'connection' | 'mention'; id: string; label: string }

function resolve(segments: string[]): Resolved | null {
  const [first, second, third] = segments
  if (!first) return { kind: 'page', surface: 'overview' }
  if (first === 'posts' && second && !third) return { kind: 'detail', surface: 'publishing', detail: 'post', id: second, label: 'Post' }
  if (first === 'conversations' && second && !third) return { kind: 'detail', surface: 'engagement', detail: 'conversation', id: second, label: 'Conversation' }
  if (first === 'connections' && second && !third) return { kind: 'detail', surface: 'connections', detail: 'connection', id: second, label: 'Connection' }
  if (first === 'listening' && second === 'mentions' && third) return { kind: 'detail', surface: 'listening', detail: 'mention', id: third, label: 'Mention' }
  if ((PAGE_SURFACES as readonly string[]).includes(first) && !second) return { kind: 'page', surface: first as SocialSurface }
  return null
}

export function socialPageTitle(segments: string[]): string {
  const resolved = resolve(segments)
  if (!resolved) return 'Social'
  if (resolved.kind === 'detail') return `${resolved.label} · Social`
  return `Social ${SURFACE_LABELS[resolved.surface]}`
}

export default async function SocialRoute({ workspaceType, segments, searchParams }: {
  workspaceType: string
  segments: string[]
  searchParams: SearchParams
}) {
  const session = await getSocialSession()
  const resolved = resolve(segments)

  if (!resolved) {
    return (
      <div className="mx-auto max-w-lg py-10">
        <BlockedState title="Page not found" description="That Social page does not exist. Use the section tabs to find what you need." />
      </div>
    )
  }

  const access = canAccessSocialSurface(session.ctx, resolved.surface)
  if (!access.allowed) {
    const label = SURFACE_LABELS[resolved.surface]
    return (
      <div className="space-y-5">
        <SocialSubNav basePath={session.basePath} visible={session.surfaces} />
        <div className="mx-auto max-w-lg py-6">
          {access.upgrade
            ? <UpgradeState title={`Social ${label} needs an upgrade`} description={access.message} planLabel={resolved.surface === 'listening' ? 'Team' : 'Creator Pro'} billingHref={`/${workspaceType}/settings/billing`} />
            : <BlockedState title={`Social ${label} is not available`} description={access.message} />}
        </div>
      </div>
    )
  }

  if (resolved.kind === 'detail') {
    const detailProps = { session, searchParams, id: resolved.id }
    switch (resolved.detail) {
      case 'post': return <PostDetailPage {...detailProps} />
      case 'conversation': return <ConversationDetailPage {...detailProps} />
      case 'connection': return <ConnectionDetailPage {...detailProps} />
      case 'mention': return <MentionDetailPage {...detailProps} />
    }
  }

  const label = SURFACE_LABELS[resolved.surface]
  const nav = (
    <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
      <div className="shrink-0">
        <PageTrail
          compact flush
          crumbs={resolved.surface === 'overview'
            ? [{ label: 'Channels', href: `/${workspaceType}/social` }, { label: 'Social' }]
            : [{ label: 'Social', href: session.basePath }, { label }]}
        />
      </div>
      <span className="hidden h-5 w-px shrink-0 bg-slate-200 lg:block" aria-hidden />
      <div className="min-w-0 flex-1"><SocialSubNav basePath={session.basePath} visible={session.surfaces} /></div>
    </div>
  )
  const props: SocialPageProps = { session, searchParams, nav }

  switch (resolved.surface) {
    case 'publishing': return <PublishingPage {...props} />
    case 'engagement': return <EngagementPage {...props} />
    case 'listening': return <ListeningPage {...props} />
    case 'connections': return <ConnectionsPage {...props} />
    case 'analytics': return <AnalyticsPage {...props} />
    default: return <OverviewPage {...props} />
  }
}
