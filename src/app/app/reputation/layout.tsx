import { ToastProvider } from '@/components/reputation/Toast'

export default function ReputationLayout({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>
}
