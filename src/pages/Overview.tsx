import { useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Database,
  FileText,
  MapPin,
  MessageSquare,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  UserRound,
} from 'lucide-react'
import { initials, isBlocker, lastOf, metrics, needsDecision, positionLabel, systemsOf, workflow } from '../derive'
import { fmtChf, fmtDate, fmtWhen, money, parseDay } from '../format'
import { api } from '../api'
import { useEstimate, useStore } from '../store'
import type { Activity } from '../types'
import { Button, Modal, Progress, Ring } from '../components/ui'
import { MetaForm } from './MetaForm'

export function ProjectsSidebar() {
  const { tenders, estimate, open, removeTender, busy } = useStore()
  const [q, setQ] = useState('')
  const [tab, setTab] = useState<'All' | 'In review' | 'New'>('All')
  const [importing, setImporting] = useState(false)
  const [confirm, setConfirm] = useState<string | null>(null)
  const navigate = useNavigate()
  const inTab = (t: (typeof tenders)[number], name: string) =>
    name === 'All' || (name === 'In review' ? t.reviewed > 0 : t.reviewed === 0)
  const shown = tenders.filter(
    (t) => `${t.meta.project_name} ${t.name} ${t.meta.location}`.toLowerCase().includes(q.toLowerCase()) && inTab(t, tab),
  )
  return (
    <aside className="projects-sidebar">
      <div className="section-heading">
        <h3>My tenders</h3>
        <button className="button small" onClick={() => setImporting(true)}>
          <Plus size={14} /> New tender
        </button>
      </div>
      <label className="search-field">
        <Search size={16} />
        <input placeholder="Search tenders…" aria-label="Search tenders" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      <div className="project-tabs">
        {(['All', 'In review', 'New'] as const).map((t) => (
          <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
            {t} <small>{tenders.filter((x) => inTab(x, t)).length}</small>
          </button>
        ))}
      </div>
      <div className="project-list">
        {shown.map((t, i) => (
          <div className={`project-item ${estimate?.tender.id === t.id ? 'active' : ''}`} key={t.id}>
            <button
              className="project-open"
              disabled={!!busy}
              onClick={async () => {
                if (estimate?.tender.id !== t.id) await open(t.id)
                navigate('/')
              }}
            >
              <img src={`/project-${(i % 9) + 1}.jpg`} alt="" />
              <span>
                <strong>{t.meta.project_name || t.name}</strong>
                <small>{t.meta.location || t.name}</small>
                <small>
                  {fmtDate(t.created_at)} · {t.positions} positions · {t.reviewed} approved
                </small>
              </span>
              <i style={{ background: estimate?.tender.id === t.id ? '#1389ff' : t.reviewed ? '#00987a' : '#ff8b38' }} />
            </button>
            <button className="project-remove" aria-label={`Remove ${t.name}`} title="Remove tender" onClick={() => setConfirm(t.id)}>
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {!shown.length && <p className="muted portfolio-empty">{tenders.length ? 'No tender matches.' : 'No tender imported yet.'}</p>}
      </div>
      <span className="portfolio-note">Stored on the pricing server · {tenders.length} tenders</span>
      {importing && (
        <Modal title="Import a tender" close={() => setImporting(false)}>
          <ImportPanel onDone={() => setImporting(false)} />
        </Modal>
      )}
      {confirm && (
        <Modal title="Remove this tender?" close={() => setConfirm(null)}>
          <p>The tender, its estimate, notes and scenarios are deleted from the pricing server. This cannot be undone.</p>
          <div className="modal-actions">
            <Button onClick={() => setConfirm(null)}>Cancel</Button>
            <Button
              primary
              onClick={async () => {
                const id = confirm
                setConfirm(null)
                await removeTender(id)
              }}
            >
              <Trash2 size={15} /> Remove
            </Button>
          </div>
        </Modal>
      )}
    </aside>
  )
}

export function ImportPanel({ onDone }: { onDone?: () => void }) {
  const { loadDemo, upload, busy } = useStore()
  const input = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)
  const navigate = useNavigate()
  const go = async (fn: () => Promise<void>) => {
    await fn()
    if (useStore.getState().estimate) {
      onDone?.()
      navigate('/')
    }
  }
  return (
    <div className="import-panel">
      <div
        className={`dropzone ${drag ? 'drag' : ''}`}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDrag(true)
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDrag(false)
          const f = e.dataTransfer.files[0]
          if (f) go(() => upload(f))
        }}
        onClick={() => !busy && input.current?.click()}
      >
        <input ref={input} type="file" accept="application/pdf" hidden onChange={(e) => e.target.files?.[0] && go(() => upload(e.target.files![0]))} />
        {busy ? (
          <>
            <span className="spinner large" />
            <strong>{busy}</strong>
            <small>Extraction and pricing take a few seconds for a 200-page LV.</small>
          </>
        ) : (
          <>
            <Upload size={30} />
            <strong>Drop the tender PDF here</strong>
            <small>or click to choose the Leistungsverzeichnis (BKP 244)</small>
          </>
        )}
      </div>
      <div className="demo-tender">
        <span className="eyebrow">HACKATHON TENDER</span>
        <h3>Schulhaus Oberglatt</h3>
        <p className="muted">BKP 244 Lüftungsanlagen · 202 pages · 6 systems</p>
        <Button primary disabled={!!busy} onClick={() => go(loadDemo)}>
          Import the Oberglatt tender <ArrowRight size={16} />
        </Button>
      </div>
    </div>
  )
}

