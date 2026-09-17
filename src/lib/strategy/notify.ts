import 'server-only'
import type { StrategyActionSession } from './server'
import { strategyPath, type StrategyModule } from './constants'
import { approvalChannels, isDemoWorkspace } from './notify-rules'
import { workspaceRouteSegment } from '@/lib/workspace-shared'

export type StrategyNotificationType =
  | 'strategy_approval_request'
  | 'strategy_approval_reminder'
  | 'strategy_approval_decision'
  | 'strategy_research_review'


function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * One notification for a Strategy workflow event: an in-app row with a link back
 * to the record's page, plus an email when the workspace has its own Resend
 * sender configured, the recipient has not opted out and the workspace is not a
 * demo. Never throws — a failed email must not undo the approval it reports.
 */
export async function notifyStrategy(
  session: StrategyActionSession,
  input: {
    recipientId: string | null | undefined
    type: StrategyNotificationType
    title: string
    body?: string | null
    module: StrategyModule
    entityId?: string | null
  },
): Promise<{ inApp: boolean; email: 'sent' | 'skipped' | 'failed' }> {
  const { supabase, ctx, userId } = session
  if (!input.recipientId || input.recipientId === userId) return { inApp: false, email: 'skipped' }

  const [{ data: recipient }, { data: workspace }] = await Promise.all([
    supabase.from('profiles').select('email, full_name, notification_preferences').eq('id', input.recipientId).maybeSingle(),
    supabase.from('workspaces').select('name, slug, type, settings').eq('id', ctx.workspaceId).maybeSingle(),
  ])
  const channels = approvalChannels(recipient?.notification_preferences)
  const path = strategyPath(workspaceRouteSegment(ctx.workspaceType) ?? 'brand', input.module) + (input.entityId ? `?focus=${input.entityId}` : '')

  let inApp = false
  if (channels.inApp) {
    const { error } = await supabase.from('notifications').insert({
      workspace_id: ctx.workspaceId, user_id: input.recipientId, type: input.type,
      title: input.title.slice(0, 200), body: input.body?.slice(0, 500) ?? null, link: path,
    })
    if (error) console.error('[strategy] notification insert failed', { type: input.type, code: error.code })
    inApp = !error
  }

  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.MESSAGING_EMAIL_FROM
  if (!channels.email || !apiKey || !from || !recipient?.email || isDemoWorkspace(workspace?.slug, workspace?.settings)) {
    return { inApp, email: 'skipped' }
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '')
  const href = appUrl ? `${appUrl}${path}` : null
  const workspaceName = workspace?.name ?? 'your workspace'
  const text = [input.title, input.body ?? '', href ? `Open: ${href}` : '', '', `You receive this because approval emails are on for ${workspaceName}. Change it in Account Settings → Notifications.`].filter(Boolean).join('\n')
  const html = `<div style="font-family:Inter,Arial,sans-serif;color:#0f172a;font-size:14px;line-height:1.5">
<p style="margin:0 0 4px;color:#64748b;font-size:12px">${escapeHtml(workspaceName)} · Strategy</p>
<p style="margin:0 0 12px;font-size:16px;font-weight:600">${escapeHtml(input.title)}</p>
${input.body ? `<p style="margin:0 0 16px">${escapeHtml(input.body)}</p>` : ''}
${href ? `<p style="margin:0 0 20px"><a href="${escapeHtml(href)}" style="background:#2563eb;color:#fff;padding:8px 14px;border-radius:6px;text-decoration:none">Open in Caption Fox</a></p>` : ''}
<p style="margin:0;color:#94a3b8;font-size:12px">Change approval emails in Account Settings → Notifications.</p></div>`

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `${input.type}-${input.entityId ?? 'none'}-${input.recipientId}-${Math.floor(Date.now() / 60_000)}` },
      body: JSON.stringify({ from, to: recipient.email, subject: `${input.title} — ${workspaceName}`, html, text }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      console.error('[strategy] approval email rejected', { type: input.type, status: res.status })
      return { inApp, email: 'failed' }
    }
    return { inApp, email: 'sent' }
  } catch {
    console.error('[strategy] approval email failed', { type: input.type })
    return { inApp, email: 'failed' }
  }
}
