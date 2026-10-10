import { useState } from 'react'
import { fmtNum, money, unit } from '../format'
import { useEstimate } from '../store'
import type { Position } from '../types'
import { SourceLine, Traced } from './Trace'

export const FACTOR_LABEL: Record<string, string> = {
  site_efficiency: 'Site efficiency (÷)',
  school_logistics: 'School logistics',
  mounting_height_school: 'Mounting height (school)',
  mounting_height_sports_hall: 'Mounting height (sports hall)',
  timber_interface: 'Timber interface',
}

/** How the position's number is built, per unit or for the whole quantity; every value links to its source. */
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
              'material_cost_chf',
              `CHF ${money(per(p.material_cost_chf), 2)}`,
              [
                ['Net unit cost', p.net_unit_cost_chf != null ? money(p.net_unit_cost_chf, 2) : 'no price', 'net_unit_cost_chf'],
                ['Waste allowance', `${waste}%`, 'material_cost_chf'],
              ],
              '#0785ff',
              'net_unit_cost_chf',
            ],
            [
              'Installation',
              'adjusted_install_hours',
              `${fmtNum(Math.round(per(p.adjusted_install_hours) * 100) / 100)} h`,
              [
                [`Base hours (${p.install_code ?? '—'})`, fmtNum(p.base_hours_per_unit), 'base_hours_per_unit'],
                ['Project factor', factor ? factor.toFixed(3) : '—', 'adjusted_install_hours'],
              ],
              '#ff6a20',
              'base_hours_per_unit',
            ],
            [
              'Labour cost',
              'labour_cost_chf',
              `CHF ${money(per(p.labour_cost_chf), 2)}`,
              [['Labour rate (CHF/h)', p.hourly_rate_chf != null ? money(p.hourly_rate_chf, 2) : '—', 'hourly_rate_chf']],
              '#ffb91d',
              'hourly_rate_chf',
            ],
            [
              'Direct position cost',
              'direct_position_cost_chf',
              `CHF ${money(per(p.direct_position_cost_chf), 2)}`,
              [
                ['Material', money(per(p.material_cost_chf), 2), 'material_cost_chf'],
                ['Labour', money(per(p.labour_cost_chf), 2), 'labour_cost_chf'],
              ],
              '#082365',
              'direct_position_cost_chf',
            ],
          ] as const
        ).map(([name, field, value, rows, color, from]) => (
          <div className="cost-step" key={name}>
            <i style={{ background: color }} />
            <div>
              <strong>{name}</strong>
              <p>
                <Traced trace={p.trace[field]}>{value}</Traced>
                {!total && ` / ${u}`}
              </p>
              <SourceLine trace={p.trace[from]} />
            </div>
            <div className="cost-detail">
              {rows.map(([k, v, f]) => (
                <div key={k}>
                  <small>{k}</small>
                  <Traced trace={p.trace[f]}>
                    <b>{v}</b>
                  </Traced>
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
        <Traced trace={p.trace.direct_position_cost_chf}>
          <strong>CHF {money(p.direct_position_cost_chf, 2)}</strong>
        </Traced>
      </div>
    </>
  )
}
