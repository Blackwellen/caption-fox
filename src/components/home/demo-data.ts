/**
 * ILLUSTRATIVE UI DATA — public homepage only.
 *
 * Every record in this module is fictional demonstration content used to render
 * lightweight reconstructions of the Caption Fox product on the marketing site.
 * None of it is customer data, customer performance, or a claim about results.
 * Analytics values are rendered with a visible "Sample data" label wherever they
 * appear. Keep all illustrative numbers here rather than scattering them across
 * components.
 */

export type Tone = 'blue' | 'green' | 'amber' | 'red' | 'violet' | 'slate'

export interface DemoPerson {
  initials: string
  name: string
  hue: number
  /** Synthetic portrait cropped from the approved (AI-generated) design references — not a real person. */
  photo: string
}

export const PEOPLE: Record<string, DemoPerson> = {
  sophie: { initials: 'SR', name: 'Sophie R.', hue: 18, photo: '/home-v2/p-priya-lg.webp' },
  james: { initials: 'JT', name: 'James T.', hue: 205, photo: '/home-v2/p-james.webp' },
  priya: { initials: 'PM', name: 'Priya M.', hue: 330, photo: '/home-v2/p-priya.webp' },
  sarah: { initials: 'SC', name: 'Sarah C.', hue: 28, photo: '/home-v2/p-sarah.webp' },
  mike: { initials: 'MV', name: 'Mike V.', hue: 190, photo: '/home-v2/p-mike.webp' },
  ana: { initials: 'AL', name: 'Ana L.', hue: 150, photo: '/home-v2/m-hero-portrait.webp' },
  tom: { initials: 'TB', name: 'Tom B.', hue: 250, photo: '/home-v2/p-tom.webp' },
  dan: { initials: 'DK', name: 'Dan K.', hue: 220, photo: '/home-v2/p-sophie.webp' },
}

export const TEAM = [PEOPLE.sarah, PEOPLE.mike, PEOPLE.sophie]

/* ── Section 01 · Marketing OS map ─────────────────────────────────────── */
export const HERO_MAP = {
  plan: { campaign: 'Q2 Brand Campaign', state: 'Brief approved', audience: 'Core audience', audienceDetail: 'Gen Z + Millennials' },
  create: { title: 'Summer Drop', meta: 'Video · 0:28', state: '2 awaiting review', extra: '+3' },
  approve: { rows: [{ label: 'Content review', done: true }, { label: 'Brand compliance', done: true }, { label: 'Final approval', done: false }], state: 'In review' },
  launch: { rows: [{ label: 'Social', state: 'Scheduled' }, { label: 'Email', state: 'Scheduled' }, { label: 'Web', state: 'Scheduled' }] },
  engage: {
    rows: [
      { handle: '@sarahcreates', text: 'This looks amazing!', time: '2m', person: PEOPLE.sarah },
      { handle: '@mike.visuals', text: 'Can we get the raw file?', time: '12m', person: PEOPLE.mike },
    ],
    summary: '12 new creator messages',
  },
  measure: {
    bars: [38, 52, 66, 82, 100],
    metrics: [{ label: 'Reach', delta: '24%' }, { label: 'Engagement', delta: '18%' }, { label: 'Conversions', delta: '32%' }],
  },
}

/* ── Section 02 · Operating loop ───────────────────────────────────────── */
export const LOOP = {
  brief: { name: 'Summer product launch', detail: 'Build awareness and drive signups across key channels.', goal: 'Brand awareness' },
  studio: { formats: ['Post', 'Video', 'Image', 'Story'], asset: 'Product launch video', duration: '0:30', kit: 'Caption Fox' },
  review: { asset: 'Summer launch video', version: 'v1.2 · Updated 2h ago', comment: 'Looks great! Can we try a shorter version for TikTok?', reviewers: 2, pending: 2 },
  queue: [
    { channel: 'instagram', label: 'Instagram', when: 'Mon 10 Nov, 10:00', state: 'Scheduled' },
    { channel: 'tiktok', label: 'TikTok', when: 'Mon 10 Nov, 12:00', state: 'Scheduled' },
    { channel: 'linkedin', label: 'LinkedIn', when: 'Mon 10 Nov, 14:00', state: 'Ready' },
    { channel: 'email', label: 'Email', when: 'Mon 11 Nov, 09:00', state: 'Draft' },
    { channel: 'web', label: 'Website', when: 'Mon 11 Nov, 11:00', state: 'Ready' },
  ],
  inbox: [
    { person: PEOPLE.sophie, time: '2m ago', text: 'This looks amazing! Can’t wait for the launch!', unread: true },
    { person: PEOPLE.james, time: '12m ago', text: 'Do you offer a creator program?', unread: true },
    { person: PEOPLE.priya, time: '1h ago', text: 'Love the new product! Any discount codes?', unread: false },
  ],
  performance: {
    bars: [10, 22, 34, 46, 40, 58, 64, 88],
    line: [72, 60, 64, 44, 50, 30, 22, 6],
    callout: '+42%',
    stats: [{ label: 'Reach', value: '245K' }, { label: 'Engagements', value: '12.4K' }, { label: 'Link clicks', value: '2.8K' }, { label: 'Conversion rate', value: '8.1%' }],
  },
}

