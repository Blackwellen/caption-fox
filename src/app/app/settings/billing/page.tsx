'use client'

import { useState, useEffect } from 'react'
import {
  CreditCard, CheckCircle2, Crown, Zap, Users, Building2, Rocket,
  Download, AlertTriangle, ArrowUpRight, Sparkles, Calendar,
  ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { PageHeader } from '@/components/ui/PageHeader'
import { Skeleton } from '@/components/ui/Skeleton'
import { ConfirmModal, Modal } from '@/components/ui/Modal'
import { createClient } from '@/lib/supabase/client'
import { formatDate, cn } from '@/lib/utils'
import type { Subscription, Workspace } from '@/types/database'

// ------------------------------------------------------------------
// Plan definitions
// ------------------------------------------------------------------
interface PlanDef {
  id: string
  name: string
  price: string
  period: string
  icon: React.ElementType
  iconColor: string
  highlight?: boolean
  features: string[]
  cta: 'current' | 'upgrade' | 'downgrade' | 'contact'
}

const PLANS: PlanDef[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: '$0',
    period: '/mo',
    icon: Zap,
    iconColor: 'text-slate-500',
    features: ['1 brand', '3 social channels', '20 AI captions/mo', 'Basic analytics'],
    cta: 'downgrade',
  },
  {
    id: 'creator_pro',
    name: 'Creator Pro',
    price: '$29',
    period: '/mo',
    icon: Crown,
    iconColor: 'text-amber-500',
    highlight: true,
    features: ['5 brands', '15 social channels', '500 AI captions/mo', 'Inbox + Saved Replies', 'Advanced analytics'],
    cta: 'upgrade',
  },
  {
    id: 'team',
    name: 'Team',
    price: '$79',
    period: '/mo',
    icon: Users,
    iconColor: 'text-blue-500',
    features: ['15 brands', 'Unlimited channels', '2,000 AI captions/mo', '5 team seats', 'Approval workflows'],
    cta: 'upgrade',
  },
  {
    id: 'brand',
    name: 'Brand',
    price: '$199',
    period: '/mo',
    icon: Building2,
    iconColor: 'text-violet-500',
    features: ['Unlimited brands', 'Unlimited channels', 'Unlimited AI', '20 seats', 'UGC management', 'Priority support'],
    cta: 'upgrade',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    icon: Rocket,
    iconColor: 'text-emerald-500',
    features: ['Everything in Brand', 'SSO / SAML', 'Dedicated account manager', 'SLA + audit logs', 'Custom integrations'],
    cta: 'contact',
  },
]

// ------------------------------------------------------------------
// Demo billing history rows (shown when no real data)
// ------------------------------------------------------------------
const DEMO_INVOICES = [
  { date: '2026-05-01', description: 'Creator Pro – Monthly', amount: '$29.00', id: 'INV-2026-005' },
  { date: '2026-04-01', description: 'Creator Pro – Monthly', amount: '$29.00', id: 'INV-2026-004' },
  { date: '2026-03-01', description: 'Creator Pro – Monthly', amount: '$29.00', id: 'INV-2026-003' },
]

