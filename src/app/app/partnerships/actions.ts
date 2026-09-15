'use server'

import { revalidatePath } from 'next/cache'
import { randomBytes } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getPartnershipSession } from '@/lib/partnerships/server'
import type { PartnershipCapabilities } from '@/lib/partnerships/entitlements'
import type { ProgrammeType } from '@/lib/partnerships/constants'

export interface ActionResult {
  ok: boolean
  error?: string
  id?: string
  message?: string
}

const PARTNERSHIP_PATHS = [
  '/app/partnerships', '/app/partnerships/affiliates', '/app/partnerships/referrals',
  '/app/partnerships/ambassadors', '/app/partnerships/loyalty', '/app/partnerships/resellers',
  '/app/partnerships/co-marketing',
]

function revalidatePartnerships() {
  for (const path of PARTNERSHIP_PATHS) revalidatePath(path)
}

function fail(error: string): ActionResult {
  return { ok: false, error }
}

async function logActivity(
  supabase: SupabaseClient,
  workspaceId: string,
  actorId: string,
  entry: {
    entityType: string; entityId?: string | null; action: string
    summary: string; link?: string | null; surface?: string | null
    metadata?: Record<string, unknown>
  },
) {
  const { error } = await supabase.from('partnership_activity').insert({
    workspace_id: workspaceId,
    actor_id: actorId,
    entity_type: entry.entityType,
    entity_id: entry.entityId ?? null,
    action: entry.action,
    summary: entry.summary,
    link: entry.link ?? null,
    surface: entry.surface ?? null,
    metadata: entry.metadata ?? {},
  })
  if (error) console.error('[partnerships] activity log failed', error.message)
}

async function authorise(capability: keyof PartnershipCapabilities) {
  const session = await getPartnershipSession()
  if (!session.capabilities[capability]) {
    return { session: null, error: 'Your role does not allow this action.' } as const
  }
  return { session, error: null } as const
}

async function ownsRecord(
  supabase: SupabaseClient, table: string, id: string, workspaceId: string,
): Promise<boolean> {
  const { data } = await supabase.from(table).select('id').eq('id', id).eq('workspace_id', workspaceId).maybeSingle()
  return Boolean(data)
}

// ============================================================================
// Programmes
// ============================================================================

export interface ProgrammeInput {
  name: string
  programme_type: ProgrammeType
  category?: string
  description?: string
  status?: string
  owner_id?: string
  commission_type?: string
  commission_rate?: string
  currency?: string
  tracking_window_days?: string
  start_date?: string
  end_date?: string
  channels?: string[]
  terms_url?: string
}

function validateProgramme(input: ProgrammeInput): string | null {
  const name = input.name?.trim()
  if (!name) return 'Programme name is required.'
  if (name.length > 140) return 'Programme name must be 140 characters or fewer.'
  if (input.start_date && input.end_date && input.end_date < input.start_date) {
    return 'End date cannot be before the start date.'
  }
  if (input.commission_rate) {
    const rate = Number(input.commission_rate)
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) return 'Commission rate must be between 0 and 100.'
  }
  return null
}

export async function createProgramme(input: ProgrammeInput): Promise<ActionResult> {
  const { session, error } = await authorise('createProgramme')
  if (!session) return fail(error)

  const invalid = validateProgramme(input)
  if (invalid) return fail(invalid)

  const { supabase, ctx, userId } = session
  const name = input.name.trim()

  const { data: existing } = await supabase
    .from('partnership_programmes').select('id').eq('workspace_id', ctx.workspaceId).eq('name', name)
    .is('archived_at', null).maybeSingle()
  if (existing) return fail('A programme with this name already exists in this workspace.')

  const { data, error: insertError } = await supabase.from('partnership_programmes').insert({
    workspace_id: ctx.workspaceId,
    name,
    programme_type: input.programme_type,
    category: input.category?.trim() || null,
    description: input.description?.trim() || null,
    status: input.status || 'draft',
    owner_id: input.owner_id || userId,
    commission_type: input.commission_type || 'percentage',
    commission_rate: input.commission_rate ? Number(input.commission_rate) : 0,
    currency: input.currency || 'GBP',
    tracking_window_days: input.tracking_window_days ? Number(input.tracking_window_days) : 30,
    start_date: input.start_date || null,
    end_date: input.end_date || null,
    channels: input.channels ?? [],
    terms_url: input.terms_url?.trim() || null,
    created_by: userId,
  }).select('id').single()

  if (insertError) return fail(insertError.message)

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'programme', entityId: data.id, action: 'created',
    summary: `${name} programme created`, link: `/app/partnerships/${input.programme_type === 'co_marketing' ? 'co-marketing' : `${input.programme_type}s`}`,
    surface: 'partnerships',
  })

  revalidatePartnerships()
  return { ok: true, id: data.id, message: 'Programme created.' }
}

