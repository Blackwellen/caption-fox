import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'

// Resend signs webhook deliveries using Svix. Verification per the Svix spec:
// https://docs.svix.com/receiving/verifying-payloads/how-manual
//
// Signed content is `${svix-id}.${svix-timestamp}.${rawBody}`, HMAC-SHA256'd
// with the base64 portion of the `whsec_...` secret, and compared against
// each `v1,<base64>` entry in the `svix-signature` header.

const MAX_AGE_SECONDS = 5 * 60

export interface WebhookVerifyResult {
  valid: boolean
  reason?: string
}

export function verifyResendWebhook(
  rawBody: string,
  headers: { svixId: string | null; svixTimestamp: string | null; svixSignature: string | null },
  secret: string,
): WebhookVerifyResult {
  const { svixId, svixTimestamp, svixSignature } = headers
  if (!svixId || !svixTimestamp || !svixSignature) {
    return { valid: false, reason: 'Missing svix-id / svix-timestamp / svix-signature headers.' }
  }

  const timestamp = Number(svixTimestamp)
  if (!Number.isFinite(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > MAX_AGE_SECONDS) {
    return { valid: false, reason: 'Webhook timestamp is missing or too old — possible replay.' }
  }

  const secretKey = secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret
  const key = Buffer.from(secretKey, 'base64')
  const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`
  const expected = createHmac('sha256', key).update(signedContent).digest('base64')

  const candidates = svixSignature.split(' ').map(part => part.split(',')[1]).filter(Boolean)
  const match = candidates.some(candidate => {
    try {
      const a = Buffer.from(candidate)
      const b = Buffer.from(expected)
      return a.length === b.length && timingSafeEqual(a, b)
    } catch {
      return false
    }
  })

  return match ? { valid: true } : { valid: false, reason: 'Signature did not match any provided value.' }
}

export interface ResendWebhookPayload {
  type: string
  data: { email_id?: string; to?: string[]; click?: { link?: string } }
}

const EVENT_MAP: Record<string, string> = {
  'email.sent': 'sent',
  'email.delivered': 'delivered',
  'email.opened': 'opened',
  'email.clicked': 'clicked',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
  'email.failed': 'failed',
  'email.delivery_delayed': 'deferred',
}

export function mapResendEventType(resendType: string): string | null {
  return EVENT_MAP[resendType] ?? null
}
