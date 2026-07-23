export type ShellSurface =
  | 'creator' | 'business' | 'brand' | 'agency' | 'supplier'
  | 'affiliate' | 'publisher' | 'portal-client' | 'portal-creator'
  | 'portal-buyer' | 'public-marketplace' | 'public-link' | 'admin'

export type ShellNavItem = {
  id: string
  label: string
  tabs: string[]
  detailTabs?: string[]
  wizard?: string[]
}

export type ShellGroup = { label: string; items: ShellNavItem[] }

export type ShellConfig = {
  label: string
  description: string
  role: string
  groups: ShellGroup[]
  mobile: string[]
  profileLabel: string
}

const campaignDetailTabs = ['Overview', 'Brief', 'Content', 'Tasks', 'Budget', 'Assets', 'Results', 'Audit']
const contentDetailTabs = ['Editor', 'Variants', 'Approvals', 'Schedule', 'Performance', 'Versions', 'Rights']
const orderDetailTabs = ['Scope', 'Messages', 'Milestones', 'Deliveries', 'Rights', 'Payment', 'Dispute', 'Audit']

const coreCampaignGroups: ShellGroup[] = [
  { label: 'Command', items: [{ id: 'home', label: 'Home', tabs: ['Overview', 'Approvals', 'Ideas'] }] },
  { label: 'Plan', items: [
    { id: 'campaigns', label: 'Campaigns', tabs: ['All campaigns', 'Giveaways', 'Competitions', 'Templates'], detailTabs: campaignDetailTabs, wizard: ['Goal', 'Audience', 'Channels', 'Deliverables', 'Dates', 'Budget', 'Approvals', 'Review'] },
    { id: 'calendar', label: 'Calendar', tabs: ['Calendar', 'Publishing Queue'], detailTabs: ['Content', 'Channel variants', 'Approval', 'Delivery log', 'History'], wizard: ['Channel', 'Variant', 'Date and time', 'Compliance', 'Preview', 'Queue'] },
  ] },
  { label: 'Create', items: [
    { id: 'studio', label: 'Studio', tabs: ['Compose', 'AI Generate', 'Ideas', 'Templates', 'Hashtags', 'Media Library'], detailTabs: contentDetailTabs, wizard: ['Format', 'Brief', 'Create or import', 'Edit', 'Brand and rights', 'Approval', 'Save'] },
    { id: 'links', label: 'Link in Bio', tabs: ['Pages', 'Links', 'Themes', 'Analytics'], detailTabs: ['Design', 'Links', 'Products', 'Pixels', 'Analytics'], wizard: ['Identity', 'Theme', 'Links', 'Tracking', 'Preview', 'Publish'] },
  ] },
  { label: 'Promote', items: [
    { id: 'social', label: 'Social', tabs: ['Publishing', 'Engagement', 'Listening', 'Channel Connections'], detailTabs: ['Overview', 'Posts', 'Audience', 'Scopes', 'Health', 'Logs'], wizard: ['Provider', 'Authenticate', 'Profile', 'Permissions', 'Test', 'Enable'] },
    { id: 'marketplace', label: 'Marketplace', tabs: ['Discover', 'Categories', 'Saved Suppliers', 'Requests', 'Orders'], detailTabs: ['Overview', 'Services', 'Portfolio', 'Reviews', 'Policies'], wizard: ['Need', 'Budget and timing', 'Shortlist', 'Brief', 'Review', 'Submit'] },
  ] },
  { label: 'Engage', items: [{ id: 'inbox', label: 'Inbox', tabs: ['Unified inbox', 'Assignments', 'Saved views'], detailTabs: ['Conversation', 'Contact', 'Activity', 'Tasks', 'Internal notes'] }] },
  { label: 'Measure', items: [{ id: 'analytics', label: 'Analytics', tabs: ['Overview', 'Content', 'Audience', 'Competitors', 'Reports', 'Attribution'], detailTabs: ['Dashboard', 'Sources', 'Methodology', 'Exports', 'Schedule'], wizard: ['Goal', 'Metrics', 'Dimensions', 'Filters', 'Layout', 'Sharing'] }] },
  { label: 'Manage', items: [{ id: 'settings', label: 'Settings', tabs: ['Workspace', 'Channels', 'People', 'Billing', 'Account', 'Data and governance'] }] },
]