export async function updateProgrammeStatus(programmeId: string, status: string): Promise<ActionResult> {
  const { session, error } = await authorise('editProgramme')
  if (!session) return fail(error)
  const { supabase, ctx, userId } = session

  if (!(await ownsRecord(supabase, 'partnership_programmes', programmeId, ctx.workspaceId))) {
    return fail('Programme not found in this workspace.')
  }

  const { error: updateError } = await supabase.from('partnership_programmes')
    .update({ status }).eq('id', programmeId).eq('workspace_id', ctx.workspaceId)
  if (updateError) return fail(updateError.message)

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'programme', entityId: programmeId, action: 'status_changed',
    summary: `Programme status changed to ${status}`, surface: 'partnerships',
  })

  revalidatePartnerships()
  return { ok: true, message: 'Programme updated.' }
}

export async function archiveProgramme(programmeId: string): Promise<ActionResult> {
  const { session, error } = await authorise('archiveProgramme')
  if (!session) return fail(error)
  const { supabase, ctx, userId } = session

  if (!(await ownsRecord(supabase, 'partnership_programmes', programmeId, ctx.workspaceId))) {
    return fail('Programme not found in this workspace.')
  }

  const { error: updateError } = await supabase.from('partnership_programmes')
    .update({ archived_at: new Date().toISOString(), status: 'archived' })
    .eq('id', programmeId).eq('workspace_id', ctx.workspaceId)
  if (updateError) return fail(updateError.message)

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'programme', entityId: programmeId, action: 'archived',
    summary: 'Programme archived', surface: 'partnerships',
  })

  revalidatePartnerships()
  return { ok: true, message: 'Programme archived.' }
}

// ============================================================================
// Partners
// ============================================================================

export interface PartnerInput {
  programme_id: string
  partner_type: string
  name: string
  handle?: string
  email?: string
  owner_id?: string
  tier_id?: string
  status?: string
  platforms?: string[]
  region?: string
}

function validatePartner(input: PartnerInput): string | null {
  const name = input.name?.trim()
  if (!name) return 'Partner name is required.'
  if (name.length > 140) return 'Partner name must be 140 characters or fewer.'
  if (!input.programme_id) return 'A programme must be selected.'
  if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) return 'Enter a valid email address.'
  return null
}

export async function createPartner(input: PartnerInput): Promise<ActionResult> {
  const { session, error } = await authorise('createPartner')
  if (!session) return fail(error)

  const invalid = validatePartner(input)
  if (invalid) return fail(invalid)

  const { supabase, ctx, userId } = session

  if (!(await ownsRecord(supabase, 'partnership_programmes', input.programme_id, ctx.workspaceId))) {
    return fail('Programme not found in this workspace.')
  }

  const name = input.name.trim()
  const now = new Date().toISOString()

  const { data, error: insertError } = await supabase.from('partnership_partners').insert({
    workspace_id: ctx.workspaceId,
    programme_id: input.programme_id,
    partner_type: input.partner_type,
    name,
    handle: input.handle?.trim() || null,
    email: input.email?.trim() || null,
    owner_id: input.owner_id || userId,
    tier_id: input.tier_id || null,
    status: input.status || 'active',
    platforms: input.platforms ?? [],
    region: input.region?.trim() || null,
    joined_at: now,
    approved_at: (input.status ?? 'active') === 'active' ? now : null,
    last_activity_at: now,
    created_by: userId,
  }).select('id').single()

  if (insertError) return fail(insertError.message)

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'partner', entityId: data.id, action: 'created',
    summary: `${name} added as a partner`, surface: 'partnerships',
  })

  revalidatePartnerships()
  return { ok: true, id: data.id, message: 'Partner added.' }
}

