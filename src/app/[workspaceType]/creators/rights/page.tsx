import RightsPage from '@/components/creators/pages/RightsPage'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Rights · Creators and UGC · Caption Fox' }

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <RightsPage searchParams={await searchParams} />
}