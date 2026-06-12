import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// ─── Types ────────────────────────────────────────────────────────────────────

interface LinkPage {
  id: string
  slug: string
  title: string
  description: string | null
  avatar_url: string | null
  background_type: 'color' | 'gradient' | 'image'
  background_value: string
  primary_color: string
  button_style: 'square' | 'rounded' | 'pill'
  button_color: string
  button_text_color: string
  font_family: string
  show_caption_fox_branding: boolean
  total_views: number
  is_active: boolean
}

interface LinkItem {
  id: string
  item_type: 'link' | 'header' | 'divider' | 'social' | 'video' | 'image' | 'text'
  title: string | null
  url: string | null
  thumbnail_url: string | null
  icon: string | null
  sort_order: number
  is_active: boolean
  click_count: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fontStyle(family: string): React.CSSProperties {
  switch (family) {
    case 'mono': return { fontFamily: "'Courier New', Courier, monospace" }
    case 'playfair': return { fontFamily: "'Georgia', 'Times New Roman', serif" }
    case 'poppins': return { fontFamily: "'Trebuchet MS', sans-serif" }
    default: return { fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }
  }
}

function btnBorderRadius(style: LinkPage['button_style']): string {
  switch (style) {
    case 'pill': return '9999px'
    case 'square': return '0px'
    default: return '12px'
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function PublicLinkPage({ params }: { params: { slug: string } }) {
  const supabase = await createClient()

  // Fetch the link page
  const { data: linkPage } = await supabase
    .from('link_pages')
    .select('*')
    .eq('slug', params.slug)
    .single()

  if (!linkPage) notFound()
  if (!linkPage.is_active) notFound()

  // Fetch active items ordered by sort_order
  const { data: items } = await supabase
    .from('link_page_items')
    .select('*')
    .eq('page_id', linkPage.id)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  // Increment total_views (fire-and-forget)
  await supabase
    .from('link_pages')
    .update({ total_views: (linkPage.total_views ?? 0) + 1 })
    .eq('id', linkPage.id)

  const page = linkPage as LinkPage
  const activeItems = (items ?? []) as LinkItem[]

  const bgStyle: React.CSSProperties = page.background_type === 'gradient'
    ? { background: page.background_value }
    : page.background_type === 'image'
    ? { backgroundImage: `url(${page.background_value})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { backgroundColor: page.background_value }

  const radius = btnBorderRadius(page.button_style)
  const font = fontStyle(page.font_family)

  return (
    <html lang="en">
      <head>
        <title>{page.title}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content={page.description ?? `${page.title} — Link in Bio`} />
        <meta property="og:title" content={page.title} />
        {page.description && <meta property="og:description" content={page.description} />}
        {page.avatar_url && <meta property="og:image" content={page.avatar_url} />}
      </head>
      <body style={{ margin: 0, padding: 0, minHeight: '100vh', ...bgStyle }}>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            ...bgStyle,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '440px',
              margin: '0 auto',
              padding: '48px 20px 32px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
              ...font,
            }}
          >
            {/* Avatar */}
            <div
              style={{
                width: '72px',
                height: '72px',
                borderRadius: '50%',
                border: '3px solid rgba(255,255,255,0.25)',
                backgroundColor: page.primary_color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                color: '#fff',
                fontWeight: 700,
                fontSize: '24px',
                flexShrink: 0,
              }}
            >
              {page.avatar_url
                ? <img src={page.avatar_url} alt={page.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : page.title.charAt(0).toUpperCase()
              }
            </div>

            {/* Title */}
            <h1 style={{ color: '#fff', fontWeight: 700, fontSize: '20px', textAlign: 'center', margin: 0 }}>
              {page.title}
            </h1>

            {/* Description */}
            {page.description && (
              <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '14px', textAlign: 'center', margin: 0, lineHeight: 1.5 }}>
                {page.description}
              </p>
            )}

            {/* Links */}
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
              {activeItems.map(item => {
                if (item.item_type === 'divider') {
                  return (
                    <div key={item.id} style={{ width: '100%', height: '1px', backgroundColor: 'rgba(255,255,255,0.15)' }} />
                  )
                }

                if (item.item_type === 'header') {
                  return (
                    <p
                      key={item.id}
                      style={{
                        color: 'rgba(255,255,255,0.6)',
                        fontSize: '11px',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        textAlign: 'center',
                        margin: '8px 0 0',
                      }}
                    >
                      {item.title}
                    </p>
                  )
                }

                if (item.item_type === 'text') {
                  return (
                    <p
                      key={item.id}
                      style={{ color: 'rgba(255,255,255,0.65)', fontSize: '13px', textAlign: 'center', margin: 0, lineHeight: 1.5 }}
                    >
                      {item.title}
                    </p>
                  )
                }

                // link, video, social, image
                return (
                  <a
                    key={item.id}
                    href={item.url ?? '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '100%',
                      padding: '14px 20px',
                      backgroundColor: page.button_color,
                      color: page.button_text_color,
                      borderRadius: radius,
                      fontWeight: 600,
                      fontSize: '15px',
                      textDecoration: 'none',
                      textAlign: 'center',
                      boxSizing: 'border-box',
                      transition: 'opacity 0.15s',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = '0.88' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = '1' }}
                  >
                    {item.title ?? 'Visit'}
                  </a>
                )
              })}
            </div>

            {/* Branding */}
            {page.show_caption_fox_branding && (
              <div style={{ marginTop: 'auto', paddingTop: '40px', textAlign: 'center' }}>
                <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '12px', margin: 0 }}>
                  Made with{' '}
                  <a
                    href="/"
                    style={{ color: 'rgba(255,255,255,0.4)', textDecoration: 'none', fontWeight: 600 }}
                  >
                    Caption Fox
                  </a>
                </p>
              </div>
            )}
          </div>
        </div>
      </body>
    </html>
  )
}

export const dynamic = 'force-dynamic'
