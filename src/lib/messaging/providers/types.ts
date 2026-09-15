// Provider adapter contract shared by every Messaging channel.
//
// A provider adapter's only job is: given a resolved recipient + rendered
// content, either hand the send to a real external API and report what
// happened, or fail with a clear, structured reason. Nothing here is ever
// allowed to report success without a real API call actually happening.

import type { MessagingChannel } from '../constants'

export interface SendRecipient {
  contactId: string
  email?: string | null
  phone?: string | null
  whatsappId?: string | null
  pushToken?: string | null
  rcsId?: string | null
}

export interface RenderedContent {
  subject?: string
  body: string
  html?: string
  mediaUrl?: string
  deepLink?: string
  templateId?: string
}

export interface SendInput {
  workspaceId: string
  messageId: string
  channel: MessagingChannel
  senderId: string | null
  recipient: SendRecipient
  content: RenderedContent
  isTest: boolean
}

export type SendOutcome =
  | { status: 'sent'; providerMessageId: string }
  | { status: 'not_connected'; reason: string }
  | { status: 'failed'; reason: string }

export interface ChannelProvider {
  channel: MessagingChannel
  /** Whether this environment has the credentials needed to actually send. */
  isConfigured(): boolean
  send(input: SendInput): Promise<SendOutcome>
}
