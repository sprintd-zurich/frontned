import { useState } from 'react'
import { BookLock, ChevronRight, Database, Lock, Plus, Trash2, Upload } from 'lucide-react'
import { fmtChf } from '../format'
import { useEstimate, useStore } from '../store'
import type { Dataset, Quote } from '../types'
import { Button, Modal } from './ui'

/** The price book this tender is pinned to, with a way to switch it. */
export function PriceBookBadge() {
  const e = useEstimate()
  const [open, setOpen] = useState(false)
  const d = e.dataset

  return (
    <>
      <button className="pricebook-badge" onClick={() => setOpen(true)} title="Change the price book for this tender">
        <Database size={15} />
        <span>
          <small>PRICE BOOK</small>
          <b>
            {d.name} <em>v{d.version}</em>
          </b>
        </span>
        {(d.location || d.region) && <span className="pricebook-region">{d.location || d.region}</span>}
        {d.version < d.latest_version && <span className="pricebook-stale">v{d.latest_version} available</span>}
        <ChevronRight size={15} />
      </button>
      {open && <PriceBookModal close={() => setOpen(false)} />}
    </>
  )
}

function PriceBookModal({ close }: { close: () => void }) {
  const e = useEstimate()
  const { datasets, setDataset, createDataset, deleteDataset, busy } = useStore()
  const [creating, setCreating] = useState(false)

  return (
    <Modal title="Price book for this tender" close={close} wide>
      <div className="pricebook-list">
        {datasets.map((d) => (
          <DatasetCard
            key={d.id}
            d={d}
            active={d.id === e.dataset.id}
            activeVersion={d.id === e.dataset.id ? e.dataset.version : null}
            onPick={(version) => setDataset(d.id, version).then(close)}
            onDelete={() => deleteDataset(d.id)}
            busy={!!busy}
          />
        ))}
      </div>
      {creating ? (
        <NewBookForm
          datasets={datasets}
          onCancel={() => setCreating(false)}
          onCreate={async (body) => {
            await createDataset(body)
            setCreating(false)
          }}
        />
      ) : (
        <Button onClick={() => setCreating(true)}>
          <Plus size={15} /> Derive a regional price book
        </Button>
      )}
    </Modal>
  )
}

function DatasetCard({
  d,
  active,
  activeVersion,
  onPick,
  onDelete,
  busy,
}: {
  d: Dataset
  active: boolean
  activeVersion: number | null
  onPick: (version?: number) => void
  onDelete: () => void
  busy: boolean
}) {
  return (
    <section className={`pricebook-card ${active ? 'active' : ''}`}>
      <div className="pricebook-card-head">
        <div className="pricebook-card-title">
          <h4>
            {d.name}
            {d.immutable && (
              <span title="Shipped reference data; cannot be edited">
                <Lock size={13} />
              </span>
            )}
          </h4>
          <small className="muted">
            {[d.country, d.location || d.region_label].filter(Boolean).join(' · ') || 'No location set'}
          </small>
        </div>
        <div className="pricebook-card-controls">
          {active ? (
            <span className="pricebook-current">In use · v{activeVersion}</span>
          ) : (
            <Button primary disabled={busy} onClick={() => onPick()}>
              Use v{d.latest_version}
            </Button>
          )}
          {!d.immutable && (
            <button className="icon-button danger" onClick={onDelete} title="Remove this price book">
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>
    </section>
  )
}

function NewBookForm({
  datasets,
  onCreate,
  onCancel,
}: {
  datasets: Dataset[]
  onCreate: (b: {
    name: string
    clone_of: string
    region: string
    region_label: string
    country: string
    location: string
    material_factor_pct: number
    labour_factor_pct: number
  }) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [cloneOf, setCloneOf] = useState(datasets[0]?.id ?? '')
  const [region, setRegion] = useState('')
  const [regionLabel, setRegionLabel] = useState('')
  const [country, setCountry] = useState('Switzerland')
  const [location, setLocation] = useState('')
  const [material, setMaterial] = useState('0')
  const [labour, setLabour] = useState('0')

  return (
    <form
      className="pricebook-form"
      onSubmit={(ev) => {
        ev.preventDefault()
        if (!name.trim()) return
        onCreate({
          name: name.trim(),
          clone_of: cloneOf,
          region: region.trim(),
          region_label: regionLabel.trim(),
          country: country.trim(),
          location: location.trim(),
          material_factor_pct: Number(material) || 0,
          labour_factor_pct: Number(labour) || 0,
        })
      }}
    >
      <h4>
        <Upload size={15} /> Derive a new price book
      </h4>
      <p className="muted">
        Every net cost and hourly rate is copied and shifted by the percentages below. The derivation is recorded on the
        book, so the figures never look independently sourced.
      </p>
      <div className="pricebook-form-grid">
        <label>
          Name
          <input value={name} onChange={(ev) => setName(ev.target.value)} placeholder="Equans Romandie 2026" required />
        </label>
        <label>
          Copy from
          <select value={cloneOf} onChange={(ev) => setCloneOf(ev.target.value)}>
            {datasets.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} (v{d.latest_version})
              </option>
            ))}
          </select>
        </label>
        <label>
          Country
          <input value={country} onChange={(ev) => setCountry(ev.target.value)} placeholder="Switzerland" />
        </label>
        <label>
          Location
          <input value={location} onChange={(ev) => setLocation(ev.target.value)} placeholder="Zurich / Oberglatt" />
        </label>
        <label>
          Region code
          <input value={region} onChange={(ev) => setRegion(ev.target.value)} placeholder="CH-VD" />
        </label>
        <label>
          Region name
          <input value={regionLabel} onChange={(ev) => setRegionLabel(ev.target.value)} placeholder="Romandie / Lausanne" />
        </label>
        <label>
          Material %
          <input type="number" step="0.1" value={material} onChange={(ev) => setMaterial(ev.target.value)} />
        </label>
        <label>
          Labour rates %
          <input type="number" step="0.1" value={labour} onChange={(ev) => setLabour(ev.target.value)} />
        </label>
      </div>
      <div className="pricebook-form-actions">
        <Button primary type="submit">
          Create price book
        </Button>
        <Button onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  )
}

