import { NextResponse, type NextRequest } from 'next/server'
import { webServiceClient } from '@/lib/web/service-client'
import { checkRateLimit, clientKey } from '@/lib/web/rate-limit'

/**
 * Public, unauthenticated tracking-event ingestion endpoint — the collection
 * side of `web_tracking_events`. A workspace's public tracking key scopes
 * every write; there is no way to write into another workspace's events
 * without knowing its key. Coverage/health are recomputed live on Overview
 * and Tracking from these real received-event counts, never fabricated.
 */
export async function POST(request: NextRequest) {
  if (!checkRateLimit(clientKey(request, 'tracking-collect'), { limit: 300, windowMs: 60_000 })) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })
  }

  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 }) }
  const payload = (body && typeof body === 'object' ? body as Record<string, unknown> : {})
  const workspaceId = typeof payload.workspaceId === 'string' ? payload.workspaceId : undefined
  const eventName = typeof payload.event === 'string' ? payload.event.trim().slice(0, 120) : undefined
  if (!workspaceId || !eventName) return NextResponse.json({ error: 'workspaceId and event are required.' }, { status: 400 })

  const supabase = webServiceClient()
  const { data: workspace } = await supabase.from('workspaces').select('id').eq('id', workspaceId).maybeSingle()
  if (!workspace) return NextResponse.json({ error: 'Unknown workspace.' }, { status: 404 })

  const { data: existing } = await supabase.from('web_tracking_events')
    .select('id, volume').eq('workspace_id', workspaceId).eq('event_name', eventName).maybeSingle()

  const sanitizedPayload = payload.properties && typeof payload.properties === 'object'
    ? JSON.parse(JSON.stringify(payload.properties).slice(0, 4000))
    : null

  if (existing) {
    await supabase.from('web_tracking_events').update({
      volume: (existing.volume ?? 0) + 1, last_received_at: new Date().toISOString(),
      status: 'healthy', last_payload: sanitizedPayload,
    }).eq('id', existing.id)
  } else {
    await supabase.from('web_tracking_events').insert({
      workspace_id: workspaceId, event_name: eventName,
      event_category: payload.category === 'conversion' ? 'conversion' : 'engagement',
      source: typeof payload.source === 'string' ? payload.source.slice(0, 60) : 'website',
      volume: 1, coverage_percent: 100, status: 'healthy', last_received_at: new Date().toISOString(), last_payload: sanitizedPayload,
    })
  }

  return NextResponse.json({ ok: true })
}
