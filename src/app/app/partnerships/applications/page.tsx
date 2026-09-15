import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { getPartnershipSession } from '@/lib/partnerships/server'
import { listApplications } from '@/lib/partnerships/data'
import { APPLICATION_STATUS_BADGE, APPLICATION_STATUS_LABELS, PROGRAMME_TYPE_LABELS } from '@/lib/partnerships/constants'
import { Badge } from '@/components/ui/Badge'
import { CARD, CARD_SHADOW, PARTNERSHIPS_PAGE, formatShortDate } from '@/components/partnerships/primitives'
import { PartnershipsEmpty } from '@/components/partnerships/states'
import ApplicationActions from '@/components/partnerships/ApplicationActions'

export const metadata = { title: 'Applications · Partnerships · Caption Fox' }

export default async function PartnershipApplicationsPage() {
  const { supabase, ctx, capabilities } = await getPartnershipSession()
  const applications = await listApplications(supabase, ctx.workspaceId, null, { limit: 200 })

  const pending = applications.filter(a => ['pending', 'in_review'].includes(a.status))
  const decided = applications.filter(a => !['pending', 'in_review'].includes(a.status))

  return (
    <div className={PARTNERSHIPS_PAGE}>
      <header className="mb-4">
        <nav aria-label="Breadcrumb" className="mb-2">
          <ol className="flex items-center gap-1 text-xs text-slate-400">
            <li><Link href="/app/partnerships" className="hover:text-slate-600">Partnerships</Link></li>
            <li aria-hidden><ChevronRight size={12} className="text-slate-300" /></li>
            <li aria-current="page" className="font-medium text-slate-700">Applications</li>
          </ol>
        </nav>
        <h1 className="text-[26px] font-bold leading-tight tracking-tight text-slate-900">Partner applications</h1>
        <p className="mt-0.5 text-sm text-slate-500">Review and decide on applications submitted to any partnership programme.</p>
      </header>

      {pending.length === 0 ? (
        <PartnershipsEmpty title="No applications waiting" message="New applications submitted to any programme will appear here for review." />
      ) : (
        <div className={`${CARD} ${CARD_SHADOW} overflow-x-auto`}>
          <table className="w-full min-w-[720px] text-left text-[13px]">
            <caption className="sr-only">Pending partner applications</caption>
            <thead className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">Applicant</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Programme</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Status</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Submitted</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Decision</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pending.map(app => (
                <tr key={app.id}>
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-slate-900">{app.applicant_name}</p>
                    <p className="text-[11px] text-slate-400">{app.applicant_email ?? '—'}</p>
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">
                    {app.programme?.name ?? '—'}
                    {app.programme?.programme_type && (
                      <span className="ml-1 text-[11px] text-slate-400">
                        ({PROGRAMME_TYPE_LABELS[app.programme.programme_type as keyof typeof PROGRAMME_TYPE_LABELS] ?? app.programme.programme_type})
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge variant={APPLICATION_STATUS_BADGE[app.status as keyof typeof APPLICATION_STATUS_BADGE] ?? 'slate'} className="text-[10px]">
                      {APPLICATION_STATUS_LABELS[app.status as keyof typeof APPLICATION_STATUS_LABELS] ?? app.status}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 text-slate-400">{formatShortDate(app.submitted_at)}</td>
                  <td className="px-3 py-2.5 text-right">
                    <ApplicationActions applicationId={app.id} canApprove={capabilities.approveApplications} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {decided.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-[13px] font-semibold text-slate-900">Recently decided</h2>
          <div className={`${CARD} ${CARD_SHADOW} overflow-x-auto`}>
            <table className="w-full min-w-[600px] text-left text-[13px]">
              <caption className="sr-only">Recently decided applications</caption>
              <thead className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">Applicant</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Programme</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Decision</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Decided</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {decided.slice(0, 20).map(app => (
                  <tr key={app.id}>
                    <td className="px-4 py-2.5 text-slate-700">{app.applicant_name}</td>
                    <td className="px-3 py-2.5 text-slate-500">{app.programme?.name ?? '—'}</td>
                    <td className="px-3 py-2.5">
                      <Badge variant={APPLICATION_STATUS_BADGE[app.status as keyof typeof APPLICATION_STATUS_BADGE] ?? 'slate'} className="text-[10px]">
                        {APPLICATION_STATUS_LABELS[app.status as keyof typeof APPLICATION_STATUS_LABELS] ?? app.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-slate-400">{app.reviewed_at ? formatShortDate(app.reviewed_at) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
