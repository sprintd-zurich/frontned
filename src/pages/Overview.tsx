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
  Download,
  FileText,
  MapPin,
  MessageSquare,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  UserRound,
} from 'lucide-react'
import { initials, isBlocker, lastOf, metrics, workflow, type Pill } from '../derive'
import { fmtChf, fmtDate, fmtWhen, money, parseDay } from '../format'
import { api } from '../api'
import { useEstimate, useStore } from '../store'
import { canEdit, useAuth } from '../auth'
import type { Activity } from '../types'
import { Button, Modal, Progress } from '../components/ui'
import { MetaForm } from './MetaForm'
import { Workflow } from '../components/Shell'

export function ProjectsSidebar() {
  const { tenders, estimate, open, removeTender, archiveTender, busy } = useStore()
  const [q, setQ] = useState('')
  const [tab, setTab] = useState<'All' | 'In review' | 'New' | 'Archived'>('All')
  const [importing, setImporting] = useState(false)
  const [confirm, setConfirm] = useState<string | null>(null)
  const navigate = useNavigate()
  // archived tenders only show under Archived, until they are restored or deleted permanently from there
  const inTab = (t: (typeof tenders)[number], name: string) =>
    name === 'Archived'
      ? t.archived
      : !t.archived && (name === 'All' || (name === 'In review' ? t.reviewed > 0 : t.reviewed === 0))
  const active = tenders.filter((t) => !t.archived)
  const shown = tenders.filter(
    (t) => `${t.meta.project_name} ${t.name} ${t.meta.location}`.toLowerCase().includes(q.toLowerCase()) && inTab(t, tab),
  )
  const editor = canEdit(useAuth((st) => st.user))
  return (
    <aside className="projects-sidebar">
      <div className="section-heading">
        <h3>My tenders</h3>
        {editor && (
          <button className="button small primary" onClick={() => setImporting(true)}>
            <Plus size={14} /> New tender
          </button>
        )}
      </div>
      <label className="search-field">
        <Search size={16} />
        <input placeholder="Search tenders…" aria-label="Search tenders" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      <div className="project-tabs">
        {(['All', 'In review', 'New', 'Archived'] as const).map((t) => (
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
            {t.archived ? (
              <span className="project-archived-actions">
                <button className="project-remove" aria-label={`Restore ${t.name}`} title="Restore tender" onClick={() => archiveTender(t.id, false)}>
                  <RotateCcw size={14} />
                </button>
                <button className="project-remove" aria-label={`Delete ${t.name} permanently`} title="Delete permanently" onClick={() => setConfirm(t.id)}>
                  <Trash2 size={14} />
                </button>
              </span>
            ) : (
              <button className="project-remove" aria-label={`Archive ${t.name}`} title="Move to Archived" onClick={() => archiveTender(t.id, true)}>
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
        {!shown.length && <p className="muted portfolio-empty">{tab === 'Archived' ? 'No archived tender.' : active.length ? 'No tender matches.' : 'No tender imported yet.'}</p>}
      </div>
      <span className="portfolio-note">Stored on the pricing server · {active.length} tenders{tenders.length > active.length ? ` · ${tenders.length - active.length} archived` : ''}</span>
      {importing && (
        <Modal title="Import a tender" close={() => setImporting(false)}>
          <ImportPanel onDone={() => setImporting(false)} />
        </Modal>
      )}
      {confirm && (
        <Modal title="Delete this tender permanently?" close={() => setConfirm(null)}>
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
              <Trash2 size={15} /> Delete permanently
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
        <span className="eyebrow">FAVON TENDER INTELLIGENCE</span>
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
            ['Export', 'Priced tender PDF and offer workbook'],
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
  const navigate = useNavigate()
  const filter = useStore((s) => s.filter)
  const [editing, setEditing] = useState(false)
  const m = metrics(e.positions)
  const meta = e.tender.meta
  const ready = m.open === 0
  const complete = m.priceable > 0 && m.approved === m.priceable
  const status: [string, number, string, () => void][] = [
    ['Approved', m.approved, '#009b7d', () => go('approved', '/positions')],
    ['Needs attention', m.attention, '#ff7929', () => go('decision', '/matched')],
    ['Ready to approve', m.open - m.attention, '#a7afbd', () => go('all', '/matched')],
  ]
  function go(pill: Pill, url: string) {
    filter({ pill, system: 'all', search: '', only: null })
    navigate(url)
  }
  return (
    <>
      <section className="project-hero card">
        <div className="hero-main">
          <img src="/project-building.jpg" alt="" />
          <div className="hero-title">
            <span className="eyebrow">FAVON TENDER INTELLIGENCE</span>
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
          <div className="hero-progress hero-status">
            <div className="section-heading">
              <span>Project status</span>
              <span className={`badge ${ready ? 'success' : 'info'}`}>{ready ? 'Ready to submit' : 'In progress'}</span>
            </div>
            <div className="section-heading">
              <small>
                {m.approved} of {m.priceable} priced positions approved
              </small>
              <b>{m.percent}%</b>
            </div>
            <Progress value={m.percent} />
            <div className="hero-status-legend">
              {status.map(([s, n, c, click]) => (
                <button key={s} onClick={click}>
                  <i style={{ background: c }} />
                  {s} <b>{n}</b>
                </button>
              ))}
            </div>
            {complete ? (
              <a className="button small primary report-button" href={api.pricedLvUrl(e.tender.id)}>
                <Download size={14} /> Download priced tender (PDF)
              </a>
            ) : (
              <button className="button small report-button" disabled title="Approve every priced position first">
                <Download size={14} /> Download report · {m.priceable - m.approved} still to approve
              </button>
            )}
          </div>
        </div>
        <Workflow stepsOnly />
      </section>
      <div className="metrics">
        {(
          [
            [FileText, 'Total positions', String(m.total), `${m.priceable} priced · ${m.total - m.priceable} summary lines`, 'info', 'all'],
            [CheckCheck, 'Approved', String(m.approved), `${m.percent}% of priced positions`, 'success', 'approved'],
            [Clock3, 'Needs attention', String(m.attention), 'Decision, missing information or supplier price', 'warning', 'decision'],
            [MessageSquare, 'To approve', String(m.open), `of ${m.priceable} priced positions`, 'neutral', 'all'],
            [Database, 'Indicative price', fmtChf(e.project.selling_price_rounded_chf), `Direct cost ${fmtChf(e.project.direct_cost_chf)}`, 'info', 'value'],
          ] as const
        ).map(([I, label, value, sub, color, pill]) => (
          <button
            className="metric card"
            key={label}
            onClick={() => (pill === 'value' ? navigate('/bid') : go(pill, pill === 'decision' ? '/matched' : '/positions'))}
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
        <section className="card activity">
          <div className="section-heading">
            <h3>Recent activity</h3>
            <span className="live-label">Saved</span>
          </div>
          {[...e.activity]
            .reverse()
            .slice(0, 6)
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
      </div>
      <div className="dashboard-lower">
        <Documents />
        <ProductLists />
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
  const who = a.kind === 'import' && !a.by ? 'LV' : a.kind === 'export' && !a.by ? 'EX' : initials(a.by ?? estimator)
  return (
    <div className="activity-item">
      <span className={`avatar tiny ${a.kind}`} title={a.by ?? undefined}>{who}</span>
      <div>
        {a.text}
        <small>
          {a.by ? `${a.by} · ` : ''}
          {fmtWhen(a.at)}
        </small>
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
    ['Nothing needs attention', m.attention === 0, m.attention === 0 ? (lastReview ? fmtDate(lastReview.at) : 'Done') : `${m.attention} open`],
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

function Documents() {
  const e = useEstimate()
  const navigate = useNavigate()
  const m = metrics(e.positions)
  const blockers = e.positions.filter(isBlocker).length
  const docs: [string, string, string, () => void][] = [
    [e.tender.name, `Original tender · ${e.tender.pages} pages`, 'PDF', () => window.open(api.tenderPdfUrl(e.tender.id), '_blank')],
    ['Priced tender (PDF)', `Prices written into the LV · ${fmtChf(e.project.selling_price_rounded_chf)}`, 'PDF', () => navigate('/export')],
    ['Offer workbook (Excel)', `${m.total} positions with sources · ${blockers} open`, 'XLS', () => navigate('/export')],
    ['Supplier requests', `${e.positions.filter((p) => p.status === 'supplier_quote_required').length} positions wait for a price`, 'RFQ', () => navigate('/supplier')],
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

/** Product and technical lists for this tender: drop them in and the prices and product data in them are read out. */
function ProductLists() {
  const e = useEstimate()
  const act = useStore((s) => s.act)
  const busy = useStore((s) => s.busy)
  const navigate = useNavigate()
  const input = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)
  const add = async (files: FileList | File[]) => {
    for (const f of Array.from(files)) {
      await act(`Reading ${f.name}…`, (tid) => api.uploadSheet(tid, f, [], ''), `${f.name} added to the product lists.`)
    }
  }
  const editor = canEdit(useAuth((st) => st.user))
  const sheets = [...e.sheets].reverse()
  return (
    <section className="card product-lists">
      <div className="section-heading">
        <h3>Product lists</h3>
        <Button primary className="small" disabled={!!busy || !editor} onClick={() => input.current?.click()}>
          <Upload size={14} /> Upload
        </Button>
      </div>
      <input
        ref={input}
        type="file"
        multiple
        hidden
        accept=".pdf,.xlsx,.xlsm,.csv,.txt"
        onChange={(ev) => {
          if (ev.target.files?.length) add(ev.target.files)
          ev.target.value = ''
        }}
      />
      <div
        className={`product-drop ${drag ? 'drag' : ''}`}
        role="button"
        tabIndex={0}
        onKeyDown={(ev) => ev.key === 'Enter' && input.current?.click()}
        onClick={() => !busy && input.current?.click()}
        onDragOver={(ev) => {
          ev.preventDefault()
          setDrag(true)
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(ev) => {
          ev.preventDefault()
          setDrag(false)
          if (ev.dataTransfer.files.length) add(ev.dataTransfer.files)
        }}
      >
        <Upload size={20} />
        <span>
          <strong>Drop product and technical lists here</strong>
          <small>PDF data sheets, price lists or Excel / CSV product lists. Prices, types, article numbers and lead times are read out.</small>
        </span>
      </div>
      <div className="product-list-files">
        {sheets.map((s) => (
          <a key={s.id} href={api.sheetUrl(e.tender.id, s.id)} target="_blank" rel="noreferrer">
            <span className={`file-icon ${/\.(xlsx|xlsm|csv)$/i.test(s.name) ? 'csv' : ''}`}>{s.name.split('.').pop()?.toUpperCase().slice(0, 4)}</span>
            <span>
              {s.name}
              <small>
                {s.found.readable
                  ? [
                      `${s.found.pages} ${/\.(xlsx|xlsm)$/i.test(s.name) ? 'sheet' : 'page'}${s.found.pages === 1 ? '' : 's'}`,
                      `${s.found.prices.length} price${s.found.prices.length === 1 ? '' : 's'}`,
                      s.found.manufacturer,
                      s.lv_ids.length ? `linked to ${s.lv_ids.length} position${s.lv_ids.length === 1 ? '' : 's'}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  : 'Stored, no readable text'}
              </small>
            </span>
            <ChevronRight size={15} />
          </a>
        ))}
        {!sheets.length && <p className="muted">No product lists yet.</p>}
      </div>
      {!!sheets.length && (
        <button className="text-button" onClick={() => navigate('/supplier')}>
          Use them for supplier prices <ArrowRight size={14} />
        </button>
      )}
    </section>
  )
}