export async function updatePartnerStatus(partnerId: string, status: string, healthReason?: string): Promise<ActionResult> {
  const { session, error } = await authorise('editPartner')
  if (!session) return fail(error)
  const { supabase, ctx, userId } = session

  const { data: partner } = await supabase.from('partnership_partners')
    .select('id, name').eq('id', partnerId).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!partner) return fail('Partner not found in this workspace.')

  const patch: Record<string, unknown> = { status, last_activity_at: new Date().toISOString() }
  if (status === 'suspended' || status === 'at_risk') patch.health = status === 'suspended' ? 'critical' : 'at_risk'
  if (healthReason) patch.health_reason = healthReason

  const { error: updateError } = await supabase.from('partnership_partners')
    .update(patch).eq('id', partnerId).eq('workspace_id', ctx.workspaceId)
  if (updateError) return fail(updateError.message)

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'partner', entityId: partnerId, action: 'status_changed',
    summary: `${partner.name} status changed to ${status}`, surface: 'partnerships',
  })

  revalidatePartnerships()
  return { ok: true, message: 'Partner updated.' }
}

// ============================================================================
// Applications
// ============================================================================

export async function reviewApplication(
  applicationId: string, decision: 'approved' | 'rejected' | 'changes_requested', notes?: string,
): Promise<ActionResult> {
  const { session, error } = await authorise('approveApplications')
  if (!session) return fail(error)
  const { supabase, ctx, userId } = session

  const { data: application } = await supabase.from('partnership_applications')
    .select('id, applicant_name, applicant_email, programme_id, partner_id')
    .eq('id', applicationId).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!application) return fail('Application not found in this workspace.')

  const { error: updateError } = await supabase.from('partnership_applications').update({
    status: decision, reviewed_by: userId, reviewed_at: new Date().toISOString(), review_notes: notes ?? null,
  }).eq('id', applicationId).eq('workspace_id', ctx.workspaceId)
  if (updateError) return fail(updateError.message)

  if (decision === 'approved') {
    if (application.partner_id) {
      await supabase.from('partnership_partners').update({
        status: 'active', approved_at: new Date().toISOString(),
      }).eq('id', application.partner_id).eq('workspace_id', ctx.workspaceId)
    } else {
      const { data: programme } = await supabase.from('partnership_programmes')
        .select('programme_type').eq('id', application.programme_id).single()
      await supabase.from('partnership_partners').insert({
        workspace_id: ctx.workspaceId,
        programme_id: application.programme_id,
        partner_type: programme?.programme_type ? `${programme.programme_type}${programme.programme_type === 'referral' ? '_advocate' : programme.programme_type === 'ambassador' ? '' : programme.programme_type === 'loyalty' ? '_member' : programme.programme_type === 'co_marketing' ? '_partner' : ''}` : 'affiliate',
        name: application.applicant_name,
        email: application.applicant_email,
        status: 'active',
        joined_at: new Date().toISOString(),
        approved_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString(),
        created_by: userId,
      })
    }
  }

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'application', entityId: applicationId, action: `application_${decision}`,
    summary: `${application.applicant_name}'s application was ${decision.replace('_', ' ')}`, surface: 'partnerships',
  })

  revalidatePartnerships()
  return { ok: true, message: 'Application updated.' }
}

// ============================================================================
// Conversions (manual entry until a storefront/webhook integration is wired —
// commission is always computed server-side from the programme's rate, never
// trusted from client input)
// ============================================================================

