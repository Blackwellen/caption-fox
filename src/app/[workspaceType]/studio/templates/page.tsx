import TemplatesPage from '@/components/studio/pages/TemplatesPage'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Templates · Studio · Caption Fox' }

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <TemplatesPage searchParams={await searchParams} />
}
