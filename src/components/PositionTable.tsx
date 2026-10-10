import { useEffect, useMemo, useState } from 'react'
import { ArrowUpDown, Check, ChevronLeft, ChevronRight, RotateCcw, Search, SlidersHorizontal, X } from 'lucide-react'
import { PILLS, isBlocker, isDuctList, needsDecision, pillMatch, systemsOf } from '../derive'
import { STATUS_META, fmtNum, money, unit } from '../format'
import { useEstimate, useStore } from '../store'
import type { Position } from '../types'
import { Button, StatusBadge } from './ui'

export type Mode = 'positions' | 'review' | 'calculation'

/** Everything but the status pill: system, search, section, duct lines, "only these". */
function baseFilter(ps: Position[], s: ReturnType<typeof useStore.getState>, review: boolean) {
  const q = s.search.trim().toLowerCase()
  return ps.filter(
    (p) =>
      (!review || s.pill === 'approved' || isBlocker(p)) &&
      (!s.only || s.only.ids.includes(p.lv_id)) &&
      (s.system === 'all' || p.system === s.system) &&
      (s.section === 'all' || p.section === s.section) &&
      (!s.hideDucts || !isDuctList(p)) &&
      (!q ||
        `${p.ref} ${p.lv_id} ${p.title} ${p.variant} ${p.description} ${p.product_id ?? ''} ${p.product_description ?? ''} ${p.install_code ?? ''}`
          .toLowerCase()
          .includes(q)),
  )
}

export function useFiltered(review = false) {
  const s = useStore()
  const e = useEstimate()
  return useMemo(() => {
    const rows = baseFilter(e.positions, s, review).filter((p) => pillMatch(p, s.pill))
    // the review queue starts with the positions that need a decision
    return review ? [...rows].sort((a, b) => Number(needsDecision(b)) - Number(needsDecision(a))) : rows
  }, [e, s, review])
}

