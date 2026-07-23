import { notFound } from 'next/navigation'
import IntegratedFeatureShell from '@/components/shell/IntegratedFeatureShell'
import { getShellItem, shellConfigs } from '@/lib/shell/caption-fox-shell'

export default async function AppFeatureShellPage({ params }: { params: Promise<{ section: string; path?: string[] }> }) {
  const { section, path = [] } = await params
  const item = getShellItem(shellConfigs.brand, section)
  if (!item || item.id !== section) notFound()
  return <IntegratedFeatureShell section={section} path={path} />
}