function cloneGroups(groups: ShellGroup[]) { return groups.map(group => ({ ...group, items: group.items.map(item => ({ ...item, tabs: [...item.tabs], detailTabs: item.detailTabs ? [...item.detailTabs] : undefined, wizard: item.wizard ? [...item.wizard] : undefined })) })) }

function insert(groups: ShellGroup[], groupLabel: string, items: ShellNavItem[]) {
  const group = groups.find(item => item.label === groupLabel)
  if (group) group.items.push(...items)
}

function campaignConfig(label: string, role: string, additions: (groups: ShellGroup[]) => void, mobile = ['home', 'studio', 'calendar', 'inbox']): ShellConfig {
  const groups = cloneGroups(coreCampaignGroups)
  additions(groups)
  return { label, role, description: 'Development-only Caption Fox workspace shell with deterministic fixtures.', groups, mobile, profileLabel: `${label} profile` }
}

export const shellConfigs: Record<ShellSurface, ShellConfig> = {
  creator: campaignConfig('Creator workspace', 'Creator', groups => {
    insert(groups, 'Promote', [{ id: 'creator-profile', label: 'Creator Profile', tabs: ['Profile', 'Portfolio', 'Rates', 'Availability', 'Media Kit'], detailTabs: ['Profile', 'Portfolio', 'Rates', 'Channels', 'Payments'] }])
  }),
  business: campaignConfig('Business workspace', 'Business owner', groups => {
    insert(groups, 'Plan', [{ id: 'strategy', label: 'Strategy', tabs: ['Objectives', 'Audiences', 'Research', 'Positioning', 'Plans', 'Forecasts'], detailTabs: ['Overview', 'Messages', 'Budget', 'Risks', 'Campaigns', 'Audit'], wizard: ['Objective', 'Audience', 'Insight', 'Positioning', 'Channels', 'Budget', 'Review'] }])
    insert(groups, 'Create', [{ id: 'brand', label: 'Brand & Assets', tabs: ['Brand Kits', 'Asset Library', 'Rights', 'Product Library'], detailTabs: ['Identity', 'Rules', 'Assets', 'Versions', 'Usage'] }])
    insert(groups, 'Promote', [{ id: 'messaging', label: 'Messaging', tabs: ['Email', 'SMS', 'WhatsApp', 'RCS', 'Push', 'Journeys', 'Templates'], detailTabs: ['Content', 'Audience', 'Flow', 'Conversions', 'Deliverability', 'Audit'], wizard: ['Channel', 'Audience', 'Content', 'Personalisation', 'Test', 'Review', 'Activate'] }, { id: 'web', label: 'Web & Conversion', tabs: ['Landing Pages', 'Forms', 'Funnels', 'Experiments', 'Tracking'], detailTabs: ['Builder', 'Variants', 'Forms', 'Analytics', 'Settings'] }])
    insert(groups, 'Engage', [{ id: 'audiences', label: 'Leads & Audiences', tabs: ['Contacts', 'Segments', 'Consent', 'Scoring', 'Imports'], detailTabs: ['Profile', 'Activity', 'Memberships', 'Consent', 'Score', 'Journeys'] }])
  }),
  brand: campaignConfig('Brand workspace', 'Brand marketer', groups => {
    insert(groups, 'Plan', [{ id: 'strategy', label: 'Strategy', tabs: ['Objectives', 'Audiences', 'Research', 'Positioning', 'Plans', 'Forecasts'] }])
    insert(groups, 'Create', [{ id: 'brand', label: 'Brand & Assets', tabs: ['Brand Kits', 'Asset Library', 'Rights', 'Product Library'] }])
    insert(groups, 'Promote', [{ id: 'advertising', label: 'Advertising', tabs: ['Accounts', 'Campaigns', 'Creatives', 'Audiences', 'Reports'], detailTabs: ['Overview', 'Targeting', 'Creatives', 'Budget', 'Placements', 'Results', 'Change log'] }, { id: 'messaging', label: 'Messaging', tabs: ['Email', 'SMS', 'WhatsApp', 'RCS', 'Push', 'Journeys', 'Templates'] }, { id: 'seo', label: 'SEO & Discovery', tabs: ['Keywords', 'Content Briefs', 'Rankings', 'Local', 'AI Search', 'Backlinks'] }])
    groups.splice(4, 0, { label: 'Collaborate', items: [{ id: 'creators', label: 'Creators & UGC', tabs: ['Creators', 'Briefs', 'Submissions', 'Rights', 'Payments'], detailTabs: ['Profile', 'Campaigns', 'Content', 'Performance', 'Agreements', 'Payments'], wizard: ['Brief', 'Shortlist', 'Rights', 'Deliverables', 'Invite', 'Review'] }, { id: 'partnerships', label: 'Partnerships', tabs: ['Affiliates', 'Referrals', 'Ambassadors', 'Loyalty', 'Resellers', 'Co-marketing'] }, { id: 'reputation', label: 'PR & Reputation', tabs: ['Media Lists', 'Pitches', 'Press Room', 'Coverage', 'Reviews', 'Crisis'] }, { id: 'community', label: 'Community', tabs: ['Communities', 'Calendar', 'Moderation', 'Members', 'Advocacy'] }, { id: 'events', label: 'Events', tabs: ['Events', 'Webinars', 'Podcasts', 'Sponsorships', 'Follow-up'] }] })
    insert(groups, 'Engage', [{ id: 'audiences', label: 'Leads & Audiences', tabs: ['Contacts', 'Segments', 'Consent', 'Scoring', 'Imports'] }])
    insert(groups, 'Measure', [{ id: 'finance', label: 'Finance', tabs: ['Budgets', 'Purchase Orders', 'Costs', 'Invoices', 'Commissions', 'Profitability'] }])
    groups.splice(groups.length - 1, 0, { label: 'Operate', items: [{ id: 'automations', label: 'Automations', tabs: ['Workflows', 'Recipes', 'Runs', 'Connections', 'Logs'], detailTabs: ['Canvas', 'Trigger', 'Actions', 'Versions', 'Test', 'Runs', 'Logs', 'Settings'], wizard: ['Trigger', 'Conditions', 'Actions', 'Approvers', 'Test', 'Activate'] }] })
  }),
  agency: campaignConfig('Agency workspace', 'Agency owner', groups => {
    groups[0].items.push({ id: 'clients', label: 'Clients', tabs: ['All clients', 'Active', 'At risk', 'Archived'], detailTabs: ['Overview', 'Campaigns', 'Approvals', 'Reports', 'Files', 'Access'], wizard: ['Client details', 'Brands', 'Permissions', 'Portal', 'Review'] })
    insert(groups, 'Plan', [{ id: 'strategy', label: 'Strategy', tabs: ['Objectives', 'Audiences', 'Research', 'Positioning', 'Plans', 'Forecasts'] }])
    insert(groups, 'Create', [{ id: 'brand', label: 'Brand & Assets', tabs: ['Brand Kits', 'Asset Library', 'Rights', 'Product Library'] }, { id: 'templates', label: 'Shared Templates', tabs: ['Campaign', 'Content', 'Report', 'Brief'] }])
    insert(groups, 'Promote', [{ id: 'advertising', label: 'Advertising', tabs: ['Accounts', 'Campaigns', 'Creatives', 'Audiences', 'Reports'] }, { id: 'messaging', label: 'Messaging', tabs: ['Email', 'SMS', 'WhatsApp', 'RCS', 'Push', 'Journeys', 'Templates'] }, { id: 'web', label: 'Web & Conversion', tabs: ['Landing Pages', 'Forms', 'Funnels', 'Experiments', 'Tracking'] }, { id: 'seo', label: 'SEO & Discovery', tabs: ['Keywords', 'Content Briefs', 'Rankings', 'Local', 'AI Search', 'Backlinks'] }])
    groups.splice(4, 0, { label: 'Collaborate', items: [{ id: 'creators', label: 'Creators & UGC', tabs: ['Creators', 'Briefs', 'Submissions', 'Rights', 'Payments'] }, { id: 'partnerships', label: 'Partnerships', tabs: ['Affiliates', 'Referrals', 'Ambassadors', 'Loyalty', 'Resellers', 'Co-marketing'] }, { id: 'reputation', label: 'PR & Reputation', tabs: ['Media Lists', 'Pitches', 'Press Room', 'Coverage', 'Reviews', 'Crisis'] }, { id: 'community', label: 'Community', tabs: ['Communities', 'Calendar', 'Moderation', 'Members', 'Advocacy'] }, { id: 'events', label: 'Events', tabs: ['Events', 'Webinars', 'Podcasts', 'Sponsorships', 'Follow-up'] }] })
    insert(groups, 'Engage', [{ id: 'audiences', label: 'Leads & Audiences', tabs: ['Contacts', 'Segments', 'Consent', 'Scoring', 'Imports'] }, { id: 'client-approvals', label: 'Client Approvals', tabs: ['Pending', 'Approved', 'Changes requested'] }])
    insert(groups, 'Measure', [{ id: 'finance', label: 'Finance', tabs: ['Budgets', 'Purchase Orders', 'Costs', 'Invoices', 'Commissions', 'Profitability'] }, { id: 'client-reports', label: 'Client Reports', tabs: ['Scheduled', 'Shared', 'Drafts'] }])
    groups.splice(groups.length - 1, 0, { label: 'Operate', items: [{ id: 'automations', label: 'Automations', tabs: ['Workflows', 'Recipes', 'Runs', 'Connections', 'Logs'] }, { id: 'agency-operations', label: 'Agency Operations', tabs: ['Capacity', 'Utilisation', 'Margins', 'Workflow'] }] })
  }, ['home', 'clients', 'studio', 'calendar']),
  supplier: { label: 'Supplier workspace', role: 'Creative supplier', description: 'Development-only supplier workspace shell.', mobile: ['dashboard', 'orders', 'listings', 'messages'], profileLabel: 'Supplier shopfront', groups: [
    { label: 'Command', items: [{ id: 'dashboard', label: 'Dashboard', tabs: ['Overview', 'Tasks', 'Performance'] }] },
    { label: 'Shop', items: [{ id: 'shopfront', label: 'Shopfront & Profile', tabs: ['Public Profile', 'About', 'Portfolio', 'Policies', 'Verification'], detailTabs: ['Overview', 'Services', 'Portfolio', 'Reviews', 'Policies'], wizard: ['Identity', 'Categories', 'Profile', 'Portfolio', 'Policies', 'Verification'] }, { id: 'listings', label: 'Listings & Packages', tabs: ['Services', 'Packages', 'Add-ons', 'Availability'], detailTabs: ['Description', 'Scope', 'Pricing', 'Media', 'FAQs', 'Revisions', 'Performance'], wizard: ['Category', 'Service', 'Scope', 'Pricing', 'Delivery', 'Media', 'Policies', 'Publish'] }] },
    { label: 'Fulfil', items: [{ id: 'orders', label: 'Orders', tabs: ['New', 'Active', 'Delivered', 'Completed', 'Cancelled'], detailTabs: orderDetailTabs, wizard: ['Respond', 'Clarify scope', 'Quote', 'Terms', 'Review'] }, { id: 'deliveries', label: 'Deliveries', tabs: ['In progress', 'Awaiting approval', 'Revisions', 'Archive'], detailTabs: ['Files', 'Revisions', 'Rights', 'Acceptance', 'Activity'], wizard: ['Upload', 'Rights declaration', 'Submit', 'Revision', 'Acceptance'] }] },
    { label: 'Engage', items: [{ id: 'messages', label: 'Messages', tabs: ['All', 'Unread', 'Requests', 'Order threads'], detailTabs: ['Thread', 'Order context', 'Internal notes', 'Attachments'] }] },
    { label: 'Operate', items: [{ id: 'availability', label: 'Availability', tabs: ['Calendar', 'Capacity', 'Blackout dates', 'SLA'] }] },
    { label: 'Trust', items: [{ id: 'reviews', label: 'Reviews & Reputation', tabs: ['Reviews', 'Responses', 'Appeals'] }, { id: 'disputes', label: 'Disputes', tabs: ['Open', 'Evidence requested', 'Resolution', 'Closed'], detailTabs: ['Timeline', 'Messages', 'Evidence', 'Resolution', 'Audit'] }] },
    { label: 'Finance', items: [{ id: 'earnings', label: 'Earnings & Payouts', tabs: ['Balance', 'Statements', 'Payouts', 'Tax'], detailTabs: ['Line items', 'Fees', 'Status', 'Documents'] }] },
    { label: 'Measure', items: [{ id: 'analytics', label: 'Analytics', tabs: ['Shopfront', 'Listings', 'Orders', 'Conversion'] }] },
    { label: 'Manage', items: [{ id: 'settings', label: 'Settings', tabs: ['Team', 'Notifications', 'Integrations', 'Security'] }] },
  ] },
  affiliate: { label: 'Affiliate & Ambassador portal', role: 'Affiliate / ambassador', description: 'Development-only partner portal shell.', mobile: ['home', 'links', 'assets', 'earnings'], profileLabel: 'Partner profile', groups: [{ label: 'Partner', items: [{ id: 'home', label: 'Home', tabs: ['Overview', 'Announcements'] }, { id: 'programme', label: 'Programme', tabs: ['Overview', 'Terms', 'Rewards', 'Updates'], detailTabs: ['Terms', 'Assets', 'Links', 'Conversions', 'Commissions'] }, { id: 'links', label: 'Links & Codes', tabs: ['Links', 'Codes', 'QR codes'] }, { id: 'assets', label: 'Assets', tabs: ['Brand assets', 'Campaign assets', 'Templates'] }, { id: 'conversions', label: 'Conversions', tabs: ['All', 'Pending', 'Approved', 'Adjusted'] }, { id: 'earnings', label: 'Commissions', tabs: ['Balance', 'Statements', 'Payouts'] }, { id: 'support', label: 'Support', tabs: ['Messages', 'Help', 'Tickets'] }, { id: 'profile', label: 'Profile & Settings', tabs: ['Profile', 'Tax', 'Payouts', 'Security'] }] }] },
  publisher: { label: 'Publisher & media partner portal', role: 'Publisher / media partner', description: 'Development-only publisher portal shell.', mobile: ['home', 'opportunities', 'placements', 'profile'], profileLabel: 'Media partner profile', groups: [{ label: 'Partner', items: [{ id: 'home', label: 'Home', tabs: ['Overview', 'Alerts'] }, { id: 'opportunities', label: 'Opportunities', tabs: ['Available', 'Applied', 'Won', 'Closed'], detailTabs: ['Overview', 'Brief', 'Audience', 'Proposal', 'Messages'] }, { id: 'media-kit', label: 'Media Kit', tabs: ['Audience', 'Placements', 'Rates', 'Portfolio'] }, { id: 'placements', label: 'Placements', tabs: ['Upcoming', 'Live', 'Delivered', 'Reporting'], detailTabs: ['Scope', 'Deliverables', 'Files', 'Report', 'Payment'] }, { id: 'deliveries', label: 'Deliveries', tabs: ['Drafts', 'Submitted', 'Approved'] }, { id: 'reports', label: 'Reports', tabs: ['Performance', 'Exports'] }, { id: 'profile', label: 'Profile & Settings', tabs: ['Profile', 'Team', 'Payouts', 'Security'] }] }] },
  'portal-client': { label: 'Client & approval portal', role: 'External client / approver', description: 'Development-only restricted client portal shell.', mobile: ['home', 'approvals', 'calendar', 'messages'], profileLabel: 'Client portal profile', groups: [{ label: 'Client portal', items: [{ id: 'home', label: 'Home', tabs: ['Overview', 'Activity'] }, { id: 'approvals', label: 'Approvals', tabs: ['Pending', 'Approved', 'Changes requested'], detailTabs: ['Preview', 'Feedback', 'Version history'] }, { id: 'calendar', label: 'Calendar', tabs: ['Schedule', 'Timeline'] }, { id: 'deliverables', label: 'Deliverables', tabs: ['Current', 'Approved', 'Archive'] }, { id: 'reports', label: 'Reports', tabs: ['Shared reports', 'Exports'] }, { id: 'files', label: 'Files', tabs: ['Brand assets', 'Campaign files', 'Contracts'] }, { id: 'messages', label: 'Messages', tabs: ['All', 'Unread'] }, { id: 'settings', label: 'Settings', tabs: ['Profile', 'Notifications', 'Access'] }] }] },
  'portal-creator': { label: 'Creator & influencer portal', role: 'Invited creator', description: 'Development-only restricted creator portal shell.', mobile: ['home', 'opportunities', 'deliverables', 'profile'], profileLabel: 'Creator portal profile', groups: [{ label: 'Creator portal', items: [{ id: 'home', label: 'Home', tabs: ['Overview', 'Tasks'] }, { id: 'opportunities', label: 'Opportunities', tabs: ['Available', 'Applied', 'Active', 'Closed'] }, { id: 'briefs', label: 'Briefs', tabs: ['Active', 'Upcoming', 'Archive'], detailTabs: ['Overview', 'Requirements', 'Submissions', 'Feedback', 'Rights', 'Payment'] }, { id: 'deliverables', label: 'Deliverables', tabs: ['Drafts', 'Submitted', 'Revisions', 'Accepted'] }, { id: 'rights', label: 'Rights', tabs: ['Pending', 'Active', 'Expired'] }, { id: 'payments', label: 'Payments', tabs: ['Pending', 'Paid', 'Statements'] }, { id: 'profile', label: 'Profile & Settings', tabs: ['Profile', 'Portfolio', 'Channels', 'Tax', 'Security'] }] }] },
  'portal-buyer': { label: 'Buyer order portal', role: 'Marketplace buyer', description: 'Development-only marketplace buyer portal shell.', mobile: ['home', 'requests', 'orders', 'messages'], profileLabel: 'Buyer portal profile', groups: [{ label: 'Buyer portal', items: [{ id: 'home', label: 'Home', tabs: ['Overview', 'Tasks'] }, { id: 'requests', label: 'Requests & Quotes', tabs: ['Drafts', 'Open', 'Quoted', 'Closed'] }, { id: 'orders', label: 'Orders', tabs: ['Active', 'Awaiting delivery', 'Completed', 'Disputed'], detailTabs: orderDetailTabs }, { id: 'deliveries', label: 'Deliveries', tabs: ['Awaiting review', 'Accepted', 'Revisions'] }, { id: 'payments', label: 'Payments', tabs: ['Authorisations', 'Statements', 'Refunds'] }, { id: 'disputes', label: 'Disputes', tabs: ['Open', 'Resolved'] }, { id: 'messages', label: 'Messages', tabs: ['All', 'Unread'] }, { id: 'settings', label: 'Settings', tabs: ['Profile', 'Notifications', 'Access'] }] }] },
  'public-marketplace': { label: 'Public marketplace', role: 'Anonymous visitor', description: 'Development-only public discovery shell.', mobile: ['discover', 'categories', 'saved', 'account'], profileLabel: 'Public supplier profile', groups: [{ label: 'Marketplace', items: [{ id: 'discover', label: 'Discover', tabs: ['Featured', 'For you', 'Recently viewed'] }, { id: 'search', label: 'Supplier Search', tabs: ['All suppliers', 'Services', 'Locations', 'Verified'] }, { id: 'categories', label: 'Categories', tabs: ['Content', 'Design', 'Media', 'Advertising', 'Events', 'Local marketing'] }, { id: 'saved', label: 'Saved Suppliers', tabs: ['Shortlist', 'Compare'] }, { id: 'how-it-works', label: 'How it works', tabs: ['For buyers', 'For suppliers', 'Trust and safety'] }] }] },
  'public-link': { label: 'Public campaign & link page', role: 'Anonymous visitor', description: 'Development-only public campaign shell.', mobile: ['home', 'offers', 'about', 'contact'], profileLabel: 'Public campaign page', groups: [{ label: 'Public page', items: [{ id: 'home', label: 'Home', tabs: ['Overview'] }, { id: 'offers', label: 'Offers', tabs: ['Featured', 'All offers'] }, { id: 'about', label: 'About', tabs: ['Story', 'Social proof'] }, { id: 'contact', label: 'Contact', tabs: ['Enquiry', 'Preferences', 'Privacy'] }] }] },
  admin: { label: 'Platform Admin', role: 'Platform administrator', description: 'Development-only platform operations shell.', mobile: ['dashboard', 'workspaces', 'users', 'support'], profileLabel: 'Admin profile', groups: [
    { label: 'Command', items: [{ id: 'dashboard', label: 'Dashboard', tabs: ['Health', 'Queues', 'Incidents', 'Usage'] }] },
    { label: 'Tenants', items: [{ id: 'workspaces', label: 'Workspaces', tabs: ['All', 'Trials', 'Suspended', 'Risk'], detailTabs: ['Overview', 'Members', 'Plan', 'Usage', 'Connections', 'Billing', 'Audit'], wizard: ['Workspace', 'Owner', 'Entitlements', 'Review'] }, { id: 'users', label: 'Users', tabs: ['All', 'Admins', 'Risk review'], detailTabs: ['Profile', 'Memberships', 'Security', 'Usage', 'Support history', 'Audit'] }] },
    { label: 'Marketplace', items: [{ id: 'suppliers', label: 'Suppliers & Marketplace Ops', tabs: ['Suppliers', 'Listings', 'Orders', 'Verification', 'Payouts', 'Disputes'], detailTabs: ['Identity', 'Shopfront', 'Risk', 'Orders', 'Payments', 'Audit'] }] },
    { label: 'Product', items: [{ id: 'billing', label: 'Plans, Billing & Entitlements', tabs: ['Plans', 'Subscriptions', 'Invoices', 'Usage', 'Coupons'] }, { id: 'ai', label: 'Content, AI & Safety', tabs: ['Generation', 'Moderation', 'Prompts', 'Usage', 'Flags'] }, { id: 'connections', label: 'Connections & Webhooks', tabs: ['Providers', 'Tenant connections', 'Webhook events', 'Health'] }] },
    { label: 'Operations', items: [{ id: 'automation-ops', label: 'Automations Operations', tabs: ['Runs', 'Failures', 'Queues', 'Recipes'] }, { id: 'support', label: 'Support & Disputes', tabs: ['Tickets', 'Marketplace disputes', 'Incidents', 'Macros'], detailTabs: ['Conversation', 'Tenant context', 'Evidence', 'Actions', 'Audit'] }] },
    { label: 'Governance', items: [{ id: 'compliance', label: 'Compliance & Data', tabs: ['Reports', 'Consent', 'Retention', 'Exports', 'Legal holds'] }, { id: 'flags', label: 'Feature Flags & Releases', tabs: ['Flags', 'Cohorts', 'Experiments', 'Releases'] }] },
    { label: 'Observe', items: [{ id: 'platform-analytics', label: 'Platform Analytics', tabs: ['Growth', 'Revenue', 'Activation', 'Reliability'] }, { id: 'audit', label: 'Audit Logs & System Settings', tabs: ['Audit', 'Configuration', 'Jobs', 'Security'] }] },
  ] },
}

export const jamahlFixtures = Object.entries(shellConfigs).map(([surface, config]) => ({
  id: `demo-${surface}`,
  surface: surface as ShellSurface,
  name: `Jamahl ${config.label.replace(' workspace', '').replace('Platform ', '')}`,
  ownerEmail: 'jamahlthomas1996@gmail.com',
  subscription: surface === 'admin' ? 'Internal' : 'Shell demo',
  onboarding: 'Complete (fixture)',
}))

export function getShellItem(config: ShellConfig, id?: string) {
  return config.groups.flatMap(group => group.items).find(item => item.id === id) ?? config.groups[0]?.items[0]
}