// ------------------------------------------------------------------
// Page
// ------------------------------------------------------------------
export default function BillingPage() {
  const [workspace, setWorkspace]     = useState<Workspace | null>(null)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading]         = useState(true)
  const [seatsUsed, setSeatsUsed]     = useState<number>(0)

  // Modals
  const [stripeModal, setStripeModal]     = useState<{ open: boolean; title: string; body: string }>({
    open: false, title: '', body: '',
  })
  const [contactModal, setContactModal]   = useState(false)
  const [cancelConfirm, setCancelConfirm] = useState(false)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [cancelDone, setCancelDone]       = useState(false)

  // ------------------------------------------------------------------
  // Load
  // ------------------------------------------------------------------
  useEffect(() => {
    async function load() {
      setLoading(true)
      const sb = createClient()
      const { data: { user } } = await sb.auth.getUser()
      if (!user) { setLoading(false); return }

      // Get workspace
      const { data: member } = await sb
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .limit(1)
        .single()

      if (!member) { setLoading(false); return }

      const { data: ws } = await sb
        .from('workspaces')
        .select('*')
        .eq('id', member.workspace_id)
        .single()
      setWorkspace(ws ?? null)

      if (ws) {
        const { data: sub } = await sb
          .from('subscriptions')
          .select('*')
          .eq('workspace_id', ws.id)
          .single()
        setSubscription(sub ?? null)

        // Count seats
        const { count } = await sb
          .from('workspace_members')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', ws.id)
        setSeatsUsed(count ?? 1)
      }

      setLoading(false)
    }
    load()
  }, [])

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------
  function openStripeModal(action: 'upgrade' | 'update-card') {
    setStripeModal({
      open: true,
      title: action === 'upgrade' ? 'Redirecting to Stripe Checkout…' : 'Update payment method',
      body: action === 'upgrade'
        ? 'You\'ll be taken to Stripe\'s secure checkout to complete your plan upgrade. Your payment info is handled entirely by Stripe and never stored on Caption Fox servers.'
        : 'You\'ll be redirected to the Stripe billing portal where you can update your card, view invoices, and manage your subscription securely.',
    })
  }

  async function handleCancelSubscription() {
    setCancelLoading(true)
    // In production: call a server action / API route that calls Stripe to set cancel_at_period_end = true
    // Simulating the round-trip:
    await new Promise(r => setTimeout(r, 1200))
    const sb = createClient()
    if (subscription) {
      await sb
        .from('subscriptions')
        .update({ cancel_at_period_end: true })
        .eq('id', subscription.id)
      setSubscription(prev => prev ? { ...prev, cancel_at_period_end: true } : prev)
    }
    setCancelLoading(false)
    setCancelConfirm(false)
    setCancelDone(true)
  }

  const currentPlanId = subscription?.plan ?? workspace?.plan ?? 'starter'
  const activePlan = PLANS.find(p => p.id === currentPlanId) ?? PLANS[0]

  // ------------------------------------------------------------------
  // Skeleton
  // ------------------------------------------------------------------
  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <Skeleton className="h-5 w-32" />
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-6 w-28" />
              </div>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-2xl" />
          ))}
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3">
          <Skeleton className="h-5 w-40" />
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      </div>
    )
  }

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">

      <PageHeader
        title="Billing & Plans"
        subtitle="Manage your subscription, payment method and billing history."
        breadcrumbs={[
          { label: 'Settings', href: '/app/settings' },
          { label: 'Billing' },
        ]}
      />

      {/* ============================================================
          V1.5 CREATOR PAYMENTS BANNER
      ============================================================ */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 p-5 text-white">
        <div className="relative z-10 flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Sparkles size={20} className="shrink-0 mt-0.5 text-violet-200" />
            <div>
              <div className="flex items-center gap-2">
                <p className="font-semibold text-white">Creator Payments — Coming in V1.5</p>
                <span className="px-2 py-0.5 text-xs font-bold bg-white/20 rounded-full border border-white/30">Soon</span>
              </div>
              <p className="text-sm text-violet-100 mt-1">
                Pay UGC creators directly through Caption Fox — invoices, contracts and milestone payouts in one place.
                No more chasing payments or spreadsheets.
              </p>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            iconRight={<ChevronRight size={13} />}
            className="shrink-0 bg-white/20 border-white/30 text-white hover:bg-white/30"
            onClick={() => {}}
          >
            Join waitlist
          </Button>
        </div>
        {/* Decorative blur orbs */}
        <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-4 left-1/3 w-24 h-24 rounded-full bg-indigo-300/20 blur-2xl pointer-events-none" />
      </div>

      {/* ============================================================
          CURRENT PLAN CARD
      ============================================================ */}
      <section>
        <h2 className="text-base font-semibold text-slate-900 mb-4">Current Plan</h2>
        <div className="bg-white border border-slate-200 rounded-2xl p-6">

          {cancelDone && (
            <div className="mb-4 flex items-start gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
              <AlertTriangle size={15} className="shrink-0 mt-0.5 text-amber-500" />
              <span>
                Your plan has been set to cancel at the end of the current billing period.
                You will retain access until then.
              </span>
            </div>
          )}

          {subscription?.cancel_at_period_end && !cancelDone && (
            <div className="mb-4 flex items-start gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
              <AlertTriangle size={15} className="shrink-0 mt-0.5 text-amber-500" />
              <span>
                Your subscription is set to cancel on{' '}
                <strong>{formatDate(subscription.current_period_end)}</strong>.
                Reactivate any time before then.
              </span>
            </div>
          )}

          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-4">
              <div className={cn('p-3 rounded-xl', 'bg-slate-100')}>
                <activePlan.icon size={22} className={activePlan.iconColor} />
              </div>
              <div>
                <p className="font-bold text-slate-900 text-lg">{activePlan.name}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <Badge status={subscription?.status ?? 'active'}>
                    {(subscription?.status ?? 'Active').charAt(0).toUpperCase() + (subscription?.status ?? 'active').slice(1)}
                  </Badge>
                  {subscription && (
                    <span className="text-xs text-slate-400">
                      Renews {formatDate(subscription.current_period_end)}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-slate-900">
                {activePlan.price}
                <span className="text-sm font-normal text-slate-400">{activePlan.period}</span>
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-4 pt-5 border-t border-slate-100 text-sm">
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Billing period</p>
              <p className="font-medium text-slate-800">
                {subscription
                  ? `${formatDate(subscription.current_period_start)} – ${formatDate(subscription.current_period_end)}`
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Seats used</p>
              <p className="font-medium text-slate-800">
                {seatsUsed} / {subscription?.seats ?? '∞'} seats
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Next renewal</p>
              <p className="font-medium text-slate-800 flex items-center gap-1">
                <Calendar size={12} />
                {subscription ? formatDate(subscription.current_period_end) : 'N/A'}
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* ============================================================
          PLAN UPGRADE / DOWNGRADE
      ============================================================ */}
      <section>
        <h2 className="text-base font-semibold text-slate-900 mb-4">Change Plan</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {PLANS.map(plan => {
            const isCurrent = plan.id === currentPlanId
            return (
              <div
                key={plan.id}
                className={cn(
                  'relative flex flex-col bg-white rounded-2xl border p-4 transition-shadow',
                  isCurrent
                    ? 'border-blue-500 ring-2 ring-blue-100 shadow-md'
                    : 'border-slate-200 hover:border-slate-300 hover:shadow-sm',
                )}
              >
                {isCurrent && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 bg-blue-600 text-white text-[10px] font-bold rounded-full whitespace-nowrap">
                    Current plan
                  </span>
                )}
                {plan.highlight && !isCurrent && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded-full whitespace-nowrap">
                    Most popular
                  </span>
                )}

                <div className="flex items-center gap-2 mb-3">
                  <plan.icon size={16} className={plan.iconColor} />
                  <p className="font-semibold text-slate-900 text-sm">{plan.name}</p>
                </div>

                <p className="text-xl font-bold text-slate-900 mb-3">
                  {plan.price}
                  <span className="text-xs font-normal text-slate-400">{plan.period}</span>
                </p>

                <ul className="space-y-1.5 flex-1 mb-4">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-1.5 text-xs text-slate-600">
                      <CheckCircle2 size={11} className="shrink-0 text-emerald-500 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <div className="text-center text-xs font-medium text-blue-600 py-1.5 border border-blue-200 rounded-lg bg-blue-50">
                    Your plan
                  </div>
                ) : plan.cta === 'contact' ? (
                  <Button
                    variant="outline"
                    size="xs"
                    iconRight={<ArrowUpRight size={11} />}
                    className="w-full justify-center"
                    onClick={() => setContactModal(true)}
                  >
                    Contact us
                  </Button>
                ) : (
                  <Button
                    variant={plan.cta === 'upgrade' ? 'primary' : 'secondary'}
                    size="xs"
                    iconRight={<ArrowUpRight size={11} />}
                    className="w-full justify-center"
                    onClick={() => openStripeModal('upgrade')}
                  >
                    {plan.cta === 'upgrade' ? 'Upgrade' : 'Downgrade'}
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* ============================================================
          PAYMENT METHOD
      ============================================================ */}
      <section>
        <h2 className="text-base font-semibold text-slate-900 mb-4">Payment Method</h2>
        <div className="bg-white border border-slate-200 rounded-2xl p-6 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
              <CreditCard size={18} className="text-slate-500" />
            </div>
            <div>
              <p className="font-medium text-slate-900 tracking-widest text-sm">
                •••• •••• •••• 4242
              </p>
              <p className="text-xs text-slate-400 mt-0.5">Expires 12/27 · Visa</p>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            icon={<CreditCard size={13} />}
            onClick={() => openStripeModal('update-card')}
          >
            Update card
          </Button>
        </div>
      </section>

      {/* ============================================================
          BILLING HISTORY
      ============================================================ */}
      <section>
        <h2 className="text-base font-semibold text-slate-900 mb-4">Billing History</h2>
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-5 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Date</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Description</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Amount</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Invoice</th>
                </tr>
              </thead>
              <tbody>
                {DEMO_INVOICES.map((inv, i) => (
                  <tr
                    key={inv.id}
                    className={cn(
                      'border-b border-slate-100 last:border-b-0 hover:bg-slate-50 transition-colors',
                      i === 0 && 'font-medium',
                    )}
                  >
                    <td className="px-5 py-3.5 text-slate-700">{formatDate(inv.date)}</td>
                    <td className="px-5 py-3.5 text-slate-700">{inv.description}</td>
                    <td className="px-5 py-3.5 text-slate-700">{inv.amount}</td>
                    <td className="px-5 py-3.5">
                      <button
                        onClick={() => openStripeModal('update-card')}
                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 text-xs font-medium transition-colors"
                      >
                        <Download size={11} /> {inv.id}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 text-xs text-slate-400">
            Showing demo data. Real invoices are available in your Stripe billing portal.
          </div>
        </div>
      </section>

      {/* ============================================================
          DANGER ZONE — Cancel subscription
      ============================================================ */}
      <section>
        <h2 className="text-base font-semibold text-slate-900 mb-4">Danger Zone</h2>
        <div className="bg-white border border-red-200 rounded-2xl p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="font-semibold text-slate-900">Cancel subscription</p>
              <p className="text-sm text-slate-500 mt-1 max-w-md">
                Your plan will remain active until the end of the current billing period on{' '}
                <strong>{subscription ? formatDate(subscription.current_period_end) : 'the end of this period'}</strong>.
                After that, your workspace will revert to the free Starter plan.
              </p>
            </div>
            <Button
              variant="danger"
              size="sm"
              disabled={subscription?.cancel_at_period_end || cancelDone}
              onClick={() => setCancelConfirm(true)}
            >
              {subscription?.cancel_at_period_end || cancelDone ? 'Cancellation scheduled' : 'Cancel plan'}
            </Button>
          </div>
        </div>
      </section>

      {/* ============================================================
          MODALS
      ============================================================ */}

      {/* Stripe redirect */}
      <Modal
        open={stripeModal.open}
        onClose={() => setStripeModal(s => ({ ...s, open: false }))}
        title={stripeModal.title}
        size="sm"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setStripeModal(s => ({ ...s, open: false }))}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              iconRight={<ArrowUpRight size={13} />}
              onClick={() => {
                // In production: redirect to Stripe checkout / portal URL from backend
                setStripeModal(s => ({ ...s, open: false }))
              }}
            >
              Continue to Stripe
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-sm text-slate-600">
          <p>{stripeModal.body}</p>
          <div className="flex items-start gap-2 px-3 py-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
            <CheckCircle2 size={12} className="shrink-0 mt-0.5 text-blue-500" />
            <span>
              Caption Fox uses Stripe for secure payment processing. Your card details are never stored on our servers.
            </span>
          </div>
        </div>
      </Modal>

      {/* Enterprise contact */}
      <Modal
        open={contactModal}
        onClose={() => setContactModal(false)}
        title="Contact our Sales team"
        description="Enterprise plans are customised to your team size, usage and compliance requirements."
        size="sm"
        footer={
          <Button variant="primary" size="sm" onClick={() => setContactModal(false)}>
            Got it
          </Button>
        }
      >
        <div className="space-y-3 text-sm text-slate-600">
          <p>
            Email us at{' '}
            <a href="mailto:sales@captionfox.com" className="text-blue-600 font-medium hover:underline">
              sales@captionfox.com
            </a>{' '}
            or use the live chat to connect with a team member.
          </p>
          <p>We typically respond within one business day.</p>
        </div>
      </Modal>

      {/* Cancel confirmation */}
      <ConfirmModal
        open={cancelConfirm}
        onClose={() => setCancelConfirm(false)}
        onConfirm={handleCancelSubscription}
        title="Cancel your subscription?"
        description={`Your ${activePlan.name} plan will remain active until ${subscription ? formatDate(subscription.current_period_end) : 'the end of the billing period'}. After that your workspace will revert to the free Starter plan and you may lose access to premium features. This action can be reversed before the period ends.`}
        confirmLabel="Yes, cancel plan"
        danger
        loading={cancelLoading}
      />

    </div>
  )
}
