import { AlertTriangle, HelpCircle } from 'lucide-react'
import { fmtChf } from '../format'
import { useEstimate, useStore } from '../store'
import type { ConfidenceBucket } from '../types'

const TONE: Record<ConfidenceBucket['key'], string> = {
  firm: 'firm',
  assumption: 'assumption',
  quote: 'quote',
  labour_only: 'labour-only',
  open: 'open',
}

const HELP: Record<ConfidenceBucket['key'], string> = {
  firm: 'A price from the price book for an exactly matched product, or a supplier quote already received.',
  assumption: 'Priced with a stated assumption, usually the nearest catalogue size. Check the assumption on the position.',
  quote: 'Priced against a supplier package benchmark. The number moves when the real quote arrives.',
  labour_only:
    'Hours-priced work such as Montage or drawings. The labour rate is firm; there is no material price because there is no material to price.',
  open: 'No reliable price yet; the estimator still has to decide.',
}

/**
 * How firm the price is, in money rather than a confidence score.
 *
 * The share that rests on a firm price is the first thing an estimator should see before signing,
 * and it is the number that visibly improves as supplier quotes are entered.
 */
export function ConfidenceStrip({ compact = false }: { compact?: boolean }) {
  const e = useEstimate()
  const filter = useStore((s) => s.filter)
  const c = e.confidence
  const u = c.unpriced

  return (
    <section className={`confidence-strip ${compact ? 'compact' : ''}`}>
      <div className="confidence-head">
        <div>
          <span className="eyebrow">PRICE CONFIDENCE</span>
          <h3>
            {c.firm_share_pct}% of the position value rests on a firm price
          </h3>
        </div>
        {!compact && (
          <small className="muted">
            {fmtChf(c.position_value_chf)} of priced positions · share by value, not by position count
          </small>
        )}
      </div>

      <div className="confidence-bar" role="img" aria-label="Price confidence by value">
        {c.buckets
          .filter((b) => b.share_pct > 0)
          .map((b) => (
            <span key={b.key} className={TONE[b.key]} style={{ width: `${b.share_pct}%` }} title={`${b.label}: ${b.share_pct}%`} />
          ))}
      </div>

      <div className="confidence-legend">
        {c.buckets.map((b) => (
          <button
            key={b.key}
            className={`confidence-item ${TONE[b.key]}`}
            disabled={!b.positions}
            title={HELP[b.key]}
            onClick={() => filter({ only: { label: b.label, ids: b.lv_ids }, pill: 'all', system: 'all' })}
          >
            <i />
            <span>
              <b>{b.share_pct}%</b>
              <small>{b.label}</small>
              <small className="muted">
                {b.positions} pos · {fmtChf(b.value_chf)}
              </small>
            </span>
          </button>
        ))}
      </div>

      {(u.estimated_positions > 0 || u.no_basis_positions > 0) && (
        <div className="confidence-exposure">
          <AlertTriangle size={16} />
          <div>
            <b>Material not yet priced</b>
            <p>
              {u.estimated_positions > 0 && (
                <>
                  {u.estimated_positions} positions have no price in the book; {fmtChf(u.estimated_material_chf)} is carried
                  as a placeholder estimated from comparable positions.
                </>
              )}
              {u.no_basis_positions > 0 && (
                <>
                  {' '}
                  A further <b>{u.no_basis_positions} positions carry labour only</b> ({fmtChf(u.no_basis_labour_chf)}) with no
                  comparable to estimate from — their material stays open until a supplier quote arrives.
                </>
              )}
            </p>
          </div>
          <button
            className="button small"
            onClick={() =>
              filter({
                only: {
                  label: 'Material not yet priced',
                  ids: [...u.lv_ids_estimated, ...u.lv_ids_no_basis],
                },
                pill: 'all',
                system: 'all',
              })
            }
          >
            Show {u.estimated_positions + u.no_basis_positions}
          </button>
        </div>
      )}
    </section>
  )
}

/** One line for the position detail: what this number rests on. */
export function PositionBasis({ lvId }: { lvId: string }) {
  const e = useEstimate()
  const p = e.positions.find((x) => x.lv_id === lvId)
  if (!p) return null
  if (p.quote) {
    const delta = p.book_unit_cost_chf != null ? p.net_unit_cost_chf! - p.book_unit_cost_chf : null
    return (
      <p className="basis-line quote">
        Price from <b>{p.quote.supplier}</b>
        {p.quote.reference ? ` (${p.quote.reference})` : ''}
        {p.quote.quoted_at ? `, quoted ${p.quote.quoted_at}` : ''}
        {delta != null && (
          <>
            {' — '}
            {fmtChf(Math.abs(delta), true)} {delta < 0 ? 'below' : 'above'} the price book
          </>
        )}
      </p>
    )
  }
  if (p.estimated_material_basis) {
    return (
      <p className="basis-line estimate">
        <HelpCircle size={14} /> {p.estimated_material_basis}
        {p.estimated_material_chf != null && <> Placeholder: {fmtChf(p.estimated_material_chf, true)}.</>}
      </p>
    )
  }
  return null
}