export async function recordConversion(input: {
  partner_id: string
  conversion_type: string
  value: string
  tracking_link_id?: string
}): Promise<ActionResult> {
  const { session, error } = await authorise('manageCommissions')
  if (!session) return fail(error)
  const { supabase, ctx, userId } = session

  const value = Number(input.value)
  if (!Number.isFinite(value) || value < 0) return fail('Enter a valid conversion value.')

  const { data: partner } = await supabase.from('partnership_partners')
    .select('id, name, programme_id, programme:partnership_programmes(id, commission_type, commission_rate, currency)')
    .eq('id', input.partner_id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!partner) return fail('Partner not found in this workspace.')

  const programme = Array.isArray(partner.programme) ? partner.programme[0] : partner.programme
  const rate = Number(programme?.commission_rate ?? 0)
  const currency = programme?.currency ?? 'GBP'

  const { data: conversion, error: convError } = await supabase.from('partnership_conversions').insert({
    workspace_id: ctx.workspaceId,
    programme_id: partner.programme_id,
    partner_id: partner.id,
    tracking_link_id: input.tracking_link_id || null,
    conversion_type: input.conversion_type || 'sale',
    value, currency, status: 'valid',
  }).select('id').single()
  if (convError) return fail(convError.message)

  const commissionAmount = programme?.commission_type === 'percentage'
    ? Math.round(value * (rate / 100) * 100) / 100
    : rate

  const { error: commError } = await supabase.from('partnership_commissions').insert({
    workspace_id: ctx.workspaceId, programme_id: partner.programme_id, partner_id: partner.id,
    conversion_id: conversion.id, calculation_basis: programme?.commission_type ?? 'percentage',
    rate, amount: commissionAmount, currency, status: 'pending',
  })
  if (commError) return fail(commError.message)

  await supabase.from('partnership_partners').update({ last_activity_at: new Date().toISOString() })
    .eq('id', partner.id).eq('workspace_id', ctx.workspaceId)

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'conversion', entityId: conversion.id, action: 'created',
    summary: `Conversion recorded for ${partner.name}`, surface: 'partnerships',
  })

  revalidatePartnerships()
  return { ok: true, id: conversion.id, message: 'Conversion recorded.' }
}

// ============================================================================
// Commissions & Payouts
// ============================================================================

export async function updateCommissionStatus(commissionId: string, status: string): Promise<ActionResult> {
  const { session, error } = await authorise(status === 'approved' ? 'approveCommissions' : 'manageCommissions')
  if (!session) return fail(error)
  const { supabase, ctx, userId } = session

  if (!(await ownsRecord(supabase, 'partnership_commissions', commissionId, ctx.workspaceId))) {
    return fail('Commission not found in this workspace.')
  }

  const patch: Record<string, unknown> = { status }
  if (status === 'approved') { patch.approved_by = userId; patch.approved_at = new Date().toISOString() }

  const { error: updateError } = await supabase.from('partnership_commissions')
    .update(patch).eq('id', commissionId).eq('workspace_id', ctx.workspaceId)
  if (updateError) return fail(updateError.message)

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'commission', entityId: commissionId, action: 'status_changed',
    summary: `Commission ${status}`, surface: 'partnerships',
  })

  revalidatePartnerships()
  return { ok: true, message: 'Commission updated.' }
}

export async function updatePayoutStatus(payoutId: string, status: string): Promise<ActionResult> {
  const capability = status === 'approved' ? 'approvePayouts' : status === 'paid' || status === 'processing' ? 'processPayouts' : 'viewPayouts'
  const { session, error } = await authorise(capability)
  if (!session) return fail(error)
  const { supabase, ctx, userId } = session

  if (!(await ownsRecord(supabase, 'partnership_payouts', payoutId, ctx.workspaceId))) {
    return fail('Payout not found in this workspace.')
  }

  const patch: Record<string, unknown> = { status }
  if (status === 'approved') { patch.approved_by = userId; patch.approved_at = new Date().toISOString() }
  if (status === 'paid') patch.paid_at = new Date().toISOString()

  const { error: updateError } = await supabase.from('partnership_payouts')
    .update(patch).eq('id', payoutId).eq('workspace_id', ctx.workspaceId)
  if (updateError) return fail(updateError.message)

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'payout', entityId: payoutId, action: 'status_changed',
    summary: `Payout marked ${status.replace('_', ' ')}`, surface: 'partnerships',
  })

  revalidatePartnerships()
  return { ok: true, message: 'Payout updated.' }
}

/**
 * Pays out a partner for real via a Stripe Connect transfer. Requires the
 * payout to be `approved` and the partner's connected account to be
 * `verified` with payouts enabled — refuses otherwise rather than silently
 * marking the payout paid. This is the only path that moves real money;
 * `updatePayoutStatus` above only ever changes a status label.
 */
