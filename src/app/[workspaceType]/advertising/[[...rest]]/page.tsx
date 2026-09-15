import AdvertisingRoute from '@/components/advertising/AdvertisingRoute'

export default async function Page({
  params, searchParams,
}: {
  params: Promise<{ workspaceType: string; rest?: string[] }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { workspaceType, rest = [] } = await params
  return (
    <AdvertisingRoute
      workspaceType={workspaceType}
      segments={['advertising', ...rest]}
      searchParams={await searchParams}
    />
  )
}
