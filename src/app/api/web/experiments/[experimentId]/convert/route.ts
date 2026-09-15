import { NextResponse, type NextRequest } from 'next/server'
import { webServiceClient } from '@/lib/web/service-client'
import { checkRateLimit, clientKey } from '@/lib/web/rate-limit'

/**
 * Records a conversion for a visitor already assigned to this experiment.
 * Idempotent per visitor: `web_experiment_assignments.converted` is only
 * flipped once, so a retried or duplicate conversion beacon never
 * double-counts.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ experimentId: string }> }) {
  const { experimentId } = await params

  if (!checkRateLimit(clientKey(request, 'experiment-convert'), { limit: 60, windowMs: 60_000 })) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })
  }

  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 }) }
  const visitorId = (body && typeof body === 'object' ? (body as Record<string, unknown>).visitorId : undefined)
  if (typeof visitorId !== 'string') return NextResponse.json({ error: 'A visitorId is required.' }, { status: 400 })

  const supabase = webServiceClient()
  const { data: assignment } = await supabase.from('web_experiment_assignments')
    .select('id, variant, converted').eq('experiment_id', experimentId).eq('visitor_id', visitorId).maybeSingle()
  if (!assignment) return NextResponse.json({ error: 'This visitor has not been assigned to the experiment yet.' }, { status: 404 })
  if (assignment.converted) return NextResponse.json({ ok: true, alreadyRecorded: true })

  const { error: updateError } = await supabase.from('web_experiment_assignments').update({ converted: true }).eq('id', assignment.id)
  if (updateError) return NextResponse.json({ error: 'Could not record the conversion.' }, { status: 500 })

  const column = assignment.variant === 'variant' ? 'variant_conversions' : 'control_conversions'
  const res = await supabase.rpc('increment_web_experiment_counter', { p_experiment_id: experimentId, p_column: column })
  if (res.error) {
    const { data: current } = await supabase.from('web_experiments').select(column).eq('id', experimentId).maybeSingle()
    const currentValue = current ? Number((current as Record<string, unknown>)[column] ?? 0) : 0
    await supabase.from('web_experiments').update({ [column]: currentValue + 1 }).eq('id', experimentId)
  }

  return NextResponse.json({ ok: true })
}