/* ── Section 03 · Operating layers ─────────────────────────────────────── */
export const LAYERS = {
  opsStatus: [
    { value: '24', label: 'On track', detail: 'Campaigns progressing', tone: 'green' as Tone },
    { value: '6', label: 'Awaiting approval', detail: 'Items in review', tone: 'amber' as Tone },
    { value: '8', label: 'Due this week', detail: 'Scheduled to publish', tone: 'blue' as Tone },
  ],
  segments: ['Existing customers', 'High intent', 'UK'],
  performanceBars: [20, 42, 30, 58, 70, 94, 40, 78],
  performanceDelta: '+42%',
}

/* ── Section 04 · Platform grid ────────────────────────────────────────── */
export const PLATFORM = {
  campaign: { name: 'Spring Collection 2024', type: 'Product launch campaign', content: '12 / 15', channels: '4 / 5', milestone: 'Launch', milestoneDate: 'Mon 18 Mar', contentPct: 80, channelPct: 80 },
  channels: [
    { channel: 'instagram', label: 'Instagram', state: 'Scheduled', tone: 'blue' as Tone },
    { channel: 'tiktok', label: 'TikTok', state: '3 queued', tone: 'blue' as Tone },
    { channel: 'linkedin', label: 'LinkedIn', state: 'Publishing', tone: 'green' as Tone },
    { channel: 'email', label: 'Email', state: 'Ready', tone: 'blue' as Tone },
    { channel: 'web', label: 'Website', state: 'Live', tone: 'green' as Tone },
    { channel: 'ads', label: 'Advertising', state: '2 drafts', tone: 'slate' as Tone },
  ],
  creator: { name: 'Sophie Carter', niche: 'Lifestyle & Travel', followers: '128K followers', tags: ['Fashion', 'Travel', 'Lifestyle'], submission: 'Spring Collection', submissionMeta: 'Video · 28s · 1080 × 1920' },
  analytics: {
    kpis: [{ label: 'Total reach', value: '124K', delta: '12%' }, { label: 'Engagement rate', value: '4.8%', delta: '24%' }, { label: 'Conversions', value: '2.4K', delta: '18%' }],
    series: [
      { key: 'Instagram', color: '#1769FF', points: [22, 26, 24, 30, 34, 38, 36, 44, 48, 46] },
      { key: 'TikTok', color: '#E6409B', points: [14, 18, 17, 22, 24, 28, 27, 31, 32, 30] },
      { key: 'LinkedIn', color: '#8B5CF6', points: [10, 12, 13, 15, 18, 20, 21, 24, 28, 26] },
      { key: 'Email', color: '#38BDF8', points: [6, 8, 9, 10, 12, 13, 12, 15, 18, 17] },
      { key: 'Web', color: '#B7C2D3', points: [4, 5, 6, 6, 8, 9, 9, 10, 12, 11] },
    ],
    xLabels: ['1 Mar', '7 Mar', '14 Mar', '21 Mar', '28 Mar'],
    tooltipDate: '21 Mar',
  },
  automation: [
    { kind: 'Trigger', detail: 'New content approved' },
    { kind: 'Condition', detail: 'Channel is Instagram' },
    { kind: 'Action', detail: 'Schedule post' },
    { kind: 'Notify', detail: 'Send confirmation' },
  ],
}

