import type { CSSProperties, ReactNode } from 'react'
import { siFacebook, siInstagram, siTiktok, siX, siYoutube } from 'simple-icons'
import {
  BookOpen, Droplet, Gift, Heart, Link2, Mail, ShoppingBag, Sparkles, Star, Tag,
} from 'lucide-react'
import { blockSummary, videoEmbedUrl } from '@/lib/link-in-bio/blocks'
import { readableOn, type ThemeTokens } from '@/lib/link-in-bio/theme'
import type { Block, ChildLink, RenderModel } from '@/lib/link-in-bio/records'
import { fontFamily, THEME_FONT_CLASSES } from './fonts'

// The one renderer for public Link Pages, Conversion Pages, every editor
// preview, theme cards and version previews. It has no hooks and no data
// access, so the same markup renders on the server for visitors and inside
// client previews. Anything interactive (link tracking, forms) is injected
// by the caller through `linkHref` and `renderForm`.

export type RenderMode = 'public' | 'preview'

type Props = {
  model: RenderModel
  mode: RenderMode
  /** Public mode: tracked redirect for a child link. */
  linkHref?: (link: ChildLink) => string
  /** Public mode: interactive form for a form block. */
  renderForm?: (block: Block) => ReactNode
  /** Device frame the content is laid out for. */
  device?: 'mobile' | 'desktop'
  /** Conversion-page header with logo + menu (design 10). */
  className?: string
}

const SOCIAL = { instagram: siInstagram, tiktok: siTiktok, youtube: siYoutube, x: siX, facebook: siFacebook } as const

function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  return `rgba(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)}, ${alpha})`
}

function shadowFor(tokens: ThemeTokens): string {
  if (tokens.preset === 'minimal' || tokens.preset === 'outline' || tokens.cards.shadow === 'none') return 'none'
  if (tokens.preset === 'elevated' || tokens.cards.shadow === 'large') return '0 10px 24px rgba(15,23,42,0.14)'
  if (tokens.cards.shadow === 'medium') return '0 4px 12px rgba(15,23,42,0.10)'
  return '0 1px 3px rgba(15,23,42,0.10)'
}

export function pageBackground(tokens: ThemeTokens): CSSProperties {
  const { palette, background } = tokens
  if (background.type === 'image' && background.imageUrl) {
    const veil = tokens.mode === 'dark' ? 'rgba(2,6,23,0.35)' : withAlpha(palette.background, 0.18)
    return { backgroundColor: palette.background, backgroundImage: `linear-gradient(${veil}, ${veil}), url("${background.imageUrl}")`, backgroundSize: 'cover', backgroundPosition: 'center top' }
  }
  if (background.type === 'gradient') {
    return { backgroundImage: `linear-gradient(165deg, ${palette.accent} 0%, ${palette.background} 45%, ${palette.secondary} 100%)` }
  }
  if (background.type === 'texture') {
    return { backgroundColor: palette.background, backgroundImage: `radial-gradient(${withAlpha(palette.textPrimary, 0.06)} 1px, transparent 1px)`, backgroundSize: '10px 10px' }
  }
  return { backgroundColor: palette.background }
}

const ICON_KEYWORDS: [RegExp, typeof ShoppingBag][] = [
  [/shop|store|buy|best/i, ShoppingBag], [/new|arriv|launch/i, Sparkles], [/bundle|save|sale|%|offer/i, Tag],
  [/quiz|skin|serum|hydrat/i, Droplet], [/blog|read|guide|learn/i, BookOpen], [/gift|reward/i, Gift],
  [/mail|newsletter|subscribe/i, Mail], [/love|favourite|favorite/i, Heart], [/review|rating/i, Star],
]

function socialKey(url: string | null): keyof typeof SOCIAL | null {
  if (!url) return null
  if (/instagram\.com/i.test(url)) return 'instagram'
  if (/tiktok\.com/i.test(url)) return 'tiktok'
  if (/youtube\.com|youtu\.be/i.test(url)) return 'youtube'
  if (/(twitter|x)\.com/i.test(url)) return 'x'
  if (/facebook\.com/i.test(url)) return 'facebook'
  return null
}

function SocialGlyph({ kind, size, color }: { kind: keyof typeof SOCIAL; size: number; color: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden fill={color}>
      <path d={SOCIAL[kind].path} />
    </svg>
  )
}

