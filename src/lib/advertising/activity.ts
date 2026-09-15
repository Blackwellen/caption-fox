import 'server-only'
import { serviceClient } from './service-client'

// Advertising activity feed and audit trail.
//
// Two audiences, one table: ad_activity rows are shown verbatim in the
// "Recent Activity" panels, so `summary` is written for a human. The
// before/after payloads exist for support and are never rendered.
//
// Writes never throw: losing an activity row must not fail the action it
// describes.

export type ActivityEvent =
  | 'connection.created' | 'connection.reauthorised' | 'connection.disconnected'
  | 'connection.scopes_changed' | 'provider_app.configured' | 'provider_app.removed'
  | 'account.mapped' | 'account.owner_changed'
  | 'sync.started' | 'sync.completed' | 'sync.failed'
  | 'campaign.created' | 'campaign.updated' | 'campaign.paused' | 'campaign.resumed'
  | 'campaign.budget_changed' | 'campaign.bulk_updated'
  | 'creative.uploaded' | 'creative.submitted' | 'creative.approved'
  | 'creative.changes_requested' | 'creative.disapproved' | 'creative.archived'
  | 'audience.created' | 'audience.synced' | 'audience.refresh_failed' | 'audience.archived'
  | 'report.created' | 'report.exported' | 'report.scheduled' | 'report.schedule_failed'
  | 'preset.saved' | 'preset.deleted' | 'issue.resolved'

export type ActivityInput = {
  workspaceId: string
  actorId?: string | null
  actorLabel?: string | null
  eventType: ActivityEvent
  entityType?: string | null
  entityId?: string | null
  entityLabel?: string | null
  provider?: string | null
  summary: string
  before?: Record<string, unknown> | null
  after?: Record<string, unknown> | null
  sourceRoute?: string | null
}

/** Keys whose values are redacted before an audit payload is stored. */
const SENSITIVE = /token|secret|password|credential|authorization|cookie|key$/i

function redactPayload(value: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!value) return null
  const out: Record<string, unknown> = {}
  for (const [key, entry] of Object.entries(value)) {
    out[key] = SENSITIVE.test(key) ? '[redacted]' : entry
  }
  return out
}

export async function recordActivity(input: ActivityInput): Promise<void> {
  try {
    await serviceClient().from('ad_activity').insert({
      workspace_id: input.workspaceId,
      actor_id: input.actorId ?? null,
      actor_label: input.actorLabel ?? null,
      event_type: input.eventType,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      entity_label: input.entityLabel ?? null,
      provider: input.provider ?? null,
      summary: input.summary.slice(0, 300),
      before_value: redactPayload(input.before),
      after_value: redactPayload(input.after),
      source_route: input.sourceRoute ?? null,
    })
  } catch {
    // Activity logging must never break the action it records.
  }
}

/** Opens an issue on the workspace, used by alerts and the issues panel. */
export async function raiseIssue(input: {
  workspaceId: string
  provider?: string | null
  connectionId?: string | null
  accountId?: string | null
  campaignId?: string | null
  creativeId?: string | null
  severity: 'critical' | 'warning' | 'info'
  issueType: string
  title: string
  detail?: string | null
  requiredAction?: string | null
}): Promise<void> {
  try {
    await serviceClient().from('ad_issues').insert({
      workspace_id: input.workspaceId,
      connection_id: input.connectionId ?? null,
      account_id: input.accountId ?? null,
      campaign_id: input.campaignId ?? null,
      creative_id: input.creativeId ?? null,
      provider: input.provider ?? null,
      severity: input.severity,
      issue_type: input.issueType,
      title: input.title.slice(0, 200),
      detail: input.detail?.slice(0, 400) ?? null,
      required_action: input.requiredAction?.slice(0, 300) ?? null,
    })
  } catch {
    // Non-fatal.
  }
}
