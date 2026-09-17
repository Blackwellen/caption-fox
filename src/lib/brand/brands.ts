/**
 * Server-safe registry of third-party brands shown anywhere in Caption Fox.
 * Rendering lives in `@/components/brand/BrandLogo`.
 *
 * Every mark is the brand's own logo, used only to refer to that service:
 *  - `icon`:    official SVG from simple-icons (CC0), drawn in the brand colour.
 *  - `image`:   the brand's official favicon, self-hosted in `public/brands/`
 *               for brands whose owners asked simple-icons to remove their mark
 *               (LinkedIn, Microsoft, OpenAI, Ahrefs…).
 *  - `special`: marks whose official form needs more than one colour
 *               (Google's four-colour G, Instagram's gradient, TikTok's
 *               two-tone offset).
 */
import {
  siAnthropic, siApple, siBluesky, siClaude, siDiscord, siDropbox, siFacebook, siGmail, siGoogle, siGoogleads,
  siGoogleanalytics, siGooglecalendar, siGoogledrive, siGooglegemini, siGooglemaps, siGooglesearchconsole,
  siHubspot, siInstagram, siMailchimp, siMedium, siMessenger, siMeta, siPerplexity, siPinterest, siProducthunt,
  siQuickbooks, siQuora, siReddit, siResend, siSage, siSemrush, siShopify, siSnapchat, siStripe, siTechcrunch,
  siTelegram, siThreads, siTiktok, siTrustpilot, siTwitch, siWhatsapp, siWordpress, siX, siXero, siYelp,
  siYoutube, siZapier,
} from 'simple-icons'

export interface SimpleIcon { title: string; hex: string; path: string }

export type SpecialMark = 'google' | 'instagram' | 'tiktok'

export interface BrandEntry {
  label: string
  domain: string
  icon?: SimpleIcon
  image?: string
  special?: SpecialMark
  /** Tile background for marks that are invisible on white (Snapchat). */
  tileBg?: string
}

const img = (key: string) => `/brands/${key}.png`