export function Overview() {
  const estimate = useStore((s) => s.estimate)
  if (!estimate) {
    return (
      <section className="card welcome">
        <span className="eyebrow">EQUANS TENDER INTELLIGENCE</span>
        <h1>From tender to first price</h1>
        <p className="muted">
          Import a tender package. Every LV position is extracted, matched to the reference data and priced, with the
          source page and every assumption one click away.
        </p>
        <ImportPanel />
        <ol className="welcome-steps">
          {[
            ['Extract', 'Systems, positions, quantities and units from the PDF'],
            ['Match', 'Catalogue items, supplier packages and installation rules'],
            ['Calculate', 'Material, installation hours, labour and project costs'],
            ['Review', 'Source page, assumptions and alternatives per position'],
            ['Decide', 'Margin, win probability and scenarios'],
            ['Export', 'Priced tender PDF, offer workbook, supplier RFQs'],
          ].map(([t, d], i) => (
            <li key={t}>
              <b>{String(i + 1).padStart(2, '0')}</b>
              <strong>{t}</strong>
              <small>{d}</small>
            </li>
          ))}
        </ol>
      </section>
    )
  }
  return <Dashboard />
}

function Dashboard() {
  const e = useEstimate()
  const { filter, select } = useStore()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const m = metrics(e.positions)
  const meta = e.tender.meta
  const systems = systemsOf(e.positions)
  const tabs = ['Dashboard', 'Positions', 'Review', 'Bid', 'Export', 'Details']
  const ready = m.open === 0
  return (
    <>
      <section className="project-hero card">
        <div className="hero-main">
          <img src="/project-building.jpg" alt="" />
          <div className="hero-title">
            <span className="eyebrow">EQUANS TENDER INTELLIGENCE</span>
            <h1>{meta.project_name || e.tender.name}</h1>
            <p>
              {meta.trade || 'Tender'} <span className="separator">|</span>{' '}
              {meta.tender_no ? `Ausschreibung Nr. ${meta.tender_no}` : e.tender.name}
            </p>
            <div className="project-meta">
              <span>
                <Building2 />
                {meta.client || '—'}
              </span>
              <span>
                <MapPin />
                {meta.location || '—'}
              </span>
              <button onClick={() => setEditing(true)}>
                <CalendarDays />
                {meta.submission_date ? `Submission: ${fmtDate(meta.submission_date)}` : 'Set submission date'}
              </button>
              <button onClick={() => setEditing(true)}>
                <UserRound />
                {meta.estimator || 'Set estimator'}
              </button>
            </div>
          </div>
          <div className="hero-progress">
            <span className={`badge ${ready ? 'success' : 'info'}`}>{ready ? 'Ready to submit' : 'In progress'}</span>
            <div className="section-heading">
              <span>Tender completion</span>
              <b>{m.percent}%</b>
            </div>
            <Progress value={m.percent} />
            <small>
              {m.approved} of {m.priceable} priced positions approved
            </small>
          </div>
        </div>
        <div className="project-subnav">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => (t === 'Details' ? setEditing(true) : t !== 'Dashboard' && navigate('/' + t.toLowerCase()))}
              className={t === 'Dashboard' ? 'active' : ''}
            >
              {t}
            </button>
          ))}
        </div>
      </section>
      <div className="metrics">
        {(
          [
            [FileText, 'Total positions', String(m.total), `${m.priceable} priced · ${m.total - m.priceable} summary lines`, 'info', 'all'],
            [CheckCheck, 'Approved', String(m.approved), `${m.percent}% of priced positions`, 'success', 'approved'],
            [Clock3, 'Needs review', String(m.decision), 'Decision or missing information', 'warning', 'decision'],
            [MessageSquare, 'Open', String(m.open), `${m.quote} quote · ${m.assumption} assumption`, 'neutral', 'all'],
            [Database, 'Indicative price', fmtChf(e.project.selling_price_rounded_chf), `Direct cost ${fmtChf(e.project.direct_cost_chf)}`, 'info', 'value'],
          ] as const
        ).map(([I, label, value, sub, color, pill]) => (
          <button
            className="metric card"
            key={label}
            onClick={() => {
              if (pill === 'value') return navigate('/review')
              filter({ pill, system: 'all', search: '', only: null })
              navigate(pill === 'decision' ? '/review' : '/positions')
            }}
          >
            <span className={`metric-icon ${color}`}>
              <I />
            </span>
            <span>
              <small>{label}</small>
              <strong>{value}</strong>
              <small className={color}>{sub}</small>
            </span>
          </button>
        ))}
      </div>
      <div className="dashboard-grid">
        <Milestones onEdit={() => setEditing(true)} />
        <Calendar />
        <div className="dashboard-right">
          <section className="card status-card">
            <h3>Project status</h3>
            <div className="status-content">
              <Ring value={m.percent} size={114} />
              <div>
                {(
                  [
                    ['Approved', m.approved, '#009b7d'],
                    ['Needs review', m.decision, '#ff7929'],
                    ['Open', m.open - m.decision, '#a7afbd'],
                  ] as const
                ).map(([s, n, c]) => (
                  <div className="legend-line" key={s}>
                    <i style={{ background: c }} />
                    <span>{s}</span>
                    <b>{n}</b>
                  </div>
                ))}
                <button className="link-button" onClick={() => navigate('/positions')}>
                  View positions <ArrowRight size={15} />
                </button>
              </div>
            </div>
          </section>
          <section className="card system-completion">
            <div className="section-heading">
              <h3>System completion</h3>
              <small>{systems.length} systems</small>
            </div>
            {systems.map((s) => {
              const mm = metrics(e.positions.filter((p) => p.system === s.id))
              return (
                <button
                  key={s.id}
                  title={s.id}
                  onClick={() => {
                    filter({ system: s.id, pill: 'all', only: null })
                    navigate('/positions')
                  }}
                >
                  <span className="mini-quarter" style={{ background: s.color }} />
                  <span>{s.name}</span>
                  <Progress value={mm.percent} color={s.color} />
                  <small>{mm.percent}%</small>
                </button>
              )
            })}
          </section>
        </div>
        <Tasks
          onOpen={(lvId) => {
            select(lvId)
            filter({ system: 'all', search: '', pill: 'all', only: null })
            navigate('/review')
          }}
        />
        <section className="card activity">
          <div className="section-heading">
            <h3>Recent activity</h3>
            <span className="live-label">Saved</span>
          </div>
          {[...e.activity]
            .reverse()
            .slice(0, 5)
            .map((a, i) => (
              <ActivityItem key={i} a={a} />
            ))}
          <div className="activity-tip">
            <ShieldCheck size={20} />
            <span>
              Every decision stays connected.<small>Edits, approvals and notes are journaled on the server.</small>
            </span>
          </div>
        </section>
        <Documents />
      </div>
      {editing && (
        <Modal title="Project details" close={() => setEditing(false)}>
          <MetaForm onDone={() => setEditing(false)} />
        </Modal>
      )}
    </>
  )
}

