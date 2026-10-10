import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, FileCheck2, PenLine, XCircle } from 'lucide-react'
import { api } from '../api'
import { fmtChf, fmtNum } from '../format'
import { useEstimate, useStore } from '../store'
import type { Validation as ValidationData, ValidationField, ValidationPosition } from '../types'
import { Button, Empty } from '../components/ui'

const fieldValue = (v: ValidationField['expected'], kind: ValidationField['kind']) => {
  if (v === null || v === undefined || v === '') return '–'
  if (typeof v === 'boolean') return v ? 'yes' : 'no'
  if (kind === 'chf') return fmtChf(Number(v), true)
  if (kind === 'hours') return `${fmtNum(Number(v))} h`
  if (kind === 'number') return fmtNum(Number(v))
  return String(v)
}

/** Equans' own numbers for a reference position, next to the ones the engine produced. */
function FieldTable({ fields }: { fields: ValidationField[] }) {
  return (
    <table className="validation-fields">
      <thead>
        <tr>
          <th>Field</th>
          <th>Equans reference</th>
          <th>This tool</th>
          <th aria-label="Result" />
        </tr>
      </thead>
      <tbody>
        {fields.map((f) => (
          <tr key={f.field} className={f.match ? '' : 'differs'}>
            <td>{f.label}</td>
            <td className="num">{fieldValue(f.expected, f.kind)}</td>
            <td className="num">{fieldValue(f.actual, f.kind)}</td>
            <td className="num">
              {f.match ? <CheckCircle2 size={15} className="ok" /> : <XCircle size={15} className="bad" />}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Row({ p }: { p: ValidationPosition }) {
  const navigate = useNavigate()
  const { filter, select } = useStore()
  const [open, setOpen] = useState(false)
  const edited = p.overridden.length > 0 || !!p.quote

  return (
    <div className={`validation-row ${p.match ? 'pass' : edited ? 'edited' : 'fail'} ${open ? 'open' : ''}`}>
      <button className="validation-row-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <span className="validation-ids">
          <code className="ref-id" title="The id Equans uses in its reference file">
            {p.lv_id}
          </code>
          {p.our_ref && (
            <code className="ref-id ours" title="Our reference: system, section, tender page, item on that page">
              {p.our_ref}
            </code>
          )}
        </span>
        <span className="validation-desc">
          <b>{p.description}</b>
          <small>
            {p.category} · {p.system} · tender page {p.source_page}
            {p.title ? ` · matched “${p.title}${p.variant ? ` ${p.variant}` : ''}”` : ''}
          </small>
        </span>
        {p.match ? (
          <span className="validation-verdict ok">
            <CheckCircle2 size={15} /> Exact
          </span>
        ) : edited ? (
          <span className="validation-verdict edited">
            <PenLine size={15} /> {p.quote ? 'Supplier quote' : 'Estimator edited'}
          </span>
        ) : (
          <span className="validation-verdict bad">
            <AlertTriangle size={15} /> {p.found ? `${p.mismatches.length} differ` : 'Not extracted'}
          </span>
        )}
      </button>
      {open && (
        <div className="validation-row-body">
          {!p.found ? (
            <p className="muted">
              The extraction produced no position on page {p.source_page} with quantity {fmtNum(Number(p.fields.length))}. This
              reference position is not covered.
            </p>
          ) : (
            <>
              {p.quote && (
                <p className="validation-note">
                  <PenLine size={14} /> A supplier quote from <b>{p.quote.supplier}</b>
                  {p.quote.reference ? ` (${p.quote.reference})` : ''} now prices this position, so it is expected to
                  differ from the reference figure.
                </p>
              )}
              {p.overridden.length > 0 && (
                <p className="validation-note">
                  <PenLine size={14} /> The estimator overrode {p.overridden.join(', ')} on this position, so a difference
                  from the reference is expected.
                </p>
              )}
              <FieldTable fields={p.fields} />
              <div className="validation-row-actions">
                <Button
                  onClick={() => {
                    if (!p.our_lv_id) return
                    filter({ only: { label: `Equans reference ${p.lv_id}`, ids: [p.our_lv_id] }, pill: 'all', system: 'all' })
                    select(p.our_lv_id)
                    navigate('/matched')
                  }}
                >
                  Open {p.our_ref} in the tender
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Proof screen: the 22 positions Equans priced by hand, recalculated by the engine.
 * Nothing here is configurable — it reads the starter package's ground truth and compares.
 */
export function Validation() {
  const e = useEstimate()
  const [data, setData] = useState<ValidationData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [only, setOnly] = useState<'all' | 'differs'>('all')

  useEffect(() => {
    let live = true
    api
      .validation(e.tender.id)
      .then((v) => live && setData(v))
      .catch((err: Error) => live && setError(err.message))
    return () => {
      live = false
    }
  }, [e.tender.id, e.positions])

  if (error) return <Empty icon={<AlertTriangle size={30} />} title="Could not run the validation">{error}</Empty>
  if (!data) return <div className="loading-state"><span className="spinner" /> Comparing with the Equans reference…</div>

  const s = data.summary
  const shown = only === 'all' ? data.positions : data.positions.filter((p) => !p.match)

  return (
    <div className="validation-page">
      <header className={`validation-hero ${s.unexplained === 0 ? 'pass' : 'fail'}`}>
        <div className="validation-hero-main">
          <span className="eyebrow">ENGINE VALIDATION · GROUND TRUTH</span>
          <h1>
            {s.exact} of {s.total} Equans reference positions reproduced exactly
            {s.edited > 0 && <small className="validation-hero-sub">{s.edited} priced from a quote or an estimator edit</small>}
          </h1>
          {e.dataset.id !== 'equans-starter' && (
            <p className="validation-note">
              <AlertTriangle size={14} /> This tender is priced with {e.dataset.name} v{e.dataset.version}. The reference figures
              were calculated with the Equans starter package, so differences are expected until you switch back in Product
              Matching.
            </p>
          )}
          <p>
            Every number below is recalculated by this tool from the tender PDF and the reference data, then compared with
            the figures Equans calculated by hand. Source: <code>{data.source}</code>
          </p>
        </div>
        <div className="validation-hero-badge">
          {s.unexplained === 0 ? <FileCheck2 size={34} /> : <AlertTriangle size={34} />}
          <strong>{Math.round((s.exact / Math.max(s.total, 1)) * 100)}%</strong>
          <small>field-for-field</small>
        </div>
      </header>

      <div className="validation-summary">
        <section className="card validation-totals">
          <h2>Subset totals</h2>
          <small className="muted">The 22 reference positions rolled up, against the published summary.</small>
          <table>
            <tbody>
              {data.totals.map((t) => (
                <tr key={t.label} className={t.match ? '' : 'differs'}>
                  <td>{t.label}</td>
                  <td className="num">{fmtChf(t.expected, true)}</td>
                  <td className="num">{fmtChf(t.actual, true)}</td>
                  <td className="num">
                    {t.match ? <CheckCircle2 size={15} className="ok" /> : <XCircle size={15} className="bad" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="card validation-totals">
          <h2>Recommended bid range</h2>
          <small className="muted">Scenario prices and win probabilities on the reference baseline.</small>
          <table>
            <tbody>
              {data.scenarios.map((sc) => (
                <tr key={sc.scenario} className={sc.match ? '' : 'differs'}>
                  <td>
                    {sc.scenario} <small className="muted">{sc.margin_pct}%</small>
                  </td>
                  <td className="num">
                    {sc.expected_bid_chf == null ? '–' : fmtChf(sc.expected_bid_chf)}
                    <small className="muted"> · {Math.round((sc.expected_win_probability ?? 0) * 100)}%</small>
                  </td>
                  <td className="num">
                    {fmtChf(sc.actual_bid_chf)}
                    <small className="muted"> · {Math.round(sc.actual_win_probability * 100)}%</small>
                  </td>
                  <td className="num">
                    {sc.match ? <CheckCircle2 size={15} className="ok" /> : <XCircle size={15} className="bad" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <section className="card validation-list">
        <div className="section-heading">
          <div>
            <h2>Position by position</h2>
            <small className="muted">
              {s.exact} exact · {s.unexplained} unexplained · {s.total - s.found} not extracted · {s.edited} priced from a
              quote or an edit
            </small>
          </div>
          <div className="pill-row">
            <button className={`pill ${only === 'all' ? 'active' : ''}`} onClick={() => setOnly('all')}>
              All {s.total}
            </button>
            <button className={`pill ${only === 'differs' ? 'active' : ''}`} onClick={() => setOnly('differs')}>
              Differences {s.total - s.exact}
            </button>
          </div>
        </div>
        {shown.length === 0 ? (
          <Empty icon={<CheckCircle2 size={28} />} title="No differences">
            Every reference position matches the published figures to the cent.
          </Empty>
        ) : (
          <div className="validation-rows">
            {shown.map((p) => (
              <Row key={p.lv_id} p={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
