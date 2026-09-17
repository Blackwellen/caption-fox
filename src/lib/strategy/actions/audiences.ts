'use server'

import type { ActionResult } from '../action-types'
import { authorise, dbError, fail, invalid, rateLimited, record, revalidateStrategy } from '../server'
import { AUDIENCE_CHANNELS, AUDIENCE_STATUSES, LIFECYCLE_STAGES } from '../constants'
import { FieldErrors, integer, oneOf, parseCsv, tags as cleanTags, text, uuid } from '../validation'
import { growthRate, isPlausibleHubSpotToken } from '../crm-rules'
import { fetchHubSpotSegments, HubSpotError, testHubSpotToken } from '../hubspot'
import { createServiceClient } from '@/lib/supabase/service'
import { decryptSecret, encryptionAvailable, encryptSecret, maskTail } from '@/lib/advertising/crypto'

export interface AudienceInput {
  name?: string; description?: string; status?: string; lifecycle_stage?: string
  audience_size?: string | number; growth_rate?: string | number; fit_score?: string | number
  data_completeness?: string | number; channels?: string | string[]; tags?: string | string[]; owner_id?: string
}

function parse(input: AudienceInput, errors: FieldErrors) {
  const channels = (Array.isArray(input.channels) ? input.channels : String(input.channels ?? '').split(','))
    .map(value => value.trim().toLowerCase()).filter(Boolean)
  const badChannel = channels.find(value => !(AUDIENCE_CHANNELS as readonly string[]).includes(value))
  if (badChannel) errors.add('channels', `“${badChannel}” is not a supported channel.`)
  const growth = Number(input.growth_rate ?? 0)
  if (input.growth_rate !== undefined && input.growth_rate !== '' && (!Number.isFinite(growth) || growth < -100 || growth > 1000)) {
    errors.add('growth_rate', 'Growth must be between -100% and 1000%.')
  }
  return {
    name: text(errors, 'name', input.name, { label: 'Audience name', required: true, max: 120 }),
    description: text(errors, 'description', input.description, { label: 'Description', max: 500 }),
    status: oneOf(errors, 'status', input.status, AUDIENCE_STATUSES.filter(value => value !== 'archived'), { label: 'Status', fallback: 'draft' }),
    lifecycle_stage: oneOf(errors, 'lifecycle_stage', input.lifecycle_stage, LIFECYCLE_STAGES, { label: 'Lifecycle stage', fallback: 'awareness' }),
    audience_size: integer(errors, 'audience_size', input.audience_size, { label: 'Audience size', min: 0, max: 5_000_000_000, fallback: 0 }),
    growth_rate: Number.isFinite(growth) ? Math.round(growth * 100) / 100 : 0,
    fit_score: integer(errors, 'fit_score', input.fit_score, { label: 'Fit score', min: 0, max: 100, fallback: 50 }),
    data_completeness: integer(errors, 'data_completeness', input.data_completeness, { label: 'Data completeness', min: 0, max: 100, fallback: 50 }),
    channels: [...new Set(channels)].slice(0, 12),
    tags: cleanTags(input.tags),
    owner_id: uuid(errors, 'owner_id', input.owner_id, { label: 'Owner' }),
  }
}

async function isMember(session: NonNullable<Awaited<ReturnType<typeof authorise>>['session']>, userId: string | null) {
  if (!userId) return true
  const { data } = await session.supabase.from('workspace_members').select('user_id')
    .eq('workspace_id', session.ctx.workspaceId).eq('user_id', userId).maybeSingle()
  return Boolean(data)
}

export async function createAudience(input: AudienceInput): Promise<ActionResult> {
  const { session, error } = await authorise('audiences', 'createAudience')
  if (!session) return fail(error)
  const errors = new FieldErrors()
  const values = parse(input, errors)
  if (!errors.ok) return invalid(errors)
  if (!(await isMember(session, values.owner_id))) return fail('Owner must be a member of this workspace.', { owner_id: 'Choose a workspace member.' })
  const { supabase, ctx, userId } = session
  const { data, error: insertError } = await supabase.from('strategy_audiences').insert({
    ...values, owner_id: values.owner_id ?? userId, source: 'manual', workspace_id: ctx.workspaceId, created_by: userId,
  }).select('id').single()
  if (insertError || !data) return fail(dbError(insertError, 'Could not create the audience.'))
  await record(session, { entityType: 'audience', entityId: data.id, action: 'created segment', summary: `${values.name}`, surface: 'audiences' })
  revalidateStrategy()
  return { ok: true, id: data.id, message: 'Audience created.' }
}