export async function processPayoutViaStripe(payoutId: string): Promise<ActionResult> {
  const { session, error } = await authorise('processPayouts')
  if (!session) return fail(error)
  const { supabase, ctx, userId } = session

  const { data: payout } = await supabase.from('partnership_payouts')
    .select('id, partner_id, net_amount, currency, status')
    .eq('id', payoutId).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!payout) return fail('Payout not found in this workspace.')
  if (payout.status !== 'approved') return fail('Only approved payouts can be paid — approve it first.')
  if (Number(payout.net_amount) <= 0) return fail('Payout amount must be greater than zero.')

  const { data: partner } = await supabase.from('partnership_partners')
    .select('id, name, stripe_account_id, stripe_account_status, stripe_payouts_enabled')
    .eq('id', payout.partner_id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!partner) return fail('Partner not found in this workspace.')
  if (!partner.stripe_account_id || partner.stripe_account_status !== 'verified' || !partner.stripe_payouts_enabled) {
    return fail(`${partner.name} has not completed Stripe Connect verification yet — they can't be paid via Stripe until they have.`)
  }

  const { partnershipsStripe } = await import('@/lib/partnerships/stripe')
  const stripe = partnershipsStripe()

  await supabase.from('partnership_payouts').update({ status: 'processing', provider: 'stripe' })
    .eq('id', payoutId).eq('workspace_id', ctx.workspaceId)

  try {
    const transfer = await stripe.transfers.create({
      amount: Math.round(Number(payout.net_amount) * 100),
      currency: payout.currency.toLowerCase(),
      destination: partner.stripe_account_id,
      transfer_group: `partnership_payout_${payout.id}`,
      metadata: { caption_fox_payout_id: payout.id, caption_fox_workspace_id: ctx.workspaceId },
    })

    await supabase.from('partnership_payouts').update({
      status: 'paid', provider: 'stripe', provider_reference: transfer.id,
      provider_error: null, paid_at: new Date().toISOString(),
    }).eq('id', payoutId).eq('workspace_id', ctx.workspaceId)

    await logActivity(supabase, ctx.workspaceId, userId, {
      entityType: 'payout', entityId: payoutId, action: 'paid_via_stripe',
      summary: `${partner.name} paid £${Number(payout.net_amount).toFixed(2)} via Stripe (${transfer.id})`, surface: 'partnerships',
    })
  } catch (stripeError) {
    const message = stripeError instanceof Error ? stripeError.message : 'Stripe transfer failed.'
    await supabase.from('partnership_payouts').update({ status: 'failed', provider_error: message })
      .eq('id', payoutId).eq('workspace_id', ctx.workspaceId)
    await logActivity(supabase, ctx.workspaceId, userId, {
      entityType: 'payout', entityId: payoutId, action: 'stripe_transfer_failed',
      summary: `Stripe payout to ${partner.name} failed: ${message}`, surface: 'partnerships',
    })
    revalidatePartnerships()
    return fail(message)
  }

  revalidatePartnerships()
  return { ok: true, message: 'Paid via Stripe.' }
}

// ============================================================================
// Bulk import
// ============================================================================

export interface ImportPartnerRow {
  name: string
  email?: string
  handle?: string
  region?: string
}

export interface ImportResult {
  ok: boolean
  error?: string
  imported: number
  skipped: { row: number; reason: string }[]
}

/**
 * Validates and inserts up to 500 rows in one workspace-scoped batch. Never
 * trusts row-level programme/workspace fields from the client — every row is
 * created under the caller-supplied programme, which is itself ownership
 * checked before any insert runs.
 */
