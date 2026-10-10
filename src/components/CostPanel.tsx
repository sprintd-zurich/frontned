import { useState } from 'react'
import { fmtNum, money, unit } from '../format'
import { useEstimate } from '../store'
import type { Position } from '../types'

export const FACTOR_LABEL: Record<string, string> = {
  site_efficiency: 'Site efficiency (÷)',
  school_logistics: 'School logistics',
  mounting_height_school: 'Mounting height (school)',
  mounting_height_sports_hall: 'Mounting height (sports hall)',
  timber_interface: 'Timber interface',
}

/** How the position's number is built, per unit or for the whole quantity. */
export function CostPanel({ p, heading = true }: { p: Position; heading?: boolean }) {
  const e = useEstimate()
  const [total, setTotal] = useState(false)
  const waste = e.parameters.allowances.material_waste_pct ?? 0
  const qty = p.quantity ?? 0
  const per = (v: number) => (total ? v : qty ? v / qty : 0)
  const u = unit(p.unit)
  const factor = p.base_hours_per_unit && qty ? p.adjusted_install_hours / (qty * p.base_hours_per_unit) : null
  const parts = [
    ['Material', p.material_cost_chf, '#0785ff'],
    ['Labour', p.labour_cost_chf, '#ffb91d'],
  ] as const
  const sum = p.direct_position_cost_chf || 1
  return (
    <>
      <div className="section-heading">
        {heading ? <h2>Calculation</h2> : <h3>Cost composition</h3>}
        <div className="segmented">
          <button className={!total ? 'active' : ''} onClick={() => setTotal(false)}>
            Unit
          </button>
          <button className={total ? 'active' : ''} onClick={() => setTotal(true)}>
            Total
          </button>
        </div>
      </div>
      <div className="cost-steps">
        {(
          [
            [
              'Material cost',
              `CHF ${money(per(p.material_cost_chf), 2)}`,
              [
                ['Net unit cost', p.net_unit_cost_chf != null ? money(p.net_unit_cost_chf, 2) : 'no price'],
                [`Waste allowance`, `${waste}%`],
                ['Source', p.price_source?.replace(/_/g, ' ') ?? '—'],
              ],
              '#0785ff',
            ],
            [
              'Installation',
              `${fmtNum(Math.round(per(p.adjusted_install_hours) * 100) / 100)} h`,
              [
                [`Base hours (${p.install_code ?? '—'})`, fmtNum(p.base_hours_per_unit)],
                ['Project factor', factor ? factor.toFixed(3) : '—'],
              ],
              '#ff6a20',
            ],
            [
              'Labour cost',
              `CHF ${money(per(p.labour_cost_chf), 2)}`,
              [['Labour rate (CHF/h)', p.hourly_rate_chf != null ? money(p.hourly_rate_chf, 2) : '—']],
              '#ffb91d',
            ],
            [
              'Direct position cost',
              `CHF ${money(per(p.direct_position_cost_chf), 2)}`,
              [
                ['Material', money(per(p.material_cost_chf), 2)],
                ['Labour', money(per(p.labour_cost_chf), 2)],
              ],
              '#082365',
            ],
          ] as const
        ).map(([name, value, rows, color]) => (
          <div className="cost-step" key={name}>
            <i style={{ background: color }} />
            <div>
              <strong>{name}</strong>
              <p>
                {value}
                {!total && ` / ${u}`}
              </p>
            </div>
            <div className="cost-detail">
              {rows.map(([k, v]) => (
                <div key={k}>
                  <small>{k}</small>
                  <b>{v}</b>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {p.direct_position_cost_chf > 0 && (
        <div className="composition" aria-label="Cost composition">
          {parts.map(([k, v, c]) => (
            <span key={k} style={{ width: `${(v / sum) * 100}%`, background: c }} title={`${k} ${Math.round((v / sum) * 100)}%`} />
          ))}
        </div>
      )}
      <div className="total-strip">
        <span>
          <b>Total for quantity</b>
          <small>
            {fmtNum(p.quantity)} {u}
            {p.factors_applied.length > 0 && ` · ${p.factors_applied.map((f) => FACTOR_LABEL[f] ?? f).join(', ')}`}
          </small>
        </span>
        <strong>CHF {money(p.direct_position_cost_chf, 2)}</strong>
      </div>
    </>
  )
}
