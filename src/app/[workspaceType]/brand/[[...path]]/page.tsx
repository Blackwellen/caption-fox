import { notFound } from 'next/navigation'
import BrandAssetsRoute from '@/components/brand-assets/BrandAssetsRoute'

const TYPES = ['creator', 'business', 'brand', 'agency']

/** `/{type}/brand[/kits|assets|rights|products]` — one shared implementation. */
export default async function BrandAssetsPage({ params, searchParams }: {
  params: Promise<{ workspaceType: string; path?: string[] }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { workspaceType, path = [] } = await params
  if (!TYPES.includes(workspaceType)) notFound()
  return (
    <BrandAssetsRoute
      workspaceType={workspaceType}
      segments={['brand', ...path]}
      searchParams={await searchParams}
    />
  )
}
