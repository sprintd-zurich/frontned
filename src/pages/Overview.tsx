import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Clock,
  Database,
  FileText,
  FileUp,
  FolderOpen,
  Play,
  RefreshCw,
  Sparkles,
  Lock,
  Trash2,
  Upload,
} from 'lucide-react'
import { fmtChf, fmtWhen } from '../format'
import { tenderPath } from '../routes'
import { useStore } from '../store'
import type { Activity } from '../types'
import { Button } from '../components/ui'
import { PriceBookBadge } from '../components/PriceBook'

export function Overview() {
  const navigate = useNavigate()
  const { estimate } = useStore()

  return (
    <div className="overview-container">
      {/* Hero Welcome Banner */}
      <div className="overview-hero">
        <div className="hero-content">
          <span className="hero-tag">EQUANS TENDER PLATFORM</span>
          <h1 className="hero-title">Tender Ingestion & Resource Intelligence</h1>
          <p className="hero-desc">
            Upload new tender PDF documents, resume your saved tender sessions, and manage reference pricing catalogues.
          </p>
        </div>

        {estimate && (
          <div className="hero-active-card">
            <div className="hero-active-header">
              <span className="live-dot" />
              <span>ACTIVE SESSION LOADED</span>
            </div>
            <div className="hero-active-body">
              <h3 title={estimate.tender.name}>{estimate.tender.name}</h3>
              <div className="hero-active-metrics">
                <div>
                  <strong>{estimate.positions.length}</strong>
                  <small>Positions</small>
                </div>
                <div>
                  <strong>{estimate.tender.pages}</strong>
                  <small>Pages</small>
                </div>
                <div>
                  <strong>{fmtChf(estimate.project.cost_baseline_chf)}</strong>
                  <small>Direct Cost</small>
                </div>
              </div>
              <PriceBookBadge />
              <Button primary onClick={() => navigate(tenderPath(estimate.tender.id, 'positions'))}>
                Open this project <ArrowRight size={15} />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Main 2-Column Section: Tender Management & Resume */}
      <div className="overview-grid">
        {/* Left Card: 1. Create Tender by Uploading PDF */}
        <section className="card upload-tender-card">
          <div className="section-heading">
            <div className="heading-with-icon">
              <div className="icon-badge blue">
                <FileUp size={18} />
              </div>
              <div>
                <h2>1. Create New Tender</h2>
                <small className="muted">Upload tender specification PDF (e.g. BKP 244 Lüftung)</small>
              </div>
            </div>
          </div>

          <PdfUploadDropzone />
        </section>

        {/* Right Card: 2. Resume Previous Tender */}
        <section className="card resume-tender-card">
          <div className="section-heading">
            <div className="heading-with-icon">
              <div className="icon-badge emerald">
                <FolderOpen size={18} />
              </div>
              <div>
                <h2>2. Resume Previous Tender</h2>
                <small className="muted">Continue working on saved and extracted tender sessions</small>
              </div>
            </div>
            <RefreshTendersButton />
          </div>

          <PreviousTendersList />
        </section>
      </div>

      {/* Section 2: Company Resources */}
      <section className="card company-resources-section">
        <div className="section-heading">
          <div className="heading-with-icon">
            <div className="icon-badge purple">
              <Database size={18} />
            </div>
            <div>
              <h2>3. Reference price books</h2>
              <small className="muted">
                Catalogue, installation rules with labour rates and project parameters — one versioned book per region
              </small>
            </div>
          </div>
        </div>

        <CompanyResourcesManager />
      </section>
    </div>
  )
}
function PdfUploadDropzone() {
  const { upload, loadDemo, busy } = useStore()
  const navigate = useNavigate()
  const pdfInput = useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = useState(false)

  const enter = (id: string | null) => {
    if (id) navigate(tenderPath(id, 'positions'))
  }

  const handleFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      alert('Please upload a PDF document.')
      return
    }
    enter(await upload(file))
  }

  return (
    <div className="pdf-upload-box">
      <div
        className={`upload-dropzone-large ${dragActive ? 'drag' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragActive(true)
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragActive(false)
          if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0])
        }}
        onClick={() => !busy && pdfInput.current?.click()}
      >
        <input
          ref={pdfInput}
          type="file"
          accept="application/pdf"
          hidden
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        {busy ? (
          <div className="dropzone-busy">
            <span className="spinner" />
            <h3>Processing Tender Document…</h3>
            <p className="muted">{busy}</p>
            <small>Extracting positions, identifying components, matching catalog rules</small>
          </div>
        ) : (
          <div className="dropzone-idle">
            <div className="dropzone-icon">
              <FileUp size={32} />
            </div>
            <h3>Drop tender PDF here or browse</h3>
            <p className="muted">Supports official BKP specification documents with full text and duct lists</p>
            <span className="browse-badge">Select PDF File</span>
          </div>
        )}
      </div>

      <div className="quick-demo-action">
        <div>
          <strong>Quick Demo:</strong>
          <span className="muted"> Test with pre-configured Schulhaus Oberglatt BKP 244</span>
        </div>
        <Button primary disabled={!!busy} onClick={async () => enter(await loadDemo())}>
          <Sparkles size={14} /> Load Demo Tender
        </Button>
      </div>
    </div>
  )
}

function PreviousTendersList() {
  const { tenders, estimate, open, removeTender, busy, notify } = useStore()
  const navigate = useNavigate()
  const [openingId, setOpeningId] = useState<string | null>(null)

  const handleResume = async (tid: string) => {
    setOpeningId(tid)
    try {
      const id = await open(tid)
      notify('Tender resumed successfully.')
      if (id) navigate(tenderPath(id, 'positions'))
    } finally {
      setOpeningId(null)
    }
  }

  const handleDelete = async (e: React.MouseEvent, tid: string, name: string) => {
    e.stopPropagation()
    if (confirm(`Are you sure you want to delete "${name}"?`)) {
      await removeTender(tid)
      notify('Tender deleted.')
    }
  }

  if (tenders.length === 0) {
    return (
      <div className="empty-tenders-state">
        <FolderOpen size={30} color="#94a3b8" />
        <p>No previous tenders saved yet.</p>
        <small className="muted">Upload a PDF or load the demo tender to get started.</small>
      </div>
    )
  }

  return (
    <div className="previous-tenders-list">
      {tenders.map((t) => {
        const isActive = estimate?.tender.id === t.id
        const isCurrentOpening = openingId === t.id

        return (
          <div
            key={t.id}
            className={`tender-session-item ${isActive ? 'active' : ''}`}
            onClick={() => !isActive && !isCurrentOpening && handleResume(t.id)}
          >
            <div className="tender-item-left">
              <div className={`tender-icon-box ${isActive ? 'active' : ''}`}>
                <FileText size={18} />
              </div>
              <div className="tender-item-info">
                <div className="tender-name-row">
                  <h4 title={t.name}>{t.name}</h4>
                  {isActive && <span className="active-tag">Active</span>}
                </div>
                <div className="tender-meta-row">
                  <span>
                    <Clock size={11} /> {fmtWhen(t.created_at)}
                  </span>
                  <span>· {t.pages} pages</span>
                  <span>· <b>{t.positions}</b> positions</span>
                  {t.reviewed > 0 && <span className="reviewed-count">· {t.reviewed} approved</span>}
                </div>
              </div>
            </div>

            <div className="tender-item-actions">
              {isActive ? (
                <Button primary className="small" onClick={() => navigate(tenderPath(t.id, 'positions'))}>
                  Open <ArrowRight size={13} />
                </Button>
              ) : (
                <button
                  className="button small"
                  disabled={!!busy || isCurrentOpening}
                  onClick={(ev) => {
                    ev.stopPropagation()
                    handleResume(t.id)
                  }}
                >
                  {isCurrentOpening ? <span className="spinner" /> : <Play size={12} />} Resume
                </button>
              )}
              <button
                className="icon-button danger"
                title="Delete saved tender"
                onClick={(ev) => handleDelete(ev, t.id, t.name)}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function RefreshTendersButton() {
  const { refreshTenders } = useStore()
  const [spinning, setSpinning] = useState(false)

  const handleRefresh = async () => {
    setSpinning(true)
    await refreshTenders()
    setTimeout(() => setSpinning(false), 500)
  }

  return (
    <button className="icon-button" title="Refresh tenders" onClick={handleRefresh}>
      <RefreshCw size={14} className={spinning ? 'spin' : ''} />
    </button>
  )
}

export function CompanyResourcesManager() {
  const { datasets, createDataset, importDataset, deleteDataset, estimate, setDataset, busy } = useStore()
  const [creating, setCreating] = useState<'' | 'import' | 'derive'>('')

  return (
    <div className="pricebook-library">
      <div className="pricebook-library-grid">
        {datasets.map((d) => {
          const inUse = estimate?.dataset.id === d.id
          return (
            <div key={d.id} className={`pricebook-tile ${inUse ? 'active' : ''}`}>
              <div className="pricebook-tile-head">
                <div className="resource-title-group">
                  {d.immutable ? <Lock size={15} color="#64748b" /> : <Database size={15} color="#7c3aed" />}
                  <div>
                    <strong>{d.name}</strong>
                    <small className="muted">
                      {[d.country, d.location || d.region_label].filter(Boolean).join(' · ') || 'No location set'}
                    </small>
                  </div>
                </div>
                {inUse ? (
                  <span className="status-pill active">In Use · v{estimate?.dataset.version}</span>
                ) : (
                  <span className="status-pill">v{d.latest_version}</span>
                )}
              </div>

              <div className="pricebook-tile-actions">
                {estimate && !inUse && (
                  <button className="text-button" disabled={!!busy} onClick={() => setDataset(d.id)}>
                    Use for this tender
                  </button>
                )}
                {!d.immutable && (
                  <button className="text-button danger" onClick={() => deleteDataset(d.id)}>
                    Remove
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {creating === 'import' ? (
        <ImportPriceBookForm
          datasets={datasets}
          busy={!!busy}
          onCancel={() => setCreating('')}
          onImport={async (body) => {
            if (await importDataset(body)) setCreating('')
          }}
        />
      ) : creating === 'derive' ? (
        <NewPriceBookForm
          datasets={datasets}
          onCancel={() => setCreating('')}
          onCreate={async (body) => {
            await createDataset(body)
            setCreating('')
          }}
        />
      ) : (
        <div className="pricebook-create-actions">
          <Button primary onClick={() => setCreating('import')}><FileUp size={15} /> Import CSV dataset</Button>
          <Button onClick={() => setCreating('derive')}><Upload size={15} /> Derive from existing</Button>
        </div>
      )}
    </div>
  )
}

/** Create a regional book by copying an existing one and shifting material costs and labour rates. */
function NewPriceBookForm({
  datasets,
  onCreate,
  onCancel,
}: {
  datasets: { id: string; name: string; latest_version: number }[]
  onCreate: (b: {
    name: string
    clone_of: string
    region: string
    region_label: string
    country: string
    location: string
    material_factor_pct: number
    labour_factor_pct: number
  }) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState({
    name: '',
    clone_of: datasets[0]?.id ?? '',
    region: '',
    region_label: '',
    country: 'Switzerland',
    location: '',
    material: '0',
    labour: '0',
  })
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <form
      className="pricebook-form"
      onSubmit={(ev) => {
        ev.preventDefault()
        if (!form.name.trim()) return
        onCreate({
          name: form.name.trim(),
          clone_of: form.clone_of,
          region: form.region.trim(),
          region_label: form.region_label.trim(),
          country: form.country.trim(),
          location: form.location.trim(),
          material_factor_pct: Number(form.material) || 0,
          labour_factor_pct: Number(form.labour) || 0,
        })
      }}
    >
      <h4>
        <Upload size={15} /> Derive a new price book
      </h4>
      <p className="muted">
        Every net cost and hourly rate is copied and shifted by the percentages below. The derivation is recorded on the
        book so the figures never look independently sourced.
      </p>
      <div className="pricebook-form-grid">
        <label>
          Name
          <input value={form.name} onChange={(ev) => set('name', ev.target.value)} placeholder="Equans Romandie 2026" required />
        </label>
        <label>
          Copy from
          <select value={form.clone_of} onChange={(ev) => set('clone_of', ev.target.value)}>
            {datasets.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} (v{d.latest_version})
              </option>
            ))}
          </select>
        </label>
        <label>
          Country
          <input value={form.country} onChange={(ev) => set('country', ev.target.value)} placeholder="Switzerland" />
        </label>
        <label>
          Location
          <input value={form.location} onChange={(ev) => set('location', ev.target.value)} placeholder="Zurich / Oberglatt" />
        </label>
        <label>
          Region code
          <input value={form.region} onChange={(ev) => set('region', ev.target.value)} placeholder="CH-VD" />
        </label>
        <label>
          Region name
          <input value={form.region_label} onChange={(ev) => set('region_label', ev.target.value)} placeholder="Romandie / Lausanne" />
        </label>
        <label>
          Material %
          <input type="number" step="0.1" value={form.material} onChange={(ev) => set('material', ev.target.value)} />
        </label>
        <label>
          Labour rates %
          <input type="number" step="0.1" value={form.labour} onChange={(ev) => set('labour', ev.target.value)} />
        </label>
      </div>
      <div className="pricebook-form-actions">
        <Button primary type="submit">
          Create price book
        </Button>
        <Button onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  )
}

function ImportPriceBookForm({
  datasets,
  busy,
  onImport,
  onCancel,
}: {
  datasets: { id: string; name: string }[]
  busy: boolean
  onImport: (body: {
    name: string
    country: string
    location: string
    region: string
    currency: string
    note: string
    base_dataset: string
    catalog: File
    productivity: File
    parameters?: File | null
  }) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [country, setCountry] = useState('Switzerland')
  const [location, setLocation] = useState('')
  const [region, setRegion] = useState('')
  const [currency, setCurrency] = useState('CHF')
  const [note, setNote] = useState('')
  const [base, setBase] = useState(datasets[0]?.id ?? '')
  const [catalog, setCatalog] = useState<File | null>(null)
  const [productivity, setProductivity] = useState<File | null>(null)
  const [parameters, setParameters] = useState<File | null>(null)

  return (
    <form className="pricebook-form dataset-import-form" onSubmit={(ev) => {
      ev.preventDefault()
      if (!catalog || !productivity || !name.trim()) return
      onImport({ name: name.trim(), country: country.trim(), location: location.trim(), region: region.trim(),
        currency: currency.trim() || 'CHF', note: note.trim(), base_dataset: base, catalog, productivity, parameters })
    }}>
      <h4><FileUp size={15} /> Import a CSV dataset</h4>
      <p className="muted">Use the same columns as the starter package. The catalogue and productivity files are validated before the dataset is created. Project parameters can be uploaded or inherited from an existing dataset.</p>
      <div className="pricebook-form-grid">
        <label>Name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Swiss HVAC 2027" required /></label>
        <label>Country<input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Switzerland" /></label>
        <label>Location<input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Zurich / Oberglatt" /></label>
        <label>Region code<input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="CH-ZH" /></label>
        <label>Currency<input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} /></label>
        <label>Parameters fallback<select value={base} onChange={(e) => setBase(e.target.value)}>{datasets.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
        <label>Catalogue CSV<input type="file" accept=".csv,text/csv" onChange={(e) => setCatalog(e.target.files?.[0] ?? null)} required /></label>
        <label>Productivity CSV<input type="file" accept=".csv,text/csv" onChange={(e) => setProductivity(e.target.files?.[0] ?? null)} required /></label>
        <label>Project parameters JSON (optional)<input type="file" accept=".json,application/json" onChange={(e) => setParameters(e.target.files?.[0] ?? null)} /></label>
        <label>Notes<input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Supplier catalogue, effective January 2027" /></label>
      </div>
      <div className="dataset-file-summary">
        <span className={catalog ? 'ready' : ''}>{catalog?.name || 'catalog.csv required'}</span>
        <span className={productivity ? 'ready' : ''}>{productivity?.name || 'productivity.csv required'}</span>
        <span className={parameters ? 'ready' : ''}>{parameters?.name || 'parameters inherited'}</span>
      </div>
      <div className="pricebook-form-actions">
        <Button primary type="submit" disabled={busy || !catalog || !productivity || !name.trim()}>Import dataset</Button>
        <Button onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  )
}


export function ActivityItem({ a }: { a: Activity }) {
  return (
    <div className="activity-item">
      <div>
        <p>{a.text}</p>
        <small className="muted">{fmtWhen(a.at)}</small>
      </div>
    </div>
  )
}
