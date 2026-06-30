import type { SupabaseClient } from '@supabase/supabase-js'

// Shared audit-log helper. Call from server routes / actions after sensitive mutations
// (create/update/delete/approve/invite/billing/etc.). Non-throwing — auditing must never
// break the primary action.
//
// Expects an `audit_logs` table with: user_id, workspace_id, action, entity_type,
// entity_id, metadata (jsonb), created_at.

export interface AuditEntry {
  workspaceId?: string | null
  action: string                 // e.g. 'post.published', 'member.invited', 'plan.changed'
  entityType?: string | null     // e.g. 'content_post', 'workspace_member'
  entityId?: string | null
  metadata?: Record<string, unknown>
}

export async function logAudit(
  supabase: SupabaseClient,
  userId: string,
  entry: AuditEntry,
): Promise<void> {
  try {
    await supabase.from('audit_logs').insert({
      user_id: userId,
      workspace_id: entry.workspaceId ?? null,
      action: entry.action,
      entity_type: entry.entityType ?? null,
      entity_id: entry.entityId ?? null,
      metadata: entry.metadata ?? {},
    })
  } catch {
    // never throw from the audit path
  }
}
