import 'server-only'
import { R2_PREFIX, signReadUrls } from '@/lib/storage/r2'
import type { SocialSession } from './server'
import { getChannels } from './queries'
import type { SocialChannelRow } from '@/types/social'

// Data for the shared post composer. Media is chosen from the workspace's own
// Brand & Assets library (storage-backed, rights-checked) — the composer never
// accepts a pasted external media URL.

export interface ComposerAsset { id: string; name: string; kind: 'image' | 'video'; thumb: string | null; storedPath: string }
export interface ComposerPost {
  id: string; title: string | null; caption: string | null; post_type: string; status: string
  channel_id: string | null; platforms: string[] | null; campaign_id: string | null
  scheduled_at: string | null; timezone: string; approval_required: boolean | null; media_urls: string[] | null
}
export interface ComposerData {
  channels: SocialChannelRow[]
  campaigns: { id: string; name: string }[]
  assets: ComposerAsset[]
  post: ComposerPost | null
}

const USABLE_RIGHTS = ['all_media', 'licensed', 'unspecified']

export async function getComposerData(session: SocialSession, postId: string | null): Promise<ComposerData> {
  const workspaceId = session.ctx.workspaceId
  const [channels, { data: campaigns }, { data: assets }, postResult] = await Promise.all([
    getChannels(session),
    session.supabase.from('campaigns').select('id, name').eq('workspace_id', workspaceId)
      .is('archived_at', null).order('updated_at', { ascending: false }).limit(50),
    session.supabase.from('media_assets')
      .select('id, file_name, file_type, mime_type, file_path, thumbnail_path, rights_state')
      .eq('workspace_id', workspaceId).eq('approval_status', 'approved').is('archived_at', null)
      .in('rights_state', USABLE_RIGHTS).order('created_at', { ascending: false }).limit(60),
    postId
      ? session.supabase.from('content_posts')
          .select('id, title, caption, post_type, status, channel_id, platforms, campaign_id, scheduled_at, timezone, approval_required, media_urls')
          .eq('workspace_id', workspaceId).eq('id', postId).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  type AssetRow = { id: string; file_name: string; file_type: string | null; mime_type: string | null; file_path: string | null; thumbnail_path: string | null }
  const allowedPrefix = `${R2_PREFIX}brand-assets/${workspaceId}/`
  const rows = ((assets ?? []) as AssetRow[]).filter(row => {
    const type = `${row.file_type ?? ''} ${row.mime_type ?? ''}`
    return /image|jpg|jpeg|png|video|mp4/i.test(type) && row.file_path
  })
  const toSign = rows.map(row => row.thumbnail_path).filter((path): path is string => Boolean(path?.startsWith(allowedPrefix) && !path.includes('..')))
  const signed = toSign.length ? await signReadUrls(toSign).catch(() => new Map<string, string | null>()) : new Map<string, string | null>()

  return {
    channels,
    campaigns: (campaigns ?? []) as { id: string; name: string }[],
    assets: rows.map(row => ({
      id: row.id,
      name: row.file_name,
      kind: /video|mp4/i.test(`${row.file_type} ${row.mime_type}`) ? 'video' : 'image',
      thumb: row.thumbnail_path ? signed.get(row.thumbnail_path) ?? null : null,
      storedPath: row.file_path!,
    })),
    post: (postResult.data ?? null) as ComposerPost | null,
  }
}
