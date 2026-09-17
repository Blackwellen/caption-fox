import HashtagsPage from '@/components/studio/pages/HashtagsPage'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Hashtags & Keywords · Studio · Caption Fox' }

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <HashtagsPage searchParams={await searchParams} />
}
