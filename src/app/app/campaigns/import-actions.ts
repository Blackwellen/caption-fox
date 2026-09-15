'use server'

import { revalidatePath } from 'next/cache'
import { getCampaignSession } from '@/lib/campaigns/server'
import { LIFECYCLE_STAGES, PRIORITIES } from '@/lib/campaigns/constants'
import { CAMPAIGN_TYPES } from '@/lib/constants'
import type { ImportResult } from './actions'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

const CAMPAIGN_PATHS = [
  '/app/campaigns', '/app/campaigns/all', '/app/campaigns/templates',
  '/app/campaigns/board', '/app/campaigns/timeline',
]

function revalidateCampaigns() {
  for (const path of CAMPAIGN_PATHS) revalidatePath(path)
}

export interface ImportedCampaign {
  name?: string
  type?: string
  owner?: string
  stage?: string
  priority?: string
  budget?: string
  start_date?: string
  end_date?: string
  channels?: string
}

/**
 * Imports campaign records from a mapped CSV.
 *
 * Unknown enum values fall back to safe defaults rather than failing the whole
 * file; unknown owners stay with the importer. Rows that cannot be made valid
 * are reported per line instead of being written half-formed.
 */
export async function importCampaigns(rows: ImportedCampaign[]): Promise<ImportResult> {
  const session = await getCampaignSession()
  if (!session.capabilities.import) {
    return { ok: false, error: 'Your role does not allow importing campaigns.' }
  }
  if (rows.length === 0) return { ok: false, error: 'The file contained no rows.' }
  if (rows.length > 2_000) return { ok: false, error: 'Campaign imports are limited to 2,000 rows per file.' }

  const { supabase, ctx, userId } = session

  const [{ data: existingRows }, { data: memberRows }] = await Promise.all([
    supabase.from('campaigns').select('name').eq('workspace_id', ctx.workspaceId).is('archived_at', null),
    supabase.from('workspace_members').select('user_id, profiles(id, email, full_name)').eq('workspace_id', ctx.workspaceId),
  ])

  const existing = new Set((existingRows ?? []).map(row => (row.name as string).toLowerCase()))
  const byPerson = new Map<string, string>()
  for (const row of memberRows ?? []) {
    type P = { id: string; email: string | null; full_name: string | null }
    const raw = (row as { profiles?: P | P[] }).profiles
    const person = Array.isArray(raw) ? raw[0] : raw
    if (person?.email) byPerson.set(person.email.toLowerCase(), person.id)
    if (person?.full_name) byPerson.set(person.full_name.toLowerCase(), person.id)
  }

  const errors: string[] = []
  const seen = new Set<string>()
  const payload: Record<string, unknown>[] = []
  let duplicates = 0
  let invalid = 0

  rows.forEach((row, index) => {
    const line = index + 2
    const name = row.name?.trim()
    if (!name) {
      invalid += 1
      if (errors.length < 20) errors.push(`Row ${line}: campaign name is required.`)
      return
    }
    if (name.length > 140) {
      invalid += 1
      if (errors.length < 20) errors.push(`Row ${line}: campaign name is longer than 140 characters.`)
      return
    }

    let dateProblem = false
    for (const [field, value] of [['start_date', row.start_date], ['end_date', row.end_date]] as const) {
      if (value?.trim() && !ISO_DATE.test(value.trim())) {
        invalid += 1
        if (errors.length < 20) errors.push(`Row ${line}: ${field} must be formatted as YYYY-MM-DD.`)
        dateProblem = true
        break
      }
    }
    if (dateProblem) return

    if (row.start_date?.trim() && row.end_date?.trim() && row.end_date.trim() < row.start_date.trim()) {
      invalid += 1
      if (errors.length < 20) errors.push(`Row ${line}: end date is before the start date.`)
      return
    }
    if (row.budget?.trim() && !Number.isFinite(Number(row.budget))) {
      invalid += 1
      if (errors.length < 20) errors.push(`Row ${line}: budget "${row.budget}" is not a number.`)
      return
    }

    const key = name.toLowerCase()
    if (existing.has(key) || seen.has(key)) { duplicates += 1; return }
    seen.add(key)

    const type = row.type?.trim().toLowerCase().replace(/\s+/g, '_') ?? ''
    const stage = row.stage?.trim().toLowerCase().replace(/\s+/g, '_') ?? ''
    const priority = row.priority?.trim().toLowerCase() ?? ''

    payload.push({
      workspace_id: ctx.workspaceId,
      name,
      campaign_type: (CAMPAIGN_TYPES as readonly string[]).includes(type) ? type : 'standard',
      lifecycle_stage: (LIFECYCLE_STAGES as readonly string[]).includes(stage) ? stage : 'planning',
      priority: (PRIORITIES as readonly string[]).includes(priority) ? priority : 'medium',
      owner_id: byPerson.get(row.owner?.trim().toLowerCase() ?? '') ?? userId,
      budget: row.budget?.trim() ? Number(row.budget) : null,
      start_date: row.start_date?.trim() || null,
      end_date: row.end_date?.trim() || null,
      channels: row.channels
        ? row.channels.split(/[|,;]/).map(c => c.trim().toLowerCase()).filter(Boolean)
        : [],
      created_by: userId,
      status: 'draft',
    })
  })

  if (payload.length > 0) {
    const { error } = await supabase.from('campaigns').insert(payload)
    if (error) return { ok: false, error: error.message }
  }

  await supabase.from('campaign_activity').insert({
    workspace_id: ctx.workspaceId, actor_id: userId, entity_type: 'campaign',
    action: 'campaigns_imported',
    summary: `imported ${payload.length} campaign${payload.length === 1 ? '' : 's'}`,
    link: '/app/campaigns/all', surface: 'campaigns',
    metadata: { imported: payload.length, duplicates, invalid },
  })

  revalidateCampaigns()
  return {
    ok: true, imported: payload.length, duplicates, invalid, errors,
    message: `${payload.length} imported, ${duplicates} duplicate${duplicates === 1 ? '' : 's'} skipped, ${invalid} invalid.`,
  }
}

