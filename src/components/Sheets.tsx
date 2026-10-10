import { useEffect, useRef, useState } from 'react'
import { ExternalLink, FileUp, Link2, Trash2 } from 'lucide-react'
import { api } from '../api'
import { fmtChf, fmtWhen, money, unit } from '../format'
import { useEstimate, useStore } from '../store'
import type { Position, Sheet } from '../types'
import { Button } from './ui'

interface Candidate {
  value: number
  label: string
  page: number
}

/** Prices a sheet offers: net prices first, then list prices with the sheet's discount taken off, then the rest. */
function priceCandidates(sheet: Sheet): Candidate[] {
  const f = sheet.found
  const d = typeof f.discount?.value === 'number' ? f.discount.value : null
  const out: Candidate[] = []
  for (const kind of ['net', 'list', 'price'] as const) {
    for (const pr of f.prices.filter((x) => x.kind === kind)) {
      if (kind === 'list' && d != null) {
        const net = Math.round(pr.value * (1 - d / 100) * 100) / 100
        out.push({ value: net, page: pr.page, label: `List ${fmtChf(pr.value, true)} − ${d}% discount` })
      }
      out.push({ value: pr.value, page: pr.page, label: kind === 'net' ? 'Net price' : kind === 'list' ? 'List price' : 'Price' })
    }
  }
  return out.filter((c, i) => out.findIndex((x) => x.value === c.value) === i).slice(0, 8)
}

/** Upload a supplier product sheet or quote; it is linked to the given positions and read for prices. */
export function SheetUpload({ lvIds, supplier = '', label }: { lvIds: string[]; supplier?: string; label?: string }) {
  const act = useStore((s) => s.act)
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const send = async (files: FileList | null) => {
    for (const f of Array.from(files ?? [])) {
      await act(`Reading ${f.name}…`, (tid) => api.uploadSheet(tid, f, lvIds, supplier), `${f.name} added and read.`)
    }
  }
  return (
    <div
      className={`sheet-drop ${over ? 'over' : ''}`}
      role="button"
      tabIndex={0}
      onClick={() => input.current?.click()}
      onKeyDown={(ev) => ev.key === 'Enter' && input.current?.click()}
      onDragOver={(ev) => {
        ev.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(ev) => {
        ev.preventDefault()
        setOver(false)
        send(ev.dataTransfer.files)
      }}
    >
      <FileUp size={18} />
      <span>
        <strong>{label ?? 'Add a product sheet'}</strong>
        <small>
          PDF data sheet, quote or price list
          {lvIds.length ? ` · linked to ${lvIds.length === 1 ? lvIds[0] : `${lvIds.length} positions`}` : ''}
        </small>
      </span>
      <input
        ref={input}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        hidden
        onChange={(ev) => {
          send(ev.target.files)
          ev.target.value = ''
        }}
      />
    </div>
  )
}

/** A product sheet with what was read from it; its prices can be taken over to the linked positions. */
export function SheetCard({ sheet, targets }: { sheet: Sheet; targets: Position[] }) {
  const e = useEstimate()
  const { act, override } = useStore()
  const f = sheet.found
  const linked = e.positions.filter((p) => sheet.lv_ids.includes(p.lv_id))
  const first = (targets[0] ?? linked[0])?.lv_id ?? ''
  const [target, setTarget] = useState(first)
  useEffect(() => setTarget(first), [first])
  const use = async (c: Candidate) => {
    const ids = target === '*' ? linked.map((p) => p.lv_id) : [target]
    for (const id of ids) {
      await override(
        id,
        { net_unit_cost_chf: c.value, price_sheet: sheet.id, price_page: c.page, status: 'calculated' },
        `${ids.length > 1 ? `${ids.length} positions` : id}: unit price ${fmtChf(c.value, true)} from ${sheet.name}.`,
      )
    }
  }
  const facts = [
    ['Manufacturer', f.manufacturer],
    ['Type', f.type?.value],
    ['Article no.', f.article?.value],
    ['Discount', f.discount ? `${f.discount.value}%` : null],
    ['Delivery', f.lead_time?.value],
    ['Valid until', f.valid_until?.value],
  ].filter(([, v]) => v != null && v !== '')
  const candidates = priceCandidates(sheet)
  const choices = targets.length ? targets : linked
  return (
    <article className="sheet-card">
      <header>
        <a href={api.sheetUrl(e.tender.id, sheet.id)} target="_blank" rel="noreferrer">
          <span className="file-icon">PDF</span>
          <span>
            <strong>{sheet.name}</strong>
            <small>
              {sheet.supplier || 'Supplier not set'} · {f.pages} page{f.pages === 1 ? '' : 's'} · {fmtWhen(sheet.at)}
            </small>
          </span>
          <ExternalLink size={13} />
        </a>
        <button
          className="icon-button"
          aria-label={`Remove ${sheet.name}`}
          title="Remove sheet"
          onClick={() => act('Removing sheet…', (tid) => api.deleteSheet(tid, sheet.id), `${sheet.name} removed.`)}
        >
          <Trash2 size={14} />
        </button>
      </header>
      {!f.readable && <p className="muted">No text could be read from this file. Open it and enter the price by hand.</p>}
      {facts.length > 0 && (
        <dl className="sheet-facts">
          {facts.map(([k, v]) => (
            <div key={k as string}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      )}
      <div className="sheet-linked">
        <Link2 size={12} /> {linked.length ? linked.map((p) => p.lv_id).join(', ') : 'Not linked to a position'}
      </div>
      {candidates.length > 0 && choices.length > 0 && (
        <div className="sheet-prices">
          <div className="inline">
            <h5>Prices read from the sheet</h5>
            <select aria-label="Position to price" value={target} onChange={(ev) => setTarget(ev.target.value)}>
              {choices.map((p) => (
                <option key={p.lv_id} value={p.lv_id}>
                  for {p.lv_id} ({unit(p.unit)})
                </option>
              ))}
              {linked.length > 1 && <option value="*">for all {linked.length} linked positions</option>}
            </select>
          </div>
          {candidates.map((c) => {
            const p = e.positions.find((x) => x.lv_id === target)
            const current = !!p && p.price_sheet === sheet.id && p.net_unit_cost_chf === c.value
            return (
              <div className="sheet-price" key={`${c.value}-${c.page}`}>
                <span>
                  <strong>CHF {money(c.value, 2)}</strong>
                  <small>
                    {c.label} ·{' '}
                    <a href={api.sheetUrl(e.tender.id, sheet.id, c.page)} target="_blank" rel="noreferrer">
                      page {c.page}
                    </a>
                  </small>
                </span>
                <Button className="small" disabled={current || !target} onClick={() => use(c)}>
                  {current ? 'In use' : 'Use as unit price'}
                </Button>
              </div>
            )
          })}
        </div>
      )}
      {f.readable && !candidates.length && <p className="muted">No price found on this sheet.</p>}
    </article>
  )
}
