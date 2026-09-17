import ComposePage from '@/components/studio/pages/ComposePage'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Compose · Studio · Caption Fox' }

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <ComposePage searchParams={await searchParams} />
}
