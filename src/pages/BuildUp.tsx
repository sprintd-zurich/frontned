import { useMemo } from 'react'
import { ArrowLeft } from 'lucide-react'
import { STATUS_META, STATUS_ORDER, fmtChf, money } from '../format'
import { useEstimate } from '../store'
import type { Status } from '../types'
import { ParamGroup } from '../components/ParamGroup'
import { Badge } from '../components/ui'

const LINE_COLORS = ['#0785ff', '#7fbfff', '#7752d7', '#b9a6ec', '#ff6a20', '#062969', '#009c7b', '#ffb91d', '#ee3547', '#a4aab7']

/** From the priced positions to the indicative selling price, with the project parameters that drive it. */
export function BuildUp({ onBack }: { onBack: () => void }) {
  const e = useEstimate()
  const pr = e.project
  const byStatus = useMemo(() => {
    const m = new Map<Status, { n: number; cost: number }>()
    e.positions.forEach((p) => {
      const v = m.get(p.status) ?? { n: 0, cost: 0 }
      v.n += 1
      v.cost += p.direct_position_cost_chf
      m.set(p.status, v)
    })
    return STATUS_ORDER.filter((s) => m.has(s)).map((s) => [s, m.get(s)!] as const)
  }, [e])
  const posTotal = e.positions.reduce((s, p) => s + p.direct_position_cost_chf, 0) || 1
  const awaiting = e.positions.filter((p) => p.status === 'supplier_quote_required' && p.material_cost_chf === 0).length
  const margin = pr.selling_price_chf - pr.cost_baseline_chf
  return (
    <div className="buildup-page">
      <section className="card">
        <div className="section-heading">
          <div className="inline">
            <h2>Calculation</h2>
            <span className="subtitle">Cost build-up to the indicative selling price</span>
          </div>
          <div className="segmented">
            <button onClick={onBack}>
              <ArrowLeft size={13} /> Positions
            </button>
            <button className="active">Project build-up</button>
          </div>
        </div>
        <div className="buildup-hero">
          <div>
            <small>Indicative selling price</small>
            <strong>{fmtChf(pr.selling_price_rounded_chf)}</strong>
            <small>
              rounded up to CHF 1’000 · {pr.target_margin_pct}% margin · {pr.overhead_pct}% overhead
            </small>
          </div>
          <div className="stack-bar" aria-label="Direct cost composition">
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
      </section>
      <div className="buildup-grid">
        <section className="card">
          <h3>How confident is this price?</h3>
          <table className="status-table">
            <tbody>
              {byStatus.map(([s, v]) => (
                <tr key={s}>
                  <td>
                    <Badge tone={STATUS_META[s].tone} title={STATUS_META[s].help}>
                      {STATUS_META[s].label}
                    </Badge>
                  </td>
                  <td className="num">{v.n} pos.</td>
                  <td className="num">CHF {money(v.cost)}</td>
                  <td className="num muted">{Math.round((100 * v.cost) / posTotal)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted small-note">Supplier quote and assumption amounts are benchmarks: confirm them before submitting.</p>
          {awaiting > 0 && (
            <p className="notice">{awaiting} supplier-quote positions have no material price yet and add only their labour to this total.</p>
          )}
        </section>
        <section className="card">
          <h3>Project parameters</h3>
          <p className="muted small-note">Changing a value recalculates every position and the total.</p>
          <div className="param-grid">
            <ParamGroup title="Productivity factors" group="productivity_factors" values={e.parameters.productivity_factors} step={0.01} />
            <ParamGroup title="Commercial" group="commercial" values={e.parameters.commercial} step={0.5} hide={['round_to_chf']} />
            <ParamGroup title="Allowances" group="allowances" values={e.parameters.allowances} step={0.5} />
            <ParamGroup title="Project costs" group="project_costs" values={e.parameters.project_costs} step={10} />
          </div>
        </section>
      </div>
    </div>
  )
}
