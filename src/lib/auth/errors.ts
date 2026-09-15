// Maps Supabase auth errors to short, non-leaky, actionable copy.
// Raw provider messages never reach the UI.

export type AuthErrorKind =
  | 'invalid_credentials'
  | 'email_not_confirmed'
  | 'rate_limited'
  | 'user_exists'
  | 'weak_password'
  | 'network'
  | 'unknown'

export interface MappedAuthError {
  kind: AuthErrorKind
  message: string
}

interface AuthErrorLike {
  message?: string
  status?: number
  code?: string
}

export function mapAuthError(error: AuthErrorLike | null | undefined): MappedAuthError {
  const code = error?.code ?? ''
  const message = (error?.message ?? '').toLowerCase()
  const status = error?.status ?? 0

  if (code === 'invalid_credentials' || message.includes('invalid login credentials')) {
    return { kind: 'invalid_credentials', message: 'Email or password is incorrect.' }
  }
  if (code === 'email_not_confirmed' || message.includes('email not confirmed')) {
    return { kind: 'email_not_confirmed', message: 'Please verify your email address before signing in.' }
  }
  if (status === 429 || code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit' || message.includes('rate limit')) {
    return { kind: 'rate_limited', message: 'Too many attempts. Please wait a few minutes and try again.' }
  }
  if (code === 'user_already_exists' || code === 'email_exists' || message.includes('already registered')) {
    return { kind: 'user_exists', message: 'This email is already associated with an account.' }
  }
  if (code === 'weak_password' || message.includes('password should be')) {
    return { kind: 'weak_password', message: 'Choose a stronger password — at least 8 characters.' }
  }
  if (message.includes('fetch') || message.includes('network')) {
    return { kind: 'network', message: 'We couldn’t reach Caption Fox. Check your connection and try again.' }
  }
  return { kind: 'unknown', message: 'Something went wrong. Please try again.' }
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function validateEmail(value: string): string | null {
  const v = value.trim()
  if (!v) return 'Enter your email address.'
  if (v.length > 254 || !EMAIL_PATTERN.test(v)) return 'Enter a valid email address.'
  return null
}

// Mirrors the Supabase project setting (password_min_length = 8).
export const PASSWORD_MIN_LENGTH = 8

export function validateNewPassword(value: string): string | null {
  if (!value) return 'Create a password.'
  if (value.length < PASSWORD_MIN_LENGTH) return `Use at least ${PASSWORD_MIN_LENGTH} characters.`
  if (value.length > 72) return 'Use 72 characters or fewer.'
  return null
}
