import 'server-only'

/**
 * FNV-1a string hash — fast, stable, and deterministic across requests and
 * processes (no Math.random() anywhere in assignment). Same experimentId +
 * visitorId always hashes to the same bucket.
 */
function fnv1a(input: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/**
 * Deterministically assigns a visitor to 'control' or 'variant' for a given
 * experiment, based purely on a hash of (experimentId, visitorId) against the
 * experiment's traffic_allocation_percent. The same visitor always gets the
 * same bucket for the same experiment — refreshing the page or re-requesting
 * assignment never flips the variant.
 */
export function assignVariant(experimentId: string, visitorId: string, trafficAllocationPercent: number): 'control' | 'variant' {
  const bucket = fnv1a(`${experimentId}:${visitorId}`) % 100
  return bucket < trafficAllocationPercent ? 'variant' : 'control'
}