/* ── Section 05 · Campaign command centre ──────────────────────────────── */
export const COMMAND = {
  name: 'Summer Product Launch',
  summary: 'Get our new collection in front of the right audience across all channels.',
  dates: '1 Mar – 30 Apr',
  chips: ['Product', 'Multi-channel', 'Global'],
  progress: { done: 6, total: 8 },
  steps: [
    { label: 'Campaign brief', state: 'Completed' },
    { label: 'Audience definition', state: 'Completed' },
    { label: 'Content production', state: 'In progress' },
    { label: 'Client approval', state: 'Pending' },
    { label: 'Publish to channels', state: 'Upcoming' },
    { label: 'Monitor & report', state: 'Upcoming' },
  ],
  nextUp: { title: 'Social creative review', detail: '3 assets awaiting approval', due: 'Fri, 22 Mar' },
  glance: [
    { label: 'Budget', value: 'On track', tone: 'green' as Tone },
    { label: 'Owner', value: 'Marketing team', tone: 'slate' as Tone },
    { label: 'Priority', value: 'High', tone: 'amber' as Tone },
    { label: 'Status', value: 'Active', tone: 'green' as Tone },
  ],
  publishing: [
    { channel: 'instagram', label: '3 posts', state: 'Scheduled', tone: 'green' as Tone },
    { channel: 'linkedin', label: '2 posts', state: 'Ready', tone: 'blue' as Tone },
    { channel: 'email', label: '1 campaign', state: 'Ready', tone: 'blue' as Tone },
    { channel: 'web', label: 'Landing page', state: 'Live', tone: 'green' as Tone },
  ],
  approvals: [
    { title: 'Social assets (3)', detail: 'Client review', state: 'Pending', tone: 'amber' as Tone },
    { title: 'Landing page', detail: 'Legal review', state: 'In review', tone: 'blue' as Tone },
  ],
  strategy: ['Campaign goals', 'Target audience', 'Market insights', 'Key messages'],
  audience: [{ name: 'Existing customers', size: 'Core' }, { name: 'High-intent visitors', size: 'Retarget' }, { name: 'UK lifestyle', size: 'Prospect' }],
  content: [
    { title: 'Product hero video', type: 'Video', state: 'In review', tone: 'amber' as Tone },
    { title: 'Behind the scenes', type: 'Image', state: 'Approved', tone: 'green' as Tone },
    { title: 'Launch carousel', type: 'Carousel', state: 'Scheduled', tone: 'blue' as Tone },
    { title: 'Launch email', type: 'Email', state: 'Draft', tone: 'slate' as Tone },
  ],
  calendar: [
    { day: 'Mon', date: '18', items: ['IG reel'] },
    { day: 'Tue', date: '19', items: [] },
    { day: 'Wed', date: '20', items: ['LinkedIn post', 'Email'] },
    { day: 'Thu', date: '21', items: ['TikTok'] },
    { day: 'Fri', date: '22', items: ['Review'] },
  ],
  budget: [{ label: 'Paid social', planned: 60, spent: 42 }, { label: 'Creators', planned: 30, spent: 18 }, { label: 'Production', planned: 10, spent: 9 }],
  results: { bars: [24, 32, 30, 44, 52, 60, 72], labels: ['Reach', 'Engagement', 'Clicks'] },
}

