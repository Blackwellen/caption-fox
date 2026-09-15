import type { ReputationSession } from './server'

// All reads/writes are scoped by workspace_id and rely on the workspace-scoped
// RLS policies defined in supabase/migrations/20260901020000_reputation_module.sql.
// Nothing here trusts a client-supplied workspace id.

export interface OverviewData {
  activeMediaCampaigns: number
  mediaContacts: number
  pitchesSent: number
  earnedCoverage: number
  averageSentiment: number | null
  openReputationRisks: number
  topContacts: { id: string; name: string; outlet: string | null; beat: string | null; relationship_stage: string }[]
  recentCoverage: { id: string; publication: string; headline: string; sentiment: string; published_at: string; url: string | null }[]
  sentimentBreakdown: { positive: number; neutral: number; negative: number; mixed: number }
  nextActions: { id: string; label: string; href: string }[]
}

export async function getOverview(session: ReputationSession): Promise<OverviewData> {
  const { supabase, workspaceId } = session

  const [
    { count: activeMediaCampaigns },
    { count: mediaContacts },
    { count: pitchesSent },
    { count: earnedCoverage },
    { data: coverageRows },
    { data: topContacts },
    { data: recentCoverage },
    { count: openReputationRisks },
    { count: pendingApprovals },
    { count: unresolvedReviews },
  ] = await Promise.all([
    supabase.from('pitches').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).in('status', ['scheduled', 'sending', 'sent']),
    supabase.from('media_contacts').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
    supabase.from('pitches').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('status', 'sent'),
    supabase.from('coverage_mentions').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
    supabase.from('coverage_mentions').select('sentiment').eq('workspace_id', workspaceId),
    supabase.from('media_contacts').select('id, name, relationship_stage, beat, media_outlets(name)').eq('workspace_id', workspaceId).order('influence_score', { ascending: false }).limit(5),
    supabase.from('coverage_mentions').select('id, publication, headline, sentiment, published_at, url').eq('workspace_id', workspaceId).order('published_at', { ascending: false }).limit(5),
    supabase.from('crisis_incidents').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).not('status', 'in', '(resolved,archived)'),
    supabase.from('pitches').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('status', 'pending_approval'),
    supabase.from('reviews').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).in('status', ['new', 'escalated']),
  ])

  const breakdown = { positive: 0, neutral: 0, negative: 0, mixed: 0 }
  let sentimentScoreSum = 0
  const sentimentScore: Record<string, number> = { positive: 1, neutral: 0, mixed: 0, negative: -1 }
  for (const row of coverageRows ?? []) {
    const s = row.sentiment as keyof typeof breakdown
    if (s in breakdown) breakdown[s] += 1
    sentimentScoreSum += sentimentScore[row.sentiment] ?? 0
  }
  const averageSentiment = (coverageRows?.length ?? 0) > 0 ? sentimentScoreSum / (coverageRows!.length) : null

  const nextActions: OverviewData['nextActions'] = []
  if ((pendingApprovals ?? 0) > 0) nextActions.push({ id: 'approvals', label: `${pendingApprovals} pitch${pendingApprovals === 1 ? '' : 'es'} awaiting approval`, href: '/app/reputation/pitches?status=pending_approval' })
  if ((unresolvedReviews ?? 0) > 0) nextActions.push({ id: 'reviews', label: `${unresolvedReviews} review${unresolvedReviews === 1 ? '' : 's'} need a response`, href: '/app/reputation/reviews?status=new' })
  if ((openReputationRisks ?? 0) > 0) nextActions.push({ id: 'crisis', label: `${openReputationRisks} active reputation incident${openReputationRisks === 1 ? '' : 's'}`, href: '/app/reputation/crisis' })

  return {
    activeMediaCampaigns: activeMediaCampaigns ?? 0,
    mediaContacts: mediaContacts ?? 0,
    pitchesSent: pitchesSent ?? 0,
    earnedCoverage: earnedCoverage ?? 0,
    averageSentiment,
    openReputationRisks: openReputationRisks ?? 0,
    topContacts: (topContacts ?? []).map((c: any) => ({ id: c.id, name: c.name, outlet: c.media_outlets?.name ?? null, beat: c.beat, relationship_stage: c.relationship_stage })),
    recentCoverage: recentCoverage ?? [],
    sentimentBreakdown: breakdown,
    nextActions,
  }
}

export async function getMediaLists(session: ReputationSession) {
  const { supabase, workspaceId } = session
  const [{ data: lists }, { data: contacts }] = await Promise.all([
    supabase.from('media_lists').select('id, name, description, status, region, beat, updated_at, media_list_members(count)').eq('workspace_id', workspaceId).order('updated_at', { ascending: false }),
    supabase.from('media_contacts').select('id, name, email, beat, region, relationship_stage, influence_score, verified, last_reply_at, media_outlets(name, outlet_type)').eq('workspace_id', workspaceId).order('influence_score', { ascending: false }),
  ])
  return { lists: lists ?? [], contacts: contacts ?? [] }
}

