import { useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronRight, SlidersHorizontal } from 'lucide-react'
import { metrics, systemsOf } from '../derive'
import { fmtChf, money } from '../format'
import { useEstimate, useStore } from '../store'
import { ParamGroup } from '../components/ParamGroup'

const LINE_COLORS = ['#0785ff', '#7fbfff', '#7752d7', '#b9a6ec', '#ff6a20', '#062969', '#009c7b', '#ffb91d', '#ee3547', '#a4aab7']

/** Direct cost per ventilation system; a click opens its positions. */
export function SystemsSummary() {
  const e = useEstimate()
  const filter = useStore((s) => s.filter)
  const navigate = useNavigate()
  const rows = systemsOf(e.positions).map((s) => {
    const ps = e.positions.filter((p) => p.system === s.id)
    return { s, m: metrics(ps), hours: ps.reduce((a, p) => a + p.adjusted_install_hours, 0) }
  })
  const max = Math.max(...rows.map((r) => r.m.value), 1)
  const total = rows.reduce((a, r) => a + r.m.value, 0)
  return (
    <section className="card systems-summary">
      <div className="section-heading">
        <div className="inline">
          <h2>Systems</h2>
          <span className="subtitle">
            {rows.length} systems · {fmtChf(total)} direct position cost
          </span>
        </div>
      </div>
      <div className="system-rows">
        {rows.map(({ s, m, hours }) => (
          <button
            key={s.id}
            className="system-row"
            style={{ '--system-color': s.color } as CSSProperties}
            onClick={() => {
              filter({ system: s.id, category: 'all', pill: 'all', search: '', only: null })
              navigate('/positions')
            }}
            title={`Open the ${m.total} positions of ${s.id}`}
          >
            <span className="system-name">
              <i />
              <strong>{s.name}</strong>
              <small>
                {s.code} · {m.total} pos. · {money(hours)} h
              </small>
            </span>
            <span className="system-bar">
              <span style={{ width: `${(100 * m.value) / max}%` }} />
            </span>
            <b>CHF {money(m.value)}</b>
            <small className="muted">{m.percent}% approved</small>
            <ChevronRight size={15} />
          </button>
        ))}
      </div>
    </section>
  )
}

/** From the priced positions to the selling price, each line with its basis; the parameters behind it can be edited here. */
export function CalculatedPrice() {
  const e = useEstimate()
  const pr = e.project
  const [edit, setEdit] = useState(false)
  const margin = pr.selling_price_chf - pr.cost_baseline_chf
  return (
    <section className="card calculated-price">
      <div className="section-heading">
        <div className="inline">
          <h2>Calculated price</h2>
          <span className="subtitle">from the priced positions to the indicative selling price</span>
        </div>
        <button className={`button small ${edit ? 'pressed' : ''}`} onClick={() => setEdit(!edit)}>
          <SlidersHorizontal size={15} /> Project parameters {edit ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
      </div>
      <div className="buildup-hero">
        <div>
          <small>Indicative selling price</small>
          <strong>{fmtChf(pr.selling_price_rounded_chf)}</strong>
          <small>
            rounded up to CHF 1’000 · {pr.target_margin_pct}% margin · {pr.overhead_pct}% overhead
          </small>
        </div>
        <div className="stack-bar" aria-label="Price composition">
          {pr.cost_lines.map((l, i) => (
            <span
              key={l.label}
              style={{ width: `${(l.amount_chf / pr.selling_price_rounded_chf) * 100}%`, background: LINE_COLORS[i % LINE_COLORS.length] }}
              title={`${l.label}: ${fmtChf(l.amount_chf)}`}
            />
          ))}
          <span style={{ width: `${(pr.overhead_chf / pr.selling_price_rounded_chf) * 100}%`, background: '#c4cad3' }} title="Overhead" />
          <span style={{ width: `${(margin / pr.selling_price_rounded_chf) * 100}%`, background: '#00987a' }} title="Margin" />
        </div>
      </div>
      <table className="buildup-table">
        <tbody>
          {pr.cost_lines.map((l, i) => (
            <tr key={l.label}>
              <td>
                <i style={{ background: LINE_COLORS[i % LINE_COLORS.length] }} />
                {l.label}
              </td>
              <td className="muted">{l.basis}</td>
              <td className="num">{fmtChf(l.amount_chf)}</td>
            </tr>
          ))}
          <tr className="subtotal">
            <td>Direct cost</td>
            <td />
            <td className="num">{fmtChf(pr.direct_cost_chf)}</td>
          </tr>
          <tr>
            <td>
              <i style={{ background: '#c4cad3' }} />
              Overhead
            </td>
            <td className="muted">{pr.overhead_pct}% of direct cost</td>
            <td className="num">{fmtChf(pr.overhead_chf)}</td>
          </tr>
          <tr className="subtotal">
            <td>Cost baseline</td>
            <td />
            <td className="num">{fmtChf(pr.cost_baseline_chf)}</td>
          </tr>
          <tr>
            <td>
              <i style={{ background: '#00987a' }} />
              Margin
            </td>
            <td className="muted">
              baseline ÷ (1 − {pr.target_margin_pct}%) = {fmtChf(pr.selling_price_chf)}
            </td>
            <td className="num">{fmtChf(margin)}</td>
          </tr>
          <tr className="grand">
            <td>Indicative selling price</td>
            <td className="muted">rounded up to CHF 1’000</td>
            <td className="num">{fmtChf(pr.selling_price_rounded_chf)}</td>
          </tr>
        </tbody>
      </table>
      {edit && (
        <div className="param-grid">
          <ParamGroup title="Productivity factors" group="productivity_factors" values={e.parameters.productivity_factors} step={0.01} />
          <ParamGroup title="Commercial" group="commercial" values={e.parameters.commercial} step={0.5} hide={['round_to_chf']} />
          <ParamGroup title="Allowances" group="allowances" values={e.parameters.allowances} step={0.5} />
          <ParamGroup title="Project costs" group="project_costs" values={e.parameters.project_costs} step={10} />
        </div>
      )}
    </section>
  )
}
