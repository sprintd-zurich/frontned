import { useMemo, useState } from 'react'
import type { BidPoint, BidScenario, Estimate, Parameters } from '../types'
import { fmtChf } from '../format'
import { ParamGroup } from './BuildUpView'

interface Props {
  estimate: Estimate
  onParams: (b: Partial<Parameters>) => void
  onSave: (name: string) => void
  onApply: (id: string) => void
  onDelete: (id: string) => void
}

const pct = (v: number) => `${Math.round(v * 100)}%`
const TONE: Record<string, string> = { Aggressive: 'aggr', Target: 'target', Conservative: 'cons' }

export function BidView({ estimate, onParams, onSave, onApply, onDelete }: Props) {
  const bid = estimate.bid
  const [name, setName] = useState('')
  const best = bid.scenarios.find((s) => s.scenario === bid.recommended)!

  return (
    <div className="buildup bid">
      <section className="card wide">
        <div className="card-title">Recommended bid range</div>
        <p className="muted small">
          Cost baseline {fmtChf(bid.cost_baseline_chf)} · market reference price {fmtChf(bid.reference_price_chf)} (baseline
          at the standard {estimate.parameters.commercial.target_margin_pct ?? 5.5}% margin of the parameters file)
        </p>
        <div className="scenarios">
          {bid.scenarios.map((s) => (
            <ScenarioCard key={s.scenario} s={s} best={s.scenario === bid.recommended} />
          ))}
        </div>
        <p className="small">
          <strong>{best.scenario}</strong> gives the highest expected contribution ({fmtChf(best.expected_contribution_chf)}
          ), with a {pct(best.estimated_win_probability)} chance of winning.{' '}
          {bid.scenarios
            .filter((s) => s.scenario !== best.scenario)
            .map((s) => `${s.scenario} wins ${pct(s.estimated_win_probability)} of the time but earns ${fmtChf(s.expected_contribution_chf)}.`)
            .join(' ')}
        </p>
      </section>

      <section className="card">
        <div className="card-title">Win probability by margin</div>
        <LineChart curve={bid.curve} scenarios={bid.scenarios} y={(p) => p.estimated_win_probability} fmt={pct} max={1} />
      </section>
      <section className="card">
        <div className="card-title">Expected contribution by margin</div>
        <LineChart
          curve={bid.curve}
          scenarios={bid.scenarios}
          y={(p) => p.expected_contribution_chf}
          fmt={(v) => (v === 0 ? 'CHF 0' : `CHF ${Math.round(v / 1000)}k`)}
        />
        <p className="muted small">Peak on the curve at {bid.peak_margin_pct}% margin.</p>
      </section>

      <section className="card wide">
        <div className="card-title">How the probability is estimated</div>
        <p className="small formula">
          win probability = base {pct(bid.inputs.reference_win_probability)} + strategic appetite{' '}
          {signed(bid.inputs.strategic_appetite_adjustment)} + competition {signed(bid.inputs.competition_adjustment)} −{' '}
          {Math.round(bid.inputs.price_sensitivity_probability_points_per_1pct_price * 100)} points for every 1% above the
          reference price, kept between {pct(bid.limits.min_probability)} and {pct(bid.limits.max_probability)}.
          <br />
          bid price = cost baseline ÷ (1 − margin), rounded up to CHF 1’000 · expected contribution = win probability ×
          (bid price − cost baseline)
        </p>
        <div className="param-grid">
          <ParamGroup
            title="Market and strategy (what-if)"
            group="bid"
            values={pick(bid.inputs, ['reference_win_probability', 'price_sensitivity_probability_points_per_1pct_price', 'strategic_appetite_adjustment', 'competition_adjustment'])}
            onParams={onParams}
            step={0.01}
          />
          <ParamGroup
            title="Scenario margins"
            group="bid"
            values={pick(bid.inputs, ['margin_Aggressive', 'margin_Target', 'margin_Conservative'])}
            onParams={onParams}
            step={0.5}
          />
        </div>
      </section>

      <section className="card wide">
        <div className="card-title">Scenario comparison</div>
        <p className="muted small">
          Save the current settings as a scenario, change parameters here or on the Price build-up tab, save again and
          compare. Position edits stay as they are when you restore a scenario.
        </p>
        <form
          className="snap-form"
          onSubmit={(e) => {
            e.preventDefault()
            onSave(name || `Scenario ${estimate.snapshots.length + 1}`)
            setName('')
          }}
        >
          <input className="search" placeholder="Name, e.g. Higher labour rate" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn primary" type="submit">
            Save current as scenario
          </button>
        </form>
        <Comparison estimate={estimate} onApply={onApply} onDelete={onDelete} />
      </section>
    </div>
  )
}

