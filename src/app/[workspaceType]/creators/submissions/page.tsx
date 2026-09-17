import SubmissionsPage from '@/components/creators/pages/SubmissionsPage'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Submissions · Creators and UGC · Caption Fox' }

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <SubmissionsPage searchParams={await searchParams} />
}