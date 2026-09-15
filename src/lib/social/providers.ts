// Central social provider capability resolver.
//
// Every Social surface — composer options, publish buttons, reply modes,
// analytics dimensions, connection scopes — asks this module what a provider
// can actually do. Nothing in the UI may offer an action a provider does not
// support and then fail after the user commits to it.

import type { PostType, SocialProvider } from '@/types/social'

export interface SocialProviderCapabilities {
  connectAccount: boolean
  readProfile: boolean
  readPosts: boolean
  createPost: boolean
  schedulePost: boolean
  editScheduledPost: boolean
  deleteScheduledPost: boolean
  readComments: boolean
  replyToComments: boolean
  readDirectMessages: boolean
  sendDirectMessages: boolean
  readMentions: boolean
  readInsights: boolean
  readAudience: boolean
  supportsWebhooks: boolean
  supportsVideo: boolean
  supportsCarousel: boolean
  supportsStories: boolean
  supportsShortVideo: boolean
  supportsLinkInPost: boolean
  supportsFirstComment: boolean
  supportsAltText: boolean
  supportsLocation: boolean
  /** Demographic dimensions the provider actually returns. */
  audienceDimensions: ('country' | 'age' | 'gender' | 'city' | 'language')[]
  /** Post types the provider accepts through the publishing API. */
  postTypes: PostType[]
}

const base: SocialProviderCapabilities = {
  connectAccount: true,
  readProfile: true,
  readPosts: true,
  createPost: false,
  schedulePost: false,
  editScheduledPost: false,
  deleteScheduledPost: false,
  readComments: false,
  replyToComments: false,
  readDirectMessages: false,
  sendDirectMessages: false,
  readMentions: false,
  readInsights: false,
  readAudience: false,
  supportsWebhooks: false,
  supportsVideo: false,
  supportsCarousel: false,
  supportsStories: false,
  supportsShortVideo: false,
  supportsLinkInPost: false,
  supportsFirstComment: false,
  supportsAltText: false,
  supportsLocation: false,
  audienceDimensions: [],
  postTypes: [],
}

export const PROVIDER_CAPABILITIES: Record<SocialProvider, SocialProviderCapabilities> = {
  instagram: {
    ...base,
    createPost: true, schedulePost: true, editScheduledPost: true, deleteScheduledPost: true,
    readComments: true, replyToComments: true, readDirectMessages: true, sendDirectMessages: true,
    readMentions: true, readInsights: true, readAudience: true, supportsWebhooks: true,
    supportsVideo: true, supportsCarousel: true, supportsStories: true, supportsShortVideo: true,
    supportsFirstComment: true, supportsAltText: true, supportsLocation: true,
    audienceDimensions: ['country', 'age', 'gender', 'city'],
    postTypes: ['post', 'reel', 'story', 'carousel'],
  },
  facebook: {
    ...base,
    createPost: true, schedulePost: true, editScheduledPost: true, deleteScheduledPost: true,
    readComments: true, replyToComments: true, readDirectMessages: true, sendDirectMessages: true,
    readMentions: true, readInsights: true, readAudience: true, supportsWebhooks: true,
    supportsVideo: true, supportsCarousel: true, supportsStories: true, supportsShortVideo: true,
    supportsLinkInPost: true, supportsAltText: true, supportsLocation: true,
    audienceDimensions: ['country', 'age', 'gender', 'city'],
    postTypes: ['post', 'reel', 'story', 'carousel'],
  },
  tiktok: {
    ...base,
    createPost: true, schedulePost: true, deleteScheduledPost: true,
    readComments: true, replyToComments: true, readInsights: true, readAudience: true,
    supportsWebhooks: true, supportsVideo: true, supportsShortVideo: true,
    audienceDimensions: ['country', 'gender'],
    postTypes: ['post', 'short'],
  },
  linkedin: {
    ...base,
    createPost: true, schedulePost: true, editScheduledPost: true, deleteScheduledPost: true,
    readComments: true, replyToComments: true, readMentions: true, readInsights: true,
    readAudience: true, supportsVideo: true, supportsCarousel: true,
    supportsLinkInPost: true, supportsAltText: true,
    audienceDimensions: ['country', 'language'],
    postTypes: ['post', 'carousel'],
  },
  youtube: {
    ...base,
    createPost: true, schedulePost: true, editScheduledPost: true, deleteScheduledPost: true,
    readComments: true, replyToComments: true, readInsights: true, readAudience: true,
    supportsVideo: true, supportsShortVideo: true, supportsLinkInPost: true,
    audienceDimensions: ['country', 'age', 'gender'],
    postTypes: ['post', 'short'],
  },
  x: {
    ...base,
    createPost: true, schedulePost: true, deleteScheduledPost: true,
    readComments: true, replyToComments: true, readDirectMessages: true, sendDirectMessages: true,
    readMentions: true, readInsights: true,
    supportsVideo: true, supportsLinkInPost: true, supportsAltText: true,
    audienceDimensions: [],
    postTypes: ['post', 'thread'],
  },
  pinterest: {
    ...base,
    createPost: true, schedulePost: true, editScheduledPost: true, deleteScheduledPost: true,
    readComments: true, readInsights: true, readAudience: true,
    supportsVideo: true, supportsLinkInPost: true, supportsAltText: true,
    audienceDimensions: ['country', 'age', 'gender'],
    postTypes: ['pin'],
  },
  threads: {
    ...base,
    createPost: true, schedulePost: true, deleteScheduledPost: true,
    readComments: true, replyToComments: true, readMentions: true, readInsights: true,
    supportsVideo: true, supportsCarousel: true, supportsLinkInPost: true, supportsAltText: true,
    audienceDimensions: [],
    postTypes: ['post', 'thread'],
  },
}

