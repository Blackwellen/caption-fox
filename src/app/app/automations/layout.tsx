import { ToastProvider } from '@/components/campaigns/Toast'

export default function AutomationsLayout({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>
}
