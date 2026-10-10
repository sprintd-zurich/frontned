import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { Bookmark, Bot, CheckCircle2, Minus, MousePointerClick, Plus, RotateCcw, Trash2, TrendingUp, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { inputsOf, previewBid, type BidInputs } from '../bidModel'
import { fmtChf, fmtWhen, pct } from '../format'
import { useEstimate, useStore } from '../store'
import type { BidPoint, BidScenario, ExperienceScenario, Parameters, Snapshot } from '../types'
import { Button, Empty } from '../components/ui'
import { CalculatedPrice } from './BidCost'

const TONE: Record<string, string> = { Aggressive: '#ff6a20', Target: '#0785ff', Conservative: '#009c7b', Custom: '#c2410c', Experience: '#7b5cf0' }

export function Bid() {
  const e = useEstimate()
  const bid = e.bid
  const act = useStore((s) => s.act)
  const busy = useStore((s) => s.busy)
  // the Custom window edits these; cards and charts follow at once, the backend gets them a moment later
  const [x, setX] = useState<BidInputs>(() => inputsOf(bid))
  const [dirty, setDirty] = useState(false)
  useEffect(() => {
    if (!dirty) setX(inputsOf(bid))
  }, [bid, dirty])
  const deferred = useDeferredValue(x)
  const target = e.parameters.commercial.target_margin_pct ?? 5.5
  const step = e.parameters.commercial.round_to_chf ?? 1000
  const view = useMemo(() => previewBid(bid, deferred, target, step), [bid, deferred, target, step])
  const timer = useRef<number | undefined>(undefined)
  const change = (patch: Partial<BidInputs>) => {
    const next = { ...x, ...patch }
    setX(next)
    setDirty(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(async () => {
      await act('Recalculating…', (tid) => api.setParameters(tid, { bid: next as unknown as Record<string, number> }))
      setDirty(false)
    }, 700)
  }
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const options = [...view.scenarios, view.custom, ...(view.experience ? [view.experience] : [])]
  const selected = options.find((s) => s.scenario === bid.selected) ?? null
  const choose = (name: string | null) =>
    act('Selecting the bid…', (tid) => api.selectBid(tid, name), name ? `${name} bid goes into the offer and the exports.` : 'Selection cleared: the exports use the indicative selling price.')
  const prices = options.map((s) => s.bid_price_chf)
  const lo = Math.min(...prices)
  const hi = Math.max(...prices)
  return (
    <div className="bid-page">
      <CalculatedPrice />
      <section className="card bid-hero selected-range">
        <div>
          <span className="eyebrow">BID DECISION</span>
          <h1>Selected bid range</h1>
          <p className="muted">
            Bids are calculated on {fmtChf(view.base)}: the cost baseline {fmtChf(bid.cost_baseline_chf)}
            {view.avg > 0 && ` plus ${view.avg.toFixed(1)}% average inflation over ${x.duration_months} months`}. Click a bid below to put it in
            the offer; the priced tender and the workbook carry it.
          </p>
          <div className="range-strip" aria-label="Bid scenarios on one scale">
            {options.map((s) => (
              <button
                key={s.scenario}
                className={s.scenario === bid.selected ? 'on' : ''}
                style={{ left: `${hi > lo ? ((s.bid_price_chf - lo) / (hi - lo)) * 100 : 50}%`, '--tone': TONE[s.scenario] } as React.CSSProperties}
                title={`${s.scenario} · ${fmtChf(s.bid_price_chf)}`}
                onClick={() => choose(s.scenario)}
              >
                <i />
                <small>{s.scenario}</small>
              </button>
            ))}
          </div>
        </div>
        {selected ? (
          <div className="bid-best selected" style={{ '--tone': TONE[selected.scenario] } as React.CSSProperties}>
            <CheckCircle2 size={22} />
            <span>
              <small>Selected for the offer</small>
              <strong>
                {selected.scenario} · {fmtChf(selected.bid_price_chf)}
              </strong>
              <small>
                {selected.margin_pct}% margin · {pct(selected.estimated_win_probability)} win chance · {fmtChf(selected.expected_contribution_chf)}{' '}
                expected
              </small>
            </span>
            <button className="icon-button" aria-label="Clear the selection" title="Clear: use the indicative price" disabled={!!busy} onClick={() => choose(null)}>
              <X size={14} />
            </button>
          </div>
        ) : (
          <div className="bid-best">
            <MousePointerClick size={22} />
            <span>
              <small>No bid selected yet</small>
              <strong>Exports use {fmtChf(e.project.selling_price_rounded_chf)}</strong>
              <small>
                <TrendingUp size={12} /> {view.recommended} has the highest expected contribution
              </small>
            </span>
          </div>
        )}
      </section>
      <div className={`scenario-grid ${view.experience ? 'five' : 'four'}`}>
        {view.scenarios.map((s) => (
          <ScenarioCard key={s.scenario} s={s} best={s.scenario === view.recommended} selected={s.scenario === bid.selected} onSelect={() => choose(s.scenario)} />
        ))}
        <ScenarioCard s={view.custom} best={false} selected={bid.selected === 'Custom'} onSelect={() => choose('Custom')}>
          <small className="muted">
            {view.scenarios.find((s) => s.scenario === 'Target')?.bid_price_chf === view.custom.bid_price_chf
              ? 'Starts at the Target margin: change the Custom margin below to set your own bid.'
              : 'Your margin and market numbers from the Custom window below.'}
          </small>
        </ScenarioCard>
        {view.experience && <ExperienceCard x={view.experience} selected={bid.selected === 'Experience'} onSelect={() => choose('Experience')} />}
      </div>
      <div className="bid-charts">
        <section className="card">
          <h3>Win probability by margin</h3>
          <LineChart
            id="win"
            color="#0785ff"
            curve={view.curve}
            scenarios={view.scenarios}
            extra={[view.custom, ...(view.experience ? [view.experience] : [])]}
            recommended={view.recommended}
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
            curve={view.curve}
            scenarios={view.scenarios}
            extra={[view.custom, ...(view.experience ? [view.experience] : [])]}
            recommended={view.recommended}
            y={(p) => p.expected_contribution_chf}
            fmt={(v) => (v === 0 ? 'CHF 0' : `CHF ${Math.round(v / 1000)}k`)}
          />
          <small className="muted">Peak on the curve at {view.peak}% margin.</small>
        </section>
      </div>
      <div className="bid-bottom">
        <CustomWindow x={x} change={change} saving={dirty} avg={view.avg} base={view.base} baseline={bid.cost_baseline_chf} limits={bid.limits} />
        <Scenarios />
      </div>
    </div>
  )
}

/** A number with round minus / plus buttons either side; type into it too. */
function Stepper({
  label,
  value,
  set,
  step,
  unit,
  min,
  max,
  signed = false,
  help,
}: {
  label: string
  value: number
  set: (v: number) => void
  step: number
  unit: string
  min?: number
  max?: number
  signed?: boolean
  help?: string
}) {
  const [text, setText] = useState<string | null>(null)
  const clamp = (v: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, Math.round(v * 100) / 100))
  const shown = `${signed && value > 0 ? '+' : ''}${Number(value.toFixed(2))}`
  return (
    <div className="stepper">
      <span className="stepper-label">
        {label}
        {help && <small>{help}</small>}
      </span>
      <div className="stepper-control">
        <button aria-label={`Less ${label}`} onClick={() => set(clamp(value - step))} disabled={min != null && value <= min}>
          <Minus size={15} />
        </button>
        <label>
          <input
            aria-label={label}
            inputMode="decimal"
            value={text ?? shown}
            onFocus={(ev) => ev.target.select()}
            onChange={(ev) => setText(ev.target.value)}
            onBlur={() => {
              const v = Number((text ?? '').replace(',', '.').replace('+', ''))
              if (text != null && text.trim() !== '' && Number.isFinite(v)) set(clamp(v))
              setText(null)
            }}
            onKeyDown={(ev) => ev.key === 'Enter' && ev.currentTarget.blur()}
          />
          <span>{unit}</span>
        </label>
        <button aria-label={`More ${label}`} onClick={() => set(clamp(value + step))} disabled={max != null && value >= max}>
          <Plus size={15} />
        </button>
      </div>
    </div>
  )
}

/** The estimator's own numbers: margin, market view, inflation over the project duration. */
function CustomWindow({
  x,
  change,
  saving,
  avg,
  base,
  baseline,
  limits,
}: {
  x: BidInputs
  change: (p: Partial<BidInputs>) => void
  saving: boolean
  avg: number
  base: number
  baseline: number
  limits: { min_probability: number; max_probability: number }
}) {
  const pts = (v: number) => Math.round(v * 1000) / 10
  return (
    <section className="card custom-window">
      <div className="section-heading">
        <div>
          <h3>Custom</h3>
          <p className="muted">Set your own numbers; the Custom bid, the other scenarios and both charts follow as you change them.</p>
        </div>
        <small className={`save-state ${saving ? 'busy' : ''}`}>{saving ? 'Saving…' : 'Saved'}</small>
      </div>
      <div className="custom-groups">
        <div className="custom-group">
          <h4>Your bid</h4>
          <Stepper label="Custom margin" value={x.margin_Custom} set={(v) => change({ margin_Custom: v })} step={0.5} unit="%" min={-20} max={40} />
          <Stepper label="Aggressive margin" value={x.margin_Aggressive} set={(v) => change({ margin_Aggressive: v })} step={0.5} unit="%" min={-20} max={40} />
          <Stepper label="Target margin" value={x.margin_Target} set={(v) => change({ margin_Target: v })} step={0.5} unit="%" min={-20} max={40} />
          <Stepper label="Conservative margin" value={x.margin_Conservative} set={(v) => change({ margin_Conservative: v })} step={0.5} unit="%" min={-20} max={40} />
        </div>
        <div className="custom-group">
          <h4>Market</h4>
          <Stepper
            label="Base win probability"
            help="at the market reference price"
            value={pts(x.reference_win_probability)}
            set={(v) => change({ reference_win_probability: v / 100 })}
            step={1}
            unit="%"
            min={0}
            max={100}
          />
          <Stepper
            label="Win chance lost per +1% price"
            value={pts(x.price_sensitivity_probability_points_per_1pct_price)}
            set={(v) => change({ price_sensitivity_probability_points_per_1pct_price: v / 100 })}
            step={0.5}
            unit="pts"
            min={0}
            max={50}
          />
          <Stepper label="Strategic appetite" value={pts(x.strategic_appetite_adjustment)} set={(v) => change({ strategic_appetite_adjustment: v / 100 })} step={1} unit="pts" signed min={-50} max={50} />
          <Stepper label="Competition" value={pts(x.competition_adjustment)} set={(v) => change({ competition_adjustment: v / 100 })} step={1} unit="pts" signed min={-50} max={50} />
          <small className="muted">
            Win chance stays between {pct(limits.min_probability)} and {pct(limits.max_probability)}.
          </small>
        </div>
        <div className="custom-group">
          <h4>Inflation</h4>
          <Stepper label="Inflation" help="per year" value={x.inflation_pct} set={(v) => change({ inflation_pct: v })} step={0.25} unit="%" min={0} max={20} />
          <Stepper label="Duration" help="project life span" value={x.duration_months} set={(v) => change({ duration_months: v })} step={1} unit="months" min={0} max={120} />
          <div className="inflation-result">
            <span>Average over the duration</span>
            <b>{avg.toFixed(2)}%</b>
            <span>Added to the bids</span>
            <b>{fmtChf(base - baseline)}</b>
            <span>Bids calculated on</span>
            <b>{fmtChf(base)}</b>
          </div>
          <small className="muted">Costs fall evenly over the duration, so on average they are bought half-way through it.</small>
        </div>
      </div>
    </section>
  )
}

/** The bid suggested from the team's experience: same scoring as the calculated scenarios, traced to the Experience tab. */
function ExperienceCard({ x, selected, onSelect }: { x: ExperienceScenario; selected: boolean; onSelect: () => void }) {
  const act = useStore((st) => st.act)
  const navigate = useNavigate()
  return (
    <ScenarioCard s={x} best={false} selected={selected} onSelect={onSelect}>
      <div className="experience-scenario-foot">
        <small className="muted">
          Range {fmtChf(x.low_chf)} – {fmtChf(x.high_chf)} · suggested by {x.model} from the team's experience · {fmtWhen(x.suggestion_at)}
        </small>
        <div>
          <Button
            className="small"
            onClick={() => navigate('/experience')}
          >
            Why this price?
          </Button>
          <button
            className="icon-button"
            aria-label="Remove the Experience scenario"
            title="Remove from the bid"
            onClick={(ev) => {
              ev.stopPropagation()
              act('Removing…', (tid) => api.removeSuggestionScenario(tid), 'Experience scenario removed.')
            }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </ScenarioCard>
  )
}

function ScenarioCard({
  s,
  best,
  selected,
  onSelect,
  children,
}: {
  s: BidScenario
  best: boolean
  selected: boolean
  onSelect: () => void
  children?: React.ReactNode
}) {
  const ai = s.scenario === 'Experience'
  return (
    <section
      className={`card scenario-card selectable ${best ? 'best' : ''} ${selected ? 'selected' : ''}`}
      style={{ '--tone': TONE[s.scenario] ?? '#0785ff' } as React.CSSProperties}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={(ev) => {
        if ((ev.target as HTMLElement).closest('button')) return
        onSelect()
      }}
      onKeyDown={(ev) => (ev.key === 'Enter' || ev.key === ' ') && ev.target === ev.currentTarget && (ev.preventDefault(), onSelect())}
    >
      <div className="section-heading">
        <span className="scenario-name">
          <span className="semicircle" />
          {s.scenario}
        </span>
        {selected ? (
          <span className="badge selected-badge">
            <CheckCircle2 size={12} /> Selected
          </span>
        ) : best ? (
          <span className="badge success">Recommended</span>
        ) : null}
        {ai && (
          <span className="ai-badge">
            <Bot size={12} /> AI suggestion
          </span>
        )}
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
      {children}
      {!selected && <small className="select-hint">Click to use this bid</small>}
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
  extra,
  recommended,
  y,
  fmt,
  max,
  color,
}: {
  id: string
  curve: BidPoint[]
  scenarios: BidScenario[]
  /** drawn as markers only, outside the scenario band (Custom, Experience) */
  extra?: BidScenario[]
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
        {[...scenarios, ...(extra ?? []).filter((x) => x.margin_pct >= 0 && x.margin_pct <= xMax)].map((s, i) => {
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
            Save the current settings, change parameters here or under Calculated price → Project parameters, save again and compare.
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