export async function importPartners(
  programmeId: string, partnerType: string, rows: ImportPartnerRow[],
): Promise<ImportResult> {
  const { session, error } = await authorise('createPartner')
  if (!session) return { ok: false, error, imported: 0, skipped: [] }
  const { supabase, ctx, userId } = session

  if (!(await ownsRecord(supabase, 'partnership_programmes', programmeId, ctx.workspaceId))) {
    return { ok: false, error: 'Programme not found in this workspace.', imported: 0, skipped: [] }
  }
  if (rows.length === 0) return { ok: false, error: 'No rows to import.', imported: 0, skipped: [] }
  if (rows.length > 500) return { ok: false, error: 'Import is limited to 500 rows at a time.', imported: 0, skipped: [] }

  const skipped: { row: number; reason: string }[] = []
  const valid: (ImportPartnerRow & { row: number })[] = []
  rows.forEach((row, index) => {
    const name = row.name?.trim()
    if (!name) { skipped.push({ row: index + 1, reason: 'Missing name' }); return }
    if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) { skipped.push({ row: index + 1, reason: 'Invalid email' }); return }
    valid.push({ ...row, name, row: index + 1 })
  })

  if (valid.length === 0) return { ok: false, error: 'No valid rows to import.', imported: 0, skipped }

  const now = new Date().toISOString()
  const { error: insertError, count } = await supabase.from('partnership_partners').insert(
    valid.map(row => ({
      workspace_id: ctx.workspaceId, programme_id: programmeId, partner_type: partnerType,
      name: row.name, email: row.email?.trim() || null, handle: row.handle?.trim() || null,
      region: row.region?.trim() || null, status: 'active', joined_at: now, approved_at: now,
      last_activity_at: now, created_by: userId,
    })),
    { count: 'exact' },
  )
  if (insertError) return { ok: false, error: insertError.message, imported: 0, skipped }

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'partner', action: 'imported',
    summary: `${count ?? valid.length} partners imported`, surface: 'partnerships',
  })

  revalidatePartnerships()
  return { ok: true, imported: count ?? valid.length, skipped }
}

// ============================================================================
// Assets (ambassador content submissions / co-marketing asset approvals)
// ============================================================================

export async function submitAsset(input: {
  programme_id: string; partner_id: string; asset_type: string; title: string; url?: string; platform?: string
}): Promise<ActionResult> {
  const { session, error } = await authorise('manageAmbassadorContent')
  if (!session) return fail(error)
  const { supabase, ctx, userId } = session

  const title = input.title?.trim()
  if (!title) return fail('A title is required.')
  if (!(await ownsRecord(supabase, 'partnership_partners', input.partner_id, ctx.workspaceId))) {
    return fail('Partner not found in this workspace.')
  }

  const { data, error: insertError } = await supabase.from('partnership_assets').insert({
    workspace_id: ctx.workspaceId, programme_id: input.programme_id, partner_id: input.partner_id,
    asset_type: input.asset_type || 'content', title, url: input.url?.trim() || null,
    platform: input.platform || null, status: 'submitted',
  }).select('id').single()
  if (insertError) return fail(insertError.message)

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'application', entityId: data.id, action: 'asset_submitted',
    summary: `${title} submitted for review`, surface: 'partnerships',
  })

  revalidatePartnerships()
  return { ok: true, id: data.id, message: 'Submitted for review.' }
}

export async function reviewAsset(
  assetId: string, decision: 'approved' | 'changes_requested' | 'rejected', notes?: string,
): Promise<ActionResult> {
  const { session, error } = await authorise('manageAmbassadorContent')
  if (!session) return fail(error)
  const { supabase, ctx, userId } = session

  const { data: asset } = await supabase.from('partnership_assets')
    .select('id, title').eq('id', assetId).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!asset) return fail('Asset not found in this workspace.')

  const { error: updateError } = await supabase.from('partnership_assets').update({
    status: decision, review_notes: notes ?? null, reviewed_by: userId, reviewed_at: new Date().toISOString(),
  }).eq('id', assetId).eq('workspace_id', ctx.workspaceId)
  if (updateError) return fail(updateError.message)

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'application', entityId: assetId, action: `asset_${decision}`,
    summary: `${asset.title} was ${decision.replace('_', ' ')}`, surface: 'partnerships',
  })

  revalidatePartnerships()
  return { ok: true, message: 'Asset updated.' }
}

// ============================================================================
// Rewards
// ============================================================================

export async function issueReward(input: {
  programme_id: string; partner_id: string; reward_type: string; value: string; trigger_source?: string
}): Promise<ActionResult> {
  const { session, error } = await authorise('manageRewards')
  if (!session) return fail(error)
  const { supabase, ctx, userId } = session

  const value = Number(input.value)
  if (!Number.isFinite(value) || value < 0) return fail('Enter a valid reward value.')
  if (!(await ownsRecord(supabase, 'partnership_partners', input.partner_id, ctx.workspaceId))) {
    return fail('Partner not found in this workspace.')
  }

  const { data, error: insertError } = await supabase.from('partnership_rewards').insert({
    workspace_id: ctx.workspaceId, programme_id: input.programme_id, partner_id: input.partner_id,
    reward_type: input.reward_type || 'cash', value, status: 'issued',
    trigger_source: input.trigger_source || 'manual', issued_at: new Date().toISOString(),
  }).select('id').single()
  if (insertError) return fail(insertError.message)

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'reward', entityId: data.id, action: 'issued',
    summary: 'Reward issued', surface: 'partnerships',
  })

  revalidatePartnerships()
  return { ok: true, id: data.id, message: 'Reward issued.' }
}

