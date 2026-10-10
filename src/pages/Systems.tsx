import { useNavigate } from 'react-router-dom'
import { ChevronRight, Layers } from 'lucide-react'
import { metrics, systemsOf } from '../derive'
import { tenderPath } from '../routes'
import { fmtChf, money } from '../format'
import { useEstimate, useStore } from '../store'
import { Progress } from '../components/ui'

export function Systems() {
  const e = useEstimate()
  const filter = useStore((s) => s.filter)
  const navigate = useNavigate()
  const systems = systemsOf(e.positions)
  const rows = systems.map((s) => {
    const ps = e.positions.filter((p) => p.system === s.id)
    return {
      s,
      m: metrics(ps),
      material: ps.reduce((a, p) => a + p.material_cost_chf, 0),
      labour: ps.reduce((a, p) => a + p.labour_cost_chf, 0),
      hours: ps.reduce((a, p) => a + p.adjusted_install_hours, 0),
    }
  })
  const max = Math.max(...rows.map((r) => r.material + r.labour), 1)
  return (
    <section className="card systems-page">
      <div className="section-heading">
        <div>
          <span className="eyebrow">{e.tender.meta.trade || 'BKP 244'} · SYSTEM OVERVIEW</span>
          <h1>Ventilation systems</h1>
          <p className="muted">
            {systems.length} systems from the tender · direct position cost {fmtChf(rows.reduce((a, r) => a + r.m.value, 0))}
          </p>
        </div>
      </div>
      <div className="systems-grid">
        {rows.map(({ s, m }) => (
          <button
            className="system-overview card"
            key={s.id}
            onClick={() => {
              filter({ system: s.id, pill: 'all', search: '', only: null })
              navigate(tenderPath(e.tender.id, 'positions'))
            }}
          >
            <div className="section-heading">
              <span className="semicircle" style={{ background: s.color }} />
              <ChevronRight />
            </div>
            <h2>{s.name}</h2>
            <p>
              {s.code} · {m.total} positions
            </p>
            <div className="section-heading">
              <strong>CHF {money(m.value)}</strong>
              <b style={{ color: s.color }}>{m.percent}%</b>
            </div>
            <Progress value={m.percent} color={s.color} />
            <small>
              {m.approved} approved · {m.open} open · {m.decision} need review
            </small>
          </button>
        ))}
      </div>
      <div className="system-bars">
        <h3>Direct position cost by system</h3>
        {rows.map(({ s, material, labour, hours }) => (
          <div key={s.id} className="bar-row">
            <span>{s.name}</span>
            <div className="bar-track">
              <i style={{ width: `${(100 * material) / max}%`, background: s.color }} />
              <i style={{ width: `${(100 * labour) / max}%`, background: s.color, opacity: 0.45 }} />
            </div>
            <b>CHF {money(material + labour)}</b>
            <small>{money(hours)} h</small>
          </div>
        ))}
        <div className="calendar-legend">
          <span>
            <i className="blue" /> Material and packages (solid)
          </span>
          <span>
            <i className="peach" /> Installation labour (light)
          </span>
        </div>
      </div>
      <div className="notice subtle">
        <Layers size={19} /> Project costs (engineering, commissioning, hygiene, documentation, transport) are not split by
        system; see Calculation → Project build-up.
      </div>
    </section>
  )
}
