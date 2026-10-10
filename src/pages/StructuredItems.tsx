import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Check,
  FileText,
  Minus,
  Pencil,
  Plus,
  Search,
  X,
} from 'lucide-react'
import { fmtNum, unit } from '../format'
import { useEstimate, useStore } from '../store'
import type { Position } from '../types'
import { Button, Modal } from '../components/ui'
import { SourceView } from '../components/SourceView'

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'Air terminal': { bg: '#e0f2fe', text: '#0369a1', border: '#bae6fd' },
  'Fire protection': { bg: '#ffe4e6', text: '#be123c', border: '#fecdd3' },
  'Damper': { bg: '#fef3c7', text: '#b45309', border: '#fde68a' },
  'Silencer': { bg: '#ede9fe', text: '#6d28d9', border: '#ddd6fe' },
  'Flow controller': { bg: '#ccfbf1', text: '#0f766e', border: '#99f6e4' },
  'Insulation': { bg: '#ffedd5', text: '#c2410c', border: '#fed7aa' },
  'Support': { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' },
  'Ductwork': { bg: '#e0e7ff', text: '#4338ca', border: '#c7d2fe' },
  'Equipment': { bg: '#d1fae5', text: '#047857', border: '#a7f3d0' },
  'Controls': { bg: '#fae8ff', text: '#a21caf', border: '#f5d0fe' },
}

export function StructuredItems() {
  const estimate = useStore((s) => s.estimate)
  const navigate = useNavigate()

  if (!estimate) {
    return (
      <div className="card" style={{ maxWidth: '640px', margin: '40px auto', textAlign: 'center', padding: '40px 24px' }}>
        <FileText size={36} color="#0785ff" style={{ margin: '0 auto 12px' }} />
        <h2>No Tender Loaded Yet</h2>
        <p className="muted" style={{ margin: '10px 0 20px' }}>
          Please go to the Overview page to upload a tender PDF or resume a previous tender.
        </p>
        <Button primary onClick={() => navigate('/')}>
          Go to Overview <ArrowRight size={16} />
        </Button>
      </div>
    )
  }

  return <StructuredItemsContent />
}

