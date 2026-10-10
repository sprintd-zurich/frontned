import { useMemo, useState } from 'react'
import type { CatalogItem, Estimate, Position, PositionOverride, Status } from '../types'
import { STATUS_META, STATUS_ORDER, fmtChf, fmtNum } from '../format'
import { PositionDrawer } from './PositionDrawer'

interface Props {
  estimate: Estimate
  catalog: CatalogItem[]
  onOverride: (lvId: string, body: PositionOverride) => void
  only?: { label: string; ids: string[] } | null
  onClearOnly?: () => void
}

type Focus = 'all' | 'attention' | 'priced'

export function StatusChip({ status }: { status: Status }) {
  const m = STATUS_META[status]
  return (
    <span className={`chip ${m.tone}`} title={m.help}>
      {m.label}
    </span>
  )
}

export function Confidence({ value }: { value: number }) {
  const tone = value >= 0.85 ? 'ok' : value >= 0.6 ? 'warn' : 'alert'
  return (
    <span className={`conf ${tone}`} title={`Match confidence ${Math.round(value * 100)}%`}>
      <span style={{ width: `${value * 100}%` }} />
    </span>
  )
}

export function PositionsView({ estimate, catalog, onOverride, only, onClearOnly }: Props) {
  const [system, setSystem] = useState<string>('all')
  const [statuses, setStatuses] = useState<Set<Status>>(new Set())
  const [focus, setFocus] = useState<Focus>('all')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [hideDucts, setHideDucts] = useState(false)

  const systems = useMemo(() => [...new Set(estimate.positions.map((p) => p.system))], [estimate])
  const counts = useMemo(() => {
    const c: Partial<Record<Status, number>> = {}
    estimate.positions.forEach((p) => (c[p.status] = (c[p.status] ?? 0) + 1))
    return c
  }, [estimate])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return estimate.positions.filter((p) => {
      if (only && !only.ids.includes(p.lv_id)) return false
      if (system !== 'all' && p.system !== system) return false
      if (statuses.size && !statuses.has(p.status)) return false
      if (hideDucts && p.kind !== 'quantity' && p.kind !== 'equipment_unit' && p.kind !== 'lump_sum') return false
      if (focus === 'attention' && (p.reviewed || !['review_required', 'insufficient_information'].includes(p.status)))
        return false
      if (focus === 'priced' && p.direct_position_cost_chf === 0) return false
      if (q && !`${p.title} ${p.variant} ${p.description} ${p.product_id ?? ''} ${p.lv_id}`.toLowerCase().includes(q))
        return false
      return true
    })
  }, [estimate, system, statuses, focus, query, hideDucts, only])

  const groups = useMemo(() => {
    const g = new Map<string, Position[]>()
    rows.forEach((p) => {
      const k = `${p.system}|||${p.section ?? ''}`
      g.set(k, [...(g.get(k) ?? []), p])
    })
    return [...g.entries()]
  }, [rows])

  const total = rows.reduce((s, p) => s + p.direct_position_cost_chf, 0)
  const current = estimate.positions.find((p) => p.lv_id === selected) ?? null
  const toggle = (s: Status) => {
    const n = new Set(statuses)
    if (n.has(s)) n.delete(s)
    else n.add(s)
    setStatuses(n)
  }

  return (
    <div className="workspace">
      <aside className="filters">
        <div className="filter-block">
          <div className="filter-title">Focus</div>
          {(
            [
              ['all', 'All positions'],
              ['attention', 'Needs my decision'],
              ['priced', 'Priced only'],
            ] as [Focus, string][]
          ).map(([k, l]) => (
            <button key={k} className={`filter-item ${focus === k ? 'active' : ''}`} onClick={() => setFocus(k)}>
              {l}
            </button>
          ))}
        </div>
        <div className="filter-block">
          <div className="filter-title">System</div>
          <button className={`filter-item ${system === 'all' ? 'active' : ''}`} onClick={() => setSystem('all')}>
            All systems
          </button>
          {systems.map((s) => (
            <button key={s} className={`filter-item ${system === s ? 'active' : ''}`} onClick={() => setSystem(s)}>
              {s}
            </button>
          ))}
        </div>
        <div className="filter-block">
          <div className="filter-title">Status</div>
          {STATUS_ORDER.filter((s) => counts[s]).map((s) => (
            <label key={s} className="filter-check">
              <input type="checkbox" checked={statuses.has(s)} onChange={() => toggle(s)} />
              <StatusChip status={s} />
              <span className="muted">{counts[s]}</span>
            </label>
          ))}
        </div>
        <label className="filter-check">
          <input type="checkbox" checked={hideDucts} onChange={(e) => setHideDucts(e.target.checked)} />
          <span>Hide duct-list lines</span>
        </label>
      </aside>

      <section className="table-wrap">
        <div className="table-toolbar">
          <input
            className="search"
            placeholder="Search description, product, position…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {only && (
            <button className="chip info only-chip" onClick={onClearOnly} title="Show all positions">
              {only.label} ✕
            </button>
          )}
          <div className="muted">
            {rows.length} positions · <strong>{fmtChf(total)}</strong> direct cost
          </div>
        </div>
        <div className="table-scroll">
          <table className="positions">
            <thead>
              <tr>
                <th>Position</th>
                <th className="num">Qty</th>
                <th>Unit</th>
                <th>Matched item</th>
                <th className="num">Unit cost</th>
                <th className="num">Hours</th>
                <th className="num">Direct cost</th>
                <th>Status</th>
                <th>Page</th>
              </tr>
            </thead>
            <tbody>
              {groups.map(([key, ps]) => {
                const [sys, sec] = key.split('|||')
                return (
                  <GroupRows
                    key={key}
                    system={sys}
                    section={sec}
                    rows={ps}
                    selected={selected}
                    onSelect={setSelected}
                  />
                )
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="empty">
                    No positions match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {current && (
        <PositionDrawer
          // remount when the position changes so the edit form shows the new values
          key={`${current.lv_id}|${current.product_id}|${current.quantity}|${current.net_unit_cost_chf}|${current.overridden.join()}`}
          position={current}
          tenderId={estimate.tender.id}
          catalog={catalog}
          onClose={() => setSelected(null)}
          onOverride={(b) => onOverride(current.lv_id, b)}
        />
      )}
    </div>
  )
}

function GroupRows({
  system,
  section,
  rows,
  selected,
  onSelect,
}: {
  system: string
  section: string
  rows: Position[]
  selected: string | null
  onSelect: (id: string) => void
}) {
  const sum = rows.reduce((s, p) => s + p.direct_position_cost_chf, 0)
  return (
    <>
      <tr className="group">
        <td colSpan={6}>
          <strong>{system}</strong> <span className="muted">· {section || 'General'}</span>
        </td>
        <td className="num">
          <strong>{fmtChf(sum)}</strong>
        </td>
        <td colSpan={2} />
      </tr>
      {rows.map((p) => (
        <tr
          key={p.lv_id}
          className={`row ${selected === p.lv_id ? 'selected' : ''} ${p.reviewed ? 'reviewed' : ''}`}
          onClick={() => onSelect(p.lv_id)}
        >
          <td className="desc">
            <div className="desc-title">
              {p.title}
              {p.overridden.length > 0 && <span className="edited" title="Adjusted by estimator">edited</span>}
              {p.reviewed && <span className="tick" title="Marked as reviewed">✓</span>}
            </div>
            {p.variant && <div className="desc-variant">{p.variant}</div>}
          </td>
          <td className="num">{fmtNum(p.quantity)}</td>
          <td>{p.unit}</td>
          <td>
            {p.product_id ? (
              <div className="match">
                <Confidence value={p.match_confidence} />
                <span>
                  <span className="pid">{p.product_id}</span>
                  <span className="muted small"> {p.product_description}</span>
                </span>
              </div>
            ) : (
              <span className="muted">{p.install_code && p.install_code !== 'UNKNOWN' ? `labour: ${p.install_code}` : '—'}</span>
            )}
          </td>
          <td className="num">{p.net_unit_cost_chf != null ? fmtChf(p.net_unit_cost_chf, true) : '—'}</td>
          <td className="num">{p.adjusted_install_hours ? fmtNum(p.adjusted_install_hours) : '—'}</td>
          <td className="num strong">{p.direct_position_cost_chf ? fmtChf(p.direct_position_cost_chf) : '—'}</td>
          <td>
            <StatusChip status={p.status} />
          </td>
          <td>
            <span className="page">p. {p.source_page}</span>
          </td>
        </tr>
      ))}
    </>
  )
}