export async function updateAudience(id: string, input: AudienceInput): Promise<ActionResult> {
  const { session, error } = await authorise('audiences', 'editAudience')
  if (!session) return fail(error)
  const errors = new FieldErrors()
  const values = parse(input, errors)
  if (!errors.ok) return invalid(errors)
  if (!(await isMember(session, values.owner_id))) return fail('Owner must be a member of this workspace.')
  const { supabase, ctx } = session
  const { data: current } = await supabase.from('strategy_audiences').select('name, archived_at').eq('id', id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!current) return fail('Audience not found.')
  if (current.archived_at) return fail('Restore this audience before editing it.')
  const { owner_id, ...rest } = values
  const { error: updateError } = await supabase.from('strategy_audiences').update(owner_id ? values : rest).eq('id', id).eq('workspace_id', ctx.workspaceId)
  if (updateError) return fail(dbError(updateError, 'Could not save the audience.'))
  await record(session, { entityType: 'audience', entityId: id, action: 'updated audience', summary: `${values.name}`, surface: 'audiences' })
  revalidateStrategy()
  return { ok: true, id, message: 'Audience saved.' }
}

export async function setAudienceArchived(id: string, archived: boolean): Promise<ActionResult> {
  const { session, error } = await authorise('audiences', 'editAudience')
  if (!session) return fail(error)
  const { supabase, ctx } = session
  const { data: current } = await supabase.from('strategy_audiences').select('name, archived_at').eq('id', id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!current) return fail('Audience not found.')
  if (archived === Boolean(current.archived_at)) return { ok: true, message: 'No change.' }
  const { error: updateError } = await supabase.from('strategy_audiences')
    .update(archived ? { status: 'archived', archived_at: new Date().toISOString() } : { status: 'draft', archived_at: null })
    .eq('id', id).eq('workspace_id', ctx.workspaceId)
  if (updateError) return fail(dbError(updateError, 'Could not update the audience.'))
  await record(session, { entityType: 'audience', entityId: id, action: archived ? 'archived segment' : 'restored segment', summary: current.name, surface: 'audiences' })
  revalidateStrategy()
  return { ok: true, message: archived ? 'Audience archived.' : 'Audience restored as a draft.' }
}

/**
 * CSV import. Header row required with `name`; optional: description, status,
 * lifecycle_stage, audience_size, growth_rate, fit_score, data_completeness,
 * channels (semicolon-separated), tags. All-or-nothing, duplicates rejected.
 */
export async function importAudiences(csv: string): Promise<ActionResult> {
  const { session, error } = await authorise('audiences', 'importAudiences')
  if (!session) return fail(error)
  if (typeof csv !== 'string' || !csv.trim()) return fail('The file is empty.')
  if (csv.length > 1_000_000) return fail('Import files must be under 1 MB.')
  const { supabase, ctx, userId } = session
  if (await rateLimited(supabase, ctx.workspaceId, userId, 'imported segments', 10, 60)) return fail('Import limit reached. Try again in an hour.')

  const rows = parseCsv(csv)
  if (rows.length < 2) return fail('Add a header row and at least one audience.')
  const header = rows[0].map(cell => cell.trim().toLowerCase().replace(/\s+/g, '_'))
  if (!header.includes('name')) return fail('The header row must include a "name" column.')
  if (rows.length - 1 > 1000) return fail('Import up to 1,000 audiences at a time.')

  const { data: existing } = await supabase.from('strategy_audiences').select('name').eq('workspace_id', ctx.workspaceId).is('archived_at', null)
  const taken = new Set(((existing ?? []) as { name: string }[]).map(row => row.name.toLowerCase()))
  const records: Record<string, unknown>[] = []
  const problems: string[] = []
  rows.slice(1).forEach((cells, index) => {
    const get = (key: string) => cells[header.indexOf(key)] ?? ''
    const errors = new FieldErrors()
    const values = parse({
      name: get('name'), description: get('description'), status: get('status').toLowerCase(), lifecycle_stage: get('lifecycle_stage').toLowerCase(),
      audience_size: get('audience_size').replace(/[,\s]/g, ''), growth_rate: get('growth_rate').replace('%', ''),
      fit_score: get('fit_score'), data_completeness: get('data_completeness'),
      channels: get('channels').split(/[;|]/), tags: get('tags').split(/[;|]/),
    }, errors)
    const key = (values.name ?? '').toLowerCase()
    if (key && taken.has(key)) errors.add('name', `"${values.name}" already exists`)
    taken.add(key)
    if (!errors.ok) problems.push(`Row ${index + 2}: ${errors.first}`)
    else records.push({ ...values, owner_id: userId, source: 'import', workspace_id: ctx.workspaceId, created_by: userId })
  })
  if (problems.length) return fail(`${problems.length} row${problems.length === 1 ? '' : 's'} could not be imported. ${problems.slice(0, 3).join(' · ')}`)
  const { error: insertError } = await supabase.from('strategy_audiences').insert(records)
  if (insertError) return fail(dbError(insertError, 'Import failed. No audiences were created.'))
  await record(session, { entityType: 'audience', action: 'imported segments', summary: `${records.length} audiences from CSV`, surface: 'audiences' })
  revalidateStrategy()
  return { ok: true, message: `Imported ${records.length} audience${records.length === 1 ? '' : 's'}.` }
}