export async function redeemReward(rewardId: string): Promise<ActionResult> {
  const { session, error } = await authorise('manageRewards')
  if (!session) return fail(error)
  const { supabase, ctx, userId } = session

  if (!(await ownsRecord(supabase, 'partnership_rewards', rewardId, ctx.workspaceId))) {
    return fail('Reward not found in this workspace.')
  }

  const { error: updateError } = await supabase.from('partnership_rewards')
    .update({ status: 'redeemed', redeemed_at: new Date().toISOString() })
    .eq('id', rewardId).eq('workspace_id', ctx.workspaceId)
  if (updateError) return fail(updateError.message)

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'reward', entityId: rewardId, action: 'redeemed',
    summary: 'Reward redeemed', surface: 'partnerships',
  })

  revalidatePartnerships()
  return { ok: true, message: 'Reward marked redeemed.' }
}

// ============================================================================
// Territories
// ============================================================================

export async function assignTerritory(input: {
  programme_id: string; partner_id: string; region: string; exclusive?: boolean
}): Promise<ActionResult> {
  const { session, error } = await authorise('manageTerritories')
  if (!session) return fail(error)
  const { supabase, ctx, userId } = session

  const region = input.region?.trim()
  if (!region) return fail('A territory/region is required.')
  if (!(await ownsRecord(supabase, 'partnership_partners', input.partner_id, ctx.workspaceId))) {
    return fail('Partner not found in this workspace.')
  }

  const { data, error: insertError } = await supabase.from('partnership_territories').insert({
    workspace_id: ctx.workspaceId, programme_id: input.programme_id, partner_id: input.partner_id,
    region, exclusive: Boolean(input.exclusive),
  }).select('id').single()
  if (insertError) {
    if (insertError.message.includes('idx_partnership_territories_exclusive_region')) {
      return fail(`${region} is already assigned exclusively to another reseller.`)
    }
    return fail(insertError.message)
  }

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'territory', entityId: data.id, action: 'assigned',
    summary: `${region} assigned`, surface: 'partnerships',
  })

  revalidatePartnerships()
  return { ok: true, id: data.id, message: 'Territory assigned.' }
}

export async function unassignTerritory(territoryId: string): Promise<ActionResult> {
  const { session, error } = await authorise('manageTerritories')
  if (!session) return fail(error)
  const { supabase, ctx, userId } = session

  if (!(await ownsRecord(supabase, 'partnership_territories', territoryId, ctx.workspaceId))) {
    return fail('Territory not found in this workspace.')
  }

  const { error: deleteError } = await supabase.from('partnership_territories')
    .delete().eq('id', territoryId).eq('workspace_id', ctx.workspaceId)
  if (deleteError) return fail(deleteError.message)

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'territory', entityId: territoryId, action: 'unassigned',
    summary: 'Territory unassigned', surface: 'partnerships',
  })

  revalidatePartnerships()
  return { ok: true, message: 'Territory unassigned.' }
}

// ============================================================================
// Stripe Connect (partner payout accounts)
// ============================================================================

/**
 * Starts (or resumes) Stripe Connect onboarding for a partner and returns the
 * hosted onboarding URL to redirect to. Creates the Express connected account
 * on first call; re-uses it on subsequent calls (Stripe account links can be
 * regenerated freely — they expire after a few minutes).
 */