/* ── Section 06 · Fox AI ───────────────────────────────────────────────── */
export const FOX = {
  campaign: { name: 'Spring Product Launch', dates: '1 Mar – 30 Apr', content: '12 / 15', channels: '4 / 5', milestone: 'Content review', milestoneDate: 'Mon 24 Mar', budget: 'On track', budgetDetail: '72% remaining' },
  recent: [
    { title: 'Product hero video', tags: ['Video', 'Instagram'], state: 'In review', tone: 'amber' as Tone, thumb: 'product' as const },
    { title: 'Behind the scenes', tags: ['Image', 'LinkedIn'], state: 'Approved', tone: 'green' as Tone, thumb: 'portrait' as const },
    { title: 'Launch carousel', tags: ['Carousel', 'TikTok'], state: 'Scheduled', tone: 'green' as Tone, thumb: 'text' as const },
  ],
  timeline: [
    { label: 'Campaign brief', state: 'Completed', date: '12 Mar' },
    { label: 'Content production', state: 'In progress', date: '18 Mar' },
    { label: 'Internal review', state: 'Pending', date: '24 Mar' },
    { label: 'Publish to channels', state: 'Upcoming', date: '28 Mar' },
    { label: 'Measure & report', state: 'Upcoming', date: '30 Apr' },
  ],
  connected: [
    { channel: 'instagram', label: 'Instagram', connected: true },
    { channel: 'tiktok', label: 'TikTok', connected: true },
    { channel: 'linkedin', label: 'LinkedIn', connected: true },
    { channel: 'youtube', label: 'YouTube', connected: false },
    { channel: 'email', label: 'Email', connected: true },
    { channel: 'web', label: 'Website', connected: true },
  ],
  context: [
    { id: 'brief', label: 'Campaign brief', detail: 'Spring Product Launch' },
    { id: 'voice', label: 'Brand voice', detail: 'Modern, helpful, confident' },
    { id: 'audience', label: 'Target audience', detail: 'Creators, SMBs, UK' },
    { id: 'feedback', label: 'Recent feedback', detail: '3 comments' },
    { id: 'assets', label: 'Linked assets', detail: '12 files' },
  ],
  actions: [
    {
      id: 'compare',
      title: 'Compare content variants',
      detail: 'See which version fits each channel best',
      resultTitle: 'Here’s how the variants compare',
      result: ['Variant A — strongest for Instagram: visual-first, short hook.', 'Variant B — better for LinkedIn: leads with the product benefit.'],
      tags: ['Uses campaign brief', 'Uses linked assets'],
    },
    {
      id: 'draft',
      title: 'Draft a LinkedIn post',
      detail: 'Create on-brand copy from this campaign',
      resultTitle: 'Here’s a LinkedIn post draft',
      result: ['We’re excited to introduce our new collection — designed for what’s next. Built for creators, teams and growing brands.', 'Same creative power. More possibilities.'],
      tags: ['On-brand', 'Uses campaign brief', 'Tailored for LinkedIn'],
    },
    {
      id: 'summarise',
      title: 'Summarise feedback',
      detail: 'Turn recent comments into clear next steps',
      resultTitle: 'Feedback summary',
      result: ['Reviewers want a shorter TikTok cut (under 20s).', 'Client asked to feature the colourway earlier in the hero video.'],
      tags: ['Uses recent feedback'],
    },
  ],
}

/* ── Section 07 · Solutions + product proof ────────────────────────────── */
export const CAMPAIGN_ROWS = [
  { name: 'Summer Collection', type: 'Product launch', dates: '1 Mar – 30 Apr', state: 'Active', tone: 'green' as Tone, progress: 72, thumb: 'product' as const, channels: ['instagram', 'tiktok', 'linkedin', 'youtube'] },
  { name: 'Brand Awareness', type: 'Always on', dates: 'Ongoing', state: 'In review', tone: 'blue' as Tone, progress: 48, thumb: 'portrait' as const, channels: ['instagram', 'tiktok', 'linkedin', 'youtube'] },
  { name: 'Sustainability Story', type: 'Content series', dates: '1 Apr – 30 Jun', state: 'Planning', tone: 'slate' as Tone, progress: 25, thumb: 'mountain' as const, channels: ['instagram', 'tiktok', 'linkedin'] },
  { name: 'New Product Teaser', type: 'Teaser campaign', dates: '1 May – 15 May', state: 'Draft', tone: 'slate' as Tone, progress: 10, thumb: 'soft' as const, channels: ['instagram', 'tiktok', 'linkedin', 'youtube'] },
]

export const CLIENT_ROWS = [
  { name: 'Northwind Coffee', brands: 2, live: 4, approvals: 3, hue: 24 },
  { name: 'Lumen Skincare', brands: 1, live: 6, approvals: 1, hue: 330 },
  { name: 'Peak Outdoor Co.', brands: 3, live: 2, approvals: 5, hue: 150 },
  { name: 'Harbour Studios', brands: 1, live: 3, approvals: 0, hue: 215 },
]

export const PROOF = {
  keyDetails: [
    { label: 'Objective', value: 'Drive sales and brand awareness' },
    { label: 'Target audience', value: '18–34 · UK' },
    { label: 'Channels', value: 'Instagram, TikTok, YouTube, Email' },
    { label: 'Budget', value: '£25,000' },
  ],
  activity: [
    { person: PEOPLE.sophie, text: 'Content draft updated', time: '2h ago' },
    { person: PEOPLE.priya, text: 'Feedback added', time: '5h ago' },
    { person: PEOPLE.ana, text: 'Media asset approved', time: '1d ago' },
    { person: PEOPLE.james, text: 'Launch date confirmed', time: '1d ago' },
  ],
  progress: { pct: 72, done: 6, total: 8 },
}
