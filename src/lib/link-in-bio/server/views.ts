import 'server-only'
import type { SavedView } from '@/components/link-in-bio/controls'
import type { LinksSession } from './context'

/** Saved views the member may use: their own plus views shared to the workspace (RLS enforces both). */
export async function loadSavedViews(session: LinksSession, scope: 'library' | 'themes' | 'analytics'): Promise<SavedView[]> {
  const { data } = await session.supabase.from('link_saved_views')
    .select('id, name, params, user_id').eq('workspace_id', session.workspace.id).eq('scope', scope).order('name')
  return (data ?? []).map(row => ({
    id: String(row.id), name: String(row.name), mine: row.user_id === session.userId,
    params: Object.fromEntries(Object.entries((row.params ?? {}) as Record<string, unknown>).filter(([, v]) => typeof v === 'string')) as Record<string, string>,
  }))
}
