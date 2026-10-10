import { useState } from 'react'
import { api } from '../api'
import type { CatalogItem, Position, PositionOverride, Status } from '../types'
import { STATUS_META, STATUS_ORDER, fmtChf, fmtNum } from '../format'
import { Confidence, StatusChip } from './PositionsView'

interface Props {
  position: Position
  tenderId: string
  catalog: CatalogItem[]
  onClose: () => void
  onOverride: (b: PositionOverride) => void
}

const FACTOR_LABEL: Record<string, string> = {
  site_efficiency: 'site efficiency (÷)',
  school_logistics: 'school logistics',
  mounting_height_school: 'mounting height',
  timber_interface: 'timber interface',
}

export function PositionDrawer({ position: p, tenderId, catalog, onClose, onOverride }: Props) {
  const [page, setPage] = useState(p.source_page)
  const [zoom, setZoom] = useState(false)
  const [draft, setDraft] = useState({
    product_id: p.product_id ?? '',
    quantity: p.quantity ?? '',
    net_unit_cost_chf: p.net_unit_cost_chf ?? '',
    base_hours_per_unit: p.base_hours_per_unit ?? '',
    hourly_rate_chf: p.hourly_rate_chf ?? '',
    status: p.status,
  })

  const save = () => {
    const b: PositionOverride = {}
    if (draft.product_id && draft.product_id !== p.product_id) b.product_id = draft.product_id
    const n = (v: string | number) => (v === '' ? undefined : Number(v))
    if (n(draft.quantity) !== undefined && n(draft.quantity) !== p.quantity) b.quantity = n(draft.quantity)
    if (n(draft.net_unit_cost_chf) !== undefined && n(draft.net_unit_cost_chf) !== p.net_unit_cost_chf)
      b.net_unit_cost_chf = n(draft.net_unit_cost_chf)
    if (n(draft.base_hours_per_unit) !== undefined && n(draft.base_hours_per_unit) !== p.base_hours_per_unit)
      b.base_hours_per_unit = n(draft.base_hours_per_unit)
    if (n(draft.hourly_rate_chf) !== undefined && n(draft.hourly_rate_chf) !== p.hourly_rate_chf)
      b.hourly_rate_chf = n(draft.hourly_rate_chf)
    if (draft.status !== p.status) b.status = draft.status
    if (Object.keys(b).length) onOverride(b)
  }

  const factor = p.base_hours_per_unit && p.quantity ? p.adjusted_install_hours / (p.quantity * p.base_hours_per_unit) : null
  const sameCode = catalog.filter((c) => !p.install_code || c.install_code === p.install_code)
  const others = catalog.filter((c) => !sameCode.includes(c))

  return (
    <aside className="drawer">
      <div className="drawer-head">
        <div>
          <div className="muted small">
            {p.system} · {p.section} · {p.lv_id}
          </div>
          <h2>{p.title}</h2>
          {p.variant && <div className="desc-variant">{p.variant}</div>}
        </div>
        <button className="icon" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>

      <div className="drawer-body">
        <div className="status-row">
          <StatusChip status={p.status} />
          <span className="muted small">{STATUS_META[p.status].help}</span>
        </div>

        <section className="card">
          <div className="card-title">How this number is built</div>
          <table className="calc">
            <tbody>
              <tr>
                <td>Material</td>
                <td>
                  {fmtNum(p.quantity)} {p.unit} × {p.net_unit_cost_chf != null ? fmtChf(p.net_unit_cost_chf, true) : 'no price'} × (1 +
                  waste)
                </td>
                <td className="num">{fmtChf(p.material_cost_chf, true)}</td>
              </tr>
              <tr>
                <td>Hours</td>
                <td>
                  {fmtNum(p.quantity)} × {fmtNum(p.base_hours_per_unit)} h ({p.install_code ?? '—'})
                  {factor ? ` × ${factor.toFixed(3)} factors` : ''}
                </td>
                <td className="num">{fmtNum(p.adjusted_install_hours)} h</td>
              </tr>
              <tr>
                <td>Labour</td>
                <td>
                  {fmtNum(p.adjusted_install_hours)} h × {fmtChf(p.hourly_rate_chf)}/h
                </td>
                <td className="num">{fmtChf(p.labour_cost_chf, true)}</td>
              </tr>
              <tr className="total">
                <td>Direct cost</td>
                <td />
                <td className="num">{fmtChf(p.direct_position_cost_chf, true)}</td>
              </tr>
            </tbody>
          </table>
          {p.factors_applied.length > 0 && (
            <div className="muted small">Factors: {p.factors_applied.map((f) => FACTOR_LABEL[f] ?? f).join(', ')}</div>
          )}
        </section>

        <section className="card">
          <div className="card-title">Match</div>
          <div className="match big">
            <Confidence value={p.match_confidence} />
            <span>
              {p.product_id ? (
                <>
                  <span className="pid">{p.product_id}</span> {p.product_description}{' '}
                  <span className="muted small">({p.price_source})</span>
                </>
              ) : (
                <span className="muted">No catalogue item</span>
              )}
            </span>
          </div>
          {p.assumptions.length > 0 && (
            <ul className="assumptions">
              {p.assumptions.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          )}
        </section>

        {p.alternatives.length > 0 && (
          <section className="card">
            <div className="card-title">Alternatives</div>
            <table className="alt-table">
              <tbody>
                {p.alternatives.map((a) => (
                  <tr key={a.product_id}>
                    <td>
                      <span className="pid">{a.product_id}</span> {a.description}
                      <div className="muted small">{a.reason}</div>
                    </td>
                    <td className="num">
                      {fmtChf(a.net_unit_cost_chf, true)}
                      <div className={`small ${a.material_delta_chf > 0 ? 'muted' : 'ok-text'}`}>
                        {a.material_delta_chf > 0 ? '+' : '−'}
                        {fmtChf(Math.abs(a.material_delta_chf))} material
                      </div>
                    </td>
                    <td className="num">
                      <button className="btn small-btn" onClick={() => onOverride({ product_id: a.product_id })}>
                        Use
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <section className="card">
          <div className="card-title">Adjust</div>
          <div className="form">
            <label>
              Catalogue item
              <select value={draft.product_id} onChange={(e) => setDraft({ ...draft, product_id: e.target.value })}>
                <option value="">— none —</option>
                <optgroup label="Same installation rule">
                  {sameCode.map((c) => (
                    <option key={c.product_id} value={c.product_id}>
                      {c.product_id} · {c.description} · CHF {c.net_cost_chf}/{c.unit}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Other items">
                  {others.map((c) => (
                    <option key={c.product_id} value={c.product_id}>
                      {c.product_id} · {c.description} · CHF {c.net_cost_chf}/{c.unit}
                    </option>
                  ))}
                </optgroup>
              </select>
            </label>
            <div className="form-row">
              <label>
                Quantity ({p.unit})
                <input type="number" value={draft.quantity} onChange={(e) => setDraft({ ...draft, quantity: e.target.value })} />
              </label>
              <label>
                Net unit cost (CHF)
                <input
                  type="number"
                  value={draft.net_unit_cost_chf}
                  onChange={(e) => setDraft({ ...draft, net_unit_cost_chf: e.target.value })}
                />
              </label>
            </div>
            <div className="form-row">
              <label>
                Base hours / unit
                <input
                  type="number"
                  step="0.05"
                  value={draft.base_hours_per_unit}
                  onChange={(e) => setDraft({ ...draft, base_hours_per_unit: e.target.value })}
                />
              </label>
              <label>
                Hourly rate (CHF)
                <input
                  type="number"
                  value={draft.hourly_rate_chf}
                  onChange={(e) => setDraft({ ...draft, hourly_rate_chf: e.target.value })}
                />
              </label>
            </div>
            <label>
              Status
              <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as Status })}>
                {STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_META[s].label}
                  </option>
                ))}
              </select>
            </label>
            {p.extracted_quantity !== p.quantity && (
              <div className="muted small">Tender quantity: {fmtNum(p.extracted_quantity)} {p.unit}</div>
            )}
            <div className="form-actions">
              <button className="btn primary" onClick={save}>
                Apply changes
              </button>
              <button className="btn" onClick={() => onOverride({ reviewed: !p.reviewed })}>
                {p.reviewed ? 'Unmark reviewed' : 'Mark as reviewed'}
              </button>
              {p.overridden.length > 0 && (
                <button className="btn ghost" onClick={() => onOverride({ reset: true })}>
                  Reset to proposal
                </button>
              )}
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-title">
            Source in tender
            <span className="page-nav">
              {p.source_pages.length > 1 &&
                p.source_pages.map((n) => (
                  <button key={n} className={n === page ? 'active' : ''} onClick={() => setPage(n)}>
                    {n}
                  </button>
                ))}
              <button onClick={() => setPage(page - 1)}>‹</button>
              <span>p. {page}</span>
              <button onClick={() => setPage(page + 1)}>›</button>
            </span>
          </div>
          <div className="quote">
            <div className="muted small">Extracted line</div>
            <code>{p.source_line}</code>
          </div>
          {p.description && p.description !== p.title && <p className="small">{p.description}</p>}
          {Object.keys(p.attributes).length > 0 && (
            <dl className="attrs">
              {Object.entries(p.attributes).map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{String(v)}</dd>
                </div>
              ))}
            </dl>
          )}
          {p.components.length > 0 && (
            <details>
              <summary>{p.components.length} sub-components included in this unit</summary>
              <ul className="small">
                {p.components.map((c, i) => (
                  <li key={i}>
                    {c.text} · {fmtNum(c.quantity)} {c.unit} (p. {c.source_page})
                  </li>
                ))}
              </ul>
            </details>
          )}
          <img
            className={`page-img ${zoom ? 'zoom' : ''}`}
            src={api.pageUrl(tenderId, page)}
            alt={`Tender page ${page}`}
            onClick={() => setZoom(!zoom)}
          />
        </section>
      </div>
    </aside>
  )
}
