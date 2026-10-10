import { useState } from 'react'
import { Bookmark, RotateCcw, Trash2, TrendingUp } from 'lucide-react'
import { fmtChf, pct } from '../format'
import { useEstimate, useStore } from '../store'
import type { BidPoint, BidScenario, Parameters, Snapshot } from '../types'
import { ParamGroup } from '../components/ParamGroup'
import { ConfidenceStrip } from '../components/Confidence'
import { Button, Empty } from '../components/ui'

const TONE: Record<string, string> = { Aggressive: '#ff6a20', Target: '#0785ff', Conservative: '#009c7b' }

export function Bid() {
  const e = useEstimate()
  const bid = e.bid
  const best = bid.scenarios.find((s) => s.scenario === bid.recommended)!
  return (
    <div className="bid-page">
      <section className="card bid-hero">
        <div>
          <span className="eyebrow">BID DECISION</span>
          <h1>Recommended bid range</h1>
          <p className="muted">
            Cost baseline {fmtChf(bid.cost_baseline_chf)} · market reference price {fmtChf(bid.reference_price_chf)} (baseline at
            the standard {e.parameters.commercial.target_margin_pct ?? 5.5}% margin)
          </p>
        </div>
        <div className="bid-best">
          <TrendingUp size={22} />
          <span>
            <small>Highest expected contribution</small>
            <strong>
              {best.scenario} · {fmtChf(best.bid_price_chf)}
            </strong>
            <small>
              {pct(best.estimated_win_probability)} win chance · {fmtChf(best.expected_contribution_chf)} expected
            </small>
          </span>
        </div>
      </section>
      <div className="scenario-grid">
        {bid.scenarios.map((s) => (
          <ScenarioCard key={s.scenario} s={s} best={s.scenario === bid.recommended} />
        ))}
      </div>
      <div className="bid-charts">
        <section className="card">
          <h3>Win probability by margin</h3>
          <LineChart curve={bid.curve} scenarios={bid.scenarios} y={(p) => p.estimated_win_probability} fmt={pct} max={1} />
        </section>
        <section className="card">
          <h3>Expected contribution by margin</h3>
          <LineChart
            curve={bid.curve}
            scenarios={bid.scenarios}
            y={(p) => p.expected_contribution_chf}
            fmt={(v) => (v === 0 ? 'CHF 0' : `CHF ${Math.round(v / 1000)}k`)}
          />
          <small className="muted">Peak on the curve at {bid.peak_margin_pct}% margin.</small>
        </section>
      </div>
      <section className="card">
        <h3>How the probability is estimated</h3>
        <p className="formula">
          win probability = base {pct(bid.inputs.reference_win_probability)} + strategic appetite{' '}
          {signed(bid.inputs.strategic_appetite_adjustment)} + competition {signed(bid.inputs.competition_adjustment)} −{' '}
          {Math.round(bid.inputs.price_sensitivity_probability_points_per_1pct_price * 100)} points for every 1% above the
          reference price, kept between {pct(bid.limits.min_probability)} and {pct(bid.limits.max_probability)}.
          <br />
          bid price = cost baseline ÷ (1 − margin), rounded up to CHF 1’000 · expected contribution = win probability × (bid
          price − cost baseline)
        </p>
        <div className="param-grid two">
          <ParamGroup
            title="Market and strategy (what-if)"
            group="bid"
            values={pick(bid.inputs, [
              'reference_win_probability',
              'price_sensitivity_probability_points_per_1pct_price',
              'strategic_appetite_adjustment',
              'competition_adjustment',
            ])}
            step={0.01}
          />
          <ParamGroup title="Scenario margins" group="bid" values={pick(bid.inputs, ['margin_Aggressive', 'margin_Target', 'margin_Conservative'])} step={0.5} />
        </div>
      </section>
      <Scenarios />
      <div className="page-notes">
        <ConfidenceStrip compact />
      </div>
    </div>
  )
}

