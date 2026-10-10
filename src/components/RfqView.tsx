import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Estimate, RfqPackage } from '../types'
import { fmtChf, fmtNum } from '../format'

export function RfqView({ estimate }: { estimate: Estimate }) {
  const [rfqs, setRfqs] = useState<RfqPackage[] | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // refetch whenever the estimate changes, so edits on other tabs show up here
  useEffect(() => {
    api.rfqs(estimate.tender.id).then((r) => {
      setRfqs(r)
      setOpen((o) => o ?? r[0]?.key ?? null)
    }).catch((e) => setError(e.message))
  }, [estimate])

  if (error) return <div className="banner error">{error}</div>
  if (!rfqs) return <div className="empty">Preparing requests…</div>
  const current = rfqs.find((r) => r.key === open) ?? rfqs[0]
  const total = rfqs.reduce((s, r) => s + r.positions, 0)

  const copy = async (r: RfqPackage) => {
    await navigator.clipboard?.writeText(r.text).catch(() => {})
    setCopied(r.key)
    setTimeout(() => setCopied(null), 1500)
  }

  return (
    <div className="workspace rfq">
      <aside className="filters">
        <div className="filter-block">
          <div className="filter-title">Packages · {total} positions</div>
          {rfqs.map((r) => (
            <button key={r.key} className={`filter-item rfq-item ${r.key === current?.key ? 'active' : ''}`} onClick={() => setOpen(r.key)}>
              <span>{r.title}</span>
              <span className="muted small">
                {r.positions} pos.{r.unpriced ? ` · ${r.unpriced} unpriced` : ''}
              </span>
            </button>
          ))}
        </div>
        <p className="muted small">
          Every position with status Supplier quote is in exactly one request. Budgets are our internal benchmark and
          are not part of the request text.
        </p>
      </aside>
      {current && (
        <section className="table-wrap rfq-detail">
          <div className="table-toolbar">
            <div>
              <strong>{current.title}</strong>
              <span className="muted">
                {' '}
                · internal budget {current.budget_chf ? fmtChf(current.budget_chf) : 'none yet'} · PDF pages{' '}
                {current.pages.join(', ')}
              </span>
            </div>
            <div className="rfq-actions">
              <button className="btn" onClick={() => copy(current)}>
                {copied === current.key ? 'Copied' : 'Copy request text'}
              </button>
              <a className="btn primary" href={api.rfqUrl(estimate.tender.id, current.key)} download>
                Download item list (Excel)
              </a>
            </div>
          </div>
          <div className="table-scroll">
            <table className="positions">
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="num">Qty</th>
                  <th>Unit</th>
                  <th>System</th>
                  <th>Page</th>
                </tr>
              </thead>
              <tbody>
                {current.lines.map((l) => (
                  <tr key={l.lv_id} className="row">
                    <td className="desc">{l.text}</td>
                    <td className="num">{fmtNum(l.quantity)}</td>
                    <td>{l.unit}</td>
                    <td className="small">{l.system}</td>
                    <td>
                      <span className="page">p. {l.source_page}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="card-title rfq-text-title">Request text (German, for the supplier)</div>
            <pre className="rfq-text">{current.text}</pre>
          </div>
        </section>
      )}
    </div>
  )
}
