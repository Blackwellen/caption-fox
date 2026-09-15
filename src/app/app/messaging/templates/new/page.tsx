import { requireMessagingModule } from '@/lib/messaging/server'
import MessagingHeader from '@/components/messaging/MessagingHeader'
import TemplateComposer from '@/components/messaging/templates/TemplateComposer'
import { AccessBlocked } from '@/components/messaging/states'
import { MESSAGING_PAGE } from '@/components/messaging/primitives'

export const metadata = { title: 'New Template · Caption Fox' }

export default async function NewTemplatePage() {
  const { modules, channels, access } = await requireMessagingModule('templates')

  if (!access.allowed) {
    return (
      <div className={MESSAGING_PAGE}>
        <MessagingHeader module="templates" modules={modules} />
        <AccessBlocked access={access} />
      </div>
    )
  }

  return (
    <div className={MESSAGING_PAGE}>
      <MessagingHeader module="templates" modules={modules} />
      <h2 className="mb-3 text-[15px] font-semibold text-slate-900">New template</h2>
      <TemplateComposer channels={channels} />
    </div>
  )
}