export function capabilitiesFor(provider: SocialProvider): SocialProviderCapabilities {
  return PROVIDER_CAPABILITIES[provider] ?? base
}

export function providerSupports(
  provider: SocialProvider,
  capability: keyof SocialProviderCapabilities,
): boolean {
  const value = capabilitiesFor(provider)[capability]
  return Array.isArray(value) ? value.length > 0 : Boolean(value)
}

// ── Publishing constraints ───────────────────────────────────────────────────

export interface PublishConstraints {
  captionMax: number
  mediaMin: number
  mediaMax: number
  videoMaxSeconds: number | null
  videoMaxBytes: number | null
  imageMaxBytes: number
  hashtagMax: number | null
  requiresMedia: boolean
  /** Earliest / latest scheduling offset the provider accepts, in minutes. */
  scheduleMinLeadMinutes: number
  scheduleMaxLeadDays: number
}

const MB = 1024 * 1024

export const PROVIDER_CONSTRAINTS: Record<SocialProvider, PublishConstraints> = {
  instagram: { captionMax: 2200, mediaMin: 1, mediaMax: 10, videoMaxSeconds: 900, videoMaxBytes: 1024 * MB, imageMaxBytes: 8 * MB, hashtagMax: 30, requiresMedia: true, scheduleMinLeadMinutes: 10, scheduleMaxLeadDays: 75 },
  facebook: { captionMax: 63206, mediaMin: 0, mediaMax: 10, videoMaxSeconds: 14400, videoMaxBytes: 4096 * MB, imageMaxBytes: 10 * MB, hashtagMax: null, requiresMedia: false, scheduleMinLeadMinutes: 10, scheduleMaxLeadDays: 180 },
  tiktok: { captionMax: 2200, mediaMin: 1, mediaMax: 1, videoMaxSeconds: 600, videoMaxBytes: 4096 * MB, imageMaxBytes: 20 * MB, hashtagMax: null, requiresMedia: true, scheduleMinLeadMinutes: 20, scheduleMaxLeadDays: 10 },
  linkedin: { captionMax: 3000, mediaMin: 0, mediaMax: 20, videoMaxSeconds: 600, videoMaxBytes: 5120 * MB, imageMaxBytes: 10 * MB, hashtagMax: null, requiresMedia: false, scheduleMinLeadMinutes: 10, scheduleMaxLeadDays: 90 },
  youtube: { captionMax: 5000, mediaMin: 1, mediaMax: 1, videoMaxSeconds: 43200, videoMaxBytes: 128 * 1024 * MB, imageMaxBytes: 2 * MB, hashtagMax: 15, requiresMedia: true, scheduleMinLeadMinutes: 15, scheduleMaxLeadDays: 365 },
  x: { captionMax: 280, mediaMin: 0, mediaMax: 4, videoMaxSeconds: 140, videoMaxBytes: 512 * MB, imageMaxBytes: 5 * MB, hashtagMax: null, requiresMedia: false, scheduleMinLeadMinutes: 5, scheduleMaxLeadDays: 540 },
  pinterest: { captionMax: 500, mediaMin: 1, mediaMax: 1, videoMaxSeconds: 900, videoMaxBytes: 2048 * MB, imageMaxBytes: 20 * MB, hashtagMax: 20, requiresMedia: true, scheduleMinLeadMinutes: 20, scheduleMaxLeadDays: 30 },
  threads: { captionMax: 500, mediaMin: 0, mediaMax: 10, videoMaxSeconds: 300, videoMaxBytes: 1024 * MB, imageMaxBytes: 8 * MB, hashtagMax: 1, requiresMedia: false, scheduleMinLeadMinutes: 10, scheduleMaxLeadDays: 75 },
}

