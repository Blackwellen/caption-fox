'use server'

// Compose-local read helper. Kept separate from the shared `lib/studio/data.ts`
// query functions because it is invoked from a client component (the asset
// picker) rather than a server page render.

import { authorise } from '@/lib/studio/action-helpers'
import { listMedia } from '@/lib/studio/data'
import { parseStudioQuery } from '@/lib/studio/query'
import type { MediaRow } from '@/lib/studio/types'

export async function searchPickerAssets(
  term: string,
): Promise<{ ok: boolean; rows: MediaRow[]; error?: string }> {
  const { session, error } = await authorise('view')
  if (!session) return { ok: false, rows: [], error }

  const q = parseStudioQuery({ q: term, size: '24' })
  const page = await listMedia(session.supabase, session.ctx.workspaceId, q, { paginate: true })
  if (page.error) return { ok: false, rows: [], error: page.error }
  return { ok: true, rows: page.rows.filter(r => r.status !== 'archived') }
}
