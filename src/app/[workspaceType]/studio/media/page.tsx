import MediaPage from '@/components/studio/pages/MediaPage'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Media · Studio · Caption Fox' }

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <MediaPage searchParams={await searchParams} />
}
