import { ToastProvider } from '@/components/campaigns/Toast'

export default function WebLayout({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>
}
