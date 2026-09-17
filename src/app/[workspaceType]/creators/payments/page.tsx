import PaymentsPage from '@/components/creators/pages/PaymentsPage'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Payments · Creators and UGC · Caption Fox' }

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <PaymentsPage searchParams={await searchParams} />
}