import { ToastProvider } from '@/components/campaigns/Toast'

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>
}
