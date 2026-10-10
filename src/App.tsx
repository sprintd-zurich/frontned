import { useEffect, useState } from 'react'
import { NavLink, Navigate, Outlet, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowRight, CheckCircle2, HelpCircle, Search, X } from 'lucide-react'
import { initials } from './derive'
import { HOME, type TenderPage, pageOf, tenderIdOf, tenderPath } from './routes'
import { useStore } from './store'
import { Button, Modal } from './components/ui'
import { ProjectsHome } from './pages/ProjectsHome'
import { StructuredItems } from './pages/StructuredItems'
import { MatchedItems } from './pages/MatchedItems'
import { DirectCostsCalculation } from './pages/DirectCostsCalculation'
import { Workspace } from './pages/Workspace'
import { FaceToFace } from './pages/FaceToFace'
import { Systems } from './pages/Systems'
import { Bid } from './pages/Bid'
import { Export } from './pages/Export'
import { SupplierRFQ } from './pages/SupplierRFQ'
import { Validation } from './pages/Validation'
import { MetaForm } from './pages/MetaForm'

const NAV: { page: TenderPage; label: string }[] = [
  { page: 'positions', label: 'Items' },
  { page: 'matched', label: 'Product Matching' },
  { page: 'rfq', label: 'Supplier Quotes' },
  { page: 'calculation', label: 'Calculation' },
  { page: 'bid', label: 'Bid' },
  { page: 'validation', label: 'Validation' },
  { page: 'export', label: 'Export' },
]

const LEGACY: Record<string, TenderPage> = {
  '/positions': 'positions',
  '/matched': 'matched',
  '/calculation': 'calculation',
  '/rfq': 'rfq',
  '/bid': 'bid',
  '/validation': 'validation',
  '/export': 'export',
  '/systems': 'systems',
  '/face-to-face': 'face-to-face',
  '/review': 'review',
}

