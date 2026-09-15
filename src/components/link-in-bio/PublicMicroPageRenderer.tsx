'use client'

// Shared renderer used by:
//   - the Link Page editor's live preview (Design tab)
//   - the Theme editor's live preview
//   - the real public page at /l/[slug]
// Keeping one renderer means the editor preview can never drift from what a
// visitor actually sees.

export interface RenderablePage {
  title: string
  description?: string | null
  avatar_url?: string | null
  background_type: 'color' | 'gradient' | 'image'
  background_value: string
  primary_color: string
  button_style: 'square' | 'rounded' | 'pill'
  button_color: string
  button_text_color: string
  font_family: string
  show_caption_fox_branding: boolean
}

export interface RenderableItem {
  id: string
  item_type: 'link' | 'header' | 'divider' | 'social' | 'video' | 'image' | 'text'
  title: string | null
  url: string | null
  is_active: boolean
  sort_order: number
}

export function fontStack(family: string): string {
  switch (family) {
    case 'mono': return "'Courier New', Courier, monospace"
    case 'playfair': return "'Georgia', 'Times New Roman', serif"
    case 'poppins': return "'Trebuchet MS', sans-serif"
    default: return "'Inter', 'Segoe UI', system-ui, sans-serif"
  }
}

export function buttonRadius(style: RenderablePage['button_style']): string {
  switch (style) {
    case 'pill': return '9999px'
    case 'square': return '0px'
    default: return '12px'
  }
}

export function backgroundStyle(page: Pick<RenderablePage, 'background_type' | 'background_value'>): React.CSSProperties {
  if (page.background_type === 'gradient') return { background: page.background_value }
  if (page.background_type === 'image') return { backgroundImage: `url(${page.background_value})`, backgroundSize: 'cover', backgroundPosition: 'center' }
  return { backgroundColor: page.background_value }
}

export function PublicMicroPageRenderer({
  page,
  items,
  onLinkClick,
  frameless = false,
}: {
  page: RenderablePage
  items: RenderableItem[]
  onLinkClick?: (item: RenderableItem) => void
  /** When true, renders without the outer full-bleed page wrapper (for embedding in editor panels). */
  frameless?: boolean
}) {
  const radius = buttonRadius(page.button_style)
  const font = fontStack(page.font_family)
  const activeItems = items.filter(i => i.is_active).sort((a, b) => a.sort_order - b.sort_order)

  const content = (
    <div
      style={{
        width: '100%',
        maxWidth: 440,
        margin: '0 auto',
        padding: frameless ? '28px 18px 24px' : '48px 20px 32px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        fontFamily: font,
      }}
    >
      <div
        style={{
          width: 72, height: 72, borderRadius: '50%',
          border: '3px solid rgba(255,255,255,0.25)',
          backgroundColor: page.primary_color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden', color: '#fff', fontWeight: 700, fontSize: 24, flexShrink: 0,
        }}
      >
        {page.avatar_url
          ? <img src={page.avatar_url} alt={page.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : (page.title || 'P').charAt(0).toUpperCase()}
      </div>

      <h1 style={{ color: '#fff', fontWeight: 700, fontSize: 20, textAlign: 'center', margin: 0 }}>
        {page.title || 'Untitled page'}
      </h1>

      {page.description && (
        <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14, textAlign: 'center', margin: 0, lineHeight: 1.5 }}>
          {page.description}
        </p>
      )}

      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
        {activeItems.map(item => {
          if (item.item_type === 'divider') {
            return <div key={item.id} style={{ width: '100%', height: 1, backgroundColor: 'rgba(255,255,255,0.15)' }} />
          }
          if (item.item_type === 'header') {
            return (
              <p key={item.id} style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'center', margin: '8px 0 0' }}>
                {item.title}
              </p>
            )
          }
          if (item.item_type === 'text') {
            return (
              <p key={item.id} style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, textAlign: 'center', margin: 0, lineHeight: 1.5 }}>
                {item.title}
              </p>
            )
          }
          return (
            <a
              key={item.id}
              href={item.url ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onLinkClick?.(item)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '100%', padding: '14px 20px',
                backgroundColor: page.button_color, color: page.button_text_color,
                borderRadius: radius, fontWeight: 600, fontSize: 15,
                textDecoration: 'none', textAlign: 'center', boxSizing: 'border-box',
                transition: 'opacity 0.15s',
              }}
            >
              {item.title || 'Visit'}
            </a>
          )
        })}
        {activeItems.length === 0 && (
          <div style={{ width: '100%', padding: '14px 20px', borderRadius: radius, backgroundColor: page.button_color, color: page.button_text_color, opacity: 0.4, textAlign: 'center', fontWeight: 600, fontSize: 15 }}>
            Your link here
          </div>
        )}
      </div>

      {page.show_caption_fox_branding && (
        <div style={{ marginTop: 'auto', paddingTop: 40, textAlign: 'center' }}>
          <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12, margin: 0 }}>
            Made with <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>Caption Fox</span>
          </p>
        </div>
      )}
    </div>
  )

  if (frameless) {
    return (
      <div style={{ width: '100%', height: '100%', overflowY: 'auto', ...backgroundStyle(page) }}>
        {content}
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', ...backgroundStyle(page) }}>
      {content}
    </div>
  )
}
