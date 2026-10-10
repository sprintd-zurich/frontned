import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  HardHat,
  Info,
  MessageSquare,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import { initials, needsDecision } from '../derive'
import { STATUS_META, STATUS_ORDER, fmtChf, fmtNum, fmtWhen, money, unit } from '../format'
import { useEstimate, useStore } from '../store'
import type { Position, Status } from '../types'
import { ActivityItem } from '../pages/Overview'
import { CostPanel, FACTOR_LABEL } from './CostPanel'
import { SourceView } from './SourceView'
import { Button, Modal, ProductGraphic, Ring, StatusBadge } from './ui'
import type { Mode } from './PositionTable'

const isFire = (p: { product_id?: string | null; install_code?: string | null }) =>
  !!(p.product_id?.startsWith('P-FIR') || p.install_code?.startsWith('FIRE'))

export function Detail({ p, mode, rows }: { p: Position; mode: Mode; rows: Position[] }) {
  const e = useEstimate()
  const { override, select, addNote, deleteNote, checksFor } = useDetailActions()
  const busy = useStore((s) => s.busy)
  const rules = useStore((s) => s.rules)
  const tabs =
    mode === 'calculation'
      ? ['Calculation', 'Alternatives', 'History']
      : ['AI Proposal', 'Source', 'Discussion', 'Alternatives', 'Technical', 'History']
  const [tab, setTab] = useState(tabs[0])
  const [note, setNote] = useState('')
  const [modal, setModal] = useState<'' | 'products' | 'rule'>('')
  const compact = mode === 'positions'
  useEffect(() => {
    setTab(mode === 'calculation' ? 'Calculation' : 'AI Proposal')
    setNote('')
  }, [mode, p.lv_id])

  const index = rows.findIndex((x) => x.lv_id === p.lv_id)
  const step = (dir: number) => {
    if (!rows.length) return
    const i = index < 0 ? 0 : (index + dir + rows.length) % rows.length
    select(rows[i].lv_id)
  }
  const set = (body: Parameters<typeof override>[1], done: string) => override(p.lv_id, body, done)
  const save = () => {
    if (!note.trim()) return
    addNote(p.lv_id, note.trim())
    setNote('')
  }
  const checks = checksFor(p)
  const history = e.activity.filter((a) => a.lv_id === p.lv_id).reverse()
  const quantity = (
    <label>
      <h4>Quantity</h4>
      <div className="quantity-input">
        <input
          key={`${p.lv_id}-${p.quantity}`}
          aria-label="Quantity"
          type="number"
          min="0"
          step="any"
          defaultValue={p.quantity ?? ''}
          placeholder="missing"
          onBlur={(ev) => {
            const q = ev.target.value === '' ? null : Number(ev.target.value)
            if (q == null || q === p.quantity) return
            if (Number.isFinite(q) && q >= 0) set({ quantity: q }, `${p.lv_id}: quantity set to ${fmtNum(q)} ${unit(p.unit)}.`)
            else ev.target.value = String(p.quantity ?? '')
          }}
          onKeyDown={(ev) => ev.key === 'Enter' && ev.currentTarget.blur()}
        />
        <span>{unit(p.unit)}</span>
      </div>
      {p.extracted_quantity !== p.quantity && (
        <small className="muted">Tender: {p.extracted_quantity == null ? 'not stated' : `${fmtNum(p.extracted_quantity)} ${unit(p.unit)}`}</small>
      )}
    </label>
  )
  const product = (
    <button className="product-selector" onClick={() => setModal('products')}>
      <ProductGraphic fire={isFire(p)} />
      <span>
        <strong>{p.product_id ?? 'No catalogue item'}</strong>
        <small>{p.product_description ?? (p.install_code ? `Labour only (${p.install_code})` : 'Choose a product')}</small>
      </span>
      <ChevronRight size={17} />
    </button>
  )
  const rule = (
    <>
      <h4>Installation rule</h4>
      <button className="installation-rule" onClick={() => setModal('rule')}>
        <HardHat size={37} />
        <span>
          <strong>{p.install_code ?? 'No rule'}</strong>
          <small>{(p.install_code && rules[p.install_code]?.work_type) || 'Installation'}</small>
          <small>
            {fmtNum(p.base_hours_per_unit)} h / {unit(p.unit)} base · {fmtNum(p.adjusted_install_hours)} h total · CHF{' '}
            {fmtNum(p.hourly_rate_chf)}/h
          </small>
        </span>
        <ChevronRight size={18} />
      </button>
    </>
  )

  return (
    <section className={`card detail-panel ${compact ? 'compact' : ''}`}>
      <div className="section-heading">
        <h2>Position {p.lv_id}</h2>
        <div className="inline">
          {rows.length > 0 && (
            <small className="muted">
              {index + 1} of {rows.length}
            </small>
          )}
          <button className="icon-button" aria-label="Previous position" onClick={() => step(-1)}>
            <ChevronLeft size={16} />
          </button>
          <button className="icon-button" aria-label="Next position" onClick={() => step(1)}>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      <div className="detail-status">
        <span title={p.system}>
          {p.system} · {p.section ?? '—'} · p. {p.source_page}
        </span>
        <StatusBadge p={p} />
      </div>
      {!compact && (
        <div className="detail-tabs">
          {tabs.map((t) => (
            <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
              {t}
              {t === 'Alternatives' && ` (${p.alternatives.length})`}
              {t === 'Discussion' && ` (${p.notes.length})`}
            </button>
          ))}
        </div>
      )}

      {tab === 'Alternatives' ? (
        <Alternatives p={p} choose={(id) => set({ product_id: id }, `${p.lv_id}: product ${id} selected, price recalculated.`)} />
      ) : tab === 'Source' ? (
        <>
          <SourceView tenderId={e.tender.id} position={p} pages={e.tender.pages} zoomable />
          <div className="quote">
            <small className="muted">Extracted line</small>
            <code>{p.source_line}</code>
          </div>
        </>
      ) : tab === 'Discussion' ? (
        <div className="notes-history">
          <h3>Notes & comments</h3>
          {p.notes.length ? (
            p.notes.map((n) => (
              <div className="activity-item" key={n.id}>
                <span className="avatar tiny">{initials(n.author)}</span>
                <p>
                  {n.text}
                  <small>
                    {n.author ? `${n.author} · ` : ''}
                    {fmtWhen(n.at)}
                  </small>
                </p>
                <button className="icon-button" aria-label="Delete note" onClick={() => deleteNote(p.lv_id, n.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          ) : (
            <p className="muted">No notes yet. Add your check below.</p>
          )}
        </div>
      ) : tab === 'History' ? (
        <div className="notes-history">
          <h3>Position history</h3>
          {history.length ? history.map((a, i) => <ActivityItem key={i} a={a} />) : <p className="muted">No changes since the import.</p>}
          <p className="notice subtle">
            Proposal: {p.match_kind} match · {p.overridden.length ? `edited: ${p.overridden.join(', ')}` : 'not edited'}
          </p>
        </div>
      ) : tab === 'Technical' ? (
        <>
          <h3>Extracted from the tender</h3>
          <Technical p={p} />
        </>
      ) : (
        <>
          {mode !== 'calculation' && (
            <div className="description-block">
              <div>
                <h4>Description</h4>
                <p>
                  <b>{p.title}</b>
                  {p.variant && ` · ${p.variant}`}
                </p>
                {p.description && p.description !== p.title && <p className="clamp">{p.description}</p>}
              </div>
              <Ring value={Math.round(p.match_confidence * 100)} size={compact ? 82 : 88} label="Match confidence" />
            </div>
          )}
          {mode === 'calculation' && (
            <button className="product-selector large" onClick={() => setModal('products')}>
              <ProductGraphic fire={isFire(p)} />
              <span>
                <strong>{p.product_id ?? 'No catalogue item'}</strong>
                <span>{p.product_description ?? p.title}</span>
                <small>{p.price_source?.replace(/_/g, ' ')}</small>
                <span className="text-link">
                  Change product <ArrowRight size={14} />
                </span>
              </span>
            </button>
          )}
          <div className="quantity-product">
            {quantity}
            <div>
              {mode === 'calculation' ? (
                <UnitCost p={p} onSave={(v) => set({ net_unit_cost_chf: v }, `${p.lv_id}: unit cost set to CHF ${money(v, 2)}.`)} />
              ) : (
                <>
                  <h4>Selected product</h4>
                  {product}
                </>
              )}
            </div>
          </div>
          {rule}
          {mode === 'calculation' ? (
            <>
              <div className="calc-embedded">
                <CostPanel p={p} heading={false} />
              </div>
              <div className="confidence-card">
                <Ring value={Math.round(p.match_confidence * 100)} size={80} label="Match" />
                <div>
                  <h3>{p.match_confidence >= 0.85 ? 'High confidence' : p.match_confidence >= 0.6 ? 'Check the match' : 'Low confidence'}</h3>
                  <p>{p.assumptions[0] ?? 'Exact catalogue item and installation rule for this description.'}</p>
                  <button className="text-button" onClick={() => setTab('Alternatives')}>
                    View alternatives <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            </>
          ) : !compact ? (
            <div className="technical-grid">
              <section>
                <h4>AI extracted values</h4>
                <small>From the tender, page {p.source_page}</small>
                <Technical p={p} short />
              </section>
              <section>
                <div className="section-heading">
                  <h4>Matched product</h4>
                  <button className="text-button" onClick={() => setModal('products')}>
                    Edit match
                  </button>
                </div>
                <ProductGraphic fire={isFire(p)} />
                <ProductFacts id={p.product_id} />
              </section>
            </div>
          ) : null}
          {checks.length > 0 && (
            <div className={`validation ${checks.some((c) => c.level === 'warning') ? '' : 'calm'}`}>
              <h4>
                <AlertTriangle size={15} /> Validation checks
              </h4>
              {checks.map((c, i) => (
                <div key={i}>
                  {c.level === 'warning' ? <AlertTriangle size={14} /> : <Info size={14} />}
                  <span>{c.text}</span>
                </div>
              ))}
            </div>
          )}
          {mode !== 'calculation' && (
            <label className="status-select">
              <h4>Status</h4>
              <select
                value={p.status}
                onChange={(ev) => set({ status: ev.target.value as Status }, `${p.lv_id}: status set to ${STATUS_META[ev.target.value as Status].label}.`)}
              >
                {STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_META[s].label}
                  </option>
                ))}
              </select>
            </label>
          )}
        </>
      )}

      <div className="notes-input">
        <label htmlFor={`note-${mode}`}>
          <h4>
            Notes & comments <small>({p.notes.length})</small>
          </h4>
        </label>
        {compact && p.notes.length > 0 && <p className="last-note">“{p.notes[p.notes.length - 1].text}”</p>}
        <div className="inline">
          <span className="avatar tiny">{initials(e.tender.meta.estimator)}</span>
          <input
            id={`note-${mode}`}
            value={note}
            placeholder="Add a comment or note…"
            onChange={(ev) => setNote(ev.target.value)}
            onKeyDown={(ev) => ev.key === 'Enter' && save()}
          />
          <button className="icon-button" disabled={!note.trim()} aria-label="Save note" onClick={save}>
            <Send size={16} />
          </button>
        </div>
      </div>
      <div className="detail-actions">
        {p.reviewed ? (
          <>
            <div className="approved-message">
              <CheckCircle2 size={16} /> Position approved
            </div>
            <Button disabled={!!busy} onClick={() => set({ reviewed: false }, `${p.lv_id} reopened.`)}>
              Reopen position
            </Button>
          </>
        ) : (
          <>
            {p.status !== 'supplier_quote_required' && (
              <Button disabled={!!busy} onClick={() => set({ status: 'supplier_quote_required' }, `${p.lv_id} added to the supplier RFQs.`)}>
                <MessageSquare size={14} /> Request quote
              </Button>
            )}
            {p.overridden.length > 0 && (
              <Button disabled={!!busy} onClick={() => set({ reset: true }, `${p.lv_id} reset to the proposal.`)}>
                <RotateCcw size={14} /> Reset to proposal
              </Button>
            )}
            <Button
              primary
              disabled={!!busy || p.quantity == null}
              title={p.quantity == null ? 'Enter a quantity first' : undefined}
              onClick={() => {
                set({ reviewed: true }, `${p.lv_id} approved.`)
                const next = rows.slice(index + 1).find((x) => !x.reviewed)
                if (next && mode === 'review') select(next.lv_id)
              }}
            >
              <Check size={16} /> Approve position
            </Button>
            {!needsDecision(p) && p.status !== 'review_required' && (
              <button className="text-button" onClick={() => set({ status: 'review_required' }, `${p.lv_id} marked for review.`)}>
                Mark for review
              </button>
            )}
          </>
        )}
      </div>
      {modal === 'products' && (
        <ProductModal
          p={p}
          close={() => setModal('')}
          choose={(id) => {
            set({ product_id: id }, `${p.lv_id}: product ${id} selected, price recalculated.`)
            setModal('')
          }}
        />
      )}
      {modal === 'rule' && (
        <RuleModal
          p={p}
          close={() => setModal('')}
          save={(b) => {
            set(b, `${p.lv_id}: installation recalculated.`)
            setModal('')
          }}
        />
      )}
    </section>
  )
}

function useDetailActions() {
  const { override, select, addNote, deleteNote } = useStore()
  const e = useEstimate()
  const checksFor = (p: Position) => {
    const out: { level: 'warning' | 'info'; text: string }[] = []
    if (p.quantity == null) out.push({ level: 'warning', text: 'No quantity in the tender: enter one before approving.' })
    p.assumptions.forEach((a) => out.push({ level: needsDecision(p) ? 'warning' : 'info', text: a }))
    e.checks
      .filter((c) => c.level !== 'ok' && c.positions.includes(p.lv_id))
      .forEach((c) => out.push({ level: c.level === 'warning' ? 'warning' : 'info', text: `${c.title}: ${c.detail}` }))
    if (p.status === 'supplier_quote_required') out.push({ level: 'info', text: 'Benchmark price until the supplier quote arrives.' })
    return out
  }
  return { override, select, addNote, deleteNote, checksFor }
}

function UnitCost({ p, onSave }: { p: Position; onSave: (v: number) => void }) {
  return (
    <label>
      <h4>Net unit cost (CHF)</h4>
      <div className="quantity-input">
        <input
          key={`${p.lv_id}-${p.net_unit_cost_chf}`}
          aria-label="Net unit cost"
          type="number"
          min="0"
          step="any"
          defaultValue={p.net_unit_cost_chf ?? ''}
          placeholder="no price"
          onBlur={(ev) => {
            const v = Number(ev.target.value)
            if (ev.target.value !== '' && Number.isFinite(v) && v >= 0 && v !== p.net_unit_cost_chf) onSave(v)
          }}
          onKeyDown={(ev) => ev.key === 'Enter' && ev.currentTarget.blur()}
        />
        <span>/{unit(p.unit)}</span>
      </div>
      <small className="muted">Unit price incl. labour: CHF {p.quantity ? money(p.direct_position_cost_chf / p.quantity, 2) : '—'}</small>
    </label>
  )
}

function ProductFacts({ id }: { id: string | null }) {
  const item = useStore((s) => s.catalog.find((c) => c.product_id === id))
  if (!item) return <p className="muted">No catalogue item: labour only or supplier price.</p>
  return (
    <dl>
      {[
        ['Manufacturer', item.manufacturer],
        ['Model', item.model],
        ['Category', `${item.category} · ${item.subcategory}`],
        ['List price', `CHF ${money(Number(item.list_price_chf), 2)} − ${item.discount_pct}%`],
        ['Net cost', `CHF ${money(item.net_cost_chf, 2)} / ${unit(item.unit)}`],
      ].map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  )
}

export function Technical({ p, short = false }: { p: Position; short?: boolean }) {
  const rows: [string, string][] = [
    ['Position type', p.title],
    ...(p.variant ? [['Variant', p.variant] as [string, string]] : []),
    ...Object.entries(p.attributes).map(([k, v]) => [k, String(v)] as [string, string]),
    ['Quantity in tender', p.extracted_quantity == null ? 'not stated' : `${fmtNum(p.extracted_quantity)} ${unit(p.unit)}`],
    ['System', p.system],
    ['Section', p.section ?? '—'],
    ...(p.airflow_m3h ? [['Airflow', `${fmtNum(p.airflow_m3h)} m³/h`] as [string, string]] : []),
    ['Source', `page ${p.source_pages.join(', ')}`],
  ]
  return (
    <>
      <dl>
        {(short ? rows.slice(0, 6) : rows).map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      {!short && p.components.length > 0 && (
        <details className="components">
          <summary>{p.components.length} sub-components included in this unit</summary>
          <ul>
            {p.components.map((c, i) => (
              <li key={i}>
                {c.text} · {fmtNum(c.quantity)} {unit(c.unit)} (p. {c.source_page})
              </li>
            ))}
          </ul>
        </details>
      )}
      {!short && (
        <div className="quote">
          <small className="muted">Extracted line</small>
          <code>{p.source_line}</code>
        </div>
      )}
    </>
  )
}

function Alternatives({ p, choose }: { p: Position; choose: (id: string) => void }) {
  return (
    <div className="alternatives">
      <h3>Technically comparable products</h3>
      <p className="muted">From the reference catalogue. Confirm technical suitability before switching.</p>
      {!p.alternatives.length && <p className="muted">No alternative in the catalogue for this position.</p>}
      {p.alternatives.map((a) => (
        <button className="alternative" key={a.product_id} onClick={() => choose(a.product_id)}>
          <ProductGraphic fire={isFire(a)} />
          <span>
            <strong>{a.product_id}</strong>
            <small>{a.description}</small>
            <small>
              {a.reason}
              {a.supplier_quote_required && ' · supplier quote'}
            </small>
          </span>
          <b>
            CHF {money(a.net_unit_cost_chf, 2)}
            <small className={a.material_delta_chf > 0 ? 'up' : 'down'}>
              {a.material_delta_chf > 0 ? '+' : '−'}
              {fmtChf(Math.abs(a.material_delta_chf))} material
            </small>
          </b>
        </button>
      ))}
    </div>
  )
}

function ProductModal({ p, close, choose }: { p: Position; close: () => void; choose: (id: string) => void }) {
  const catalog = useStore((s) => s.catalog)
  const [q, setQ] = useState('')
  const same = catalog.filter((c) => c.install_code === p.install_code && c.product_id !== p.product_id)
  const query = q.trim().toLowerCase()
  const found = query
    ? catalog.filter((c) => `${c.product_id} ${c.description} ${c.manufacturer} ${c.model} ${c.category}`.toLowerCase().includes(query))
    : []
  const current = catalog.find((c) => c.product_id === p.product_id)
  const row = (c: (typeof catalog)[number], note?: string) => (
    <button key={c.product_id} className={`alternative ${c.product_id === p.product_id ? 'active' : ''}`} onClick={() => choose(c.product_id)}>
      <ProductGraphic fire={isFire(c)} />
      <span>
        <strong>
          {c.product_id} · {c.manufacturer} {c.model}
        </strong>
        <small>{c.description}</small>
        <small>{note ?? `${c.category} · rule ${c.install_code}`}</small>
      </span>
      <b>
        CHF {money(c.net_cost_chf, 2)}
        <small>/{unit(c.unit)}</small>
        {c.product_id === p.product_id && <Check size={16} />}
      </b>
    </button>
  )
  return (
    <Modal title={`Product matching · ${p.lv_id}`} close={close} wide>
      <p className="muted">
        {p.title}
        {p.variant && ` · ${p.variant}`}. Material and installation time are recalculated as soon as you pick a product.
      </p>
      <label className="search-field">
        <Search size={15} />
        <input autoFocus placeholder="Search the catalogue…" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      <div className="product-list">
        {query ? (
          found.length ? found.map((c) => row(c)) : <p className="muted">No catalogue item matches “{q}”.</p>
        ) : (
          <>
            {current && <h4>Current proposal</h4>}
            {current && row(current, p.assumptions[0] ?? 'Proposed by the matcher')}
            {p.alternatives.length > 0 && <h4>Suggested alternatives</h4>}
            {p.alternatives.map((a) => {
              const c = catalog.find((x) => x.product_id === a.product_id)
              return c ? row(c, `${a.reason} · ${a.material_delta_chf > 0 ? '+' : '−'}${fmtChf(Math.abs(a.material_delta_chf))} material`) : null
            })}
            {same.length > 0 && <h4>Same installation rule</h4>}
            {same.filter((c) => !p.alternatives.some((a) => a.product_id === c.product_id)).map((c) => row(c))}
          </>
        )}
      </div>
    </Modal>
  )
}

function RuleModal({
  p,
  close,
  save,
}: {
  p: Position
  close: () => void
  save: (b: { base_hours_per_unit?: number; hourly_rate_chf?: number }) => void
}) {
  const e = useEstimate()
  const rule = useStore((s) => (p.install_code ? s.rules[p.install_code] : undefined))
  const [hours, setHours] = useState(String(p.base_hours_per_unit ?? ''))
  const [rate, setRate] = useState(String(p.hourly_rate_chf ?? ''))
  const factors = e.parameters.productivity_factors
  return (
    <Modal title={`Installation rule · ${p.install_code ?? '—'}`} close={close}>
      <div className="installation-rule">
        <HardHat size={48} />
        <div>
          <h3>{rule?.work_type ?? 'Installation'}</h3>
          <p>
            {fmtNum(rule?.base_hours_per_unit)} h per {unit(rule?.unit ?? p.unit)} · {rule?.labour_role ?? 'installer'} · CHF{' '}
            {fmtNum(rule?.default_hourly_rate_chf)}/h (reference)
          </p>
        </div>
      </div>
      <table className="rule-table">
        <tbody>
          <tr>
            <td>Base hours × quantity</td>
            <td className="num">
              {fmtNum(p.base_hours_per_unit)} × {fmtNum(p.quantity)}
            </td>
          </tr>
          {p.factors_applied.map((f) => (
            <tr key={f}>
              <td>{FACTOR_LABEL[f] ?? f}</td>
              <td className="num">{f === 'site_efficiency' ? `÷ ${factors[f]}` : `× ${factors[f]}`}</td>
            </tr>
          ))}
          <tr className="total">
            <td>Installation hours</td>
            <td className="num">{fmtNum(p.adjusted_install_hours)} h</td>
          </tr>
        </tbody>
      </table>
      <div className="form-row">
        <label>
          <span>Base hours / unit</span>
          <input type="number" step="0.05" value={hours} onChange={(ev) => setHours(ev.target.value)} />
        </label>
        <label>
          <span>Hourly rate (CHF)</span>
          <input type="number" value={rate} onChange={(ev) => setRate(ev.target.value)} />
        </label>
      </div>
      <div className="notice subtle">
        <ShieldCheck size={16} /> Factors are project parameters; change them for all positions under Calculation → Project build-up.
      </div>
      <div className="modal-actions">
        <Button onClick={close}>Cancel</Button>
        <Button
          primary
          onClick={() => {
            const b: { base_hours_per_unit?: number; hourly_rate_chf?: number } = {}
            if (hours !== '' && Number(hours) !== p.base_hours_per_unit) b.base_hours_per_unit = Number(hours)
            if (rate !== '' && Number(rate) !== p.hourly_rate_chf) b.hourly_rate_chf = Number(rate)
            if (Object.keys(b).length) save(b)
            else close()
          }}
        >
          Apply
        </Button>
      </div>
    </Modal>
  )
}
