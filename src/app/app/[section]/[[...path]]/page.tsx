import { notFound } from 'next/navigation'
import IntegratedFeatureShell from '@/components/shell/IntegratedFeatureShell'
import { getShellItem, shellConfigs } from '@/lib/shell/caption-fox-shell'
import { requireWorkspaceModule } from '@/lib/navigation/session'

// Fixture section ids that differ from their canonical navigation id.
const NAV_ID_FOR_SECTION: Record<string, string> = {
  templates: 'shared-templates',
  'agency-operations': 'operations',
}

export default async function AppFeatureShellPage({ params }: { params: Promise<{ section: string; path?: string[] }> }) {
  const { section, path = [] } = await params
  // Only modules in this workspace's resolved navigation can be opened.
  const session = await requireWorkspaceModule(NAV_ID_FOR_SECTION[section] ?? section)
  const own = getShellItem(shellConfigs[session.kind], section)
  const surface = own?.id === section ? session.kind : 'agency'
  const item = getShellItem(shellConfigs[surface], section)
  if (!item || item.id !== section) notFound()
  return <IntegratedFeatureShell section={section} path={path} surface={surface} />
}