function StructuredItemsContent() {
  const e = useEstimate()
  const { selected, select, override, bulk, busy } = useStore()

  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [pdfZoom, setPdfZoom] = useState(100)
  const [editing, setEditing] = useState<Position | null>(null)

  // Resizable vertical divider state
  const [splitPercent, setSplitPercent] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('equans-split-percent')
      if (saved) {
        const val = Number(saved)
        if (val >= 25 && val <= 75) return val
      }
    } catch {
      // Local storage can be unavailable in restricted browser contexts.
    }
    return 55 // Default 55% for table, 45% for PDF
  })
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Dragging logic for vertical splitter bar
  const handleMouseDown = (ev: React.MouseEvent) => {
    ev.preventDefault()
    setIsDragging(true)
  }

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (ev: MouseEvent) => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const offsetX = ev.clientX - rect.left
      let pct = (offsetX / rect.width) * 100
      // Constrain between 25% and 75%
      if (pct < 25) pct = 25
      if (pct > 75) pct = 75
      setSplitPercent(pct)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      try {
        localStorage.setItem('equans-split-percent', String(splitPercent))
      } catch {
        // Resizing still works when the browser blocks local storage.
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, splitPercent])

  // List of unique categories and systems
  const categories = useMemo(() => {
    const set = new Set<string>()
    e.positions.forEach((p) => {
      if (p.category) set.add(p.category)
    })
    return Array.from(set).sort()
  }, [e.positions])

  const systems = useMemo(() => {
    const set = new Set<string>()
    e.positions.forEach((p) => {
      if (p.system) set.add(p.system)
    })
    return Array.from(set).sort()
  }, [e.positions])

  // Active selected position
  const activePosition = useMemo(() => {
    return e.positions.find((p) => p.lv_id === selected) ?? e.positions[0]
  }, [e.positions, selected])

  // Filter positions (Search text + Category pills only - no system dropdown)
  const filteredPositions = useMemo(() => {
    const q = search.trim().toLowerCase()
    return e.positions.filter((p) => {
      const matchesSearch =
        !q ||
        `${p.ref} ${p.lv_id} ${p.title} ${p.variant} ${p.description} ${p.system} ${p.category ?? ''} ${p.source_page}`
          .toLowerCase()
          .includes(q)
      const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory
      return matchesSearch && matchesCategory
    })
  }, [e.positions, search, selectedCategory])

  // Format description
  const formatDescription = (p: Position) => {
    if (p.variant) {
      return `${p.title} - ${p.variant}`
    }
    return p.title || p.description
  }

  return (
    <div className="structured-items-page">
      <div className="slide14-header-banner">
        <div className="slide14-header-left">
          <h1 className="slide14-title">Items</h1>
        </div>
        <div className="slide14-stats">
          <div className="stat-pill">
            <span className="label">Total Positions</span>
            <span className="val">{e.positions.length}</span>
          </div>
          <div className="stat-pill">
            <span className="label">Categories</span>
            <span className="val">{categories.length}</span>
          </div>
          <div className="stat-pill">
            <span className="label">Systems</span>
            <span className="val">{systems.length}</span>
          </div>
          <div className="stat-pill">
            <span className="label">Document Pages</span>
            <span className="val">{e.tender.pages}</span>
          </div>
        </div>
      </div>

      {/* Main Side-by-Side View with Draggable Vertical Divider Bar */}
      <div
        ref={containerRef}
        className={`structured-split-container ${isDragging ? 'is-resizing' : ''}`}
      >
        {/* Left Column: Structured Tender Items Table (matching Slide 14) */}
        <div
          className="structured-table-card"
          style={{ width: `calc(${splitPercent}% - 7px)` }}
        >
          {/* Controls: Search text input only (System dropdown removed) */}
          <div className="structured-filter-bar">
            <label className="search-field" style={{ flex: 1 }}>
              <Search size={15} />
              <input
                placeholder="Search by tender reference, description, system, or page…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button className="text-button" onClick={() => setSearch('')}>
                  <X size={14} />
                </button>
              )}
            </label>
          </div>

          {/* Category Filter Pills */}
          <div className="category-pills-row">
            <button
              className={`cat-pill ${selectedCategory === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('all')}
            >
              All Categories ({e.positions.length})
            </button>
            {categories.map((c) => {
              const count = e.positions.filter((p) => p.category === c).length
              const colors = CATEGORY_COLORS[c] || { bg: '#f1f5f9', text: '#334155', border: '#e2e8f0' }
              return (
                <button
                  key={c}
                  className={`cat-pill ${selectedCategory === c ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(c)}
                  style={
                    selectedCategory === c
                      ? { background: colors.text, color: '#fff', borderColor: colors.text }
                      : { background: colors.bg, color: colors.text, borderColor: colors.border }
                  }
                >
                  {c} <span className="cat-count">{count}</span>
                </button>
              )
            })}
          </div>

          {/* Slide 14 Structured Table */}
          <div className="structured-table-wrapper">
            <table className="slide14-table">
              <thead>
                <tr>
                  <th style={{ width: '38px', textAlign: 'center' }}>#</th>
                  <th style={{ width: '118px' }}>Tender ref.</th>
                  <th style={{ width: '180px' }}>system</th>
                  <th style={{ width: '115px' }}>category</th>
                  <th>description</th>
                  <th style={{ width: '65px', textAlign: 'right' }}>quantity</th>
                  <th style={{ width: '50px', textAlign: 'center' }}>unit</th>
                  <th style={{ width: '48px' }} aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {filteredPositions.map((p, idx) => {
                  const isSelected = p.lv_id === activePosition?.lv_id
                  const rowNumber = idx + 1
                  const catStyle = CATEGORY_COLORS[p.category || ''] || {
                    bg: '#f1f5f9',
                    text: '#475569',
                    border: '#cbd5e1',
                  }

                  return (
                    <tr
                      key={p.lv_id}
                      className={isSelected ? 'selected-row' : ''}
                      onClick={() => select(p.lv_id)}
                    >
                      <td style={{ textAlign: 'center', color: '#64748b', fontSize: '11px' }}>
                        {rowNumber}
                      </td>
                      <td>
                        <span className="lv-id-badge">{p.ref}</span>
                      </td>
                      <td>
                        <span className="system-cell" title={p.system}>
                          {p.system}
                        </span>
                      </td>
                      <td>
                        <span
                          className="category-tag"
                          style={{
                            background: catStyle.bg,
                            color: catStyle.text,
                            borderColor: catStyle.border,
                          }}
                        >
                          {p.category || 'Equipment'}
                        </span>
                      </td>
                      <td>
                        <div className="desc-cell" title={formatDescription(p)}>
                          <strong>{p.title}</strong>
                          {p.variant ? <span className="desc-variant"> · {p.variant}</span> : null}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {p.quantity !== null && p.quantity !== undefined ? (
                          <span className="quantity-val">{fmtNum(p.quantity)}</span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="unit-cell">{unit(p.unit)}</span>
                      </td>
                      <td>
                        <button
                          className="icon-button"
                          aria-label={`Edit ${p.ref}`}
                          title="Edit item"
                          onClick={(event) => {
                            event.stopPropagation()
                            setEditing(p)
                          }}
                        >
                          <Pencil size={14} />
                        </button>
                      </td>
                    </tr>
                  )
                })}

                {filteredPositions.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '36px', color: '#94a3b8' }}>
                      No positions match the search or filter criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="structured-list-footer">
            <Button
              primary
              disabled={!!busy || e.positions.length === 0 || e.positions.every((p) => p.reviewed)}
              onClick={() =>
                bulk(
                  e.positions.map((p) => p.lv_id),
                  { reviewed: true },
                  `${e.positions.length} items approved.`,
                )
              }
            >
              <Check size={14} /> {e.positions.every((p) => p.reviewed) ? 'All items approved' : 'Approve all items'}
            </Button>
          </div>

        </div>

        {/* Draggable Vertical Splitter Bar */}
        <div
          className={`vertical-resizer-bar ${isDragging ? 'dragging' : ''}`}
          onMouseDown={handleMouseDown}
          title="Drag left or right to resize table and PDF viewer"
        >
          <div className="resizer-handle-line">
            <div className="resizer-knob" />
          </div>
        </div>

        {/* Right Column: Live PDF Document Viewer Side-by-Side */}
        <div
          className="structured-doc-card"
          style={{ width: `calc(${100 - splitPercent}% - 7px)` }}
        >
          <div className="doc-card-header">
            <h2 className="doc-title">Tender Document on PDF</h2>
            <div className="doc-card-actions">
              <div className="inline">
                <button
                  className="icon-button"
                  aria-label="Zoom out"
                  disabled={pdfZoom <= 75}
                  onClick={() => setPdfZoom(pdfZoom - 25)}
                >
                  <Minus size={15} />
                </button>
                <span>{pdfZoom}%</span>
                <button
                  className="icon-button"
                  aria-label="Zoom in"
                  disabled={pdfZoom >= 200}
                  onClick={() => setPdfZoom(pdfZoom + 25)}
                >
                  <Plus size={15} />
                </button>
              </div>
            </div>
          </div>

          {/* Live Document Canvas with Highlights */}
          {activePosition ? (
            <SourceView
              tenderId={e.tender.id}
              position={activePosition}
              pages={e.tender.pages}
              zoom={pdfZoom}
              onZoomChange={setPdfZoom}
            />
          ) : (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: '#7a8da9' }}>
              Select an item from the structured list on the left to view the highlighted source on the PDF.
            </div>
          )}
        </div>
      </div>

      {editing && (
        <EditItemModal
          key={editing.lv_id}
          position={editing}
          busy={!!busy}
          close={() => setEditing(null)}
          save={async (body) => {
            await override(editing.lv_id, body, `${editing.ref} updated.`)
            setEditing(null)
          }}
        />
      )}

    </div>
  )
}

