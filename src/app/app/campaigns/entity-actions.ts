'use server'

import { revalidatePath } from 'next/cache'
import { getCampaignSession } from '@/lib/campaigns/server'
import { GIVEAWAY_ENTRY_METHODS, COMPETITION_TYPES } from '@/lib/constants'
import type { ActionResult } from './actions'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function revalidateAll() {
  for (const path of ['/app/campaigns', '/app/campaigns/giveaways', '/app/campaigns/competitions', '/app/campaigns/all']) {
    revalidatePath(path)
  }
}

// ============================================================================
// Giveaways
// ============================================================================

export interface GiveawayInput {
  title: string
  description?: string
  prize_title: string
  prize_description?: string
  prize_value?: string
  prize_quantity?: string
  start_date?: string
  end_date?: string
  entry_methods?: string[]
  entry_hashtag?: string
  max_entries_per_person?: string
  min_followers_required?: string
  eligible_countries?: string[]
  winner_count?: string
  winner_selection?: string
  channels?: string[]
  rules?: string
  terms_url?: string
  owner_id?: string
  campaign_id?: string
}

/** Server-side validation mirrors the wizard's per-step rules. */
function validateGiveaway(input: GiveawayInput): string | null {
  if (!input.title?.trim()) return 'Giveaway name is required.'
  if (input.title.trim().length > 140) return 'Giveaway name must be 140 characters or fewer.'
  if (!input.prize_title?.trim()) return 'A prize description is required.'
  if (!input.start_date || !ISO_DATE.test(input.start_date)) return 'A valid start date is required.'
  if (!input.end_date || !ISO_DATE.test(input.end_date)) return 'A valid end date is required.'
  if (input.end_date < input.start_date) return 'The end date cannot be before the start date.'
  if (!input.entry_methods?.length) return 'Choose at least one entry method.'
  const unknown = input.entry_methods.filter(m => !(GIVEAWAY_ENTRY_METHODS as readonly string[]).includes(m))
  if (unknown.length) return `Unsupported entry method: ${unknown[0]}.`
  if (input.prize_value && !Number.isFinite(Number(input.prize_value))) return 'Prize value must be a number.'
  if (input.terms_url && !/^https?:\/\/\S+$/i.test(input.terms_url)) return 'Terms URL must start with http:// or https://.'
  const winners = Number(input.winner_count ?? 1)
  if (!Number.isInteger(winners) || winners < 1 || winners > 1000) return 'Winner count must be between 1 and 1000.'
  return null
}

export async function createGiveaway(input: GiveawayInput): Promise<ActionResult> {
  const session = await getCampaignSession()
  if (!session.capabilities.manageGiveaways) {
    return { ok: false, error: 'Your role does not allow creating giveaways.' }
  }

  const invalid = validateGiveaway(input)
  if (invalid) return { ok: false, error: invalid }

  const { supabase, ctx, userId } = session
  const title = input.title.trim()

  const { data: existing } = await supabase
    .from('giveaways').select('id').eq('workspace_id', ctx.workspaceId).eq('title', title)
    .neq('status', 'archived').maybeSingle()
  if (existing) return { ok: false, error: 'A giveaway with this name already exists in this workspace.' }

  const { data, error } = await supabase.from('giveaways').insert({
    workspace_id: ctx.workspaceId,
    campaign_id: input.campaign_id || null,
    title,
    description: input.description?.trim()?.slice(0, 2000) || null,
    status: 'draft',
    start_date: `${input.start_date}T00:00:00Z`,
    end_date: `${input.end_date}T23:59:59Z`,
    prize_title: input.prize_title.trim(),
    prize_description: input.prize_description?.trim()?.slice(0, 2000) || null,
    prize_value: input.prize_value ? Number(input.prize_value) : null,
    prize_quantity: input.prize_quantity ? Number(input.prize_quantity) : 1,
    entry_methods: input.entry_methods,
    entry_hashtag: input.entry_hashtag?.trim() || null,
    max_entries_per_person: input.max_entries_per_person ? Number(input.max_entries_per_person) : 1,
    min_followers_required: input.min_followers_required ? Number(input.min_followers_required) : 0,
    eligible_countries: input.eligible_countries ?? [],
    winner_count: Number(input.winner_count ?? 1),
    winner_selection: input.winner_selection === 'manual' ? 'manual' : 'random',
    channels: input.channels ?? [],
    platform: input.channels?.length === 1 ? input.channels[0] : 'multi',
    rules: input.rules?.trim()?.slice(0, 5000) || null,
    terms_url: input.terms_url?.trim() || null,
    owner_id: input.owner_id || userId,
    created_by: userId,
  }).select('id, title').single()

  if (error) return { ok: false, error: error.message }

  await supabase.from('campaign_activity').insert({
    workspace_id: ctx.workspaceId, actor_id: userId, entity_type: 'giveaway',
    entity_id: data.id, action: 'created', summary: `created giveaway ${data.title}`,
    link: `/app/campaigns/giveaways/${data.id}`, surface: 'giveaways',
  })

  revalidateAll()
  return { ok: true, id: data.id, message: `${data.title} created as a draft.` }
}

