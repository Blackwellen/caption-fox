import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/marketing-links'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/app/', '/admin/', '/admin-login', '/api/', '/onboarding', '/supplier/', '/shell', '/callback', '/mfa', '/reset-password', '/verify-email'] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
