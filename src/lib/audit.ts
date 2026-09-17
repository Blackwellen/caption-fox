import type { SupabaseClient } from '@supabase/supabase-js'

// Shared audit-log helper. Call from server routes / actions after sensitive mutations
// (create/update/delete/approve/invite/billing/etc.). Non-throwing — auditing must never
// break the primary action.
//
// Writes to `audit_logs` (actor_id, workspace_id, action, resource_type,
// resource_id uuid, metadata jsonb, created_at). The public API keeps the
// entity* naming used by every caller; this function maps it onto the real
// columns. A non-uuid entity id is kept in metadata rather than failing the
// insert.

export interface AuditEntry {
  workspaceId?: string | null
  action: string                 // e.g. 'post.published', 'member.invited', 'plan.changed'
  entityType?: string | null     // e.g. 'content_post', 'workspace_member'
  entityId?: string | null
  metadata?: Record<string, unknown>
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function logAudit(
  supabase: SupabaseClient,
  userId: string,
  entry: AuditEntry,
): Promise<void> {
  const entityId = entry.entityId ?? null
  const isUuid = entityId != null && UUID.test(entityId)
  try {
    const { error } = await supabase.from('audit_logs').insert({
      actor_id: userId,
      workspace_id: entry.workspaceId ?? null,
      action: entry.action,
      resource_type: entry.entityType ?? null,
      resource_id: isUuid ? entityId : null,
      metadata: entityId != null && !isUuid ? { ...(entry.metadata ?? {}), entity_ref: entityId } : (entry.metadata ?? {}),
    })
    // Never throw from the audit path, but never fail silently either.
    if (error) console.error('[audit] insert failed', { action: entry.action, code: error.code, message: error.message })
  } catch (err) {
    console.error('[audit] insert threw', { action: entry.action, message: err instanceof Error ? err.message : String(err) })
  }
}
