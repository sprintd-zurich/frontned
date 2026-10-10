import { useState } from 'react'
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Info } from 'lucide-react'
import { useEstimate, useStore } from '../store'

/** Cross-checks between LV text, engineer duct lists and equipment sizes; they flag, they never change a price. */
export function ChecksCard() {
  const e = useEstimate()
  const filter = useStore((s) => s.filter)
  const [open, setOpen] = useState(false)
  const count = (l: string) => e.checks.filter((c) => c.level === l).length
  return (
    <section className={`card checks-card ${open ? 'open' : ''}`}>
      <button className="checks-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="checks-icon">
          <AlertTriangle size={18} />
        </span>
        <span>
          <h3>Design consistency checks</h3>
          <small>
            {count('warning')} to verify · {count('info')} notes · {count('ok')} passed · cross-checks of LV text, duct lists and
            equipment sizes
          </small>
        </span>
        {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
      </button>
      {open && (
        <div className="checks-list">
          {e.checks.map((c, i) => (
            <div key={i} className={`check-row ${c.level}`}>
              {c.level === 'warning' ? <AlertTriangle size={16} /> : c.level === 'info' ? <Info size={16} /> : <CheckCircle2 size={16} />}
              <div>
                <b>{c.title}</b>
                <p>{c.detail}</p>
                <small>PDF page {c.pages.join(', ')}</small>
              </div>
              {c.positions.length > 0 && (
                <button
                  className="button small"
                  onClick={() => filter({ only: { label: c.title, ids: c.positions }, pill: 'all', system: 'all' })}
                >
                  Show {c.positions.length} position{c.positions.length > 1 ? 's' : ''}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
