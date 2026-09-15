/** Plain constants shared by server-only query code and client components. No `server-only` import here on purpose. */

import type { ConflictType } from './types'

export const CHANNEL_LABELS: Record<string, string> = {
  instagram: 'Instagram', tiktok: 'TikTok', linkedin: 'LinkedIn',
  facebook: 'Facebook', x: 'X', youtube: 'YouTube',
  pinterest: 'Pinterest', threads: 'Threads',
  email: 'Email', blog: 'Blog', website: 'Website', sms: 'SMS',
  internal: 'Internal', push: 'Push Notification',
}

export const MAX_PAGE_SIZE = 2000

export const CONFLICT_TYPE_LABELS: Record<ConflictType, string> = {
  overlap_collision: 'Overlap Collision',
  capacity_clash: 'Capacity Clash',
  approval_delay: 'Approval Delay',
  duplicate_slot: 'Duplicate Slot',
  blocked_dependency: 'Blocked Dependency',
  launch_collision: 'Launch Collision',
  channel_saturation: 'Channel Saturation',
  resource_unavailable: 'Resource Unavailable',
  date_invalid: 'Invalid Dates',
}
