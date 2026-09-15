import 'server-only'
import type { ChannelProvider } from './types'
import type { MessagingChannel } from '../constants'
import { emailProvider } from './email'
import { smsProvider } from './sms'
import { unconnectedProvider } from './unconnected'

const REGISTRY: Record<MessagingChannel, ChannelProvider> = {
  email: emailProvider,
  sms: smsProvider,
  whatsapp: unconnectedProvider('whatsapp'),
  rcs: unconnectedProvider('rcs'),
  push: unconnectedProvider('push'),
}

export function getChannelProvider(channel: MessagingChannel): ChannelProvider {
  return REGISTRY[channel]
}

export type { SendInput, SendOutcome, SendRecipient, RenderedContent, ChannelProvider } from './types'