export async function setGiveawayFulfilment(id: string, state: string): Promise<ActionResult> {
  const session = await getCampaignSession()
  if (!session.capabilities.manageGiveaways) {
    return { ok: false, error: 'Your role does not allow updating giveaways.' }
  }
  if (!['pending', 'in_progress', 'fulfilled', 'cancelled'].includes(state)) {
    return { ok: false, error: 'Unknown fulfilment state.' }
  }

  const { supabase, ctx, userId } = session
  const { data: giveaway } = await supabase
    .from('giveaways').select('id, title').eq('id', id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!giveaway) return { ok: false, error: 'Giveaway not found in this workspace.' }

  const { error } = await supabase.from('giveaways')
    .update({ prize_fulfilment: state }).eq('id', id).eq('workspace_id', ctx.workspaceId)
  if (error) return { ok: false, error: error.message }

  await supabase.from('campaign_activity').insert({
    workspace_id: ctx.workspaceId, actor_id: userId, entity_type: 'giveaway', entity_id: id,
    action: `fulfilment_${state}`, summary: `marked prize fulfilment as ${state.replace('_', ' ')} for ${giveaway.title}`,
    link: `/app/campaigns/giveaways/${id}`, surface: 'giveaways',
  })

  revalidateAll()
  return { ok: true, message: 'Prize fulfilment updated.' }
}

// ============================================================================
// Competitions
// ============================================================================

export interface CompetitionInput {
  title: string
  description?: string
  competition_type: string
  start_date?: string
  end_date?: string
  submission_deadline?: string
  prize_title?: string
  prize_value?: string
  judging_type?: string
  max_submissions_per_person?: string
  min_age?: string
  eligible_countries?: string[]
  entry_hashtag?: string
  rules?: string
  terms_url?: string
  channels?: string[]
  owner_id?: string
  campaign_id?: string
}

function validateCompetition(input: CompetitionInput): string | null {
  if (!input.title?.trim()) return 'Competition name is required.'
  if (input.title.trim().length > 140) return 'Competition name must be 140 characters or fewer.'
  if (!(COMPETITION_TYPES as readonly string[]).includes(input.competition_type)) return 'Choose a competition category.'
  if (!input.start_date || !ISO_DATE.test(input.start_date)) return 'A valid start date is required.'
  if (!input.end_date || !ISO_DATE.test(input.end_date)) return 'A valid end date is required.'
  if (input.end_date < input.start_date) return 'The end date cannot be before the start date.'
  if (input.submission_deadline) {
    if (!ISO_DATE.test(input.submission_deadline)) return 'The submission deadline must be a valid date.'
    if (input.submission_deadline > input.end_date) return 'The submission deadline cannot be after the competition ends.'
    if (input.submission_deadline < input.start_date) return 'The submission deadline cannot be before the competition starts.'
  }
  if (input.terms_url && !/^https?:\/\/\S+$/i.test(input.terms_url)) return 'Terms URL must start with http:// or https://.'
  if (input.min_age && (!Number.isInteger(Number(input.min_age)) || Number(input.min_age) < 0 || Number(input.min_age) > 120)) {
    return 'Minimum age must be a whole number between 0 and 120.'
  }
  return null
}

