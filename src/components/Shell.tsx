import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calculator, Check, ChevronRight, FileText, Layers, Link2, Eye, Upload } from 'lucide-react'
import { metrics, systemsOf, workflow } from '../derive'
import { tenderPath } from '../routes'
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
  review: [Eye, '#ffbb99'],
  approve: [Check, '#bac2cc'],
  export: [Upload, '#c4cad3'],
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
            <button key={s.key} onClick={() => navigate(tenderPath(e.tender.id, s.url))} className="workflow-step" title={STEP_HELP[s.key]}>
              <div className="quarter" style={{ background: color }}>
                <span style={{ background: color }}>
                  <Icon size={17} />
                </span>
              </div>
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

export function SystemSidebar() {
  const e = useEstimate()
  const { system, filter } = useStore()
  const systems = systemsOf(e.positions)
  return (
    <aside className="systems-sidebar card">
      <div className="section-heading">
        <h2>HVAC Systems</h2>
        <button className="text-button" onClick={() => filter({ system: 'all' })}>
          {system === 'all' ? `${systems.length} systems` : 'Show all'}
        </button>
      </div>
      {systems.map((s) => {
        const mm = metrics(e.positions.filter((p) => p.system === s.id))
        return (
          <button
            key={s.id}
            className={`system-tile ${system === s.id ? 'selected' : ''}`}
            style={{ '--system-color': s.color } as CSSProperties}
            onClick={() => filter({ system: system === s.id ? 'all' : s.id })}
            title={s.id}
          >
            <span className="semicircle" />
            <span className="system-body">
              <strong>{s.name}</strong>
              <span>
                {s.code} · {mm.total} positions
              </span>
              <span className="system-bottom">
                <b>{mm.percent}%</b>
                <small>CHF {money(mm.value)}</small>
              </span>
            </span>
            <ChevronRight className="system-arrow" size={17} />
          </button>
        )
      })}
      <div className="sidebar-caption">
        <Layers size={13} /> {e.tender.meta.trade || 'BKP 244 Lüftungsanlagen'} · direct cost
      </div>
    </aside>
  )
}
