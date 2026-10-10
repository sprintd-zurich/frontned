import { useRef } from 'react'
import { Check, FileSpreadsheet, Upload } from 'lucide-react'
import { api } from '../api'
import { money } from '../format'
import { useEstimate, useStore } from '../store'
import type { Position } from '../types'

/** Upload a supplier product list at any time: unpriced positions are filled, the others get offers. */
export function AddProductList() {
  const input = useRef<HTMLInputElement>(null)
  const { act, busy } = useStore()
  return (
    <>
      <input
        ref={input}
        type="file"
        hidden
        accept=".xlsx,.xlsm,.csv,.txt,.pdf"
        onChange={(ev) => {
          const f = ev.target.files?.[0]
          ev.target.value = ''
          if (f) act(`Reading ${f.name}…`, (tid) => api.uploadSheet(tid, f, [], ''), `${f.name} read: see the activity for what it filled.`)
        }}
      />
      <button className="button" disabled={!!busy} onClick={() => input.current?.click()}>
        <Upload size={15} /> Add product list
      </button>
    </>
  )
}

/** Prices for the selected position from product lists, next to the price it has now; the estimator picks one. */
export function ListOffers({ p }: { p: Position }) {
  const e = useEstimate()
  const { act, busy } = useStore()
  if (!p.offers?.length) return null
  const inUse = (o: Position['offers'][number]) =>
    !!p.quote && p.quote.supplier === o.supplier && Math.abs(p.quote.net_cost_chf - o.price_chf) < 0.005
  return (
    <div className="inspector-section-card list-offers">
      <div className="inspector-card-head">
        <FileSpreadsheet size={15} color="#00987a" />
        <h4>Other prices from product lists</h4>
      </div>
      <div className="list-offer current">
        <span>
          <strong>Now: {p.quote ? `quote from ${p.quote.supplier}` : `price book${p.offers[0].current_supplier ? ` (${p.offers[0].current_supplier})` : ''}`}</strong>
          <small>{p.net_unit_cost_chf == null ? 'no price' : `CHF ${money(p.net_unit_cost_chf, 2)} / unit`}</small>
        </span>
        {p.quote && p.book_unit_cost_chf != null && (
          <button
            className="button small"
            disabled={!!busy}
            onClick={() => act('Back to the price book…', (tid) => api.deleteQuote(tid, p.quote!.id), `${p.ref}: price book price in use.`)}
          >
            Use price book (CHF {money(p.book_unit_cost_chf, 2)})
          </button>
        )}
      </div>
      {p.offers.map((o, i) => {
        const delta = o.current_chf ? ((o.price_chf - o.current_chf) / o.current_chf) * 100 : null
        const used = inUse(o)
        return (
          <div key={i} className={`list-offer ${used ? 'used' : ''}`}>
            <span>
              <strong>{o.supplier}</strong>
              <small>
                {o.description}
                {o.article ? ` · ${o.article}` : ''}
              </small>
              <a className="muted" href={api.sheetUrl(e.tender.id, o.sheet)} target="_blank" rel="noreferrer">
                {o.sheet_name}, {o.where}
              </a>
            </span>
            <span className="list-offer-price">
              <b>CHF {money(o.price_chf, 2)}</b>
              {delta != null && Math.abs(delta) >= 0.05 && (
                <small className={delta < 0 ? 'cheaper' : 'dearer'}>
                  {delta > 0 ? '+' : ''}
                  {delta.toFixed(1)}%
                </small>
              )}
            </span>
            {used ? (
              <span className="list-offer-used">
                <Check size={14} /> In use
              </span>
            ) : (
              <button
                className="button small"
                disabled={!!busy}
                onClick={() =>
                  act(
                    'Applying the price…',
                    (tid) =>
                      api.addQuote(tid, {
                        lv_id: p.lv_id,
                        supplier: o.supplier,
                        net_cost_chf: o.price_chf,
                        reference: o.sheet_name,
                        note: `From product list ${o.sheet_name}, ${o.where}: ${o.description}`,
                      }),
                    `${p.ref}: price from ${o.supplier} in use.`,
                  )
                }
              >
                Use this price
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
