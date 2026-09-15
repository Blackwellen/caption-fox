// Pure statistics helpers for Web & Conversion experiments — no Supabase
// dependency, safe to import from client components. This is the one
// documented statistical method used everywhere confidence/uplift is shown;
// values are never fabricated.

export interface ExperimentStats {
  controlRate: number
  variantRate: number
  upliftPercent: number
  confidencePercent: number
  probabilityToBeatBaseline: number
  hasEnoughData: boolean
}

/** Standard normal CDF via the Abramowitz–Stegun erf approximation. */
function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const d = 0.3989423 * Math.exp((-z * z) / 2)
  let prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  if (z > 0) prob = 1 - prob
  return 1 - prob
}

/**
 * Two-proportion z-test. Requires at least 100 visitors per arm before
 * reporting a confidence figure at all.
 */
export function computeExperimentStats(
  controlVisitors: number, controlConversions: number, variantVisitors: number, variantConversions: number,
): ExperimentStats {
  const controlRate = controlVisitors > 0 ? controlConversions / controlVisitors : 0
  const variantRate = variantVisitors > 0 ? variantConversions / variantVisitors : 0
  const upliftPercent = controlRate > 0 ? ((variantRate - controlRate) / controlRate) * 100 : 0

  const hasEnoughData = controlVisitors >= 100 && variantVisitors >= 100
  if (!hasEnoughData) {
    return { controlRate, variantRate, upliftPercent, confidencePercent: 0, probabilityToBeatBaseline: 0, hasEnoughData: false }
  }

  const pooled = (controlConversions + variantConversions) / (controlVisitors + variantVisitors)
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / controlVisitors + 1 / variantVisitors))
  const z = se > 0 ? (variantRate - controlRate) / se : 0
  const oneSided = normalCdf(Math.abs(z))
  const confidencePercent = Math.max(0, Math.min(100, (2 * oneSided - 1) * 100))
  const probabilityToBeatBaseline = Math.max(0, Math.min(100, oneSided * 100))

  return { controlRate, variantRate, upliftPercent, confidencePercent, probabilityToBeatBaseline, hasEnoughData: true }
}
