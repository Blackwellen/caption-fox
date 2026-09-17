import OverviewPage from '@/components/creators/pages/OverviewPage'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Creators and UGC Overview · Caption Fox' }

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <OverviewPage searchParams={await searchParams} />
}