export const BRANDS: Record<string, BrandEntry> = {
  // ── Search & AI engines ─────────────────────────────────────────────────
  google: { label: 'Google', domain: 'google.com', icon: siGoogle, special: 'google' },
  google_search_console: { label: 'Google Search Console', domain: 'search.google.com', icon: siGooglesearchconsole },
  google_business_profile: { label: 'Google Business Profile', domain: 'business.google.com', icon: siGoogle, special: 'google' },
  google_analytics: { label: 'Google Analytics', domain: 'analytics.google.com', icon: siGoogleanalytics },
  google_maps: { label: 'Google Maps', domain: 'maps.google.com', icon: siGooglemaps },
  google_ads: { label: 'Google Ads', domain: 'ads.google.com', icon: siGoogleads },
  google_calendar: { label: 'Google Calendar', domain: 'calendar.google.com', icon: siGooglecalendar },
  google_drive: { label: 'Google Drive', domain: 'drive.google.com', icon: siGoogledrive },
  gmail: { label: 'Gmail', domain: 'mail.google.com', icon: siGmail },
  google_sge: { label: 'Google SGE', domain: 'google.com', icon: siGoogle, special: 'google' },
  gemini: { label: 'Gemini', domain: 'gemini.google.com', icon: siGooglegemini },
  chatgpt: { label: 'ChatGPT', domain: 'chatgpt.com', image: img('chatgpt') },
  openai: { label: 'OpenAI', domain: 'openai.com', image: img('openai') },
  perplexity: { label: 'Perplexity', domain: 'perplexity.ai', icon: siPerplexity },
  claude: { label: 'Claude', domain: 'claude.ai', icon: siClaude },
  anthropic: { label: 'Anthropic', domain: 'anthropic.com', icon: siAnthropic },
  bing: { label: 'Bing', domain: 'bing.com', image: img('bing') },
  bing_places: { label: 'Bing Places', domain: 'bingplaces.com', image: img('bing') },
  bing_webmaster: { label: 'Bing Webmaster Tools', domain: 'bing.com', image: img('bing') },
  bing_copilot: { label: 'Bing Copilot', domain: 'copilot.microsoft.com', image: img('copilot') },
  copilot: { label: 'Microsoft Copilot', domain: 'copilot.microsoft.com', image: img('copilot') },
  apple_maps: { label: 'Apple Maps', domain: 'apple.com', icon: siApple },
  yelp: { label: 'Yelp', domain: 'yelp.com', icon: siYelp },
  trustpilot: { label: 'Trustpilot', domain: 'trustpilot.com', icon: siTrustpilot },

  // ── SEO data providers ──────────────────────────────────────────────────
  semrush: { label: 'Semrush', domain: 'semrush.com', icon: siSemrush },
  ahrefs: { label: 'Ahrefs', domain: 'ahrefs.com', image: img('ahrefs') },
  moz: { label: 'Moz', domain: 'moz.com', image: img('moz') },
  dataforseo: { label: 'DataForSEO', domain: 'dataforseo.com', image: img('dataforseo') },
  majestic: { label: 'Majestic', domain: 'majestic.com', image: img('majestic') },
  brightlocal: { label: 'BrightLocal', domain: 'brightlocal.com', image: img('brightlocal') },

  // ── Social networks & messaging ─────────────────────────────────────────
  instagram: { label: 'Instagram', domain: 'instagram.com', icon: siInstagram, special: 'instagram' },
  tiktok: { label: 'TikTok', domain: 'tiktok.com', icon: siTiktok, special: 'tiktok' },
  facebook: { label: 'Facebook', domain: 'facebook.com', icon: siFacebook },
  messenger: { label: 'Messenger', domain: 'messenger.com', icon: siMessenger },
  meta: { label: 'Meta', domain: 'meta.com', icon: siMeta },
  linkedin: { label: 'LinkedIn', domain: 'linkedin.com', image: img('linkedin') },
  youtube: { label: 'YouTube', domain: 'youtube.com', icon: siYoutube },
  x: { label: 'X', domain: 'x.com', icon: siX },
  twitter: { label: 'X', domain: 'x.com', icon: siX },
  pinterest: { label: 'Pinterest', domain: 'pinterest.com', icon: siPinterest },
  threads: { label: 'Threads', domain: 'threads.net', icon: siThreads },
  snapchat: { label: 'Snapchat', domain: 'snapchat.com', icon: siSnapchat, tileBg: '#FFFC00' },
  whatsapp: { label: 'WhatsApp', domain: 'whatsapp.com', icon: siWhatsapp },
  telegram: { label: 'Telegram', domain: 'telegram.org', icon: siTelegram },
  discord: { label: 'Discord', domain: 'discord.com', icon: siDiscord },
  twitch: { label: 'Twitch', domain: 'twitch.tv', icon: siTwitch },
  bluesky: { label: 'Bluesky', domain: 'bsky.app', icon: siBluesky },
  reddit: { label: 'Reddit', domain: 'reddit.com', icon: siReddit },

  // ── Ad platforms ────────────────────────────────────────────────────────
  microsoft: { label: 'Microsoft Advertising', domain: 'ads.microsoft.com', image: img('microsoft') },
  amazon: { label: 'Amazon Ads', domain: 'advertising.amazon.com', image: img('amazon') },
  yahoo: { label: 'Yahoo DSP', domain: 'yahoo.com', image: img('yahoo') },

  // ── Business tools ──────────────────────────────────────────────────────
  stripe: { label: 'Stripe', domain: 'stripe.com', icon: siStripe },
  xero: { label: 'Xero', domain: 'xero.com', icon: siXero },
  quickbooks: { label: 'QuickBooks', domain: 'quickbooks.intuit.com', icon: siQuickbooks },
  sage: { label: 'Sage', domain: 'sage.com', icon: siSage },
  freeagent: { label: 'FreeAgent', domain: 'freeagent.com', image: img('freeagent') },
  gocardless: { label: 'GoCardless', domain: 'gocardless.com', image: img('gocardless') },
  hubspot: { label: 'HubSpot', domain: 'hubspot.com', icon: siHubspot },
  salesforce: { label: 'Salesforce', domain: 'salesforce.com', image: img('salesforce') },
  mailchimp: { label: 'Mailchimp', domain: 'mailchimp.com', icon: siMailchimp },
  resend: { label: 'Resend', domain: 'resend.com', icon: siResend },
  twilio: { label: 'Twilio', domain: 'twilio.com', image: img('twilio') },
  slack: { label: 'Slack', domain: 'slack.com', image: img('slack') },
  outlook: { label: 'Outlook', domain: 'outlook.com', image: img('outlook') },
  dropbox: { label: 'Dropbox', domain: 'dropbox.com', icon: siDropbox },
  shopify: { label: 'Shopify', domain: 'shopify.com', icon: siShopify },
  wordpress: { label: 'WordPress', domain: 'wordpress.org', icon: siWordpress },
  canva: { label: 'Canva', domain: 'canva.com', image: img('canva') },
  zapier: { label: 'Zapier', domain: 'zapier.com', icon: siZapier },
  rightmove: { label: 'Rightmove', domain: 'rightmove.co.uk', image: img('rightmove') },
  zoopla: { label: 'Zoopla', domain: 'zoopla.co.uk', image: img('zoopla') },
}

/** Official vectors for well-known sites, so backlink and competitor rows use real marks. */
export const DOMAIN_BRANDS: Record<string, string> = {
  'google.com': 'google',
  'facebook.com': 'facebook',
  'instagram.com': 'instagram',
  'tiktok.com': 'tiktok',
  'youtube.com': 'youtube',
  'x.com': 'x',
  'twitter.com': 'x',
  'linkedin.com': 'linkedin',
  'pinterest.com': 'pinterest',
  'reddit.com': 'reddit',
  'yelp.com': 'yelp',
  'semrush.com': 'semrush',
  'ahrefs.com': 'ahrefs',
  'hubspot.com': 'hubspot',
  'zapier.com': 'zapier',
  'shopify.com': 'shopify',
  'wordpress.org': 'wordpress',
  'medium.com': 'medium',
  'quora.com': 'quora',
  'techcrunch.com': 'techcrunch',
  'producthunt.com': 'producthunt',
}

// Vectors referenced only through DOMAIN_BRANDS.
BRANDS.medium = { label: 'Medium', domain: 'medium.com', icon: siMedium }
BRANDS.quora = { label: 'Quora', domain: 'quora.com', icon: siQuora }
BRANDS.techcrunch = { label: 'TechCrunch', domain: 'techcrunch.com', icon: siTechcrunch }
BRANDS.producthunt = { label: 'Product Hunt', domain: 'producthunt.com', icon: siProducthunt }

export function brandLabel(key: string) {
  return BRANDS[key]?.label ?? key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export function rootDomain(value: string) {
  return value.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase()
}

export function hasBrand(key: string) {
  return key in BRANDS
}