function ScenarioCard({ s, best }: { s: BidScenario; best: boolean }) {
  return (
    <div className={`scenario ${TONE[s.scenario] ?? ''} ${best ? 'best' : ''}`}>
      <div className="scenario-head">
        <span>{s.scenario}</span>
        {best && <span className="chip ok">Highest expected contribution</span>}
      </div>
      <div className="scenario-price">{fmtChf(s.bid_price_chf)}</div>
      <dl>
        <dt>Margin</dt>
        <dd>{s.margin_pct}%</dd>
        <dt>Win probability</dt>
        <dd>
          <span className="prob">
            <span style={{ width: pct(s.estimated_win_probability) }} />
          </span>
          {pct(s.estimated_win_probability)}
        </dd>
        <dt>Expected contribution</dt>
        <dd>{fmtChf(s.expected_contribution_chf)}</dd>
      </dl>
    </div>
  )
}

function LineChart({
  curve,
  scenarios,
  y,
  fmt,
  max,
}: {
  curve: BidPoint[]
  scenarios: BidScenario[]
  y: (p: BidPoint) => number
  fmt: (v: number) => string
  max?: number
}) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 520, H = 220, L = 64, R = 14, T = 12, B = 30
  const xMax = curve[curve.length - 1].margin_pct
  const yMax = max ?? niceCeil(Math.max(...curve.map(y)) * 1.05)
  const sx = (m: number) => L + (m / xMax) * (W - L - R)
  const sy = (v: number) => T + (1 - v / yMax) * (H - T - B)
  const path = curve.map((p, i) => `${i ? 'L' : 'M'}${sx(p.margin_pct).toFixed(1)},${sy(y(p)).toFixed(1)}`).join('')
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * yMax)
  const h = hover != null ? curve[hover] : null
  const markers = useMemo(
    () =>
      scenarios.map((s) => {
        const p = { ...curve[0], margin_pct: s.margin_pct, estimated_win_probability: s.estimated_win_probability, expected_contribution_chf: s.expected_contribution_chf, bid_price_chf: s.bid_price_chf }
        return { s, x: sx(s.margin_pct), y: sy(y(p)) }
      }),
    [scenarios, curve, yMax],
  )
  return (
    <div className="chart-wrap">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="chart"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
          const m = (((e.clientX - r.left) / r.width) * W - L) / (W - L - R) * xMax
          const i = Math.round(m / (xMax / (curve.length - 1)))
          setHover(Math.max(0, Math.min(curve.length - 1, i)))
        }}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={sy(t)} y2={sy(t)} className="grid" />
            <text x={L - 8} y={sy(t) + 4} className="axis" textAnchor="end">
              {fmt(t)}
            </text>
          </g>
        ))}
        {[0, 2, 4, 6, 8, 10, 12].map((m) => (
          <text key={m} x={sx(m)} y={H - 10} className="axis" textAnchor="middle">
            {m}%
          </text>
        ))}
        <path d={path} className="line" />
        {markers.map(({ s, x, y: yy }) => (
          <g key={s.scenario}>
            <circle cx={x} cy={yy} r={5} className={`marker ${TONE[s.scenario]}`} />
            <text x={x} y={yy - 10} className="axis label" textAnchor="middle">
              {s.scenario}
            </text>
          </g>
        ))}
        {h && (
          <g>
            <line x1={sx(h.margin_pct)} x2={sx(h.margin_pct)} y1={T} y2={H - B} className="crosshair" />
            <circle cx={sx(h.margin_pct)} cy={sy(y(h))} r={4} className="marker hover" />
          </g>
        )}
      </svg>
      {h && (
        <div className="tooltip" style={{ left: `${(sx(h.margin_pct) / W) * 100}%` }}>
          <strong>{h.margin_pct}% margin</strong>
          <div>Bid {fmtChf(h.bid_price_chf)}</div>
          <div>Win {pct(h.estimated_win_probability)}</div>
          <div>Expected {fmtChf(h.expected_contribution_chf)}</div>
        </div>
      )}
    </div>
  )
}

