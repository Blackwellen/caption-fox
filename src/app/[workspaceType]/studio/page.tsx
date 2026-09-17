import OverviewPage from '@/components/studio/pages/OverviewPage'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Studio · Caption Fox' }

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <OverviewPage searchParams={await searchParams} />
}
