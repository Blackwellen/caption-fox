import { requireWebModule } from '@/lib/web/server'
import WebHeader from '@/components/web/WebHeader'
import { AccessBlocked } from '@/components/web/states'
import { WEB_PAGE, Panel } from '@/components/web/primitives'
import { LineChart } from 'lucide-react'

export const metadata = { title: 'Tracking · Web and Conversion · Caption Fox' }

export default async function WebTrackingPage() {
  const { modules, access } = await requireWebModule('tracking')

  return (
    <div className={WEB_PAGE}>
      <WebHeader module="tracking" modules={modules} />
      {!access.allowed ? (
        <AccessBlocked access={access} />
      ) : (
        <Panel>
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
              <LineChart size={22} />
            </span>
            <h2 className="text-base font-semibold text-slate-900">The Tracking workspace is coming next</h2>
            <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-500">
              Per-event diagnostics, destination delivery logs and pixel/script health checks are being built in the
              next phase of Web &amp; Conversion. Live tracking event and destination records already power the
              Overview KPIs and health chart above.
            </p>
          </div>
        </Panel>
      )}
    </div>
  )
}
