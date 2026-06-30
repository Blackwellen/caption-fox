// Lightweight environment validation. Used by server routes to fail with a CLEAR,
// non-leaking error instead of an opaque crash when a required key is missing.
// Intentionally does NOT throw at import time (which would break the whole app/build).

export function hasEnv(name: string): boolean {
  return typeof process.env[name] === 'string' && process.env[name]!.length > 0
}

/** Returns the names of any missing required server env vars. */
export function missingServerEnv(): string[] {
  const required = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']
  return required.filter(n => !hasEnv(n))
}

/** True when the Anthropic key is configured (AI routes require this). */
export function isAiConfigured(): boolean {
  return hasEnv('ANTHROPIC_API_KEY')
}