export interface ImportedTemplate {
  name?: string
  description?: string
  category?: string
  channels?: string
  budget?: string
}

export async function importTemplates(rows: ImportedTemplate[]): Promise<ImportResult> {
  const session = await getCampaignSession()
  if (!session.capabilities.manageTemplates) {
    return { ok: false, error: 'Your role does not allow importing templates.' }
  }
  if (rows.length === 0) return { ok: false, error: 'The file contained no rows.' }
  if (rows.length > 1_000) return { ok: false, error: 'Template imports are limited to 1,000 rows per file.' }

  const { supabase, ctx, userId } = session
  const { data: existingRows } = await supabase
    .from('campaign_templates').select('name')
    .eq('workspace_id', ctx.workspaceId).is('archived_at', null)
  const existing = new Set((existingRows ?? []).map(row => (row.name as string).toLowerCase()))

  const errors: string[] = []
  const seen = new Set<string>()
  const payload: Record<string, unknown>[] = []
  let duplicates = 0
  let invalid = 0

  rows.forEach((row, index) => {
    const name = row.name?.trim()
    if (!name) {
      invalid += 1
      if (errors.length < 20) errors.push(`Row ${index + 2}: template name is required.`)
      return
    }
    const key = name.toLowerCase()
    if (existing.has(key) || seen.has(key)) { duplicates += 1; return }
    seen.add(key)
    payload.push({
      workspace_id: ctx.workspaceId,
      name,
      description: row.description?.trim()?.slice(0, 1000) || null,
      category: row.category?.trim().toLowerCase().replace(/\s+/g, '_') || 'standard',
      channels: row.channels
        ? row.channels.split(/[|,;]/).map(c => c.trim().toLowerCase()).filter(Boolean)
        : [],
      default_budget: row.budget?.trim() && Number.isFinite(Number(row.budget)) ? Number(row.budget) : null,
      owner_id: userId,
      created_by: userId,
      // Imported templates always land as drafts so nothing goes live unreviewed.
      status: 'draft',
    })
  })

  if (payload.length > 0) {
    const { error } = await supabase.from('campaign_templates').insert(payload)
    if (error) return { ok: false, error: error.message }
  }

  await supabase.from('campaign_activity').insert({
    workspace_id: ctx.workspaceId, actor_id: userId, entity_type: 'template',
    action: 'templates_imported',
    summary: `imported ${payload.length} template${payload.length === 1 ? '' : 's'} as drafts`,
    link: '/app/campaigns/templates', surface: 'templates',
    metadata: { imported: payload.length, duplicates, invalid },
  })

  revalidateCampaigns()
  return {
    ok: true, imported: payload.length, duplicates, invalid, errors,
    message: `${payload.length} imported as drafts, ${duplicates} duplicate${duplicates === 1 ? '' : 's'} skipped, ${invalid} invalid.`,
  }
}
