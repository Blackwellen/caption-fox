import { notFound } from 'next/navigation'
import { requireMessagingModule } from '@/lib/messaging/server'
import { getMessage, listAudiences } from '@/lib/messaging/data'
import { CHANNEL_LABELS, type MessagingChannel, type MessagingModule } from '@/lib/messaging/constants'
import MessagingHeader from './MessagingHeader'
import MessageComposer from './composer/MessageComposer'
import { AccessBlocked } from './states'
import { MESSAGING_PAGE } from './primitives'

const SENDER_PLACEHOLDER: Record<MessagingChannel, string> = {
  email: 'Acme Marketing <hello@acme.com>', sms: 'AcmeOffers', whatsapp: 'Acme Store',
  rcs: 'Acme Store', push: 'Acme App',
}

/**
 * Shared compose surface for the five channel routes — creates a new draft,
 * or (with `?id=`) loads and edits an existing one. Wires a real
 * draft-create/edit/test-send/schedule/send pipeline against the actual
 * database and provider adapters — this is the functional core the approved
 * designs' rich composer UI will be built on top of in a later visual pass.
 */
export default async function MessagingComposePage({
  module, searchParams,
}: { module: MessagingModule; searchParams?: Promise<{ id?: string }> }) {
  const channel = module as MessagingChannel
  const { supabase, ctx, capabilities, modules, channels, access } = await requireMessagingModule(module)

  if (!access.allowed || !channels.includes(channel)) {
    return (
      <div className={MESSAGING_PAGE}>
        <MessagingHeader module={module} modules={modules} />
        <AccessBlocked access={access.allowed ? { allowed: false, reason: 'workspace_type', upgrade: false, message: 'This channel is not part of the current workspace type.' } : access} />
      </div>
    )
  }

  const params = await searchParams
  const [audiences, existingMessage] = await Promise.all([
    listAudiences(supabase, ctx.workspaceId),
    params?.id ? getMessage(supabase, ctx.workspaceId, params.id) : Promise.resolve(null),
  ])
  if (params?.id && !existingMessage) notFound()
  if (existingMessage && existingMessage.channel !== channel) notFound()

  const content = (existingMessage?.content ?? {}) as Record<string, string>
  const existing = existingMessage ? {
    id: existingMessage.id, name: existingMessage.name, senderId: existingMessage.sender_id,
    audienceId: existingMessage.audience_id, subject: existingMessage.subject ?? content.subject ?? null,
    body: content.body ?? '', headline: content.headline ?? content.title,
  } : undefined

  return (
    <div className={MESSAGING_PAGE}>
      <MessagingHeader module={module} modules={modules} />
      <h2 className="mb-3 text-[15px] font-semibold text-slate-900">
        {existing ? `Edit ${CHANNEL_LABELS[channel]} message` : `New ${CHANNEL_LABELS[channel]} message`}
      </h2>
      <MessageComposer
        channel={channel}
        audiences={audiences}
        senderPlaceholder={SENDER_PLACEHOLDER[channel]}
        canSend={capabilities.send}
        canSchedule={capabilities.schedule}
        canTestSend={capabilities.testSend}
        canSubmitApproval={capabilities.edit}
        existing={existing}
      />
    </div>
  )
}
