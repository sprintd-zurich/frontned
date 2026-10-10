import { useState } from 'react'
import { Bookmark, RotateCcw, Trash2, TrendingUp } from 'lucide-react'
import { fmtChf, pct } from '../format'
import { useEstimate, useStore } from '../store'
import type { BidPoint, BidScenario, Parameters, Snapshot } from '../types'
import { ParamGroup } from '../components/ParamGroup'
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
          <LineChart
            id="win"
            color="#0785ff"
            curve={bid.curve}
            scenarios={bid.scenarios}
            recommended={bid.recommended}
            y={(p) => p.estimated_win_probability}
            fmt={pct}
            max={1}
          />
        </section>
        <section className="card">
          <h3>Expected contribution by margin</h3>
          <LineChart
            id="contribution"
            color="#7b61ff"
            curve={bid.curve}
            scenarios={bid.scenarios}
            recommended={bid.recommended}
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

/** Smooth path through the points (monotone cubic, so the curve never overshoots the data). */
function smooth(pts: [number, number][]) {
  const n = pts.length
  if (n < 3) return pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join('')
  const d = pts.slice(1).map(([x, y], i) => (y - pts[i][1]) / (x - pts[i][0]))
  const m = pts.map((_, i) => (i === 0 ? d[0] : i === n - 1 ? d[n - 2] : d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2))
  let out = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = pts[i]
    const [x1, y1] = pts[i + 1]
    const h = (x1 - x0) / 3
    out += `C${(x0 + h).toFixed(1)},${(y0 + m[i] * h).toFixed(1)} ${(x1 - h).toFixed(1)},${(y1 - m[i + 1] * h).toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`
  }
  return out
}

function LineChart({
  id,
  curve,
  scenarios,
  recommended,
  y,
  fmt,
  max,
  color,
}: {
  id: string
  curve: BidPoint[]
  scenarios: BidScenario[]
  recommended: string
  y: (p: BidPoint) => number
  fmt: (v: number) => string
  max?: number
  color: string
}) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 760
  const H = 290
  const L = 62
  const R = 18
  const T = 30
  const B = 34
  const xMax = curve[curve.length - 1].margin_pct
  const yMax = max ?? niceCeil(Math.max(...curve.map(y)) * 1.08)
  const sx = (m: number) => L + (m / xMax) * (W - L - R)
  const sy = (v: number) => T + (1 - v / yMax) * (H - T - B)
  const path = smooth(curve.map((p) => [sx(p.margin_pct), sy(y(p))]))
  const area = `${path}L${sx(xMax).toFixed(1)},${sy(0)}L${sx(0)},${sy(0)}Z`
  const margins = scenarios.map((s) => s.margin_pct)
  const band = [Math.min(...margins), Math.max(...margins)]
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
        <defs>
          <linearGradient id={`fill-${id}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
          <filter id={`glow-${id}`} x="-10%" y="-10%" width="120%" height="140%">
            <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor={color} floodOpacity="0.28" />
          </filter>
          <clipPath id={`plot-${id}`}>
            <rect x={L} y={0} width={W - L - R} height={sy(0)} />
          </clipPath>
        </defs>
        <rect x={sx(band[0])} y={T - 6} width={sx(band[1]) - sx(band[0])} height={H - T - B + 6} rx={8} className="band" />
        <text x={(sx(band[0]) + sx(band[1])) / 2} y={T - 12} className="axis band-label" textAnchor="middle">
          bid range
        </text>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line x1={L} x2={W - R} y1={sy(f * yMax)} y2={sy(f * yMax)} className={f ? 'grid' : 'baseline'} />
            <text x={L - 10} y={sy(f * yMax) + 4} className="axis" textAnchor="end">
              {fmt(f * yMax)}
            </text>
          </g>
        ))}
        {[0, 2, 4, 6, 8, 10, 12].filter((m) => m <= xMax).map((m) => (
          <text key={m} x={sx(m)} y={H - 12} className="axis" textAnchor="middle">
            {m}%
          </text>
        ))}
        <g clipPath={`url(#plot-${id})`}>
          <path d={area} fill={`url(#fill-${id})`} />
          <path d={path} className="line" stroke={color} filter={`url(#glow-${id})`} />
        </g>
        {scenarios.map((s, i) => {
          const v = y({ ...curve[0], ...s })
          const tone = TONE[s.scenario]
          const label = s.scenario === recommended ? `${s.scenario} ★` : s.scenario
          const w = label.length * 6.2 + 14
          return (
            <g key={s.scenario}>
              <line x1={sx(s.margin_pct)} x2={sx(s.margin_pct)} y1={sy(v)} y2={sy(0)} stroke={tone} className="drop" />
              <circle cx={sx(s.margin_pct)} cy={sy(v)} r={9} fill={tone} opacity={0.18} />
              <circle cx={sx(s.margin_pct)} cy={sy(v)} r={5} fill={tone} stroke="#fff" strokeWidth={2} />
              <g transform={`translate(${sx(s.margin_pct) - w / 2},${sy(v) + (i % 2 ? 14 : -30)})`}>
                <rect width={w} height={18} rx={9} fill={tone} />
                <text x={w / 2} y={12.5} className="pill-label" textAnchor="middle">
                  {label}
                </text>
              </g>
            </g>
          )
        })}
        {h && (
          <g>
            <line x1={sx(h.margin_pct)} x2={sx(h.margin_pct)} y1={T} y2={H - B} className="crosshair" />
            <circle cx={sx(h.margin_pct)} cy={sy(y(h))} r={5} fill="#fff" stroke={color} strokeWidth={2.5} />
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
            Save the current settings, change parameters here or under Review → Project build-up, save again and compare.
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
