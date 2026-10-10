import { useState } from 'react'
import { ChevronDown, ChevronRight, SlidersHorizontal } from 'lucide-react'
import { fmtChf } from '../format'
import { useEstimate } from '../store'
import { ParamGroup } from '../components/ParamGroup'

const LINE_COLORS = ['#0785ff', '#7fbfff', '#7752d7', '#b9a6ec', '#ff6a20', '#062969', '#009c7b', '#ffb91d', '#ee3547', '#a4aab7']

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
      <div className="buildup-hero baseline-first">
        <div className="baseline-main">
          <small>Cost baseline</small>
          <strong>{fmtChf(pr.cost_baseline_chf)}</strong>
          <small>
            direct cost {fmtChf(pr.direct_cost_chf)} + {pr.overhead_pct}% overhead
          </small>
        </div>
        <span className="baseline-op">+</span>
        <div className="baseline-step">
          <small>Base margin {pr.target_margin_pct}%</small>
          <b>{fmtChf(margin)}</b>
          <small>baseline ÷ (1 − {pr.target_margin_pct}%)</small>
        </div>
        <span className="baseline-op">=</span>
        <div className="baseline-step">
          <small>Indicative selling price</small>
          <b>{fmtChf(pr.selling_price_rounded_chf)}</b>
          <small>rounded up to CHF 1’000</small>
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
          <tr className="subtotal baseline-row">
            <td>Cost baseline</td>
            <td />
            <td className="num">{fmtChf(pr.cost_baseline_chf)}</td>
          </tr>
          <tr>
            <td>
              <i style={{ background: '#00987a' }} />
              Base margin
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
