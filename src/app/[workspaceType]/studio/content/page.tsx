import ContentLibraryPage from '@/components/studio/pages/ContentLibraryPage'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Content Library · Studio · Caption Fox' }

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <ContentLibraryPage searchParams={await searchParams} />
}
