import { useEffect, useState } from 'react'
import { Navigate, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowRight, CheckCircle2, HelpCircle, Search, X } from 'lucide-react'
import { initials } from './derive'
import { useStore } from './store'
import { Button, Modal } from './components/ui'
import { CategoryStrip, ProjectCard, Workflow } from './components/Shell'
import { Overview, ProjectsSidebar } from './pages/Overview'
import { Workspace } from './pages/Workspace'
import { FaceToFace } from './pages/FaceToFace'
import { Bid } from './pages/Bid'
import { Export } from './pages/Export'
import { MetaForm } from './pages/MetaForm'

const WORK = [
  ['/positions', 'Positions'],
  ['/review', 'Review'],
  ['/bid', 'Bid'],
  ['/export', 'Export'],
] as const

export default function App() {
  const loc = useLocation()
  const navigate = useNavigate()
  const { estimate, ready, init, search, filter, toast, notify, error, busy } = useStore()
  const [modal, setModal] = useState<'' | 'help' | 'profile'>('')
  const page = loc.pathname
  const overview = page === '/' || !estimate

  useEffect(() => {
    init()
  }, [init])
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [page])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => notify(''), 4200)
    return () => clearTimeout(t)
  }, [toast, notify])

  return (
    <>
      <header className="topbar">
        <NavLink to="/" className="brand" aria-label="EQUANS projects">
          EQUANS
        </NavLink>
        <nav>
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
            Projects
          </NavLink>
          <span className="nav-split" aria-hidden />
          {WORK.map(([url, label]) => (
            <NavLink key={url} to={url} className={({ isActive }) => (isActive ? 'active' : '')}>
              {label}
            </NavLink>
          ))}
        </nav>
        <label className="global-search">
          <Search size={18} />
          <input
            aria-label="Search positions"
            placeholder="Search positions, products, or keywords…"
            value={search}
            disabled={!estimate}
            onChange={(e) => {
              filter({ search: e.target.value })
              if (['/', '/export', '/bid'].includes(page)) navigate('/positions')
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
      <div className={`app ${overview ? 'dashboard-shell' : 'workspace-shell'}`}>
        {overview ? (
          <ProjectsSidebar />
        ) : (
          <>
            <div className="workspace-top">
              <ProjectCard />
              <Workflow />
            </div>
            <CategoryStrip />
          </>
        )}
        <main className={overview ? 'dashboard-main' : `workspace-main ${['/bid', '/export'].includes(page) ? '' : 'split'}`}>
          {overview ? (
            ready || estimate ? <Overview /> : <div className="loading-state"><span className="spinner" /> Connecting to the pricing API…</div>
          ) : page === '/systems' ? (
            <Navigate to="/bid" replace />
          ) : page === '/bid' ? (
            <Bid />
          ) : page === '/export' ? (
            <Export />
          ) : page === '/review' ? (
            <Workspace />
          ) : page === '/calculation' ? (
            <Navigate to="/review" replace />
          ) : (
            <FaceToFace />
          )}
        </main>
      </div>
      <footer className="app-footer">
        <span>
          <i /> Reference data: Equans starter package (catalogue, productivity, parameters) · every number traceable to the
          tender page
        </span>
        {estimate && <span className="muted">Tender {estimate.tender.id}</span>}
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
          <p>Import the tender PDF. Every step below works on the real extraction and prices.</p>
          <ol className="guide">
            <li>Positions: every LV line as read from the tender, next to the tender page with its source highlighted.</li>
            <li>Review: each position matched against the company database and its prices. Where data is missing, review it, add the information or request a supplier quote, then approve.</li>
            <li>Bid: cost per system, the calculated price, then margins, win probability and saved scenarios.</li>
            <li>Export: the positions next to the priced tender PDF, the offer workbook and supplier RFQs.</li>
          </ol>
          <Button
            primary
            onClick={() => {
              setModal('')
              navigate(estimate ? '/review' : '/')
            }}
          >
            {estimate ? 'Open the review queue' : 'Import a tender'} <ArrowRight size={16} />
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
