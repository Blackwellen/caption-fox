import { Suspense } from 'react'
import type { Metadata } from 'next'
import { CalendarDays, ChartColumn, Users } from 'lucide-react'
import { AuthCard, AuthMarketing, AuthShell } from '@/components/auth/AuthShell'
import { LoginForm } from '@/components/auth/LoginForm'
import { WorkspacePreview } from '@/components/auth/previews'

export const metadata: Metadata = { title: 'Sign in — Caption Fox' }

export default function LoginPage() {
  return (
    <AuthShell
      marketing={
        <AuthMarketing
          eyebrow="Marketing operating system"
          title={<>Welcome back to <span className="text-cf-blue xl:block">Caption Fox.</span></>}
          intro="Sign in to plan campaigns, create content, collaborate with your team and measure what happens — all in one connected marketing operating system."
          benefits={[
            { icon: <CalendarDays size={26} strokeWidth={1.8} />, tone: 'blue', title: 'Pick up where you left off', body: 'Your campaigns, content and conversations — all in one place.' },
            { icon: <Users size={26} strokeWidth={1.8} />, tone: 'violet', title: 'Work together, faster', body: 'Collaborate with your team, from idea to launch.' },
            { icon: <ChartColumn size={26} strokeWidth={2.2} />, tone: 'green', title: 'Turn progress into results', body: 'Track performance and keep your marketing moving.' },
          ]}
          preview={<WorkspacePreview />}
        />
      }
    >
      <AuthCard eyebrow="Welcome back" title="Sign in" subtitle="Enter your details to access your account.">
        <Suspense>
          <LoginForm />
        </Suspense>
      </AuthCard>
    </AuthShell>
  )
}
