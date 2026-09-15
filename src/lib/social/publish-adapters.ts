import 'server-only'
import { getLiveToken } from './vault'
import { SOCIAL_OAUTH_CONFIG } from './oauth'
import { capabilitiesFor, PROVIDER_CONSTRAINTS } from './providers'
import type { FailureType, SocialProvider } from '@/types/social'

// Provider publishing adapters.
//
// Each adapter builds the documented request for one provider and returns
// either a provider post id or a classified failure. Nothing here reports
// success unless the provider confirmed it; the queue only marks a delivery
// `sent` once a provider id comes back.

export interface PublishInput {
  channelId: string
  provider: SocialProvider
  providerAccountId: string | null
  caption: string
  hashtags: string[]
  mediaUrls: string[]
  postType: string
  linkUrl?: string | null
  title?: string | null
}

export type PublishOutcome =
  | { ok: true; providerPostId: string; permalink: string | null }
  | { ok: false; failureType: FailureType; message: string }

function classify(status: number, body: string): FailureType {
  if (status === 401) return 'authentication'
  if (status === 403) return 'permission'
  if (status === 429) return 'rate_limit'
  if (status === 400 || status === 422) return 'validation'
  if (status >= 500) return 'provider_rejection'
  if (/timeout/i.test(body)) return 'timeout'
  return 'unknown'
}

async function readBody(res: Response): Promise<{ json: Record<string, unknown>; text: string }> {
  const text = await res.text()
  try { return { json: JSON.parse(text) as Record<string, unknown>, text } } catch { return { json: {}, text } }
}

function composeCaption(input: PublishInput): string {
  const tags = input.hashtags.filter(Boolean).map(tag => (tag.startsWith('#') ? tag : `#${tag}`))
  return [input.caption.trim(), tags.join(' ')].filter(Boolean).join('\n\n')
}

/**
 * Validates the payload against the provider's own limits before any network
 * call, so a request that cannot succeed fails fast with a specific message.
 */
function preflight(input: PublishInput): PublishOutcome | null {
  const caps = capabilitiesFor(input.provider)
  if (!caps.createPost) {
    return { ok: false, failureType: 'validation', message: `${input.provider} does not support publishing through the API.` }
  }
  const rules = PROVIDER_CONSTRAINTS[input.provider]
  const caption = composeCaption(input)
  if (caption.length > rules.captionMax) {
    return { ok: false, failureType: 'validation', message: `Caption exceeds the ${rules.captionMax}-character limit for ${input.provider}.` }
  }
  if (rules.requiresMedia && input.mediaUrls.length < rules.mediaMin) {
    return { ok: false, failureType: 'validation', message: `${input.provider} requires at least ${rules.mediaMin} media item.` }
  }
  if (input.mediaUrls.length > rules.mediaMax) {
    return { ok: false, failureType: 'validation', message: `${input.provider} accepts at most ${rules.mediaMax} media items.` }
  }
  return null
}

// ── Meta (Facebook Pages, Instagram, Threads) ────────────────────────────────

function metaError(json: Record<string, unknown>, text: string): string {
  const error = json.error as { message?: string } | undefined
  return error?.message ?? text.slice(0, 200) ?? 'The provider rejected the request.'
}

/** Meta's two-step container flow: create the media container, then publish it. */
async function publishMetaContainer(
  base: string, accountId: string, token: string, createPath: string,
  createBody: Record<string, string>, publishPath: string, idField: string,
): Promise<PublishOutcome> {
  const create = await fetch(`${base}/${accountId}/${createPath}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ ...createBody, access_token: token }),
  })
  const created = await readBody(create)
  if (!create.ok || !created.json.id) {
    return { ok: false, failureType: classify(create.status, created.text), message: metaError(created.json, created.text) }
  }
  const publish = await fetch(`${base}/${accountId}/${publishPath}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ [idField]: String(created.json.id), access_token: token }),
  })
  const published = await readBody(publish)
  if (!publish.ok || !published.json.id) {
    return { ok: false, failureType: classify(publish.status, published.text), message: metaError(published.json, published.text) }
  }
  return { ok: true, providerPostId: String(published.json.id), permalink: null }
}

// ── Adapter table ────────────────────────────────────────────────────────────

type Adapter = (input: PublishInput, token: string) => Promise<PublishOutcome>