/**
 * CRM sync. Only runs when the workspace has an active CRM integration that
 * the workspace connected with its own credentials; otherwise it explains how
 * to connect one instead of pretending a sync happened.
 */
/**
 * Connects HubSpot with the workspace's own private-app token. Owner/admin only.
 * The token is verified against HubSpot, encrypted, and written with the
 * service role (clients can never read that column back).
 */
export async function connectHubSpot(token: string): Promise<ActionResult> {
  const { session, error } = await authorise('audiences', 'syncCrm')
  if (!session) return fail(error)
  const { supabase, ctx, userId } = session
  if (!['owner', 'admin'].includes(ctx.role ?? '')) return fail('Only workspace owners and admins can connect a CRM.')
  const value = typeof token === 'string' ? token.trim() : ''
  if (!isPlausibleHubSpotToken(value)) return fail('That does not look like a HubSpot private-app token (it starts with "pat-").', { token: 'Paste the access token from your HubSpot private app.' })
  if (!encryptionAvailable()) return fail('Credential encryption is not configured on this deployment, so the token cannot be stored safely.')
  if (await rateLimited(supabase, ctx.workspaceId, userId, 'connected crm', 5, 60)) return fail('Too many connection attempts. Try again later.')
  const service = createServiceClient()
  if (!service) return fail('CRM connections are not available on this deployment.')

  let accountLabel: string
  try {
    ({ accountLabel } = await testHubSpotToken(value))
  } catch (err) {
    return fail(err instanceof HubSpotError ? err.message : 'HubSpot could not verify the token.', { token: 'Token was not accepted.' })
  }
  const now = new Date().toISOString()
  const { error: saveError } = await service.from('strategy_crm_connections').upsert({
    workspace_id: ctx.workspaceId, provider: 'hubspot', access_token_encrypted: encryptSecret(value), token_tail: maskTail(value),
    account_label: accountLabel, status: 'connected', connected_by: userId, connected_at: now, last_sync_error: null, updated_at: now,
  }, { onConflict: 'workspace_id,provider' })
  if (saveError) return fail(dbError(saveError, 'Could not save the connection.'))
  await record(session, { entityType: 'audience', action: 'connected crm', summary: `${accountLabel} connected`, surface: 'audiences', metadata: { provider: 'hubspot' } })
  revalidateStrategy()
  return { ok: true, message: `${accountLabel} connected. Run Sync CRM to pull your lists.` }
}

export async function disconnectCrm(): Promise<ActionResult> {
  const { session, error } = await authorise('audiences', 'syncCrm')
  if (!session) return fail(error)
  const { supabase, ctx } = session
  if (!['owner', 'admin'].includes(ctx.role ?? '')) return fail('Only workspace owners and admins can disconnect a CRM.')
  const { error: deleteError } = await supabase.from('strategy_crm_connections').delete().eq('workspace_id', ctx.workspaceId).eq('provider', 'hubspot')
  if (deleteError) return fail(dbError(deleteError, 'Could not disconnect.'))
  await record(session, { entityType: 'audience', action: 'disconnected crm', summary: 'HubSpot disconnected — synced audiences were kept', surface: 'audiences', metadata: { provider: 'hubspot' } })
  revalidateStrategy()
  return { ok: true, message: 'HubSpot disconnected. Audiences already synced were kept.' }
}

