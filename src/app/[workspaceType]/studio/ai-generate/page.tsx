import AiGeneratePage from '@/components/studio/pages/AiGeneratePage'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'AI Generate · Studio · Caption Fox' }

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <AiGeneratePage searchParams={await searchParams} />
}
