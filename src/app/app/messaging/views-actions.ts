'use server'

import { revalidatePath } from 'next/cache'
import { getMessagingSession } from '@/lib/messaging/server'

const SURFACES = ['overview', 'email', 'sms', 'whatsapp', 'rcs', 'push', 'journeys', 'templates'] as const
type Surface = typeof SURFACES[number]
const ALLOWED_PARAMS = new Set(['q', 'channel', 'status', 'owner', 'campaign', 'category', 'audience', 'tag', 'journeyStatus', 'type', 'health', 'from', 'to', 'view', 'size', 'updated', 'segment'])

export interface SavedViewResult { ok: boolean; error?: string; id?: string }

/** Saves the current filter state for this surface. Only known query keys are stored. */
export async function saveMessagingView(surface: string, name: string, params: Record<string, string>, shared: boolean): Promise<SavedViewResult> {
  if (!(SURFACES as readonly string[]).includes(surface)) return { ok: false, error: 'Unknown view surface.' }
  const trimmed = name.trim()
  if (!trimmed || trimmed.length > 60) return { ok: false, error: 'Give the view a name of up to 60 characters.' }
  const { supabase, ctx, userId, capabilities } = await getMessagingSession()
  if (!capabilities.view) return { ok: false, error: 'Your role does not include Messaging.' }

  const clean = Object.fromEntries(Object.entries(params).filter(([k, v]) => ALLOWED_PARAMS.has(k) && typeof v === 'string' && v.length <= 120))
  const { data, error } = await supabase.from('messaging_saved_views').insert({
    workspace_id: ctx.workspaceId, user_id: userId, surface: surface as Surface, name: trimmed, params: clean,
    shared: shared && capabilities.edit,
  }).select('id').single()
  if (error) return { ok: false, error: 'The view could not be saved. Try again.' }
  revalidatePath('/app/messaging', 'layout')
  return { ok: true, id: data.id }
}

export async function deleteMessagingView(id: string): Promise<SavedViewResult> {
  const { supabase, ctx, userId } = await getMessagingSession()
  const { error } = await supabase.from('messaging_saved_views').delete().eq('id', id).eq('workspace_id', ctx.workspaceId).eq('user_id', userId)
  if (error) return { ok: false, error: 'The view could not be deleted.' }
  revalidatePath('/app/messaging', 'layout')
  return { ok: true }
}
