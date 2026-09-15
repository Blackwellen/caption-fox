import 'server-only'
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto'

// Envelope encryption for advertising provider credentials.
//
// Client secrets and OAuth tokens are AES-256-GCM encrypted before they touch
// the database, so a leaked database snapshot does not leak provider access.
// The key never leaves the server process.
//
// Format: v1.<iv-b64>.<tag-b64>.<ciphertext-b64>

const VERSION = 'v1'
const ALGORITHM = 'aes-256-gcm'
const IV_BYTES = 12

let cachedKey: Buffer | null = null

function key(): Buffer {
  if (cachedKey) return cachedKey
  const raw = process.env.ADVERTISING_ENCRYPTION_KEY
  if (!raw || raw.trim().length < 32) {
    throw new Error(
      'ADVERTISING_ENCRYPTION_KEY is missing or too short. Generate one with ' +
      '`node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"` ' +
      'and set it in the environment before connecting advertising accounts.',
    )
  }
  // Accept either raw base64 32 bytes or any passphrase, normalised via SHA-256.
  const decoded = Buffer.from(raw, 'base64')
  cachedKey = decoded.length === 32 ? decoded : createHash('sha256').update(raw).digest()
  return cachedKey
}

/** True when the deployment can encrypt. Lets callers show setup guidance. */
export function encryptionAvailable(): boolean {
  try { key(); return true } catch { return false }
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, key(), iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [VERSION, iv.toString('base64'), tag.toString('base64'), ciphertext.toString('base64')].join('.')
}

export function decryptSecret(payload: string): string {
  const parts = payload.split('.')
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error('Unrecognised encrypted credential format.')
  }
  const [, ivB64, tagB64, dataB64] = parts
  const decipher = createDecipheriv(ALGORITHM, key(), Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8')
}

/** Encrypts each string value of a record; non-string values are dropped. */
export function encryptRecord(values: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(values)) {
    if (typeof v === 'string' && v.length > 0) out[k] = encryptSecret(v)
  }
  return out
}

export function decryptRecord(values: Record<string, string> | null | undefined): Record<string, string> {
  if (!values) return {}
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(values)) {
    try { out[k] = decryptSecret(v) } catch { /* skip unreadable entries */ }
  }
  return out
}

/** Last four characters of a credential, for "ends in ..." confirmation UI. */
export function maskTail(value: string): string {
  return value.length <= 4 ? '••••' : `••••${value.slice(-4)}`
}
