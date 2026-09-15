import { requireCreatorModule } from '@/lib/creators/server'
import {
  briefAggregates, campaignPerformance, creatorAggregates, creatorPickerList,
  deliveryRate, paymentAggregates, recentActivity, rightsAggregates,
  submissionAggregates, topCreatorPerformance, workspaceCampaigns, delta,
} from '@/lib/creators/data'
import CreatorsHeader from '@/components/creators/CreatorsHeader'
import KpiStrip from '@/components/creators/KpiStrip'
import ActivityFeed from '@/components/creators/ActivityFeed'
import { TrendChart } from '@/components/creators/charts'
import InviteCreatorButton from '@/components/creators/InviteCreatorButton'
import CreateBriefButton from '@/components/creators/CreateBriefButton'
import ExportButton, { HeaderOverflow } from '@/components/creators/ExportButton'
import { AccessBlocked, PanelEmpty } from '@/components/creators/states'
import {
  CREATORS_PAGE, CreatorChip, Panel, formatCompactMoney, formatMoney,
  formatNumber, formatPercent,
} from '@/components/creators/primitives'
import { BRIEF_STATUS_LABELS, type BriefStatus } from '@/lib/creators/constants'
import type { KpiValue } from '@/lib/creators/types'

export const metadata = { title: 'Creators and UGC Overview · Caption Fox' }