const ADAPTERS: Record<SocialProvider, Adapter> = {
  facebook: async (input, token) => {
    const base = SOCIAL_OAUTH_CONFIG.facebook.apiBase
    const accountId = input.providerAccountId
    if (!accountId) return { ok: false, failureType: 'permission', message: 'This Facebook Page connection is missing its page id.' }
    const endpoint = input.mediaUrls.length ? 'photos' : 'feed'
    const params: Record<string, string> = { access_token: token }
    if (input.mediaUrls.length) { params.url = input.mediaUrls[0]; params.caption = composeCaption(input) }
    else { params.message = composeCaption(input); if (input.linkUrl) params.link = input.linkUrl }
    const res = await fetch(`${base}/${accountId}/${endpoint}`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params),
    })
    const body = await readBody(res)
    const id = body.json.post_id ?? body.json.id
    if (!res.ok || !id) return { ok: false, failureType: classify(res.status, body.text), message: metaError(body.json, body.text) }
    return { ok: true, providerPostId: String(id), permalink: `https://www.facebook.com/${id}` }
  },

  instagram: async (input, token) => {
    const accountId = input.providerAccountId
    if (!accountId) return { ok: false, failureType: 'permission', message: 'This Instagram connection is missing its business account id.' }
    const isVideo = input.postType === 'reel' || /\.(mp4|mov|webm)(\?|$)/i.test(input.mediaUrls[0] ?? '')
    return publishMetaContainer(
      SOCIAL_OAUTH_CONFIG.instagram.apiBase, accountId, token, 'media',
      isVideo
        ? { media_type: input.postType === 'reel' ? 'REELS' : 'VIDEO', video_url: input.mediaUrls[0], caption: composeCaption(input) }
        : { image_url: input.mediaUrls[0], caption: composeCaption(input) },
      'media_publish', 'creation_id',
    )
  },

  threads: async (input, token) => {
    const accountId = input.providerAccountId
    if (!accountId) return { ok: false, failureType: 'permission', message: 'This Threads connection is missing its user id.' }
    return publishMetaContainer(
      SOCIAL_OAUTH_CONFIG.threads.apiBase, accountId, token, 'threads',
      input.mediaUrls.length
        ? { media_type: 'IMAGE', image_url: input.mediaUrls[0], text: composeCaption(input) }
        : { media_type: 'TEXT', text: composeCaption(input) },
      'threads_publish', 'creation_id',
    )
  },

  linkedin: async (input, token) => {
    const author = input.providerAccountId
    if (!author) return { ok: false, failureType: 'permission', message: 'This LinkedIn connection is missing its organisation URN.' }
    const res = await fetch('https://api.linkedin.com/rest/posts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'LinkedIn-Version': '202411',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify({
        author,
        commentary: composeCaption(input),
        visibility: 'PUBLIC',
        distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
        lifecycleState: 'PUBLISHED',
        isReshareDisabledByAuthor: false,
      }),
    })
    const body = await readBody(res)
    const id = res.headers.get('x-restli-id') ?? body.json.id
    if (!res.ok || !id) {
      return { ok: false, failureType: classify(res.status, body.text), message: String(body.json.message ?? body.text.slice(0, 200)) }
    }
    return { ok: true, providerPostId: String(id), permalink: `https://www.linkedin.com/feed/update/${id}` }
  },

  x: async (input, token) => {
    const res = await fetch('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: composeCaption(input) }),
    })
    const body = await readBody(res)
    const data = body.json.data as { id?: string } | undefined
    if (!res.ok || !data?.id) {
      return { ok: false, failureType: classify(res.status, body.text), message: String(body.json.detail ?? body.json.title ?? body.text.slice(0, 200)) }
    }
    return { ok: true, providerPostId: data.id, permalink: `https://x.com/i/web/status/${data.id}` }
  },

  pinterest: async (input, token) => {
    const boardId = input.providerAccountId
    if (!boardId) return { ok: false, failureType: 'validation', message: 'Choose a Pinterest board before publishing.' }
    const res = await fetch('https://api.pinterest.com/v5/pins', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        board_id: boardId,
        title: input.title ?? undefined,
        description: composeCaption(input),
        link: input.linkUrl ?? undefined,
        media_source: { source_type: 'image_url', url: input.mediaUrls[0] },
      }),
    })
    const body = await readBody(res)
    if (!res.ok || !body.json.id) {
      return { ok: false, failureType: classify(res.status, body.text), message: String(body.json.message ?? body.text.slice(0, 200)) }
    }
    return { ok: true, providerPostId: String(body.json.id), permalink: `https://www.pinterest.com/pin/${body.json.id}` }
  },

  tiktok: async (input, token) => {
    // PULL_FROM_URL: TikTok fetches the media from our storage, so no resumable
    // upload is needed. Unaudited apps land the post in the creator's inbox for
    // confirmation, which is the documented behaviour.
    const res = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({
        post_info: { title: composeCaption(input).slice(0, 2200), privacy_level: 'SELF_ONLY' },
        source_info: { source: 'PULL_FROM_URL', video_url: input.mediaUrls[0] },
      }),
    })
    const body = await readBody(res)
    const data = body.json.data as { publish_id?: string } | undefined
    const error = body.json.error as { code?: string; message?: string } | undefined
    if (!res.ok || !data?.publish_id || (error?.code && error.code !== 'ok')) {
      return { ok: false, failureType: classify(res.status, body.text), message: error?.message ?? body.text.slice(0, 200) }
    }
    return { ok: true, providerPostId: data.publish_id, permalink: null }
  },

  youtube: async (input, token) => {
    const source = input.mediaUrls[0]
    if (!source) return { ok: false, failureType: 'validation', message: 'A video file is required for YouTube.' }
    const media = await fetch(source)
    if (!media.ok || !media.body) {
      return { ok: false, failureType: 'media_processing', message: 'The stored video could not be read for upload.' }
    }
    const res = await fetch(
      'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=media&part=snippet,status',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/octet-stream' },
        body: media.body,
        // Streaming request bodies require an explicit duplex mode in undici.
        duplex: 'half',
      } as RequestInit,
    )
    const body = await readBody(res)
    if (!res.ok || !body.json.id) {
      const error = body.json.error as { message?: string } | undefined
      return { ok: false, failureType: classify(res.status, body.text), message: error?.message ?? body.text.slice(0, 200) }
    }
    return { ok: true, providerPostId: String(body.json.id), permalink: `https://www.youtube.com/watch?v=${body.json.id}` }
  },
}

/** Publishes one post to one channel. Never throws — always returns an outcome. */
export async function publishToProvider(input: PublishInput): Promise<PublishOutcome> {
  const invalid = preflight(input)
  if (invalid) return invalid

  const token = await getLiveToken(input.channelId, input.provider)
  if (!token) {
    return { ok: false, failureType: 'authentication', message: 'This channel needs to be re-authorised before it can publish.' }
  }
  try {
    return await ADAPTERS[input.provider](input, token.accessToken)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The provider call failed.'
    return { ok: false, failureType: /abort|timeout/i.test(message) ? 'timeout' : 'network', message }
  }
}
