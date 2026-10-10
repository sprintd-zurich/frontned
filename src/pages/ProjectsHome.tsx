import { useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Archive,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileUp,
  FolderOpen,
  LayoutGrid,
  RotateCcw,
  Search,
  Settings,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { fmtChf, fmtWhen } from '../format'
import { tenderPath } from '../routes'
import { useStore } from '../store'
import type { Dataset, Meta, TenderSummary } from '../types'
import { Button, Modal, Progress } from '../components/ui'
import { CompanyResourcesManager } from './Overview'

export function ProjectsHome() {
  const navigate = useNavigate()
  const tenders = useStore((s) => s.tenders)
  const [newProject, setNewProject] = useState(false)
  const [priceBooks, setPriceBooks] = useState(false)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('active')
  const [sort, setSort] = useState('updated')

  const active = tenders.filter((t) => !t.archived)
  const dueSoon = active.filter((t) => {
    const days = daysUntil(t.meta.submission_date)
    return days >= 0 && days <= 7
  }).length
  const needInput = active.filter((t) => t.open_decisions > 0 || t.supplier_quotes_open > 0).length
  const bidValue = active.reduce((sum, t) => sum + t.selling_price_chf, 0)

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return tenders
      .filter((t) => (status === 'archived' ? t.archived : !t.archived))
      .filter((t) => status === 'active' || status === 'archived' || t.workflow_status === status)
      .filter((t) => !q || [projectName(t), t.meta.client, t.meta.location, t.meta.tender_no, t.meta.estimator, t.meta.trade]
        .some((value) => value?.toLowerCase().includes(q)))
      .sort((a, b) => {
        if (sort === 'deadline') return deadlineValue(a) - deadlineValue(b)
        if (sort === 'value') return b.selling_price_chf - a.selling_price_chf
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      })
  }, [tenders, query, status, sort])

  return (
    <div className="overview-container projects-home">
      <div className="projects-heading">
        <div>
          <span className="hero-tag">EQUANS TENDER PLATFORM</span>
          <h1>Projects</h1>
          <p>Manage tender estimates, reviews, bids and submissions in one place.</p>
        </div>
        <div className="projects-heading-actions">
          <Button onClick={() => setPriceBooks(true)}><Settings size={15} /> Price books</Button>
          <Button primary onClick={() => setNewProject(true)}><FileUp size={16} /> New project</Button>
        </div>
      </div>

      <section className="project-kpis" aria-label="Project portfolio summary">
        <PortfolioKpi icon={<LayoutGrid />} value={active.length} label="Active projects" />
        <PortfolioKpi icon={<CalendarDays />} value={dueSoon} label="Due in 7 days" tone={dueSoon ? 'warning' : ''} />
        <PortfolioKpi icon={<AlertTriangle />} value={needInput} label="Need input" tone={needInput ? 'attention' : ''} />
        <PortfolioKpi icon={<CheckCircle2 />} value={fmtChf(bidValue)} label="Active bid value" />
      </section>

      <section className="card project-portfolio">
        <div className="project-toolbar">
          <label className="project-search">
            <Search size={16} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search projects, clients or tender numbers…" />
          </label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Project status">
            <option value="active">All active</option>
            <option value="in_review">In review</option>
            <option value="waiting_for_quotes">Waiting for quotes</option>
            <option value="ready_to_bid">Ready to bid</option>
            <option value="archived">Archived</option>
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort projects">
            <option value="updated">Recently updated</option>
            <option value="deadline">Submission date</option>
            <option value="value">Bid value</option>
          </select>
        </div>
        <ProjectTable projects={shown} onNew={() => setNewProject(true)} />
      </section>

      {active.length > 0 && (
        <div className="project-insights">
          <section className="card">
            <div className="section-heading"><h2>Recent activity</h2></div>
            {active.slice(0, 4).map((t) => (
              <button className="portfolio-activity" key={t.id} onClick={() => navigate(tenderPath(t.id, 'positions'))}>
                <Clock size={14} />
                <span><strong>{projectName(t)}</strong><small>{t.last_activity}</small></span>
                <time>{fmtWhen(t.updated_at)}</time>
              </button>
            ))}
          </section>
          <section className="card">
            <div className="section-heading"><h2>Projects needing action</h2></div>
            {active.filter((t) => t.open_decisions || t.supplier_quotes_open).slice(0, 4).map((t) => (
              <button className="portfolio-action" key={t.id} onClick={() => navigate(tenderPath(t.id, t.supplier_quotes_open ? 'rfq' : 'positions'))}>
                <span><strong>{projectName(t)}</strong><small>{actionText(t)}</small></span>
                <ArrowRight size={15} />
              </button>
            ))}
            {!active.some((t) => t.open_decisions || t.supplier_quotes_open) && (
              <div className="portfolio-clear"><CheckCircle2 size={20} /> No projects need immediate input.</div>
            )}
          </section>
        </div>
      )}

      {newProject && <NewProjectModal close={() => setNewProject(false)} />}
      {priceBooks && (
        <Modal title="Reference price books" close={() => setPriceBooks(false)} wide>
          <CompanyResourcesManager />
        </Modal>
      )}
    </div>
  )
}

