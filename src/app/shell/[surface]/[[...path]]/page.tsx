import { notFound } from 'next/navigation'
import CaptionFoxShell from '@/components/shell/CaptionFoxShell'
import { shellConfigs, type ShellSurface } from '@/lib/shell/caption-fox-shell'

function shellEnabled() {
  return process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_CAPTION_FOX_SHELL_DEMO === 'true'
}

export default async function ShellSurfacePage({ params }: { params: Promise<{ surface: string; path?: string[] }> }) {
  if (!shellEnabled()) notFound()
  const { surface, path = [] } = await params
  if (!(surface in shellConfigs)) notFound()
  return <CaptionFoxShell surface={surface as ShellSurface} path={path} />
}
