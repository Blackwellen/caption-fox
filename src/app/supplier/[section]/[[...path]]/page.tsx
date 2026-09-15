import { notFound, redirect } from 'next/navigation'
import IntegratedFeatureShell from '@/components/shell/IntegratedFeatureShell'
import { getShellItem, shellConfigs } from '@/lib/shell/caption-fox-shell'

export default async function SupplierFeatureShellPage({ params }: { params: Promise<{ section: string; path?: string[] }> }) {
  const { section, path = [] } = await params
  // The canonical Earnings & Payouts route; its real page is /supplier/payouts.
  if (section === 'earnings') redirect('/supplier/payouts')
  const item = getShellItem(shellConfigs.supplier, section)
  if (!item || item.id !== section) notFound()
  return <IntegratedFeatureShell section={section} path={path} surface="supplier" basePath="/supplier" />
}
