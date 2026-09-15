import { NextResponse, type NextRequest } from 'next/server'
import { webServiceClient } from '@/lib/web/service-client'
import { checkRateLimit, clientKey } from '@/lib/web/rate-limit'
import { assignVariant } from '@/lib/web/assignment'

/**
 * Public, unauthenticated experiment assignment endpoint. A visitor is
 * assigned once and reuses the same assignment on every future call —
 * `web_experiment_assignments` has a unique (experiment_id, visitor_id)
 * constraint, so a concurrent double-call cannot create two conflicting
 * assignments or double-count a visitor.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ experimentId: string }> }) {
  const { experimentId } = await params

  if (!checkRateLimit(clientKey(request, 'experiment-assign'), { limit: 60, windowMs: 60_000 })) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })
  }

  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 }) }
  const visitorId = (body && typeof body === 'object' ? (body as Record<string, unknown>).visitorId : undefined)
  if (typeof visitorId !== 'string' || visitorId.length < 8 || visitorId.length > 128) {
    return NextResponse.json({ error: 'A valid visitorId is required.' }, { status: 400 })
  }

  const supabase = webServiceClient()
  const { data: experiment } = await supabase.from('web_experiments')
    .select('id, workspace_id, status, traffic_allocation_percent').eq('id', experimentId).maybeSingle()
  if (!experiment) return NextResponse.json({ error: 'Experiment not found.' }, { status: 404 })
  if (experiment.status !== 'running') return NextResponse.json({ error: 'This experiment is not currently running.' }, { status: 403 })

  const { data: existing } = await supabase.from('web_experiment_assignments')
    .select('variant').eq('experiment_id', experimentId).eq('visitor_id', visitorId).maybeSingle()
  if (existing) return NextResponse.json({ variant: existing.variant })

  const variant = assignVariant(experimentId, visitorId, experiment.traffic_allocation_percent)

  const { error: insertError } = await supabase.from('web_experiment_assignments').insert({
    workspace_id: experiment.workspace_id, experiment_id: experimentId, visitor_id: visitorId, variant,
  })
  // A unique-constraint conflict here means a concurrent request already
  // assigned this visitor — re-read rather than treat it as a failure.
  if (insertError) {
    const { data: raceWinner } = await supabase.from('web_experiment_assignments')
      .select('variant').eq('experiment_id', experimentId).eq('visitor_id', visitorId).maybeSingle()
    if (raceWinner) return NextResponse.json({ variant: raceWinner.variant })
    return NextResponse.json({ error: 'Could not assign a variant.' }, { status: 500 })
  }

  const column = variant === 'variant' ? 'variant_visitors' : 'control_visitors'
  const res = await supabase.rpc('increment_web_experiment_counter', { p_experiment_id: experimentId, p_column: column })
  if (res.error) {
    // Fallback if the RPC has not been provisioned: read-modify-write. Safe
    // enough for the low write frequency here (one increment per new visitor).
    const { data: current } = await supabase.from('web_experiments').select(column).eq('id', experimentId).maybeSingle()
    const currentValue = current ? Number((current as Record<string, unknown>)[column] ?? 0) : 0
    await supabase.from('web_experiments').update({ [column]: currentValue + 1 }).eq('id', experimentId)
  }

  return NextResponse.json({ variant })
}
