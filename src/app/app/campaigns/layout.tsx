import { ToastProvider } from '@/components/campaigns/Toast'

export default function CampaignsLayout({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>
}