export async function createCompetition(input: CompetitionInput): Promise<ActionResult> {
  const session = await getCampaignSession()
  if (!session.capabilities.manageCompetitions) {
    return { ok: false, error: 'Your role does not allow creating competitions.' }
  }

  const invalid = validateCompetition(input)
  if (invalid) return { ok: false, error: invalid }

  const { supabase, ctx, userId } = session
  const title = input.title.trim()

  const { data: existing } = await supabase
    .from('competitions').select('id').eq('workspace_id', ctx.workspaceId).eq('title', title)
    .neq('status', 'archived').maybeSingle()
  if (existing) return { ok: false, error: 'A competition with this name already exists in this workspace.' }

  const { data, error } = await supabase.from('competitions').insert({
    workspace_id: ctx.workspaceId,
    campaign_id: input.campaign_id || null,
    title,
    description: input.description?.trim()?.slice(0, 2000) || null,
    competition_type: input.competition_type,
    status: 'draft',
    judging_stage: 'pending',
    start_date: `${input.start_date}T00:00:00Z`,
    end_date: `${input.end_date}T23:59:59Z`,
    submission_deadline: input.submission_deadline ? `${input.submission_deadline}T23:59:59Z` : null,
    prize_title: input.prize_title?.trim() || null,
    prize_value: input.prize_value ? Number(input.prize_value) : null,
    judging_type: ['panel', 'public_vote', 'hybrid'].includes(input.judging_type ?? '') ? input.judging_type : 'panel',
    max_submissions_per_person: input.max_submissions_per_person ? Number(input.max_submissions_per_person) : 1,
    min_age: input.min_age ? Number(input.min_age) : null,
    eligible_countries: input.eligible_countries ?? null,
    entry_hashtag: input.entry_hashtag?.trim() || null,
    rules: input.rules?.trim()?.slice(0, 5000) || null,
    terms_url: input.terms_url?.trim() || null,
    channels: input.channels ?? [],
    owner_id: input.owner_id || userId,
    created_by: userId,
  }).select('id, title').single()

  if (error) return { ok: false, error: error.message }

  await supabase.from('campaign_activity').insert({
    workspace_id: ctx.workspaceId, actor_id: userId, entity_type: 'competition',
    entity_id: data.id, action: 'created', summary: `created competition ${data.title}`,
    link: `/app/campaigns/competitions/${data.id}`, surface: 'competitions',
  })

  revalidateAll()
  return { ok: true, id: data.id, message: `${data.title} created as a draft.` }
}

const JUDGING_FLOW = ['pending', 'in_progress', 'review', 'shortlist', 'final_review', 'completed']

/** Judging stages advance in order; skipping ahead is rejected server-side. */
export async function setCompetitionJudgingStage(id: string, stage: string): Promise<ActionResult> {
  const session = await getCampaignSession()
  if (!session.capabilities.judge) {
    return { ok: false, error: 'Your role does not allow managing judging.' }
  }
  if (!JUDGING_FLOW.includes(stage)) return { ok: false, error: 'Unknown judging stage.' }

  const { supabase, ctx, userId } = session
  const { data: competition } = await supabase
    .from('competitions').select('id, title, judging_stage')
    .eq('id', id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!competition) return { ok: false, error: 'Competition not found in this workspace.' }

  const fromIndex = JUDGING_FLOW.indexOf(competition.judging_stage as string)
  const toIndex = JUDGING_FLOW.indexOf(stage)
  if (toIndex > fromIndex + 1) {
    return { ok: false, error: `Judging must move through ${JUDGING_FLOW[fromIndex + 1].replace('_', ' ')} first.` }
  }

  const { error } = await supabase.from('competitions')
    .update({ judging_stage: stage, status: stage === 'completed' ? 'completed' : 'judging' })
    .eq('id', id).eq('workspace_id', ctx.workspaceId)
  if (error) return { ok: false, error: error.message }

  await supabase.from('campaign_activity').insert({
    workspace_id: ctx.workspaceId, actor_id: userId, entity_type: 'competition', entity_id: id,
    action: `judging_${stage}`, summary: `advanced ${competition.title} to ${stage.replace('_', ' ')}`,
    link: `/app/campaigns/competitions/${id}`, surface: 'competitions',
  })

  revalidateAll()
  return { ok: true, message: `Judging moved to ${stage.replace('_', ' ')}.` }
}
