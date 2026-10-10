import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Calculator,
  Check,
  FileText,
  RotateCcw,
  Save,
  Search,
  TrendingUp,
  User,
  X,
} from 'lucide-react'
import { fmtChf, fmtNum, unit } from '../format'
import { useEstimate, useStore } from '../store'
import type { PositionOverride } from '../types'
import { Button, StatusBadge } from '../components/ui'
import { SourceView } from '../components/SourceView'
import { ParamGroup } from '../components/ParamGroup'

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

const MATERIAL_TYPES = ['steel', 'galvanized_steel', 'stainless_steel', 'copper', 'aluminium', 'plastic', 'insulation', 'electronics', 'unclassified']
const MATERIAL_LABELS: Record<string, string> = {
  steel: 'Steel', galvanized_steel: 'Galvanized steel', stainless_steel: 'Stainless steel', copper: 'Copper',
  aluminium: 'Aluminium', plastic: 'Plastic', insulation: 'Insulation', electronics: 'Electronics', unclassified: 'Unclassified',
}

export function DirectCostsCalculation() {
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

  return <DirectCostsContent />
}

function DirectCostsContent() {
  const e = useEstimate()
  const pr = e.project
  const { selected, select, override, notify, addNote } = useStore()

  const [activeTab, setActiveTab] = useState<'positions' | 'buildup'>('positions')
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [showUnitCost, setShowUnitCost] = useState(false)
  const [inspectorView, setInspectorView] = useState<'formula' | 'pdf'>('formula')

  // Cost & Labor editing state
  const [editCost, setEditCost] = useState<string>('')
  const [editLabourRate, setEditLabourRate] = useState<string>('120')
  const [editBaseHours, setEditBaseHours] = useState<string>('')
  const [editorName, setEditorName] = useState<string>(() => {
    try {
      return localStorage.getItem('equans-editor-name') || e.tender.meta.estimator || 'Ashni'
    } catch {
      return e.tender.meta.estimator || 'Ashni'
    }
  })
  const [costReason, setCostReason] = useState<string>('')
  const [isSavingCost, setIsSavingCost] = useState(false)
  const [editMaterialMix, setEditMaterialMix] = useState<Record<string, number>>({ unclassified: 100 })
  const [inflationRates, setInflationRates] = useState<Record<string, string>>({})
  const [inflationBaseDate, setInflationBaseDate] = useState('')
  const [inflationAsOfDate, setInflationAsOfDate] = useState('')
  const [savingInflation, setSavingInflation] = useState(false)
  const setMaterialInflation = useStore((s) => s.setMaterialInflation)

  // Resizable vertical divider
  const [splitPercent, setSplitPercent] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('equans-calc-split')
      if (saved) {
        const val = Number(saved)
        if (val >= 28 && val <= 72) return val
      }
    } catch {
      // Use the default split when local storage is unavailable.
    }
    return 58
  })
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

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
      if (pct < 28) pct = 28
      if (pct > 72) pct = 72
      setSplitPercent(pct)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      try {
        localStorage.setItem('equans-calc-split', String(splitPercent))
      } catch {
        // Resizing still works when local storage is unavailable.
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, splitPercent])

  // Unique categories
  const categories = useMemo(() => {
    const set = new Set<string>()
    e.positions.forEach((p) => {
      if (p.category) set.add(p.category)
    })
    return Array.from(set).sort()
  }, [e.positions])

  // Active selected position
  const activePosition = useMemo(() => {
    return e.positions.find((p) => p.lv_id === selected) ?? e.positions[0]
  }, [e.positions, selected])

  useEffect(() => {
    if (activePosition) {
      const currentCost = activePosition.net_unit_cost_chf
      setEditCost(currentCost !== null && currentCost !== undefined && currentCost > 0 ? String(currentCost) : '')
      setEditLabourRate(activePosition.hourly_rate_chf ? String(activePosition.hourly_rate_chf) : '120')
      setEditBaseHours(activePosition.base_hours_per_unit !== null && activePosition.base_hours_per_unit !== undefined ? String(activePosition.base_hours_per_unit) : '')
      setCostReason('')
      setEditMaterialMix(activePosition.material_mix || { unclassified: 100 })
    }
  }, [activePosition])

  useEffect(() => {
    setInflationBaseDate(e.material_inflation.base_date || '')
    setInflationAsOfDate(e.material_inflation.as_of_date || '')
    setInflationRates(Object.fromEntries(MATERIAL_TYPES.map((kind) => [kind, String(e.material_inflation.rates_pct[kind] ?? 0)])))
  }, [e.material_inflation])

  const saveInflation = async () => {
    setSavingInflation(true)
    try {
      await setMaterialInflation({
        base_date: inflationBaseDate,
        as_of_date: inflationAsOfDate,
        rates_pct: Object.fromEntries(MATERIAL_TYPES.map((kind) => [kind, Number(inflationRates[kind]) || 0])),
      })
    } finally {
      setSavingInflation(false)
    }
  }

  const handleSaveCost = async () => {
    if (!activePosition) return
    const costVal = editCost !== '' ? parseFloat(editCost) : null
    const rateVal = editLabourRate !== '' ? parseFloat(editLabourRate) : null
    const hoursVal = editBaseHours !== '' ? parseFloat(editBaseHours) : null

    if (costVal !== null && (isNaN(costVal) || costVal < 0)) {
      notify('Please enter a valid non-negative unit cost')
      return
    }
    if (rateVal !== null && (isNaN(rateVal) || rateVal < 0)) {
      notify('Please enter a valid labor hourly rate')
      return
    }
    if (hoursVal !== null && (isNaN(hoursVal) || hoursVal < 0)) {
      notify('Please enter a valid base install hours value')
      return
    }

    const author = (editorName.trim() || e.tender.meta.estimator || 'Estimator').trim()
    try {
      localStorage.setItem('equans-editor-name', author)
    } catch {
      // Saving still works when local storage is unavailable.
    }

    const updates: PositionOverride = {
      status: 'assumption_applied',
    }
    const auditNotes: string[] = []

    if (costVal !== null) {
      updates.net_unit_cost_chf = costVal
      auditNotes.push(`Material: CHF ${costVal.toFixed(2)}/unit`)
    }
    if (rateVal !== null) {
      updates.hourly_rate_chf = rateVal
      auditNotes.push(`Labour Rate: CHF ${rateVal.toFixed(2)}/h`)
    }
    if (hoursVal !== null) {
      updates.base_hours_per_unit = hoursVal
      auditNotes.push(`Base Hours: ${hoursVal.toFixed(2)} h/unit`)
    }
    const mixTotal = Object.values(editMaterialMix).reduce((sum, value) => sum + (Number(value) || 0), 0)
    if (Math.abs(mixTotal - 100) > 0.01 || Object.values(editMaterialMix).some((value) => value < 0)) {
      notify('Material shares must total 100%')
      return
    }
    updates.material_mix = editMaterialMix

    const reason = costReason.trim()
    const noteText = `${auditNotes.join(', ')} updated by ${author}${reason ? `. Reason: ${reason}` : ''}`

    setIsSavingCost(true)
    try {
      await override(activePosition.lv_id, updates)
      await addNote(activePosition.lv_id, noteText, author)
      notify(`Saved cost & labor updates for ${activePosition.ref} by ${author}`)
      setCostReason('')
    } finally {
      setIsSavingCost(false)
    }
  }

  const handleResetCost = async () => {
    if (!activePosition) return
    const author = (editorName.trim() || e.tender.meta.estimator || 'Estimator').trim()
    setIsSavingCost(true)
    try {
      await override(activePosition.lv_id, {
        reset: true,
      })
      await addNote(activePosition.lv_id, `Cost & labor reset to proposal baseline by ${author}`, author)
      notify(`Reset ${activePosition.ref} to proposal baseline`)
    } finally {
      setIsSavingCost(false)
    }
  }

  // Filter positions
  const filteredPositions = useMemo(() => {
    const q = search.trim().toLowerCase()
    return e.positions.filter((p) => {
      const matchesSearch =
        !q ||
        `${p.ref} ${p.lv_id} ${p.title} ${p.variant} ${p.product_id ?? ''} ${p.system} ${p.category ?? ''}`
          .toLowerCase()
          .includes(q)
      const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory
      return matchesSearch && matchesCategory
    })
  }, [e.positions, search, selectedCategory])

  // Project Parameters
  const wastePct = e.parameters.allowances.material_waste_pct ?? 5
  const hourlyRate = activePosition?.hourly_rate_chf ?? 120

  // Calculation totals
  const totalMaterial = pr.material_cost_chf
  const totalLabour = pr.labour_cost_chf
  const totalDirect = pr.direct_cost_chf
  const totalHours = pr.install_hours
  const selectedQuantity = activePosition?.quantity ?? 1
  const selectedCost = Number(editCost)
  const selectedRate = Number(editLabourRate) || hourlyRate
  const selectedBaseHours = Number(editBaseHours) || (activePosition?.base_hours_per_unit ?? 0)
  const selectedFactor = activePosition?.base_hours_per_unit && activePosition.adjusted_install_hours
    ? activePosition.adjusted_install_hours / (activePosition.base_hours_per_unit * (activePosition.quantity || 1))
    : 1
  const previewMaterial = Number.isFinite(selectedCost) && selectedCost >= 0
    ? selectedCost * selectedQuantity * (1 + wastePct / 100)
    : 0
  const previewLabourHours = selectedBaseHours * selectedQuantity * selectedFactor
  const previewLabour = previewLabourHours * selectedRate
  const inflationPct = activePosition?.price_source === 'supplier_quote' ? 0 : Object.entries(editMaterialMix).reduce(
    (sum, [kind, share]) => sum + (share / 100) * (Number(e.material_inflation.rates_pct[kind]) || 0), 0,
  )
  const previewInflation = previewMaterial * inflationPct / 100
  const previewDirect = previewMaterial + previewInflation + previewLabour
  const isOverridden = !!activePosition?.overridden?.length

  return (
    <div className="calculation-page-container">
      <div className="calc-header-banner clean-calc-header">
        <h1 className="calc-page-title">Direct Costs &amp; Position Calculation</h1>
        <div className="calc-cost-summary">
          <div><small>Material</small><strong>{fmtChf(totalMaterial)}</strong></div>
          <div><small>Labour</small><strong>{fmtChf(totalLabour)}</strong><span>{totalHours.toFixed(1)} h</span></div>
          <div className="total"><small>Total cost</small><strong>{fmtChf(totalDirect)}</strong></div>
          <div><small>Selling price</small><strong>{fmtChf(pr.selling_price_rounded_chf)}</strong></div>
        </div>
      </div>

      <div className="segmented-toggle" style={{ alignSelf: 'flex-start' }}>
        <button
          className={activeTab === 'positions' ? 'active' : ''}
          onClick={() => setActiveTab('positions')}
        >
          <Calculator size={14} /> Item costs
        </button>
        <button
          className={activeTab === 'buildup' ? 'active' : ''}
          onClick={() => setActiveTab('buildup')}
        >
          <TrendingUp size={14} /> Project totals
        </button>
      </div>

      {activeTab === 'positions' ? (
        /* ==================== VIEW 1: SLIDE 16 COSTED ITEMS TABLE ==================== */
        <div
          ref={containerRef}
          className={`structured-split-container ${isDragging ? 'is-resizing' : ''}`}
        >
          {/* Left Column: Costed Positions Table */}
          <div
            className="structured-table-card"
            style={{ width: `calc(${splitPercent}% - 7px)` }}
          >
            {/* Controls: Search and Cost View Toggle */}
            <div className="structured-filter-bar">
              <label className="search-field" style={{ flex: 1 }}>
                <Search size={15} />
                <input
                  placeholder="Search lv_id, description, product, system…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {search && (
                  <button className="text-button" onClick={() => setSearch('')}>
                    <X size={14} />
                  </button>
                )}
              </label>

              <div className="unit-total-toggle">
                <button
                  className={!showUnitCost ? 'active' : ''}
                  onClick={() => setShowUnitCost(false)}
                >
                  Position Total
                </button>
                <button
                  className={showUnitCost ? 'active' : ''}
                  onClick={() => setShowUnitCost(true)}
                >
                  Unit Cost
                </button>
              </div>
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

            {/* Slide 16 Costed Items Table */}
            <div className="structured-table-wrapper">
              <table className="slide16-table">
                <thead>
                  <tr>
                    <th style={{ width: '38px', textAlign: 'center' }}>#</th>
                    <th style={{ width: '118px' }}>Tender ref.</th>
                    <th>Extracted Tender Item</th>
                    <th style={{ width: '90px', textAlign: 'right' }}>Net Cost</th>
                    <th style={{ width: '105px', textAlign: 'right' }}>Material Cost</th>
                    <th style={{ width: '80px', textAlign: 'right' }}>Hours</th>
                    <th style={{ width: '100px', textAlign: 'right' }}>Labour Cost</th>
                    <th style={{ width: '115px', textAlign: 'right' }}>Direct Cost</th>
                    <th style={{ width: '60px', textAlign: 'center' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPositions.map((p, idx) => {
                    const isSelected = p.lv_id === activePosition?.lv_id
                    const rowNumber = idx + 1
                    const qty = p.quantity || 1

                    // Unit vs Total calculation
                    const displayMaterial = showUnitCost ? (p.material_cost_chf / qty) : p.material_cost_chf
                    const displayHours = showUnitCost ? (p.adjusted_install_hours / qty) : p.adjusted_install_hours
                    const displayLabour = showUnitCost ? (p.labour_cost_chf / qty) : p.labour_cost_chf
                    const displayDirect = showUnitCost ? (p.direct_position_cost_chf / qty) : p.direct_position_cost_chf

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
                          <div className="tender-item-cell" title={p.description}>
                            <strong>{p.title}</strong>
                            {p.variant ? <span className="desc-variant"> · {p.variant}</span> : null}
                            <small className="muted" style={{ display: 'block', fontSize: '10px' }}>
                              {p.quantity !== null ? `${fmtNum(p.quantity)} ${unit(p.unit)}` : '—'} · {p.system.split(' ')[0]}
                            </small>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {p.net_unit_cost_chf && p.net_unit_cost_chf > 0 ? (
                            <span
                              className={`mono-cost ${p.overridden?.includes('net_unit_cost_chf') ? 'edited-cost' : ''}`}
                              title={p.overridden?.includes('net_unit_cost_chf') ? 'Manually edited cost' : undefined}
                            >
                              {fmtChf(p.net_unit_cost_chf, true)}
                              {p.overridden?.includes('net_unit_cost_chf') && (
                                <span className="override-tag" title="Manually edited cost"> ✎</span>
                              )}
                            </span>
                          ) : (
                            <button
                              className="btn-table-enter-cost"
                              onClick={(ev) => {
                                ev.stopPropagation()
                                select(p.lv_id)
                              }}
                              title="Cost is missing (CHF 0.00). Click to enter price in inspector"
                            >
                              + Enter Cost
                            </button>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span className="mono-cost blue">{fmtChf(displayMaterial, showUnitCost)}</span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span className="mono-cost amber">{displayHours.toFixed(2)}h</span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span className="mono-cost amber">{fmtChf(displayLabour, showUnitCost)}</span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {displayDirect > 0 ? (
                            <span className="mono-cost total-green">{fmtChf(displayDirect, showUnitCost)}</span>
                          ) : (
                            <span className="mono-cost zero-cost-cell" title="Zero cost: enter net unit price in inspector">
                              CHF 0.00
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <StatusBadge p={p} />
                        </td>
                      </tr>
                    )
                  })}

                  {filteredPositions.length === 0 && (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '36px', color: '#94a3b8' }}>
                        No positions match the search or filter criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

          </div>

          {/* Draggable Vertical Splitter Bar */}
          <div
            className={`vertical-resizer-bar ${isDragging ? 'dragging' : ''}`}
            onMouseDown={handleMouseDown}
            title="Drag left or right to resize table and calculation breakdown"
          >
            <div className="resizer-handle-line">
              <div className="resizer-knob" />
            </div>
          </div>

          {/* Right Column: Traceable Calculation Decomposition */}
          <div
            className="structured-doc-card"
            style={{ width: `calc(${100 - splitPercent}% - 7px)` }}
          >
            <div className="matched-inspector-header">
              <div className="inspector-tab-toggle">
                <button
                  className={`tab-btn ${inspectorView === 'formula' ? 'active' : ''}`}
                  onClick={() => setInspectorView('formula')}
                >
                  <Calculator size={14} /> Costs
                </button>
                <button
                  className={`tab-btn ${inspectorView === 'pdf' ? 'active' : ''}`}
                  onClick={() => setInspectorView('pdf')}
                >
                  <FileText size={14} /> PDF
                </button>
              </div>

              {activePosition && (
                <button
                  className={`button small ${activePosition.reviewed ? '' : 'primary'}`}
                  onClick={() => {
                    const next = !activePosition.reviewed
                    override(activePosition.lv_id, { reviewed: next })
                    notify(`${activePosition.ref} marked as ${next ? 'approved' : 'reopened'}`)
                  }}
                >
                  <Check size={14} /> {activePosition.reviewed ? 'Approved ✓' : 'Approve Cost'}
                </button>
              )}
            </div>

            {inspectorView === 'formula' ? (
              activePosition ? (
                <div className="calc-breakdown-scroll">
                  {/* Position Title Card */}
                  <div className="detail-item-title-box">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <span className="lv-id-badge">{activePosition.ref}</span>
                        <strong style={{ fontSize: '13.5px', marginLeft: '6px' }}>{activePosition.title}</strong>
                      </div>
                      <StatusBadge p={activePosition} />
                    </div>
                    {activePosition.variant && <div className="calc-item-meta"><b>{activePosition.variant}</b></div>}
                    <div style={{ fontSize: '11px', color: '#475569', marginTop: '4px' }}>
                      <b>{activePosition.quantity} {unit(activePosition.unit)}</b> · {activePosition.system}
                    </div>
                  </div>

                  <div className={`inspector-section-card clean-cost-card ${!activePosition.net_unit_cost_chf ? 'missing' : ''}`}>
                    <div className="inspector-card-head">
                      <h4>Material cost</h4>
                      <strong>{fmtChf(previewMaterial + previewInflation)}</strong>
                    </div>
                    {!activePosition.net_unit_cost_chf && <div className="clean-cost-warning">Missing price</div>}
                    <div className="clean-cost-fields">
                      <label className="cost-field">
                        <span className="field-title">Unit price · CHF / {unit(activePosition.unit)}</span>
                        <div className="cost-input-wrapper">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={editCost}
                            onChange={(event) => setEditCost(event.target.value)}
                            className="cost-input"
                          />
                        </div>
                      </label>
                      <div className="clean-cost-info">
                        <span>{selectedQuantity} {unit(activePosition.unit)}</span>
                        <span>{wastePct}% waste</span>
                      </div>
                    </div>
                    <div style={{ marginTop: 14, borderTop: '1px solid #e2e8f0', paddingTop: 12 }}>
                      <div className="inspector-card-head" style={{ marginBottom: 8 }}><h4>Material mix</h4><span className="muted">100% total</span></div>
                      {Object.entries(editMaterialMix).map(([kind, share]) => (
                        <div key={kind} style={{ display: 'flex', gap: 8, marginBottom: 7 }}>
                          <select className="cost-input" value={kind} onChange={(event) => {
                            const next = { ...editMaterialMix }; delete next[kind]; next[event.target.value] = share; setEditMaterialMix(next)
                          }}>
                            {MATERIAL_TYPES.map((type) => <option key={type} value={type} disabled={type !== kind && Object.prototype.hasOwnProperty.call(editMaterialMix, type)}>{MATERIAL_LABELS[type]}</option>)}
                          </select>
                          <input className="cost-input" type="number" min="0" max="100" step="1" aria-label={`${MATERIAL_LABELS[kind]} share percent`} value={share}
                            onChange={(event) => setEditMaterialMix({ ...editMaterialMix, [kind]: Number(event.target.value) || 0 })} style={{ width: 90 }} />
                          <span className="muted" style={{ alignSelf: 'center' }}>%</span>
                          {Object.keys(editMaterialMix).length > 1 && <button className="text-button" aria-label="Remove material" onClick={() => { const next = { ...editMaterialMix }; delete next[kind]; setEditMaterialMix(next) }}><X size={14} /></button>}
                        </div>
                      ))}
                      {Object.keys(editMaterialMix).length < MATERIAL_TYPES.length && <button className="text-button" onClick={() => {
                        const available = MATERIAL_TYPES.find((kind) => !Object.prototype.hasOwnProperty.call(editMaterialMix, kind))
                        if (available) { const first = Object.keys(editMaterialMix)[0]; setEditMaterialMix({ ...editMaterialMix, [first]: 0, [available]: 100 }) }
                      }}>+ Add material</button>}
                      <div className="clean-cost-info" style={{ marginTop: 6 }}>
                        <span>Inflation {activePosition.price_source === 'supplier_quote' ? 'not applied to supplier quote' : `${inflationPct.toFixed(1)}%`}</span>
                        <span>{fmtChf(previewInflation)} added</span>
                      </div>
                    </div>
                    <div className="formula-box blue">
                      <span className="formula-title">Material formula</span>
                      <div className="formula-calc-step">
                        <code>{fmtChf(selectedCost || 0)}</code>
                        <span>×</span>
                        <code>{fmtNum(selectedQuantity)} {unit(activePosition.unit)}</code>
                        <span>×</span>
                        <code>{(1 + wastePct / 100).toFixed(2)} waste</code>
                        <span>=</span>
                        <strong className="formula-result">{fmtChf(previewMaterial)}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="inspector-section-card clean-cost-card">
                    <div className="inspector-card-head">
                      <h4>Labour cost</h4>
                      <strong>{fmtChf(previewLabour)}</strong>
                    </div>
                    <div className="clean-cost-fields two">
                      <label className="cost-field">
                        <span className="field-title">Hours / {unit(activePosition.unit)}</span>
                        <div className="cost-input-wrapper">
                          <input
                            type="number"
                            step="0.05"
                            min="0"
                            placeholder="0.00"
                            value={editBaseHours}
                            onChange={(event) => setEditBaseHours(event.target.value)}
                            className="cost-input"
                          />
                        </div>
                      </label>
                      <label className="cost-field">
                        <span className="field-title">Rate · CHF / h</span>
                        <div className="cost-input-wrapper">
                          <input
                            type="number"
                            step="1"
                            min="0"
                            placeholder="120"
                            value={editLabourRate}
                            onChange={(event) => setEditLabourRate(event.target.value)}
                            className="cost-input"
                          />
                        </div>
                      </label>
                      <div className="clean-cost-info">
                        <span>{previewLabourHours.toFixed(2)} h total</span>
                      </div>
                    </div>
                    <div className="formula-box amber">
                      <span className="formula-title">Labour formula</span>
                      <div className="formula-calc-step">
                        <code>{selectedBaseHours.toFixed(2)} h</code>
                        <span>×</span>
                        <code>{fmtNum(selectedQuantity)} {unit(activePosition.unit)}</code>
                        <span>×</span>
                        <code>{selectedFactor.toFixed(2)} factor</code>
                        <span>=</span>
                        <strong className="formula-result">{previewLabourHours.toFixed(2)} h</strong>
                      </div>
                      <div className="formula-rate-step">
                        <code>{previewLabourHours.toFixed(2)} h</code>
                        <span>×</span>
                        <code>{fmtChf(selectedRate)} / h</code>
                        <span>=</span>
                        <strong className="formula-result">{fmtChf(previewLabour)}</strong>
                      </div>
                      {activePosition.factors_applied.length > 0 && (
                        <small className="muted">{activePosition.factors_applied.join(' · ')}</small>
                      )}
                    </div>
                  </div>

                  <div className="cost-save-panel">
                    <label className="cost-field">
                      <span className="field-title">Editor</span>
                      <div className="cost-input-wrapper">
                        <User size={14} color="#64748b" style={{ marginLeft: '8px' }} />
                        <input value={editorName} onChange={(event) => setEditorName(event.target.value)} className="cost-input" />
                      </div>
                    </label>
                    <label className="cost-field grow">
                      <span className="field-title">Note</span>
                      <input value={costReason} onChange={(event) => setCostReason(event.target.value)} className="cost-input" placeholder="Optional" />
                    </label>
                    <button className="button small primary" disabled={isSavingCost} onClick={handleSaveCost}>
                      <Save size={13} /> {isSavingCost ? 'Saving…' : 'Save'}
                    </button>
                    {isOverridden && (
                      <button className="button small" disabled={isSavingCost} onClick={handleResetCost}>
                        <RotateCcw size={13} /> Reset
                      </button>
                    )}
                  </div>

                  <div className="inspector-section-card clean-total-card">
                    <div className="inspector-card-head">
                      <h4>Total cost</h4>
                      <strong>{fmtChf(previewDirect)}</strong>
                    </div>
                    <div className="combined-cost-hero">
                      <div className="cost-split-item">
                        <small>Material</small>
                        <strong>{fmtChf(previewMaterial + previewInflation)}</strong>
                      </div>
                      <span className="plus-sign">+</span>
                      <div className="cost-split-item">
                        <small>Labour</small>
                        <strong>{fmtChf(previewLabour)}</strong>
                      </div>
                      <span className="plus-sign">=</span>
                      <div className="cost-split-item total">
                        <small>Total</small>
                        <strong>{fmtChf(previewDirect)}</strong>
                      </div>
                    </div>
                    <div className="formula-box">
                      <span className="formula-title">Total formula</span>
                      <div className="formula-calc-step">
                        <code>{fmtChf(previewMaterial + previewInflation)}</code>
                        <span>+</span>
                        <code>{fmtChf(previewLabour)}</code>
                        <span>=</span>
                        <strong className="formula-result">{fmtChf(previewDirect)}</strong>
                      </div>
                    </div>
                  </div>

                  {activePosition.notes.length > 0 && (
                    <div className="position-audit-box">
                      <span className="audit-heading">History</span>
                      {activePosition.notes.map((note) => (
                        <div key={note.id} className="audit-item">
                          <strong className="audit-author">{note.author || 'Estimator'}</strong>
                          <div className="audit-body">{note.text}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null
            ) : (
              /* PDF View */
              activePosition && (
                <SourceView
                  tenderId={e.tender.id}
                  position={activePosition}
                  pages={e.tender.pages}
                  zoomable
                />
              )
            )}
          </div>
        </div>
      ) : (
        /* ==================== VIEW 2: SLIDE 18 PROJECT COST BUILD-UP ==================== */
        <div className="slide18-buildup-container">
          {/* Left Column: Traceable Waterfall Cost Build-up */}
          <div className="card buildup-tree-card">
            <div className="section-heading">
              <div className="inline">
                <h2>Project costs</h2>
              </div>
            </div>

            {/* Waterfall stack bar */}
            <div className="buildup-waterfall">
              {pr.cost_lines.map((l) => {
                const maxVal = pr.direct_cost_chf || 1
                const pct = Math.min(100, Math.max(4, Math.round((l.amount_chf / maxVal) * 60)))
                let barClass = 'slate'
                if (l.label.includes('not yet priced')) barClass = 'rose'
                else if (l.label.includes('Material')) barClass = 'blue'
                else if (l.label.includes('Supplier')) barClass = 'purple'
                else if (l.label.includes('Labour')) barClass = 'amber'
                return (
                  <div className="waterfall-row" key={l.label}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <span className="wf-label">{l.label}</span>
                      <small className="muted" style={{ fontSize: '10.5px' }}>{l.basis}</small>
                    </div>
                    <span className={`wf-bar ${barClass}`} style={{ width: `${pct}%`, minWidth: '20px' }} />
                    <span className="wf-val">{fmtChf(l.amount_chf)}</span>
                  </div>
                )
              })}

              <div className="waterfall-divider" />

              <div className="waterfall-row subtotal">
                <span className="wf-label"><strong>= DIRECT COST TOTAL</strong></span>
                <span className="wf-val"><strong>{fmtChf(pr.direct_cost_chf)}</strong></span>
              </div>

              <div className="waterfall-row">
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <span className="wf-label">+ Overhead</span>
                  <small className="muted" style={{ fontSize: '10.5px' }}>{pr.overhead_pct}% of direct cost</small>
                </div>
                <span className="wf-val">{fmtChf(pr.overhead_chf)}</span>
              </div>

              <div className="waterfall-divider" />

              <div className="waterfall-row subtotal">
                <span className="wf-label"><strong>= COST BASELINE</strong></span>
                <span className="wf-val" style={{ color: '#0284c7' }}>
                  <strong>{fmtChf(pr.cost_baseline_chf)}</strong>
                </span>
              </div>

              <div className="waterfall-row">
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <span className="wf-label">÷ (1 − Target Margin {pr.target_margin_pct}%)</span>
                  <small className="muted" style={{ fontSize: '10.5px' }}>
                    Margin amount: {fmtChf(pr.selling_price_chf - pr.cost_baseline_chf)}
                  </small>
                </div>
                <span className="wf-val">{fmtChf(pr.selling_price_chf)}</span>
              </div>

              <div className="waterfall-row grand-total">
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <span className="wf-label">
                    <strong style={{ fontSize: '13px' }}>INDICATIVE SELLING PRICE (Rounded)</strong>
                  </span>
                  <small className="muted" style={{ fontSize: '10.5px' }}>Rounded up to CHF 1’000</small>
                </div>
                <span className="wf-val" style={{ color: '#059669', fontSize: '18px' }}>
                  <strong>{fmtChf(pr.selling_price_rounded_chf)}</strong>
                </span>
              </div>
            </div>

            <div className="guardrail-note">
              🛡️ <b>Equans Guardrail:</b> Visible assumptions and review flags are better than false precision.
            </div>
          </div>

          {/* Right Column: Editable Commercial Parameters & Factors */}
          <div className="card buildup-params-card">
            <div className="section-heading">
              <h2>Project settings</h2>
            </div>

            <div className="params-scroll-box">
              <section className="param-group" style={{ padding: '12px 0', borderBottom: '1px solid #e2e8f0' }}>
                <div className="section-heading" style={{ marginBottom: 8 }}><h3>Material inflation</h3></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                  <label className="cost-field"><span className="field-title">Base date</span><input className="cost-input" type="date" value={inflationBaseDate} onChange={(event) => setInflationBaseDate(event.target.value)} /></label>
                  <label className="cost-field"><span className="field-title">Current date</span><input className="cost-input" type="date" value={inflationAsOfDate} onChange={(event) => setInflationAsOfDate(event.target.value)} /></label>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 76px', gap: '6px 10px', alignItems: 'center' }}>
                  {MATERIAL_TYPES.filter((kind) => kind !== 'unclassified').map((kind) => (
                    <Fragment key={kind}>
                      <span>{MATERIAL_LABELS[kind]}</span>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}><input className="cost-input" type="number" step="0.1" value={inflationRates[kind] ?? '0'} onChange={(event) => setInflationRates({ ...inflationRates, [kind]: event.target.value })} /><span>%</span></label>
                    </Fragment>
                  ))}
                </div>
                <p className="muted" style={{ fontSize: 11, margin: '8px 0' }}>Applied to material cost before Bid. Supplier quotes stay at quoted prices.</p>
                <button className="button small primary" disabled={savingInflation} onClick={saveInflation}>{savingInflation ? 'Saving…' : 'Apply rates'}</button>
              </section>
              <ParamGroup
                title="Margins & overhead"
                group="commercial"
                values={e.parameters.commercial}
                step={0.5}
              />

              <ParamGroup
                title="Allowances"
                group="allowances"
                values={e.parameters.allowances}
                step={0.5}
              />

              <ParamGroup
                title="Productivity"
                group="productivity_factors"
                values={e.parameters.productivity_factors}
                step={0.05}
              />
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
