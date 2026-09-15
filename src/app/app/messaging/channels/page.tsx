import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { getMessagingSession } from '@/lib/messaging/server'
import { channelHealth } from '@/lib/messaging/data'
import { CHANNEL_CONFIG_BADGE, CHANNEL_CONFIG_LABELS, CHANNEL_LABELS } from '@/lib/messaging/constants'
import { Panel, MESSAGING_PAGE, formatShortDate } from '@/components/messaging/primitives'
import { Badge } from '@/components/ui/Badge'
import RefreshChannelHealthButton from '@/components/messaging/RefreshChannelHealthButton'

export const metadata = { title: 'Messaging Channels · Caption Fox' }

const SETUP_NOTES: Record<string, string> = {
  email: 'Real and wired. Set RESEND_API_KEY and MESSAGING_EMAIL_FROM on this deployment, then refresh below — Email Messaging will send for real, no further setup needed.',
  sms: 'Real and wired. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and either TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM_NUMBER on this deployment, then refresh below — SMS Messaging will send for real, no further setup needed.',
  whatsapp: 'Requires a WhatsApp Business Platform (Meta) account with a verified number and approved templates. Not yet wired to a concrete adapter.',
  rcs: 'Requires a verified RCS agent through an aggregator. Not yet wired to a concrete adapter.',
  push: 'Requires a mobile/web push project (FCM/APNs or a web push provider). Not yet wired to a concrete adapter.',
}

export default async function MessagingChannelsPage() {
  const { supabase, ctx, capabilities } = await getMessagingSession()
  const health = await channelHealth(supabase, ctx.workspaceId)

  return (
    <div className={MESSAGING_PAGE}>
      <nav aria-label="Breadcrumb" className="mb-2">
        <ol className="flex items-center gap-1 text-xs text-slate-400">
          <li><Link href="/app/messaging" className="hover:text-slate-600">Messaging</Link></li>
          <li aria-hidden><ChevronRight size={12} className="text-slate-300" /></li>
          <li aria-current="page" className="font-medium text-slate-700">Channels</li>
        </ol>
      </nav>

      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-slate-900">Messaging Channels</h1>
          <p className="mt-0.5 text-sm text-slate-500">Connection status for every Messaging channel in this workspace.</p>
        </div>
        {capabilities.manageChannels && <RefreshChannelHealthButton />}
      </div>

      <div className="space-y-3">
        {health.map(row => (
          <Panel key={row.channel} title={CHANNEL_LABELS[row.channel]}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <Badge variant={CHANNEL_CONFIG_BADGE[row.status as keyof typeof CHANNEL_CONFIG_BADGE] ?? 'slate'}>
                  {CHANNEL_CONFIG_LABELS[row.status as keyof typeof CHANNEL_CONFIG_LABELS] ?? row.status}
                </Badge>
                {row.provider && <span className="ml-2 text-[12px] text-slate-500">via {row.provider}</span>}
              </div>
              {row.last_checked_at && <span className="text-[11px] text-slate-400">Last checked {formatShortDate(row.last_checked_at)}</span>}
            </div>
            <p className="mt-2 text-[12px] text-slate-500">{SETUP_NOTES[row.channel]}</p>
          </Panel>
        ))}
      </div>
    </div>
  )
}
