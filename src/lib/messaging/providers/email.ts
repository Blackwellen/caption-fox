import 'server-only'
import type { ChannelProvider, SendInput, SendOutcome } from './types'

/**
 * Email provider adapter — calls the Resend REST API directly (no SDK
 * dependency needed for a single POST). Configured via the workspace's own
 * `RESEND_API_KEY` / `MESSAGING_EMAIL_FROM` environment variables; Caption Fox
 * never provisions or holds these credentials on the customer's behalf.
 */
export const emailProvider: ChannelProvider = {
  channel: 'email',

  isConfigured() {
    return Boolean(process.env.RESEND_API_KEY && process.env.MESSAGING_EMAIL_FROM)
  },

  async send(input: SendInput): Promise<SendOutcome> {
    const apiKey = process.env.RESEND_API_KEY
    const from = input.senderId || process.env.MESSAGING_EMAIL_FROM
    if (!apiKey || !from) {
      return { status: 'not_connected', reason: 'No email provider is connected for this workspace. Connect one in Messaging → Channels.' }
    }
    if (!input.recipient.email) {
      return { status: 'failed', reason: 'This contact has no email address on file.' }
    }

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from,
          to: input.recipient.email,
          subject: input.isTest ? `[Test] ${input.content.subject ?? 'Untitled message'}` : (input.content.subject ?? 'Untitled message'),
          html: input.content.html || `<p>${input.content.body}</p>`,
          text: input.content.body,
        }),
      })

      if (!res.ok) {
        const body = await res.text().catch(() => '')
        return { status: 'failed', reason: `Resend rejected the send (${res.status}): ${body.slice(0, 300)}` }
      }

      const data = (await res.json()) as { id?: string }
      return { status: 'sent', providerMessageId: data.id ?? crypto.randomUUID() }
    } catch (err) {
      return { status: 'failed', reason: err instanceof Error ? err.message : 'Unknown email delivery error.' }
    }
  },
}
