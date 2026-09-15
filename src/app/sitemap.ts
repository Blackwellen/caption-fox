import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/marketing-links'

const PUBLIC_ROUTES: { path: string; priority: number; changeFrequency: 'weekly' | 'monthly' | 'yearly' }[] = [
  { path: '/', priority: 1, changeFrequency: 'weekly' },
  { path: '/features', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/pricing', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/marketplace', priority: 0.7, changeFrequency: 'weekly' },
  { path: '/marketplace/sell', priority: 0.5, changeFrequency: 'monthly' },
  { path: '/about', priority: 0.5, changeFrequency: 'yearly' },
  { path: '/contact', priority: 0.5, changeFrequency: 'yearly' },
  { path: '/careers', priority: 0.4, changeFrequency: 'monthly' },
  { path: '/press', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/blog', priority: 0.6, changeFrequency: 'weekly' },
  { path: '/help', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/changelog', priority: 0.5, changeFrequency: 'weekly' },
  { path: '/roadmap', priority: 0.4, changeFrequency: 'monthly' },
  { path: '/status', priority: 0.3, changeFrequency: 'weekly' },
  { path: '/affiliates', priority: 0.4, changeFrequency: 'monthly' },
  { path: '/legal/privacy', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/legal/terms', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/legal/cookie-policy', priority: 0.2, changeFrequency: 'yearly' },
  { path: '/legal/dpa', priority: 0.2, changeFrequency: 'yearly' },
  { path: '/legal/acceptable-use', priority: 0.2, changeFrequency: 'yearly' },
]

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_ROUTES.map((r) => ({ url: `${SITE_URL}${r.path}`, changeFrequency: r.changeFrequency, priority: r.priority }))
}
