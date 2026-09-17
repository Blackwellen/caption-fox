import IdeasPage from '@/components/studio/pages/IdeasPage'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Ideas · Studio · Caption Fox' }

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <IdeasPage searchParams={await searchParams} />
}
