import { useMemo, useState } from 'react'
import type { Estimate, Parameters, Status } from '../types'
import { STATUS_META, STATUS_ORDER, fmtChf } from '../format'
import { StatusChip } from './PositionsView'

interface Props {
  estimate: Estimate
  onParams: (b: Partial<Parameters>) => void
}

const PARAM_LABELS: Record<string, string> = {
  site_efficiency: 'Site efficiency',
  school_logistics: 'School logistics',
  mounting_height_school: 'Mounting height (school)',
  mounting_height_sports_hall: 'Mounting height (sports hall)',
  timber_interface: 'Timber interface',
  overhead_pct: 'Overhead %',
  target_margin_pct: 'Target margin %',
  material_waste_pct: 'Material waste %',
  small_material_pct: 'Small material %',
  transport_equipment_pct: 'Transport & equipment %',
  supplier_package_contingency_pct: 'Supplier contingency %',
  engineering_hours: 'Engineering hours',
  engineering_rate_chf_per_h: 'Engineering rate CHF/h',
  commissioning_hours: 'Commissioning hours',
  commissioning_rate_chf_per_h: 'Commissioning rate CHF/h',
  hygiene_inspection_chf: 'Hygiene inspection CHF',
  documentation_chf: 'Documentation CHF',
}

export function BuildUpView({ estimate, onParams }: Props) {
  const { project, positions } = estimate

  const bySystem = useMemo(() => {
    const m = new Map<string, { material: number; labour: number }>()
    positions.forEach((p) => {
      const v = m.get(p.system) ?? { material: 0, labour: 0 }
      v.material += p.material_cost_chf
      v.labour += p.labour_cost_chf
      m.set(p.system, v)
    })
    return [...m.entries()].sort((a, b) => b[1].material + b[1].labour - (a[1].material + a[1].labour))
  }, [positions])
  const maxSys = Math.max(...bySystem.map(([, v]) => v.material + v.labour), 1)

  const byStatus = useMemo(() => {
    const m = new Map<Status, { n: number; cost: number }>()
    positions.forEach((p) => {
      const v = m.get(p.status) ?? { n: 0, cost: 0 }
      v.n += 1
      v.cost += p.direct_position_cost_chf
      m.set(p.status, v)
    })
    return STATUS_ORDER.filter((s) => m.has(s)).map((s) => [s, m.get(s)!] as const)
  }, [positions])
  const positionsTotal = positions.reduce((s, p) => s + p.direct_position_cost_chf, 0)

  return (
    <div className="buildup">
      <section className="card wide">
        <div className="card-title">Cost build-up to indicative selling price</div>
        <table className="buildup-table">
          <tbody>
            {project.cost_lines.map((l) => (
              <tr key={l.label}>
                <td>{l.label}</td>
                <td className="muted small">{l.basis}</td>
                <td className="num">{fmtChf(l.amount_chf)}</td>
              </tr>
            ))}
            <tr className="subtotal">
              <td>Direct cost</td>
              <td />
              <td className="num">{fmtChf(project.direct_cost_chf)}</td>
            </tr>
            <tr>
              <td>Overhead</td>
              <td className="muted small">{project.overhead_pct}% of direct cost</td>
              <td className="num">{fmtChf(project.overhead_chf)}</td>
            </tr>
            <tr className="subtotal">
              <td>Cost baseline</td>
              <td />
              <td className="num">{fmtChf(project.cost_baseline_chf)}</td>
            </tr>
            <tr>
              <td>Margin</td>
              <td className="muted small">
                baseline ÷ (1 − {project.target_margin_pct}%) = {fmtChf(project.selling_price_chf)}
              </td>
              <td className="num">{fmtChf(project.selling_price_chf - project.cost_baseline_chf)}</td>
            </tr>
            <tr className="grand">
              <td>Indicative selling price</td>
              <td className="muted small">rounded up to CHF 1'000</td>
              <td className="num">{fmtChf(project.selling_price_rounded_chf)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="card">
        <div className="card-title">Direct position cost by system</div>
        <div className="bars">
          {bySystem.map(([s, v]) => (
            <div key={s} className="bar-row">
              <div className="bar-label">{s}</div>
              <div className="bar-track">
                <span className="bar material" style={{ width: `${(100 * v.material) / maxSys}%` }} />
                <span className="bar labour" style={{ width: `${(100 * v.labour) / maxSys}%` }} />
              </div>
              <div className="bar-value">{fmtChf(v.material + v.labour)}</div>
            </div>
          ))}
        </div>
        <div className="legend">
          <span>
            <i className="material" /> Material and packages
          </span>
          <span>
            <i className="labour" /> Installation labour
          </span>
        </div>
      </section>

      <section className="card">
        <div className="card-title">How confident is this price?</div>
        <table className="status-table">
          <tbody>
            {byStatus.map(([s, v]) => (
              <tr key={s}>
                <td>
                  <StatusChip status={s} />
                </td>
                <td className="num">{v.n} pos.</td>
                <td className="num">{fmtChf(v.cost)}</td>
                <td className="num muted">{Math.round((100 * v.cost) / Math.max(positionsTotal, 1))}%</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted small">
          {STATUS_META.supplier_quote_required.label} and {STATUS_META.assumption_applied.label.toLowerCase()} amounts
          are benchmarks: confirm them before submitting.
        </p>
      </section>

      <section className="card wide">
        <div className="card-title">Project parameters</div>
        <div className="param-grid">
          <ParamGroup title="Productivity factors" group="productivity_factors" values={estimate.parameters.productivity_factors} onParams={onParams} step={0.01} />
          <ParamGroup title="Commercial" group="commercial" values={estimate.parameters.commercial} onParams={onParams} step={0.5} hide={['round_to_chf']} />
          <ParamGroup title="Allowances" group="allowances" values={estimate.parameters.allowances} onParams={onParams} step={0.5} />
          <ParamGroup title="Project costs" group="project_costs" values={estimate.parameters.project_costs} onParams={onParams} step={10} />
        </div>
      </section>
    </div>
  )
}

function ParamGroup({
  title,
  group,
  values,
  onParams,
  step,
  hide = [],
}: {
  title: string
  group: keyof Parameters
  values: Record<string, number>
  onParams: (b: Partial<Parameters>) => void
  step: number
  hide?: string[]
}) {
  const [draft, setDraft] = useState<Record<string, string>>({})
  return (
    <div className="param-group">
      <div className="filter-title">{title}</div>
      {Object.entries(values)
        .filter(([k]) => !hide.includes(k))
        .map(([k, v]) => (
          <label key={k} className="param">
            <span>{PARAM_LABELS[k] ?? k}</span>
            <input
              type="number"
              step={step}
              value={draft[k] ?? String(v)}
              onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
              onBlur={() => {
                const n = Number(draft[k])
                if (draft[k] !== undefined && !Number.isNaN(n) && n !== v) onParams({ [group]: { [k]: n } })
                setDraft(({ [k]: _drop, ...rest }) => rest)
              }}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            />
          </label>
        ))}
    </div>
  )
}