function ScenarioCard({ s, best }: { s: BidScenario; best: boolean }) {
  return (
    <section className={`card scenario-card ${best ? 'best' : ''}`} style={{ '--tone': TONE[s.scenario] ?? '#0785ff' } as React.CSSProperties}>
      <div className="section-heading">
        <span className="scenario-name">
          <span className="semicircle" />
          {s.scenario}
        </span>
        {best && <span className="badge success">Recommended</span>}
      </div>
      <strong className="scenario-price">{fmtChf(s.bid_price_chf)}</strong>
      <dl>
        <div>
          <dt>Margin</dt>
          <dd>{s.margin_pct}%</dd>
        </div>
        <div>
          <dt>Win probability</dt>
          <dd>
            <span className="prob">
              <span style={{ width: pct(s.estimated_win_probability) }} />
            </span>
            {pct(s.estimated_win_probability)}
          </dd>
        </div>
        <div>
          <dt>Expected contribution</dt>
          <dd>{fmtChf(s.expected_contribution_chf)}</dd>
        </div>
      </dl>
    </section>
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
  const W = 520
  const H = 220
  const L = 64
  const R = 14
  const T = 16
  const B = 30
  const xMax = curve[curve.length - 1].margin_pct
  const yMax = max ?? niceCeil(Math.max(...curve.map(y)) * 1.05)
  const sx = (m: number) => L + (m / xMax) * (W - L - R)
  const sy = (v: number) => T + (1 - v / yMax) * (H - T - B)
  const path = curve.map((p, i) => `${i ? 'L' : 'M'}${sx(p.margin_pct).toFixed(1)},${sy(y(p)).toFixed(1)}`).join('')
  const area = `${path}L${sx(xMax)},${sy(0)}L${sx(0)},${sy(0)}Z`
  const h = hover != null ? curve[hover] : null
  return (
    <div className="chart-wrap">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="chart"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(ev) => {
          const r = (ev.currentTarget as SVGSVGElement).getBoundingClientRect()
          const m = ((((ev.clientX - r.left) / r.width) * W - L) / (W - L - R)) * xMax
          const i = Math.round(m / (xMax / (curve.length - 1)))
          setHover(Math.max(0, Math.min(curve.length - 1, i)))
        }}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line x1={L} x2={W - R} y1={sy(f * yMax)} y2={sy(f * yMax)} className="grid" />
            <text x={L - 8} y={sy(f * yMax) + 4} className="axis" textAnchor="end">
              {fmt(f * yMax)}
            </text>
          </g>
        ))}
        {[0, 2, 4, 6, 8, 10, 12].filter((m) => m <= xMax).map((m) => (
          <text key={m} x={sx(m)} y={H - 10} className="axis" textAnchor="middle">
            {m}%
          </text>
        ))}
        <path d={area} className="area" />
        <path d={path} className="line" />
        {scenarios.map((s) => {
          const v = y({ ...curve[0], ...s })
          return (
            <g key={s.scenario}>
              <circle cx={sx(s.margin_pct)} cy={sy(v)} r={5.5} fill={TONE[s.scenario]} stroke="#fff" strokeWidth={2} />
              <text x={sx(s.margin_pct)} y={sy(v) - 11} className="axis label" textAnchor="middle">
                {s.scenario}
              </text>
            </g>
          )
        })}
        {h && (
          <g>
            <line x1={sx(h.margin_pct)} x2={sx(h.margin_pct)} y1={T} y2={H - B} className="crosshair" />
            <circle cx={sx(h.margin_pct)} cy={sy(y(h))} r={4} className="hover-dot" />
          </g>
        )}
      </svg>
      {h && (
        <div className="chart-tip" style={{ left: `${(sx(h.margin_pct) / W) * 100}%` }}>
          <strong>{h.margin_pct}% margin</strong>
          <span>Bid {fmtChf(h.bid_price_chf)}</span>
          <span>Win {pct(h.estimated_win_probability)}</span>
          <span>Expected {fmtChf(h.expected_contribution_chf)}</span>
        </div>
      )}
    </div>
  )
}

function Scenarios() {
  const e = useEstimate()
  const { saveSnapshot, applySnapshot, deleteSnapshot, busy } = useStore()
  const [name, setName] = useState('')
  const snaps = e.snapshots
  return (
    <section className="card">
      <div className="section-heading">
        <div>
          <h3>Scenario comparison</h3>
          <p className="muted">
            Save the current settings, change parameters here or under Calculation → Project build-up, save again and compare.
            Position edits stay as they are when you restore a scenario.
          </p>
        </div>
      </div>
      <form
        className="snap-form"
        onSubmit={(ev) => {
          ev.preventDefault()
          saveSnapshot(name.trim() || `Scenario ${snaps.length + 1}`)
          setName('')
        }}
      >
        <input placeholder="Name, e.g. Higher labour rate" value={name} onChange={(ev) => setName(ev.target.value)} />
        <Button primary type="submit" disabled={!!busy}>
          <Bookmark size={15} /> Save current as scenario
        </Button>
      </form>
      {snaps.length ? <Comparison snaps={snaps} onApply={applySnapshot} onDelete={deleteSnapshot} /> : <Empty icon={<Bookmark size={26} />} title="No saved scenarios yet" />}
    </section>
  )
}

function Comparison({ snaps, onApply, onDelete }: { snaps: Snapshot[]; onApply: (id: string) => void; onDelete: (id: string) => void }) {
  const base = snaps[0].summary
  const rows: [string, (s: Snapshot['summary']) => number, (v: number) => string, ((d: number) => string)?][] = [
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
    <div className="table-scroll">
      <table className="position-table compare-table">
        <thead>
          <tr>
            <th />
            {snaps.map((s, i) => (
              <th key={s.id} className="num">
                {s.name}
                {i === 0 && <small> reference</small>}
                <span className="snap-actions">
                  <button className="text-button" onClick={() => onApply(s.id)} title="Restore these parameters">
                    <RotateCcw size={12} /> Restore
                  </button>
                  <button className="text-button" onClick={() => onDelete(s.id)} title="Remove scenario">
                    <Trash2 size={12} />
                  </button>
                </span>
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
                      <small className={`delta ${d > 0 ? 'up' : 'down'}`}>
                        {d > 0 ? '+' : '−'}
                        {(fd ?? f)(Math.abs(d))}
                      </small>
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
              <td key={s.id} className="num muted">
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
  const p = 10 ** Math.floor(Math.log10(v || 1))
  return ([1, 2, 4, 5, 10].find((m) => m * p >= v) ?? 10) * p
}

function pick(o: Record<string, number>, keys: string[]) {
  return Object.fromEntries(keys.filter((k) => k in o).map((k) => [k, o[k]]))
}

function signed(v: number) {
  return `${v >= 0 ? '+' : '−'}${Math.round(Math.abs(v) * 100)} points`
}
