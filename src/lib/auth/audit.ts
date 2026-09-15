import 'server-only'
import { headers } from 'next/headers'
import { createServiceClient } from '@/lib/supabase/service'

// Platform-level security events (no workspace). Never include passwords,
// OTP codes, tokens or form contents in metadata.
export async function recordSecurityEvent(action: string, actorId: string | null, metadata: Record<string, unknown> = {}) {
  const svc = createServiceClient()
  if (!svc) return
  const h = await headers()
  const forwarded = (h.get('x-forwarded-for') ?? '').split(',')[0].trim()
  const ip = /^[0-9a-f.:]{3,45}$/i.test(forwarded) ? forwarded : null
  await svc.from('audit_logs').insert({
    workspace_id: null,
    actor_id: actorId,
    action,
    resource_type: 'auth',
    metadata,
    ip_address: ip,
    user_agent: h.get('user-agent')?.slice(0, 300) ?? null,
  })
}
