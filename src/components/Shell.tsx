import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calculator, Check, FileText, Layers, Link2, Eye, Upload } from 'lucide-react'
import { metrics, workflow } from '../derive'
import { money } from '../format'
import { useEstimate, useStore } from '../store'
import { Ring } from './ui'

const STEP_STYLE = {
  extract: [FileText, '#062969'],
  match: [Link2, '#0785ff'],
  calculate: [Calculator, '#ff6a20'],
  review: [Eye, '#f59e6c'],
  approve: [Check, '#00987a'],
  export: [Upload, '#7b61ff'],
} as const

/** The workflow steps as progress circles; on the project overview, under the project's own completion bar. */
export function Workflow({ stepsOnly = false }: { stepsOnly?: boolean }) {
  const e = useEstimate()
  const m = metrics(e.positions)
  const navigate = useNavigate()
  return (
    <section className={`workflow ${stepsOnly ? 'steps-only' : 'card'}`}>
      {!stepsOnly && (
        <div className="completion">
          <Ring value={m.percent} />
          <div>
            <h2>Tender completion</h2>
            <p>
              {m.approved} of {m.priceable} priced positions approved
            </p>
          </div>
        </div>
      )}
      <div className="workflow-steps">
        {workflow(e).map((s) => {
          const [Icon, color] = STEP_STYLE[s.key as keyof typeof STEP_STYLE]
          return (
            <button key={s.key} onClick={() => navigate(s.url)} className="workflow-step" title={STEP_HELP[s.key]}>
              <span className="step-circle" style={{ '--step': color, '--value': `${s.value * 3.6}deg` } as CSSProperties}>
                <span>
                  <Icon size={19} />
                </span>
              </span>
              <strong>{s.label}</strong>
              <span>{s.value}%</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

const STEP_HELP: Record<string, string> = {
  extract: 'Positions with a quantity read from the tender',
  match: 'Positions linked to a catalogue item, supplier package or installation rule',
  calculate: 'Positions with a price',
  review: 'Positions without an open decision (needs review / missing info)',
  approve: 'Positions approved by the estimator',
  export: 'Offer exported since the last change',
}

/** The HVAC trades (air, cooling, electro, …) in their standard colours, fixed under the project progress; a click filters every view. */
export function CategoryStrip() {
  const e = useEstimate()
  const { category, filter } = useStore()
  return (
    <nav className="category-strip" aria-label="HVAC categories">
      <button className={`category-chip all ${category === 'all' ? 'selected' : ''}`} onClick={() => filter({ category: 'all' })}>
        <Layers size={13} /> All <span>{e.positions.length}</span>
      </button>
      {e.categories.map((c) => {
        const n = e.positions.filter((p) => p.trade === c.id).length
        return (
          <button
            key={c.id}
            disabled={!n}
            className={`category-chip ${category === c.id ? 'selected' : ''}`}
            style={{ '--cat': c.color } as CSSProperties}
            onClick={() => filter({ category: category === c.id ? 'all' : c.id })}
            title={n ? `${n} positions, CHF ${money(sum(e.positions.filter((p) => p.trade === c.id)))} direct cost` : 'Not in this tender'}
          >
            {c.label} <span>{n}</span>
          </button>
        )
      })}
    </nav>
  )
}

const sum = (ps: { direct_position_cost_chf: number }[]) => ps.reduce((a, p) => a + p.direct_position_cost_chf, 0)
