import { ToastProvider } from '@/components/campaigns/Toast'

export default function MessagingLayout({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>
}