export function ActivityItem({ a }: { a: Activity }) {
  const estimator = useStore((s) => s.estimate?.tender.meta.estimator)
  const who = a.kind === 'import' ? 'LV' : a.kind === 'export' ? 'EX' : initials(estimator)
  return (
    <div className="activity-item">
      <span className={`avatar tiny ${a.kind}`}>{who}</span>
      <div>
        {a.text}
        <small>{fmtWhen(a.at)}</small>
      </div>
    </div>
  )
}

function Milestones({ onEdit }: { onEdit: () => void }) {
  const e = useEstimate()
  const m = metrics(e.positions)
  const meta = e.tender.meta
  const lastReview = lastOf(e.activity, ['review'])
  const lastExport = lastOf(e.activity, ['export'])
  const exported = workflow(e).find((s) => s.key === 'export')!.value === 100
  const items: [string, boolean, ReactNode][] = [
    ['Tender document issued', !!meta.document_date, meta.document_date || '—'],
    ['Tender imported', true, fmtDate(e.tender.created_at)],
    [`${m.total} positions extracted and priced`, true, fmtDate(e.tender.created_at)],
    ['Open decisions resolved', m.decision === 0, m.decision === 0 ? (lastReview ? fmtDate(lastReview.at) : 'Done') : `${m.decision} open`],
    ['All positions approved', m.open === 0, m.open === 0 ? (lastReview ? fmtDate(lastReview.at) : 'Done') : `${m.open} open`],
    ['Offer exported', exported, exported && lastExport ? fmtDate(lastExport.at) : 'Open'],
    [
      'Submission',
      false,
      meta.submission_date ? (
        fmtDate(meta.submission_date)
      ) : (
        <button className="text-button" onClick={onEdit}>
          Set date
        </button>
      ),
    ],
  ]
  const current = items.findIndex(([, done]) => !done)
  return (
    <section className="card milestones">
      <h3>Timeline & key milestones</h3>
      {items.map(([title, done, date], i) => (
        <div className={`milestone ${done ? 'done' : i === current ? 'current' : ''}`} key={title}>
          <span>{done ? <Check size={14} /> : null}</span>
          <b>{title}</b>
          <small>{date}</small>
        </div>
      ))}
    </section>
  )
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function Calendar() {
  const e = useEstimate()
  const notify = useStore((s) => s.notify)
  const today = new Date()
  const submission = parseDay(e.tender.meta.submission_date)
  const [month, setMonth] = useState(today.getMonth())
  const [year, setYear] = useState(today.getFullYear())
  const key = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
  const events = useMemo(() => {
    const out = new Map<string, string[]>()
    const add = (d: Date | null, s: string) => d && out.set(key(d), [...(out.get(key(d)) ?? []), s])
    add(parseDay(e.tender.meta.document_date), 'Tender document issued')
    add(new Date(e.tender.created_at), 'Tender imported')
    e.activity.forEach((a) => a.kind !== 'import' && add(new Date(a.at), a.text))
    add(submission, 'Submission')
    return out
  }, [e, submission])
  const shift = (n: number) => {
    const d = new Date(year, month + n, 1)
    setMonth(d.getMonth())
    setYear(d.getFullYear())
  }
  const days = new Date(year, month + 1, 0).getDate()
  const offset = (new Date(year, month, 1).getDay() + 6) % 7
  return (
    <section className="card calendar">
      <div className="section-heading">
        <h3>
          {MONTHS[month]} {year}
        </h3>
        <div className="inline">
          <button className="icon-button" aria-label="Previous month" onClick={() => shift(-1)}>
            <ChevronLeft size={17} />
          </button>
          <button className="icon-button" aria-label="Next month" onClick={() => shift(1)}>
            <ChevronRight size={17} />
          </button>
        </div>
      </div>
      <div className="calendar-grid">
        {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => (
          <small key={d}>{d}</small>
        ))}
        {Array.from({ length: offset }, (_, i) => (
          <span key={'empty' + i} />
        ))}
        {Array.from({ length: days }, (_, i) => i + 1).map((d) => {
          const day = new Date(year, month, d)
          const ev = events.get(key(day)) ?? []
          // the days left between today and the submission deadline are tinted light red
          const left = !!submission && day > today && day < submission && key(day) !== key(submission)
          const cls = [
            key(day) === key(today) ? 'today' : submission && key(day) === key(submission) ? 'deadline' : ev.length ? 'busy-day' : '',
            left ? 'countdown' : '',
          ].join(' ')
          return (
            <button
              key={d}
              className={cls}
              title={ev.slice(0, 3).join('\n')}
              onClick={() => notify(`${d}. ${MONTHS[month]} ${year} · ${ev.length ? `${ev.length} event${ev.length > 1 ? 's' : ''}: ${ev[ev.length - 1]}` : 'Nothing recorded'}`)}
            >
              {d}
            </button>
          )
        })}
      </div>
      <div className="calendar-legend">
        <span>
          <i className="blue" />
          Today
        </span>
        <span>
          <i className="red" />
          Submission
        </span>
        {submission && (
          <span>
            <i className="light-red" />
            Days left
          </span>
        )}
        <span>
          <i className="peach" />
          Tender activity
        </span>
      </div>
    </section>
  )
}

