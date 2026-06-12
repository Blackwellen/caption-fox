export const PERMISSIONS = {
  // Content
  CREATE_POST: 'create_post',
  EDIT_POST: 'edit_post',
  DELETE_POST: 'delete_post',
  PUBLISH_POST: 'publish_post',
  SCHEDULE_POST: 'schedule_post',
  APPROVE_POST: 'approve_post',
  // Campaigns
  CREATE_CAMPAIGN: 'create_campaign',
  EDIT_CAMPAIGN: 'edit_campaign',
  DELETE_CAMPAIGN: 'delete_campaign',
  MANAGE_GIVEAWAY: 'manage_giveaway',
  MANAGE_COMPETITION: 'manage_competition',
  // UGC
  CREATE_BRIEF: 'create_brief',
  APPROVE_UGC: 'approve_ugc',
  MANAGE_CREATORS: 'manage_creators',
  // Analytics
  VIEW_ANALYTICS: 'view_analytics',
  EXPORT_DATA: 'export_data',
  // Inbox
  VIEW_INBOX: 'view_inbox',
  REPLY_INBOX: 'reply_inbox',
  ASSIGN_INBOX: 'assign_inbox',
  // Team
  INVITE_MEMBERS: 'invite_members',
  REMOVE_MEMBERS: 'remove_members',
  MANAGE_ROLES: 'manage_roles',
  // Settings
  MANAGE_BILLING: 'manage_billing',
  MANAGE_CHANNELS: 'manage_channels',
  MANAGE_BRANDS: 'manage_brands',
  MANAGE_INTEGRATIONS: 'manage_integrations',
  VIEW_AUDIT_LOG: 'view_audit_log',
  // AI
  USE_AI: 'use_ai',
  APPROVE_AI_CONTENT: 'approve_ai_content',
} as const

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS]

// Default permissions per role
export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  owner: Object.values(PERMISSIONS) as Permission[],
  admin: [
    PERMISSIONS.CREATE_POST, PERMISSIONS.EDIT_POST, PERMISSIONS.DELETE_POST,
    PERMISSIONS.PUBLISH_POST, PERMISSIONS.SCHEDULE_POST, PERMISSIONS.APPROVE_POST,
    PERMISSIONS.CREATE_CAMPAIGN, PERMISSIONS.EDIT_CAMPAIGN, PERMISSIONS.DELETE_CAMPAIGN,
    PERMISSIONS.MANAGE_GIVEAWAY, PERMISSIONS.MANAGE_COMPETITION,
    PERMISSIONS.CREATE_BRIEF, PERMISSIONS.APPROVE_UGC, PERMISSIONS.MANAGE_CREATORS,
    PERMISSIONS.VIEW_ANALYTICS, PERMISSIONS.EXPORT_DATA,
    PERMISSIONS.VIEW_INBOX, PERMISSIONS.REPLY_INBOX, PERMISSIONS.ASSIGN_INBOX,
    PERMISSIONS.INVITE_MEMBERS, PERMISSIONS.REMOVE_MEMBERS,
    PERMISSIONS.MANAGE_CHANNELS, PERMISSIONS.MANAGE_BRANDS, PERMISSIONS.MANAGE_INTEGRATIONS,
    PERMISSIONS.VIEW_AUDIT_LOG, PERMISSIONS.USE_AI, PERMISSIONS.APPROVE_AI_CONTENT,
  ],
  manager: [
    PERMISSIONS.CREATE_POST, PERMISSIONS.EDIT_POST, PERMISSIONS.DELETE_POST,
    PERMISSIONS.SCHEDULE_POST, PERMISSIONS.APPROVE_POST,
    PERMISSIONS.CREATE_CAMPAIGN, PERMISSIONS.EDIT_CAMPAIGN,
    PERMISSIONS.MANAGE_GIVEAWAY, PERMISSIONS.MANAGE_COMPETITION,
    PERMISSIONS.CREATE_BRIEF, PERMISSIONS.APPROVE_UGC, PERMISSIONS.MANAGE_CREATORS,
    PERMISSIONS.VIEW_ANALYTICS, PERMISSIONS.EXPORT_DATA,
    PERMISSIONS.VIEW_INBOX, PERMISSIONS.REPLY_INBOX, PERMISSIONS.ASSIGN_INBOX,
    PERMISSIONS.INVITE_MEMBERS, PERMISSIONS.USE_AI, PERMISSIONS.APPROVE_AI_CONTENT,
  ],
  creator: [
    PERMISSIONS.CREATE_POST, PERMISSIONS.EDIT_POST, PERMISSIONS.SCHEDULE_POST,
    PERMISSIONS.CREATE_CAMPAIGN, PERMISSIONS.CREATE_BRIEF,
    PERMISSIONS.VIEW_ANALYTICS, PERMISSIONS.VIEW_INBOX, PERMISSIONS.REPLY_INBOX,
    PERMISSIONS.USE_AI,
  ],
  approver: [
    PERMISSIONS.APPROVE_POST, PERMISSIONS.APPROVE_UGC, PERMISSIONS.APPROVE_AI_CONTENT,
    PERMISSIONS.VIEW_ANALYTICS, PERMISSIONS.VIEW_INBOX,
  ],
  analyst: [
    PERMISSIONS.VIEW_ANALYTICS, PERMISSIONS.EXPORT_DATA, PERMISSIONS.VIEW_AUDIT_LOG,
  ],
  client: [
    PERMISSIONS.VIEW_ANALYTICS,
  ],
  external_creator: [
    PERMISSIONS.CREATE_BRIEF,
  ],
}