export default function App() {
  const loc = useLocation()
  const navigate = useNavigate()
  const { estimate, ready, init, search, filter, toast, notify, error, busy } = useStore()
  const [modal, setModal] = useState<'' | 'help' | 'profile'>('')
  const tid = estimate?.tender.id ?? tenderIdOf(loc.pathname)
  const page = pageOf(loc.pathname)
  const atHome = loc.pathname === HOME

  useEffect(() => {
    init()
  }, [init])
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [loc.pathname])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => notify(''), 4200)
    return () => clearTimeout(t)
  }, [toast, notify])

  return (
    <>
      <header className="topbar">
        <NavLink to={HOME} className="brand" aria-label="EQUANS home">
          EQUANS
        </NavLink>
        {tid && estimate && !atHome ? (
          <NavLink to={HOME} className="project-crumb" title="Change project">
            <span className="project-crumb-name">{estimate.tender.meta.project_name || estimate.tender.name}</span>
            <span className="project-crumb-hint">Change project</span>
          </NavLink>
        ) : (
          <span className="project-crumb home-only">Projects</span>
        )}
        {tid && !atHome ? (
          <nav>
            {NAV.map(({ page: p, label }) => (
              <NavLink
                key={p}
                to={tenderPath(tid, p)}
                className={({ isActive }) =>
                  isActive || (page === 'face-to-face' && p === 'positions') ? 'active' : ''
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        ) : (
          <nav />
        )}
        <label className="global-search">
          <Search size={18} />
          <input
            aria-label="Search positions"
            placeholder="Search positions, products, or keywords…"
            value={search}
            disabled={!estimate || atHome}
            onChange={(e) => {
              if (!tid) return
              filter({ search: e.target.value })
              if (page === 'export' || page === 'bid' || atHome) navigate(tenderPath(tid, 'positions'))
            }}
          />
        </label>
        {busy && <span className="spinner" title={busy} aria-label={busy} />}
        <button className="icon-button help" title="How it works" onClick={() => setModal('help')}>
          <HelpCircle />
        </button>
        <button className="avatar" title="Estimator" onClick={() => setModal('profile')}>
          {initials(estimate?.tender.meta.estimator)}
        </button>
      </header>
      {error && (
        <div className="error-banner" role="alert">
          <AlertTriangle size={17} /> {error}
          <button aria-label="Dismiss" onClick={() => useStore.setState({ error: null })}>
            <X size={15} />
          </button>
        </div>
      )}
      <div className="app full-width">
        <main className={atHome ? 'dashboard-main full-width' : 'workspace-main'}>
          {!ready ? (
            <div className="loading-state">
              <span className="spinner" /> Connecting to the pricing API…
            </div>
          ) : (
            <Routes>
              <Route path="/" element={<ProjectsHome />} />
              <Route path="/tenders/:tid" element={<TenderGate />}>
                <Route index element={<Navigate to="positions" replace />} />
                <Route path="positions" element={<StructuredItems />} />
                <Route path="matched" element={<MatchedItems />} />
                <Route path="calculation" element={<DirectCostsCalculation />} />
                <Route path="rfq" element={<SupplierRFQ />} />
                <Route path="bid" element={<Bid />} />
                <Route path="validation" element={<Validation />} />
                <Route path="export" element={<Export />} />
                <Route path="systems" element={<Systems />} />
                <Route path="face-to-face" element={<FaceToFace />} />
                <Route path="review" element={<Workspace mode="review" />} />
              </Route>
              <Route path="*" element={<LegacyRedirect />} />
            </Routes>
          )}
        </main>
      </div>
      <footer className="app-footer">
        <span>
          <i /> Reference data: Equans starter package (catalogue, productivity, parameters) · every number
          traceable to the tender page
        </span>
        {estimate && !atHome && <span className="muted">Tender {estimate.tender.id}</span>}
      </footer>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={19} />
          {toast}
          <button aria-label="Close message" onClick={() => notify('')}>
            <X size={15} />
          </button>
        </div>
      )}
      {modal === 'help' && (
        <Modal title="From tender to a first price you can defend" close={() => setModal('')}>
          <p>Create a project from a tender PDF. Every step below then lives inside that project.</p>
          <ol className="guide">
            <li>Home: upload a PDF or resume a saved tender. Price books stay company-wide.</li>
            <li>Positions: every LV line with quantity, matched product, installation rule and price.</li>
            <li>Review: decide the open positions, switch products, request quotes and approve.</li>
            <li>Calculation: the cost of every position and the build-up to the selling price.</li>
            <li>Bid: compare margins, win probability and saved scenarios.</li>
            <li>Export: the priced tender PDF, the offer workbook and supplier RFQs.</li>
          </ol>
          <Button
            primary
            onClick={() => {
              setModal('')
              navigate(estimate ? tenderPath(estimate.tender.id, 'calculation') : HOME)
            }}
          >
            {estimate ? 'Open Calculation' : 'Create a project'} <ArrowRight size={16} />
          </Button>
        </Modal>
      )}
      {modal === 'profile' && (
        <Modal title="Project details" close={() => setModal('')}>
          {estimate ? <MetaForm onDone={() => setModal('')} /> : <p>Open a tender to set its estimator and submission date.</p>}
        </Modal>
      )}
    </>
  )
}

function TenderGate() {
  const { tid } = useParams<{ tid: string }>()
  const { estimate, open, error } = useStore()
  const [wait, setWait] = useState(() => estimate?.tender.id !== tid)

  useEffect(() => {
    if (!tid) return
    if (estimate?.tender.id === tid) {
      setWait(false)
      return
    }
    let live = true
    setWait(true)
    open(tid).finally(() => {
      if (live) setWait(false)
    })
    return () => {
      live = false
    }
  }, [tid, estimate?.tender.id, open])

  if (wait) {
    return (
      <div className="loading-state">
        <span className="spinner" /> Opening the tender…
      </div>
    )
  }
  if (!estimate || estimate.tender.id !== tid) {
    return (
      <div className="card" style={{ maxWidth: 520, margin: '48px auto', padding: '36px 28px', textAlign: 'center' }}>
        <h2>This tender is not on this desk</h2>
        <p className="muted" style={{ margin: '10px 0 20px' }}>
          {error || 'It may have been removed, or the link is from another machine.'}
        </p>
        <NavLink className="button primary" to={HOME}>
          Back to the tender desk
        </NavLink>
      </div>
    )
  }
  return <Outlet />
}

/** Old bookmarks like /positions land in the last opened project, or on the desk. */
function LegacyRedirect() {
  const loc = useLocation()
  const page = LEGACY[loc.pathname]
  let last: string | null = null
  try {
    last = localStorage.getItem('equans-tender-id')
  } catch {
    /* ignore */
  }
  if (page && last) return <Navigate to={tenderPath(last, page)} replace />
  return <Navigate to={HOME} replace />
}
