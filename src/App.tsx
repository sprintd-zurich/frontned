import { useEffect, useState } from 'react'
import { Navigate, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowRight, CheckCircle2, HelpCircle, Search, X } from 'lucide-react'
import { initials } from './derive'
import { useStore } from './store'
import { Button, Modal } from './components/ui'
import { Overview, ProjectsSidebar } from './pages/Overview'
import { StructuredItems } from './pages/StructuredItems'
import { MatchedItems } from './pages/MatchedItems'
import { DirectCostsCalculation } from './pages/DirectCostsCalculation'
import { Validation } from './pages/Validation'
import { Bid } from './pages/Bid'
import { Export } from './pages/Export'
import { Supplier } from './pages/Supplier'
import { Experience } from './pages/Experience'
import { MetaForm } from './pages/MetaForm'

const WORK = [
  ['/positions', 'Items'],
  ['/matched', 'Product Matching'],
  ['/supplier', 'Supplier'],
  ['/calculation', 'Calculation'],
  ['/experience', 'Experience'],
  ['/bid', 'Bid'],
  ['/validation', 'Validation'],
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
        <NavLink to="/" className="brand" aria-label="Favon projects">
          FAVON
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
            placeholder="Search items, products, or keywords…"
            value={search}
            disabled={!estimate}
            onChange={(e) => {
              filter({ search: e.target.value })
              if (!['/positions', '/matched', '/calculation'].includes(page)) navigate('/positions')
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
        {overview && <ProjectsSidebar />}
        <main className={overview ? 'dashboard-main' : `workspace-main ${page === '/supplier' ? 'split' : ''}`}>
          {overview ? (
            ready || estimate ? <Overview /> : <div className="loading-state"><span className="spinner" /> Connecting to the pricing API…</div>
          ) : page === '/systems' ? (
            <Navigate to="/bid" replace />
          ) : page === '/bid' ? (
            <Bid />
          ) : page === '/export' ? (
            <Export />
          ) : page === '/supplier' ? (
            <Supplier />
          ) : page === '/experience' ? (
            <Experience />
          ) : page === '/matched' || page === '/review' ? (
            <MatchedItems />
          ) : page === '/calculation' ? (
            <DirectCostsCalculation />
          ) : page === '/validation' ? (
            <Validation />
          ) : (
            <StructuredItems />
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
            <li>Items: every LV line as read from the tender, next to the tender page with its source highlighted.</li>
            <li>Product Matching: each position matched against the price book. Where data is missing, pick a product, add the information or request a supplier quote.</li>
            <li>Supplier: tick the items still missing a price and prepare the request mail.</li>
            <li>Calculation: material and labour for every position, with material inflation.</li>
            <li>Experience: opinions, estimates and files from the team, kept with the tender for later bid adjustments.</li>
            <li>Bid: cost per system, the calculated price, then margins, win probability and saved scenarios.</li>
            <li>Validation: the 22 Equans reference positions compared number by number with what was calculated.</li>
            <li>Export: the positions next to the priced tender PDF and the offer workbook.</li>
          </ol>
          <Button
            primary
            onClick={() => {
              setModal('')
              navigate(estimate ? '/matched' : '/')
            }}
          >
            {estimate ? 'Open Product Matching' : 'Import a tender'} <ArrowRight size={16} />
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
