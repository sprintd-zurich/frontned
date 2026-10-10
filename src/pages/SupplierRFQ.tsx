import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Download, FileText, FileUp, Search, X } from 'lucide-react'
import { api } from '../api'
import { fmtNum, unit } from '../format'
import { tenderPath } from '../routes'
import { useEstimate, useStore } from '../store'
import type { Position } from '../types'
import { Button } from '../components/ui'

export function SupplierRFQ() {
  const estimate = useStore((state) => state.estimate)
  const navigate = useNavigate()

  if (!estimate) {
    return (
      <div className="card" style={{ maxWidth: 640, margin: '40px auto', textAlign: 'center', padding: 40 }}>
        <FileText size={36} color="#0785ff" style={{ margin: '0 auto 12px' }} />
        <h2>No tender loaded</h2>
        <Button primary onClick={() => navigate('/')}>Go to projects <ArrowRight size={16} /></Button>
      </div>
    )
  }

  return <SupplierQuoteList />
}

function SupplierQuoteList() {
  const estimate = useEstimate()
  const navigate = useNavigate()
  const { importQuoteCsv, busy } = useStore()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [supplier, setSupplier] = useState('')
  const [reference, setReference] = useState('')
  const [quotedAt, setQuotedAt] = useState(new Date().toISOString().slice(0, 10))
  const [file, setFile] = useState<File | null>(null)
  const [inputKey, setInputKey] = useState(0)

  const missing = useMemo(() => estimate.positions.filter((position) =>
    ['supplier_quote_required', 'review_required', 'insufficient_information'].includes(position.status)
      && position.net_unit_cost_chf == null,
  ), [estimate.positions])
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return missing.filter((position) =>
      !query || `${position.ref} ${position.title} ${position.variant} ${position.system}`.toLowerCase().includes(query),
    )
  }, [missing, search])
  const selectedRows = selected.filter((id) => missing.some((position) => position.lv_id === id))
  const toggle = (id: string) => setSelected((rows) => rows.includes(id) ? rows.filter((row) => row !== id) : [...rows, id])
  const toggleVisible = () => {
    const visible = filtered.map((position) => position.lv_id)
    const allVisible = visible.length > 0 && visible.every((id) => selectedRows.includes(id))
    setSelected((rows) => allVisible ? rows.filter((id) => !visible.includes(id)) : [...new Set([...rows, ...visible])])
  }

  return (
    <div className="rfq-page-container clean-supplier-page">
      <div className="rfq-header-banner clean-supplier-header">
        <div>
          <h1 className="rfq-page-title">Supplier Quotes</h1>
          <div className="clean-export-summary">
            <span><b>{missing.length}</b> items missing price or quantity</span>
            <span><b>{selectedRows.length}</b> selected</span>
          </div>
        </div>
        <a
          className={`button primary ${selectedRows.length ? '' : 'disabled'}`}
          href={selectedRows.length ? api.quoteRequestCsvUrl(estimate.tender.id, selectedRows) : undefined}
          onClick={(event) => { if (!selectedRows.length) event.preventDefault() }}
          download
        >
          <Download size={15} /> Download selected CSV
        </a>
      </div>

      <section className="card clean-supplier-list">
        <div className="clean-supplier-list-head">
          <label className="search-field">
            <Search size={15} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search missing items" />
            {search && <button className="text-button" onClick={() => setSearch('')}><X size={14} /></button>}
          </label>
          <button className="button small" onClick={toggleVisible}>
            {filtered.length > 0 && filtered.every((position) => selectedRows.includes(position.lv_id)) ? 'Clear visible' : 'Select visible'}
          </button>
        </div>

        <div className="clean-supplier-table-wrap">
          <table className="export-positions-table">
            <thead>
              <tr>
                <th><input type="checkbox" aria-label="Select visible items" checked={filtered.length > 0 && filtered.every((position) => selectedRows.includes(position.lv_id))} onChange={toggleVisible} /></th>
                <th>Ref.</th>
                <th>Part</th>
                <th className="number">Quantity</th>
                <th>Unit</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((position: Position) => (
                <tr key={position.lv_id} onClick={() => toggle(position.lv_id)}>
                  <td><input type="checkbox" checked={selectedRows.includes(position.lv_id)} onChange={() => toggle(position.lv_id)} onClick={(event) => event.stopPropagation()} /></td>
                  <td>{position.ref}</td>
                  <td>
                    <div className="tender-item-cell">
                      <strong>{position.title}</strong>
                      {position.variant && <small>{position.variant}</small>}
                    </div>
                  </td>
                  <td className="number">{position.quantity == null ? '—' : fmtNum(position.quantity)}</td>
                  <td>{unit(position.unit)}</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={5} className="clean-supplier-empty">No missing supplier prices.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <form
        className="card clean-supplier-import"
        onSubmit={async (event) => {
          event.preventDefault()
          if (!file || !supplier.trim()) return
          await importQuoteCsv(file, supplier.trim(), reference.trim(), quotedAt)
          setFile(null)
          setReference('')
          setSelected([])
          setInputKey((value) => value + 1)
        }}
      >
        <div>
          <h2>Import supplier CSV</h2>
          <p>Use the downloaded file. Keep the tender reference and enter each unit price.</p>
        </div>
        <label>Supplier<input required value={supplier} onChange={(event) => setSupplier(event.target.value)} placeholder="Supplier name" /></label>
        <label>Quote reference<input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Optional" /></label>
        <label>Date<input type="date" value={quotedAt} onChange={(event) => setQuotedAt(event.target.value)} /></label>
        <label className="clean-csv-file">CSV file<input key={inputKey} type="file" accept=".csv,text/csv" required onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>
        <Button primary type="submit" disabled={!!busy || !file || !supplier.trim()}>
          <FileUp size={15} /> {busy ? 'Importing…' : 'Import prices'}
        </Button>
      </form>

      <div className="clean-supplier-next">
        <Button onClick={() => navigate(tenderPath(estimate.tender.id, 'calculation'))}>
          View Calculation <ArrowRight size={15} />
        </Button>
      </div>
    </div>
  )
}
