import { requireWorkspaceModule } from '@/lib/navigation/session'

export default async function SeoLayout({ children }: { children: React.ReactNode }) {
  // Plan-gated for Business; absent from Creator. Mirrors the sidebar.
  await requireWorkspaceModule('seo')
  return children
}
