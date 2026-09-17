import BriefsPage from '@/components/creators/pages/BriefsPage'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Briefs · Creators and UGC · Caption Fox' }

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <BriefsPage searchParams={await searchParams} />
}