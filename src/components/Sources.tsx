import { Database, FileText, Link2 } from 'lucide-react'
import { api } from '../api'
import { useEstimate, useStore } from '../store'
import type { Position, TraceField, TraceLink } from '../types'
import { SheetCard, SheetUpload } from './Sheets'
import { FileLink, SourceLine } from './Trace'

const FIELD_LABEL: Record<TraceField, string> = {
  quantity: 'Quantity',
  net_unit_cost_chf: 'Unit cost',
  material_cost_chf: 'Material',
  base_hours_per_unit: 'Hours per unit',
  adjusted_install_hours: 'Install hours',
  hourly_rate_chf: 'Hourly rate',
  labour_cost_chf: 'Labour',
  direct_position_cost_chf: 'Direct cost',
}

/** Every document behind a position: product sheets, the company data rows and the tender pages. */
export function Sources({ p }: { p: Position }) {
  const e = useEstimate()
  const sheets = e.sheets.filter((s) => p.sheets.includes(s.id) || p.price_sheet === s.id)
  const links = Object.values(p.trace).flatMap((t) => t?.links ?? [])
  const unique = (kind: TraceLink['kind']) =>
    links.filter((l, i) => l.kind === kind && links.findIndex((x) => x.href === l.href) === i)
  const company = unique('company')
  const other = e.sheets.filter((s) => !sheets.includes(s))
  return (
    <div className="sources">
      <section>
        <h3>Product sheets</h3>
        {sheets.length ? (
          sheets.map((s) => <SheetCard key={s.id} sheet={s} targets={[p]} />)
        ) : (
          <p className="muted">No supplier sheet for this position yet.</p>
        )}
        <SheetUpload lvIds={[p.lv_id]} />
        {other.length > 0 && <LinkExisting p={p} options={other} />}
      </section>
      <section>
        <h3>Company data</h3>
        {company.length ? (
          <div className="source-files">
            {company.map((l) => (
              <div key={l.href + l.row} className="source-file">
                <Database size={16} />
                <FileLink link={l} />
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">No catalogue item or installation rule is used for this position.</p>
        )}
      </section>
      <section>
        <h3>Tender</h3>
        <div className="source-files">
          {unique('tender').map((l) => (
            <div key={l.href} className="source-file">
              <FileText size={16} />
              <FileLink link={l} />
            </div>
          ))}
        </div>
      </section>
      <section>
        <h3>Where each number comes from</h3>
        <div className="source-numbers">
          {(Object.keys(FIELD_LABEL) as TraceField[])
            .filter((k) => p.trace[k])
            .map((k) => (
              <div key={k}>
                <span>{FIELD_LABEL[k]}</span>
                <SourceLine trace={p.trace[k]} />
              </div>
            ))}
        </div>
      </section>
    </div>
  )
}

function LinkExisting({ p, options }: { p: Position; options: { id: string; name: string; lv_ids: string[] }[] }) {
  const e = useEstimate()
  const act = useStore((s) => s.act)
  return (
    <label className="link-existing">
      <Link2 size={13} />
      <select
        value=""
        aria-label="Link an existing product sheet"
        onChange={(ev) => {
          const s = options.find((o) => o.id === ev.target.value)
          if (!s) return
          act(
            'Linking sheet…',
            (tid) => api.linkSheet(tid, s.id, { lv_ids: [...s.lv_ids, p.lv_id] }),
            `${s.name} linked to ${p.lv_id}.`,
          )
        }}
      >
        <option value="">Link a sheet already uploaded for {e.tender.meta.project_name || 'this tender'}…</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  )
}