export async function getPitches(session: ReputationSession) {
  const { supabase, workspaceId } = session
  const [
    { count: drafts }, { count: sentThisMonth }, { count: approvalsPending },
    { data: pitches },
  ] = await Promise.all([
    supabase.from('pitches').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('status', 'draft'),
    supabase.from('pitches').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('status', 'sent').gte('sent_at', new Date(Date.now() - 30 * 86400000).toISOString()),
    supabase.from('pitches').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('status', 'pending_approval'),
    supabase.from('pitches').select('id, name, subject, body, status, sent_at, scheduled_at, updated_at, media_lists(name), pitch_recipients(delivery_status)').eq('workspace_id', workspaceId).order('updated_at', { ascending: false }),
  ])

  const rows = (pitches ?? []).map((p: any) => {
    const recipients: { delivery_status: string }[] = p.pitch_recipients ?? []
    return {
      id: p.id, name: p.name, subject: p.subject, body: p.body as string, status: p.status,
      sentAt: p.sent_at, scheduledAt: p.scheduled_at, updatedAt: p.updated_at,
      listName: p.media_lists?.name ?? null,
      sent: recipients.filter(r => r.delivery_status !== 'pending').length,
      opened: recipients.filter(r => ['opened', 'replied', 'placed'].includes(r.delivery_status)).length,
      replied: recipients.filter(r => ['replied', 'placed'].includes(r.delivery_status)).length,
      placed: recipients.filter(r => r.delivery_status === 'placed').length,
    }
  })

  return {
    drafts: drafts ?? 0, sentThisMonth: sentThisMonth ?? 0, approvalsPending: approvalsPending ?? 0,
    placements: rows.reduce((sum, r) => sum + r.placed, 0),
    pitches: rows,
  }
}

export async function getPressRoom(session: ReputationSession) {
  const { supabase, workspaceId } = session
  const [{ data: releases }, { data: assets }] = await Promise.all([
    supabase.from('press_releases').select('id, title, subtitle, body, category, status, publish_date, downloads, updated_at').eq('workspace_id', workspaceId).order('updated_at', { ascending: false }),
    supabase.from('press_room_assets').select('id, name, asset_type, downloads, updated_at').eq('workspace_id', workspaceId).order('updated_at', { ascending: false }),
  ])
  const releaseRows = releases ?? []
  return {
    releases: releaseRows,
    assets: assets ?? [],
    live: releaseRows.filter(r => r.status === 'published').length,
    pendingApprovals: releaseRows.filter(r => r.status === 'in_review').length,
    totalDownloads: (assets ?? []).reduce((sum, a) => sum + (a.downloads ?? 0), 0) + releaseRows.reduce((sum, r) => sum + (r.downloads ?? 0), 0),
  }
}

export async function getCoverage(session: ReputationSession) {
  const { supabase, workspaceId } = session
  const { data: mentions } = await supabase
    .from('coverage_mentions')
    .select('id, publication, headline, url, published_at, topic, sentiment, estimated_reach, backlinks, region, status')
    .eq('workspace_id', workspaceId)
    .order('published_at', { ascending: false })

  const rows = mentions ?? []
  const totalReach = rows.reduce((sum, r) => sum + (r.estimated_reach ?? 0), 0)
  const positive = rows.filter(r => r.sentiment === 'positive').length
  const backlinks = rows.reduce((sum, r) => sum + (r.backlinks ?? 0), 0)
  const publicationCounts = new Map<string, number>()
  for (const r of rows) publicationCounts.set(r.publication, (publicationCounts.get(r.publication) ?? 0) + 1)
  const topPublications = [...publicationCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([publication, count]) => ({ publication, count }))

  return {
    mentions: rows,
    totalMentions: rows.length,
    estimatedReach: totalReach,
    positivePct: rows.length > 0 ? Math.round((positive / rows.length) * 100) : 0,
    backlinks,
    topPublications,
  }
}

export async function getReviews(session: ReputationSession) {
  const { supabase, workspaceId } = session
  const { data: reviews } = await supabase
    .from('reviews')
    .select('id, source, reviewer_name, rating, review_text, sentiment, status, reviewed_at, review_responses(id, status, published_at)')
    .eq('workspace_id', workspaceId)
    .order('reviewed_at', { ascending: false })

  const rows = reviews ?? []
  const avgRating = rows.length > 0 ? rows.reduce((sum, r) => sum + Number(r.rating ?? 0), 0) / rows.length : 0
  const responded = rows.filter((r: any) => (r.review_responses ?? []).some((resp: any) => resp.status === 'published')).length
  const escalations = rows.filter(r => r.status === 'escalated').length
  const positive = rows.filter(r => r.sentiment === 'positive').length

  return {
    reviews: rows,
    total: rows.length,
    averageRating: avgRating,
    responseRate: rows.length > 0 ? Math.round((responded / rows.length) * 100) : 0,
    unresolved: rows.filter(r => ['new', 'in_progress', 'escalated'].includes(r.status)).length,
    positivePct: rows.length > 0 ? Math.round((positive / rows.length) * 100) : 0,
    escalations,
  }
}

export async function getCrisis(session: ReputationSession) {
  const { supabase, workspaceId } = session
  const { data: incidents } = await supabase
    .from('crisis_incidents')
    .select('id, title, description, severity, status, region, detected_at, resolved_at, crisis_timeline_events(id, event_type, summary, created_at), crisis_statements(id, status, body, version, updated_at)')
    .eq('workspace_id', workspaceId)
    .order('detected_at', { ascending: false })

  const rows = incidents ?? []
  const active = rows.filter(r => !['resolved', 'archived'].includes(r.status))
  const highSeverity = rows.filter(r => ['critical', 'high'].includes(r.severity) && !['resolved', 'archived'].includes(r.status))
  const resolvedThisMonth = rows.filter(r => r.status === 'resolved' && r.resolved_at && new Date(r.resolved_at) > new Date(Date.now() - 30 * 86400000))
  const pendingStatements = rows.flatMap((r: any) => r.crisis_statements ?? []).filter((s: any) => s.status === 'legal_review' || s.status === 'draft')

  return {
    incidents: rows,
    activeIncidents: active.length,
    highSeverity: highSeverity.length,
    openActions: active.length,
    pendingStatements: pendingStatements.length,
    resolvedThisMonth: resolvedThisMonth.length,
  }
}