export async function startPartnerStripeOnboarding(partnerId: string): Promise<ActionResult & { url?: string }> {
  const { session, error } = await authorise('editPartner')
  if (!session) return fail(error)
  const { supabase, ctx, userId } = session

  const { data: partner } = await supabase.from('partnership_partners')
    .select('id, name, email, stripe_account_id')
    .eq('id', partnerId).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!partner) return fail('Partner not found in this workspace.')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '')
  if (!appUrl) return fail('NEXT_PUBLIC_APP_URL is not configured on this deployment.')

  const { partnershipsStripe } = await import('@/lib/partnerships/stripe')
  const stripe = partnershipsStripe()

  let accountId = partner.stripe_account_id as string | null
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: 'express',
      email: partner.email || undefined,
      business_type: 'individual',
      metadata: { caption_fox_partner_id: partner.id, caption_fox_workspace_id: ctx.workspaceId },
      capabilities: { transfers: { requested: true } },
    })
    accountId = account.id
    const { error: updateError } = await supabase.from('partnership_partners').update({
      stripe_account_id: accountId, stripe_account_status: 'pending',
    }).eq('id', partnerId).eq('workspace_id', ctx.workspaceId)
    if (updateError) return fail(updateError.message)
  }

  const link = await stripe.accountLinks.create({
    account: accountId,
    type: 'account_onboarding',
    return_url: `${appUrl}/app/partnerships/partners/${partnerId}?stripe=return`,
    refresh_url: `${appUrl}/app/partnerships/partners/${partnerId}?stripe=refresh`,
  })

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'partner', entityId: partnerId, action: 'stripe_onboarding_started',
    summary: `Stripe Connect onboarding started for ${partner.name}`, surface: 'partnerships',
  })

  return { ok: true, url: link.url }
}

/** Re-syncs a partner's Connect account status from Stripe (called on return from onboarding). */
export async function refreshPartnerStripeStatus(partnerId: string): Promise<ActionResult> {
  const { session, error } = await authorise('editPartner')
  if (!session) return fail(error)
  const { supabase, ctx, userId } = session

  const { data: partner } = await supabase.from('partnership_partners')
    .select('id, name, stripe_account_id').eq('id', partnerId).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!partner) return fail('Partner not found in this workspace.')
  if (!partner.stripe_account_id) return fail('This partner has not started Stripe onboarding yet.')

  const { partnershipsStripe } = await import('@/lib/partnerships/stripe')
  const stripe = partnershipsStripe()
  const account = await stripe.accounts.retrieve(partner.stripe_account_id)

  const status = account.requirements?.disabled_reason ? 'restricted'
    : account.payouts_enabled ? 'verified'
    : account.details_submitted ? 'pending' : 'pending'

  const { error: updateError } = await supabase.from('partnership_partners').update({
    stripe_account_status: status,
    stripe_details_submitted: Boolean(account.details_submitted),
    stripe_payouts_enabled: Boolean(account.payouts_enabled),
    stripe_connected_at: status === 'verified' ? new Date().toISOString() : null,
    stripe_last_synced_at: new Date().toISOString(),
  }).eq('id', partnerId).eq('workspace_id', ctx.workspaceId)
  if (updateError) return fail(updateError.message)

  if (status === 'verified') {
    await logActivity(supabase, ctx.workspaceId, userId, {
      entityType: 'partner', entityId: partnerId, action: 'stripe_connected',
      summary: `${partner.name} completed Stripe Connect verification`, surface: 'partnerships',
    })
  }

  revalidatePartnerships()
  return { ok: true, message: `Stripe status: ${status}.` }
}

// ============================================================================
// Tracking links
// ============================================================================

export async function createTrackingLink(
  programmeId: string, partnerId: string, destinationUrl: string,
): Promise<ActionResult> {
  const { session, error } = await authorise('manageTracking')
  if (!session) return fail(error)
  const { supabase, ctx, userId } = session

  if (!(await ownsRecord(supabase, 'partnership_partners', partnerId, ctx.workspaceId))) {
    return fail('Partner not found in this workspace.')
  }
  try {
    void new URL(destinationUrl)
  } catch {
    return fail('Enter a valid destination URL.')
  }

  const slug = randomBytes(5).toString('base64url')
  const { data, error: insertError } = await supabase.from('partnership_tracking_links').insert({
    workspace_id: ctx.workspaceId, programme_id: programmeId, partner_id: partnerId,
    slug, destination_url: destinationUrl, created_by: userId,
  }).select('id, slug').single()
  if (insertError) return fail(insertError.message)

  await logActivity(supabase, ctx.workspaceId, userId, {
    entityType: 'tracking_link', entityId: data.id, action: 'created',
    summary: 'Tracking link created', surface: 'partnerships',
  })

  revalidatePartnerships()
  return { ok: true, id: data.id, message: `Tracking link /p/${data.slug} created.` }
}
