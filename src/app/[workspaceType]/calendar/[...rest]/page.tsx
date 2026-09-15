import { notFound, permanentRedirect } from 'next/navigation'

/**
 * Legacy and duplicate Calendar slugs redirect to their canonical route, so old
 * bookmarks, emails and notification links keep working instead of 404ing.
 */
const ALIASES: Record<string, string> = {
  queue: 'publishing-queue',
  publishing: 'publishing-queue',
  'publish-queue': 'publishing-queue',
  scheduled: 'publishing-queue',
  schedule: '',
  month: '',
  list: 'agenda',
  upcoming: 'agenda',
  clashes: 'conflicts',
  issues: 'conflicts',
}

export default async function CalendarAliasPage({
  params,
}: {
  params: Promise<{ workspaceType: string; rest: string[] }>
}) {
  const { workspaceType, rest } = await params
  const target = ALIASES[(rest[0] ?? '').toLowerCase()]
  if (target === undefined) notFound()
  permanentRedirect(`/${workspaceType}/calendar${target ? `/${target}` : ''}`)
}
