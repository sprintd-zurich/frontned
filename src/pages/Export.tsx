import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Download, FileSpreadsheet, FileText, Minus, Plus, RefreshCw, Search, X } from 'lucide-react'
import { api } from '../api'
import { metrics } from '../derive'
import { fmtChf, fmtNum, unit } from '../format'
import { tenderPath } from '../routes'
import { useEstimate, useStore } from '../store'
import { Button } from '../components/ui'
import { SourceView } from '../components/SourceView'

type FilterMode = 'all' | 'unpriced' | 'edited' | 'open'

export function Export() {
  const estimate = useStore((state) => state.estimate)
  const navigate = useNavigate()

  if (!estimate) {
    return (
      <div className="card" style={{ maxWidth: '640px', margin: '40px auto', textAlign: 'center', padding: '40px 24px' }}>
        <FileText size={36} color="#0785ff" style={{ margin: '0 auto 12px' }} />
        <h2>No tender loaded</h2>
        <Button primary onClick={() => navigate('/')}>
          Go to projects <ArrowRight size={16} />
        </Button>
      </div>
    )
  }

  return <ExportContent />
}

function ExportContent() {
  const estimate = useEstimate()
  const navigate = useNavigate()
  const { selected, select, notify } = useStore()
  const [search, setSearch] = useState('')
  const [filterMode, setFilterMode] = useState<FilterMode>('all')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pdfZoom, setPdfZoom] = useState(100)
  const [pdfInfo, setPdfInfo] = useState<{
    pages: number
    filled: number
    positions: number
    total_chf: number
    key: string
  } | null>(null)

  const refreshPdf = useCallback(async (showMessage = false) => {
    setIsRefreshing(true)
    try {
      const info = await api.pricedLvInfo(estimate.tender.id)
      setPdfInfo(info)
      if (showMessage) notify('PDF updated from the latest calculation')
    } catch (error) {
      notify((error as Error).message || 'Could not update the PDF')
    } finally {
      setIsRefreshing(false)
    }
  }, [estimate.tender.id, notify])

  useEffect(() => {
    void refreshPdf()
  }, [estimate.positions, estimate.project.selling_price_rounded_chf, refreshPdf])

  const filteredPositions = useMemo(() => {
    const query = search.trim().toLowerCase()
    return estimate.positions.filter((position) => {
      const matchesSearch = !query || `${position.ref} ${position.title} ${position.variant} ${position.system}`.toLowerCase().includes(query)
      if (!matchesSearch) return false
      if (filterMode === 'unpriced') return !position.net_unit_cost_chf
      if (filterMode === 'edited') return Boolean(position.overridden?.length)
      if (filterMode === 'open') return !position.reviewed
      return true
    })
  }, [estimate.positions, filterMode, search])

  const reviewPosition = (lvId: string) => {
    select(lvId)
    navigate(tenderPath(estimate.tender.id, 'calculation'))
  }

  const activePosition = estimate.positions.find((position) => position.lv_id === selected) ?? estimate.positions[0]
  const summary = metrics(estimate.positions)

  return (
    <div className="export-studio-page clean-export-page">
      <div className="export-studio-header clean-export-header">
        <div>
          <h1 className="export-studio-title">Export</h1>
          <div className="clean-export-summary">
            <span><b>{pdfInfo?.filled ?? summary.total}</b> items</span>
            <span><b>{pdfInfo?.pages ?? estimate.tender.pages}</b> pages</span>
            <span><b>{fmtChf(pdfInfo?.total_chf ?? estimate.project.selling_price_rounded_chf)}</b> total</span>
            <span className={summary.open ? 'open' : 'ready'}>{summary.open ? `${summary.open} open` : 'Ready'}</span>
          </div>
        </div>
        <div className="export-header-actions">
          <Button onClick={() => void refreshPdf(true)} disabled={isRefreshing}>
            <RefreshCw size={15} /> {isRefreshing ? 'Updating…' : 'Update PDF'}
          </Button>
          <a className="button" href={api.exportUrl(estimate.tender.id)} download>
            <FileSpreadsheet size={15} /> Excel
          </a>
          <a className="button primary" href={api.pricedLvUrl(estimate.tender.id)} download>
            <Download size={15} /> Export PDF
          </a>
        </div>
      </div>

      <div className="clean-export-layout">
        <section className="structured-table-card clean-export-list">
          <div className="structured-filter-bar">
            <label className="search-field">
              <Search size={15} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search items" />
              {search && <button className="text-button" onClick={() => setSearch('')}><X size={14} /></button>}
            </label>
          </div>

          <div className="filter-pills clean-export-filters">
            {([
              ['all', `All (${estimate.positions.length})`],
              ['unpriced', `Unpriced (${estimate.positions.filter((position) => !position.net_unit_cost_chf).length})`],
              ['edited', `Edited (${estimate.positions.filter((position) => position.overridden?.length).length})`],
              ['open', `Open (${estimate.positions.filter((position) => !position.reviewed).length})`],
            ] as [FilterMode, string][]).map(([value, label]) => (
              <button key={value} className={filterMode === value ? 'active' : ''} onClick={() => setFilterMode(value)}>
                {label}
              </button>
            ))}
          </div>

          <div className="clean-export-table-scroll">
            <table className="export-positions-table">
              <thead>
                <tr>
                  <th>Ref.</th>
                  <th>Item</th>
                  <th className="number">Qty</th>
                  <th className="number">Material</th>
                  <th className="number">Labour</th>
                  <th className="number">Total</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredPositions.map((position) => (
                  <tr key={position.lv_id} className={selected === position.lv_id ? 'selected' : ''} onClick={() => select(position.lv_id)}>
                    <td><span className="lv-id-badge">{position.ref}</span></td>
                    <td>
                      <div className="tender-item-cell">
                        <strong>{position.title}</strong>
                        {position.variant && <small>{position.variant}</small>}
                      </div>
                    </td>
                    <td className="number">{fmtNum(position.quantity)} {unit(position.unit)}</td>
                    <td className="number">{fmtChf(position.material_cost_chf)}</td>
                    <td className="number">{fmtChf(position.labour_cost_chf)}</td>
                    <td className="number"><strong>{fmtChf(position.direct_position_cost_chf)}</strong></td>
                    <td>
                      <button
                        className="button small"
                        onClick={(event) => {
                          event.stopPropagation()
                          reviewPosition(position.lv_id)
                        }}
                      >Review</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="structured-doc-card clean-export-pdf">
          <div className="doc-card-header">
            <h2 className="doc-title">Priced Tender PDF</h2>
            <div className="doc-card-actions">
              <div className="inline">
                <button className="icon-button" aria-label="Zoom out" disabled={pdfZoom <= 75} onClick={() => setPdfZoom((zoom) => Math.max(75, zoom - 25))}>
                  <Minus size={15} />
                </button>
                <span>{pdfZoom}%</span>
                <button className="icon-button" aria-label="Zoom in" disabled={pdfZoom >= 200} onClick={() => setPdfZoom((zoom) => Math.min(200, zoom + 25))}>
                  <Plus size={15} />
                </button>
              </div>
              <small>{pdfInfo?.pages ?? estimate.tender.pages} pages</small>
            </div>
          </div>
          {isRefreshing && !pdfInfo ? (
            <div className="clean-export-loading"><span className="spinner" /> Preparing PDF…</div>
          ) : activePosition && pdfInfo ? (
            <SourceView
              tenderId={estimate.tender.id}
              position={activePosition}
              pages={pdfInfo.pages}
              zoom={pdfZoom}
              pricedKey={pdfInfo.key}
            />
          ) : null}
          <a className="button primary clean-export-download" href={api.pricedLvUrl(estimate.tender.id)} download>
            <Download size={15} /> Export PDF
          </a>
        </section>
      </div>
    </div>
  )
}
