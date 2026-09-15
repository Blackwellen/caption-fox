import { ToastProvider } from '@/components/campaigns/Toast'

export default function CommunityLayout({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>
}
