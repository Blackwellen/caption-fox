import { ToastProvider } from '@/components/campaigns/Toast'

export default function CreatorsLayout({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>
}
