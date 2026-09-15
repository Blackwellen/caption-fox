import { Suspense } from 'react'
import type { Metadata } from 'next'
import { ChartColumn, Users, Wallet } from 'lucide-react'
import { AuthCard, AuthMarketing, AuthShell } from '@/components/auth/AuthShell'
import { LoginForm } from '@/components/auth/LoginForm'
import { AffiliateDashboardPreview } from '@/components/auth/previews'

export const metadata: Metadata = { title: 'Affiliate sign in — Caption Fox' }

// Same Supabase auth backend as /login; access is decided after sign-in by the
// caller's affiliates row / application status (see checkAffiliateAccess).
export default function AffiliateLoginPage() {
  return (
    <AuthShell
      marketing={
        <AuthMarketing
          eyebrow="Partner portal"
          title={<>Welcome back to <span className="text-cf-blue xl:block">affiliates.</span></>}
          intro="Sign in to your affiliate portal to track referrals, conversions and payouts — and access everything you need to grow with Caption Fox."
          benefits={[
            { icon: <ChartColumn size={26} strokeWidth={2.2} />, tone: 'blue', title: 'Track referral performance', body: 'See your referrals, sign-ups and their status as they happen.' },
            { icon: <Users size={26} strokeWidth={1.8} />, tone: 'violet', title: 'Monitor conversions', body: 'Follow your referred users from sign up to paid plan.' },
            { icon: <Wallet size={26} strokeWidth={1.8} />, tone: 'green', title: 'View payouts and resources', body: 'Check your earnings, payout status and find marketing assets.' },
          ]}
          preview={<AffiliateDashboardPreview />}
        />
      }
    >
      <AuthCard eyebrow="Affiliate portal" title="Affiliate sign in" subtitle="Enter your details to access your affiliate account.">
        <Suspense>
          <LoginForm variant="affiliate" />
        </Suspense>
      </AuthCard>
    </AuthShell>
  )
}
