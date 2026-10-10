import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Check,
  Database,
  Edit3,
  FileText,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Sparkles,
  Tag,
  Wrench,
  X,
} from 'lucide-react'
import { fmtNum, money, unit } from '../format'
import { useEstimate, useStore } from '../store'
import { isBenchmark, isPriceable, metrics } from '../derive'
import type { CatalogItem, Position, Status } from '../types'
import { Button, StatusBadge } from '../components/ui'
import { SourceView } from '../components/SourceView'
import { AddProductList, ListOffers } from '../components/ListOffers'

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

type RouteFilter = 'all' | 'calculated' | 'quote' | 'assumption' | 'approved' | 'review'

export function MatchedItems() {
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

  return <MatchedItemsContent />
}

function MatchedItemsContent() {
  const e = useEstimate()
  const { selected, select, override, notify, catalog, rules, addNote, datasets, setDataset, busy } = useStore()

  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [routeFilter, setRouteFilter] = useState<RouteFilter>('all')
  const [inspectorTab, setInspectorTab] = useState<'matching' | 'source'>('matching')

  // Cost editing in Matched Items
  const [matchedEditCost, setMatchedEditCost] = useState('')
  const [matchedEditorName, setMatchedEditorName] = useState(() => {
    try {
      return e.tender.meta.estimator || localStorage.getItem('equans-editor-name') || ''
    } catch {
      return e.tender.meta.estimator || ''
    }
  })
  const [matchedReason, setMatchedReason] = useState('')
  const [isSavingCost, setIsSavingCost] = useState(false)

  // Resizable vertical divider
  const [splitPercent, setSplitPercent] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('equans-matched-split')
      if (saved) {
        const val = Number(saved)
        if (val >= 28 && val <= 72) return val
      }
    } catch {
      // Use the default split when local storage is unavailable.
    }
    return 57 // 57% table, 43% inspector
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
        localStorage.setItem('equans-matched-split', String(splitPercent))
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

  // Matched catalogue product for active position
  const activeCatalogItem = useMemo(() => {
    if (!activePosition?.product_id) return null
    return catalog.find((c) => c.product_id === activePosition.product_id) ?? null
  }, [catalog, activePosition])

  // Productivity rule for active position
  const activeRule = useMemo(() => {
    if (!activePosition?.install_code) return null
    return rules[activePosition.install_code] ?? null
  }, [rules, activePosition])

  useEffect(() => {
    if (activePosition) {
      setMatchedEditCost(
        activePosition.net_unit_cost_chf !== null && activePosition.net_unit_cost_chf !== undefined && activePosition.net_unit_cost_chf > 0
          ? String(activePosition.net_unit_cost_chf)
          : ''
      )
      setMatchedReason('')
    }
  }, [activePosition])

  // Filter positions
  const filteredPositions = useMemo(() => {
    const q = search.trim().toLowerCase()
    return e.positions.filter((p) => {
      const matchesSearch =
        !q ||
        `${p.ref} ${p.lv_id} ${p.title} ${p.variant} ${p.product_id ?? ''} ${p.product_description ?? ''} ${p.install_code ?? ''} ${p.system} ${p.category ?? ''}`
          .toLowerCase()
          .includes(q)

      const matchesCat = selectedCategory === 'all' || p.category === selectedCategory

      let matchesRoute = true
      if (routeFilter === 'calculated') matchesRoute = p.status === 'calculated'
      else if (routeFilter === 'quote') matchesRoute = p.status === 'supplier_quote_required'
      else if (routeFilter === 'assumption') matchesRoute = p.status === 'assumption_applied'
      else if (routeFilter === 'approved') matchesRoute = p.reviewed
      else if (routeFilter === 'review') matchesRoute = isPriceable(p) && !p.reviewed

      return matchesSearch && matchesCat && matchesRoute
    })
  }, [e.positions, search, selectedCategory, routeFilter])

  // Toggle approval
  const toggleApproval = async (p: Position) => {
    const nextReviewed = !p.reviewed
    await override(p.lv_id, { reviewed: nextReviewed })
    notify(`${p.ref} marked as ${nextReviewed ? 'approved' : 'reopened'}`)
  }

  // Switch product
  const handleSwitchProduct = async (p: Position, prod: CatalogItem) => {
    await override(p.lv_id, {
      product_id: prod.product_id,
      net_unit_cost_chf: prod.net_cost_chf,
    })
    notify(`Switched ${p.ref} to ${prod.product_id}`)
  }

  // Toggle pricing route (catalogue vs quote)
  const handleToggleRoute = async (p: Position) => {
    const newStatus: Status =
      p.status === 'supplier_quote_required' ? 'calculated' : 'supplier_quote_required'
    await override(p.lv_id, { status: newStatus })
    notify(`Route for ${p.ref}: ${newStatus === 'calculated' ? 'Dataset price' : 'Supplier quote'}`)
  }


  // Counts for workflow pipeline
  const stats = useMemo(() => {
    const directCatalogue = e.positions.filter((p) => p.status === 'calculated').length
    const quotes = e.positions.filter((p) => p.status === 'supplier_quote_required').length
    const requested = e.positions.filter((p) => p.status === 'supplier_quote_required' && p.requested).length
    const assumptions = e.positions.filter((p) => p.status === 'assumption_applied').length
    const m = metrics(e.positions)
    return { directCatalogue, quotes, requested, assumptions, approved: m.approved, open: m.open }
  }, [e.positions])

  // Alternatives in the same category
  const alternativesList = useMemo(() => {
    if (!activePosition) return []
    const cat = activePosition.category
    return catalog
      .filter((c) => c.category === cat && c.product_id !== activePosition.product_id)
      .slice(0, 6)
  }, [catalog, activePosition])

  const routeOptions: [RouteFilter, string][] = [
    ['all', `All (${e.positions.length})`],
    ['calculated', `Dataset priced (${stats.directCatalogue})`],
    ['quote', `Supplier Quote Required (${stats.quotes}${stats.requested ? ` · ${stats.requested} requested` : ''})`],
    ['assumption', `Assumption Applied (${stats.assumptions})`],
    ['approved', `Approved (${stats.approved})`],
    ['review', `To approve (${stats.open})`],
  ]
  const activeMatchLabel = activePosition?.match_kind === 'exact'
    ? 'Exact'
    : activePosition?.match_kind === 'dimension_match'
      ? 'Dimension'
      : 'Estimated'

  return (
    <div className="matched-items-page">
      <div className="slide15-header-card product-matching-header">
        <h1 className="slide15-title">Product Matching</h1>
        <span className="product-list-action">
          <AddProductList />
        </span>
        <label className="active-dataset-control">
          <Database size={17} />
          <span>
            <small>Active dataset</small>
            <strong>{e.dataset.name} · v{e.dataset.version}</strong>
          </span>
          <select
            aria-label="Change active dataset"
            value={e.dataset.id}
            disabled={!!busy}
            onChange={(event) => setDataset(event.target.value)}
          >
            {datasets.map((dataset) => (
              <option key={dataset.id} value={dataset.id}>
                {dataset.name} · {[dataset.country, dataset.location || dataset.region_label].filter(Boolean).join(' · ')} · v{dataset.latest_version}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Main Split Layout */}
      <div
        ref={containerRef}
        className={`structured-split-container ${isDragging ? 'is-resizing' : ''}`}
      >
        {/* Left Column: Matched Tender Items Table */}
        <div
          className="structured-table-card"
          style={{ width: `calc(${splitPercent}% - 7px)` }}
        >
          {/* Controls: Search and Route Pills */}
          <div className="structured-filter-bar">
            <label className="search-field" style={{ flex: 1 }}>
              <Search size={15} />
              <input
                placeholder="Search items, products, or rules…"
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

          {/* Pricing Route & Review Filter Pills */}
          <div className="filter-pills" style={{ marginBottom: '8px', flexWrap: 'wrap' }}>
            {routeOptions.map(([val, label]) => (
              <button
                key={val}
                className={routeFilter === val ? 'active' : ''}
                onClick={() => setRouteFilter(val)}
                style={{ fontSize: '11px', padding: '4px 10px', whiteSpace: 'nowrap' }}
              >
                {label}
              </button>
            ))}
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

          {/* Slide 15 Matched Items Table */}
          <div className="structured-table-wrapper">
            <table className="slide15-table">
              <thead>
                <tr>
                  <th style={{ width: '38px', textAlign: 'center' }}>#</th>
                  <th style={{ width: '118px' }}>Tender ref.</th>
                  <th>Item</th>
                  <th style={{ width: '170px' }}>Product</th>
                  <th style={{ width: '90px', textAlign: 'right' }}>Net Cost (CHF)</th>
                  <th style={{ width: '100px' }}>Rule</th>
                  <th style={{ width: '85px', textAlign: 'center' }}>Match</th>
                  <th style={{ width: '115px' }}>Route</th>
                  <th style={{ width: '55px', textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredPositions.map((p, idx) => {
                  const isSelected = p.lv_id === activePosition?.lv_id
                  const rowNumber = idx + 1

                  // Match Confidence badge style
                  const confidencePct = Math.round((p.match_confidence || 1) * 100)
                  const isExact = p.match_kind === 'exact'
                  const isDimension = p.match_kind === 'dimension_match'

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
                          <small className="muted" style={{ display: 'block', fontSize: '10px', marginTop: '1px' }}>
                            {p.quantity !== null ? `${fmtNum(p.quantity)} ${unit(p.unit)}` : '—'} · {p.system.split(' ')[0]}
                          </small>
                        </div>
                      </td>
                      <td>
                        {p.product_id ? (
                          <div className="matched-prod-cell">
                            <span className="prod-id-code">{p.product_id}</span>
                            <small className="prod-desc-text" title={p.product_description ?? ''}>
                              {p.product_description}
                            </small>
                          </div>
                        ) : (
                          <span className="unmatched-badge">Custom Equipment</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {p.net_unit_cost_chf && p.net_unit_cost_chf > 0 ? (
                          <span className={`net-cost-val ${p.overridden?.includes('net_unit_cost_chf') ? 'edited-cost' : ''}`}>
                            {money(p.net_unit_cost_chf, 2)}
                            {p.overridden?.includes('net_unit_cost_chf') && <span className="override-tag"> ✎</span>}
                            {isBenchmark(p) && <small className="benchmark-tag" title="Supplier-package benchmark from the price book, until the supplier's price comes back">estimate</small>}
                          </span>
                        ) : (
                          <button
                            className="btn-table-enter-cost"
                            onClick={(ev) => {
                              ev.stopPropagation()
                              select(p.lv_id)
                            }}
                            title="Zero cost. Click to enter price in inspector"
                          >
                            + Enter Cost
                          </button>
                        )}
                      </td>
                      <td>
                        {p.install_code ? (
                          <span className="rule-code-badge" title={`Base: ${p.base_hours_per_unit ?? 0}h`}>
                            {p.install_code}
                          </span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span
                          className="match-confidence-text"
                          title={`${confidencePct}% · ${p.match_kind}`}
                        >
                          {isExact ? 'Exact' : isDimension ? 'Dimension' : `${confidencePct}%`}
                        </span>
                      </td>
                      <td>
                        <span className={`route-badge ${p.status}`}>
                          {p.status === 'calculated'
                            ? 'Dataset'
                            : p.status === 'supplier_quote_required'
                            ? 'Supplier Quote'
                            : p.status === 'assumption_applied'
                            ? 'Assumption'
                            : 'Review'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {p.reviewed ? (
                          <span className="approved-icon" title="Approved">✓</span>
                        ) : (
                          <span className="pending-icon" title="Open for review">○</span>
                        )}
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
          title="Drag left or right to resize table and inspector"
        >
          <div className="resizer-handle-line">
            <div className="resizer-knob" />
          </div>
        </div>

        {/* Right Column: Matching Inspector / Source Document */}
        <div
          className="structured-doc-card"
          style={{ width: `calc(${100 - splitPercent}% - 7px)` }}
        >
          {/* Inspector Header with Tab Selector */}
          <div className="matched-inspector-header">
            <div className="inspector-tab-toggle">
              <button
                className={`tab-btn ${inspectorTab === 'matching' ? 'active' : ''}`}
                onClick={() => setInspectorTab('matching')}
              >
                <Sparkles size={14} /> Match
              </button>
              <button
                className={`tab-btn ${inspectorTab === 'source' ? 'active' : ''}`}
                onClick={() => setInspectorTab('source')}
              >
                <FileText size={14} /> PDF
              </button>
            </div>

            {activePosition && (
              <button
                className={`button small ${activePosition.reviewed ? '' : 'primary'}`}
                onClick={() => toggleApproval(activePosition)}
              >
                <Check size={14} /> {activePosition.reviewed ? 'Approved ✓' : 'Approve position'}
              </button>
            )}
          </div>

          {/* Tab 1: match details */}
          {inspectorTab === 'matching' ? (
            activePosition ? (
              <div className="matched-detail-scroll">
                {/* Active Item Heading */}
                <div className="detail-item-title-box">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <span className="lv-id-badge" style={{ fontSize: '13px' }}>
                        {activePosition.ref}
                      </span>
                      <strong style={{ fontSize: '14px', marginLeft: '8px', color: '#0f172a' }}>
                        {activePosition.title}
                      </strong>
                    </div>
                    <StatusBadge p={activePosition} />
                  </div>
                  {activePosition.variant && (
                    <div style={{ color: '#64748b', fontSize: '12px', marginTop: '3px' }}>
                      <b>{activePosition.variant}</b> · Page {activePosition.source_page}
                    </div>
                  )}
                  <div style={{ fontSize: '11px', color: '#475569', marginTop: '4px' }}>
                    <b>{activePosition.system}</b> · {activePosition.quantity} {unit(activePosition.unit)}
                  </div>
                  {activePosition.requested && !activePosition.quote && (
                    <div className="requested-note">
                      Price requested from {activePosition.requested.supplier || 'a supplier'} on{' '}
                      {new Date(activePosition.requested.at).toLocaleDateString('de-CH')}, waiting for the answer
                    </div>
                  )}
                </div>

                {/* Matched product */}
                <div className="inspector-section-card">
                  <div className="inspector-card-head">
                    <Database size={15} color="#0284c7" />
                    <h4>Matched product</h4>
                    <span className="match-confidence-text" style={{ marginLeft: 'auto' }}>
                      {activeMatchLabel} · {Math.round(activePosition.match_confidence * 100)}%
                    </span>
                  </div>

                  {activeCatalogItem ? (
                    <div className="matched-product-summary">
                      <div className="product-summary-grid">
                        <div>
                          <small>Product ID</small>
                          <strong style={{ color: '#0284c7' }}>{activeCatalogItem.product_id}</strong>
                        </div>
                        <div>
                          <small>Manufacturer</small>
                          <strong>{activeCatalogItem.manufacturer || 'Standard'}</strong>
                        </div>
                        <div>
                          <small>Model</small>
                          <strong>{activeCatalogItem.model || '—'}</strong>
                        </div>
                        <div>
                          <small>Net cost</small>
                          <strong style={{ color: '#059669', fontSize: '13px' }}>
                            {money(activeCatalogItem.net_cost_chf, 2)}
                          </strong>
                        </div>
                      </div>

                      <div className="product-desc-box">
                        <small className="muted">Description</small>
                        <p>{activeCatalogItem.description}</p>
                      </div>

                      <div style={{ display: 'flex', gap: '14px', fontSize: '11px', color: '#64748b' }}>
                        <span>List: <b>{money(Number(activeCatalogItem.list_price_chf) || 0)}</b></span>
                        <span>Discount: <b>{activeCatalogItem.discount_pct}%</b></span>
                        <span>Unit: <b>{activeCatalogItem.unit}</b></span>
                      </div>
                    </div>
                  ) : (
                    <div className="no-product-matched-note">
                      No product match
                    </div>
                  )}
                </div>

                {/* Installation */}
                <div className="inspector-section-card">
                  <div className="inspector-card-head">
                    <Wrench size={15} color="#d97706" />
                    <h4>Installation</h4>
                  </div>

                  {activeRule ? (
                    <div className="rule-summary-box">
                      <div className="product-summary-grid">
                        <div>
                          <small>Install Code</small>
                          <strong style={{ color: '#b45309' }}>{activeRule.install_code}</strong>
                        </div>
                        <div>
                          <small>Hours / unit</small>
                          <strong>{activeRule.base_hours_per_unit} hours</strong>
                        </div>
                        <div>
                          <small>Total hours</small>
                          <strong>
                            {activePosition.quantity
                              ? `${(activeRule.base_hours_per_unit * activePosition.quantity).toFixed(2)}h`
                              : '—'}
                          </strong>
                        </div>
                        <div>
                          <small>Rate / hour</small>
                          <strong>{money(activeRule.default_hourly_rate_chf || 120)}</strong>
                        </div>
                      </div>

                      <p style={{ fontSize: '11px', color: '#334155', margin: '8px 0 0' }}>
                        {activeRule.work_type} · <b>{activeRule.labour_role}</b> · {activeRule.unit}
                      </p>
                    </div>
                  ) : (
                    <div className="no-product-matched-note">
                      <small className="muted">Default installation rule</small>
                    </div>
                  )}
                </div>

                <ListOffers p={activePosition} />

                {/* Card 3: Pricing Route Control */}
                <div className="inspector-section-card">
                  <div className="inspector-card-head">
                    <Tag size={15} color="#7c3aed" />
                    <h4>Price source</h4>
                  </div>

                  <div className="route-control-box">
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        className={`route-select-btn ${activePosition.status !== 'supplier_quote_required' ? 'active' : ''}`}
                        onClick={() => activePosition.status === 'supplier_quote_required' && handleToggleRoute(activePosition)}
                      >
                        <strong>Dataset</strong>
                        <small>
                          {activePosition.net_unit_cost_chf == null ? '—' : money(activePosition.net_unit_cost_chf, 2)} / unit
                          {isBenchmark(activePosition) && ' · estimate until the supplier answers'}
                        </small>
                      </button>

                      <button
                        className={`route-select-btn ${activePosition.status === 'supplier_quote_required' ? 'active' : ''}`}
                        onClick={() => activePosition.status !== 'supplier_quote_required' && handleToggleRoute(activePosition)}
                      >
                        <strong>Supplier quote</strong>
                        <small>RFQ</small>
                      </button>
                    </div>

                    {/* Manual Price Entry under Pricing Route */}
                    <div className="matched-quick-price-box">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: '#334155', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Edit3 size={13} color="#0284c7" /> Unit cost
                        </span>
                        {activePosition.overridden?.includes('net_unit_cost_chf') && (
                          <span className="override-badge-pill">Custom Price ✎</span>
                        )}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div>
                          <small className="muted" style={{ display: 'block', fontSize: '10px', marginBottom: '2px' }}>
                            Per {unit(activePosition.unit)}
                          </small>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={matchedEditCost}
                            onChange={(ev) => setMatchedEditCost(ev.target.value)}
                            style={{ width: '100%', padding: '5px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                          />
                        </div>
                        <div>
                          <small className="muted" style={{ display: 'block', fontSize: '10px', marginBottom: '2px' }}>
                            Editor
                          </small>
                          <input
                            type="text"
                            placeholder="Name"
                            value={matchedEditorName}
                            onChange={(ev) => setMatchedEditorName(ev.target.value)}
                            style={{ width: '100%', padding: '5px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                          />
                        </div>
                      </div>

                      <div style={{ marginTop: '6px' }}>
                        <small className="muted" style={{ display: 'block', fontSize: '10px', marginBottom: '2px' }}>
                          Note (optional)
                        </small>
                        <input
                          type="text"
                          placeholder="Supplier or reason"
                          value={matchedReason}
                          onChange={(ev) => setMatchedReason(ev.target.value)}
                          style={{ width: '100%', padding: '5px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                        />
                      </div>

                      <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                        <button
                          className="button small primary"
                          disabled={!matchedEditCost || isNaN(parseFloat(matchedEditCost)) || parseFloat(matchedEditCost) < 0 || isSavingCost}
                          onClick={async () => {
                            const val = parseFloat(matchedEditCost)
                            const author = (matchedEditorName.trim() || e.tender.meta.estimator || 'Estimator').trim()
                            try {
                              localStorage.setItem('equans-editor-name', author)
                            } catch {
                              // Saving the price still works when local storage is unavailable.
                            }
                            setIsSavingCost(true)
                            try {
                              await override(activePosition.lv_id, { net_unit_cost_chf: val, status: 'assumption_applied' })
                              await addNote(activePosition.lv_id, `Manual unit cost set to CHF ${val.toFixed(2)}/unit by ${author}${matchedReason.trim() ? `. Note: ${matchedReason.trim()}` : ''}`, author)
                              notify(`Saved CHF ${val.toFixed(2)}/unit by ${author}`)
                              setMatchedReason('')
                            } finally {
                              setIsSavingCost(false)
                            }
                          }}
                        >
                          <Save size={12} /> {isSavingCost ? 'Saving…' : 'Save price'}
                        </button>
                        {activePosition.overridden?.includes('net_unit_cost_chf') && (
                          <button
                            className="button small"
                            disabled={isSavingCost}
                            onClick={async () => {
                              const author = (matchedEditorName.trim() || e.tender.meta.estimator || 'Estimator').trim()
                              setIsSavingCost(true)
                              try {
                                await override(activePosition.lv_id, { reset: true })
                                await addNote(activePosition.lv_id, `Cost reset to dataset price by ${author}`, author)
                                notify(`Reset ${activePosition.ref}`)
                              } finally {
                                setIsSavingCost(false)
                              }
                            }}
                          >
                            <RotateCcw size={12} /> Reset
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Alternatives */}
                {alternativesList.length > 0 && (
                  <div className="inspector-section-card">
                    <div className="inspector-card-head">
                      <RefreshCw size={14} color="#059669" />
                      <h4>Alternatives · {activePosition.category}</h4>
                    </div>

                    <div className="alternatives-list-box">
                      {alternativesList.map((alt) => (
                        <div key={alt.product_id} className="alt-product-row">
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <b style={{ color: '#0284c7', fontSize: '11.5px' }}>{alt.product_id}</b>
                              <span style={{ fontSize: '11px', color: '#0f172a', fontWeight: 600 }}>{alt.model}</span>
                              <span className="muted" style={{ fontSize: '10.5px' }}>({alt.manufacturer})</span>
                            </div>
                            <small className="muted" style={{ display: 'block', fontSize: '10.5px', marginTop: '2px' }}>
                              {alt.description}
                            </small>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <strong style={{ fontSize: '12px', color: '#059669' }}>
                              {money(alt.net_cost_chf, 2)}
                            </strong>
                            <button
                              className="button small"
                              onClick={() => handleSwitchProduct(activePosition, alt)}
                            >
                              Switch
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null
          ) : (
            /* Tab 2: Live PDF Document Viewer */
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

    </div>
  )
}
