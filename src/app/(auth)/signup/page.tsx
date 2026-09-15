import { Suspense } from 'react'
import type { Metadata } from 'next'
import { ChartColumn, Users, Zap } from 'lucide-react'
import { AuthCard, AuthMarketing, AuthShell } from '@/components/auth/AuthShell'
import { RegisterForm } from '@/components/auth/RegisterForm'
import { WorkspacePreview } from '@/components/auth/previews'

export const metadata: Metadata = { title: 'Create your account — Caption Fox' }

export default function SignupPage() {
  return (
    <AuthShell
      cardWidth={590}
      compact
      marketing={
        <AuthMarketing
          eyebrow="Get started"
          title={<>Create your <span className="text-cf-blue xl:block">Caption Fox account.</span></>}
          intro="Choose the workspace that fits how you work and get everything you need to plan campaigns, create content, collaborate with your team and measure results — all in one place."
          benefits={[
            { icon: <Users size={26} strokeWidth={1.8} />, tone: 'violet', title: 'Set up your workspace', body: 'Choose the account type that fits your needs.' },
            { icon: <Zap size={26} strokeWidth={1.8} />, tone: 'blue', title: 'Get started quickly', body: 'A simple setup, so you can get to work.' },
            { icon: <ChartColumn size={26} strokeWidth={2.2} />, tone: 'green', title: 'Everything in one place', body: 'Plan, create, collaborate and measure.' },
          ]}
          preview={<WorkspacePreview />}
        />
      }
    >
      <AuthCard eyebrow="Create account" title="Create account" density="compact" subtitle="Set up your account and choose the workspace that fits how you work.">
        <Suspense>
          <RegisterForm />
        </Suspense>
      </AuthCard>
    </AuthShell>
  )
}