export default async function CreatorsOverviewPage() {
  const { supabase, ctx, capabilities, modules, access } = await requireCreatorModule('overview')

  if (!access.allowed) {
    return (
      <div className={CREATORS_PAGE}>
        <CreatorsHeader module="overview" modules={modules} />
        <AccessBlocked access={access} />
      </div>
    )
  }

  const [creators, briefs, submissions, rights, payments, performance, activity, campaign, creatorPicker, campaignPicker] = await Promise.all([
    creatorAggregates(supabase, ctx.workspaceId),
    briefAggregates(supabase, ctx.workspaceId),
    submissionAggregates(supabase, ctx.workspaceId),
    modules.includes('rights') ? rightsAggregates(supabase, ctx.workspaceId) : null,
    modules.includes('payments') && capabilities.viewPayments ? paymentAggregates(supabase, ctx.workspaceId) : null,
    topCreatorPerformance(supabase, ctx.workspaceId, 5),
    recentActivity(supabase, ctx.workspaceId, 6),
    campaignPerformance(supabase, ctx.workspaceId),
    capabilities.createBrief ? creatorPickerList(supabase, ctx.workspaceId) : Promise.resolve([]),
    capabilities.createBrief ? workspaceCampaigns(supabase, ctx.workspaceId) : Promise.resolve([]),
  ])

  const activeDelta = delta(creators.active, creators.previousActive)
  const briefDelta = delta(briefs.byStatus.open, briefs.previous.open)
  const submissionDelta = delta(submissions.byStatus.waiting_review + submissions.byStatus.in_review, submissions.previous.waiting + submissions.previous.inReview)
  const rightsDelta = rights ? delta(rights.byStatus.active, rights.previous.active) : null
  const paymentDelta = payments ? delta(payments.pendingAmount, payments.previous.pendingAmount) : null
  const rate = deliveryRate(briefs, submissions)

  const kpis: KpiValue[] = [
    {
      id: 'active-creators', label: 'Active Creators', value: formatNumber(creators.active),
      hint: `${activeDelta.pct >= 0 ? '+' : ''}${activeDelta.pct.toFixed(1)}% vs last 30 days`,
      trend: activeDelta.trend, icon: 'users', tone: 'blue', href: '/app/creators/creators',
      spark: creators.createdSeries,
    },
    {
      id: 'open-briefs', label: 'Open Briefs', value: formatNumber(briefs.byStatus.open),
      hint: `${briefDelta.pct >= 0 ? '+' : ''}${briefDelta.pct.toFixed(1)}% vs last 30 days`,
      trend: briefDelta.trend, icon: 'file', tone: 'violet', href: '/app/creators/briefs',
      spark: briefs.createdSeries,
    },
    {
      id: 'waiting-review', label: 'Submissions Waiting Review',
      value: formatNumber(submissions.byStatus.waiting_review + submissions.byStatus.in_review),
      hint: `${submissionDelta.pct >= 0 ? '+' : ''}${submissionDelta.pct.toFixed(1)}% vs last 30 days`,
      trend: submissionDelta.trend, icon: 'clock', tone: 'amber', href: '/app/creators/submissions',
      spark: submissions.submittedSeries,
    },
    rights
      ? {
        id: 'active-rights', label: 'Approved Usage Rights', value: formatNumber(rights.byStatus.active),
        hint: rightsDelta ? `${rightsDelta.pct >= 0 ? '+' : ''}${rightsDelta.pct.toFixed(1)}% vs last 30 days` : undefined,
        trend: rightsDelta?.trend, icon: 'shieldCheck', tone: 'green', href: '/app/creators/rights',
        spark: rights.createdSeries,
      }
      : { id: 'active-rights', label: 'Approved Usage Rights', value: '—', hint: 'Available from Team', icon: 'shieldCheck', tone: 'slate', href: '/app/settings/billing' },
    payments
      ? {
        id: 'pending-payments', label: 'Pending Payments', value: formatCompactMoney(payments.pendingAmount, payments.currency),
        hint: paymentDelta ? `${paymentDelta.pct >= 0 ? '+' : ''}${paymentDelta.pct.toFixed(1)}% vs last 30 days` : undefined,
        trend: paymentDelta?.trend, icon: 'money', tone: 'violet', href: '/app/creators/payments',
      }
      : { id: 'pending-payments', label: 'Pending Payments', value: '—', hint: 'Available from Team', icon: 'money', tone: 'slate', href: '/app/settings/billing' },
    {
      id: 'delivery-rate', label: 'Campaign Delivery Rate', value: formatPercent(rate),
      hint: 'Approved deliverables vs brief targets', icon: 'target', tone: 'blue',
    },
  ]

  const briefColumns: BriefStatus[] = ['draft', 'open', 'in_progress', 'submitted', 'completed', 'on_hold']

  return (
    <div className={CREATORS_PAGE}>
      <CreatorsHeader
        module="overview" modules={modules}
        actions={(
          <>
            {capabilities.createBrief && (
              <CreateBriefButton creators={creatorPicker} campaigns={campaignPicker} />
            )}
            {capabilities.invite && <InviteCreatorButton />}
            <ExportButton entity="creators" allowed={capabilities.export} />
            <HeaderOverflow items={[
              { label: 'Refresh data', onSelect: 'refresh' },
              { label: 'Creators & UGC settings', href: '/app/settings' },
            ]}
            />
          </>
        )}
      />

      <div className="space-y-4">
        <KpiStrip items={kpis} />

        <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
          <Panel title="Top Creator Performance" viewAllHref="/app/creators/creators" bodyClassName="px-0 pb-0">
            {performance.length === 0 ? (
              <PanelEmpty message="Once creators start submitting content, their reach, engagement and earnings will appear here." className="px-4" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400">
                      <th className="px-4 py-2.5 font-medium">Creator</th>
                      <th className="px-3 py-2.5 font-medium">Reach</th>
                      <th className="px-3 py-2.5 font-medium">Eng. Rate</th>
                      <th className="px-3 py-2.5 font-medium">Submissions</th>
                      <th className="px-3 py-2.5 font-medium">Approved</th>
                      <th className="px-3 py-2.5 font-medium">Rights</th>
                      <th className="px-4 py-2.5 text-right font-medium">Earnings</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {performance.map(row => (
                      <tr key={row.creator.id} className="hover:bg-slate-50/60">
                        <td className="px-4 py-2.5">
                          <CreatorChip creator={row.creator} href={`/app/creators/creators/${row.creator.id}`} size={26} />
                        </td>
                        <td className="px-3 py-2.5 text-slate-600">{formatNumber(row.reach)}</td>
                        <td className="px-3 py-2.5 text-slate-600">{formatPercent(row.engagementRate)}</td>
                        <td className="px-3 py-2.5 text-slate-600">{row.submissions}</td>
                        <td className="px-3 py-2.5 text-slate-600">{formatPercent(row.approvalRate, 0)}</td>
                        <td className="px-3 py-2.5 text-slate-600">{row.rights}</td>
                        <td className="px-4 py-2.5 text-right font-medium text-slate-900">{formatMoney(row.earnings)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel title="Briefs Summary" viewAllHref="/app/creators/briefs">
            <ul className="space-y-2.5">
              {briefColumns.map(status => (
                <li key={status} className="flex items-center justify-between text-[13px]">
                  <span className="text-slate-600">{BRIEF_STATUS_LABELS[status]}</span>
                  <span className="font-semibold text-slate-900">{briefs.byStatus[status]}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 border-t border-slate-100 pt-3">
              <div className="flex items-center justify-between text-[12px] text-slate-500">
                <span>Total briefs · <span className="font-semibold text-slate-800">{briefs.total}</span></span>
                <span>Completion rate · <span className="font-semibold text-slate-800">{formatPercent(briefs.completionRate, 0)}</span></span>
              </div>
            </div>
          </Panel>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <Panel title="Rights & Payments" viewAllHref="/app/creators/rights" className="xl:col-span-1">
            {rights ? (
              <div className="grid grid-cols-2 gap-4 text-[12.5px]">
                <div>
                  <p className="mb-1.5 font-semibold text-slate-700">Usage Rights</p>
                  <ul className="space-y-1.5 text-slate-500">
                    <li className="flex justify-between"><span>Active</span><span className="font-medium text-slate-800">{rights.byStatus.active}</span></li>
                    <li className="flex justify-between"><span>Expiring soon</span><span className="font-medium text-amber-600">{rights.expiringSoon}</span></li>
                    <li className="flex justify-between"><span>Expired</span><span className="font-medium text-red-600">{rights.byStatus.expired}</span></li>
                  </ul>
                </div>
                <div>
                  <p className="mb-1.5 font-semibold text-slate-700">Payments</p>
                  <ul className="space-y-1.5 text-slate-500">
                    <li className="flex justify-between"><span>Pending</span><span className="font-medium text-slate-800">{payments ? formatCompactMoney(payments.pendingAmount) : '—'}</span></li>
                    <li className="flex justify-between"><span>In review</span><span className="font-medium text-slate-800">{payments ? formatCompactMoney(payments.inReviewAmount) : '—'}</span></li>
                    <li className="flex justify-between"><span>Paid (this month)</span><span className="font-medium text-emerald-600">{payments ? formatCompactMoney(payments.paidThisMonth) : '—'}</span></li>
                  </ul>
                </div>
              </div>
            ) : <PanelEmpty message="Rights and payments tracking is available from the Team plan." />}
          </Panel>

          <Panel title="Workflow Status Distribution" viewAllHref="/app/creators/submissions" className="xl:col-span-1">
            <ul className="space-y-2 text-[12.5px]">
              {(['waiting_review', 'in_review', 'changes_requested', 'approved', 'rejected'] as const).map(key => (
                <li key={key} className="flex items-center justify-between">
                  <span className="capitalize text-slate-600">{key.replace(/_/g, ' ')}</span>
                  <span className="font-semibold text-slate-900">{submissions.byStatus[key]}</span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Campaign Performance Overview" viewAllHref="/app/analytics" className="xl:col-span-1" bodyClassName="px-4">
            <div className="mb-2 flex items-center justify-between text-[12.5px] text-slate-500">
              <span>Total reach · <span className="font-semibold text-slate-800">{formatNumber(campaign.totalReach)}</span></span>
              <span>Eng. rate · <span className="font-semibold text-slate-800">{formatPercent(campaign.avgEngagementRate)}</span></span>
            </div>
            <TrendChart
              height={120}
              data={campaign.series}
              series={[{ key: 'reach', label: 'Reach', colour: '#3b82f6' }, { key: 'engagements', label: 'Engagements', colour: '#8b5cf6', dashed: true }]}
            />
          </Panel>
        </div>

        <Panel title="Recent Activity" viewAllHref="/app/creators/creators">
          <ActivityFeed items={activity} />
        </Panel>
      </div>
    </div>
  )
}
