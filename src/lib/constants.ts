export const APP_NAME = 'Caption Fox'
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
export const SUPPORT_EMAIL = 'support@captionfox.com'

export const WORKSPACE_TYPES = ['Creator', 'Small Business', 'Brand', 'Agency'] as const
export type WorkspaceType = typeof WORKSPACE_TYPES[number]

export const WORKSPACE_ROLES = [
  'owner', 'admin', 'manager', 'creator', 'approver', 'analyst', 'client', 'external_creator',
] as const
export type WorkspaceRole = typeof WORKSPACE_ROLES[number]

export const CAMPAIGN_STATUSES = [
  'idea', 'briefing', 'in_production', 'in_review', 'scheduled', 'live', 'reporting', 'completed', 'archived',
] as const
export type CampaignStatus = typeof CAMPAIGN_STATUSES[number]

export const CAMPAIGN_STATUS_LABELS: Record<string, string> = {
  idea: 'Idea', briefing: 'Briefing', in_production: 'In Production',
  in_review: 'In Review', scheduled: 'Scheduled', live: 'Live',
  reporting: 'Reporting', completed: 'Completed', archived: 'Archived',
}

export const CAMPAIGN_TYPES = [
  'standard', 'product_launch', 'brand_awareness', 'giveaway', 'competition',
  'ugc', 'influencer', 'seasonal', 'event', 'lead_gen', 'retargeting', 'partnership',
] as const
export type CampaignType = typeof CAMPAIGN_TYPES[number]

export const CAMPAIGN_TYPE_LABELS: Record<string, string> = {
  standard: 'Standard', product_launch: 'Product Launch', brand_awareness: 'Brand Awareness',
  giveaway: 'Giveaway', competition: 'Competition', ugc: 'UGC Campaign',
  influencer: 'Influencer', seasonal: 'Seasonal', event: 'Event',
  lead_gen: 'Lead Gen', retargeting: 'Retargeting', partnership: 'Partnership',
}

export const CAMPAIGN_TYPE_ICONS: Record<string, string> = {
  standard: 'Megaphone', product_launch: 'Rocket', brand_awareness: 'Sparkles',
  giveaway: 'Gift', competition: 'Trophy', ugc: 'Video',
  influencer: 'Users', seasonal: 'Calendar', event: 'CalendarDays',
  lead_gen: 'Target', retargeting: 'RefreshCw', partnership: 'Handshake',
}

export const GIVEAWAY_ENTRY_METHODS = [
  'follow', 'like', 'comment', 'share', 'tag_friend', 'repost', 'story_share',
  'email_signup', 'website_visit', 'purchase', 'hashtag_post', 'form_fill',
] as const
export type GiveawayEntryMethod = typeof GIVEAWAY_ENTRY_METHODS[number]

export const GIVEAWAY_ENTRY_LABELS: Record<string, string> = {
  follow: 'Follow account', like: 'Like post', comment: 'Comment on post',
  share: 'Share post', tag_friend: 'Tag a friend', repost: 'Repost / Retweet',
  story_share: 'Share to story', email_signup: 'Email sign-up', website_visit: 'Visit website',
  purchase: 'Make a purchase', hashtag_post: 'Post with hashtag', form_fill: 'Fill out form',
}

export const COMPETITION_TYPES = [
  'photo', 'video', 'caption', 'design', 'essay', 'recipe', 'art', 'vote', 'quiz',
] as const
export type CompetitionType = typeof COMPETITION_TYPES[number]

export const COMPETITION_TYPE_LABELS: Record<string, string> = {
  photo: 'Photo Submission', video: 'Video Submission', caption: 'Caption Contest',
  design: 'Design Contest', essay: 'Essay / Writing', recipe: 'Recipe Contest',
  art: 'Artwork Submission', vote: 'Public Vote', quiz: 'Quiz / Trivia',
}

export const SOCIAL_PLATFORMS = [
  'instagram', 'tiktok', 'linkedin', 'facebook', 'x', 'youtube', 'pinterest',
] as const
export type SocialPlatform = typeof SOCIAL_PLATFORMS[number]

export const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram', tiktok: 'TikTok', linkedin: 'LinkedIn',
  facebook: 'Facebook', x: 'X (Twitter)', youtube: 'YouTube', pinterest: 'Pinterest',
}

export const CONTENT_GOALS = [
  'Grow followers', 'Drive website traffic', 'Generate leads', 'Increase engagement',
  'Build brand awareness', 'Promote products', 'Educate audience', 'Community building',
] as const

export const POST_TYPES = ['post', 'reel', 'story', 'carousel', 'short', 'pin', 'article'] as const

export const NAV_ITEMS = [
  { label: 'Home', href: '/app/home', icon: 'home' },
  { label: 'Calendar', href: '/app/calendar', icon: 'calendar' },
  { label: 'Campaigns', href: '/app/campaigns', icon: 'megaphone' },
  { label: 'Studio', href: '/app/studio', icon: 'wand' },
  { label: 'UGC', href: '/app/ugc', icon: 'video' },
  { label: 'Inbox', href: '/app/inbox', icon: 'inbox' },
  { label: 'Analytics', href: '/app/analytics', icon: 'bar-chart' },
  { label: 'Settings', href: '/app/settings', icon: 'settings' },
] as const

export const PLANS = [
  { id: 'free', name: 'Free', monthly: 0, yearly: 0 },
  { id: 'starter', name: 'Starter', monthly: 29, yearly: 23 },
  { id: 'pro', name: 'Pro', monthly: 59, yearly: 47 },
  { id: 'team', name: 'Team', monthly: 99, yearly: 79 },
  { id: 'agency', name: 'Agency', monthly: 199, yearly: 159 },
  { id: 'enterprise', name: 'Enterprise', monthly: null, yearly: null },
] as const
