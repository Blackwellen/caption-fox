// Governance is computed from the record, never stored as a boolean. Every
// check carries its evidence and the next action, so a green "Compliant" badge
// always has a reason behind it.

import { themeAccessibilityChecks, type ThemeTokens } from './theme'
import { validateDestinationUrl } from './urls'

export type CheckStatus = 'passed' | 'warning' | 'failed' | 'not_started'

export type GovernanceCheck = {
  id: 'content_review' | 'brand' | 'legal' | 'accessibility' | 'domain' | 'pixels' | 'consent' | 'links' | 'utm' | 'publishing' | 'form_consent'
  label: string
  status: CheckStatus
  detail: string
  /** Tab or action that resolves the check. */
  action: { label: string; tab: 'design' | 'links' | 'products' | 'forms' | 'pixels' | 'settings' | 'versions' } | null
}

export type GovernanceInput = {
  status: string
  approvalStatus: string
  theme: { status: string; tokens: ThemeTokens } | null
  legal: { privacyUrl?: string | null; termsUrl?: string | null; disclosure?: string | null }
  consent: { banner?: boolean }
  domain: { status: 'pending' | 'verified' | 'failed' } | null
  pixels: { approvalStatus: string; enabled: boolean }[]
  links: { url: string | null; checkStatus: string; isActive: boolean }[]
  hasForm: boolean
  formConsentText: boolean
  utmTracking: boolean
  hasTitle: boolean
}

export function evaluateGovernance(input: GovernanceInput): { checks: GovernanceCheck[]; passed: boolean; failing: number } {
  const checks: GovernanceCheck[] = []

  const reviewed = input.approvalStatus === 'approved' || input.status === 'published'
  checks.push({
    id: 'content_review', label: 'Content review',
    status: reviewed ? 'passed' : input.approvalStatus === 'pending' ? 'warning' : input.approvalStatus === 'changes_requested' ? 'failed' : 'not_started',
    detail: reviewed ? 'Approved by a reviewer' : input.approvalStatus === 'pending' ? 'Waiting for a reviewer' : input.approvalStatus === 'changes_requested' ? 'Reviewer requested changes' : 'Not started',
    action: reviewed ? null : { label: 'Submit for review', tab: 'versions' },
  })

  checks.push({
    id: 'brand', label: 'Brand guidelines',
    status: !input.theme ? 'not_started' : input.theme.status === 'active' ? 'passed' : 'warning',
    detail: !input.theme ? 'No theme applied' : input.theme.status === 'active' ? 'Logo, colors, fonts compliant' : 'Theme is not yet published',
    action: input.theme?.status === 'active' ? null : { label: 'Apply a theme', tab: 'design' },
  })

  const hasLegal = !!(input.legal.privacyUrl && validateDestinationUrl(input.legal.privacyUrl).ok)
  checks.push({
    id: 'legal', label: 'Legal & disclosures',
    status: hasLegal ? 'passed' : input.hasForm ? 'failed' : 'not_started',
    detail: hasLegal ? 'Privacy link present' : input.hasForm ? 'A privacy policy link is required when collecting data' : 'Not started',
    action: hasLegal ? null : { label: 'Add privacy link', tab: 'settings' },
  })

  if (input.theme) {
    const { checks: a11y, score } = themeAccessibilityChecks(input.theme.tokens)
    const failing = a11y.filter(c => !c.passed)
    checks.push({
      id: 'accessibility', label: 'Accessibility',
      status: failing.length === 0 ? 'passed' : score >= 66 ? 'warning' : 'failed',
      detail: failing.length === 0 ? 'Theme meets WCAG 2.1 AA checks' : failing.map(c => c.label).join(', '),
      action: failing.length === 0 ? null : { label: 'Review theme', tab: 'design' },
    })
  } else {
    checks.push({ id: 'accessibility', label: 'Accessibility', status: 'not_started', detail: 'Not started', action: { label: 'Apply a theme', tab: 'design' } })
  }

  if (input.domain) {
    checks.push({
      id: 'domain', label: 'Domain',
      status: input.domain.status === 'verified' ? 'passed' : input.domain.status === 'failed' ? 'failed' : 'warning',
      detail: input.domain.status === 'verified' ? 'Custom domain verified' : input.domain.status === 'failed' ? 'DNS verification failed' : 'Waiting for DNS verification',
      action: input.domain.status === 'verified' ? null : { label: 'Verify domain', tab: 'settings' },
    })
  }

  const activePixels = input.pixels.filter(p => p.enabled)
  if (activePixels.length > 0) {
    const approved = activePixels.filter(p => p.approvalStatus === 'approved').length
    checks.push({
      id: 'pixels', label: 'Pixel approval',
      status: approved === activePixels.length ? 'passed' : 'warning',
      detail: `${approved}/${activePixels.length} pixels approved`,
      action: approved === activePixels.length ? null : { label: 'Approve pixels', tab: 'pixels' },
    })
    checks.push({
      id: 'consent', label: 'Consent',
      status: input.consent.banner ? 'passed' : 'failed',
      detail: input.consent.banner ? 'Cookie banner enabled' : 'Pixels require the cookie banner',
      action: input.consent.banner ? null : { label: 'Enable banner', tab: 'settings' },
    })
  }

  if (input.hasForm) {
    checks.push({
      id: 'form_consent', label: 'Form consent',
      status: input.formConsentText ? 'passed' : 'failed',
      detail: input.formConsentText ? 'Consent wording shown on every form' : 'Forms need consent wording',
      action: input.formConsentText ? null : { label: 'Edit form', tab: 'forms' },
    })
  }

  const liveLinks = input.links.filter(l => l.isActive && l.url)
  const broken = liveLinks.filter(l => l.checkStatus === 'broken' || l.checkStatus === 'timeout' || l.checkStatus === 'blocked').length
  const invalid = liveLinks.filter(l => !validateDestinationUrl(l.url).ok).length
  checks.push({
    id: 'links', label: 'Links',
    status: broken + invalid === 0 ? 'passed' : 'failed',
    detail: broken + invalid === 0 ? `${liveLinks.length} links valid` : `${broken + invalid} broken or invalid links`,
    action: broken + invalid === 0 ? null : { label: 'Fix links', tab: 'links' },
  })

  checks.push({
    id: 'utm', label: 'UTM tracking',
    status: input.utmTracking ? 'passed' : 'warning',
    detail: input.utmTracking ? 'UTM parameters added automatically' : 'Links are not tagged with UTM parameters',
    action: input.utmTracking ? null : { label: 'Enable UTM', tab: 'settings' },
  })

  checks.push({
    id: 'publishing', label: 'Publishing rules',
    status: input.hasTitle ? 'passed' : 'failed',
    detail: input.hasTitle ? 'Meets all publishing rules' : 'A page title is required',
    action: input.hasTitle ? null : { label: 'Add title', tab: 'settings' },
  })

  const failing = checks.filter(c => c.status === 'failed').length
  // Content review is satisfied by the publish action itself, so it does not block publishing.
  const blocking = checks.filter(c => c.status === 'failed' && c.id !== 'content_review').length
  return { checks, passed: blocking === 0, failing }
}
