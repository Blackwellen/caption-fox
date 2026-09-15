import { Suspense } from 'react'
import type { Metadata } from 'next'
import { ChartColumn, ChartPie, Users } from 'lucide-react'
import { AuthCard, AuthMarketing, AuthShell } from '@/components/auth/AuthShell'
import { AffiliateApplicationForm } from '@/components/auth/AffiliateApplicationForm'
import { AffiliateOverviewPreview } from '@/components/auth/previews'

export const metadata: Metadata = { title: 'Join the affiliate program — Caption Fox' }

// Multi-step application (Account → Audience → Review). Submitting creates a
// pending application; affiliate access is only granted by admin approval.
export default function AffiliateSignupPage() {
  return (
    <AuthShell
      cardWidth={575}
      compact
      marketing={
        <AuthMarketing
          eyebrow="Affiliate program"
          title={<><span className="text-cf-blue">Grow with</span> <span className="xl:block">Caption Fox.</span></>}
          intro="Partner with Caption Fox and earn commissions by referring creators, brands and teams to the all-in-one marketing operating system."
          benefits={[
            { icon: <ChartColumn size={26} strokeWidth={2.2} />, tone: 'green', title: 'Earn referral commissions', body: 'Get rewarded for bringing new customers to Caption Fox.' },
            { icon: <Users size={26} strokeWidth={1.8} />, tone: 'violet', title: 'Access partner resources', body: 'Get your referral link and support to help you succeed.' },
            { icon: <ChartPie size={26} strokeWidth={1.8} />, tone: 'blue', title: 'Track applications and payouts', body: 'See referrals, sign-ups, conversions and earnings in your portal.' },
          ]}
          preview={<AffiliateOverviewPreview />}
        />
      }
    >
      <AuthCard title="Join the affiliate program" titleSize="md" density="compact" subtitle="Create your partner account in a few simple steps.">
        <Suspense>
          <AffiliateApplicationForm />
        </Suspense>
      </AuthCard>
    </AuthShell>
  )
}
