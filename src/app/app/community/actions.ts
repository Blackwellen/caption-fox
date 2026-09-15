'use server'

import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getCommunitySession } from '@/lib/community/server'
import type { CommunityCapabilities } from '@/lib/community/entitlements'
import { canTransitionModeration, MODERATION_DECISIONS, type ModerationDecision } from '@/lib/community/constants'

export interface ActionResult {
  ok: boolean
  error?: string
  message?: string
}

const COMMUNITY_PATHS = [
  '/app/community', '/app/community/communities', '/app/community/calendar',
  '/app/community/moderation', '/app/community/members', '/app/community/advocacy',
]

function revalidateCommunity() {
  for (const path of COMMUNITY_PATHS) revalidatePath(path)
}

function fail(error: string): ActionResult {
  return { ok: false, error }
}

async function authorise(capability: keyof CommunityCapabilities) {
  const session = await getCommunitySession()
  if (!session.capabilities[capability]) {
    return { session: null, error: 'Your role does not allow this action.' } as const
  }
  return { session, error: null } as const
}

async function logActivity(
  supabase: SupabaseClient,
  workspaceId: string,
  actorId: string,
  entry: {
    communityId?: string | null; entityType: string; entityId?: string | null; action: string
    summary: string; link?: string | null; surface?: string | null
  },
) {
  const { error } = await supabase.from('community_activity').insert({
    workspace_id: workspaceId,
    community_id: entry.communityId ?? null,
    actor_id: actorId,
    entity_type: entry.entityType,
    entity_id: entry.entityId ?? null,
    action: entry.action,
    summary: entry.summary,
    link: entry.link ?? null,
    surface: entry.surface ?? null,
  })
  if (error) console.error('[community] activity log failed', error.message)
}

// ============================================================================
// Moderation
// ============================================================================

const DECISION_TO_STATUS: Record<ModerationDecision, string> = {
  approve: 'resolved',
  remove_content: 'resolved',
  warn_user: 'resolved',
  suspend_user: 'resolved',
  ban_user: 'resolved',
  escalate: 'escalated',
}

const DECISION_CAPABILITY: Record<ModerationDecision, keyof CommunityCapabilities> = {
  approve: 'reviewModeration',
  remove_content: 'removeContent',
  warn_user: 'warnUser',
  suspend_user: 'suspendUser',
  ban_user: 'banUser',
  escalate: 'reviewModeration',
}

const DECISION_SUMMARY: Record<ModerationDecision, string> = {
  approve: 'approved a moderation report',
  remove_content: 'removed reported content',
  warn_user: 'warned a member',
  suspend_user: 'suspended a member',
  ban_user: 'banned a member',
  escalate: 'escalated a moderation report',
}

export async function decideModerationReport(input: {
  reportId: string
  decision: ModerationDecision
  notes?: string
}): Promise<ActionResult> {
  if (!MODERATION_DECISIONS.includes(input.decision)) return fail('Unknown decision.')
  const capability = DECISION_CAPABILITY[input.decision]
  const { session, error } = await authorise(capability)
  if (!session) return fail(error ?? 'Not allowed.')
  const { supabase, ctx, userId } = session

  const { data: report } = await supabase
    .from('community_moderation_reports')
    .select('id, status, community_id, reported_member_id')
    .eq('id', input.reportId).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!report) return fail('Report not found.')

  const nextStatus = DECISION_TO_STATUS[input.decision]
  if (!canTransitionModeration(report.status, nextStatus)) {
    return fail('This report has already been resolved and cannot be actioned again.')
  }

  const { error: decisionError } = await supabase.from('community_moderation_decisions').insert({
    workspace_id: ctx.workspaceId,
    report_id: input.reportId,
    moderator_id: userId,
    decision: input.decision,
    notes: input.notes?.trim() || null,
  })
  if (decisionError) return fail(decisionError.message)

  const { error: updateError } = await supabase.from('community_moderation_reports')
    .update({ status: nextStatus, resolved_at: nextStatus === 'resolved' ? new Date().toISOString() : null })
    .eq('id', input.reportId).eq('workspace_id', ctx.workspaceId)
  if (updateError) return fail(updateError.message)

  if (input.decision === 'suspend_user' && report.reported_member_id) {
    await supabase.from('community_members').update({ status: 'suspended' })
      .eq('id', report.reported_member_id).eq('workspace_id', ctx.workspaceId)
  }
  if (input.decision === 'ban_user' && report.reported_member_id) {
    await supabase.from('community_members').update({ status: 'banned' })
      .eq('id', report.reported_member_id).eq('workspace_id', ctx.workspaceId)
  }

  await logActivity(supabase, ctx.workspaceId, userId, {
    communityId: report.community_id, entityType: 'moderation', entityId: input.reportId,
    action: input.decision, summary: `Moderator ${DECISION_SUMMARY[input.decision]}`,
    link: `/app/community/moderation?selected=${input.reportId}`, surface: 'moderation',
  })

  revalidateCommunity()
  return { ok: true, message: 'Decision recorded.' }
}