function Tasks({ onOpen }: { onOpen: (lvId: string) => void }) {
  const e = useEstimate()
  const navigate = useNavigate()
  const filter = useStore((s) => s.filter)
  const due = e.tender.meta.submission_date ? fmtDate(e.tender.meta.submission_date) : '—'
  const quotes = e.positions.filter((p) => !p.reviewed && p.status === 'supplier_quote_required')
  const calculated = e.positions.filter((p) => !p.reviewed && p.status === 'calculated')
  const tasks: { name: string; sub: string; prio: 'High' | 'Medium' | 'Low'; go: () => void }[] = [
    ...e.positions.filter(needsDecision).map((p) => ({
      name: positionLabel(p),
      sub: `${p.lv_id} · ${p.assumptions[0] ?? 'Decide how to price this position'}`,
      prio: 'High' as const,
      go: () => onOpen(p.lv_id),
    })),
    ...e.checks
      .filter((c) => c.level === 'warning')
      .map((c) => ({
        name: c.title,
        sub: `Design check · PDF page ${c.pages.join(', ')}`,
        prio: 'High' as const,
        go: () => {
          filter({ only: { label: c.title, ids: c.positions }, pill: 'all', system: 'all' })
          navigate('/review')
        },
      })),
    ...(quotes.length
      ? [{ name: 'Request supplier quotes', sub: `${quotes.length} positions priced from package benchmarks`, prio: 'Medium' as const, go: () => navigate('/export') }]
      : []),
    ...(calculated.length
      ? [
          {
            name: `Approve ${calculated.length} catalogue-priced positions`,
            sub: 'Exact catalogue match, check and approve',
            prio: 'Low' as const,
            go: () => {
              filter({ pill: 'calculated', system: 'all', only: null })
              navigate('/review')
            },
          },
        ]
      : []),
  ]
  return (
    <section className="card tasks">
      <div className="section-heading">
        <h3>Open tasks</h3>
        <button className="text-button" onClick={() => navigate('/review')}>
          View all <ArrowRight size={14} />
        </button>
      </div>
      <table>
        <thead>
          <tr>
            <th>Task</th>
            <th>Due date</th>
            <th>Priority</th>
          </tr>
        </thead>
        <tbody>
          {tasks.slice(0, 5).map((t, i) => (
            <tr key={i} onClick={t.go}>
              <td>
                {t.name}
                <small>{t.sub}</small>
              </td>
              <td className="due">{due}</td>
              <td>
                <span className={`priority ${t.prio === 'High' ? 'high' : t.prio === 'Low' ? 'low' : ''}`}>{t.prio}</span>
              </td>
            </tr>
          ))}
          {!tasks.length && (
            <tr>
              <td colSpan={3}>
                <Check size={14} /> Nothing open. Export the offer.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {tasks.length > 5 && <small className="muted">+ {tasks.length - 5} more tasks</small>}
    </section>
  )
}

function Documents() {
  const e = useEstimate()
  const navigate = useNavigate()
  const m = metrics(e.positions)
  const blockers = e.positions.filter(isBlocker).length
  const docs: [string, string, string, () => void][] = [
    [e.tender.name, `Original tender · ${e.tender.pages} pages`, 'PDF', () => window.open(api.tenderPdfUrl(e.tender.id), '_blank')],
    ['Priced tender (PDF)', `Prices written into the LV · ${fmtChf(e.project.selling_price_rounded_chf)}`, 'PDF', () => navigate('/export')],
    ['Offer workbook (Excel)', `${m.total} positions with sources · ${blockers} open`, 'XLS', () => navigate('/export')],
    ['Supplier RFQs', `${e.positions.filter((p) => p.status === 'supplier_quote_required').length} positions in packages`, 'RFQ', () => navigate('/export')],
  ]
  return (
    <section className="card documents">
      <div className="section-heading">
        <h3>Key documents</h3>
        <button className="text-button" onClick={() => navigate('/export')}>
          View all <ArrowRight size={14} />
        </button>
      </div>
      {docs.map(([name, sub, type, go]) => (
        <button key={name} onClick={go}>
          <span className={`file-icon ${type === 'XLS' ? 'csv' : ''}`}>{type}</span>
          <span>
            {name}
            <small>{sub}</small>
          </span>
          <ChevronRight size={15} />
        </button>
      ))}
      {e.checks.some((c) => c.level === 'warning') && (
        <div className="notice subtle">
          <AlertTriangle size={16} /> {e.checks.filter((c) => c.level === 'warning').length} design checks to verify before submitting
        </div>
      )}
      <small className="muted">Total CHF {money(e.project.selling_price_rounded_chf)} incl. overhead and margin</small>
    </section>
  )
}
