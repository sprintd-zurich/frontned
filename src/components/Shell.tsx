import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calculator, Check, FileText, Layers, Link2, Eye, Upload } from 'lucide-react'
import { metrics, systemsOf, workflow } from '../derive'
import { fmtDate, money } from '../format'
import { useEstimate, useStore } from '../store'
import { Ring } from './ui'

export function ProjectCard() {
  const e = useEstimate()
  const m = e.tender.meta
  return (
    <section className="project-card card">
      <img src="/project-building.jpg" alt="" />
      <div>
        <h3>{m.project_name || e.tender.name}</h3>
        <p>{m.location || m.client || '—'}</p>
        <small>
          {m.trade || 'Tender'} <span className="separator">|</span>{' '}
          {m.submission_date ? `Submission ${fmtDate(m.submission_date)}` : `Tender of ${m.document_date || fmtDate(e.tender.created_at)}`}
        </small>
        <small>Estimator: {m.estimator || 'not set'}</small>
      </div>
    </section>
  )
}

const STEP_STYLE = {
  extract: [FileText, '#062969'],
  match: [Link2, '#0785ff'],
  calculate: [Calculator, '#ff6a20'],
  review: [Eye, '#f59e6c'],
  approve: [Check, '#00987a'],
  export: [Upload, '#7b61ff'],
} as const

export function Workflow() {
  const e = useEstimate()
  const m = metrics(e.positions)
  const navigate = useNavigate()
  return (
    <section className="workflow card">
      <div className="completion">
        <Ring value={m.percent} />
        <div>
          <h2>Tender completion</h2>
          <p>
            {m.approved} of {m.priceable} priced positions approved
          </p>
        </div>
      </div>
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

/** The HVAC systems as a floating strip between the project progress and the work area; a click filters every view. */
export function SystemStrip() {
  const e = useEstimate()
  const { system, filter } = useStore()
  const systems = systemsOf(e.positions)
  const all = metrics(e.positions)
  return (
    <nav className="system-strip" aria-label="HVAC systems">
      <button className={`system-chip all ${system === 'all' ? 'selected' : ''}`} onClick={() => filter({ system: 'all' })}>
        <span className="chip-dot">
          <Layers size={14} />
        </span>
        <span className="chip-body">
          <strong>All systems</strong>
          <small>
            {systems.length} systems · {all.total} positions
          </small>
        </span>
        <b>{all.percent}%</b>
      </button>
      {systems.map((s) => {
        const mm = metrics(e.positions.filter((p) => p.system === s.id))
        return (
          <button
            key={s.id}
            className={`system-chip ${system === s.id ? 'selected' : ''}`}
            style={{ '--system-color': s.color, '--value': `${mm.percent * 3.6}deg` } as CSSProperties}
            onClick={() => filter({ system: system === s.id ? 'all' : s.id })}
            title={`${s.id} · CHF ${money(mm.value)} direct cost`}
          >
            <span className="chip-dot" />
            <span className="chip-body">
              <strong>{s.name}</strong>
              <small>
                {s.code} · {mm.total} pos.
              </small>
            </span>
            <b>{mm.percent}%</b>
          </button>
        )
      })}
    </nav>
  )
}
