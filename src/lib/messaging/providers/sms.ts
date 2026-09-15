import 'server-only'
import type { ChannelProvider, SendInput, SendOutcome } from './types'

/**
 * SMS provider adapter — calls the Twilio REST API directly (Basic Auth +
 * form-encoded POST, no SDK needed). Configured via the workspace's own
 * `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_MESSAGING_SERVICE_SID`
 * (or `TWILIO_FROM_NUMBER`) environment variables; Caption Fox never
 * provisions or holds these credentials on the customer's behalf. Mirrors
 * `email.ts` exactly: an actual send once configured, a truthful
 * "not_connected" refusal otherwise — never a simulated success.
 */
export const smsProvider: ChannelProvider = {
  channel: 'sms',

  isConfigured() {
    const hasCore = Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN)
    const hasSender = Boolean(process.env.TWILIO_MESSAGING_SERVICE_SID || process.env.TWILIO_FROM_NUMBER)
    return hasCore && hasSender
  },

  async send(input: SendInput): Promise<SendOutcome> {
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID
    const fromNumber = input.senderId || process.env.TWILIO_FROM_NUMBER

    if (!accountSid || !authToken || (!messagingServiceSid && !fromNumber)) {
      return { status: 'not_connected', reason: 'No SMS provider is connected for this workspace. Connect one in Messaging → Channels.' }
    }
    if (!input.recipient.phone) {
      return { status: 'failed', reason: 'This contact has no phone number on file.' }
    }

    const body = new URLSearchParams({
      To: input.recipient.phone,
      Body: input.isTest ? `[Test] ${input.content.body}` : input.content.body,
    })
    if (messagingServiceSid) body.set('MessagingServiceSid', messagingServiceSid)
    else body.set('From', fromNumber as string)

    try {
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      })

      if (!res.ok) {
        const errBody = await res.text().catch(() => '')
        return { status: 'failed', reason: `Twilio rejected the send (${res.status}): ${errBody.slice(0, 300)}` }
      }

      const data = (await res.json()) as { sid?: string }
      return { status: 'sent', providerMessageId: data.sid ?? crypto.randomUUID() }
    } catch (err) {
      return { status: 'failed', reason: err instanceof Error ? err.message : 'Unknown SMS delivery error.' }
    }
  },
}
