import type { BidAnalysis, BidPoint, BidScenario } from './types'

/** What the estimator can set in the Custom window (fractions as the backend stores them). */
export interface BidInputs {
  reference_win_probability: number
  price_sensitivity_probability_points_per_1pct_price: number
  strategic_appetite_adjustment: number
  competition_adjustment: number
  margin_Aggressive: number
  margin_Target: number
  margin_Conservative: number
  margin_Custom: number
  inflation_pct: number
  duration_months: number
}

export function inputsOf(bid: BidAnalysis): BidInputs {
  return {
    ...(bid.inputs as unknown as BidInputs),
    margin_Custom: bid.custom.margin_pct,
    inflation_pct: bid.inflation.inflation_pct,
    duration_months: bid.inflation.duration_months,
  }
}

/** Average escalation when costs fall evenly over the duration (same rule as the backend). */
export const averageInflation = (ratePct: number, months: number) =>
  ratePct && months ? ((1 + ratePct / 100) ** (months / 24) - 1) * 100 : 0

/**
 * The backend's bid analysis, recomputed in the browser so the cards and charts follow the Custom window while
 * the estimator types; the saved numbers still come from the backend.
 */
export function previewBid(bid: BidAnalysis, x: BidInputs, targetMarginPct: number, step: number) {
  const avg = averageInflation(x.inflation_pct, x.duration_months)
  const base = bid.cost_baseline_chf * (1 + avg / 100)
  const reference = base / (1 - targetMarginPct / 100)
  const prob = (price: number) =>
    Math.min(
      bid.limits.max_probability,
      Math.max(
        bid.limits.min_probability,
        x.reference_win_probability +
          x.strategic_appetite_adjustment +
          x.competition_adjustment -
          x.price_sensitivity_probability_points_per_1pct_price * (price / reference - 1) * 100,
      ),
    )
  const at = (name: string, price: number, margin: number): BidScenario => {
    const p = prob(price)
    return {
      scenario: name,
      bid_price_chf: price,
      margin_pct: margin,
      estimated_win_probability: Math.round(p * 100) / 100,
      expected_contribution_chf: Math.round(p * (price - base) * 100) / 100,
    }
  }
  const byMargin = (name: string, m: number) => at(name, Math.ceil(base / (1 - m / 100) / step) * step, m)
  const scenarios = bid.scenarios.map((s) => byMargin(s.scenario, x[`margin_${s.scenario}` as keyof BidInputs] ?? s.margin_pct))
  const custom = byMargin('Custom', x.margin_Custom)
  const experience = bid.experience
    ? { ...bid.experience, ...at('Experience', bid.experience.bid_price_chf, Math.round((1 - base / bid.experience.bid_price_chf) * 10000) / 100) }
    : null
  const curve: BidPoint[] = Array.from({ length: 25 }, (_, i) => {
    const m = i * 0.5
    const price = base / (1 - m / 100)
    const p = prob(price)
    return {
      margin_pct: m,
      bid_price_chf: Math.round(price),
      estimated_win_probability: Math.round(p * 1000) / 1000,
      expected_contribution_chf: Math.round(p * (price - base) * 100) / 100,
    }
  })
  const recommended = scenarios.reduce((a, b) => (b.expected_contribution_chf > a.expected_contribution_chf ? b : a)).scenario
  const peak = curve.reduce((a, b) => (b.expected_contribution_chf > a.expected_contribution_chf ? b : a)).margin_pct
  return { scenarios, custom, experience, curve, recommended, peak, base, avg, reference }
}
