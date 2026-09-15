import { NextResponse, type NextRequest } from 'next/server'
import { runJourneyEngineTick } from '@/lib/messaging/journey-engine'
import { messagingServiceClient } from '@/lib/messaging/service-client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Drives the Messaging journey engine: enrols new participants, advances
 * waits, and sends due message steps across every active journey in every
 * workspace. Intended for a scheduled invocation (Vercel Cron or an external
 * scheduler) — protected by a shared secret so it cannot be triggered
 * anonymously. See /release-gated/user-fixes/messaging/journeys.md for the
 * exact cron setup this deployment needs.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.MESSAGING_JOBS_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'MESSAGING_JOBS_SECRET is not configured on this deployment.' }, { status: 503 })
  }
  const header = request.headers.get('authorization') ?? ''
  if (header !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Not authorised.' }, { status: 401 })
  }

  try {
    const supabase = messagingServiceClient()
    const result = await runJourneyEngineTick(supabase)
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The journey engine failed.'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

export const GET = POST