function LinkIcon({ link, size, color }: { link: ChildLink; size: number; color: string }) {
  const social = socialKey(link.url)
  if (social) return <SocialGlyph kind={social} size={size} color={color} />
  const match = ICON_KEYWORDS.find(([re]) => re.test(link.title))
  const Icon = match ? match[1] : Link2
  return <Icon size={size} color={color} strokeWidth={1.8} aria-hidden />
}

export default function MicroPage({ model, mode, linkHref, renderForm, device = 'mobile', className }: Props) {
  const t = model.tokens
  const { palette } = t
  const dark = t.mode === 'dark'
  const ink = dark ? '#FFFFFF' : palette.textPrimary
  const inkSoft = dark ? 'rgba(255,255,255,0.82)' : palette.textSecondary
  const gap = t.spacing.elementGap
  const glass = t.preset === 'glass'
  const cardBg = glass ? 'rgba(255,255,255,0.14)' : palette.surface
  const cardInk = glass ? '#FFFFFF' : palette.textPrimary
  const cardInkSoft = glass ? 'rgba(255,255,255,0.8)' : palette.textSecondary
  const cardBorder = t.preset === 'minimal' ? 'transparent' : glass ? 'rgba(255,255,255,0.28)' : palette.border
  const shadow = shadowFor(t)
  const radius = t.buttons.radius >= 32 ? 999 : t.buttons.radius
  const primaryText = t.buttons.primaryStyle === 'outline' ? (dark ? '#FFFFFF' : palette.primary) : readableOn(palette.primary)

  const primaryButton: CSSProperties = t.buttons.primaryStyle === 'gradient'
    ? { backgroundImage: `linear-gradient(90deg, ${palette.primary}, ${palette.accent})`, color: readableOn(palette.primary), border: 'none' }
    : t.buttons.primaryStyle === 'outline'
      ? { background: 'transparent', color: primaryText, border: `1.5px solid ${dark ? '#FFFFFF' : palette.primary}` }
      : { background: palette.primary, color: primaryText, border: 'none' }

  const linkButton: CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 10, width: '100%', minHeight: 44, padding: '0 14px',
    background: cardBg, color: cardInk, border: `1px solid ${cardBorder}`, borderRadius: radius, boxShadow: shadow,
    fontFamily: fontFamily(t.typography.body), fontSize: 13, fontWeight: 600, textDecoration: 'none', boxSizing: 'border-box',
    backdropFilter: glass ? 'blur(8px)' : undefined,
  }

  const card: CSSProperties = {
    width: '100%', background: cardBg, color: cardInk, border: `1px solid ${cardBorder}`,
    borderRadius: t.cards.radius, boxShadow: shadow, boxSizing: 'border-box', backdropFilter: glass ? 'blur(8px)' : undefined,
  }

  const href = (link: ChildLink) => (mode === 'public' && linkHref ? linkHref(link) : undefined)

  const renderLinkButton = (link: ChildLink, variant: 'card' | 'primary' | 'secondary' = 'card') => {
    const style: CSSProperties = variant === 'primary'
      ? { ...linkButton, ...primaryButton, justifyContent: 'center', boxShadow: 'none' }
      : variant === 'secondary'
        ? { ...linkButton, background: 'transparent', color: ink, border: `1.5px solid ${dark ? 'rgba(255,255,255,0.8)' : palette.textPrimary}`, justifyContent: 'center', boxShadow: 'none' }
        : linkButton
    const content = variant === 'card'
      ? (
        <>
          <span style={{ width: 18, display: 'inline-flex', justifyContent: 'center', flexShrink: 0 }}>
            <LinkIcon link={link} size={15} color={t.accents.iconStyle === 'filled' ? palette.primary : palette.primary} />
          </span>
          <span style={{ flex: 1, textAlign: 'center', paddingRight: 28 }}>{link.title || 'Untitled link'}</span>
        </>
      )
      : <span>{link.title || 'Untitled link'}</span>
    const target = href(link)
    return target
      ? <a key={link.id} href={target} rel="noopener" style={style}>{content}</a>
      : <div key={link.id} style={style}>{content}</div>
  }

  const renderBlock = (block: Block): ReactNode => {
    const c = block.config as Record<string, unknown>
    const str = (key: string) => (typeof c[key] === 'string' ? (c[key] as string) : '')
    switch (block.type) {
      case 'hero': {
        const image = str('imageUrl')
        const showBanner = image && t.background.type !== 'image'
        return (
          <header key={block.id} style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, paddingTop: 4 }}>
            {str('eyebrow') && (
              <span style={{ border: `1.5px solid ${ink}`, color: ink, borderRadius: 6, padding: '2px 10px', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', fontFamily: fontFamily(t.typography.body) }}>
                {str('eyebrow')}
              </span>
            )}
            <h1 style={{ margin: '6px 0 0', color: ink, fontFamily: fontFamily(t.typography.heading), fontWeight: t.typography.heading === 'Playfair Display' || t.typography.heading === 'Lora' ? 500 : 700, fontSize: device === 'desktop' ? 40 : 27, lineHeight: 1.05, letterSpacing: t.typography.heading === 'Playfair Display' ? '0.01em' : '-0.02em', textTransform: t.typography.heading === 'Playfair Display' ? 'uppercase' : undefined }}>
              {str('headline') || model.title}
            </h1>
            {str('subheadline') && <p style={{ margin: 0, color: ink, fontFamily: fontFamily(t.typography.body), fontSize: 13, fontWeight: 500 }}>{str('subheadline')}</p>}
            {str('body') && <p style={{ margin: 0, color: inkSoft, fontFamily: fontFamily(t.typography.body), fontSize: 11 }}>{str('body')}</p>}
            {showBanner && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt="" style={{ width: '100%', aspectRatio: '16 / 10', objectFit: 'cover', borderRadius: t.cards.radius, marginTop: 8 }} />
            )}
          </header>
        )
      }
      case 'links':
        if (c.style === 'icon') {
          return (
            <div key={block.id} style={{ display: 'flex', justifyContent: 'center', gap: 14, flexWrap: 'wrap' }}>
              {block.children.map(link => {
                const target = href(link)
                const glyph = <LinkIcon link={link} size={20} color={ink} />
                return target
                  ? <a key={link.id} href={target} aria-label={link.title} style={{ display: 'inline-flex', padding: 8 }}>{glyph}</a>
                  : <span key={link.id} title={link.title} style={{ display: 'inline-flex', padding: 8 }}>{glyph}</span>
              })}
            </div>
          )
        }
        return <div key={block.id} style={{ display: 'flex', flexDirection: 'column', gap: Math.max(6, gap - 4) }}>{block.children.map(link => renderLinkButton(link))}</div>
      case 'button_stack':
        return (
          <div key={block.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {block.children.map((link, i) => renderLinkButton(link, i === 0 ? 'primary' : 'secondary'))}
          </div>
        )
      case 'product': {
        const image = str('imageUrl')
        const url = str('url')
        const button = <span style={{ ...primaryButton, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: 28, padding: '0 14px', borderRadius: Math.min(radius, 8), fontSize: 11, fontWeight: 700, fontFamily: fontFamily(t.typography.body) }}>{str('ctaLabel') || 'Shop now'}</span>
        return (
          <div key={block.id} style={{ ...card, display: 'flex', gap: 12, padding: 12, alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: 0, fontFamily: fontFamily(t.typography.body) }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: cardInk }}>Featured Product</p>
              <p style={{ margin: '4px 0 0', fontSize: 11, color: cardInkSoft }}>{str('name') || 'Product name'}</p>
              {str('priceLabel') && <p style={{ margin: '2px 0 8px', fontSize: 12, fontWeight: 700, color: cardInk }}>{str('priceLabel')}</p>}
              {mode === 'public' && url ? <a href={linkHref ? linkHref({ id: `product:${block.id}`, title: str('name'), url, icon: null, isActive: true, sortOrder: 0, reusableLinkId: null, checkStatus: 'unknown', checkedAt: null, scheduleStart: null, scheduleEnd: null }) : url} style={{ textDecoration: 'none' }}>{button}</a> : button}
            </div>
            {image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt={str('name')} style={{ width: 78, height: 78, objectFit: 'cover', borderRadius: Math.max(6, t.cards.radius - 4), flexShrink: 0 }} />
            )}
          </div>
        )
      }
      case 'product_grid': {
        const products = Array.isArray(c.products) ? (c.products as Record<string, string>[]) : []
        if (products.length === 0) return null
        return (
          <div key={block.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {products.slice(0, 4).map((p, i) => (
              <div key={i} style={{ ...card, padding: 8, fontFamily: fontFamily(t.typography.body) }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {p.imageUrl && <img src={p.imageUrl} alt={p.name} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 6 }} />}
                <p style={{ margin: '6px 0 0', fontSize: 11, fontWeight: 600 }}>{p.name}</p>
                {p.priceLabel && <p style={{ margin: 0, fontSize: 11, color: cardInkSoft }}>{p.priceLabel}</p>}
              </div>
            ))}
          </div>
        )
      }
      case 'form':
        if (mode === 'public' && renderForm) return <div key={block.id}>{renderForm(block)}</div>
        return (
          <div key={block.id} style={{ ...card, padding: '14px 14px 10px', textAlign: 'center', fontFamily: fontFamily(t.typography.body) }}>
            <p style={{ margin: 0, fontFamily: fontFamily(t.typography.heading), fontSize: 15, fontWeight: 600, color: cardInk }}>{str('heading') || 'Join my list'}</p>
            {str('body') && <p style={{ margin: '4px auto 10px', fontSize: 10.5, lineHeight: 1.4, color: cardInkSoft, maxWidth: 220 }}>{str('body')}</p>}
            <div style={{ height: 30, borderRadius: Math.min(radius, 999), border: `1px solid ${palette.border}`, background: '#FFFFFF', display: 'flex', alignItems: 'center', padding: '0 12px', fontSize: 10.5, color: '#94A3B8' }}>Your email address</div>
            <div style={{ ...primaryButton, height: 30, marginTop: 7, borderRadius: Math.min(radius, 999), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{str('buttonLabel') || 'Subscribe'}</div>
            {str('consentText') && <p style={{ margin: '6px 0 0', fontSize: 9.5, color: cardInkSoft }}>{str('consentText')}</p>}
          </div>
        )
      case 'social_proof': {
        const quotes = Array.isArray(c.quotes) ? (c.quotes as { text?: string; author?: string }[]) : []
        if (quotes.length === 0) return null
        return (
          <div key={block.id} style={{ ...card, padding: 12, fontFamily: fontFamily(t.typography.body) }}>
            <p style={{ margin: 0, color: '#F59E0B', fontSize: 12, letterSpacing: 2 }} aria-label="5 out of 5 stars">★★★★★</p>
            <p style={{ margin: '4px 0 0', fontSize: 12, lineHeight: 1.45, color: cardInk }}>&ldquo;{quotes[0].text}&rdquo;</p>
            {quotes[0].author && <p style={{ margin: '4px 0 0', fontSize: 10.5, color: cardInkSoft }}>{quotes[0].author}</p>}
          </div>
        )
      }
      case 'social_feed': {
        const handle = str('handle')
        if (!handle) return null
        const url = `https://instagram.com/${encodeURIComponent(handle.replace(/^@/, ''))}`
        const inner = <><SocialGlyph kind="instagram" size={14} color={palette.primary} /><span style={{ flex: 1, textAlign: 'center', paddingRight: 28 }}>Follow @{handle.replace(/^@/, '')}</span></>
        return mode === 'public' ? <a key={block.id} href={url} rel="noopener" style={linkButton}>{inner}</a> : <div key={block.id} style={linkButton}>{inner}</div>
      }
      case 'countdown': {
        const endsAt = str('endsAt')
        const remaining = endsAt ? new Date(endsAt).getTime() - Date.now() : 0
        if (!endsAt || remaining <= 0) return null
        const days = Math.floor(remaining / 86400000), hours = Math.floor((remaining % 86400000) / 3600000)
        return (
          <div key={block.id} style={{ ...card, padding: 10, textAlign: 'center', fontFamily: fontFamily(t.typography.body) }}>
            <p style={{ margin: 0, fontSize: 10.5, color: cardInkSoft }}>{str('label') || 'Ends in'}</p>
            <p style={{ margin: '2px 0 0', fontSize: 18, fontWeight: 700, color: cardInk }}>{days}d {hours}h</p>
          </div>
        )
      }
      case 'faq': {
        const items = Array.isArray(c.items) ? (c.items as { q?: string; a?: string }[]) : []
        if (items.length === 0) return null
        return (
          <div key={block.id} style={{ ...card, padding: '4px 12px', fontFamily: fontFamily(t.typography.body) }}>
            {items.map((item, i) => (
              <details key={i} style={{ borderTop: i ? `1px solid ${palette.border}` : 'none', padding: '8px 0' }}>
                <summary style={{ cursor: 'pointer', fontSize: 12, fontWeight: 600, color: cardInk }}>{item.q}</summary>
                <p style={{ margin: '6px 0 0', fontSize: 11.5, color: cardInkSoft }}>{item.a}</p>
              </details>
            ))}
          </div>
        )
      }
      case 'pricing': {
        const tiers = Array.isArray(c.tiers) ? (c.tiers as { name?: string; price?: string }[]) : []
        if (tiers.length === 0) return null
        return (
          <div key={block.id} style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(3, tiers.length)}, 1fr)`, gap: 6 }}>
            {tiers.slice(0, 3).map((tier, i) => (
              <div key={i} style={{ ...card, padding: 8, textAlign: 'center', fontFamily: fontFamily(t.typography.body) }}>
                <p style={{ margin: 0, fontSize: 10.5, color: cardInkSoft }}>{tier.name}</p>
                <p style={{ margin: '2px 0 0', fontSize: 14, fontWeight: 700 }}>{tier.price}</p>
              </div>
            ))}
          </div>
        )
      }
      case 'video': {
        const embed = videoEmbedUrl(str('url'))
        if (!embed) return null
        return mode === 'public'
          ? <iframe key={block.id} src={embed} title={str('caption') || 'Video'} loading="lazy" allow="encrypted-media; picture-in-picture" allowFullScreen style={{ width: '100%', aspectRatio: '16 / 9', border: 0, borderRadius: t.cards.radius }} />
          : <div key={block.id} style={{ ...card, aspectRatio: '16 / 9', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0F172A', color: '#FFFFFF', fontSize: 11 }}>▶ {str('caption') || 'Video'}</div>
      }
      case 'image': {
        const image = str('imageUrl')
        if (!image) return null
        // eslint-disable-next-line @next/next/no-img-element
        return <img key={block.id} src={image} alt={str('alt')} loading="lazy" style={{ width: '100%', borderRadius: t.cards.radius, objectFit: 'cover' }} />
      }
      case 'text':
        return str('body') ? <p key={block.id} style={{ margin: 0, textAlign: 'center', fontSize: 12.5, lineHeight: 1.5, color: inkSoft, fontFamily: fontFamily(t.typography.body) }}>{str('body')}</p> : null
      case 'divider':
        return <hr key={block.id} style={{ width: '100%', border: 0, borderTop: `1px ${t.accents.divider} ${dark ? 'rgba(255,255,255,0.3)' : palette.border}`, margin: '2px 0' }} />
      case 'footer': {
        const socials = Array.isArray(c.socials) ? (c.socials as { platform?: string; url?: string }[]) : []
        return (
          <footer key={block.id} style={{ textAlign: 'center', fontFamily: fontFamily(t.typography.body), marginTop: 4 }}>
            {socials.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 18, marginBottom: 8 }}>
                {socials.map((social, i) => {
                  const kind = socialKey(social.url ?? null)
                  if (!kind) return null
                  const glyph = <SocialGlyph kind={kind} size={17} color={ink} />
                  return mode === 'public' && social.url
                    ? <a key={i} href={social.url} rel="noopener" aria-label={SOCIAL[kind].title}>{glyph}</a>
                    : <span key={i}>{glyph}</span>
                })}
              </div>
            )}
            {str('legalText') && <p style={{ margin: 0, fontSize: 10, color: inkSoft }}>{str('legalText')}</p>}
          </footer>
        )
      }
    }
  }

  const hasBlocks = model.blocks.length > 0
  return (
    <div
      className={`${THEME_FONT_CLASSES} ${className ?? ''}`}
      style={{ ...pageBackground(t), minHeight: '100%', width: '100%', boxSizing: 'border-box', fontFamily: fontFamily(t.typography.body) }}
    >
      <div style={{ maxWidth: device === 'desktop' ? 460 : 420, margin: '0 auto', padding: `${t.spacing.sectionPadding}px ${Math.max(14, t.spacing.sectionPadding - 6)}px`, display: 'flex', flexDirection: 'column', gap }}>
        {hasBlocks ? model.blocks.map(renderBlock) : (
          <p style={{ textAlign: 'center', color: inkSoft, fontSize: 12, padding: '40px 0' }}>Add a block to start building this page.</p>
        )}
        {(model.legal.privacyUrl || model.legal.termsUrl) && mode === 'public' && (
          <nav aria-label="Legal" style={{ display: 'flex', justifyContent: 'center', gap: 14, fontSize: 10.5 }}>
            {model.legal.privacyUrl && <a href={model.legal.privacyUrl} rel="noopener" style={{ color: inkSoft }}>Privacy</a>}
            {model.legal.termsUrl && <a href={model.legal.termsUrl} rel="noopener" style={{ color: inkSoft }}>Terms</a>}
          </nav>
        )}
        {model.showBranding && mode === 'public' && (
          <p style={{ textAlign: 'center', margin: '8px 0 0', fontSize: 10.5, color: inkSoft, opacity: 0.8 }}>Made with Caption Fox</p>
        )}
      </div>
    </div>
  )
}

export { blockSummary }