export const PERMISSION_LABELS: Record<string, string> = {
  create_post: 'Create Posts',
  edit_post: 'Edit Posts',
  delete_post: 'Delete Posts',
  publish_post: 'Publish Posts',
  schedule_post: 'Schedule Posts',
  approve_post: 'Approve Posts',
  create_campaign: 'Create Campaigns',
  edit_campaign: 'Edit Campaigns',
  delete_campaign: 'Delete Campaigns',
  manage_giveaway: 'Manage Giveaways',
  manage_competition: 'Manage Competitions',
  create_brief: 'Create UGC Briefs',
  approve_ugc: 'Approve UGC Submissions',
  manage_creators: 'Manage Creators',
  view_analytics: 'View Analytics',
  export_data: 'Export Data',
  view_inbox: 'View Inbox',
  reply_inbox: 'Reply in Inbox',
  assign_inbox: 'Assign Inbox Threads',
  invite_members: 'Invite Team Members',
  remove_members: 'Remove Team Members',
  manage_roles: 'Manage Roles & Permissions',
  manage_billing: 'Manage Billing',
  manage_channels: 'Manage Social Channels',
  manage_brands: 'Manage Brands',
  manage_integrations: 'Manage Integrations',
  view_audit_log: 'View Audit Log',
  use_ai: 'Use Fox AI',
  approve_ai_content: 'Approve AI Content',
}

export const PERMISSION_GROUPS: { label: string; permissions: Permission[] }[] = [
  { label: 'Content', permissions: [PERMISSIONS.CREATE_POST, PERMISSIONS.EDIT_POST, PERMISSIONS.DELETE_POST, PERMISSIONS.PUBLISH_POST, PERMISSIONS.SCHEDULE_POST, PERMISSIONS.APPROVE_POST] },
  { label: 'Campaigns', permissions: [PERMISSIONS.CREATE_CAMPAIGN, PERMISSIONS.EDIT_CAMPAIGN, PERMISSIONS.DELETE_CAMPAIGN, PERMISSIONS.MANAGE_GIVEAWAY, PERMISSIONS.MANAGE_COMPETITION] },
  { label: 'UGC', permissions: [PERMISSIONS.CREATE_BRIEF, PERMISSIONS.APPROVE_UGC, PERMISSIONS.MANAGE_CREATORS] },
  { label: 'Analytics', permissions: [PERMISSIONS.VIEW_ANALYTICS, PERMISSIONS.EXPORT_DATA] },
  { label: 'Inbox', permissions: [PERMISSIONS.VIEW_INBOX, PERMISSIONS.REPLY_INBOX, PERMISSIONS.ASSIGN_INBOX] },
  { label: 'Team Management', permissions: [PERMISSIONS.INVITE_MEMBERS, PERMISSIONS.REMOVE_MEMBERS, PERMISSIONS.MANAGE_ROLES] },
  { label: 'Settings', permissions: [PERMISSIONS.MANAGE_BILLING, PERMISSIONS.MANAGE_CHANNELS, PERMISSIONS.MANAGE_BRANDS, PERMISSIONS.MANAGE_INTEGRATIONS, PERMISSIONS.VIEW_AUDIT_LOG] },
  { label: 'AI', permissions: [PERMISSIONS.USE_AI, PERMISSIONS.APPROVE_AI_CONTENT] },
]

export function hasPermission(userPermissions: string[], permission: Permission): boolean {
  return userPermissions.includes(permission)
}

export function getDefaultPermissions(role: string): Permission[] {
  return ROLE_PERMISSIONS[role] ?? []
}