function Comparison({ estimate, onApply, onDelete }: Omit<Props, 'onParams' | 'onSave'>) {
  const snaps = estimate.snapshots
  if (!snaps.length) return <p className="empty">No saved scenarios yet.</p>
  const base = snaps[0].summary
  const rows: [string, (s: (typeof snaps)[0]['summary']) => number, (v: number) => string, ((d: number) => string)?][] = [
    ['Material', (s) => s.material_cost_chf, (v) => fmtChf(v)],
    ['Installation hours', (s) => s.install_hours, (v) => `${Math.round(v).toLocaleString('de-CH')} h`],
    ['Labour', (s) => s.labour_cost_chf, (v) => fmtChf(v)],
    ['Direct cost', (s) => s.direct_cost_chf, (v) => fmtChf(v)],
    ['Cost baseline', (s) => s.cost_baseline_chf, (v) => fmtChf(v)],
    ['Indicative price', (s) => s.selling_price_rounded_chf, (v) => fmtChf(v)],
    ['Recommended bid', (s) => s.recommended_bid_chf, (v) => fmtChf(v)],
    ['Win probability', (s) => s.recommended_win_probability, pct, (d) => `${Math.round(d * 100)} points`],
    ['Expected contribution', (s) => s.recommended_contribution_chf, (v) => fmtChf(v)],
  ]
  return (
    <div className="table-scroll compare">
      <table className="positions">
        <thead>
          <tr>
            <th />
            {snaps.map((s, i) => (
              <th key={s.id} className="num">
                {s.name}
                {i === 0 && <div className="muted small">reference</div>}
                <div className="snap-actions">
                  <button className="link" onClick={() => onApply(s.id)}>
                    Restore
                  </button>
                  <button className="link" onClick={() => onDelete(s.id)}>
                    Remove
                  </button>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, get, f, fd]) => (
            <tr key={label}>
              <td>{label}</td>
              {snaps.map((s, i) => {
                const d = get(s.summary) - get(base)
                return (
                  <td key={s.id} className="num">
                    {f(get(s.summary))}
                    {i > 0 && Math.abs(d) > 1e-9 && (
                      <div className={`delta ${d > 0 ? 'up' : 'down'}`}>
                        {d > 0 ? '+' : '−'}
                        {(fd ?? f)(Math.abs(d))}
                      </div>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
          <tr>
            <td>Recommended scenario</td>
            {snaps.map((s) => (
              <td key={s.id} className="num">
                {s.summary.recommended_scenario}
              </td>
            ))}
          </tr>
          <tr>
            <td>What changed</td>
            {snaps.map((s, i) => (
              <td key={s.id} className="num small muted">
                {i === 0 ? '—' : diffParams(snaps[0].parameters, s.parameters) || 'only position edits'}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function diffParams(a: Parameters, b: Parameters) {
  const out: string[] = []
  for (const g of Object.keys(b) as (keyof Parameters)[]) {
    for (const [k, v] of Object.entries(b[g] ?? {})) {
      const old = a[g]?.[k]
      if (old !== undefined && old !== v) out.push(`${k.replace(/_/g, ' ')} ${old} → ${v}`)
    }
  }
  return out.join(' · ')
}

function niceCeil(v: number) {
  const p = 10 ** Math.floor(Math.log10(v))
  return ([1, 2, 4, 5, 10].find((m) => m * p >= v) ?? 10) * p
}

function pick(o: Record<string, number>, keys: string[]) {
  return Object.fromEntries(keys.filter((k) => k in o).map((k) => [k, o[k]]))
}

function signed(v: number) {
  return `${v >= 0 ? '+' : '−'}${Math.round(Math.abs(v) * 100)} points`
}
