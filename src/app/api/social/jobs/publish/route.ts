import { NextResponse, type NextRequest } from 'next/server'
import { runPublishingWorker } from '@/lib/social/publish-worker'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Drives the publishing queue. Intended for a scheduled invocation (Vercel Cron
 * or an external scheduler); protected by a shared secret so it cannot be
 * triggered by an anonymous request.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.SOCIAL_JOBS_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'SOCIAL_JOBS_SECRET is not configured on this deployment.' }, { status: 503 })
  }
  const header = request.headers.get('authorization') ?? ''
  if (header !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Not authorised.' }, { status: 401 })
  }

  try {
    const result = await runPublishingWorker({ limit: 25 })
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    // The worker never reports success it did not achieve; a crash is surfaced
    // as a 500 with a safe message so the scheduler retries.
    const message = error instanceof Error ? error.message : 'The publishing worker failed.'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

export const GET = POST
