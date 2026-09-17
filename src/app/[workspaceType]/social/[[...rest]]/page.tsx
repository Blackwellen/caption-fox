import type { Metadata } from 'next'
import SocialRoute, { socialPageTitle } from '@/components/social/SocialRoute'

type Params = Promise<{ workspaceType: string; rest?: string[] }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { rest = [] } = await params
  return { title: `${socialPageTitle(rest)} · Caption Fox` }
}

export default async function Page({
  params, searchParams,
}: {
  params: Params
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { workspaceType, rest = [] } = await params
  return <SocialRoute workspaceType={workspaceType} segments={rest} searchParams={await searchParams} />
}
