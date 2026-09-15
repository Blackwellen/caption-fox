import { ToastProvider } from '@/components/campaigns/Toast'

export default function PartnershipsLayout({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>
}