// ============================================================================
// Membership requests
// ============================================================================

export async function reviewMembershipRequest(input: {
  requestId: string
  approve: boolean
}): Promise<ActionResult> {
  const { session, error } = await authorise('approveMembers')
  if (!session) return fail(error ?? 'Not allowed.')
  const { supabase, ctx, userId } = session

  const { data: request } = await supabase
    .from('community_membership_requests')
    .select('id, status, community_id, applicant_name, applicant_email')
    .eq('id', input.requestId).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!request) return fail('Request not found.')
  if (request.status !== 'pending') return fail('This request has already been reviewed.')

  const status = input.approve ? 'approved' : 'rejected'
  const { error: updateError } = await supabase.from('community_membership_requests')
    .update({ status, reviewed_by: userId, reviewed_at: new Date().toISOString() })
    .eq('id', input.requestId).eq('workspace_id', ctx.workspaceId)
  if (updateError) return fail(updateError.message)

  if (input.approve) {
    const { error: insertError } = await supabase.from('community_members').insert({
      workspace_id: ctx.workspaceId,
      community_id: request.community_id,
      display_name: request.applicant_name,
      email: request.applicant_email,
      role: 'member',
      lifecycle_stage: 'new',
      status: 'active',
    })
    if (insertError) return fail(insertError.message)

    const { data: community } = await supabase.from('communities')
      .select('member_count').eq('id', request.community_id).eq('workspace_id', ctx.workspaceId).maybeSingle()
    if (community) {
      await supabase.from('communities')
        .update({ member_count: (community.member_count ?? 0) + 1 })
        .eq('id', request.community_id).eq('workspace_id', ctx.workspaceId)
    }
  }

  await logActivity(supabase, ctx.workspaceId, userId, {
    communityId: request.community_id, entityType: 'member', entityId: input.requestId,
    action: status, summary: `Membership request for ${request.applicant_name} was ${status}`,
    link: '/app/community/members', surface: 'members',
  })

  revalidateCommunity()
  return { ok: true, message: input.approve ? 'Member approved.' : 'Request rejected.' }
}

// ============================================================================
// Advocacy rewards
// ============================================================================

export async function reviewReward(input: {
  rewardId: string
  approve: boolean
}): Promise<ActionResult> {
  const { session, error } = await authorise('approveRewards')
  if (!session) return fail(error ?? 'Not allowed.')
  const { supabase, ctx, userId } = session

  const { data: reward } = await supabase
    .from('community_rewards')
    .select('id, status, member_id, reward_description')
    .eq('id', input.rewardId).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!reward) return fail('Reward not found.')
  if (reward.status !== 'pending') return fail('This reward has already been reviewed.')

  const status = input.approve ? 'approved' : 'rejected'
  const { error: updateError } = await supabase.from('community_rewards')
    .update({ status, approved_by: userId, approved_at: new Date().toISOString() })
    .eq('id', input.rewardId).eq('workspace_id', ctx.workspaceId)
  if (updateError) return fail(updateError.message)

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'reward', entityId: input.rewardId,
    action: status, summary: `Reward "${reward.reward_description}" was ${status}`,
    link: '/app/community/advocacy', surface: 'advocacy',
  })

  revalidateCommunity()
  return { ok: true, message: input.approve ? 'Reward approved.' : 'Reward rejected.' }
}