/**
 * Pulls HubSpot list names and sizes into audiences (source `crm`). Re-syncs
 * update the same rows by external id; nothing is deleted. Only aggregates are
 * stored. Failures are recorded on the connection and never touch audiences.
 */
export async function syncAudiencesFromCrm(): Promise<ActionResult> {
  const { session, error } = await authorise('audiences', 'syncCrm')
  if (!session) return fail(error)
  const { supabase, ctx, userId } = session
  const service = createServiceClient()
  const { data: connection } = service
    ? await service.from('strategy_crm_connections').select('id, access_token_encrypted, account_label')
      .eq('workspace_id', ctx.workspaceId).eq('provider', 'hubspot').maybeSingle()
    : { data: null }
  if (!connection) return fail('No CRM is connected. Choose "Connect HubSpot" from the ⋮ menu and paste your private-app token.')
  if (await rateLimited(supabase, ctx.workspaceId, userId, 'synced crm segments', 6, 60)) return fail('A sync ran recently. Try again later.')

  const markFailed = async (message: string) => {
    await service!.from('strategy_crm_connections').update({ status: 'error', last_sync_status: 'failed', last_sync_error: message.slice(0, 300), last_synced_at: new Date().toISOString() }).eq('id', connection.id)
    await record(session, { entityType: 'audience', action: 'crm sync failed', summary: message.slice(0, 120), surface: 'audiences', metadata: { provider: 'hubspot' } })
    revalidateStrategy()
    return fail(message)
  }

  let result: Awaited<ReturnType<typeof fetchHubSpotSegments>>
  try {
    result = await fetchHubSpotSegments(decryptSecret(connection.access_token_encrypted))
  } catch (err) {
    return markFailed(err instanceof HubSpotError ? err.message : 'The stored HubSpot token could not be used. Reconnect HubSpot.')
  }

  const { data: existing } = await supabase.from('strategy_audiences').select('id, external_id, audience_size')
    .eq('workspace_id', ctx.workspaceId).eq('external_provider', 'hubspot')
  const byExternal = new Map((existing ?? []).map(row => [row.external_id as string, row as { id: string; audience_size: number }]))
  const now = new Date().toISOString()
  const updates = [] as Record<string, unknown>[]
  const inserts = [] as Record<string, unknown>[]
  for (const segment of result.segments) {
    const prior = byExternal.get(segment.externalId)
    const base = { workspace_id: ctx.workspaceId, name: segment.name, audience_size: segment.size, source: 'crm', external_provider: 'hubspot', external_id: segment.externalId, last_synced_at: now }
    if (prior) updates.push({ ...base, id: prior.id, growth_rate: growthRate(prior.audience_size, segment.size) })
    else inserts.push({ ...base, description: segment.dynamic ? 'Active list synced from HubSpot' : 'Static list synced from HubSpot', status: 'active', created_by: userId, owner_id: userId })
  }
  if (updates.length) {
    const { error: updateError } = await supabase.from('strategy_audiences').upsert(updates, { onConflict: 'id' })
    if (updateError) return markFailed(dbError(updateError, 'Synced lists could not be saved.'))
  }
  if (inserts.length) {
    const { error: insertError } = await supabase.from('strategy_audiences').insert(inserts)
    if (insertError) return markFailed(dbError(insertError, 'New lists could not be saved.'))
  }
  await service!.from('strategy_crm_connections').update({
    status: 'connected', last_synced_at: now, last_sync_status: result.truncated ? 'partial' : 'success', last_sync_error: null, last_sync_count: result.segments.length, updated_at: now,
  }).eq('id', connection.id)
  await record(session, {
    entityType: 'audience', action: 'synced crm segments',
    summary: `${inserts.length} new, ${updates.length} updated from ${connection.account_label ?? 'HubSpot'}`, surface: 'audiences',
    metadata: { provider: 'hubspot', created: inserts.length, updated: updates.length, truncated: result.truncated },
  })
  revalidateStrategy()
  if (!result.segments.length) return { ok: true, message: 'HubSpot is connected but has no contact lists yet.' }
  return { ok: true, message: `Synced ${result.segments.length} HubSpot list${result.segments.length === 1 ? '' : 's'}: ${inserts.length} new, ${updates.length} updated${result.truncated ? ' (first 500 only)' : ''}.` }
}
