import CreatorsPage from '@/components/creators/pages/CreatorsPage'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Creators · Creators and UGC · Caption Fox' }

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <CreatorsPage searchParams={await searchParams} />
}