import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Copy, Download, FileSpreadsheet, Mail, PackageSearch, RefreshCw } from 'lucide-react'
import { api } from '../api'
import { positionLabel } from '../derive'
import { fmtChf, fmtNum, unit } from '../format'
import { useEstimate, useStore } from '../store'
import type { Position, SupplierDraft, SupplierItem } from '../types'
import { SheetCard, SheetUpload } from '../components/Sheets'
import { Split } from '../components/Split'
import { SourceLine } from '../components/Trace'
import { Button, Empty } from '../components/ui'

type Show = 'open' | 'received' | 'all'

const received = (p: Position) => !!p.price_sheet

/**
 * Supplier work: the positions still missing a price, grouped by package. Tick the ones to ask for, prepare the
 * request mail on the right, and read prices from the product sheets suppliers send back.
 */
export function Supplier() {
  const e = useEstimate()
  const { category, search, select, selected, notify } = useStore()
  const [items, setItems] = useState<SupplierItem[] | null>(null)
  const [error, setError] = useState('')
  const [ticked, setTicked] = useState<Set<string>>(new Set())
  const [show, setShow] = useState<Show>('open')
  useEffect(() => {
    api
      .supplierItems(e.tender.id)
      .then(setItems)
      .catch((err) => setError((err as Error).message))
  }, [e])
  const byId = useMemo(() => new Map(e.positions.map((p) => [p.lv_id, p])), [e])
  const q = search.trim().toLowerCase()
  const rows = (items ?? [])
    .map((i) => ({ ...i, p: byId.get(i.lv_id)! }))
    .filter(({ p }) => p)
    .filter(({ p }) => show === 'all' || (show === 'received' ? received(p) : !received(p)))
    .filter(({ p }) => category === 'all' || p.category === category)
    .filter(({ p }) => !q || `${p.lv_id} ${p.title} ${p.variant} ${p.system}`.toLowerCase().includes(q))
  const groups = [...new Set(rows.map((r) => r.package_title))].map((title) => ({
    title,
    rows: rows.filter((r) => r.package_title === title),
  }))
  const toggle = (ids: string[], on: boolean) =>
    setTicked((t) => {
      const n = new Set(t)
      ids.forEach((id) => (on ? n.add(id) : n.delete(id)))
      return n
    })
  const chosen = e.positions.filter((p) => ticked.has(p.lv_id))
  const focus = byId.get(selected ?? '')
  const open = (items ?? []).filter((i) => byId.get(i.lv_id) && !received(byId.get(i.lv_id)!)).length

  return (
    <Split
      className="supplier-layout"
      left={
        <section className="card supplier-list">
          <div className="section-heading">
            <div className="inline">
              <h2>Supplier</h2>
              <span className="subtitle">{open} positions still need a supplier price</span>
            </div>
          </div>
          <div className="filter-pills">
            {(
              [
                ['open', 'Missing price'],
                ['received', 'Priced from a sheet'],
                ['all', 'All'],
              ] as const
            ).map(([k, label]) => (
              <button key={k} className={show === k ? 'active' : ''} onClick={() => setShow(k)}>
                {label}
              </button>
            ))}
          </div>
          <div className="supplier-select-bar">
            <label className="check-field">
              <input
                type="checkbox"
                checked={rows.length > 0 && rows.every((r) => ticked.has(r.lv_id))}
                onChange={(ev) =>
                  toggle(
                    rows.map((r) => r.lv_id),
                    ev.target.checked,
                  )
                }
              />
              Select all shown ({rows.length})
            </label>
            {ticked.size > 0 && (
              <button className="text-button" onClick={() => setTicked(new Set())}>
                Clear {ticked.size} selected
              </button>
            )}
          </div>
          {error && <div className="notice">{error}</div>}
          {!items && !error && (
            <div className="loading-state">
              <span className="spinner" /> Collecting the missing items…
            </div>
          )}
          {items && !rows.length && (
            <Empty icon={<CheckCircle2 size={28} />} title="Nothing here">
              {show === 'open' ? 'Every position has a price.' : 'No position matches the filters.'}
            </Empty>
          )}
          {groups.map((g) => (
            <div className="supplier-group" key={g.title}>
              <label className="supplier-group-head">
                <input
                  type="checkbox"
                  checked={g.rows.every((r) => ticked.has(r.lv_id))}
                  onChange={(ev) =>
                    toggle(
                      g.rows.map((r) => r.lv_id),
                      ev.target.checked,
                    )
                  }
                />
                <strong>{g.title}</strong>
                <span>{g.rows.length}</span>
              </label>
              {g.rows.map(({ p }) => (
                <div
                  key={p.lv_id}
                  className={`supplier-row ${p.lv_id === focus?.lv_id ? 'active' : ''}`}
                  onClick={() => select(p.lv_id)}
                >
                  <input
                    type="checkbox"
                    aria-label={`Select ${p.lv_id}`}
                    checked={ticked.has(p.lv_id)}
                    onClick={(ev) => ev.stopPropagation()}
                    onChange={(ev) => toggle([p.lv_id], ev.target.checked)}
                  />
                  <span className="lv">{p.lv_id}</span>
                  <span className="text">
                    <strong>{positionLabel(p)}</strong>
                    <small>
                      {p.system.split(' ')[0]} · p. {p.source_page}
                      {p.sheets.length > 0 && ` · ${p.sheets.length} sheet${p.sheets.length > 1 ? 's' : ''}`}
                    </small>
                  </span>
                  <span className="qty">
                    {fmtNum(p.quantity)} {unit(p.unit)}
                  </span>
                  <span className={`supplier-state ${received(p) ? 'ok' : p.net_unit_cost_chf == null ? 'missing' : 'budget'}`}>
                    {received(p) ? 'From sheet' : p.net_unit_cost_chf == null ? 'No price' : 'Budget'}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </section>
      }
      right={
        <section className="card supplier-detail">
          <MailDraft chosen={chosen} notify={notify} />
          <h3 className="supplier-section-title">{chosen.length ? `Selected positions (${chosen.length})` : 'Position'}</h3>
          {(chosen.length ? chosen.slice(0, 6) : focus ? [focus] : []).map((p) => (
            <PositionFacts key={p.lv_id} p={p} />
          ))}
          {chosen.length > 6 && <small className="muted">+ {chosen.length - 6} more in the request</small>}
          {!chosen.length && !focus && <p className="muted">Tick positions on the left to prepare a request.</p>}
          <h3 className="supplier-section-title">Product sheets</h3>
          <SheetUpload
            lvIds={chosen.length ? chosen.map((p) => p.lv_id) : focus ? [focus.lv_id] : []}
            label="Upload product sheets from the supplier"
          />
          <SheetsFor positions={chosen.length ? chosen : focus ? [focus] : []} />
        </section>
      }
    />
  )
}

function MailDraft({ chosen, notify }: { chosen: Position[]; notify: (s: string) => void }) {
  const e = useEstimate()
  const [supplier, setSupplier] = useState('')
  const [contact, setContact] = useState('')
  const [email, setEmail] = useState('')
  const [draft, setDraft] = useState<SupplierDraft | null>(null)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [edited, setEdited] = useState(false)
  const ids = chosen.map((p) => p.lv_id)
  const key = ids.join(',')
  const makers = useMemo(() => {
    const m = new Set<string>()
    e.sheets.forEach((s) => s.supplier && m.add(s.supplier))
    chosen.forEach((p) => p.attributes.Fabrikat && m.add(String(p.attributes.Fabrikat)))
    return [...m]
  }, [e, chosen])
  const build = () => {
    if (!ids.length) {
      setDraft(null)
      return
    }
    api
      .supplierDraft(e.tender.id, ids, supplier, contact)
      .then((d) => {
        setDraft(d)
        setSubject(d.subject)
        setBody(d.text)
        setEdited(false)
      })
      .catch((err) => notify((err as Error).message))
  }
  useEffect(() => {
    if (!edited) build()
    // the text follows the selection and the supplier until the estimator edits it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, supplier, contact])
  const budget = chosen.reduce((s, p) => s + p.material_cost_chf, 0)
  const mailto = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  return (
    <div className="mail-draft">
      <div className="section-heading">
        <h2>
          <Mail size={18} /> Request to a supplier
        </h2>
        {draft && <small className="muted">Internal budget {budget ? fmtChf(budget) : 'none'} · not in the mail</small>}
      </div>
      <div className="mail-fields">
        <label>
          <span>Supplier</span>
          <input
            list="supplier-names"
            value={supplier}
            placeholder="e.g. Trox Hesco"
            onChange={(ev) => setSupplier(ev.target.value)}
          />
          <datalist id="supplier-names">
            {makers.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </label>
        <label>
          <span>Contact</span>
          <input value={contact} placeholder="Name" onChange={(ev) => setContact(ev.target.value)} />
        </label>
        <label>
          <span>E-mail</span>
          <input type="email" value={email} placeholder="sales@supplier.ch" onChange={(ev) => setEmail(ev.target.value)} />
        </label>
      </div>
      {!ids.length ? (
        <Empty icon={<PackageSearch size={28} />} title="No position selected">
          Tick the missing items on the left; the request lists them with quantity, system and tender page.
        </Empty>
      ) : (
        <>
          <label className="mail-subject">
            <span>Subject</span>
            <input
              value={subject}
              onChange={(ev) => {
                setSubject(ev.target.value)
                setEdited(true)
              }}
            />
          </label>
          <textarea
            className="mail-body"
            aria-label="Mail text"
            value={body}
            rows={12}
            onChange={(ev) => {
              setBody(ev.target.value)
              setEdited(true)
            }}
          />
          <div className="mail-actions">
            <a className="button primary small" href={mailto}>
              <Mail size={14} /> Open in mail app
            </a>
            <Button
              className="small"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(`${subject}\n\n${body}`)
                  notify('Request copied.')
                } catch {
                  notify('Select the text and copy it.')
                }
              }}
            >
              <Copy size={14} /> Copy
            </Button>
            <a className="button small" href={api.supplierDraftUrl(e.tender.id, ids, supplier)} download>
              <FileSpreadsheet size={14} /> Item list (Excel)
            </a>
            {edited && (
              <button className="text-button" onClick={build}>
                <RefreshCw size={13} /> Rebuild text
              </button>
            )}
          </div>
          {draft && (
            <small className="muted">
              Attach the item list. Tender pages {draft.pages.join(', ')} ·{' '}
              <a href={api.tenderPdfUrl(e.tender.id)} target="_blank" rel="noreferrer">
                open the tender
              </a>
            </small>
          )}
        </>
      )}
    </div>
  )
}

function PositionFacts({ p }: { p: Position }) {
  const attrs = Object.entries(p.attributes).filter(([k]) => ['Fabrikat', 'Typ', 'Grösse', 'Luftmenge', 'Material'].includes(k))
  return (
    <div className="supplier-position">
      <div>
        <strong>
          {p.lv_id} {positionLabel(p)}
        </strong>
        <small>
          {fmtNum(p.quantity)} {unit(p.unit)} · {p.system} · p. {p.source_page}
        </small>
        {attrs.length > 0 && <small>{attrs.map(([k, v]) => `${k}: ${v}`).join(' · ')}</small>}
      </div>
      <div className="num">
        <strong>{p.net_unit_cost_chf == null ? 'No price' : fmtChf(p.net_unit_cost_chf, true)}</strong>
        <SourceLine trace={p.trace.net_unit_cost_chf} />
      </div>
    </div>
  )
}

function SheetsFor({ positions }: { positions: Position[] }) {
  const e = useEstimate()
  const ids = new Set(positions.map((p) => p.lv_id))
  const sheets = e.sheets.filter((s) => s.lv_ids.some((i) => ids.has(i)))
  const rest = e.sheets.filter((s) => !sheets.includes(s))
  return (
    <>
      {sheets.map((s) => (
        <SheetCard key={s.id} sheet={s} targets={positions.filter((p) => s.lv_ids.includes(p.lv_id))} />
      ))}
      {rest.length > 0 && (
        <details className="other-sheets">
          <summary>
            <Download size={13} /> Other sheets of this tender ({rest.length})
          </summary>
          {rest.map((s) => (
            <SheetCard key={s.id} sheet={s} targets={positions} />
          ))}
        </details>
      )}
    </>
  )
}
