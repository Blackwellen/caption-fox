import type { Metadata } from 'next'
import LinksRoute, { linksTitle } from '@/components/link-in-bio/LinksRoute'

type Props = {
  params: Promise<{ workspaceType: string; rest?: string[] }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { rest = [] } = await params
  return { title: `${linksTitle(rest)} · Link in Bio · Caption Fox` }
}

export default async function Page({ params, searchParams }: Props) {
  const { workspaceType, rest = [] } = await params
  return <LinksRoute workspaceType={workspaceType} segments={rest} searchParams={await searchParams} />
}
