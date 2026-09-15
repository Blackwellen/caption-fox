import 'server-only'
import type { ChannelProvider } from './types'
import type { MessagingChannel } from '../constants'

/**
 * SMS, WhatsApp, RCS and Push all require a provider account the workspace
 * connects itself (Twilio, Meta WhatsApp Business, an RCS agent, an FCM/APNs
 * project) — Caption Fox never holds or provisions those credentials. Until a
 * workspace wires its own channel config with real provider credentials,
 * these adapters truthfully report "not connected" rather than faking a send.
 */
export function unconnectedProvider(channel: MessagingChannel): ChannelProvider {
  return {
    channel,
    isConfigured: () => false,
    async send() {
      return {
        status: 'not_connected',
        reason: `No ${channel.toUpperCase()} provider is connected for this workspace. Connect one with your own account credentials in Messaging → Channels.`,
      }
    },
  }
}
