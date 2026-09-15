import { Suspense } from 'react'
import type { Metadata } from 'next'
import { Activity, ShieldCheck, Users } from 'lucide-react'
import { AuthCard, AuthMarketing, AuthShell } from '@/components/auth/AuthShell'
import { AdminLoginForm } from '@/components/auth/AdminLoginForm'
import { AdminConsolePreview } from '@/components/auth/previews'

export const metadata: Metadata = { title: 'Admin sign in — Caption Fox', robots: { index: false, follow: false } }

// Deliberately not nested under /admin — that tree is guarded by
// admin/layout.tsx (platform admin + AAL2), which would otherwise loop.
// There is no public admin registration: admins are provisioned in the DB.
export default function AdminLoginPage() {
  return (
    <AuthShell
      marketing={
        <AuthMarketing
          eyebrow="Admin console"
          title={<>Secure access for <span className="text-cf-blue xl:block">platform admins.</span></>}
          intro="Sign in to access system controls, moderation tools and platform settings. Keep Caption Fox running smoothly and securely."
          benefits={[
            { icon: <Users size={26} strokeWidth={1.8} />, tone: 'blue', title: 'Manage workspaces', body: 'Oversee teams, permissions and account settings.' },
            { icon: <Activity size={26} strokeWidth={1.8} />, tone: 'violet', title: 'Review system health', body: 'Monitor platform performance and service status.' },
            { icon: <ShieldCheck size={26} strokeWidth={1.8} />, tone: 'green', title: 'Handle approvals and support', body: 'Review content, manage requests and keep the platform safe.' },
          ]}
          preview={<AdminConsolePreview />}
        />
      }
    >
      <AuthCard eyebrow="Admin console" title="Admin sign in" subtitle="Enter your credentials to access the admin console.">
        <Suspense>
          <AdminLoginForm />
        </Suspense>
      </AuthCard>
    </AuthShell>
  )
}