function PortfolioKpi({ icon, value, label, tone = '' }: { icon: ReactNode; value: string | number; label: string; tone?: string }) {
  return <div className={`card project-kpi ${tone}`}><span>{icon}</span><div><strong>{value}</strong><small>{label}</small></div></div>
}

const STATUS_LABEL: Record<TenderSummary['workflow_status'], string> = {
  in_review: 'In review',
  waiting_for_quotes: 'Waiting for quotes',
  ready_to_bid: 'Ready to bid',
}

function ProjectTable({ projects, onNew }: { projects: TenderSummary[]; onNew: () => void }) {
  const navigate = useNavigate()
  const { estimate, open, archiveTender, removeTender, busy } = useStore()
  const [opening, setOpening] = useState<string | null>(null)

  const openProject = async (id: string) => {
    setOpening(id)
    try {
      const ready = estimate?.tender.id === id ? id : await open(id)
      if (ready) navigate(tenderPath(ready, 'positions'))
    } finally {
      setOpening(null)
    }
  }

  if (!projects.length) {
    return (
      <div className="projects-empty">
        <FolderOpen size={32} /><h3>No projects found</h3>
        <p>Create a project from a tender PDF, or change the current filters.</p>
        <Button primary onClick={onNew}><FileUp size={15} /> New project</Button>
      </div>
    )
  }

  return (
    <div className="project-table-wrap">
      <table className="project-table">
        <thead><tr><th>Project</th><th>Status</th><th>Progress</th><th>Submission</th><th>Estimator</th><th>Bid value</th><th /></tr></thead>
        <tbody>{projects.map((t) => (
          <tr key={t.id} className={t.archived ? 'archived' : ''}>
            <td><button className="project-name-button" onClick={() => !t.archived && openProject(t.id)} disabled={t.archived}>
              <strong>{projectName(t)}</strong><small>{[t.meta.client, t.meta.trade || `${t.positions} positions`].filter(Boolean).join(' · ')}</small>
            </button></td>
            <td><span className={`project-status ${t.archived ? 'archived' : t.workflow_status}`}>{t.archived ? 'Archived' : STATUS_LABEL[t.workflow_status]}</span><small className="project-attention">{actionText(t)}</small></td>
            <td><div className="project-progress"><Progress value={t.completion_pct} /><strong>{t.completion_pct}%</strong></div><small>{t.reviewed} of {t.priceable_positions} approved</small></td>
            <td><Deadline date={t.meta.submission_date} /></td>
            <td>{t.meta.estimator || <span className="muted">Unassigned</span>}</td>
            <td><strong>{fmtChf(t.selling_price_chf)}</strong></td>
            <td><div className="project-row-actions">
              {t.archived ? <>
                <button className="icon-button" title="Restore project" onClick={() => archiveTender(t.id, false)}><RotateCcw size={14} /></button>
                <button className="icon-button danger" title="Delete project permanently" onClick={() => confirm(`Permanently delete “${projectName(t)}”?`) && removeTender(t.id)}><Trash2 size={14} /></button>
              </> : <>
                <Button primary className="small" disabled={!!busy || opening === t.id} onClick={() => openProject(t.id)}>{opening === t.id ? 'Opening…' : 'Continue'} <ArrowRight size={13} /></Button>
                <button className="icon-button" title="Archive project" onClick={() => archiveTender(t.id, true)}><Archive size={14} /></button>
              </>}
            </div></td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  )
}

function Deadline({ date }: { date: string }) {
  if (!date) return <span className="muted">Not set</span>
  const days = daysUntil(date)
  return <span className={days < 0 ? 'deadline overdue' : days <= 7 ? 'deadline soon' : 'deadline'}>{new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${date}T12:00:00`))}{days < 0 && <small>Overdue</small>}</span>
}

function NewProjectModal({ close }: { close: () => void }) {
  const navigate = useNavigate()
  const { upload, loadDemo, setDataset, setMeta, datasets, busy } = useStore()
  const input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [dataset, setBook] = useState(datasets[0]?.id ?? '')
  const [step, setStep] = useState<'document' | 'details'>('document')
  const [draft, setDraft] = useState<Partial<Meta>>({})

  const process = async () => {
    if (!file) return
    const id = await upload(file)
    if (!id) return
    const current = useStore.getState().estimate
    if (dataset && current?.dataset.id !== dataset) await setDataset(dataset)
    const meta = useStore.getState().estimate?.tender.meta
    if (meta) setDraft({ ...meta })
    setStep('details')
  }
  const finish = async () => {
    await setMeta(draft)
    const id = useStore.getState().estimate?.tender.id
    close()
    if (id) navigate(tenderPath(id, 'positions'))
  }

  return (
    <Modal title={step === 'document' ? 'Create a project' : 'Confirm project details'} close={close} wide>
      {step === 'document' ? <div className="new-project-flow">
        <p className="muted">Upload the tender specification and choose the reference prices for this estimate.</p>
        <button className={`new-project-dropzone ${file ? 'selected' : ''}`} onClick={() => input.current?.click()} disabled={!!busy}>
          <input ref={input} type="file" accept="application/pdf" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <FileUp size={28} /><strong>{file?.name || 'Choose tender PDF'}</strong>
          <small>{file ? `${(file.size / 1024 / 1024).toFixed(1)} MB · ready to process` : 'BKP specification, bill of quantities or tender package'}</small>
        </button>
        <label className="new-project-field"><span>Dataset</span><select value={dataset} onChange={(e) => setBook(e.target.value)}>
          {Object.entries(datasetGroups(datasets)).map(([country, books]) => (
            <optgroup key={country} label={country}>{books.map((d) => <option key={d.id} value={d.id}>{d.name} · {d.location || d.region} · v{d.latest_version}</option>)}</optgroup>
          ))}
        </select></label>
        <div className="modal-actions split">
          <Button disabled={!!busy} onClick={async () => { const id = await loadDemo(); close(); if (id) navigate(tenderPath(id, 'positions')) }}><Sparkles size={14} /> Load demo</Button>
          <Button primary disabled={!file || !!busy} onClick={process}>{busy || 'Process tender'} <ArrowRight size={15} /></Button>
        </div>
      </div> : <form className="new-project-details" onSubmit={(e) => { e.preventDefault(); finish() }}>
        <p className="muted">These values were read from the tender cover. Check them before entering the workspace.</p>
        {([
          ['project_name', 'Project name', 'text'], ['client', 'Client', 'text'], ['location', 'Location', 'text'],
          ['tender_no', 'Tender number', 'text'], ['trade', 'Trade / BKP', 'text'], ['submission_date', 'Submission date', 'date'],
          ['estimator', 'Estimator', 'text'],
        ] as [keyof Meta, string, string][]).map(([key, label, type]) => <label key={key}><span>{label}</span><input type={type} value={draft[key] ?? ''} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} /></label>)}
        <div className="modal-actions"><Button onClick={close}>Finish later</Button><Button primary type="submit" disabled={!!busy}>Save and open project <ArrowRight size={15} /></Button></div>
      </form>}
    </Modal>
  )
}

function projectName(t: TenderSummary) { return t.meta.project_name || t.name.replace(/\.pdf$/i, '') }
function datasetGroups(datasets: Dataset[]) {
  return datasets.reduce<Record<string, Dataset[]>>((groups, dataset) => {
    const country = dataset.country || 'Other'
    ;(groups[country] ??= []).push(dataset)
    return groups
  }, {})
}
function deadlineValue(t: TenderSummary) { return t.meta.submission_date ? new Date(`${t.meta.submission_date}T12:00:00`).getTime() : Number.MAX_SAFE_INTEGER }
function daysUntil(date: string) {
  if (!date) return Number.POSITIVE_INFINITY
  const target = new Date(`${date}T12:00:00`).getTime()
  const today = new Date(); today.setHours(12, 0, 0, 0)
  return Math.ceil((target - today.getTime()) / 86400000)
}
function actionText(t: TenderSummary) {
  const parts = []
  if (t.open_decisions) parts.push(`${t.open_decisions} decision${t.open_decisions === 1 ? '' : 's'}`)
  if (t.supplier_quotes_open) parts.push(`${t.supplier_quotes_open} quote${t.supplier_quotes_open === 1 ? '' : 's'} open`)
  return parts.join(' · ') || (t.workflow_status === 'ready_to_bid' ? 'Review complete' : 'No urgent action')
}