export function Filters({ review = false }: { review?: boolean }) {
  const s = useStore()
  const e = useEstimate()
  const [expanded, setExpanded] = useState(false)
  const base = baseFilter(e.positions, { ...s, pill: 'all' }, review)
  const sections = [...new Set(e.positions.map((p) => p.section ?? ''))].filter(Boolean).sort()
  return (
    <>
      <div className="filters">
        <div className="filter-pills">
          {PILLS.map(([k, label]) => (
            <button key={k} onClick={() => s.filter({ pill: k })} className={s.pill === k ? 'active' : ''}>
              {review && k === 'all' ? 'Open' : label} <span>{base.filter((p) => pillMatch(p, k)).length}</span>
            </button>
          ))}
        </div>
        <button className={`button small ${expanded ? 'pressed' : ''}`} onClick={() => setExpanded(!expanded)}>
          <SlidersHorizontal size={16} /> Filters
        </button>
      </div>
      {s.only && (
        <div className="only-chip">
          <span>
            Showing the {s.only.ids.length} positions of: <b>{s.only.label}</b>
          </span>
          <button className="text-button" onClick={() => s.filter({ only: null })}>
            <X size={13} /> Show all
          </button>
        </div>
      )}
      {expanded && (
        <div className="expanded-filters">
          <label className="search-field">
            <Search size={15} />
            <input
              aria-label="Search positions"
              placeholder="Position, product, description…"
              value={s.search}
              onChange={(ev) => s.filter({ search: ev.target.value })}
            />
          </label>
          <select aria-label="Section" value={s.section} onChange={(ev) => s.filter({ section: ev.target.value })}>
            <option value="all">All sections</option>
            {sections.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <select aria-label="System" value={s.system} onChange={(ev) => s.filter({ system: ev.target.value })}>
            <option value="all">All systems</option>
            {systemsOf(e.positions).map((x) => (
              <option key={x.id} value={x.id}>
                {x.id}
              </option>
            ))}
          </select>
          <label className="check-field">
            <input type="checkbox" checked={s.hideDucts} onChange={(ev) => s.filter({ hideDucts: ev.target.checked })} />
            Hide duct-list lines
          </label>
          <button className="text-button" onClick={() => s.clearFilters()}>
            Clear filters
          </button>
        </div>
      )}
    </>
  )
}

const SORTS = ['Pos. No.', 'Description', 'Price ↓'] as const

export function PositionTable({ rows, mode = 'positions', limit = 8 }: { rows: Position[]; mode?: Mode; limit?: number }) {
  const { selected, select, clearFilters, bulk, busy } = useStore()
  const [page, setPage] = useState(0)
  const [sort, setSort] = useState(0)
  const [checked, setChecked] = useState<string[]>([])
  const [size, setSize] = useState(limit)
  const ids = rows.map((p) => p.lv_id).join(',')
  useEffect(() => setPage(0), [ids, size, sort])
  const ordered = useMemo(
    () =>
      sort === 1
        ? [...rows].sort((a, b) => a.title.localeCompare(b.title))
        : sort === 2
          ? [...rows].sort((a, b) => b.direct_position_cost_chf - a.direct_position_cost_chf)
          : rows,
    [rows, sort],
  )
  // follow the selection (e.g. stepping with the detail panel's arrows) to its table page
  useEffect(() => {
    const i = ordered.findIndex((p) => p.lv_id === selected)
    if (i >= 0) setPage((pg) => (Math.floor(i / size) === pg ? pg : Math.floor(i / size)))
  }, [selected, ordered, size])
  const visible = ordered.slice(page * size, page * size + size)
  const calc = mode === 'calculation'
  const act = async (body: Parameters<typeof bulk>[1], done: string) => {
    await bulk(checked, body, done)
    setChecked([])
  }
  return (
    <>
      <div className="table-toolbar">
        <span>
          {rows.length} positions · CHF {money(rows.reduce((s, p) => s + p.direct_position_cost_chf, 0))} direct cost
        </span>
        <button className="text-button" onClick={() => setSort((sort + 1) % SORTS.length)}>
          <ArrowUpDown size={13} /> {SORTS[sort]}
        </button>
      </div>
      {checked.length > 0 && (
        <div className="bulk-bar">
          <b>{checked.length} selected</b>
          <Button className="small" primary disabled={!!busy} onClick={() => act({ reviewed: true }, `${checked.length} positions approved.`)}>
            <Check size={14} /> Approve
          </Button>
          <Button className="small" disabled={!!busy} onClick={() => act({ reviewed: false }, `${checked.length} positions reopened.`)}>
            <RotateCcw size={14} /> Reopen
          </Button>
          <Button
            className="small"
            disabled={!!busy}
            onClick={() => act({ status: 'supplier_quote_required' }, `${checked.length} positions added to the supplier RFQs.`)}
          >
            Request quote
          </Button>
          <button className="text-button" onClick={() => setChecked([])}>
            Clear
          </button>
        </div>
      )}
      <div className="table-scroll">
        <table className={`position-table ${calc ? 'calculation-table' : ''}`}>
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  aria-label="Select visible positions"
                  checked={visible.length > 0 && visible.every((p) => checked.includes(p.lv_id))}
                  onChange={(e) =>
                    setChecked(
                      e.target.checked
                        ? [...new Set([...checked, ...visible.map((p) => p.lv_id)])]
                        : checked.filter((id) => !visible.some((p) => p.lv_id === id)),
                    )
                  }
                />
              </th>
              <th>Pos.</th>
              <th>Description</th>
              <th className="num">Quantity</th>
              <th>Unit</th>
              <th>Product</th>
              {calc ? (
                <>
                  <th className="num">
                    Material
                    <br />
                    (CHF)
                  </th>
                  <th className="num">Hours</th>
                  <th className="num">
                    Labour
                    <br />
                    (CHF)
                  </th>
                  <th className="num">
                    Total
                    <br />
                    (CHF)
                  </th>
                  <th className="num">
                    Unit price
                    <br />
                    (CHF)
                  </th>
                </>
              ) : (
                <>
                  {mode === 'review' && <th>Issue</th>}
                  <th>Status</th>
                  {mode !== 'review' && <th className="num">Price (CHF)</th>}
                </>
              )}
              <th />
            </tr>
          </thead>
          <tbody>
            {visible.map((p) => (
              <tr
                tabIndex={0}
                aria-selected={selected === p.lv_id}
                key={p.ref}
                className={`${selected === p.lv_id ? 'selected' : ''} ${p.reviewed ? 'approved-row' : ''}`}
                onClick={() => select(p.lv_id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    select(p.lv_id)
                  }
                }}
              >
                <td>
                  <input
                    type="checkbox"
                    aria-label={`Select ${p.ref}`}
                    checked={checked.includes(p.lv_id)}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setChecked(e.target.checked ? [...checked, p.lv_id] : checked.filter((id) => id !== p.lv_id))}
                  />
                </td>
                <td className="pos-cell">
                  {p.ref}
                  <small>p. {p.source_page}</small>
                </td>
                <td className="description-cell">
                  {p.title}
                  {p.overridden.length > 0 && <span className="edited-tag">edited</span>}
                  {p.variant && <small>{p.variant}</small>}
                </td>
                <td className="num">{fmtNum(p.quantity)}</td>
                <td>{unit(p.unit)}</td>
                <td className="product-cell">
                  {p.product_id ?? (p.install_code && p.install_code !== 'UNKNOWN' ? 'labour only' : '—')}
                  {p.product_description && <small>{p.product_description}</small>}
                </td>
                {calc ? (
                  <>
                    <td className="num">{money(p.material_cost_chf)}</td>
                    <td className="num">{fmtNum(p.adjusted_install_hours)}</td>
                    <td className="num">{money(p.labour_cost_chf)}</td>
                    <td className="num">
                      <b>{money(p.direct_position_cost_chf)}</b>
                    </td>
                    <td className="num">{p.quantity ? money(p.direct_position_cost_chf / p.quantity, 2) : '—'}</td>
                  </>
                ) : (
                  <>
                    {mode === 'review' && (
                      <td className="issue-cell">{p.assumptions[0] ?? STATUS_META[p.status].help}</td>
                    )}
                    <td>
                      <StatusBadge p={p} />
                    </td>
                    {mode !== 'review' && <td className="num">{p.direct_position_cost_chf ? money(p.direct_position_cost_chf) : '—'}</td>}
                  </>
                )}
                <td>
                  <ChevronRight size={16} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <div className="empty-state">
            <Search size={28} />
            <h3>No matching positions</h3>
            <p>Change the search or filters.</p>
            <Button onClick={clearFilters}>Reset filters</Button>
          </div>
        )}
      </div>
      <div className="table-footer">
        <div className="inline">
          <button className="icon-button" aria-label="Previous table page" disabled={!page} onClick={() => setPage(page - 1)}>
            <ChevronLeft size={17} />
          </button>
          <span>
            {rows.length ? page * size + 1 : 0}–{Math.min((page + 1) * size, rows.length)} of {rows.length}
          </span>
          <button
            className="icon-button"
            aria-label="Next table page"
            disabled={(page + 1) * size >= rows.length}
            onClick={() => setPage(page + 1)}
          >
            <ChevronRight size={17} />
          </button>
        </div>
        <select aria-label="Positions per page" value={size} onChange={(e) => setSize(+e.target.value)}>
          {[5, 8, 10, 20, 50, 100].map((n) => (
            <option key={n} value={n}>
              {n} per page
            </option>
          ))}
        </select>
        {calc && (
          <strong>
            Totals: CHF {money(rows.reduce((a, p) => a + p.material_cost_chf, 0))} material · CHF{' '}
            {money(rows.reduce((a, p) => a + p.labour_cost_chf, 0))} labour · CHF{' '}
            {money(rows.reduce((a, p) => a + p.direct_position_cost_chf, 0))}
          </strong>
        )}
      </div>
    </>
  )
}