export interface DraftForValidation {
  caption: string
  mediaCount: number
  hashtagCount: number
  postType: PostType
  scheduledAt: Date | null
}

export interface ValidationIssue {
  provider: SocialProvider
  field: 'caption' | 'media' | 'hashtags' | 'post_type' | 'schedule' | 'capability'
  message: string
}

/** Provider-by-provider validation. One generic rule set is never enough. */
export function validateDraft(
  provider: SocialProvider,
  draft: DraftForValidation,
  now = new Date(),
): ValidationIssue[] {
  const caps = capabilitiesFor(provider)
  const rules = PROVIDER_CONSTRAINTS[provider]
  const issues: ValidationIssue[] = []
  const label = provider

  if (!caps.createPost) {
    issues.push({ provider, field: 'capability', message: `Publishing to ${label} is not supported.` })
    return issues
  }
  if (draft.caption.length > rules.captionMax) {
    issues.push({ provider, field: 'caption', message: `Caption is ${draft.caption.length} characters; the limit is ${rules.captionMax}.` })
  }
  if (rules.requiresMedia && draft.mediaCount < rules.mediaMin) {
    issues.push({ provider, field: 'media', message: `At least ${rules.mediaMin} media item is required.` })
  }
  if (draft.mediaCount > rules.mediaMax) {
    issues.push({ provider, field: 'media', message: `Up to ${rules.mediaMax} media items are allowed; ${draft.mediaCount} attached.` })
  }
  if (rules.hashtagMax !== null && draft.hashtagCount > rules.hashtagMax) {
    issues.push({ provider, field: 'hashtags', message: `Up to ${rules.hashtagMax} hashtags are allowed; ${draft.hashtagCount} used.` })
  }
  if (!caps.postTypes.includes(draft.postType)) {
    issues.push({ provider, field: 'post_type', message: `${draft.postType} is not a supported format.` })
  }
  if (draft.scheduledAt) {
    if (!caps.schedulePost) {
      issues.push({ provider, field: 'schedule', message: 'Scheduling is not supported — publish immediately instead.' })
    } else {
      const leadMinutes = (draft.scheduledAt.getTime() - now.getTime()) / 60000
      if (leadMinutes < rules.scheduleMinLeadMinutes) {
        issues.push({ provider, field: 'schedule', message: `Schedule at least ${rules.scheduleMinLeadMinutes} minutes ahead.` })
      }
      if (leadMinutes / (60 * 24) > rules.scheduleMaxLeadDays) {
        issues.push({ provider, field: 'schedule', message: `Cannot schedule more than ${rules.scheduleMaxLeadDays} days ahead.` })
      }
    }
  }
  return issues
}

/** Scopes a provider connection needs for the module to work end to end. */
export const REQUIRED_SCOPES: Record<SocialProvider, string[]> = {
  instagram: ['instagram_basic', 'instagram_content_publish', 'instagram_manage_comments', 'instagram_manage_insights', 'instagram_manage_messages', 'pages_show_list', 'business_management', 'pages_read_engagement', 'read_insights'],
  facebook: ['pages_show_list', 'pages_manage_posts', 'pages_read_engagement', 'pages_manage_engagement', 'pages_messaging', 'read_insights', 'business_management', 'pages_manage_metadata', 'public_profile', 'pages_read_user_content', 'pages_manage_ads', 'instagram_basic'],
  tiktok: ['user.info.basic', 'user.info.profile', 'user.info.stats', 'video.list', 'video.publish', 'comment.list', 'comment.list.manage', 'video.upload'],
  linkedin: ['r_organization_social', 'w_organization_social', 'rw_organization_admin', 'r_organization_admin', 'r_basicprofile', 'w_member_social', 'r_1st_connections_size', 'r_ads_reporting'],
  youtube: ['youtube.readonly', 'youtube.upload', 'youtube.force-ssl', 'yt-analytics.readonly', 'youtubepartner', 'youtube.channel-memberships.creator', 'userinfo.profile'],
  x: ['tweet.read', 'tweet.write', 'users.read', 'offline.access', 'like.read', 'dm.read', 'dm.write', 'follows.read', 'space.read'],
  pinterest: ['boards:read', 'pins:read', 'pins:write', 'user_accounts:read', 'boards:write'],
  threads: ['threads_basic', 'threads_content_publish', 'threads_manage_replies', 'threads_read_replies', 'threads_manage_insights'],
}