function EditItemModal({
  position,
  busy,
  close,
  save,
}: {
  position: Position
  busy: boolean
  close: () => void
  save: (body: {
    ref: string
    system: string
    category: string
    title: string
    variant: string
    description: string
    quantity: number
    unit: string
  }) => Promise<void>
}) {
  const [form, setForm] = useState({
    ref: position.ref,
    system: position.system,
    category: position.category || '',
    title: position.title,
    variant: position.variant,
    description: position.description,
    quantity: position.quantity == null ? '' : String(position.quantity),
    unit: position.unit,
  })
  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }))

  return (
    <Modal title="Edit item" close={close} wide>
      <form
        className="structured-edit-form"
        onSubmit={(event) => {
          event.preventDefault()
          save({
            ref: form.ref.trim(),
            system: form.system.trim(),
            category: form.category.trim(),
            title: form.title.trim(),
            variant: form.variant.trim(),
            description: form.description.trim(),
            quantity: Number(form.quantity) || 0,
            unit: form.unit.trim(),
          })
        }}
      >
        <div className="structured-edit-grid">
          <label>Tender reference<input value={form.ref} onChange={(e) => set('ref', e.target.value)} required /></label>
          <label>System<input value={form.system} onChange={(e) => set('system', e.target.value)} required /></label>
          <label>Category<input value={form.category} onChange={(e) => set('category', e.target.value)} /></label>
          <label>Unit<input value={form.unit} onChange={(e) => set('unit', e.target.value)} required /></label>
          <label className="wide">Title<input value={form.title} onChange={(e) => set('title', e.target.value)} required /></label>
          <label className="wide">Variant<input value={form.variant} onChange={(e) => set('variant', e.target.value)} /></label>
          <label>Quantity<input type="number" min="0" step="any" value={form.quantity} onChange={(e) => set('quantity', e.target.value)} required /></label>
          <label className="wide">Description<textarea rows={4} value={form.description} onChange={(e) => set('description', e.target.value)} /></label>
        </div>
        <div className="modal-actions">
          <Button onClick={close}>Cancel</Button>
          <Button primary type="submit" disabled={busy}>Save item</Button>
        </div>
      </form>
    </Modal>
  )
}