/**
 * Record a supplier price for this tender.
 *
 * The quote beats the price book but loses to an explicit override, and it settles the position:
 * a line that was waiting for a supplier price becomes calculated.
 */
export function QuoteForm({
  productId,
  lvId,
  bookCost,
  onDone,
}: {
  productId?: string | null
  lvId?: string | null
  bookCost?: number | null
  onDone?: () => void
}) {
  const e = useEstimate()
  const { addQuote, busy } = useStore()
  const [price, setPrice] = useState('')
  const [supplier, setSupplier] = useState('')
  const [reference, setReference] = useState('')
  const [quotedAt, setQuotedAt] = useState(new Date().toISOString().slice(0, 10))
  const [validUntil, setValidUntil] = useState('')
  const [note, setNote] = useState('')

  const value = Number(price)
  const delta = bookCost != null && value > 0 ? value - bookCost : null

  return (
    <form
      className="quote-form"
      onSubmit={async (ev) => {
        ev.preventDefault()
        if (!(value > 0) || !supplier.trim()) return
        await addQuote({
          net_cost_chf: value,
          supplier: supplier.trim(),
          product_id: productId ?? null,
          lv_id: productId ? null : (lvId ?? null),
          reference: reference.trim(),
          quoted_at: quotedAt,
          valid_until: validUntil,
          note: note.trim(),
          entered_by: e.tender.meta.estimator || null,
        })
        setPrice('')
        setSupplier('')
        setReference('')
        onDone?.()
      }}
    >
      <div className="quote-form-grid">
        <label>
          Quoted net price (CHF{productId ? ' / unit' : ''})
          <input type="number" step="0.01" min="0" value={price} onChange={(ev) => setPrice(ev.target.value)} required />
        </label>
        <label>
          Supplier
          <input value={supplier} onChange={(ev) => setSupplier(ev.target.value)} placeholder="Trox Hesco" required />
        </label>
        <label>
          Quote reference
          <input value={reference} onChange={(ev) => setReference(ev.target.value)} placeholder="Q-4471" />
        </label>
        <label>
          Quoted on
          <input type="date" value={quotedAt} onChange={(ev) => setQuotedAt(ev.target.value)} />
        </label>
        <label>
          Valid until
          <input type="date" value={validUntil} onChange={(ev) => setValidUntil(ev.target.value)} />
        </label>
        <label className="wide">
          Note
          <input value={note} onChange={(ev) => setNote(ev.target.value)} placeholder="incl. flanges, excl. delivery" />
        </label>
      </div>
      {delta != null && (
        <p className={`quote-delta ${delta < 0 ? 'good' : 'bad'}`}>
          {fmtChf(Math.abs(delta), true)} {delta < 0 ? 'below' : 'above'} the price book ({fmtChf(bookCost!, true)})
        </p>
      )}
      <Button primary type="submit" disabled={!!busy || !(value > 0) || !supplier.trim()}>
        Apply quote
      </Button>
    </form>
  )
}

/** Quotes recorded on this tender, with the option to publish one into a price book. */
export function QuoteList({ quotes }: { quotes: Quote[] }) {
  const { datasets, deleteQuote, promoteQuote, busy } = useStore()
  const e = useEstimate()
  const writable = datasets.filter((d) => !d.immutable)

  if (!quotes.length) return null
  return (
    <div className="quote-list">
      {quotes.map((q) => {
        const delta = q.book_cost_chf != null ? q.net_cost_chf - q.book_cost_chf : null
        return (
          <div key={q.id} className="quote-row">
            <div className="quote-row-main">
              <b>
                {fmtChf(q.net_cost_chf, true)} · {q.supplier}
              </b>
              <small className="muted">
                {q.product_id ?? q.lv_id}
                {q.reference ? ` · ${q.reference}` : ''}
                {q.quoted_at ? ` · quoted ${q.quoted_at}` : ''}
                {q.entered_by ? ` · entered by ${q.entered_by}` : ''}
                {delta != null && (
                  <>
                    {' · '}
                    <span className={delta < 0 ? 'delta-good' : 'delta-bad'}>
                      {fmtChf(Math.abs(delta), true)} {delta < 0 ? 'below' : 'above'} book
                    </span>
                  </>
                )}
              </small>
              {q.note && <small className="muted">{q.note}</small>}
            </div>
            {writable.length > 0 && (
              <select
                className="quote-promote"
                disabled={!!busy}
                value=""
                onChange={(ev) => ev.target.value && promoteQuote(q.id, ev.target.value)}
                title="Update a dataset with this supplier price by creating a new version"
              >
                <option value="">Update dataset…</option>
                {writable.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} → v{d.latest_version + 1}
                  </option>
                ))}
              </select>
            )}
            <button className="icon-button" title="Remove this quote" onClick={() => deleteQuote(q.id)}>
              <Trash2 size={15} />
            </button>
          </div>
        )
      })}
      {e.dataset.immutable && (
        <p className="quote-hint">
          <BookLock size={14} /> {e.dataset.name} is protected. Import or derive a writable dataset to update it with
          supplier quotes from this project.
        </p>
      )}
    </div>
  )
}
