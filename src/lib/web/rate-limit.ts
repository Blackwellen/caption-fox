import 'server-only'

// In-memory sliding-window rate limiter for the public, unauthenticated Web &
// Conversion endpoints (form submission, experiment assignment/conversion,
// tracking ingestion). This is a real, functioning safeguard against a single
// runaway client — it is NOT a substitute for distributed rate limiting
// across multiple server instances, since state lives in process memory. If
// this app is deployed with more than one Next.js instance behind a load
// balancer, replace this with a shared store (Upstash/Redis) before relying
// on it for abuse protection at scale.

const buckets = new Map<string, number[]>()
const MAX_BUCKETS = 20_000

function prune(now: number) {
  if (buckets.size < MAX_BUCKETS) return
  for (const [key, hits] of buckets) {
    const fresh = hits.filter(t => now - t < 60_000)
    if (fresh.length === 0) buckets.delete(key)
    else buckets.set(key, fresh)
  }
}

/** Returns true if the request is allowed, false if the caller is over the limit. */
export function checkRateLimit(key: string, opts: { limit: number; windowMs: number }): boolean {
  const now = Date.now()
  prune(now)
  const hits = (buckets.get(key) ?? []).filter(t => now - t < opts.windowMs)
  if (hits.length >= opts.limit) {
    buckets.set(key, hits)
    return false
  }
  hits.push(now)
  buckets.set(key, hits)
  return true
}

export function clientKey(request: Request, scope: string): string {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'
  return `${scope}:${ip}`
}
